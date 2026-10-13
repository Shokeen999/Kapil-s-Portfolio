import * as THREE from "three";
import { GLTF } from "three-stdlib";
import { eyebrowBoneNames, typingBoneNames } from "../../../data/boneData";

const setAnimations = (gltf: GLTF) => {
  let character = gltf.scene;
  let mixer = new THREE.AnimationMixer(character);

  if (gltf.animations && gltf.animations.length > 0) {
    console.log("Available animations:", gltf.animations.map(a => a.name));

    // 1. Idle breathing - plays continuously, low weight so intro can override
    const idleClip = gltf.animations.find((clip) => clip.name === "idleBreathing");
    if (idleClip) {
      const idleAction = mixer.clipAction(idleClip);
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.setEffectiveWeight(1.0);
      idleAction.play();
    } else {
      console.warn("idleBreathing clip not found");
    }

    // 2. Intro animation - plays once
    const introClip = gltf.animations.find((clip) => clip.name === "introAnimation");
    if (introClip) {
      const introAction = mixer.clipAction(introClip);
      introAction.setLoop(THREE.LoopOnce, 1);
      introAction.clampWhenFinished = true;
      introAction.play();
    }

    // 3. Key clips
    const clipNames = ["key1", "key2", "key5", "key6"];
    clipNames.forEach((name) => {
      const clip = THREE.AnimationClip.findByName(gltf.animations, name);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
        action.timeScale = 1.2;
      }
    });

    // 4. Typing animation (filtered bones)
    const typingAction = createBoneAction(gltf, mixer, "typing", typingBoneNames);
    if (typingAction) {
      typingAction.enabled = true;
      typingAction.play();
      typingAction.timeScale = 1.2;
    }

    // 5. Blink: try GLTF clip first, then programmatic rAF
    const blinkClip = gltf.animations.find(
      (clip) => clip.name === "Blink" || clip.name === "blink"
    );
    if (blinkClip) {
      console.log("Found Blink clip in GLTF - playing");
      const blinkAction = mixer.clipAction(blinkClip);
      blinkAction.setLoop(THREE.LoopRepeat, Infinity);
      blinkAction.play();
    } else {
      // Fallback: drive morph targets directly via rAF
      // Works even when Plane.007 is invisible (visible=false)
      setupProgrammaticBlink(character);
    }
  }

  function startIntro() {
    const introClip = gltf.animations?.find((clip) => clip.name === "introAnimation");
    if (introClip) {
      const introAction = mixer.clipAction(introClip);
      introAction.clampWhenFinished = true;
      introAction.reset().play();
    }
  }

  function hover(gltf: GLTF, hoverDiv: HTMLDivElement) {
    let eyeBrowUpAction = createBoneAction(gltf, mixer, "browup", eyebrowBoneNames);
    if (!eyeBrowUpAction) {
      const browClip = gltf.animations?.find((c) => c.name === "browup");
      if (browClip) eyeBrowUpAction = mixer.clipAction(browClip);
    }
    let isHovering = false;
    if (eyeBrowUpAction) {
      eyeBrowUpAction.setLoop(THREE.LoopOnce, 1);
      eyeBrowUpAction.clampWhenFinished = true;
      eyeBrowUpAction.enabled = true;
    }
    const onHoverFace = () => {
      if (eyeBrowUpAction && !isHovering) {
        isHovering = true;
        eyeBrowUpAction.reset();
        eyeBrowUpAction.enabled = true;
        eyeBrowUpAction.setEffectiveWeight(4);
        eyeBrowUpAction.fadeIn(0.5).play();
      }
    };
    const onLeaveFace = () => {
      if (eyeBrowUpAction && isHovering) {
        isHovering = false;
        eyeBrowUpAction.fadeOut(0.6);
      }
    };
    if (!hoverDiv) return;
    hoverDiv.addEventListener("mouseenter", onHoverFace);
    hoverDiv.addEventListener("mouseleave", onLeaveFace);
    return () => {
      hoverDiv.removeEventListener("mouseenter", onHoverFace);
      hoverDiv.removeEventListener("mouseleave", onLeaveFace);
    };
  }

  return { mixer, startIntro, hover };
};

/**
 * Drives blinking by directly setting morphTargetInfluences on Plane.007.
 * Uses requestAnimationFrame - works even when mesh.visible = false.
 * Also checks window.__morphMeshes set by character.ts for pre-collected meshes.
 */
/**
 * Creates visible eyelid planes on the Tripo head and animates them to blink.
 * Since Plane.007 morph targets are on an invisible mesh, this approach
 * adds actual geometry to the scene that renders the blink effect.
 */
