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

  // Meshes to HIDE from the original model (replaced by Tripo head)
  // NOTE: plane007 is handled separately - kept visible for blink morph targets
  const headMeshNames = new Set([
    "hair", "eyebrow", "ear001", "eyes001",
    "face002", "face", "eyebrowl", "eyebrowr"
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

            // Collect morph-target meshes before hiding them
            const morphMeshes: THREE.Mesh[] = [];

            character.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = true;

                const nodeName = (child.name || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                // Plane.007 = eye blink morph mesh
                // Keep invisible (visible=false) to avoid the face mask overlay,
                // but collect it so the rAF blink loop can still set morphTargetInfluences
                if (nodeName === "plane007") {
                  child.visible = false; // hide the mask
                  if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
                    morphMeshes.push(mesh);
                  }
                  return;
                }

                // HIDE all other original head meshes
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
                } else if (nodeName === "neck") {
                  // Keep neck visible with matching skin color for smooth collar transition
                  child.material = skinMaterial;
                }
              }
            });

            // Expose morph meshes for blink rAF loop in animationUtils
            (window as any).__morphMeshes = morphMeshes;
            console.log("Morph meshes found:", morphMeshes.map(m => ({ name: m.name, morphKeys: m.morphTargetDictionary ? Object.keys(m.morphTargetDictionary) : [] })));

            // Load and attach the Tripo head
            try {
              await loadAndAttachHead(character, renderer, camera, scene);
            } catch (headErr) {
              console.warn("Head attach error (falling back):", headErr);
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
   * Load the optimized Tripo head GLB and attach to spine.006.
   */
  const loadAndAttachHead = (
    character: THREE.Object3D,
    _renderer: THREE.WebGLRenderer,
    _camera: THREE.PerspectiveCamera,
    _scene: THREE.Scene
  ): Promise<void> => {
    return new Promise((resolve) => {
      const headLoader = new GLTFLoader();

      headLoader.load(
        "/models/head.glb",
        (headGltf) => {
          try {
            const headScene = headGltf.scene;

            const headBone =
              character.getObjectByName("spine006") ||
              character.getObjectByName("spine.006");

            const headScale = 4.6;

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

            // Face forward (rotate -90deg Y)
            headScene.rotation.y = -Math.PI / 2;

            // Sink neck into shirt collar; no Z offset (causes floating gap)
            headContainer.position.set(0, -0.05, 0);

            // Neck fill cylinder — added directly to headBone (bone-space, no 4.6x scale)
            // bridges the seam between Tripo neck stub and shirt collar
            const neckMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color("#cb8e62"),
              roughness: 0.58,
              metalness: 0.02,
            });
            const neckGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.8, 20);
            const neckFill = new THREE.Mesh(neckGeo, neckMat);
            neckFill.name = "neckFillCylinder";
            neckFill.position.set(0, 0.3, 0);
            neckFill.castShadow = true;
            neckFill.receiveShadow = true;

            if (headBone) {
              headBone.add(headContainer);
              headBone.add(neckFill);
              console.log("Tripo head + neck fill attached to spine.006");
            } else {
              character.add(headContainer);
              headContainer.position.set(0, 12.0, 0);
              console.warn("spine.006 not found; attached to root");
            }

            // Restore basePitch so mouse tracking targets forward-facing pose
            (window as any).__basePitch = -0.26;

            // After introAnimation finishes (~4.5s), reset head bone pitch to look forward
            // introAnimation clampWhenFinished=true can lock the head in a downward pose
            setTimeout(() => {
              if (headBone) {
                headBone.rotation.x = -0.26;
              }
            }, 4500);

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
