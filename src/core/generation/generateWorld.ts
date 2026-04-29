import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { generateCityWorld, generateOffroadWorld } from "../../domains";
import { createDefaultProject } from "../../defaultProject";
import { applyWorldOperations, createWorldOperation, worldDocumentToProject, worldProjectToDocument } from "../../worldDocument";

export function generateWorld(config: WorldGenerationConfig): WorldProject {
  const generated = config.generator === "city" ? generateCityWorld(config) : generateOffroadWorld(config);
  const seedWorld = createDefaultProject();
  const applied = applyWorldOperations(worldProjectToDocument(seedWorld), [createWorldOperation(generated)]);
  return worldDocumentToProject(applied);
}
