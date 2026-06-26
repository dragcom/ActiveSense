import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { useConfiguratorStore } from '../store';

export const Asset = ({ url, categoryName, skeleton }) => {
  const { scene: cachedScene } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = cachedScene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
        if (skeleton) child.skeleton = skeleton;
      }
    });
    return clone;
  }, [cachedScene, skeleton]); 

  const customization = useConfiguratorStore((state) => state.customization);
  const skin = useConfiguratorStore((state) => state.skin); 

  const assetColour = 
    customization[categoryName]?.color || 
    customization[categoryName]?.colour || 
    customization[categoryName]?.asset?.color || 
    customization[categoryName]?.asset?.colour;

  const attachedItems = useMemo(() => {
    const items = [];
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        items.push({
          geometry: child.geometry,
          material: child.material.name.includes("Skin_") 
            ? skin 
            : child.material,
        });
      }
    });
    return items;
  }, [clonedScene, skin]);

  useEffect(() => {
    if (!assetColour) return;

    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.name.includes("Color_")) {
          child.material.color.set(assetColour);
          child.material.needsUpdate = true;
        }
      }
    });
  }, [assetColour, clonedScene]);

  useEffect(() => {
    if (!skin) return;

    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.name.includes("Skin_")) {
          if (typeof skin === 'string') {
            child.material.color.set(skin);
          } 
          else if (skin.isMaterial) {
            child.material = skin;
          }
          child.material.needsUpdate = true;
        }
      }
    });
  }, [skin, clonedScene]);

  useEffect(() => {
    if (!skeleton) return;

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.skeleton = skeleton;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [clonedScene, skeleton]);

  return (
    <group visible={!!skeleton}>
      <primitive object={clonedScene} />
    </group>
  );
};
