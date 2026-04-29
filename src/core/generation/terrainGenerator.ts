import * as THREE from "three";
import { applyTerrainBrush, flattenRoadTerrain, terrainIndex } from "../../viewport/terrain";
import type { TerrainData, TerrainMaterial } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
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

export function flattenRoadsIntoTerrain(terrain: TerrainData, roads: { points: { x: number; y: number; z: number }[]; width: number; flattenTerrain: boolean }[]) {
  return flattenRoadTerrain(terrain, roads);
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
  roads: { points: { x: number; y: number; z: number }[]; width: number; closedLoop?: boolean }[],
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
