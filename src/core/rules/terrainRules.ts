import type { TerrainData, Vector3Data } from "../../types";
import { terrainWorldToGrid } from "../../viewport/terrain";
import * as THREE from "three";

export function terrainHeightAt(point: Vector3Data, terrain: TerrainData) {
  return terrain.heights[terrainWorldToGrid(new THREE.Vector3(point.x, point.y, point.z), terrain).index] ?? 0;
}

export function terrainSlopeAtPoint(point: Vector3Data, terrain: TerrainData) {
  const center = terrainWorldToGrid(new THREE.Vector3(point.x, point.y, point.z), terrain);
  const sample = (x: number, z: number) => terrain.heights[Math.max(0, Math.min(terrain.resolution - 1, z)) * terrain.resolution + Math.max(0, Math.min(terrain.resolution - 1, x))] ?? 0;
  const left = sample(center.gridX - 1, center.gridZ);
  const right = sample(center.gridX + 1, center.gridZ);
  const down = sample(center.gridX, center.gridZ - 1);
  const up = sample(center.gridX, center.gridZ + 1);
  const dx = right - left;
  const dz = up - down;
  return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI);
}

export function isTerrainFlat(terrain: TerrainData) {
  const min = Math.min(...terrain.heights);
  const max = Math.max(...terrain.heights);
  return Math.abs(max - min) < 0.5;
}

