package com.activesense.pose

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// ActiveSensePoseModule exposes the Android camera pose view to React Native.
class ActiveSensePoseModule : Module() {
  override fun definition() = ModuleDefinition {
    // This name must match requireNativeView("ActiveSensePose") in TypeScript.
    Name("ActiveSensePose")

    View(ActiveSensePoseView::class) {
      // JS listens to pose frames and small lifecycle status messages.
      Events("onLandmarks", "onStatus")

      // React controls whether the native camera should run.
      Prop("enabled") { view: ActiveSensePoseView, enabled: Boolean ->
        view.setEnabled(enabled)
      }

      // React can switch between front and back lenses.
      Prop("cameraFacing") { view: ActiveSensePoseView, cameraFacing: String ->
        view.setCameraFacing(cameraFacing)
      }

      // Expose a reset hook for camera recovery.
      AsyncFunction("restart") { view: ActiveSensePoseView ->
        view.restart()
      }

      // Release CameraX and MediaPipe resources when React destroys the view.
      OnViewDestroys { view: ActiveSensePoseView ->
        view.cleanup()
      }
    }
  }
}
