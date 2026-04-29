import * as THREE from "three";
import { applyTerrainBrush, flattenRoadTerrain, terrainIndex } from "../../viewport/terrain";
import type { TerrainData, TerrainMaterial } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import type { PathDefinition } from "../schema/CoreWorldSchema";
import { createSeededRng } from "./random";

function fract(value: number) {
  return value - Math.floor(value);
}

function hash2D(seed: number, x: number, z: number) {
  const s = Math.sin((x * 127.1 + z * 311.7 + seed * 74.7) * 0.017453292519943295) * 43758.5453123;
  return fract(s);
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function valueNoise(seed: number, x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = x - x0;
  const zf = z - z0;
  const v00 = hash2D(seed, x0, z0);
  const v10 = hash2D(seed, x0 + 1, z0);
  const v01 = hash2D(seed, x0, z0 + 1);
  const v11 = hash2D(seed, x0 + 1, z0 + 1);
  const u = smoothstep(xf);
  const v = smoothstep(zf);
  const nx0 = THREE.MathUtils.lerp(v00, v10, u);
  const nx1 = THREE.MathUtils.lerp(v01, v11, u);
  return THREE.MathUtils.lerp(nx0, nx1, v);
}

function fbm(seed: number, x: number, z: number, octaves: number, frequency: number, persistence: number) {
  let total = 0;
  let amplitude = 1;
  let max = 0;
  let freq = frequency;
  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise(seed + i * 1013, x * freq, z * freq) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    freq *= 2;
  }
  return max > 0 ? total / max : 0;
}

function themeAmplitude(theme: WorldGenerationConfig["theme"]) {
  switch (theme) {
    case "desert":
      return 0.42;
    case "forest":
      return 0.82;
    case "biblical":
      return 1.15;
    case "mountain":
      return 1.55;
    case "offroad":
    default:
      return 0.68;
  }
}

function buildBaseMaterials(): TerrainMaterial[] {
  return [
    { id: "grass", name: "Grass", color: "#6ea95e", roughness: 0.95, scale: 1 },
    { id: "dirt", name: "Dirt", color: "#8d6b44", roughness: 1, scale: 1 },
    { id: "mud", name: "Mud", color: "#53402f", roughness: 1, scale: 1 },
    { id: "rock", name: "Rock", color: "#7d8791", roughness: 0.9, scale: 1 },
    { id: "sand", name: "Sand", color: "#d8c27f", roughness: 1, scale: 1 },
    { id: "track", name: "Track", color: "#4b4b4f", roughness: 1, scale: 1 },
  ];
}

function applyTerrainFeaturePass(terrain: TerrainData, config: WorldGenerationConfig) {
  const rng = createSeededRng(config.seed + 4444);
  let next = terrain;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  const featureCount = config.theme === "mountain" ? 6 : config.theme === "biblical" ? 5 : 4;

  for (let i = 0; i < featureCount; i += 1) {
    const angle = (i / featureCount) * Math.PI * 2;
    const radial = 0.18 + rng() * 0.22;
    const x = Math.cos(angle) * halfW * radial + (rng() - 0.5) * halfW * 0.12;
    const z = Math.sin(angle) * halfD * radial + (rng() - 0.5) * halfD * 0.12;
    const size = terrain.width * (0.08 + rng() * 0.08);
    const mode = i % 2 === 0 ? "raise" : "lower";
    next = applyTerrainBrush(
      next,
      new THREE.Vector3(x, 0, z),
      {
        size,
        strength: config.theme === "mountain" ? 0.9 : 0.6 + rng() * 0.2,
        falloff: "smooth",
        materialId: mode === "raise" ? "rock" : "mud",
        flattenHeight: 0,
      },
      mode,
    );
  }

  const ridgeAxis = rng() > 0.5 ? "x" : "z";
  const ridgeCount = 3 + Math.round(rng() * 2);
  for (let i = 0; i < ridgeCount; i += 1) {
    const offset = (i / Math.max(1, ridgeCount - 1)) * 2 - 1;
    const x = ridgeAxis === "x" ? offset * halfW * 0.28 : (rng() - 0.5) * halfW * 0.16;
    const z = ridgeAxis === "z" ? offset * halfD * 0.28 : (rng() - 0.5) * halfD * 0.16;
    const size = terrain.width * (0.12 + rng() * 0.06);
    const strength = 0.45 + rng() * 0.25;
    next = applyTerrainBrush(
      next,
      new THREE.Vector3(x, 0, z),
      {
        size,
        strength,
        falloff: "smooth",
        materialId: "rock",
      },
      "raise",
    );
  }

  const basinX = (rng() - 0.5) * halfW * 0.3;
  const basinZ = (rng() - 0.5) * halfD * 0.3;
  next = applyTerrainBrush(
    next,
    new THREE.Vector3(basinX, 0, basinZ),
    { size: terrain.width * 0.18, strength: 0.7, falloff: "smooth", materialId: config.theme === "desert" ? "sand" : "mud" },
    "lower",
  );

  return next;
}

