import type { WorldGenerationConfig } from "./WorldConfigSchema";
import { validateWorldDocumentIntegrity, type WorldDocument } from "../../worldDocument";

export function validateWorldGenerationConfig(config: WorldGenerationConfig): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(config.seed)) issues.push("seed must be a finite number");
  if (config.terrain.width <= 0) issues.push("terrain.width must be greater than 0");
  if (config.terrain.depth <= 0) issues.push("terrain.depth must be greater than 0");
  if (config.terrain.resolution < 9 || config.terrain.resolution % 2 === 0) issues.push("terrain.resolution should be an odd number of at least 9");
  if (config.terrain.heightScale <= 0) issues.push("terrain.heightScale must be greater than 0");
  if (config.terrain.noise.octaves < 1) issues.push("terrain.noise.octaves must be at least 1");
  if (config.terrain.noise.frequency <= 0) issues.push("terrain.noise.frequency must be greater than 0");
  if (config.terrain.noise.persistence <= 0 || config.terrain.noise.persistence >= 1.5) issues.push("terrain.noise.persistence should be between 0 and 1.5");
  const hasLegacyRoads = config.roads.length > 0;
  const hasLegacyBiomes = config.biomes.length > 0;
  const hasGenericPaths = (config.paths?.length ?? 0) > 0;
  const hasGenericZones = (config.zones?.length ?? 0) > 0;
  const hasGenericPlacementRules = (config.placementRules?.length ?? 0) > 0;

  if (!hasLegacyRoads && !hasGenericPaths) issues.push("at least one road or path config is required");
  if (!hasLegacyBiomes && !hasGenericZones) issues.push("at least one biome or zone config is required");
  if (!hasLegacyBiomes && !hasGenericPlacementRules) issues.push("at least one biome or placement rule config is required");

  config.roads.forEach((road, index) => {
    if (road.width <= 0) issues.push(`roads[${index}].width must be greater than 0`);
    if (road.complexity < 2) issues.push(`roads[${index}].complexity must be at least 2`);
    if (road.checkpoints < 0) issues.push(`roads[${index}].checkpoints must not be negative`);
    if (!road.materialId) issues.push(`roads[${index}].materialId is required`);
  });

  config.biomes.forEach((biome, index) => {
    if (!biome.id) issues.push(`biomes[${index}].id is required`);
    if (!biome.materialId) issues.push(`biomes[${index}].materialId is required`);
    if (biome.density < 0) issues.push(`biomes[${index}].density must not be negative`);
  });

  config.paths?.forEach((path, index) => {
    if (path.width <= 0) issues.push(`paths[${index}].width must be greater than 0`);
    if (path.complexity < 0) issues.push(`paths[${index}].complexity must not be negative`);
    if (path.smoothing < 0 || path.smoothing > 1) issues.push(`paths[${index}].smoothing must be between 0 and 1`);
    if (!path.tags.length) issues.push(`paths[${index}].tags is required`);
  });

  config.zones?.forEach((zone, index) => {
    if (!zone.tags.length) issues.push(`zones[${index}].tags is required`);
    if (zone.type === "circle" && (!zone.radius || zone.radius <= 0)) issues.push(`zones[${index}].radius must be greater than 0 for circle zones`);
    if (zone.type === "rect" && ((!zone.width || zone.width <= 0) || (!zone.depth || zone.depth <= 0))) issues.push(`zones[${index}].width and depth must be greater than 0 for rect zones`);
    if (zone.type === "blob" && (!zone.radius || zone.radius <= 0)) issues.push(`zones[${index}].radius must be greater than 0 for blob zones`);
  });

  config.placementRules?.forEach((rule, index) => {
    if (!rule.assetTags.length) issues.push(`placementRules[${index}].assetTags is required`);
    if (rule.density !== undefined && rule.density < 0) issues.push(`placementRules[${index}].density must not be negative`);
    if (rule.count !== undefined && rule.count < 0) issues.push(`placementRules[${index}].count must not be negative`);
    if (rule.minSpacing !== undefined && rule.minSpacing < 0) issues.push(`placementRules[${index}].minSpacing must not be negative`);
    if (rule.slopeMax !== undefined && rule.slopeMax < 0) issues.push(`placementRules[${index}].slopeMax must not be negative`);
  });

  if (config.generator === "generic" && !hasGenericPaths && !hasLegacyRoads) issues.push("generic generator requires at least one path or road");
  return issues;
}

export function validateWorldDocument(document: WorldDocument): string[] {
  return validateWorldDocumentIntegrity(document);
}
