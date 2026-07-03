  # This podspec packages the local iOS pose module for CocoaPods.
Pod::Spec.new do |s|
  s.name           = 'ActiveSensePose'
  s.version        = '0.1.0'
  s.summary        = 'Native MediaPipe pose camera view for ActiveSense.'
  s.description    = 'Runs MediaPipe Pose Landmarker on iOS camera frames and emits normalized landmarks to React Native.'
  s.author         = 'ActiveSense'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  # Expo module support and MediaPipe are required by ActiveSensePoseView.swift.
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision'

  # Bundle Swift source plus the MediaPipe task model into the native app.
  s.source_files = '**/*.{h,m,mm,swift}'
  s.resources = ['pose_landmarker_lite.task']
end