function applyThemeSpecificPass(terrain: TerrainData, config: WorldGenerationConfig) {
  const rng = createSeededRng(config.seed + 8181);
  let next = terrain;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;

  if (config.theme === "desert") {
    for (let i = 0; i < 5; i += 1) {
      const x = (rng() - 0.5) * halfW * 0.6;
      const z = (rng() - 0.5) * halfD * 0.6;
      next = applyTerrainBrush(next, new THREE.Vector3(x, 0, z), { size: terrain.width * 0.14, strength: 0.35, falloff: "smooth", materialId: "sand" }, "raise");
      next = applyTerrainBrush(next, new THREE.Vector3(x + terrain.width * 0.04, 0, z - terrain.depth * 0.03), { size: terrain.width * 0.08, strength: 0.6, falloff: "smooth", materialId: "sand" }, "flatten");
    }
  } else if (config.theme === "forest") {
    for (let i = 0; i < 4; i += 1) {
      const x = (rng() - 0.5) * halfW * 0.55;
      const z = (rng() - 0.5) * halfD * 0.55;
      next = applyTerrainBrush(next, new THREE.Vector3(x, 0, z), { size: terrain.width * 0.1, strength: 0.55, falloff: "smooth", materialId: "grass" }, "raise");
      next = applyTerrainBrush(next, new THREE.Vector3(x * 0.45, 0, z * 0.45), { size: terrain.width * 0.06, strength: 0.7, falloff: "smooth", materialId: "grass" }, "smooth");
    }
  } else if (config.theme === "biblical") {
    for (let i = 0; i < 5; i += 1) {
      const ridgeX = (i - 2) * halfW * 0.12 + (rng() - 0.5) * halfW * 0.08;
      const ridgeZ = (rng() - 0.5) * halfD * 0.35;
      next = applyTerrainBrush(next, new THREE.Vector3(ridgeX, 0, ridgeZ), { size: terrain.width * 0.14, strength: 0.7, falloff: "smooth", materialId: "rock" }, "raise");
      next = applyTerrainBrush(next, new THREE.Vector3(ridgeX + terrain.width * 0.03, 0, ridgeZ - terrain.depth * 0.05), { size: terrain.width * 0.1, strength: 0.45, falloff: "smooth", materialId: "mud" }, "lower");
    }
  } else if (config.theme === "mountain") {
    for (let i = 0; i < 6; i += 1) {
      const x = (rng() - 0.5) * halfW * 0.42;
      const z = (rng() - 0.5) * halfD * 0.42;
      next = applyTerrainBrush(next, new THREE.Vector3(x, 0, z), { size: terrain.width * 0.1, strength: 0.95, falloff: "smooth", materialId: "rock" }, "raise");
      next = applyTerrainBrush(next, new THREE.Vector3(x - terrain.width * 0.04, 0, z + terrain.depth * 0.02), { size: terrain.width * 0.07, strength: 0.65, falloff: "smooth", materialId: "rock" }, "smooth");
    }
  } else {
    for (let i = 0; i < 4; i += 1) {
      const x = (rng() - 0.5) * halfW * 0.5;
      const z = (rng() - 0.5) * halfD * 0.5;
      next = applyTerrainBrush(next, new THREE.Vector3(x, 0, z), { size: terrain.width * 0.09, strength: 0.45, falloff: "smooth", materialId: "mud" }, rng() > 0.5 ? "raise" : "lower");
    }
  }

  return next;
}

