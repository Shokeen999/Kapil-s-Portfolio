import * as THREE from "three";
import { DRACOLoader, GLTF, GLTFLoader } from "three-stdlib";
import { setCharTimeline, setAllTimeline } from "../../utils/GsapScroll";
import { decryptFile } from "./decrypt";

const setCharacter = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) => {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  loader.setDRACOLoader(dracoLoader);

  // Head-related mesh names from the original model that we want to HIDE
  // (because we're replacing the head with the new Tripo model)
  const headMeshNames = new Set([
    "plane007", "hair", "eyebrow", "ear001", "eyes001", "neck", "face002", "face", "eyebrowl", "eyebrowr"
  ]);


  const loadCharacter = () => {
    return new Promise<GLTF | null>(async (resolve, reject) => {
      try {
        const encryptedBlob = await decryptFile(
          "/models/character.enc",
          "Character3D#@"
        );
        const blobUrl = URL.createObjectURL(new Blob([encryptedBlob]));

        let character: THREE.Object3D;
        loader.load(
          blobUrl,
          async (gltf) => {
            character = gltf.scene;

            // Body material palette (keeping the original body colors)
            const skinColor = new THREE.Color("#cb8e62");
            const suitColor = new THREE.Color("#100f14");
            const pantColor = new THREE.Color("#141418");
            const shoeColor = new THREE.Color("#09090b");

            const skinMaterial = new THREE.MeshStandardMaterial({
              color: skinColor,
              roughness: 0.58,
              metalness: 0.02,
            });

            const suitMaterial = new THREE.MeshStandardMaterial({
              color: suitColor,
              roughness: 0.85,
              metalness: 0.02,
            });

            const pantMaterial = new THREE.MeshStandardMaterial({
              color: pantColor,
              roughness: 0.78,
              metalness: 0.02,
            });

            const shoeMaterial = new THREE.MeshStandardMaterial({
              color: shoeColor,
              roughness: 0.25,
              metalness: 0.15,
            });

            // Traverse the original model: hide head parts, style body parts
            character.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = true;

                const nodeName = (child.name || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                // HIDE all head-related meshes
                if (headMeshNames.has(nodeName)) {
                  child.visible = false;
                  return;
                }

                // Style body meshes
                if (nodeName === "bodyshirt" || child.name === "BODY.SHIRT" || child.name === "BODYSHIRT") {
                  child.material = suitMaterial;
                } else if (nodeName === "hand") {
                  child.material = skinMaterial;
                } else if (nodeName === "pant") {
                  child.material = pantMaterial;
                } else if (nodeName === "shoe" || nodeName === "sole") {
                  child.material = shoeMaterial;
                }
              }
            });

            // Now load the new Tripo head model and attach it to the head bone
            try {
              await loadAndAttachHead(character, renderer, camera, scene);
            } catch (headErr) {
              console.warn("Head attach error (falling back):", headErr);
            }

            // Head bone base pitch for looking straight forward
            (window as any).__basePitch = -0.26;

            // Precompile shaders safely without breaking if it fails
            try {
              await renderer.compileAsync(character, camera, scene);
            } catch (compileErr) {
              console.warn("Shader precompilation skipped:", compileErr);
            }

            resolve(gltf);
            setCharTimeline(character, camera);
            setAllTimeline();
            const footR = character.getObjectByName("footR");
            if (footR) footR.position.y = 3.36;
            const footL = character.getObjectByName("footL");
            if (footL) footL.position.y = 3.36;
            dracoLoader.dispose();
          },
          undefined,
          (error) => {
            console.error("Error loading GLTF model:", error);
            reject(error);
          }
        );
      } catch (err) {
        reject(err);
        console.error(err);
      }
    });
  };

  /**
   * Load the optimized Tripo head GLB (cleanly sliced at neck)
   * and attach directly to the head bone (spine.006).
   */
  const loadAndAttachHead = (
    character: THREE.Object3D,
    _renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    _scene: THREE.Scene
  ): Promise<void> => {
    return new Promise((resolve) => {
      // Sliced head model is standard GLB with WebP textures (no draco or meshopt decoder required)
      const headLoader = new GLTFLoader();

      headLoader.load(
        "/models/head.glb",
        (headGltf) => {
          try {
            const headScene = headGltf.scene;

            // Find head bone (spine.006)
            const headBone =
              character.getObjectByName("spine006") ||
              character.getObjectByName("spine.006");

            // Original head height was ~2.1 units; sliced Tripo head is ~0.50 units
            const headScale = 4.1;

            const headContainer = new THREE.Group();
            headContainer.name = "tripoHeadContainer";

            headScene.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
              }
            });

            headContainer.add(headScene);
            headContainer.scale.setScalar(headScale);

            // Neck base is at Y = 0 in the sliced model.
            // Offset slightly downward (-0.15) so the neck collar plugs neatly into the shirt collar.
            headContainer.position.set(0, -0.15, 0);

            if (headBone) {
              headBone.add(headContainer);
              console.log("Tripo head attached successfully to spine.006 bone");
            } else {
              character.add(headContainer);
              headContainer.position.set(0, 12.0, 0);
              console.warn("Head bone spine.006 not found; attached head to character root");
            }
          } catch (err) {
            console.error("Error positioning head:", err);
          }
          resolve();
        },
        undefined,
        (error) => {
          console.error("Failed to load head model:", error);
          resolve();
        }
      );
    });
  };

  return { loadCharacter };
};

export default setCharacter;
