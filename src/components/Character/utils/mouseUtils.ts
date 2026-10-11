import * as THREE from "three";

export const handleMouseMove = (
  event: MouseEvent,
  setMousePosition: (x: number, y: number) => void
) => {
  const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  setMousePosition(mouseX, mouseY);
};

export const handleTouchMove = (
  event: TouchEvent,
  setMousePosition: (x: number, y: number) => void
) => {
  const mouseX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
  const mouseY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
  setMousePosition(mouseX, mouseY);
};

export const handleTouchEnd = (
  setMousePosition: (
    x: number,
    y: number,
    interpolationX: number,
    interpolationY: number
  ) => void
) => {
  setTimeout(() => {
    setMousePosition(0, 0, 0.03, 0.03);
    setTimeout(() => {
      setMousePosition(0, 0, 0.1, 0.2);
    }, 1000);
  }, 2000);
};

export const handleHeadRotation = (
  headBone: THREE.Object3D,
  mouseX: number,
  mouseY: number,
  interpolationX: number,
  interpolationY: number,
  lerp: (x: number, y: number, t: number) => number
) => {
  if (!headBone) return;
  const scrollThreshold = typeof window !== "undefined" ? window.innerHeight * 0.75 : 500;
  const basePitch = (window as any).__basePitch ?? 0;

  if (window.scrollY < scrollThreshold) {
    // When mouse is at center (0, 0), head looks directly straight at user/camera
    const pitchRange = 0.24;
    const yawRange = Math.PI / 5;

    const targetX = basePitch - mouseY * pitchRange;
    const targetY = mouseX * yawRange;

    headBone.rotation.x = lerp(headBone.rotation.x, targetX, interpolationX);
    headBone.rotation.y = lerp(headBone.rotation.y, targetY, interpolationY);
  } else {
    if (window.innerWidth > 1024) {
      headBone.rotation.x = lerp(headBone.rotation.x, basePitch, 0.03);
      headBone.rotation.y = lerp(headBone.rotation.y, 0, 0.03);
    }
  }
};