function deriveMaterialMapFromHeights(terrain: TerrainData, theme: WorldGenerationConfig["theme"], heightScale: number) {
  const materialMap = Array.from({ length: terrain.heights.length }, () => "grass");
  for (let i = 0; i < terrain.heights.length; i += 1) {
    const x = i % terrain.resolution;
    const z = Math.floor(i / terrain.resolution);
    const height = terrain.heights[i];
    const left = terrain.heights[terrainIndex(Math.max(0, x - 1), z, terrain.resolution)] ?? height;
    const right = terrain.heights[terrainIndex(Math.min(terrain.resolution - 1, x + 1), z, terrain.resolution)] ?? height;
    const up = terrain.heights[terrainIndex(x, Math.min(terrain.resolution - 1, z + 1), terrain.resolution)] ?? height;
    const down = terrain.heights[terrainIndex(x, Math.max(0, z - 1), terrain.resolution)] ?? height;
    const slope = Math.hypot(right - left, up - down);
    if (slope > heightScale * 0.085) {
      materialMap[i] = "rock";
    } else if (height < -heightScale * 0.08) {
      materialMap[i] = theme === "desert" ? "sand" : "mud";
    } else if (height > heightScale * 0.12) {
      materialMap[i] = "dirt";
    } else {
      materialMap[i] = theme === "forest" ? "grass" : theme === "offroad" ? "track" : "grass";
    }
  }
  return materialMap;
}

export function generateTerrain(config: WorldGenerationConfig): TerrainData {
  const { terrain, seed, theme } = config;
  const heights = Array.from({ length: terrain.resolution * terrain.resolution }, (_, index) => {
    const x = index % terrain.resolution;
    const z = Math.floor(index / terrain.resolution);
    const nx = x / (terrain.resolution - 1) - 0.5;
    const nz = z / (terrain.resolution - 1) - 0.5;
    const radial = Math.max(0, 1 - Math.hypot(nx * 1.15, nz * 1.15));
    const ridge = 1 - Math.abs(valueNoise(seed + 99, nx * 5, nz * 5) * 2 - 1);
    const base = fbm(seed, nx * 8, nz * 8, terrain.noise.octaves, terrain.noise.frequency, terrain.noise.persistence);
    const shape = themeAmplitude(theme) * (base - 0.5) * terrain.heightScale;
    const centerRise = (theme === "mountain" ? 1.5 : 0.7) * radial * terrain.heightScale * 0.2;
    const canyon = (theme === "biblical" || theme === "desert") ? (ridge - 0.5) * terrain.heightScale * 0.12 : 0;
    return shape + centerRise + canyon;
  });

  let materialMap = Array.from({ length: heights.length }, () => "grass");
  for (let i = 0; i < heights.length; i += 1) {
    const x = i % terrain.resolution;
    const z = Math.floor(i / terrain.resolution);
    const height = heights[i];
    const left = heights[terrainIndex(Math.max(0, x - 1), z, terrain.resolution)] ?? height;
    const right = heights[terrainIndex(Math.min(terrain.resolution - 1, x + 1), z, terrain.resolution)] ?? height;
    const up = heights[terrainIndex(x, Math.min(terrain.resolution - 1, z + 1), terrain.resolution)] ?? height;
    const down = heights[terrainIndex(x, Math.max(0, z - 1), terrain.resolution)] ?? height;
    const slope = Math.hypot(right - left, up - down);
    if (slope > terrain.heightScale * 0.08) {
      materialMap[i] = "rock";
    } else if (height < -terrain.heightScale * 0.08) {
      materialMap[i] = theme === "desert" ? "sand" : "mud";
    } else if (height > terrain.heightScale * 0.1) {
      materialMap[i] = "dirt";
    } else {
      materialMap[i] = theme === "forest" ? "grass" : "track";
    }
  }

  let terrainData: TerrainData = {
    width: terrain.width,
    depth: terrain.depth,
    resolution: terrain.resolution,
    heights,
    materialMap,
  };

  terrainData = applyTerrainFeaturePass(terrainData, config);
  terrainData = applyThemeSpecificPass(terrainData, config);
  terrainData.materialMap = deriveMaterialMapFromHeights(terrainData, theme, terrain.heightScale);

  const patchCenters = [
    { x: -terrain.width * 0.22, z: terrain.depth * 0.15, materialId: "grass", size: terrain.width * 0.18 },
    { x: terrain.width * 0.18, z: -terrain.depth * 0.2, materialId: "dirt", size: terrain.width * 0.14 },
    { x: 0, z: terrain.depth * 0.08, materialId: "track", size: terrain.width * 0.08 },
  ];

  for (const patch of patchCenters) {
    terrainData = applyTerrainBrush(
      terrainData,
      new THREE.Vector3(patch.x, 0, patch.z),
      {
        size: patch.size,
        strength: 1,
        falloff: "smooth",
        materialId: patch.materialId,
      },
      "paint",
    );
  }

  return terrainData;
}

