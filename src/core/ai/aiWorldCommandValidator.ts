import type { AiWorldCommand } from "./aiWorldCommandSchema";

export function validateAiWorldCommand(command: AiWorldCommand): string[] {
  const issues: string[] = [];
  if (!command || typeof command !== "object") return ["command must be an object"];
  if (!("type" in command) || typeof command.type !== "string") return ["command.type is required"];

  switch (command.type) {
    case "generateOffroadTrack":
      if (!Number.isFinite(command.seed)) issues.push("seed must be finite");
      if (command.difficulty < 0 || command.difficulty > 1) issues.push("difficulty must be between 0 and 1");
      break;
    case "addRockyBorder":
      if (command.density <= 0) issues.push("density must be greater than 0");
      break;
    case "addMudPits":
      if (command.count <= 0) issues.push("count must be greater than 0");
      break;
    case "makeTerrainMoreDramatic":
      if (command.amount < 0) issues.push("amount must be greater than or equal to 0");
      break;
    case "placeAssetCluster":
      if (!command.tag) issues.push("tag is required");
      if (command.count <= 0) issues.push("count must be greater than 0");
      break;
    case "applyWorldPatch":
      if (!command.patch) issues.push("patch is required");
      break;
  }

  return issues;
}
