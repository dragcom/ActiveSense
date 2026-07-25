import { Environment, Gltf, Float, useProgress } from '@react-three/drei';
import { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';

import { Avatar } from './Avatar';
import { CameraManager } from './CameraManager';
import { LoadingAvatar } from './LoadingAvatar';
import { useConfiguratorStore } from '../store';

export const Experience = () => {
	const { gl } = useThree();
	const screenshotRequested = useConfiguratorStore((state) => state.screenshotRequested);
	const isLiveMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'live';

	// Handle React Native / Web Canvas Screenshot with Watermark
	useFrame(() => {
		if (!screenshotRequested) return;
		const webglDataUrl = gl.domElement.toDataURL("image/png");
		useConfiguratorStore.setState({ screenshotRequested: false });
		
		const baseSceneImage = new Image();
		baseSceneImage.src = webglDataUrl;

		baseSceneImage.onload = () => {
			const overlayCanvas = document.createElement("canvas");
			overlayCanvas.width = gl.domElement.width;
			overlayCanvas.height = gl.domElement.height;
			const overlayContext = overlayCanvas.getContext("2d");

			if (!overlayContext) return;

			overlayContext.drawImage(baseSceneImage, 0, 0);

			const executeDownload = () => {
				const base64Image = overlayCanvas.toDataURL("image/png");

				if (window.ReactNativeWebView) {
					window.ReactNativeWebView.postMessage(
						JSON.stringify({
							type: 'CAPTURE_SCREENSHOT',
							data: base64Image 
						})
					);
				} else {
					const link = document.createElement("a");
					const date = new Date();
					const dateString = date.toISOString().split("T")[0];
					const timeString = date.toLocaleTimeString().replace(/:/g, "-");

					link.setAttribute("download", `Avatar_${dateString}_${timeString}.png`);
					link.setAttribute("href", base64Image);

					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
				}
			};

			const logo = new Image();
			logo.onerror = () => {
				console.warn("Watermark logo failed to load. Downloading clean avatar snapshot fallback.");
				executeDownload();
			};

			logo.onload = () => {
				const logoHeight = 100;
				const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;
				const x = overlayCanvas.width - logoWidth - 42;
				const y = overlayCanvas.height - logoHeight - 42;

				overlayContext.drawImage(logo, x, y, logoWidth, logoHeight);
				executeDownload();
			};
			logo.crossOrigin = "anonymous";
			logo.src = "/images/ActiveSense_appLogo.svg";
		};
	});

	// Loading State Timing (Prevents flicker with a minimum 1.5s display window)
	const { active } = useProgress();
	const [loading, setLoading] = useState(isLiveMode ? false : active);
	const setLoadingAt = useRef(0);

	useEffect(() => {
		if (isLiveMode) {
			setLoading(false);
			return;
		}

		let timeout;
		if (active) {
			timeout = setTimeout(() => {
				setLoading(true);
				setLoadingAt.current = Date.now();
			}, 50); 
		} else {
			const elapsed = Date.now() - setLoadingAt.current;
			const remaining = Math.max(0, 1500 - elapsed);
			timeout = setTimeout(() => {
				setLoading(false);
			}, remaining);
		}
		return () => clearTimeout(timeout);
	}, [active, isLiveMode]);

	// Configurator Mode Spring Animations
	const { scale, spin, floatHeight } = useSpring({
		scale: loading && !isLiveMode ? 0.5 : 1,
		spin: loading && !isLiveMode ? Math.PI * 8 : 0,
		floatHeight: loading && !isLiveMode ? 0.5 : 0,
		config: { mass: 1, tension: 170, friction: 26 },
	});

	return (
		<>
			<CameraManager />
			<Environment preset="sunset" environmentIntensity={0.3} />

			{/* Floor Plane */}
			<mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.31}>
				<planeGeometry args={[100, 100]} />
				<meshStandardMaterial color="#333" roughness={0.85} />
			</mesh>

			{/* Studio Key Light */}
			<directionalLight
				position={[5, 5, 5]}
				intensity={2.2}
				castShadow
				shadow-mapSize-width={2048}
				shadow-mapSize-height={2048}
				shadow-bias={-0.0001}
				shadow-radius={4}
			/>

			{/* Fill Light */}
			<directionalLight position={[-5, 5, 5]} intensity={0.7} />

			{/* Back/Rim Accents */}
			<directionalLight position={[3, 3, -5]} intensity={6} color={"#ff3b3b"} />
			<directionalLight position={[-3, 3, -5]} intensity={8} color={"#3cb1ff"} />

			{/* Avatar Container */}
			<Float floatIntensity={loading && !isLiveMode ? 1 : 0} speed={loading && !isLiveMode ? 6 : 0}>
				<animated.group
					scale={scale}
					position-y={floatHeight}
					rotation-y={spin}
				>
					<Avatar />
				</animated.group>
			</Float>

			{/* Configurator Mode Platform & Loader */}
			{!isLiveMode && (
				<>
					<Gltf
						position-y={-0.41}
						src="/models/Teleporter Base.glb"
						castShadow
						receiveShadow
					/>
					<LoadingAvatar loading={loading} />
				</>
			)}
		</>
	);
};