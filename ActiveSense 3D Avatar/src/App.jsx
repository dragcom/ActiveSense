import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

import { UI } from './components/UI';
import { Experience } from './components/Experience';
import { useConfiguratorStore } from './store';
import { DEFAULT_CAMERA_POSITION } from './components/CameraManager';

function App() {
  const { changeAsset, categories, updateColor, viewOnly } = useConfiguratorStore();
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const configParam = searchParams.get('avatarConfig');

    if (configParam && categories.length > 0) {
      try {
        const savedConfig = JSON.parse(decodeURIComponent(configParam));
        
        Object.keys(savedConfig).forEach((categoryName) => {
          const { assetId, color } = savedConfig[categoryName];
          const category = categories.find((c) => c.name === categoryName);
          const targetAsset = category?.assets?.find((a) => a.id === assetId);
          
          if (targetAsset) {
            changeAsset(categoryName, targetAsset);
          }
          
          if (color) {
            useConfiguratorStore.setState({ currentCategory: category });
            updateColor(color);
          }
        });
      } catch (e) {
        console.error("Failed to load injected avatar recipe", e);
      }
    }
  }, [categories, changeAsset, updateColor]);

  const searchParams = new URLSearchParams(window.location.search);
  const view = searchParams.get('view'); 
  const isPreviewMode = searchParams.get('preview') === 'true';

  const isConfiguratorPage = view === 'configurator';
  const isUIVisible = isConfiguratorPage && !isPreviewMode && !viewOnly;

  return (
    <>
      <div style={{ 
        display: isUIVisible ? 'block' : 'none', 
        position: 'absolute',                   
        top: 0,
        left: 0,
        zIndex: 99,                             
        pointerEvents: isUIVisible ? 'auto' : 'none' 
      }}>
        <UI />
      </div>

      <Canvas
        flat
        gl={{
          alpha: true, 
          antialias: true,
          outputColorSpace: THREE.SRGBColorSpace, 
          toneMappingExposure: 1.2,
          preserveDrawingBuffer: true, 
        }} 
        camera={{
          position: DEFAULT_CAMERA_POSITION,
          fov: 50,  
        }}
        onCreated={({ camera }) => camera.lookAt(0, -1, 0)}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        {!isPreviewMode && <color attach="background" args={['#14121c']} />}
        {!isPreviewMode && <fog attach="fog" args={['#14121c', 10, 40]} />}
        
        <group position-y={-0.6}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </group>

        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={1.2} intensity={1.2}/>
        </EffectComposer>
      </Canvas>
    </>
  );
}

export default App;