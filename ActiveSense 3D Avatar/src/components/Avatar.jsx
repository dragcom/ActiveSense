import { Suspense, useRef, useEffect} from "react";
import { useGLTF, useAnimations, useFBX} from "@react-three/drei";
import { pb, useConfiguratorStore } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { prune, dedup, draco, quantize } from "@gltf-transform/functions";
import { NodeIO } from "@gltf-transform/core";

export const Avatar = ({ ...props}) => {
  const group = useRef();
  const { nodes, materials} = useGLTF("/models/Armature.glb");
  const { animations } = useGLTF("/models/Poses.glb");
  const customization = useConfiguratorStore((state) => state.customization);
  const { actions } = useAnimations(animations, group);
  const setDownload = useConfiguratorStore((state) => state.setDownload);
  const skin = useConfiguratorStore((state) => state.skin);

  const pose = useConfiguratorStore((state) => state.pose);

  if (!nodes || !nodes.Plane || !nodes.mixamorigHips) {
    return null;
  }

  useEffect(() => {
    function download() {
      const exporter = new GLTFExporter();
      exporter.parse(
        group.current,
        async function (result) {
          // Save the blob result to a file
          const io = new NodeIO();
          //Read in. Uint8Array -> Document
          const document = await io.readBinary(new Uint8Array(result)); 
          await document.transform(
            //Remove unused nodes, textures, and other data.
            prune(),
            //Remove duplicate vertex or texture data, if any.
            dedup(),
            //Compress mesh geometry with Draco.
            draco(),
            //Quantize mesh geometry
            quantize()
          );

          //Write
          const glb = await io.writeBinary(document); // Document -> Uint8Array

          save (
            new Blob([glb], { type: "application/octet-stream" }),
            `avatar_${+ new Date()}.glb`
          );
        },
        function (error) {
          console.error(error);
        },
        { binary: true }
      );
    }

    //Javascript's way of downloading files on the fly
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link); //Firefox workaround, see #6594

    function save(blob, filename) {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    }
    setDownload(download);
  }, []);
  
  useEffect(() => {
    actions[pose]?.reset().fadeIn(0.2).play();
    return () => actions[pose]?.fadeOut(0.2);
  }, [actions, pose]);

  console.log("Avatar current customization object:", customization);
  Object.keys(customization).forEach(key => {
      if(customization[key]?.asset?.url) {
          console.log(`Rendering asset for ${key}:`, customization[key].asset.url);
      }
  });

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh
            name="Plane"
            geometry={nodes.Plane.geometry}
            material={skin}
            skeleton={nodes.Plane.skeleton}
            castShadow
            receiveShadow
          />
          <primitive object={nodes.mixamorigHips} />
          {Object.keys(customization).map(
            (key) => 
              customization[key]?.asset?.url && (
                <Suspense key={customization[key].asset?.id || key} fallback={null}>
                  <Asset
                    categoryName={key}
                    url={pb.files.getURL(
                      customization[key].asset,
                      customization[key].asset.url
                    )}
                    skeleton={nodes.Plane?.skeleton}
                  />
                </Suspense>
              )
          )}
        </group>
      </group>
    </group>
  );
};
useGLTF.preload('/models/Armature.glb');
