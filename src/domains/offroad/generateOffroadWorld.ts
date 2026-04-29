import type { WorldProject } from "../../types";
import { createDefaultProject } from "../../defaultProject";
import type { WorldGenerationConfig } from "../../core/schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "../../core/schema/validators";
import { buildBaseTerrainMaterials, buildGenericTerrain, applyPathEffects } from "../../core/engine/terrainCore";
import { roadsToPaths } from "../../core/schema/compat";
import { generateRoads } from "../../core/generation/roadGenerator";
import { generateFoliageGroups } from "../../core/generation/foliageGenerator";
import { generateScatterZones } from "../../core/generation/scatterGenerator";
import { generateMarkers } from "../../core/generation/markerGenerator";
import { placeAssetsForWorld } from "../../core/generation/assetPlacementEngine";
import { flattenRoadsIntoTerrain, applyRoadSurfaceTreatment } from "../../core/generation/terrainGenerator";

export function generateOffroadWorld(config: WorldGenerationConfig): WorldProject {
  const issues = validateWorldGenerationConfig(config);
  if (issues.length > 0) throw new Error(`Invalid world generation config: ${issues.join(" | ")}`);

  const base = createDefaultProject();
  const terrain = buildGenericTerrain(config.seed, config.terrain, 0.68);
  const roads = generateRoads(config, terrain);
  const paths = roadsToPaths(roads);
  const terrainAfterRoads = applyRoadSurfaceTreatment(flattenRoadsIntoTerrain(terrain, roads), roads, config.seed, config.theme);
  const terrainWithPath = applyPathEffects(terrainAfterRoads, paths.map((path) => ({ id: path.id, points: path.points, width: path.width, tags: ["primary", path.closedLoop ? "loop" : "trail"], closedLoop: path.closedLoop })), "track");

  const project: WorldProject = {
    ...base,
    id: `generated-${config.seed}`,
    name: `Generated ${config.theme} World`,
    version: base.version,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terrain: terrainWithPath,
    materials: buildBaseTerrainMaterials(),
    assets: base.assets,
    objects: [],
    foliageGroups: [],
    scatterZones: [],
    roads,
    markers: [],
    environment: { ...base.environment, ...(config.environment ?? {}) },
    layers: base.layers,
    metadata: { description: config.metadata?.description ?? `Generated from seed ${config.seed}` },
  };

  project.objects = placeAssetsForWorld(project.assets, project.terrain, config, project.roads);
  project.foliageGroups = generateFoliageGroups(project, config, project.roads, project.terrain);
  const scatter = generateScatterZones(project, config, project.terrain, project.roads);
  project.scatterZones = scatter.zones;
  project.objects = [...project.objects, ...scatter.objects];
  project.markers = generateMarkers(config, project.roads);

  return project;
}
