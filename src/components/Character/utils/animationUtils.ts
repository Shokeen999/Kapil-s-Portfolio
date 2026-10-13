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
function setupProgrammaticBlink(_character: THREE.Object3D) {
  // Eyelids are animated directly on headScene inside loadAndAttachHead in character.ts
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
