import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { generateCityWorld, generateOffroadWorld } from "../../domains";
import { generateGenericWorld } from "./generateGenericWorld";
import { createDefaultProject } from "../../defaultProject";
import { applyWorldOperations, createWorldOperation, worldDocumentToProject, worldProjectToDocument } from "../../worldDocument";

export function generateWorld(config: WorldGenerationConfig, assetSource = createDefaultProject().assets): WorldProject {
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
