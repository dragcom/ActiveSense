import { Environment, OrbitControls, Backdrop, Gltf, Float, useProgress} from '@react-three/drei'
import { Avatar } from './Avatar';
import { CameraManager } from './CameraManager';
import { useEffect, useState, useRef} from 'react';
import { useThree } from '@react-three/fiber';
import { useConfiguratorStore } from '../store';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated} from '@react-spring/three';
import { LoadingAvatar } from './LoadingAvatar';

export const Experience = () => {
	const { gl } = useThree();
	const screenshotRequested = useConfiguratorStore((state) => state.screenshotRequested);
	const isLiveMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'live';
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

	const {active} = useProgress();
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
			timeout = setTimeout(() => {
				setLoading(false);
			}, Math.max(0, 2000 - (Date.now() - setLoadingAt.current)));
		}
		return () => clearTimeout(timeout);
	}, [active, isLiveMode]);

	useEffect(() => {
		if (isLiveMode) return;
		setLoading(active);
	}, [active, isLiveMode])

	const {scale, spin, floatHeight} = useSpring({
		scale: loading ? 0.5 : 1,
		spin: loading ? Math.PI * 8 : 0,
		floatHeight: loading ? 0.5 : 0,
	});

	return (
		<>
			<CameraManager />
			<Environment preset="sunset" environmentIntensity={0.3} />
			<mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.31}>
				<planeGeometry args={[100, 100]} />
				<meshStandardMaterial color="#333" roughness={0.85} />
			</mesh>

			{/* Key Light */}
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
			{/* Back Light */}
			<directionalLight position={[3, 3, -5]} intensity={6} color={"#ff3b3b"} />
			<directionalLight
				position={[-3, 3, -5]}
				intensity={8}
				color={"#3cb1ff"}
			/>
			
			<Float floatIntensity={loading ? 1 : 0} speed={loading ? 6: 0}>
				<animated.group
					scale={scale}
					position-y={floatHeight}
					rotation-y={spin}
				>
					<Avatar />
				</animated.group>
			</Float>
			{!isLiveMode && (
				<Gltf
					position-y={-0.41}
					src="/models/Teleporter Base.glb"
					castShadow
					receiveShadow
				/>
			)}
			{!isLiveMode && <LoadingAvatar loading={loading} />}
		</>
	);
};