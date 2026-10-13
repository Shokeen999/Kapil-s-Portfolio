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
                  // Hide original neck so only Tripo neck enters shirt collar cleanly
                  child.visible = false;
                }
              }
            });

            // Expose morph meshes for blink rAF loop in animationUtils
            (window as any).__morphMeshes = morphMeshes;

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

            // Scale 4.1 makes the neck width (1.5) match the shirt collar opening (1.6) perfectly
            const headScale = 4.1;

            const headContainer = new THREE.Group();
            headContainer.name = "tripoHeadContainer";

            headScene.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;

                // TRIM SHOULDERS & TORSO:
                // Tripo model includes wide shoulders (Z: ±0.47) and torso below Y = -0.085.
                // Discard triangles below Y = -0.085 so all protruding shoulder flaps are eliminated,
                // leaving a clean cylindrical neck that slides seamlessly into the shirt collar.
                const geom = mesh.geometry as THREE.BufferGeometry;
                const posAttr = geom.attributes.position;
                const oldIndex = geom.index;
                if (oldIndex && posAttr) {
                  const newIndices: number[] = [];
                  const cutY = -0.085;
                  for (let i = 0; i < oldIndex.count; i += 3) {
                    const a = oldIndex.getX(i);
                    const b = oldIndex.getX(i + 1);
                    const c = oldIndex.getX(i + 2);
                    const ya = posAttr.getY(a);
                    const yb = posAttr.getY(b);
                    const yc = posAttr.getY(c);
                    if (ya >= cutY || yb >= cutY || yc >= cutY) {
                      newIndices.push(a, b, c);
                    }
                  }
                  geom.setIndex(newIndices);
                  geom.computeVertexNormals();
                }
              }
            });

            headContainer.add(headScene);
            headContainer.scale.setScalar(headScale);

            // Face forward (rotate -90deg Y)
            headScene.rotation.y = -Math.PI / 2;

            // Tilt head UP by ~20deg (-0.35 rad) to counteract the spine's ~28deg forward slouch
            // This centers the head so the character looks directly forward at the camera/user
            headContainer.rotation.x = -0.35;

            // Seat neck deep into shirt collar opening (Y=-0.12, Z=-0.04)
            headContainer.position.set(0, -0.12, -0.04);

            // Working synthetic eyelid planes attached directly to headScene
            const eyelidMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color("#c48a5e"),
              side: THREE.DoubleSide,
              depthTest: true,
              depthWrite: false,
            });
            const eyeGeo = new THREE.PlaneGeometry(0.09, 0.08);
            // Pivot at top edge of eyelid so scale.y closes downward over the eye
            eyeGeo.translate(0, -0.04, 0);

            const leftEyelid = new THREE.Mesh(eyeGeo, eyelidMat);
            leftEyelid.name = "syntheticEyelidL";
            leftEyelid.position.set(0.208, 0.205, 0.082);
            leftEyelid.rotation.y = Math.PI / 2;
            leftEyelid.scale.set(1, 0, 1);
            leftEyelid.renderOrder = 10;
            headScene.add(leftEyelid);

            const rightEyelid = new THREE.Mesh(eyeGeo.clone(), eyelidMat);
            rightEyelid.name = "syntheticEyelidR";
            rightEyelid.position.set(0.208, 0.205, -0.082);
            rightEyelid.rotation.y = Math.PI / 2;
            rightEyelid.scale.set(1, 0, 1);
            rightEyelid.renderOrder = 10;
            headScene.add(rightEyelid);

            // Animated blink loop
            let blinkPhase: "idle" | "closing" | "opening" = "idle";
            let blinkPhaseStart = performance.now();
            let blinkIdleDuration = 2500 + Math.random() * 2500;
            const BLINK_CLOSE_MS = 75;
            const BLINK_OPEN_MS = 95;

            const runBlink = () => {
              const now = performance.now();
              const el = now - blinkPhaseStart;
              if (blinkPhase === "idle") {
                leftEyelid.scale.y = 0;
                rightEyelid.scale.y = 0;
                if (el >= blinkIdleDuration) {
                  blinkPhase = "closing";
                  blinkPhaseStart = now;
                }
              } else if (blinkPhase === "closing") {
                const t = Math.min(el / BLINK_CLOSE_MS, 1);
                leftEyelid.scale.y = t;
                rightEyelid.scale.y = t;
                if (t >= 1) {
                  blinkPhase = "opening";
                  blinkPhaseStart = now;
                }
              } else {
                const t = Math.min(el / BLINK_OPEN_MS, 1);
                leftEyelid.scale.y = 1 - t;
                rightEyelid.scale.y = 1 - t;
                if (t >= 1) {
                  blinkPhase = "idle";
                  blinkPhaseStart = now;
                  blinkIdleDuration = 2500 + Math.random() * 2500;
                }
              }
              requestAnimationFrame(runBlink);
            };
            runBlink();

            if (headBone) {
              headBone.add(headContainer);
              console.log("Tripo head attached cleanly to spine.006");
            } else {
              character.add(headContainer);
              headContainer.position.set(0, 12.0, 0);
              console.warn("spine.006 not found; attached to root");
            }

            // Base pitch set to 0 since headContainer.rotation.x = -0.35 already levels the gaze
            (window as any).__basePitch = 0.0;

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
