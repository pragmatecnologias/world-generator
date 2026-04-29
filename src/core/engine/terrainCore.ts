import * as THREE from "three";
import type { TerrainData, TerrainMaterial } from "../../types";
import type { PathDefinition } from "../../core/schema/CoreWorldSchema";
import { applyTerrainBrush, terrainIndex } from "../../viewport/terrain";

export function buildBaseTerrainMaterials(): TerrainMaterial[] {
  return [
    { id: "grass", name: "Grass", color: "#84b96a", roughness: 0.95, scale: 1 },
    { id: "dirt", name: "Dirt", color: "#b18458", roughness: 1, scale: 1 },
    { id: "mud", name: "Mud", color: "#70513d", roughness: 1, scale: 1 },
    { id: "rock", name: "Rock", color: "#c7b49a", roughness: 0.9, scale: 1 },
    { id: "sand", name: "Sand", color: "#e0c97b", roughness: 1, scale: 1 },
    { id: "track", name: "Track", color: "#d8bc69", roughness: 1, scale: 1 },
    { id: "water", name: "Water", color: "#4da4e3", roughness: 0.22, scale: 1 },
  ];
}

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

export function buildGenericTerrain(
  seed: number,
  terrain: { width: number; depth: number; resolution: number; heightScale: number; noise: { octaves: number; frequency: number; persistence: number } },
  themeAmplitude: number,
): TerrainData {
  const heights = Array.from({ length: terrain.resolution * terrain.resolution }, (_, index) => {
    const x = index % terrain.resolution;
    const z = Math.floor(index / terrain.resolution);
    const nx = x / (terrain.resolution - 1) - 0.5;
    const nz = z / (terrain.resolution - 1) - 0.5;
    const radial = Math.max(0, 1 - Math.hypot(nx * 1.15, nz * 1.15));
    const ridge = 1 - Math.abs(valueNoise(seed + 99, nx * 5, nz * 5) * 2 - 1);
    const base = fbm(seed, nx * 8, nz * 8, terrain.noise.octaves, terrain.noise.frequency, terrain.noise.persistence);
    const shape = themeAmplitude * (base - 0.5) * terrain.heightScale;
    const centerRise = radial * terrain.heightScale * 0.2;
    const canyon = (ridge - 0.5) * terrain.heightScale * 0.12;
    return shape + centerRise + canyon;
  });

  const materialMap = Array.from({ length: heights.length }, (_, i) => {
    const x = i % terrain.resolution;
    const z = Math.floor(i / terrain.resolution);
    const height = heights[i];
    const left = heights[terrainIndex(Math.max(0, x - 1), z, terrain.resolution)] ?? height;
    const right = heights[terrainIndex(Math.min(terrain.resolution - 1, x + 1), z, terrain.resolution)] ?? height;
    const up = heights[terrainIndex(x, Math.min(terrain.resolution - 1, z + 1), terrain.resolution)] ?? height;
    const down = heights[terrainIndex(x, Math.max(0, z - 1), terrain.resolution)] ?? height;
    const slope = Math.hypot(right - left, up - down);
    if (slope > terrain.heightScale * 0.08) return "rock";
    if (height < -terrain.heightScale * 0.08) return "mud";
    if (height > terrain.heightScale * 0.1) return "dirt";
    return "grass";
  });

  return {
    width: terrain.width,
    depth: terrain.depth,
    resolution: terrain.resolution,
    heights,
    materialMap,
  };
}

export function applyPathEffects(
  terrain: TerrainData,
  paths: PathDefinition[],
  materialId: string,
) {
  let next = terrain;
  for (const path of paths) {
    for (let i = 0; i < Math.max(0, path.points.length - 1); i += 1) {
      const start = new THREE.Vector3(path.points[i].x, path.points[i].y, path.points[i].z);
      const end = new THREE.Vector3(path.points[i + 1].x, path.points[i + 1].y, path.points[i + 1].z);
      const segmentSize = Math.max(3, path.width);
      next = applyTerrainBrush(next, start, { size: segmentSize, strength: 0.3, falloff: "smooth", materialId, flattenHeight: start.y }, "flatten");
      next = applyTerrainBrush(next, end, { size: segmentSize, strength: 0.3, falloff: "smooth", materialId, flattenHeight: end.y }, "flatten");
      const mid = new THREE.Vector3((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
      next = applyTerrainBrush(next, mid, { size: segmentSize * 0.6, strength: 1, falloff: "smooth", materialId }, "paint");
    }
  }
  return next;
}
