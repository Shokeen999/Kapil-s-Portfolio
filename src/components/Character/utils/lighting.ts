import * as THREE from "three";
import { RGBELoader } from "three-stdlib";
import { gsap } from "gsap";

const setLighting = (scene: THREE.Scene) => {
  // Warm frontal key light illuminating face and eyes
  const directionalLight = new THREE.DirectionalLight(0xfff2ea, 1.35);
  directionalLight.position.set(0.4, 14.5, 8.0);
  directionalLight.target.position.set(0, 13.1, 0);
  scene.add(directionalLight.target);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.10);
  scene.add(ambientLight);

  // Studio Magenta/Purple Rim Lighting (matching reference character photo)
  const rimLightLeft = new THREE.DirectionalLight(0xa855f7, 1.10);
  rimLightLeft.position.set(-3.5, 14.5, -2.0);
  rimLightLeft.target.position.set(0, 13.1, 0);
  scene.add(rimLightLeft.target);
  scene.add(rimLightLeft);

  const rimLightRight = new THREE.DirectionalLight(0x9333ea, 1.00);
  rimLightRight.position.set(3.5, 14.5, -2.0);
  rimLightRight.target.position.set(0, 13.1, 0);
  scene.add(rimLightRight.target);
  scene.add(rimLightRight);

  const pointLight = new THREE.PointLight(0xc2a4ff, 0, 100, 3);
  pointLight.position.set(3, 12, 4);
  pointLight.castShadow = true;
  scene.add(pointLight);

  new RGBELoader()
    .setPath("/models/")
    .load("char_enviorment.hdr", function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.environmentIntensity = 0;
      scene.environmentRotation.set(5.76, 85.85, 1);
    });

  function setPointLight(screenLight: any) {
    if (screenLight && screenLight.material && screenLight.material.opacity > 0.9) {
      pointLight.intensity = screenLight.material.emissiveIntensity * 20;
    } else {
      pointLight.intensity = 0;
    }
  }
  const duration = 2;
  const ease = "power2.inOut";
  function turnOnLights() {
    gsap.to(scene, {
      environmentIntensity: 0.65,
      duration: duration,
      ease: ease,
    });
    gsap.to(directionalLight, {
      intensity: 1.25,
      duration: duration,
      ease: ease,
    });
    gsap.to(rimLightLeft, {
      intensity: 0.90,
      duration: duration,
      ease: ease,
    });
    gsap.to(rimLightRight, {
      intensity: 0.80,
      duration: duration,
      ease: ease,
    });
  }

  return { setPointLight, turnOnLights };
};

export default setLighting;
