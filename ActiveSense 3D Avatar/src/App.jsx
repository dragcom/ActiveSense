import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI';
import { Experience } from './components/Experience';
import { Suspense } from 'react';
import * as THREE from 'three';
import { useConfiguratorStore } from './store';
import { DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET } from './components/CameraManager';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

function App() {
  return (
    <>
    <UI />
      <Canvas
        flat
        gl={{ 
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace, 
          toneMappingExposure: 1.2,
          preserveDrawingBuffer: true, // Enable this to allow screenshots 
        }} 
        camera = {{
          position: DEFAULT_CAMERA_POSITION,
          fov: 45,  
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        <color attach="background" args={['#14121c']} />
        <fog attach="fog" args={['#14121c', 10, 40]} />
        <group position-y={-1}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1.2} intensity={1.2}/>
        </EffectComposer>
      </Canvas>
    </>
  )
}

export default App;
