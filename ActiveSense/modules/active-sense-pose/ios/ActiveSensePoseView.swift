import AVFoundation
import ExpoModulesCore
import MediaPipeTasksVision
import UIKit

// ActiveSensePoseView owns the iOS camera preview and MediaPipe pose detection.
final class ActiveSensePoseView: ExpoView {
  // These events are sent back to React Native.
  let onLandmarks = EventDispatcher()
  let onStatus = EventDispatcher()

  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "com.activesense.pose.camera")
  private let inferenceQueue = DispatchQueue(label: "com.activesense.pose.inference")
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var poseLandmarker: PoseLandmarker?
  private var enabled = true
  private var cameraFacing = "front"
  private var isConfigured = false
  private var isRunning = false
  private var lastInferenceTime = CACurrentMediaTime()
  private var lastFrameWidth = 0
  private var lastFrameHeight = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // The preview should fill its React Native container.
    clipsToBounds = true
    backgroundColor = UIColor.black
    configurePreviewLayer()
    requestCameraAndStart()
  }

  @objc required override init() {
    fatalError("Use init(appContext:) to create ActiveSensePoseView.")
  }

  deinit {
    // Stop the camera session when React Native releases the view.
    sessionQueue.async { [session] in
      if session.isRunning {
        session.stopRunning()
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Keep the native camera layer aligned after rotations or layout changes.
    previewLayer?.frame = bounds
    updatePreviewConnection()
  }

  func setEnabled(_ enabled: Bool) {
    // React toggles tracking by starting or stopping the session.
    self.enabled = enabled
    enabled ? startSession() : stopSession()
  }

  func setCameraFacing(_ cameraFacing: String) {
    // Rebuild the capture inputs when switching cameras.
    guard self.cameraFacing != cameraFacing else {
      return
    }
    self.cameraFacing = cameraFacing
    sessionQueue.async { [weak self] in
      self?.configureSession(resetInputs: true)
    }
  }

  func restart() {
    // A restart clears session configuration and starts fresh.
    sessionQueue.async { [weak self] in
      self?.isConfigured = false
      self?.configureSession(resetInputs: true)
      self?.startSession()
    }
  }

  private func configurePreviewLayer() {
    // AVCaptureVideoPreviewLayer displays the live camera feed under React overlays.
    let layer = AVCaptureVideoPreviewLayer(session: session)
    layer.videoGravity = .resizeAspectFill
    layer.frame = bounds
    self.layer.addSublayer(layer)
    previewLayer = layer
  }

  private func requestCameraAndStart() {
    // Ask iOS for camera permission before configuring the session.
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:
      startSession()
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
        granted ? self?.startSession() : self?.emitStatus("camera-permission-denied")
      }
    default:
      emitStatus("camera-permission-denied")
    }
  }

  private func startSession() {
    // Camera work stays on a serial queue so UIKit remains responsive.
    guard enabled else {
      return
    }
    sessionQueue.async { [weak self] in
      guard let self else {
        return
      }
      self.configureSession(resetInputs: false)
      guard self.isConfigured, !self.session.isRunning else {
        return
      }
      self.session.startRunning()
      self.isRunning = true
      self.emitStatus("native-pose-running")
    }
  }

  private func stopSession() {
    // Pause tracking without destroying the view.
    sessionQueue.async { [weak self] in
      guard let self, self.session.isRunning else {
        return
      }
      self.session.stopRunning()
      self.isRunning = false
      self.emitStatus("native-pose-paused")
    }
  }

  private func configureSession(resetInputs: Bool) {
    // Configure camera input, frame output, and MediaPipe once per session.
    guard !isConfigured || resetInputs else {
      return
    }

    session.beginConfiguration()
    session.sessionPreset = .high

    if resetInputs {
      session.inputs.forEach { session.removeInput($0) }
      session.outputs.forEach { session.removeOutput($0) }
      isConfigured = false
    }

    guard let camera = cameraDevice(), let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else {
      session.commitConfiguration()
      emitStatus("camera-device-unavailable")
      return
    }

    session.addInput(input)

    let output = AVCaptureVideoDataOutput()
    output.alwaysDiscardsLateVideoFrames = true
    output.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    output.setSampleBufferDelegate(self, queue: inferenceQueue)

    guard session.canAddOutput(output) else {
      session.commitConfiguration()
      emitStatus("camera-output-unavailable")
      return
    }

    session.addOutput(output)
    output.connection(with: .video)?.videoOrientation = .portrait
    output.connection(with: .video)?.automaticallyAdjustsVideoMirroring = false
    // Keep analysis frames unmirrored. React mirrors the overlay for the front camera,
    // while the preview layer is mirrored visually below, avoiding a double flip.
    output.connection(with: .video)?.isVideoMirrored = false
    updatePreviewConnection()
    session.commitConfiguration()

    do {
      // MediaPipe must be ready before camera frames start arriving.
      try configurePoseLandmarker()
      isConfigured = true
      emitStatus("native-pose-ready")
    } catch {
      isConfigured = false
      emitStatus("mediapipe-unavailable")
    }
  }

  private func cameraDevice() -> AVCaptureDevice? {
    // Pick the requested physical camera, defaulting to front-facing.
    let position: AVCaptureDevice.Position = cameraFacing == "back" ? .back : .front
    return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
  }

  private func updatePreviewConnection() {
    DispatchQueue.main.async { [weak self] in
      guard let self, let connection = self.previewLayer?.connection else {
        return
      }
      connection.videoOrientation = .portrait
      if connection.isVideoMirroringSupported {
        connection.automaticallyAdjustsVideoMirroring = false
        connection.isVideoMirrored = self.cameraFacing == "front"
      }
    }
  }

  private func configurePoseLandmarker() throws {
    // Reuse the detector because creating it is relatively expensive.
    if poseLandmarker != nil {
      return
    }

    guard let modelPath = Bundle(for: ActiveSensePoseView.self).path(
      forResource: "pose_landmarker_lite",
      ofType: "task"
    ) else {
      // Without the bundled task file, JS should show a clear status message.
      emitStatus("pose-model-missing")
      throw NSError(domain: "ActiveSensePose", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "pose_landmarker_lite.task is missing from the iOS bundle."
      ])
    }

    let options = PoseLandmarkerOptions()
    options.baseOptions.modelAssetPath = modelPath
    options.runningMode = .liveStream
    options.numPoses = 1
    options.minPoseDetectionConfidence = 0.5
    options.minPosePresenceConfidence = 0.5
    options.minTrackingConfidence = 0.5
    options.poseLandmarkerLiveStreamDelegate = self
    poseLandmarker = try PoseLandmarker(options: options)
  }

  private func emitStatus(_ status: String) {
    // React Native event dispatch must happen on the main queue.
    DispatchQueue.main.async { [weak self] in
      self?.onStatus(["status": status])
    }
  }
}

