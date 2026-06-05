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

	useFrame(() => {
		if (!screenshotRequested) return;

		// 1. Instantly capture the WebGL pixel layer safely inside the active drawing lifecycle frame
		const webglDataUrl = gl.domElement.toDataURL("image/png");

		// 2. Flip the state flag off immediately to avoid an infinite loop loop
		useConfiguratorStore.setState({ screenshotRequested: false });

		// 3. Assemble the offscreen 2D canvas workspace
		const baseSceneImage = new Image();
		baseSceneImage.src = webglDataUrl;

		baseSceneImage.onload = () => {
			const overlayCanvas = document.createElement("canvas");
			overlayCanvas.width = gl.domElement.width;
			overlayCanvas.height = gl.domElement.height;
			const overlayContext = overlayCanvas.getContext("2d");

			if (!overlayContext) return;

			// Draw our processed Three.js background layer
			overlayContext.drawImage(baseSceneImage, 0, 0);

			// Helper function to process the final file download pipeline
			const executeDownload = () => {
				const link = document.createElement("a");
				const date = new Date();
				const dateString = date.toISOString().split("T")[0]; // Fixed split index parameter format
				const timeString = date.toLocaleTimeString().replace(/:/g, "-");

				link.setAttribute("download", `Avatar_${dateString}_${timeString}.png`);
				link.setAttribute("href", overlayCanvas.toDataURL("image/png"));

				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			};

			// 4. Initialize your watermark logo asset using the correct SVG path
			const logo = new Image();

			logo.onerror = () => {
				console.warn("Watermark logo failed to load. Downloading clean avatar snapshot fallback.");
				executeDownload(); // Fallback to download without the logo if file path breaks
			};

			logo.onload = () => {
				// 1. Establish your target baseline height for the canvas layout corner
				const logoHeight = 100;

				// 2. DYNAMICALLY SCALE WIDTH: (Original Width / Original Height) * Target Height
				// This maintains the exact aspect ratio perfectly so it never stretches or flattens
				const logoWidth = (logo.naturalWidth / logo.naturalHeight) * logoHeight;

				// 3. Position the watermarked logo vector safely in the bottom right corner
				const x = overlayCanvas.width - logoWidth - 42;
				const y = overlayCanvas.height - logoHeight - 42;

				overlayContext.drawImage(logo, x, y, logoWidth, logoHeight);
				executeDownload();
			};

			// Target the correct asset filename matching your public folder structure
			logo.crossOrigin = "anonymous";
			logo.src = "/images/ActiveSense_appLogo.svg";
		};
	});

	const {active} = useProgress();
	const [loading, setLoading] = useState(active);
	const setLoadingAt = useRef(0);

	useEffect(() => {
		let timeout;
		if (active) {
			timeout = setTimeout(() => {
				setLoading(true);
				setLoadingAt.current = Date.now();
			}, 50); //show loading only after 50ms
		} else {
			timeout = setTimeout(() => {
				setLoading(false);
			}, Math.max(0, 2000 - (Date.now() - setLoadingAt.current)));
		}
		return () => clearTimeout(timeout);
	}, [active]);

	useEffect(() => {
		setLoading(active);
	}, [active])

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
			<Gltf
				position-y={-0.31}
				src="/models/Teleporter Base.glb"
				castShadow
				receiveShadow
			/>
			<LoadingAvatar loading={loading} />
		</>
	);
};