function setupProgrammaticBlink(character: THREE.Object3D) {
  // Find the Tripo head container
  const headContainer = character.getObjectByName("tripoHeadContainer");

  if (!headContainer) {
    console.warn("Blink: tripoHeadContainer not found");
    // Fallback: try morph-target approach on Plane.007
    setupMorphBlink(character);
    return;
  }

  // Skin-tone eyelid material matching the Tripo head
  const eyelidMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#c48a5e"),
    transparent: false,
    depthWrite: true,
  });

  // Create two eyelid planes (left + right eye)
  // Dimensions in Tripo-head local space (headScale=4.6 applied outside)
  // These values are tuned to overlay the eye area of the Tripo head model
  const eyeGeo = new THREE.PlaneGeometry(0.048, 0.028);

  const leftEyelid = new THREE.Mesh(eyeGeo, eyelidMat);
  leftEyelid.name = "syntheticEyelidL";
  leftEyelid.position.set(0.038, 0.055, 0.155); // left eye position in head-local space
  leftEyelid.scale.set(1, 0, 1); // start fully open (scaleY=0 = invisible)
  leftEyelid.renderOrder = 10;

  const rightEyelid = new THREE.Mesh(eyeGeo.clone(), eyelidMat);
  rightEyelid.name = "syntheticEyelidR";
  rightEyelid.position.set(-0.038, 0.055, 0.155); // right eye position
  rightEyelid.scale.set(1, 0, 1);
  rightEyelid.renderOrder = 10;

  // Add eyelids to the Tripo head scene (inside headContainer)
  headContainer.add(leftEyelid);
  headContainer.add(rightEyelid);
  console.log("Blink: synthetic eyelid planes added to tripoHeadContainer");

  // State machine blink loop
  type BlinkPhase = "idle" | "closing" | "opening";
  let phase: BlinkPhase = "idle";
  let phaseStart = performance.now();
  let idleDuration = 3000 + Math.random() * 2000;
  const CLOSE_MS = 70;
  const OPEN_MS = 90;

  function tick() {
    const now = performance.now();
    const elapsed = now - phaseStart;
    switch (phase) {
      case "idle":
        leftEyelid.scale.y = 0;
        rightEyelid.scale.y = 0;
        if (elapsed >= idleDuration) { phase = "closing"; phaseStart = now; }
        break;
      case "closing": {
        const t = Math.min(elapsed / CLOSE_MS, 1);
        leftEyelid.scale.y = t;
        rightEyelid.scale.y = t;
        if (t >= 1) { phase = "opening"; phaseStart = now; }
        break;
      }
      case "opening": {
        const t = Math.min(elapsed / OPEN_MS, 1);
        leftEyelid.scale.y = 1 - t;
        rightEyelid.scale.y = 1 - t;
        if (t >= 1) {
          phase = "idle";
          phaseStart = now;
          idleDuration = 2500 + Math.random() * 2500;
        }
        break;
      }
    }
    requestAnimationFrame(tick);
  }

  tick();
  console.log("Blink: eyelid animation loop started");
}

/**
 * Fallback: morph-target blink on Plane.007 (only works when that mesh is visible).
 */
function setupMorphBlink(character: THREE.Object3D) {
  const preMorphMeshes: THREE.Mesh[] = (window as any).__morphMeshes || [];
  let eyeMesh: THREE.Mesh | null = preMorphMeshes[0] || null;
  if (!eyeMesh) {
    character.traverse((child) => {
      const lname = child.name.toLowerCase().replace(/\./g, "");
      if (!eyeMesh && child instanceof THREE.Mesh && lname.includes("plane007")) {
        eyeMesh = child as THREE.Mesh;
      }
    });
  }
  if (!eyeMesh || !eyeMesh.morphTargetInfluences?.length) {
    console.warn("MorphBlink: no suitable mesh found");
    return;
  }
  const mesh = eyeMesh;
  const dict = mesh.morphTargetDictionary || {};
  const blinkIdx = dict["Key 2"] ?? dict["eyeL_60"] ?? dict["eyeL_100"] ?? 0;
  type Ph = "idle" | "closing" | "opening";
  let phase: Ph = "idle", phaseStart = performance.now(), idleDur = 3500 + Math.random() * 1500;
  function tick2() {
    const now = performance.now(), el = now - phaseStart;
    if (phase === "idle") {
      mesh.morphTargetInfluences![blinkIdx] = 0;
      if (el >= idleDur) { phase = "closing"; phaseStart = now; }
    } else if (phase === "closing") {
      const t = Math.min(el / 80, 1);
      mesh.morphTargetInfluences![blinkIdx] = t;
      if (t >= 1) { phase = "opening"; phaseStart = now; }
    } else {
      const t = Math.min(el / 80, 1);
      mesh.morphTargetInfluences![blinkIdx] = 1 - t;
      if (t >= 1) { phase = "idle"; phaseStart = now; idleDur = 2500 + Math.random() * 2000; }
    }
    requestAnimationFrame(tick2);
  }
  tick2();
}

const createBoneAction = (
  gltf: GLTF,
  mixer: THREE.AnimationMixer,
  clip: string,
  boneNames: string[]
): THREE.AnimationAction | null => {
  const AnimationClip = THREE.AnimationClip.findByName(gltf.animations, clip);
  if (!AnimationClip) {
    console.error(`Animation "${clip}" not found in GLTF file.`);
    return null;
  }
  return mixer.clipAction(filterAnimationTracks(AnimationClip, boneNames));
};

const filterAnimationTracks = (
  clip: THREE.AnimationClip,
  boneNames: string[]
): THREE.AnimationClip => {
  const filteredTracks = clip.tracks.filter((track) =>
    boneNames.some((boneName) => track.name.includes(boneName))
  );
  return new THREE.AnimationClip(clip.name + "_filtered", clip.duration, filteredTracks);
};

export default setAnimations;
