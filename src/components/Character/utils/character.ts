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

  // Generate procedural hair-strand normal map for pompadour texture
  const createHairNormalMap = (): THREE.CanvasTexture => {
    const cvs = document.createElement("canvas");
    cvs.width = 512;
    cvs.height = 512;
    const ctx = cvs.getContext("2d");
    if (ctx) {
      const imgData = ctx.createImageData(512, 512);
      const d = imgData.data;
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const idx = (y * 512 + x) * 4;
          // Directional hair strands with fine high-frequency ridge noise
          const strand = Math.sin(x * 0.35 + Math.sin(y * 0.08) * 4) * 0.5 + 0.5;
          const micro = Math.sin(x * 1.8) * 0.2;
          const val = Math.max(0, Math.min(1, strand + micro));

          // Tangent-space normal map encoding
          const nx = (val - 0.5) * 1.4;
          const ny = 0.0;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

          d[idx] = Math.round((nx * 0.5 + 0.5) * 255);
          d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          d[idx + 2] = Math.round(nz * 255);
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  };

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

            // Kapil Chauhan's signature palette matching reference 3D Pixar avatar
            const skinColor = new THREE.Color("#cb8e62"); // Warm golden Indian caramel skin tone
            const darkHair = new THREE.Color("#0c0b0f"); // Deep black/charcoal styled hair
            const darkEyebrows = new THREE.Color("#08070a"); // Bold, dark, defined eyebrows
            const suitColor = new THREE.Color("#100f14"); // Dark crew-neck t-shirt
            const pantColor = new THREE.Color("#141418"); // Matching dark trousers
            const shoeColor = new THREE.Color("#09090b"); // Dark shoes

            const skinMaterial = new THREE.MeshStandardMaterial({
              color: skinColor,
              roughness: 0.58,
              metalness: 0.02,
            });

            const hairNormalMap = createHairNormalMap();
            const hairMaterial = new THREE.MeshStandardMaterial({
              color: darkHair,
              roughness: 0.72,
              metalness: 0.02,
              normalMap: hairNormalMap,
              normalScale: new THREE.Vector2(0.8, 0.8),
            });

            const eyebrowMaterial = new THREE.MeshStandardMaterial({
              color: darkEyebrows,
              roughness: 0.88,
              metalness: 0.0,
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

            character.traverse((child: any) => {
              if (child.isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.frustumCulled = true;

                const nodeName = (child.name || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

                // 1. Head & Face Mesh: Node 77 (Plane.007 -> plane007)
                if (nodeName === "plane007" || child.name === "Plane.007" || child.name === "Plane007") {
                  child.material = skinMaterial;

                  const geom = child.geometry as THREE.BufferGeometry;
                  const posAttr = geom.getAttribute("position");
                  const normAttr = geom.getAttribute("normal");
                  const skinIdxAttr = geom.getAttribute("skinIndex");
                  const skinWtAttr = geom.getAttribute("skinWeight");
                  const indexAttr = geom.index;

                  // 1. EYES: Symmetrically lift BOTH upper eyelids using Morph Targets 0 (Right) & 2 (Left)
                  // Eliminates the sleepy/droopy cartoon eyes so Kapil has alert, confident Pixar eyes
                  if (!child.userData.eyesOpened && posAttr) {
                    child.userData.eyesOpened = true;
                    const morphPos0 = (geom.morphAttributes && geom.morphAttributes.position) ? geom.morphAttributes.position[0] : null;
                    const morphPos2 = (geom.morphAttributes && geom.morphAttributes.position) ? geom.morphAttributes.position[2] : null;

                    for (let i = 0; i < posAttr.count; i++) {
                      // Right eye (x < 0) via morphTarget 0
                      if (morphPos0) {
                        const dy0 = morphPos0.getY(i);
                        if (dy0 < -0.035) {
                          posAttr.setY(i, posAttr.getY(i) - dy0 * 0.46);
                          posAttr.setZ(i, posAttr.getZ(i) - morphPos0.getZ(i) * 0.46);
                        }
                      }
                      // Left eye (x > 0) via morphTarget 2
                      if (morphPos2) {
                        const dy2 = morphPos2.getY(i);
                        if (dy2 < -0.035) {
                          posAttr.setY(i, posAttr.getY(i) - dy2 * 0.46);
                          posAttr.setZ(i, posAttr.getZ(i) - morphPos2.getZ(i) * 0.46);
                        }
                      }

                      // 2. NOSE: Reshape bulbous cartoon potato tip into refined human nose proportions
                      const px = posAttr.getX(i);
                      const py = posAttr.getY(i);
                      const pz = posAttr.getZ(i);
                      const ax = Math.abs(px);

                      if (py >= 12.80 && py <= 13.15 && ax <= 0.22 && pz >= 0.92) {
                        const bulbFactor =
                          Math.sin(((py - 12.80) / 0.35) * Math.PI) *
                          Math.cos((ax / 0.22) * (Math.PI / 2));
                        // Debulk forward protrusion and slim tip width
                        posAttr.setZ(i, pz - bulbFactor * 0.078);
                        posAttr.setX(i, px * 0.88);
                      }
                    }
                    posAttr.needsUpdate = true;
                    geom.computeVertexNormals();
                  }

                  // 3. BEARD & MUSTACHE: Full continuous 3D volumetric groomed boxed beard
                  // 3. BEARD & MUSTACHE: Full continuous 3D volumetric groomed boxed beard
                  if (posAttr && normAttr && indexAttr && skinIdxAttr && skinWtAttr && !child.userData.beardAdded) {
                    child.userData.beardAdded = true;

                    // Continuous horizontal upper-edge definition for mustache & cheeks
                    function getBeardTopY(ax: number) {
                      if (ax <= 0.38) {
                        // Full horizontal mustache bar across philtrum and upper lip
                        return 12.82 - Math.pow(ax / 0.38, 2) * 0.05;
                      } else {
                        // Smooth continuous sweep up along cheek to sideburns
                        return 12.77 + Math.pow((ax - 0.38) / 0.58, 1.2) * 0.31;
                      }
                    }

                    function isBeardVertex(x: number, y: number, z: number) {
                      const ax = Math.abs(x);
                      
                      // Soul patch directly under lower lip
                      if (ax <= 0.09 && y >= 12.36 && y <= 12.45 && z >= 0.70) return true;

                      // Lips exclusion (leaving clean peach lips visible)
                      if (y >= 12.45 && y <= 12.56 && ax <= 0.16 && z >= 0.88) return false;

                      const topY = getBeardTopY(ax);
                      if (y > topY) return false;

                      // Full lower face: chin, jaw, cheeks, sideburns, mustache
                      if (y >= 11.90 && ax <= 0.98 && z >= -0.35) {
                        return true;
                      }

                      return false;
                    }

                    const beardIndices: number[] = [];
                    const oldToNew = new Map<number, number>();
                    const newPositions: number[] = [];
                    const origZArray: number[] = [];
                    const newNormals: number[] = [];
                    const newSkinIdx: number[] = [];
                    const newSkinWt: number[] = [];

                    for (let i = 0; i < indexAttr.count; i += 3) {
                      const a = indexAttr.getX(i);
                      const b = indexAttr.getX(i + 1);
                      const c = indexAttr.getX(i + 2);

                      const aIn = isBeardVertex(posAttr.getX(a), posAttr.getY(a), posAttr.getZ(a));
                      const bIn = isBeardVertex(posAttr.getX(b), posAttr.getY(b), posAttr.getZ(b));
                      const cIn = isBeardVertex(posAttr.getX(c), posAttr.getY(c), posAttr.getZ(c));

                      // Strictly require ALL 3 vertices to prevent saw-tooth boundary triangles
                      if (aIn && bIn && cIn) {
                        for (const idx of [a, b, c]) {
                          if (!oldToNew.has(idx)) {
                            const newIdx = oldToNew.size;
                            oldToNew.set(idx, newIdx);

                            const px = posAttr.getX(idx);
                            const py = posAttr.getY(idx);
                            const pz = posAttr.getZ(idx);
                            const ax = Math.abs(px);

                            const nx = normAttr.getX(idx);
                            const ny = normAttr.getY(idx);
                            const nz = normAttr.getZ(idx);

                            const topY = getBeardTopY(ax);
                            const distFromTop = Math.max(0, topY - py);
                            const edgeTaper = Math.min(1.0, distFromTop / 0.07);
                            const extrusion = 0.020 + edgeTaper * 0.030;

                            origZArray.push(pz);
                            newPositions.push(px + nx * extrusion, py + ny * extrusion, pz + nz * extrusion);
                            newNormals.push(nx, ny, nz);

                            newSkinIdx.push(
                              skinIdxAttr.getX(idx),
                              skinIdxAttr.getY(idx),
                              skinIdxAttr.getZ(idx),
                              skinIdxAttr.getW(idx)
                            );
                            newSkinWt.push(
                              skinWtAttr.getX(idx),
                              skinWtAttr.getY(idx),
                              skinWtAttr.getZ(idx),
                              skinWtAttr.getW(idx)
                            );
                          }
                          beardIndices.push(oldToNew.get(idx)!);
                        }
                      }
                    }

                    // 4 iterations of Laplacian relaxation for silk-smooth beard surface
                    const numVerts = newPositions.length / 3;
                    const neighbors: number[][] = Array.from({ length: numVerts }, () => []);
                    for (let i = 0; i < beardIndices.length; i += 3) {
                      const a = beardIndices[i], b = beardIndices[i + 1], c = beardIndices[i + 2];
                      neighbors[a].push(b, c);
                      neighbors[b].push(a, c);
                      neighbors[c].push(a, b);
                    }

                    for (let iter = 0; iter < 4; iter++) {
                      const smoothed = newPositions.slice();
                      for (let v = 0; v < numVerts; v++) {
                        const nbrs = neighbors[v];
                        if (nbrs.length > 0) {
                          let avgX = 0, avgY = 0, avgZ = 0;
                          for (const nb of nbrs) {
                            avgX += newPositions[nb * 3];
                            avgY += newPositions[nb * 3 + 1];
                            avgZ += newPositions[nb * 3 + 2];
                          }
                          avgX /= nbrs.length;
                          avgY /= nbrs.length;
                          avgZ /= nbrs.length;

                          smoothed[v * 3] = newPositions[v * 3] * 0.60 + avgX * 0.40;
                          smoothed[v * 3 + 1] = newPositions[v * 3 + 1] * 0.60 + avgY * 0.40;
                          smoothed[v * 3 + 2] = newPositions[v * 3 + 2] * 0.60 + avgZ * 0.40;
                        }
                      }
                      for (let k = 0; k < newPositions.length; k++) {
                        newPositions[k] = smoothed[k];
                      }
                    }

                    // Guarantee 3D volume: prevent beard vertices from sinking beneath face skin
                    for (let v = 0; v < numVerts; v++) {
                      const origZ = origZArray[v];
                      if (newPositions[v * 3 + 2] < origZ + 0.012) {
                        newPositions[v * 3 + 2] = origZ + 0.012;
                      }
                    }

                    if (newPositions.length > 0) {
                      const beardGeom = new THREE.BufferGeometry();
                      beardGeom.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
                      beardGeom.setAttribute("normal", new THREE.Float32BufferAttribute(newNormals, 3));
                      beardGeom.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(newSkinIdx, 4));
                      beardGeom.setAttribute("skinWeight", new THREE.Float32BufferAttribute(newSkinWt, 4));
                      beardGeom.setIndex(beardIndices);
                      beardGeom.computeVertexNormals();

                      const beardMesh = new THREE.SkinnedMesh(beardGeom, hairMaterial);
                      beardMesh.name = "kapilBeard3D";
                      beardMesh.bind(child.skeleton, child.bindMatrix);
                      beardMesh.castShadow = true;
                      beardMesh.receiveShadow = true;
                      child.parent.add(beardMesh);
                    }
                  }
                }
                // 2. Suit Blazer & Shirt: Node 69 (BODY.SHIRT -> bodyshirt)
                else if (nodeName === "bodyshirt" || child.name === "BODY.SHIRT" || child.name === "BODYSHIRT") {
                  child.material = suitMaterial;
                }
                // 3. Hair: Node 2 (hair) -> Expand pompadour volume
                else if (nodeName === "hair") {
                  child.material = hairMaterial;
                  if (!child.userData.pompadourExpanded) {
                    child.userData.pompadourExpanded = true;
                    const geom = child.geometry as THREE.BufferGeometry;
                    const pos = geom.getAttribute("position");
                    if (pos) {
                      for (let i = 0; i < pos.count; i++) {
                        const hy = pos.getY(i);
                        const hz = pos.getZ(i);
                        // Elevate top/front vertices to form pompadour quiff height
                        if (hy > 0) {
                          pos.setY(i, hy * 1.08 + 0.03);
                          if (hz > -0.02) {
                            pos.setZ(i, hz * 1.05 + 0.02);
                          }
                        }
                      }
                      pos.needsUpdate = true;
                      geom.computeVertexNormals();
                    }
                  }
                }
                // 4. Eyebrows: Node 71 (Eyebrow)
                else if (nodeName === "eyebrow") {
                  child.material = eyebrowMaterial;
                }
                // 5. Ears: Node 70 (Ear.001 -> ear001) -> Perfectly symmetrical size, position, and visibility
                else if (nodeName === "ear001" || child.name === "Ear.001" || child.name === "Ear001") {
                  child.material = skinMaterial;

                  // FIX SKELETON RIGGING BUG:
                  // The original model had left ear weighted to spine (pelvis) and right ear to spine.006 (head).
                  // Bind BOTH ears 100% to head bone (spine006) so they move in perfect synchrony and symmetry!
                  if (child.skeleton && child.skeleton.bones) {
                    let headJointIdx = 5;
                    const foundIdx = child.skeleton.bones.findIndex(
                      (b: any) => b.name === "spine006" || b.name === "spine.006" || (b.name && b.name.toLowerCase().includes("spine006"))
                    );
                    if (foundIdx !== -1) headJointIdx = foundIdx;

                    const geom = child.geometry as THREE.BufferGeometry;
                    const earSkinIdx = geom.getAttribute("skinIndex");
                    const earSkinWt = geom.getAttribute("skinWeight");
                    if (earSkinIdx && earSkinWt) {
                      for (let i = 0; i < earSkinIdx.count; i++) {
                        earSkinIdx.setXYZW(i, headJointIdx, 0, 0, 0);
                        earSkinWt.setXYZW(i, 1.0, 0.0, 0.0, 0.0);
                      }
                      earSkinIdx.needsUpdate = true;
                      earSkinWt.needsUpdate = true;
                    }
                  }

                  if (!child.userData.scaledInPlace) {
                    child.userData.scaledInPlace = true;
                    const geom = child.geometry as THREE.BufferGeometry;
                    const pos = geom.getAttribute("position");
                    if (pos) {
                      const earScale = 0.78;
                      for (let i = 0; i < pos.count; i++) {
                        let px = pos.getX(i);
                        let py = pos.getY(i);
                        let pz = pos.getZ(i);

                        if (px < 0) {
                          // Right Ear (symmetric position flush against head side at x = -1.04, y = 13.15)
                          px = -1.04 + (px - (-1.135)) * earScale;
                          py = 13.15 + (py - 13.167) * earScale;
                          pz = 0.08 + (pz - 0.118) * earScale;
                        } else {
                          // Left Ear (symmetric position flush against head side at x = +1.04, y = 13.15)
                          px = 1.04 + (px - 1.116) * earScale;
                          py = 13.15 + (py - 13.167) * earScale;
                          pz = 0.08 + (pz - 0.118) * earScale;
                        }
                        pos.setXYZ(i, px, py, pz);
                      }
                      pos.needsUpdate = true;
                      geom.computeVertexNormals();
                    }
                  }
                }
                // 6. Neck and Hands
                else if (nodeName === "neck" || nodeName === "hand") {
                  child.material = skinMaterial;
                }
                // 7. Dark Trousers
                else if (nodeName === "pant") {
                  child.material = pantMaterial;
                }
                // 8. Polished Formal Shoes
                else if (nodeName === "shoe" || nodeName === "sole") {
                  child.material = shoeMaterial;
                }
                // 9. Eyes: Node 72 (EYEs.001 -> eyes001) -> Warm chocolate brown eyes with bright specular catchlights
                else if (nodeName === "eyes001" || child.name === "EYEs.001" || child.name === "EYEs001") {
                  if (child.material && child.material.map) {
                    try {
                      const img = child.material.map.image;
                      if (img) {
                        const cvs = document.createElement("canvas");
                        cvs.width = img.width || 512;
                        cvs.height = img.height || 512;
                        const ctx = cvs.getContext("2d");
                        if (ctx) {
                          ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
                          const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
                          const d = imgData.data;

                          // Find bounding box of iris pixels
                          let minX = cvs.width, maxX = 0, minY = cvs.height, maxY = 0;
                          for (let y = 0; y < cvs.height; y++) {
                            for (let x = 0; x < cvs.width; x++) {
                              const p = (y * cvs.width + x) * 4;
                              const g = d[p + 1], b = d[p + 2];
                              if (b > g + 15 && b > 40) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                              }
                            }
                          }
                          const cx = (minX + maxX) / 2;
                          const cy = (minY + maxY) / 2;
                          const radius = Math.max(1, (maxX - minX) / 2);

                          for (let y = 0; y < cvs.height; y++) {
                            for (let x = 0; x < cvs.width; x++) {
                              const p = (y * cvs.width + x) * 4;
                              const r = d[p], g = d[p + 1], b = d[p + 2];
                              if (b > g + 15 && b > 40) {
                                const distFromCenter = Math.hypot(x - cx, y - cy) / radius;
                                const lum = (r + g + b) / 765;
                                if (distFromCenter < 0.30) {
                                  // Dark pupil
                                  d[p] = 14;
                                  d[p + 1] = 12;
                                  d[p + 2] = 16;
                                } else {
                                  // Warm chocolate/amber brown gradient
                                  const factor = Math.max(0.45, 1 - distFromCenter * 0.45);
                                  d[p] = Math.round((105 + lum * 50) * factor);
                                  d[p + 1] = Math.round((58 + lum * 30) * factor);
                                  d[p + 2] = Math.round((32 + lum * 18) * factor);
                                }
                                // Specular catchlight in upper-right of pupil
                                const catchDist = Math.hypot(x - (cx + radius * 0.20), y - (cy - radius * 0.20));
                                if (catchDist < radius * 0.15) {
                                  d[p] = 255;
                                  d[p + 1] = 255;
                                  d[p + 2] = 255;
                                }
                              }
                            }
                          }
                          ctx.putImageData(imgData, 0, 0);
                          const brownTex = new THREE.CanvasTexture(cvs);
                          brownTex.flipY = false;
                          brownTex.needsUpdate = true;
                          child.material.map = brownTex;
                          child.material.roughness = 0.10;
                          child.material.needsUpdate = true;
                        }
                      }
                    } catch (e) {
                      console.warn("Could not apply brown eye texture:", e);
                    }
                  }
                }
              }
            });

            // Confident, focused eyebrows matching reference character
            const eyebrowL = character.getObjectByName("eyebrow_L");
            if (eyebrowL) {
              eyebrowL.rotation.z += 0.08;
              eyebrowL.position.y += 0.015;
            }
            const eyebrowR = character.getObjectByName("eyebrow_R");
            if (eyebrowR) {
              eyebrowR.rotation.z -= 0.08;
              eyebrowR.position.y += 0.015;
            }

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

  return { loadCharacter };
};

export default setCharacter;
