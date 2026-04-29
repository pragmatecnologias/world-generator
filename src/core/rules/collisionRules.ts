import type { PlacedObject, TerrainData } from "../../types";
import type { PathDefinition } from "../schema/CoreWorldSchema";
import { isPointNearRoad } from "../../viewport/terrain";
import * as THREE from "three";

export function isObjectInsideRoad(object: PlacedObject, roads: PathDefinition[]) {
  return isPointNearRoad(new THREE.Vector3(object.position.x, object.position.y, object.position.z), roads);
}

export function isObjectFloating(object: PlacedObject, terrain: TerrainData) {
  const closest = Math.round(((object.position.x + terrain.width / 2) / terrain.width) * (terrain.resolution - 1));
  const gridX = Math.max(0, Math.min(terrain.resolution - 1, closest));
  const gridZ = Math.max(0, Math.min(terrain.resolution - 1, Math.round(((object.position.z + terrain.depth / 2) / terrain.depth) * (terrain.resolution - 1))));
  const idx = gridZ * terrain.resolution + gridX;
  const ground = terrain.heights[idx] ?? 0;
  return object.position.y > ground + 2;
}
