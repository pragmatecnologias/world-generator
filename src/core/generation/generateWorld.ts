import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { generateCityWorld, generateOffroadWorld } from "../../domains";

export function generateWorld(config: WorldGenerationConfig): WorldProject {
  if (config.generator === "city") return generateCityWorld(config);
  return generateOffroadWorld(config);
}
