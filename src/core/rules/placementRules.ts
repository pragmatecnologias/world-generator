import type { TerrainData, Vector3Data, RoadDefinition } from "../../types";
import { isPointNearRoad, terrainSlopeAt, terrainWorldToGrid } from "../../viewport/terrain";
import * as THREE from "three";

export function isSpacingClear(existing: Vector3Data[], candidate: Vector3Data, minSpacing: number) {
  return !existing.some((point) => Math.hypot(point.x - candidate.x, point.z - candidate.z) < minSpacing);
}

export function isPointOnRoad(point: Vector3Data, roads: RoadDefinition[]) {
  return isPointNearRoad(new THREE.Vector3(point.x, point.y, point.z), roads);
}

export function isSlopeAllowed(point: Vector3Data, terrain: TerrainData, slopeLimit: number) {
  if (slopeLimit <= 0) return true;
  const slope = terrainSlopeAt(new THREE.Vector3(point.x, point.y, point.z), terrain);
  return slope <= slopeLimit;
}

export function sampleTerrainPoint(point: Vector3Data, terrain: TerrainData) {
  const grid = terrainWorldToGrid(new THREE.Vector3(point.x, point.y, point.z), terrain);
  return terrain.heights[grid.index] ?? 0;
}

