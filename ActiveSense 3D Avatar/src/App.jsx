import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI';
import { Experience } from './components/Experience';
import { Suspense } from 'react';
import * as THREE from 'three';

function App() {
  return (
    <>
    <UI />
      <Canvas
        flat
        gl={{ 
          antialias: true, 
          outputColorSpace: 'srgb'
        }} 
        camera = {{
          position: [-1, 1, 5],
          fov: 45,  
        }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        <color attach="background" args={['#555']} />
        <fog attach="fog" args={['#555', 15, 25]} />
        <group position-y={-1}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>
      </Canvas>
    </>
  )
}

export default App;
