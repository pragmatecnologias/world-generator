import * as THREE from "three";
import { createDefaultProject } from "../../defaultProject";
import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../../core/schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "../../core/schema/validators";
import { buildBaseTerrainMaterials, buildGenericTerrain, applyPathEffects } from "../../core/engine/terrainCore";
import { placeAssetsForWorld } from "../../core/generation/assetPlacementEngine";
import { roadsToPaths } from "../../core/schema/compat";

function buildCityPaths(config: WorldGenerationConfig) {
  const terrain = config.terrain;
  const streetWidth = Math.max(4, terrain.width * 0.03);
  const half = terrain.width * 0.35;
  const points = [
    [
      { x: -half, y: 0.1, z: -terrain.depth * 0.1 },
      { x: half, y: 0.1, z: -terrain.depth * 0.1 },
    ],
    [
      { x: -half, y: 0.1, z: terrain.depth * 0.1 },
      { x: half, y: 0.1, z: terrain.depth * 0.1 },
    ],
    [
      { x: -terrain.width * 0.1, y: 0.1, z: -half },
      { x: -terrain.width * 0.1, y: 0.1, z: half },
    ],
    [
      { x: terrain.width * 0.1, y: 0.1, z: -half },
      { x: terrain.width * 0.1, y: 0.1, z: half },
    ],
  ];
  return points.map((pts, index) => ({
    id: `city-path-${index + 1}`,
    name: `Street ${index + 1}`,
    points: pts,
    width: streetWidth,
    materialId: index % 2 === 0 ? "track" : "dirt",
    flattenTerrain: true,
    smoothEdges: true,
    closedLoop: false,
    checkpointIds: [],
  }));
}

export function generateCityWorld(config: WorldGenerationConfig): WorldProject {
  const issues = validateWorldGenerationConfig(config);
  if (issues.length > 0) throw new Error(`Invalid world generation config: ${issues.join(" | ")}`);

  const base = createDefaultProject();
  const terrain = buildGenericTerrain(config.seed, config.terrain, 0.2);
  const roads = buildCityPaths(config);
  const paths = roadsToPaths(roads);
  const terrainWithPaths = applyPathEffects(terrain, paths.map((path) => ({ id: path.id, points: path.points, width: path.width, tags: ["street", "grid"], closedLoop: false })), "track");

  const project: WorldProject = {
    ...base,
    id: `generated-city-${config.seed}`,
    name: `Generated City World`,
    version: base.version,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terrain: terrainWithPaths,
    materials: buildBaseTerrainMaterials(),
    objects: [],
    foliageGroups: [],
    scatterZones: [],
    roads,
    markers: [
      {
        id: "city-start",
        type: "start-finish",
        name: "City Start",
        position: { x: -terrain.width * 0.2, y: 0.1, z: -terrain.depth * 0.1 },
        rotation: { x: 0, y: 0, z: 0 },
        radius: 8,
      },
      {
        id: "city-checkpoint-1",
        type: "checkpoint",
        name: "Checkpoint 1",
        position: { x: 0, y: 0.1, z: -terrain.depth * 0.1 },
        rotation: { x: 0, y: 0, z: 0 },
        radius: 8,
        metadata: { order: 1 },
      },
    ],
    environment: {
      ...base.environment,
      backgroundColor: "#c7d4e4",
      fogEnabled: true,
      fogColor: "#d7dde5",
      fogDensity: 0.008,
      timeOfDay: "noon",
      weather: "clear",
    },
    layers: base.layers,
    metadata: { description: config.metadata?.description ?? `Generated city from seed ${config.seed}` },
  };

  project.objects = placeAssetsForWorld(project.assets, project.terrain, config, project.roads);
  return project;
}
