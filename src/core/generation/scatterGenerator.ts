import type { PlacedObject, ScatterZone, TerrainData, WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { isSpacingClear } from "../rules/placementRules";
import { terrainSlopeAt } from "../../viewport/terrain";
import * as THREE from "three";

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ScatterGenerationResult = {
  zones: ScatterZone[];
  objects: PlacedObject[];
};

export function generateScatterZones(project: WorldProject, config: WorldGenerationConfig, terrain: TerrainData, roads: { points: { x: number; y: number; z: number }[]; width: number }[]): ScatterGenerationResult {
  const rng = mulberry32(config.seed + 2024);
  const zones: ScatterZone[] = [];
  const propAssets = project.assets.filter((asset) => asset.tags.some((tag) => /rock|prop|barrier/i.test(tag)) || asset.category.toLowerCase().includes("prop"));
  const chosenAssetIds = propAssets.length > 0 ? propAssets.map((asset) => asset.id) : project.assets.slice(0, 1).map((asset) => asset.id);
  if (chosenAssetIds.length === 0) return { zones, objects: [] };

  const points = [
    { x: -terrain.width * 0.22, y: 0, z: terrain.depth * 0.18 },
    { x: terrain.width * 0.24, y: 0, z: terrain.depth * 0.18 },
  ];

  const generatedObjectIds: string[] = [];
  const objects: PlacedObject[] = [];
  const count = Math.max(10, Math.round(config.terrain.width * 0.22));
  const existing: { x: number; z: number }[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = Math.pow(rng(), 0.55) * Math.min(terrain.width, terrain.depth) * 0.42;
    const x = Math.cos(angle) * radius + Math.sin(angle * 2) * terrain.width * 0.04;
    const z = Math.sin(angle) * radius + Math.cos(angle * 1.6) * terrain.depth * 0.04;
    const y = terrain.heights[Math.max(0, Math.min(terrain.resolution - 1, Math.round(((z + terrain.depth / 2) / terrain.depth) * (terrain.resolution - 1)))) * terrain.resolution + Math.max(0, Math.min(terrain.resolution - 1, Math.round(((x + terrain.width / 2) / terrain.width) * (terrain.resolution - 1))))] ?? 0;
    if (terrainSlopeAt(new THREE.Vector3(x, y, z), terrain) > 40) continue;
    if (!isSpacingClear(existing.map((point) => ({ x: point.x, y: 0, z: point.z })), { x, y, z }, 2.5)) continue;
    const assetId = chosenAssetIds[i % chosenAssetIds.length];
    const objectId = `scatter-${i + 1}`;
    generatedObjectIds.push(objectId);
    objects.push({
      id: objectId,
      assetId,
      name: `Scatter ${i + 1}`,
      position: { x, y, z },
      rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
      scale: {
        x: 0.7 + rng() * 0.8,
        y: 0.7 + rng() * 0.8,
        z: 0.7 + rng() * 0.8,
      },
      layerId: "layer-props",
      visible: true,
      locked: false,
      collisionEnabled: false,
    });
    existing.push({ x, z });
  }

  zones.push({
    id: "scatter-generated-001",
    name: "Generated Props",
    shape: "rectangle",
    points,
    assetIds: chosenAssetIds,
    settings: {
      count,
      minSpacing: 2.5,
      randomScaleMin: 0.7,
      randomScaleMax: 1.5,
      randomRotation: true,
      slopeLimit: 40,
    },
    generatedObjectIds,
  });

  return { zones, objects };
}
