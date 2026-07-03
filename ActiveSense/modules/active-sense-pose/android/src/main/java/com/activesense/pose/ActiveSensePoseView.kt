package com.activesense.pose

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// ActiveSensePoseView owns the Android CameraX preview and MediaPipe pose detector.
@SuppressLint("ViewConstructor")
class ActiveSensePoseView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  // These events are sent back to React Native.
  private val onLandmarks by EventDispatcher()
  private val onStatus by EventDispatcher()
  private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val previewView = PreviewView(context).apply {
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }
  private var cameraProvider: ProcessCameraProvider? = null
  private var poseLandmarker: PoseLandmarker? = null
  private var enabled = true
  private var cameraFacing = "front"
  private var lastInferenceAt = 0L
  private var lastFrameTimestamp = 0L

  override val shouldUseAndroidLayout = true

  init {
    // PreviewView renders the live camera feed inside the React Native view.
    addView(
      previewView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    )
    post { startCameraIfAllowed() }
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    // Measure the camera preview to fill the space React Native gives us.
    measureChild(previewView, widthMeasureSpec, heightMeasureSpec)
    setMeasuredDimension(
      ViewGroup.resolveSize(previewView.measuredWidth, widthMeasureSpec),
      ViewGroup.resolveSize(previewView.measuredHeight, heightMeasureSpec)
    )
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    // Keep the preview aligned with the native view bounds.
    previewView.layout(0, 0, right - left, bottom - top)
  }

  fun setEnabled(nextEnabled: Boolean) {
    // React toggles tracking by binding or unbinding CameraX.
    enabled = nextEnabled
    if (enabled) {
      startCameraIfAllowed()
    } else {
      cameraProvider?.unbindAll()
      emitStatus("native-pose-paused")
    }
  }

  fun setCameraFacing(nextFacing: String) {
    // Rebind CameraX when the user flips cameras.
    if (cameraFacing == nextFacing) {
      return
    }
    cameraFacing = nextFacing
    restart()
  }

  fun restart() {
    // Restart by clearing CameraX bindings and starting again.
    cameraProvider?.unbindAll()
    startCameraIfAllowed()
  }

  fun cleanup() {
    // Release native resources when React Native destroys the view.
    cameraProvider?.unbindAll()
    poseLandmarker?.close()
    poseLandmarker = null
    cameraExecutor.shutdown()
  }

  private fun startCameraIfAllowed() {
    // Camera permission is required before CameraX can bind use cases.
    if (!enabled) {
      return
    }

    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(
        appContext.throwingActivity,
        arrayOf(Manifest.permission.CAMERA),
        4101
      )
      emitStatus("camera-permission-requested")
      return
    }

    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
      cameraProvider = providerFuture.get()
      bindCamera()
    }, ContextCompat.getMainExecutor(context))
  }

  private fun bindCamera() {
    // Bind preview and analysis use cases to the current Activity lifecycle.
    val lifecycleOwner = appContext.throwingActivity as? LifecycleOwner
    val provider = cameraProvider

    if (provider == null || lifecycleOwner == null) {
      emitStatus("camera-lifecycle-unavailable")
      return
    }

    val lensFacing = if (cameraFacing == "back") {
      CameraSelector.LENS_FACING_BACK
    } else {
      CameraSelector.LENS_FACING_FRONT
    }

    val cameraSelector = CameraSelector.Builder()
      .requireLensFacing(lensFacing)
      .build()

    val preview = Preview.Builder().build().also {
      it.setSurfaceProvider(previewView.surfaceProvider)
    }

    val analysis = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
      .build()
      .also {
        // Camera frames are analyzed on a background executor.
        it.setAnalyzer(cameraExecutor) { imageProxy ->
          analyzeFrame(imageProxy)
        }
      }

    try {
      // MediaPipe must be ready before frames are analyzed.
      ensurePoseLandmarker()
      provider.unbindAll()
      provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, analysis)
      emitStatus("native-pose-running")
    } catch (_: Exception) {
      emitStatus("mediapipe-unavailable")
    }
  }

  private fun ensurePoseLandmarker() {
    // Reuse the detector because model setup is expensive.
    if (poseLandmarker != null) {
      return
    }

    val baseOptions = BaseOptions.builder()
      .setModelAssetPath("pose_landmarker_lite.task")
      .build()

    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .setResultListener(::handleResult)
      .setErrorListener { emitStatus("pose-detection-error") }
      .build()

    poseLandmarker = PoseLandmarker.createFromOptions(context, options)
  }

  private fun analyzeFrame(imageProxy: ImageProxy) {
    try {
      // Throttle inference to roughly 30 FPS.
      val now = SystemClock.uptimeMillis()
      if (now - lastInferenceAt < 33L) {
        return
      }
      lastInferenceAt = now
      lastFrameTimestamp = now

      val bitmap = imageProxy.toBitmap()
      // CameraX frames must be rotated and mirrored to match the preview.
      val rotated = bitmap.rotateAndMirror(
        imageProxy.imageInfo.rotationDegrees,
        cameraFacing == "front"
      )
      val mpImage = BitmapImageBuilder(rotated).build()
      poseLandmarker?.detectAsync(mpImage, now)
    } catch (_: Exception) {
      emitStatus("pose-frame-dropped")
    } finally {
      // ImageProxy must always be closed or CameraX will stop delivering frames.
      imageProxy.close()
    }
  }

  private fun handleResult(result: PoseLandmarkerResult, @Suppress("UNUSED_PARAMETER") input: com.google.mediapipe.framework.image.MPImage) {
    // Convert MediaPipe landmarks into plain maps that JS can receive.
    val firstPose = result.landmarks().firstOrNull().orEmpty()
    val landmarks = firstPose.map { landmark ->
      mapOf(
        "x" to landmark.x(),
        "y" to landmark.y(),
        "z" to landmark.z(),
        "visibility" to landmark.visibility().orElse(0f)
      )
    }

    post {
      // Emit the latest pose frame back onto the React Native thread.
      onLandmarks(
        mapOf(
          "landmarks" to landmarks,
          "timestamp" to lastFrameTimestamp
        )
      )
    }
  }

  private fun ImageProxy.toBitmap(): Bitmap {
    // The analysis output is RGBA, so it can be copied directly into a bitmap.
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    planes[0].buffer.rewind()
    bitmap.copyPixelsFromBuffer(planes[0].buffer)
    return bitmap
  }

  private fun Bitmap.rotateAndMirror(rotationDegrees: Int, mirror: Boolean): Bitmap {
    // Front-camera frames are mirrored so overlays line up with what users see.
    if (rotationDegrees == 0 && !mirror) {
      return this
    }

    val matrix = Matrix().apply {
      postRotate(rotationDegrees.toFloat())
      if (mirror) {
        postScale(-1f, 1f)
      }
    }

    return Bitmap.createBitmap(this, 0, 0, width, height, matrix, true)
  }

  private fun emitStatus(status: String) {
    // Status events help JS show useful setup and error messages.
    post {
      onStatus(mapOf("status" to status))
    }
  }
}
