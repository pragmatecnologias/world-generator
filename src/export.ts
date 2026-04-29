import type { WorldExportPackage, WorldProject } from "./types";
import { worldDocumentToProject, worldProjectToDocument, type WorldDocument } from "./core/worldDocument";
import { buildAssetRegistry } from "./core/assets/assetRegistry";

export const WORLD_EXPORT_SCHEMA_VERSION = "1.0.0";

const TYPED_ARRAY_KEY = "__typedArray";
const TYPED_ARRAY_VALUES = ["Float32Array", "Float64Array", "Int32Array", "Uint32Array", "Uint16Array", "Uint8Array", "Int16Array", "Int8Array"];

/** Serialize typed arrays to JSON-compatible format */
function serializeValue(key: string, value: unknown): unknown {
  if (value instanceof Float32Array) return { [TYPED_ARRAY_KEY]: "Float32Array", data: Array.from(value) };
  if (value instanceof Float64Array) return { [TYPED_ARRAY_KEY]: "Float64Array", data: Array.from(value) };
  if (value instanceof Int32Array) return { [TYPED_ARRAY_KEY]: "Int32Array", data: Array.from(value) };
  if (value instanceof Uint32Array) return { [TYPED_ARRAY_KEY]: "Uint32Array", data: Array.from(value) };
  if (value instanceof Int16Array) return { [TYPED_ARRAY_KEY]: "Int16Array", data: Array.from(value) };
  if (value instanceof Uint16Array) return { [TYPED_ARRAY_KEY]: "Uint16Array", data: Array.from(value) };
  if (value instanceof Int8Array) return { [TYPED_ARRAY_KEY]: "Int8Array", data: Array.from(value) };
  if (value instanceof Uint8Array) return { [TYPED_ARRAY_KEY]: "Uint8Array", data: Array.from(value) };
  if (Array.isArray(value)) return value.map((v, i) => serializeValue(String(i), v));
  if (value && typeof value === "object") {
    const obj: Record<string, unknown> = {};
    for (const k of Object.keys(value as object)) {
      obj[k] = serializeValue(k, (value as Record<string, unknown>)[k]);
    }
    return obj;
  }
  return value;
}

/** Deserialize JSON-compatible format back to typed arrays */
function deserializeValue(key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj[TYPED_ARRAY_KEY] && TYPED_ARRAY_VALUES.includes(obj[TYPED_ARRAY_KEY] as string) && Array.isArray(obj.data)) {
      const data = obj.data as number[];
      switch (obj[TYPED_ARRAY_KEY]) {
        case "Float32Array": return new Float32Array(data);
        case "Float64Array": return new Float64Array(data);
        case "Int32Array": return new Int32Array(data);
        case "Uint32Array": return new Uint32Array(data);
        case "Int16Array": return new Int16Array(data);
        case "Uint16Array": return new Uint16Array(data);
        case "Int8Array": return new Int8Array(data);
        case "Uint8Array": return new Uint8Array(data);
      }
    }
  }
  if (Array.isArray(value)) return value.map((v) => deserializeValue("", v));
  return value;
}

/** Reviver function for JSON.parse to restore typed arrays */
function jsonReviver(_key: string, value: unknown): unknown {
  return deserializeValue("", value);
}

/** Replacer function for JSON.stringify to serialize typed arrays */
function jsonReplacer(_key: string, value: unknown): unknown {
  return serializeValue("", value);
}

function downloadJson(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function buildWorldExportPackage(project: WorldProject): WorldExportPackage {
  const worldDocument = worldProjectToDocument(project);
  const assetRegistry = buildAssetRegistry(project.assets);
  return {
    packageType: "world-export",
    schemaVersion: WORLD_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    version: project.version,
    project,
    worldDocument,
    assetManifest: project.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      filePath: asset.filePath,
      sourceType: asset.sourceType ?? (asset.filePath === "built-in" ? "builtin" : asset.filePath.endsWith(".gltf") ? "gltf" : "glb"),
      defaultScale: asset.defaultScale,
      collisionType: asset.collisionType,
      canPaint: asset.canPaint,
      tags: asset.tags,
      hasSourceData: Boolean(asset.fileDataUrl),
      bounds: asset.bounds ?? { width: 1, height: 1, depth: 1 },
      placementRules: asset.placementRules ?? assetRegistry.byId[asset.id]?.placementRules,
    })),
    summary: {
      terrainHeights: project.terrain.heights.length,
      terrainMaterials: project.terrain.materialMap.length,
      assets: project.assets.length,
      objects: project.objects.length,
      foliageInstances: project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0),
      scatterZones: project.scatterZones.length,
      roads: project.roads.length,
      markers: project.markers.length,
    },
    proof: {
      generatedBy: "editor",
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
  };
}

export function exportWorld(project: WorldProject) {
  const packagePayload = buildWorldExportPackage(project);
  localStorage.setItem("world-generator.last-export", JSON.stringify(packagePayload, jsonReplacer));
  downloadJson(`${project.name.replace(/\s+/g, "-").toLowerCase()}-world.json`, packagePayload);
}

export function saveProjectToStorage(project: WorldProject) {
  localStorage.setItem("world-generator.project", JSON.stringify(project, jsonReplacer));
}

export function loadProjectFromStorage(): WorldProject | null {
  const raw = localStorage.getItem("world-generator.project");
  if (!raw) return null;
  try {
    return JSON.parse(raw, jsonReviver) as WorldProject;
  } catch {
    return null;
  }
}

export function loadLastExportPackage(): WorldExportPackage | null {
  const raw = localStorage.getItem("world-generator.last-export");
  if (!raw) return null;
  try {
    return JSON.parse(raw, jsonReviver) as WorldExportPackage;
  } catch {
    return null;
  }
}

export function parseWorldPayload(raw: string): WorldProject | WorldExportPackage | null {
  try {
    return JSON.parse(raw, jsonReviver) as WorldProject | WorldExportPackage;
  } catch {
    return null;
  }
}

export function resolveWorldProject(payload: WorldProject | WorldExportPackage): WorldProject {
  if ("packageType" in payload && payload.packageType === "world-export") {
    if (payload.worldDocument) {
      try {
        return worldDocumentToProject(payload.worldDocument as WorldDocument);
      } catch {
        return payload.project;
      }
    }
    return payload.project;
  }
  return payload as WorldProject;
}

export function validateExportPackage(payload: WorldExportPackage): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (payload.packageType !== "world-export") errors.push("packageType must be world-export");
  if (!payload.schemaVersion) errors.push("schemaVersion is required");
  if (!payload.project) errors.push("project is required");
  if (!payload.assetManifest) errors.push("assetManifest is required");
  if (!payload.summary) errors.push("summary is required");
  if (!payload.project?.terrain?.heights?.length) errors.push("terrain.heights missing");
  if (!payload.project?.terrain?.materialMap?.length) errors.push("terrain.materialMap missing");
  if (!payload.project?.objects) errors.push("objects missing");
  if (!payload.project?.roads) errors.push("roads missing");
  if (!payload.project?.foliageGroups) errors.push("foliageGroups missing");
  if (!payload.project?.markers) errors.push("markers missing");
  if (!payload.project?.layers) errors.push("layers missing");
  if (!payload.project?.environment) errors.push("environment missing");
  return { valid: errors.length === 0, errors };
}
