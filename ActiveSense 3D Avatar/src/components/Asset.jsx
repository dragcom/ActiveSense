import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { useConfiguratorStore } from '../store';

export const Asset = ({ url, categoryName, skeleton }) => {
  const { scene: cachedScene } = useGLTF(url);

  // 1. Clone scene and duplicate materials
  const clonedScene = useMemo(() => {
    const clone = cachedScene.clone();
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }, [cachedScene]);

  // 2. Fetch state from store
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

  // 4. Update clothing colors
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

  // Dynamically change the color of the skin meshes
  useEffect(() => {
    if (!skin) return;

    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Target any material with "Skin_" in its name
        if (child.material.name.includes("Skin_")) {
          // If skin is a hex color string, apply it directly
          if (typeof skin === 'string') {
            child.material.color.set(skin);
          } 
          // If skin is a full Material object instead of a color string
          else if (skin.isMaterial) {
            child.material = skin;
          }
          child.material.needsUpdate = true;
        }
      }
    });
  }, [skin, clonedScene]);

  // 6. Link skeleton bones
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

  if (!skeleton) return null;

  return <primitive object={clonedScene} />;
};
