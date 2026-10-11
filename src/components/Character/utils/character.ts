import * as THREE from "three";
import { DRACOLoader, GLTF, GLTFLoader, MeshoptDecoder } from "three-stdlib";
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
    "plane007", "hair", "eyebrow", "ear001", "eyes001", "neck",
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
            await loadAndAttachHead(character, renderer, camera, scene);

            // Head bone base pitch for looking straight forward
            (window as any).__basePitch = -0.50;

            // Compile shaders
            await renderer.compileAsync(character, camera, scene);

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
   * Load the Tripo head GLB, clip below the neck, and attach to the head bone
   * of the original skeleton.
   */
  const loadAndAttachHead = (
    character: THREE.Object3D,
    renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    _scene: THREE.Scene
  ): Promise<void> => {
    return new Promise((resolve) => {
      // Create a separate loader with meshopt support for the head model
      const headLoader = new GLTFLoader();
      headLoader.setMeshoptDecoder(MeshoptDecoder);

      headLoader.load(
        "/models/head.glb",
        (headGltf) => {
          const headScene = headGltf.scene;

          // Find the head bone in the original skeleton
          const headBone = character.getObjectByName("spine006") ||
                           character.getObjectByName("spine.006");

          if (!headBone) {
            console.warn("Head bone (spine006) not found, attaching head to character root");
          }

          // The Tripo model bounding box from accessor min/max:
          // Y: [-0.4895, 0.4895] (total height ~0.979 units, centered at origin)
          // The character's head region is around y=12.5 to y=14.0 (about 1.5 units tall)
          // The head in the Tripo model is roughly the top 25% (Y > 0.24)

          // Enable clipping on the renderer
          renderer.localClippingEnabled = true;

          // Clipping plane to cut off below the neck
          // The Tripo model is centered at origin, neck is approximately at Y = 0.22
          // We clip everything below this Y in the model's local space
          const neckClipY = 0.22;
          const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -neckClipY);

          // Scale: Tripo head region (Y 0.22 to 0.49) = 0.27 units
          // Original head region is about 1.2 units tall
          // Scale factor to match:
          const tripoHeadHeight = 0.49 - neckClipY;
          const originalHeadHeight = 1.3;
          const headScale = originalHeadHeight / tripoHeadHeight;

          // Create a container group for the head
          const headContainer = new THREE.Group();
          headContainer.name = "tripoHeadContainer";

          headScene.traverse((child: any) => {
            if (child.isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              // Apply clipping plane to material
              if (mesh.material) {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                // Clone material so we don't affect the source
                const clonedMat = mat.clone();
                clonedMat.clippingPlanes = [clipPlane];
                clonedMat.clipShadows = true;
                clonedMat.side = THREE.DoubleSide;
                mesh.material = clonedMat;
              }
            }
          });

          // Scale the head to match original character proportions
          headContainer.add(headScene);
          headContainer.scale.setScalar(headScale);

          // Position offset: The head bone (spine006) is at approximately the base of the skull
          // The Tripo neck clip is at Y=0.22 in model space
          // After scaling, the neck position becomes neckClipY * headScale in container space
          // We need the neck of the Tripo model to align with the head bone's position
          headContainer.position.set(0, -neckClipY * headScale, 0);

          // Attach to head bone or character root
          if (headBone) {
            headBone.add(headContainer);
          } else {
            character.add(headContainer);
            // If no bone, position manually
            headContainer.position.y = 13.0;
          }

          console.log("Tripo head attached to character skeleton");
          resolve();
        },
        undefined,
        (error) => {
          console.error("Failed to load Tripo head model:", error);
          // Don't reject - the character can still work without the custom head
          resolve();
        }
      );
    });
  };

  return { loadCharacter };
};

export default setCharacter;