extension ActiveSensePoseView: AVCaptureVideoDataOutputSampleBufferDelegate {
  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    // Drop frames when disabled or when MediaPipe is not configured yet.
    guard enabled, poseLandmarker != nil else {
      return
    }

    let now = CACurrentMediaTime()
    guard now - lastInferenceTime >= 1.0 / 30.0 else {
      // Limit inference to roughly 30 FPS to control CPU and battery use.
      return
    }
    lastInferenceTime = now

    if let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) {
      let width = CVPixelBufferGetWidth(pixelBuffer)
      let height = CVPixelBufferGetHeight(pixelBuffer)
      lastFrameWidth = min(width, height)
      lastFrameHeight = max(width, height)
    }

    let timestamp = Int(CMSampleBufferGetPresentationTimeStamp(sampleBuffer).seconds * 1000)
    do {
      // Convert the camera frame into a MediaPipe image and run async detection.
      let image = try MPImage(sampleBuffer: sampleBuffer, orientation: .up)
      try poseLandmarker?.detectAsync(image: image, timestampInMilliseconds: timestamp)
    } catch {
      emitStatus("pose-frame-dropped")
    }
  }
}

extension ActiveSensePoseView: PoseLandmarkerLiveStreamDelegate {
  func poseLandmarker(
    _ poseLandmarker: PoseLandmarker,
    didFinishDetection result: PoseLandmarkerResult?,
    timestampInMilliseconds: Int,
    error: Error?
  ) {
    // MediaPipe reports errors through this delegate instead of throwing here.
    if error != nil {
      emitStatus("pose-detection-error")
      return
    }

    // Convert MediaPipe landmarks into plain dictionaries that JS can consume.
    let landmarks = result?.landmarks.first?.map { landmark -> [String: Any] in
      var point: [String: Any] = [
        "x": landmark.x,
        "y": landmark.y,
        "z": landmark.z
      ]
      if let visibility = landmark.visibility {
        point["visibility"] = visibility
      }
      return point
    } ?? []

    DispatchQueue.main.async { [weak self] in
      // Emit the latest pose frame to React Native.
      self?.onLandmarks([
        "landmarks": landmarks,
        "timestamp": timestampInMilliseconds,
        "frameWidth": self?.lastFrameWidth ?? 0,
        "frameHeight": self?.lastFrameHeight ?? 0
      ])
    }
  }
}
