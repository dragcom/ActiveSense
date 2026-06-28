import ExpoModulesCore

// ActiveSensePoseModule exposes the iOS camera pose view to React Native.
public class ActiveSensePoseModule: Module {
  public func definition() -> ModuleDefinition {
    // This name must match requireNativeView('ActiveSensePose') in TypeScript.
    Name("ActiveSensePose")

    View(ActiveSensePoseView.self) {
      // JS listens to landmarks for tracking and status for setup messages.
      Events("onLandmarks", "onStatus")

      // React controls whether the camera session should run.
      Prop("enabled") { (view: ActiveSensePoseView, enabled: Bool) in
        view.setEnabled(enabled)
      }

      // React can switch between front and back camera.
      Prop("cameraFacing") { (view: ActiveSensePoseView, cameraFacing: String) in
        view.setCameraFacing(cameraFacing)
      }

      // The preview can be restarted from JS if the camera pipeline needs a reset.
      AsyncFunction("restart") { (view: ActiveSensePoseView) in
        view.restart()
      }
    }
  }
}
