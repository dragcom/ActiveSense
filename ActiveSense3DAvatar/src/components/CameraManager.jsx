import { CameraControls } from "@react-three/drei";
import { useRef } from "react";
import { useEffect } from "react";
import { useConfiguratorStore } from "../store";
import { UI_MODES } from "../store";

export const START_CAMERA_POSITION = [500, 1000, 1000];
export const DEFAULT_CAMERA_POSITION = [-1, 1, 5];
export const LIVE_CAMERA_POSITION = [0, 1.0, 6.5]; // Slightly lower camera height
export const DEFAULT_CAMERA_TARGET = [0, 0, 0];
export const LIVE_CAMERA_TARGET = [0, 0.6, 0]; // Lowering the target shifts the avatar UP on the screen

export const CameraManager = () => {
    const controls = useRef();
    const currentCategory = useConfiguratorStore((state) => state.currentCategory);
    const mode = useConfiguratorStore((state) => state.mode);
    const initialLoading = useConfiguratorStore((state) => state.loading);  

    const isLiveMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'live';

    useEffect(() => {
        if (!controls.current) return;

        if (initialLoading) {
            controls.current.setLookAt(
                ...START_CAMERA_POSITION,
                ...DEFAULT_CAMERA_TARGET,
            );
        } else if (isLiveMode) {
            // Center the avatar by looking at its upper body/torso
            controls.current.setLookAt(
                ...LIVE_CAMERA_POSITION,
                ...LIVE_CAMERA_TARGET,
                true
            );
        } else if (mode === UI_MODES.CUSTOMIZE && currentCategory?.expand?.cameraPlacement) {
            controls.current.setLookAt(
                ...currentCategory.expand.cameraPlacement.position,
                ...currentCategory.expand.cameraPlacement.target,
                true
            );
        } else {
            controls.current.setLookAt(
                ...DEFAULT_CAMERA_POSITION,
                ...DEFAULT_CAMERA_TARGET,
                true
            );
        }
    }, [currentCategory, mode, initialLoading, isLiveMode]);

    return (
        <CameraControls
            ref={controls}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
            minDistance={2}
            maxDistance={10}
        />
    );
};