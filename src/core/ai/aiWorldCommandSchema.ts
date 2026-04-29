import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import type { WorldPatch } from "./worldPatchSchema";

export type AiWorldCommand =
  | { type: "generateOffroadTrack"; seed: number; difficulty: number; config?: Partial<WorldGenerationConfig> }
  | { type: "addRockyBorder"; density: number; seed?: number }
  | { type: "addMudPits"; count: number; seed?: number }
  | { type: "makeTerrainMoreDramatic"; amount: number; seed?: number }
  | { type: "placeAssetCluster"; tag: string; count: number; seed?: number }
  | { type: "applyWorldPatch"; patch: WorldPatch };

