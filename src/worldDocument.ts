import * as THREE from "three";
import type {
  AssetDefinition,
  EnvironmentSettings,
  FoliageGroup,
  GameplayMarker,
  LayerDefinition,
  PlacedObject,
  RoadDefinition,
  ScatterZone,
  TerrainData,
  TerrainMaterial,
  WorldProject,
} from "./types";
import { applyTerrainBrush } from "./viewport/terrain";

export const WORLD_DOCUMENT_SCHEMA_VERSION = "1.0.0";

export type WorldDocument = {
  schemaVersion: string;
  project: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    units: "meters";
    version: string;
  };
  terrain: TerrainData & {
    id: string;
    heightScale: number;
    heightEncoding: "array";
    materialEncoding: "splatmap";
    baseMaterialId: string;
  };
  materials: TerrainMaterial[];
  assets: AssetDefinition[];
  objects: PlacedObject[];
  foliage: FoliageGroup[];
  scatter: ScatterZone[];
  roads: RoadDefinition[];
  markers: GameplayMarker[];
  layers: LayerDefinition[];
  environment: EnvironmentSettings;
  metadata: {
    createdBy: string;
    lastEditedBy: string;
    tags: string[];
  };
  validation: {
    lastRunAt?: string;
    status?: "REAL" | "PARTIAL" | "FAKE" | "MISSING";
    issues?: string[];
  };
};

export type WorldOperation =
  | { type: "createWorld"; payload: WorldDocument }
  | { type: "updateProjectMetadata"; payload: Partial<WorldDocument["project"]> }
  | { type: "updateTerrainSettings"; payload: Partial<WorldDocument["terrain"]> }
  | { type: "applyTerrainHeightPatch"; payload: { mode: "raise" | "lower" | "smooth" | "flatten"; center: { x: number; z: number }; radius: number; strength: number; falloff: "linear" | "smooth" | "hard"; flattenHeight?: number } }
  | { type: "applyTerrainMaterialPatch"; payload: { materialId: string; center: { x: number; z: number }; radius: number; strength: number; falloff: "linear" | "smooth" | "hard" } }
  | { type: "addMaterial"; payload: TerrainMaterial }
  | { type: "updateMaterial"; targetId: string; payload: Partial<TerrainMaterial> }
  | { type: "removeMaterial"; targetId: string }
  | { type: "addAsset"; payload: AssetDefinition }
  | { type: "updateAsset"; targetId: string; payload: Partial<AssetDefinition> }
  | { type: "removeAsset"; targetId: string }
  | { type: "addObject"; payload: PlacedObject }
  | { type: "updateObject"; targetId: string; payload: Partial<PlacedObject> }
  | { type: "removeObject"; targetId: string }
  | { type: "duplicateObject"; targetId: string; payload?: { id?: string; offset?: { x: number; y: number; z: number } } }
  | { type: "moveObject"; targetId: string; payload: { x: number; y: number; z: number } }
  | { type: "rotateObject"; targetId: string; payload: { x: number; y: number; z: number } }
  | { type: "scaleObject"; targetId: string; payload: { x: number; y: number; z: number } }
  | { type: "addFoliageGroup"; payload: FoliageGroup }
  | { type: "updateFoliageGroup"; targetId: string; payload: Partial<FoliageGroup> }
  | { type: "removeFoliageGroup"; targetId: string }
  | { type: "addFoliageInstances"; targetId: string; payload: FoliageGroup["instances"] }
  | { type: "removeFoliageInstances"; targetId: string; payload: { ids: string[] } }
  | { type: "addScatterZone"; payload: ScatterZone }
  | { type: "updateScatterZone"; targetId: string; payload: Partial<ScatterZone> }
  | { type: "removeScatterZone"; targetId: string }
  | { type: "addRoad"; payload: RoadDefinition }
  | { type: "updateRoad"; targetId: string; payload: Partial<RoadDefinition> }
  | { type: "removeRoad"; targetId: string }
  | { type: "addRoadPoint"; targetId: string; payload: { x: number; y: number; z: number } }
  | { type: "updateRoadPoint"; targetId: string; payload: { index: number; point: { x: number; y: number; z: number } } }
  | { type: "removeRoadPoint"; targetId: string; payload: { index: number } }
  | { type: "addMarker"; payload: GameplayMarker }
  | { type: "updateMarker"; targetId: string; payload: Partial<GameplayMarker> }
  | { type: "removeMarker"; targetId: string }
  | { type: "addLayer"; payload: LayerDefinition }
  | { type: "updateLayer"; targetId: string; payload: Partial<LayerDefinition> }
  | { type: "removeLayer"; targetId: string }
  | { type: "setLayerVisibility"; targetId: string; payload: { visible: boolean } }
  | { type: "setLayerLocked"; targetId: string; payload: { locked: boolean } }
  | { type: "updateEnvironment"; payload: Partial<EnvironmentSettings> };

