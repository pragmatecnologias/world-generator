import type { AssetDefinition, PlacedObject, TerrainData, Vector3Data } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { isSpacingClear } from "../rules/placementRules";
import { terrainSlopeAt } from "../../viewport/terrain";
import { classifyAsset } from "../assets/assetRegistry";
import * as THREE from "three";

function selectAssetByTags(assets: AssetDefinition[], tags: string[], fallbackIndex: number) {
  const tagged = assets.find((asset) => tags.some((tag) => asset.tags.includes(tag)));
  return tagged ?? assets[fallbackIndex % Math.max(1, assets.length)];
}

function placeObjectFromAsset(asset: AssetDefinition, position: Vector3Data, index: number, layerId = "layer-props"): PlacedObject {
  const scale = asset.defaultScale ?? 1;
  return {
    id: `generated-object-${index + 1}`,
    assetId: asset.id,
    name: `${asset.name} ${index + 1}`,
    position,
    rotation: { x: 0, y: index * 0.5, z: 0 },
    scale: { x: scale, y: scale, z: scale },
    layerId,
    visible: true,
    locked: false,
    collisionEnabled: true,
  };
}

export function placeAssetsForWorld(
  assets: AssetDefinition[],
  terrain: TerrainData,
  config: WorldGenerationConfig,
  roads: { points: { x: number; y: number; z: number }[]; width: number }[],
) {
  const props = assets.filter((asset) => {
    const role = classifyAsset(asset);
    return role === "rock" || role === "barrier" || role === "prop" || asset.category.toLowerCase().includes("track");
  });
  const foliage = assets.filter((asset) => classifyAsset(asset) === "foliage");
  const primary = props[0] ?? assets[0];
  const placements: PlacedObject[] = [];
  const existing: Vector3Data[] = [];

  if (primary) {
    const spread = Math.max(4, Math.min(10, Math.floor(config.terrain.width / 18)));
    for (let i = 0; i < spread; i += 1) {
      const angle = (i / spread) * Math.PI * 2;
      const radius = 12 + (i % 3) * 3;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const point = new THREE.Vector3(x, 0, z);
      const gridX = Math.max(0, Math.min(terrain.resolution - 1, Math.round(((point.x + terrain.width / 2) / terrain.width) * (terrain.resolution - 1))));
      const gridZ = Math.max(0, Math.min(terrain.resolution - 1, Math.round(((point.z + terrain.depth / 2) / terrain.depth) * (terrain.resolution - 1))));
      const idx = gridZ * terrain.resolution + gridX;
      const y = terrain.heights[idx] ?? 0;
      const candidate = { x, y, z };
      if (!isSpacingClear(existing, candidate, 5)) continue;
      if (terrainSlopeAt(new THREE.Vector3(x, y, z), terrain) > 35) continue;
      placements.push(placeObjectFromAsset(primary, candidate, placements.length, "layer-props"));
      existing.push(candidate);
    }
  }

  if (foliage[0]) {
    const asset = foliage[0];
    placements.push(
      placeObjectFromAsset(asset, { x: -8, y: terrain.heights[0] ?? 0, z: -8 }, placements.length, "layer-foliage"),
    );
  }

  return placements;
}
