import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { generateCityWorld, generateOffroadWorld, generateFantasyWorld } from "../../domains";
import { generateGenericWorld } from "./generateGenericWorld";
import { createDefaultProject } from "../../defaultProject";
import { applyWorldOperations, createWorldOperation, worldDocumentToProject, worldProjectToDocument } from "../../worldDocument";

export function generateWorld(config: WorldGenerationConfig, assetSource = createDefaultProject().assets): WorldProject {
  if (config.generator === "fantasy") {
    const fantasyConfig = (config as WorldGenerationConfig & { fantasy?: { preset?: "island-village" | "forest-hamlet" | "coastal-town"; seed?: number } }).fantasy;
    const generated = generateFantasyWorld({
      preset: fantasyConfig?.preset ?? "island-village",
      seed: fantasyConfig?.seed ?? config.seed,
      terrainSize: 80,
      islandRadius: 0.42,
      townCenter: { x: 0, z: 0 },
      enableWater: true,
      enableForest: true,
      enableFarms: true,
      structureDensity: "normal",
    }, assetSource);
    const seedWorld = createDefaultProject();
    const applied = applyWorldOperations(worldProjectToDocument(seedWorld), [createWorldOperation(generated)]);
    return worldDocumentToProject(applied);
  }
  if (config.generator === "generic") {
    const generated = generateGenericWorld(config, "generic", assetSource);
    const seedWorld = createDefaultProject();
    const applied = applyWorldOperations(worldProjectToDocument(seedWorld), [createWorldOperation(generated)]);
    return worldDocumentToProject(applied);
  }
  const generated = config.generator === "city" ? generateCityWorld(config, assetSource) : generateOffroadWorld(config, assetSource);
  const seedWorld = createDefaultProject();
  const applied = applyWorldOperations(worldProjectToDocument(seedWorld), [createWorldOperation(generated)]);
  return worldDocumentToProject(applied);
}