export function worldProjectToDocument(project: WorldProject): WorldDocument {
  return {
    schemaVersion: WORLD_DOCUMENT_SCHEMA_VERSION,
    project: {
      id: project.id,
      name: project.name,
      description: project.metadata.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      units: "meters",
      version: project.version,
    },
    terrain: {
      ...project.terrain,
      id: "terrain_main",
      heightScale: 40,
      heightEncoding: "array",
      materialEncoding: "splatmap",
      baseMaterialId: project.materials[0]?.id ?? "grass",
    },
    materials: project.materials,
    assets: project.assets,
    objects: project.objects,
    foliage: project.foliageGroups,
    scatter: project.scatterZones,
    roads: project.roads,
    markers: project.markers,
    layers: project.layers,
    environment: project.environment,
    metadata: {
      createdBy: "world-creator",
      lastEditedBy: "human-or-ai",
      tags: [],
    },
    validation: {},
  };
}

export function worldDocumentToProject(document: WorldDocument): WorldProject {
  return {
    id: document.project.id,
    name: document.project.name,
    version: document.project.version,
    createdAt: document.project.createdAt,
    updatedAt: document.project.updatedAt,
    terrain: {
      width: document.terrain.width,
      depth: document.terrain.depth,
      resolution: document.terrain.resolution,
      heights: document.terrain.heights,
      materialMap: document.terrain.materialMap,
    },
    materials: document.materials,
    assets: document.assets,
    objects: document.objects,
    foliageGroups: document.foliage,
    scatterZones: document.scatter,
    roads: document.roads,
    markers: document.markers,
    layers: document.layers,
    environment: document.environment,
    metadata: {
      description: document.project.description,
    },
  };
}

export function validateWorldDocumentIntegrity(document: WorldDocument): string[] {
  const issues: string[] = [];
  const assetIds = new Set(document.assets.map((asset) => asset.id));
  const layerIds = new Set(document.layers.map((layer) => layer.id));
  const materialIds = new Set(document.materials.map((material) => material.id));
  const seenIds = new Set<string>();

  const ensureUnique = (id: string, label: string) => {
    if (seenIds.has(id)) issues.push(`duplicate id: ${label}:${id}`);
    seenIds.add(id);
  };

  document.objects.forEach((object) => {
    ensureUnique(object.id, "object");
    if (!assetIds.has(object.assetId)) issues.push(`object ${object.id} missing asset ${object.assetId}`);
    if (!layerIds.has(object.layerId)) issues.push(`object ${object.id} missing layer ${object.layerId}`);
  });
  document.foliage.forEach((group) => {
    ensureUnique(group.id, "foliage-group");
    group.instances.forEach((instance) => {
      ensureUnique(instance.id, "foliage-instance");
      if (!assetIds.has(instance.assetId)) issues.push(`foliage instance ${instance.id} missing asset ${instance.assetId}`);
    });
  });
  document.scatter.forEach((zone) => {
    ensureUnique(zone.id, "scatter-zone");
    zone.generatedObjectIds.forEach((id) => {
      if (!document.objects.some((object) => object.id === id)) issues.push(`scatter zone ${zone.id} missing generated object ${id}`);
    });
  });
  document.roads.forEach((road) => {
    ensureUnique(road.id, "road");
    if (!materialIds.has(road.materialId)) issues.push(`road ${road.id} missing material ${road.materialId}`);
  });
  document.markers.forEach((marker) => ensureUnique(marker.id, "marker"));
  document.layers.forEach((layer) => ensureUnique(layer.id, "layer"));

  const expected = document.terrain.resolution * document.terrain.resolution;
  if (document.terrain.heights.length !== expected) issues.push("terrain heightData length mismatch resolution");
  if (document.terrain.materialMap.length !== expected) issues.push("terrain materialMap length mismatch resolution");

  return issues;
}

