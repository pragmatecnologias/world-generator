import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map<string, Promise<THREE.Group>>();

function ensureModelUrl(path: string) {
  return encodeURI(path);
}

function normalizeModel(root: THREE.Object3D, sourcePath: string) {
  const lowerPath = sourcePath.toLowerCase();
  const isWaterAsset =
    lowerPath.includes("water") ||
    lowerPath.includes("river") ||
    lowerPath.includes("lake") ||
    lowerPath.includes("pond");
  const isPathAsset =
    lowerPath.includes("path") ||
    lowerPath.includes("road") ||
    lowerPath.includes("bridge");
  const isGrassAsset =
    lowerPath.includes("grass") ||
    lowerPath.includes("platform_beach") ||
    lowerPath.includes("ground_grass");
  const isTreeAsset = lowerPath.includes("tree");
  const isWoodAsset =
    lowerPath.includes("fence") ||
    lowerPath.includes("log") ||
    lowerPath.includes("tent") ||
    lowerPath.includes("campfire") ||
    lowerPath.includes("bridge");
  const isStoneAsset =
    lowerPath.includes("cliff") ||
    lowerPath.includes("rock") ||
    lowerPath.includes("stone") ||
    lowerPath.includes("bank");
  const polishMaterial = (material: THREE.Material) => {
    const candidate = material as THREE.MeshStandardMaterial;
    if (!candidate.color) return;
    const hsl = { h: 0, s: 0, l: 0 };
    candidate.color.getHSL(hsl);
    const materialName = `${candidate.name ?? ""} ${candidate.userData?.name ?? ""}`.toLowerCase();
    const materialIsWater = isWaterAsset || materialName.includes("water") || materialName.includes("river");
    const materialIsStone = isStoneAsset || materialName.includes("stone") || materialName.includes("rock") || materialName.includes("cliff");
    const materialIsGrass = isGrassAsset || materialName.includes("grass") || materialName.includes("leaf");
    const materialIsTree = isTreeAsset || materialName.includes("tree") || materialName.includes("pine") || materialName.includes("oak");
    const materialIsWood = isWoodAsset || materialName.includes("wood") || materialName.includes("plank");
    const materialIsPath = isPathAsset || materialName.includes("path") || materialName.includes("dirt");

    if (materialIsWater) {
      candidate.color.set(0x4a9fd8);
      candidate.color.offsetHSL(0, 0, Math.max(-0.06, Math.min(0.08, hsl.l - 0.5)));
    } else if (materialIsGrass) {
      candidate.color.set(0x7fc35a);
      candidate.color.offsetHSL(0, 0, Math.max(-0.06, Math.min(0.08, hsl.l - 0.5)));
    } else if (materialIsTree) {
      candidate.color.set(0x3f7d3a);
      candidate.color.offsetHSL(0, 0, Math.max(-0.08, Math.min(0.05, hsl.l - 0.44)));
    } else if (materialIsWood) {
      candidate.color.set(0xb6804e);
      candidate.color.offsetHSL(0, 0, Math.max(-0.06, Math.min(0.06, hsl.l - 0.5)));
    } else if (materialIsPath) {
      candidate.color.set(0xd8b47b);
      candidate.color.offsetHSL(0, 0, Math.max(-0.06, Math.min(0.06, hsl.l - 0.54)));
    } else if (materialIsStone) {
      candidate.color.set(0xb9ad9a);
      candidate.color.offsetHSL(0, 0, Math.max(-0.08, Math.min(0.06, hsl.l - 0.52)));
    } else if (isGrassAsset) {
      candidate.color.set(0x7fc35a);
      candidate.color.offsetHSL(0.0, 0.0, Math.max(-0.06, Math.min(0.08, hsl.l - 0.5)));
    } else {
      candidate.color.setHSL(0.09, Math.max(0.14, hsl.s * 0.8), Math.min(0.78, Math.max(0.45, hsl.l * 1.02)));
    }
    candidate.roughness = Math.min(candidate.roughness ?? 1, 0.72);
    if (candidate.emissive) {
      candidate.emissive.copy(candidate.color).multiplyScalar(0.08);
      candidate.emissiveIntensity = 0.55;
    }
  };
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => {
          polishMaterial(entry);
          entry.needsUpdate = true;
        });
      } else if (material) {
        polishMaterial(material);
        material.needsUpdate = true;
      }
    }
  });
}

export async function loadKenneyModel(path: string) {
  const url = ensureModelUrl(path);
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then((gltf) => {
        const root = gltf.scene.clone(true) as THREE.Group;
        normalizeModel(root, path);
        return root;
      }),
    );
  }
  return cache.get(url)!;
}

export function createModelInstance(path: string) {
  const wrapper = new THREE.Group();
  wrapper.name = `kenney-model:${path}`;
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color: "#8dd3ff", transparent: true, opacity: 0.08, roughness: 1 }),
  );
  placeholder.position.y = 0.4;
  wrapper.add(placeholder);
  void loadKenneyModel(path)
    .then((source) => {
      const fit = wrapper.userData.fit as
        | { fitHeight?: number; fitWidth?: number; fitDepth?: number; scale?: number; maxScale?: number }
        | undefined;
      const fitBounds = new THREE.Box3().setFromObject(source);
      const size = new THREE.Vector3();
      fitBounds.getSize(size);
      let scale = fit?.scale ?? 1;
      if (!fit?.scale) {
        const candidates: number[] = [];
        if (fit?.fitHeight) candidates.push(fit.fitHeight / Math.max(0.0001, size.y));
        if (fit?.fitWidth) candidates.push(fit.fitWidth / Math.max(0.0001, size.x));
        if (fit?.fitDepth) candidates.push(fit.fitDepth / Math.max(0.0001, size.z));
        if (candidates.length > 0) {
          scale = Math.min(...candidates);
        }
      }
      scale = Math.min(scale, fit?.maxScale ?? 2.2);
      source.scale.setScalar(scale);
      const centeredBounds = new THREE.Box3().setFromObject(source);
      const center = new THREE.Vector3();
      centeredBounds.getCenter(center);
      source.position.x -= center.x;
      source.position.z -= center.z;
      source.position.y -= centeredBounds.min.y;
      wrapper.clear();
      wrapper.add(source.clone(true));
    })
    .catch(() => {
      wrapper.clear();
    });
  return wrapper;
}

export function createPlacedKenneyModel(
  path: string,
  options: {
    x: number;
    y?: number;
    z: number;
    rotationY?: number;
    scale?: number;
    fitHeight?: number;
    fitWidth?: number;
    fitDepth?: number;
    maxScale?: number;
  },
) {
  const root = createModelInstance(path);
  root.position.set(options.x, options.y ?? 0, options.z);
  if (options.rotationY) {
    root.rotation.y = options.rotationY;
  }
  root.userData.fit = {
    scale: options.scale,
    fitHeight: options.fitHeight,
    fitWidth: options.fitWidth,
    fitDepth: options.fitDepth,
    maxScale: options.maxScale,
  };
  return root;
}
