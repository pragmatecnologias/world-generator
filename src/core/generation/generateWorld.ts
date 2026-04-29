import { createDefaultProject } from "../../defaultProject";
import type { LayerDefinition, WorldProject } from "../../types";
import { flattenRoadsIntoTerrain, generateTerrain } from "./terrainGenerator";
import { generateRoads } from "./roadGenerator";
import { placeAssetsForWorld } from "./assetPlacementEngine";
import { generateFoliageGroups } from "./foliageGenerator";
import { generateScatterZones } from "./scatterGenerator";
import { generateMarkers } from "./markerGenerator";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "../schema/validators";

function ensureLayer(layers: LayerDefinition[], id: string, name: string) {
  if (layers.some((layer) => layer.id === id)) return layers;
  return [...layers, { id, name, visible: true, locked: false }];
}

export function generateWorld(config: WorldGenerationConfig): WorldProject {
  const issues = validateWorldGenerationConfig(config);
  if (issues.length > 0) {
    throw new Error(`Invalid world generation config: ${issues.join(" | ")}`);
  }

  const base = createDefaultProject();
  const terrain = generateTerrain(config);
  const roads = generateRoads(config, terrain);
  const flattenedTerrain = flattenRoadsIntoTerrain(terrain, roads);
  const project: WorldProject = {
    ...base,
    id: `generated-${config.seed}`,
    name: `Generated ${config.theme} World`,
    version: base.version,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terrain: flattenedTerrain,
    materials: base.materials,
    assets: base.assets,
    objects: [],
    foliageGroups: [],
    scatterZones: [],
    roads,
    markers: [],
    environment: {
      ...base.environment,
      ...(config.environment ?? {}),
    },
    layers: ensureLayer(
      ensureLayer(
        ensureLayer(
          ensureLayer(
            ensureLayer(base.layers, "layer-terrain", "Terrain"),
            "layer-props",
            "Props",
          ),
          "layer-foliage",
          "Foliage",
        ),
        "layer-road",
        "Roads",
      ),
      "layer-markers",
      "Markers",
    ),
    metadata: {
      description: config.metadata?.description ?? `Generated from seed ${config.seed}`,
    },
  };

  const generatedObjects = placeAssetsForWorld(project.assets, project.terrain, config, project.roads);
  project.objects = generatedObjects;

  const foliage = generateFoliageGroups(project, config, project.roads, project.terrain);
  project.foliageGroups = foliage;

  const scatter = generateScatterZones(project, config, project.terrain, project.roads);
  project.scatterZones = scatter.zones;
  project.objects = [...project.objects, ...scatter.objects];

  project.markers = generateMarkers(config, project.roads);

  if (config.roads[0]) {
    const road = project.roads[0];
    if (road.checkpointIds.length < config.gameplay.checkpoints) {
      project.roads = project.roads.map((entry) => entry.id === road.id
        ? { ...entry, checkpointIds: Array.from({ length: config.gameplay.checkpoints }, (_, index) => `cp-1-${index + 1}`) }
        : entry);
    }
  }

  return project;
}