export function flattenPathsIntoTerrain(terrain: TerrainData, paths: { points: { x: number; y: number; z: number }[]; width: number; flattenTerrain: boolean; closedLoop?: boolean }[]) {
  return flattenRoadTerrain(terrain, paths);
}

export function flattenRoadsIntoTerrain(terrain: TerrainData, roads: { points: { x: number; y: number; z: number }[]; width: number; flattenTerrain: boolean; closedLoop?: boolean }[]) {
  return flattenPathsIntoTerrain(terrain, roads);
}

function shoulderMaterial(theme: WorldGenerationConfig["theme"]) {
  switch (theme) {
    case "desert":
      return "sand";
    case "forest":
      return "dirt";
    case "biblical":
    case "mountain":
      return "rock";
    case "offroad":
    default:
      return "mud";
  }
}

export function applyRoadSurfaceTreatment(
  terrain: TerrainData,
  roads: PathDefinition[],
  seed: number,
  theme: WorldGenerationConfig["theme"],
) {
  const rng = createSeededRng(seed + 1984);
  let next = terrain;
  const shoulder = shoulderMaterial(theme);

  for (const road of roads) {
    if (road.points.length < 2) continue;
    const segmentCount = road.closedLoop ? road.points.length : road.points.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      const start = road.points[i];
      const end = road.points[(i + 1) % road.points.length];
      const startVec = new THREE.Vector3(start.x, start.y, start.z);
      const endVec = new THREE.Vector3(end.x, end.y, end.z);
      const dx = endVec.x - startVec.x;
      const dz = endVec.z - startVec.z;
      const len = Math.max(0.001, Math.hypot(dx, dz));
      const perpX = -dz / len;
      const perpZ = dx / len;
      const steps = Math.max(3, Math.ceil(len / Math.max(road.width * 0.45, 1)));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const centerX = THREE.MathUtils.lerp(startVec.x, endVec.x, t);
        const centerZ = THREE.MathUtils.lerp(startVec.z, endVec.z, t);
        const centerY = THREE.MathUtils.lerp(startVec.y, endVec.y, t);
        const center = new THREE.Vector3(centerX, 0, centerZ);
        const corridorSize = Math.max(road.width * 0.55, 2.5);
        const shoulderSize = road.width * 0.95;
        const bankSize = road.width * 1.25;
        next = applyTerrainBrush(next, center, { size: corridorSize, strength: 0.35, falloff: "smooth", materialId: "track", flattenHeight: centerY }, "flatten");
        next = applyTerrainBrush(next, center, { size: corridorSize * 1.05, strength: 0.9, falloff: "smooth", materialId: "track" }, "paint");

        const sideOffset = shoulderSize * 0.48;
        const bankOffset = bankSize * 0.56;
        const left = new THREE.Vector3(centerX + perpX * sideOffset, 0, centerZ + perpZ * sideOffset);
        const right = new THREE.Vector3(centerX - perpX * sideOffset, 0, centerZ - perpZ * sideOffset);
        const leftBank = new THREE.Vector3(centerX + perpX * bankOffset, 0, centerZ + perpZ * bankOffset);
        const rightBank = new THREE.Vector3(centerX - perpX * bankOffset, 0, centerZ - perpZ * bankOffset);

        next = applyTerrainBrush(next, left, { size: shoulderSize * 0.65, strength: 0.45, falloff: "smooth", materialId: shoulder }, "paint");
        next = applyTerrainBrush(next, right, { size: shoulderSize * 0.65, strength: 0.45, falloff: "smooth", materialId: shoulder }, "paint");
        next = applyTerrainBrush(next, leftBank, { size: road.width * 0.8, strength: 0.2 + rng() * 0.2, falloff: "smooth", materialId: theme === "desert" ? "sand" : "rock" }, rng() > 0.5 ? "raise" : "lower");
        next = applyTerrainBrush(next, rightBank, { size: road.width * 0.8, strength: 0.2 + rng() * 0.2, falloff: "smooth", materialId: theme === "desert" ? "sand" : "rock" }, rng() > 0.5 ? "raise" : "lower");
      }
    }
  }

  return next;
}
