import type { WorldPatch } from "./worldPatchSchema";

export function validateAiPatch(patch: WorldPatch): string[] {
  const issues: string[] = [];
  if (!patch || typeof patch !== "object") return ["patch must be an object"];
  if (!("op" in patch) || typeof patch.op !== "string") return ["patch.op is required"];
  switch (patch.op) {
    case "setTerrainConfig":
      if (patch.value.width !== undefined && patch.value.width <= 0) issues.push("terrain width must be positive");
      if (patch.value.depth !== undefined && patch.value.depth <= 0) issues.push("terrain depth must be positive");
      break;
    case "addRoad":
      if (!patch.value.points?.length) issues.push("road must contain points");
      break;
    case "placeAsset":
      if (!patch.assetId) issues.push("assetId is required");
      break;
    case "scatterAssets":
      if (!patch.tag) issues.push("tag is required");
      if (patch.count <= 0) issues.push("count must be greater than 0");
      break;
    case "setEnvironment":
    case "updateProjectMetadata":
    case "addBiome":
    case "updateObject":
    case "removeObject":
      break;
    default:
      issues.push(`unsupported patch op: ${(patch as { op: string }).op}`);
  }
  return issues;
}
