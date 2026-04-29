import type { FoliageGroup, TerrainData, WorldProject } from "../../types";
import type { PathDefinition } from "../schema/CoreWorldSchema";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { isPointNearRoad, terrainSlopeAt, terrainWorldToGrid } from "../../viewport/terrain";
import * as THREE from "three";

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateFoliageGroups(project: WorldProject, config: WorldGenerationConfig, roads: PathDefinition[], terrain: TerrainData): FoliageGroup[] {
  const rng = mulberry32(config.seed + 999);
  const result: FoliageGroup[] = [];

  for (const biome of config.biomes) {
    const assetIds = project.assets
      .filter((asset) => biome.assetTags.some((tag) => asset.tags.includes(tag)) || asset.canPaint)
      .map((asset) => asset.id);
    const chosenAsset = assetIds[0] ?? project.assets[0]?.id;
    if (!chosenAsset) continue;

    const instances = [];
    const count = Math.max(6, Math.round(config.terrain.width * biome.density * 0.12));
    const edgeBias = /rock/i.test(biome.id) ? 0.78 : /tree|forest|grass/i.test(biome.id) ? 0.42 : 0.55;
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.pow(rng(), edgeBias) * Math.min(terrain.width, terrain.depth) * 0.48;
      const x = Math.cos(angle) * radius + (biome.density > 0.4 ? Math.sin(angle * 2.1) * terrain.width * 0.05 : 0);
      const z = Math.sin(angle) * radius + (biome.density > 0.4 ? Math.cos(angle * 1.8) * terrain.depth * 0.05 : 0);
      const grid = terrainWorldToGrid(new THREE.Vector3(x, 0, z), terrain);
      const y = terrain.heights[grid.index] ?? 0;
      if (biome.assetTags.some((tag) => /tree|foliage|bush/i.test(tag)) && isPointNearRoad(new THREE.Vector3(x, y, z), roads)) continue;
      if (terrainSlopeAt(new THREE.Vector3(x, y, z), terrain) > 35) continue;
      instances.push({
        id: `fol-${biome.id}-${i + 1}`,
        assetId: chosenAsset,
        position: { x, y, z },
        rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
        scale: {
          x: 0.85 + rng() * 0.5,
          y: 0.85 + rng() * 0.5,
          z: 0.85 + rng() * 0.5,
        },
      });
    }

    result.push({
      id: `foliage-${biome.id}`,
      name: biome.id,
      assetIds,
      instances,
      settings: {
        density: biome.density * 10,
        minSpacing: 2.5,
        randomScaleMin: 0.85,
        randomScaleMax: 1.35,
        randomRotation: true,
        slopeLimit: 35,
        avoidRoads: true,
        eraseMode: false,
      },
    });
  }

  return result;
}