export function applyWorldOperation(document: WorldDocument, operation: WorldOperation): WorldDocument {
  const next = structuredClone(document);
  const touch = () => {
    next.project.updatedAt = new Date().toISOString();
    next.metadata.lastEditedBy = "human-or-ai";
  };

  switch (operation.type) {
    case "createWorld":
      return structuredClone(operation.payload);
    case "updateProjectMetadata":
      Object.assign(next.project, operation.payload);
      break;
    case "updateTerrainSettings":
      Object.assign(next.terrain, operation.payload);
      break;
    case "applyTerrainHeightPatch": {
      const brushed = applyTerrainBrush(
        next.terrain,
        new THREE.Vector3(operation.payload.center.x, 0, operation.payload.center.z),
        {
          size: operation.payload.radius,
          strength: operation.payload.strength,
          falloff: operation.payload.falloff,
          materialId: next.terrain.baseMaterialId,
          flattenHeight: operation.payload.flattenHeight,
        },
        operation.payload.mode,
      );
      next.terrain = { ...next.terrain, ...brushed };
      break;
    }
    case "applyTerrainMaterialPatch":
      {
        const brushed = applyTerrainBrush(
        next.terrain,
        new THREE.Vector3(operation.payload.center.x, 0, operation.payload.center.z),
        {
          size: operation.payload.radius,
          strength: operation.payload.strength,
          falloff: operation.payload.falloff,
          materialId: operation.payload.materialId,
        },
        "paint",
      );
        next.terrain = { ...next.terrain, ...brushed };
      }
      break;
    case "addMaterial":
      next.materials.push(operation.payload);
      break;
    case "updateMaterial":
      next.materials = next.materials.map((material) => (material.id === operation.targetId ? { ...material, ...operation.payload } : material));
      break;
    case "removeMaterial":
      next.materials = next.materials.filter((material) => material.id !== operation.targetId);
      break;
    case "addAsset":
      next.assets.push(operation.payload);
      break;
    case "updateAsset":
      next.assets = next.assets.map((asset) => (asset.id === operation.targetId ? { ...asset, ...operation.payload } : asset));
      break;
    case "removeAsset":
      next.assets = next.assets.filter((asset) => asset.id !== operation.targetId);
      break;
    case "addObject":
      next.objects.push(operation.payload);
      break;
    case "updateObject":
      next.objects = next.objects.map((object) => (object.id === operation.targetId ? { ...object, ...operation.payload } : object));
      break;
    case "removeObject":
      next.objects = next.objects.filter((object) => object.id !== operation.targetId);
      break;
    case "duplicateObject": {
      const object = next.objects.find((entry) => entry.id === operation.targetId);
      if (object) {
        const offset = operation.payload?.offset ?? { x: 2, y: 0, z: 2 };
        next.objects.push({
          ...object,
          id: operation.payload?.id ?? crypto.randomUUID(),
          name: `${object.name} Copy`,
          position: {
            x: object.position.x + offset.x,
            y: object.position.y + offset.y,
            z: object.position.z + offset.z,
          },
        });
      }
      break;
    }
    case "moveObject":
      next.objects = next.objects.map((object) => (object.id === operation.targetId ? { ...object, position: operation.payload } : object));
      break;
    case "rotateObject":
      next.objects = next.objects.map((object) => (object.id === operation.targetId ? { ...object, rotation: operation.payload } : object));
      break;
    case "scaleObject":
      next.objects = next.objects.map((object) => (object.id === operation.targetId ? { ...object, scale: operation.payload } : object));
      break;
    case "addFoliageGroup":
      next.foliage.push(operation.payload);
      break;
    case "updateFoliageGroup":
      next.foliage = next.foliage.map((group) => (group.id === operation.targetId ? { ...group, ...operation.payload } : group));
      break;
    case "removeFoliageGroup":
      next.foliage = next.foliage.filter((group) => group.id !== operation.targetId);
      break;
    case "addFoliageInstances":
      next.foliage = next.foliage.map((group) => (group.id === operation.targetId ? { ...group, instances: [...group.instances, ...operation.payload] } : group));
      break;
    case "removeFoliageInstances":
      next.foliage = next.foliage.map((group) => (group.id === operation.targetId ? { ...group, instances: group.instances.filter((entry) => !operation.payload.ids.includes(entry.id)) } : group));
      break;
    case "addScatterZone":
      next.scatter.push(operation.payload);
      break;
    case "updateScatterZone":
      next.scatter = next.scatter.map((zone) => (zone.id === operation.targetId ? { ...zone, ...operation.payload } : zone));
      break;
    case "removeScatterZone":
      next.scatter = next.scatter.filter((zone) => zone.id !== operation.targetId);
      break;
    case "addRoad":
      next.roads.push(operation.payload);
      break;
    case "updateRoad":
      next.roads = next.roads.map((road) => (road.id === operation.targetId ? { ...road, ...operation.payload } : road));
      break;
    case "removeRoad":
      next.roads = next.roads.filter((road) => road.id !== operation.targetId);
      break;
    case "addRoadPoint":
      next.roads = next.roads.map((road) => (road.id === operation.targetId ? { ...road, points: [...road.points, operation.payload] } : road));
      break;
    case "updateRoadPoint":
      next.roads = next.roads.map((road) =>
        road.id === operation.targetId
          ? { ...road, points: road.points.map((point, index) => (index === operation.payload.index ? operation.payload.point : point)) }
          : road,
      );
      break;
    case "removeRoadPoint":
      next.roads = next.roads.map((road) => (road.id === operation.targetId ? { ...road, points: road.points.filter((_, index) => index !== operation.payload.index) } : road));
      break;
    case "addMarker":
      next.markers.push(operation.payload);
      break;
    case "updateMarker":
      next.markers = next.markers.map((marker) => (marker.id === operation.targetId ? { ...marker, ...operation.payload } : marker));
      break;
    case "removeMarker":
      next.markers = next.markers.filter((marker) => marker.id !== operation.targetId);
      break;
    case "addLayer":
      next.layers.push(operation.payload);
      break;
    case "updateLayer":
      next.layers = next.layers.map((layer) => (layer.id === operation.targetId ? { ...layer, ...operation.payload } : layer));
      break;
    case "removeLayer":
      next.layers = next.layers.filter((layer) => layer.id !== operation.targetId);
      break;
    case "setLayerVisibility":
      next.layers = next.layers.map((layer) => (layer.id === operation.targetId ? { ...layer, visible: operation.payload.visible } : layer));
      break;
    case "setLayerLocked":
      next.layers = next.layers.map((layer) => (layer.id === operation.targetId ? { ...layer, locked: operation.payload.locked } : layer));
      break;
    case "updateEnvironment":
      next.environment = { ...next.environment, ...operation.payload };
      break;
  }

  touch();
  return next;
}
