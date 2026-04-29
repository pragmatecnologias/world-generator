import type { WorldProject } from "../../types";
import type { WorldGenerationConfig } from "../../core/schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "../../core/schema/validators";
import { generateGenericWorld } from "../../core/generation/generateGenericWorld";
import type { AssetDefinition } from "../../types";

export function generateOffroadWorld(config: WorldGenerationConfig, assetSource?: AssetDefinition[]): WorldProject {
  const issues = validateWorldGenerationConfig(config);
  if (issues.length > 0) throw new Error(`Invalid world generation config: ${issues.join(" | ")}`);
  return generateGenericWorld(config, "offroad", assetSource);
}
