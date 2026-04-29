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
  if (config.roads.length === 0) issues.push("at least one road config is required");
  config.roads.forEach((road, index) => {
    if (road.width <= 0) issues.push(`roads[${index}].width must be greater than 0`);
    if (road.complexity < 2) issues.push(`roads[${index}].complexity must be at least 2`);
    if (road.checkpoints < 0) issues.push(`roads[${index}].checkpoints must not be negative`);
    if (!road.materialId) issues.push(`roads[${index}].materialId is required`);
  });
  if (config.biomes.length === 0) issues.push("at least one biome is required");
  config.biomes.forEach((biome, index) => {
    if (!biome.id) issues.push(`biomes[${index}].id is required`);
    if (!biome.materialId) issues.push(`biomes[${index}].materialId is required`);
    if (biome.density < 0) issues.push(`biomes[${index}].density must not be negative`);
  });
  return issues;
}

export function validateWorldDocument(document: WorldDocument): string[] {
  return validateWorldDocumentIntegrity(document);
}

