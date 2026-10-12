import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import setCharacter from "./utils/character";
import setLighting from "./utils/lighting";
import { useLoading } from "../../context/LoadingProvider";
import handleResize from "./utils/resizeUtils";
import {
  handleMouseMove,
  handleTouchEnd,
  handleHeadRotation,
  handleTouchMove,
} from "./utils/mouseUtils";
import setAnimations from "./utils/animationUtils";
import { setProgress } from "../Loading";

const Scene = () => {
  const canvasDiv = useRef<HTMLDivElement | null>(null);
  const hoverDivRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(new THREE.Scene());
  const { setLoading } = useLoading();

  const [character, setChar] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (canvasDiv.current) {
      let isCancelled = false;
      let animId: number;

      // Ensure canvasDiv is clean of any previous canvas elements
      while (canvasDiv.current.firstChild) {
        if (canvasDiv.current.firstChild !== hoverDivRef.current) {
          canvasDiv.current.removeChild(canvasDiv.current.firstChild);
        } else {
          break;
        }
      }

      let rect = canvasDiv.current.getBoundingClientRect();
      let container = { width: rect.width, height: rect.height };
      const aspect = container.width / container.height;
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setSize(container.width, container.height);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      canvasDiv.current.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(14.5, aspect, 0.1, 1000);
      camera.position.set(0, 13.1, 24.7);
      // Adjust zoom based on screen aspect ratio:
      // - ultrawide (>2.0): full zoom 1.1
      // - standard 16:9 (~1.78): reduce zoom so character isn't oversized
      // - narrower (<1.5): further reduce
      const baseZoom = aspect >= 2.0 ? 1.1 : aspect >= 1.6 ? 0.82 : aspect >= 1.4 ? 0.75 : 0.68;
      camera.zoom = baseZoom;
      camera.updateProjectionMatrix();

      let headBone: THREE.Object3D | null = null;
      let screenLight: any | null = null;
      let mixer: THREE.AnimationMixer;

      const clock = new THREE.Clock();

      const light = setLighting(scene);
      let progress = setProgress((value) => setLoading(value));
      const { loadCharacter } = setCharacter(renderer, scene, camera);

      // Failsafe timeout: if character decryption / loading stalls beyond 15 seconds, ensure loader completes
      const safetyTimer = setTimeout(() => {
        if (!isCancelled) {
          console.warn("Character load timeout fallback triggered.");
          progress.loaded();
        }
      }, 15000);

      loadCharacter()
        .then((gltf) => {
          clearTimeout(safetyTimer);
          if (isCancelled || !gltf) {
            progress.dispose();
            return;
          }

          // Remove any existing character groups from the scene to prevent duplicates
          for (let i = scene.children.length - 1; i >= 0; i--) {
            const childObj = scene.children[i];
            if (childObj.type === "Group" && childObj.name === "Scene") {
              scene.remove(childObj);
            }
          }

          const animations = setAnimations(gltf);
          hoverDivRef.current && animations.hover(gltf, hoverDivRef.current);
          mixer = animations.mixer;
          let character = gltf.scene;
          setChar(character);
          scene.add(character);
          headBone =
            character.getObjectByName("spine006") ||
            character.getObjectByName("spine.006") ||
            null;
          screenLight = character.getObjectByName("screenlight") || null;
          (window as any).__char = character;
          (window as any).__headBone = headBone;
          (window as any).__camera = camera;
          (window as any).__scene = scene;
          (window as any).__THREE = THREE;
          progress.loaded().then(() => {
            setTimeout(() => {
              light.turnOnLights();
              animations.startIntro();
            }, 1000);
          });
          window.addEventListener("resize", () =>
            handleResize(renderer, camera, canvasDiv, character)
          );
        })
        .catch((err) => {
          clearTimeout(safetyTimer);
          console.error("Failed to load character model:", err);
          progress.clear();
        });

      let mouse = { x: 0, y: 0 },
        interpolation = { x: 0.1, y: 0.2 };

      const onMouseMove = (event: MouseEvent) => {
        handleMouseMove(event, (x, y) => (mouse = { x, y }));
      };
      let debounce: number | undefined;
      const onTouchStart = (event: TouchEvent) => {
        const element = event.target as HTMLElement;
        debounce = setTimeout(() => {
          element?.addEventListener("touchmove", (e: TouchEvent) =>
            handleTouchMove(e, (x, y) => (mouse = { x, y }))
          );
        }, 200);
      };

      const onTouchEnd = () => {
        handleTouchEnd((x, y, interpolationX, interpolationY) => {
          mouse = { x, y };
          interpolation = { x: interpolationX, y: interpolationY };
        });
      };

      document.addEventListener("mousemove", (event) => {
        onMouseMove(event);
      });
      const landingDiv = document.getElementById("landingDiv");
      if (landingDiv) {
        landingDiv.addEventListener("touchstart", onTouchStart);
        landingDiv.addEventListener("touchend", onTouchEnd);
      }
      const animate = () => {
        animId = requestAnimationFrame(animate);
        try {
          const delta = clock.getDelta();
          if (mixer) {
            mixer.update(delta);
          }
          if (headBone) {
            handleHeadRotation(
              headBone,
              mouse.x,
              mouse.y,
              interpolation.x,
              interpolation.y,
              THREE.MathUtils.lerp
            );
            if (screenLight) {
              light.setPointLight(screenLight);
            }
          }
          renderer.render(scene, camera);
        } catch (e) {
          console.error("Render loop error:", e);
        }
      };
      animate();
      return () => {
        isCancelled = true;
        clearTimeout(safetyTimer);
        progress.dispose();
        cancelAnimationFrame(animId);
        clearTimeout(debounce);
        scene.clear();
        renderer.dispose();
        window.removeEventListener("resize", () =>
          handleResize(renderer, camera, canvasDiv, character!)
        );
        if (canvasDiv.current && renderer.domElement.parentNode === canvasDiv.current) {
          canvasDiv.current.removeChild(renderer.domElement);
        }
        if (landingDiv) {
          document.removeEventListener("mousemove", onMouseMove);
          landingDiv.removeEventListener("touchstart", onTouchStart);
          landingDiv.removeEventListener("touchend", onTouchEnd);
        }
      };
    }
  }, []);

  return (
    <>
      <div className="character-container">
        <div className="character-model" ref={canvasDiv}>
          <div className="character-hover" ref={hoverDivRef}></div>
        </div>
      </div>
    </>
  );
};

export default Scene;
