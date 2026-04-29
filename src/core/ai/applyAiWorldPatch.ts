import type { WorldProject } from "../../types";
import type { WorldPatch } from "./aiWorldCommandSchema";
import { validateAiPatch } from "./worldPatchValidator";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function applyAiWorldPatch(project: WorldProject, patch: WorldPatch): { project: WorldProject; issues: string[] } {
  const issues = validateAiPatch(patch);
  if (issues.length > 0) return { project, issues };

  const next = clone(project);
  switch (patch.op) {
    case "setTerrainConfig":
      next.terrain = { ...next.terrain, ...patch.value };
      break;
    case "addRoad":
      next.roads = [...next.roads, patch.value];
      break;
    case "addBiome":
      next.materials = next.materials.some((material) => material.id === patch.value.materialId)
        ? next.materials
        : [...next.materials, { id: patch.value.materialId, name: patch.value.id, color: "#6ea95e", roughness: 1, scale: 1 }];
      break;
    case "placeAsset":
      next.objects = [
        ...next.objects,
        {
          id: `ai-object-${next.objects.length + 1}`,
          assetId: patch.assetId,
          name: `AI Object ${next.objects.length + 1}`,
          position: patch.position,
          rotation: patch.rotation ?? { x: 0, y: 0, z: 0 },
          scale: patch.scale ?? { x: 1, y: 1, z: 1 },
          layerId: patch.layerId ?? next.layers[1]?.id ?? next.layers[0]?.id ?? "layer-props",
          visible: true,
          locked: false,
          collisionEnabled: true,
        },
      ];
      break;
    case "scatterAssets":
      next.metadata = { ...next.metadata, description: `${next.metadata.description} [scatter:${patch.tag}:${patch.zoneId}:${patch.count}]` };
      break;
    case "setEnvironment":
      next.environment = { ...next.environment, ...patch.value };
      break;
    case "updateProjectMetadata":
      next.metadata = { ...next.metadata, ...patch.value };
      if (patch.value.description !== undefined) {
        next.metadata.description = patch.value.description;
      }
      break;
    case "updateObject":
      next.objects = next.objects.map((object) => (object.id === patch.targetId ? { ...object, ...patch.value } : object));
      break;
    case "removeObject":
      next.objects = next.objects.filter((object) => object.id !== patch.targetId);
      break;
  }
  next.updatedAt = new Date().toISOString();
  return { project: next, issues: [] };
}

