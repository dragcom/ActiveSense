import { Suspense, useRef, useEffect} from "react";
import { useGLTF, useAnimations, useFBX} from "@react-three/drei";
import { pb, useConfiguratorStore } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

export const Avatar = ({ ...props}) => {
  const group = useRef();
  const { nodes, materials} = useGLTF("/models/Armature.glb");
  const { animations} = useFBX("/models/Idle.fbx");
  const customization = useConfiguratorStore((state) => state.customization);
  const { actions } = useAnimations(animations, group);
  const setDownload = useConfiguratorStore((state) => state.setDownload);

  if (!nodes || !nodes.Plane || !nodes.mixamorigHips) {
    return null;
  }

  useEffect(() => {
    function download() {
      const exporter = new GLTFExporter();
      exporter.parse(
        group.current,
        function (result) {
          // Save the blob result to a file
          save (
            new Blob([result], { type: "application/octet-stream" }),
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
    actions["mixamo.com"]?.play();
  }, [actions]);

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          {/* Main Body Mesh */}
          <skinnedMesh
            name="Plane"
            geometry={nodes.Plane.geometry}
            material={nodes.Plane.material}
            skeleton={nodes.Plane.skeleton}
            castShadow
            receiveShadow
          />
          <primitive object={nodes.mixamorigHips} />
          {Object.keys(customization).map(
            (key) =>
              customization[key]?.asset?.url && (
                <Suspense key={customization[key].asset.id} fallback={null}>
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