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
  ShowcaseLayoutConfig,
  WorldProject,
} from "./types";
import { applyTerrainBrush } from "./viewport/terrain";

export type PathDefinition = RoadDefinition;
export type ZoneDefinition = ScatterZone;
export type PlacementGroupDefinition = FoliageGroup;

export const WORLD_DOCUMENT_SCHEMA_VERSION = "2.0.0";

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
  placementGroups: FoliageGroup[];
  zones: ScatterZone[];
  paths: RoadDefinition[];
  markers: GameplayMarker[];
  layers: LayerDefinition[];
  environment: EnvironmentSettings;
  metadata: {
    createdBy: string;
    lastEditedBy: string;
    tags: string[];
    showcaseLayout?: ShowcaseLayoutConfig;
  };
  /** @deprecated legacy compatibility alias populated for older code paths. */
  foliage?: FoliageGroup[];
  /** @deprecated legacy compatibility alias populated for older code paths. */
  scatter?: ScatterZone[];
  /** @deprecated legacy compatibility alias populated for older code paths. */
  roads?: RoadDefinition[];
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
  const document: WorldDocument = {
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
    placementGroups: project.foliageGroups,
    zones: project.scatterZones,
    paths: project.roads,
    markers: project.markers,
    layers: project.layers,
    environment: project.environment,
    metadata: {
      createdBy: "world-creator",
      lastEditedBy: "human-or-ai",
      tags: project.metadata.tags ?? [],
      showcaseLayout: project.metadata.showcaseLayout,
    },
    validation: {},
  };
  return attachLegacyAliases(document);
}

export function worldProjectToPaths(project: WorldProject): PathDefinition[] {
  return project.roads.map((road) => ({ ...road, points: road.points.map((point) => ({ ...point })) }));
}

export function worldProjectToZones(project: WorldProject): ZoneDefinition[] {
  return project.scatterZones.map((zone) => ({ ...zone, points: zone.points.map((point) => ({ ...point })) }));
}

export function worldProjectToPlacementGroups(project: WorldProject): PlacementGroupDefinition[] {
  return project.foliageGroups.map((group) => ({
    ...group,
    assetIds: [...group.assetIds],
    instances: group.instances.map((instance) => ({
      ...instance,
      position: { ...instance.position },
      rotation: { ...instance.rotation },
      scale: { ...instance.scale },
    })),
    settings: { ...group.settings },
  }));
}

export function worldDocumentToProject(document: WorldDocument): WorldProject {
  const canonical = normalizeWorldDocument(document);
  return {
    id: canonical.project.id,
    name: canonical.project.name,
    version: canonical.project.version,
    createdAt: canonical.project.createdAt,
    updatedAt: canonical.project.updatedAt,
    terrain: {
      width: canonical.terrain.width,
      depth: canonical.terrain.depth,
      resolution: canonical.terrain.resolution,
      heights: canonical.terrain.heights,
      materialMap: canonical.terrain.materialMap,
    },
    materials: canonical.materials,
    assets: canonical.assets,
    objects: canonical.objects,
    foliageGroups: canonical.placementGroups,
    scatterZones: canonical.zones,
    roads: canonical.paths,
    markers: canonical.markers,
    layers: canonical.layers,
    environment: canonical.environment,
    metadata: {
      description: canonical.project.description,
      tags: canonical.metadata.tags,
      showcaseLayout: canonical.metadata.showcaseLayout,
    },
  };
}

export function worldDocumentToPaths(document: WorldDocument): PathDefinition[] {
  return normalizeWorldDocument(document).paths.map((road) => ({ ...road, points: road.points.map((point) => ({ ...point })) }));
}

export function worldDocumentToZones(document: WorldDocument): ZoneDefinition[] {
  return normalizeWorldDocument(document).zones.map((zone) => ({ ...zone, points: zone.points.map((point) => ({ ...point })) }));
}

export function worldDocumentToPlacementGroups(document: WorldDocument): PlacementGroupDefinition[] {
  return normalizeWorldDocument(document).placementGroups.map((group) => ({
    ...group,
    assetIds: [...group.assetIds],
    instances: group.instances.map((instance) => ({
      ...instance,
      position: { ...instance.position },
      rotation: { ...instance.rotation },
      scale: { ...instance.scale },
    })),
    settings: { ...group.settings },
  }));
}

export function validateWorldDocumentIntegrity(document: WorldDocument): string[] {
  const normalized = normalizeWorldDocument(document);
  const issues: string[] = [];
  const assetIds = new Set(normalized.assets.map((asset) => asset.id));
  const layerIds = new Set(normalized.layers.map((layer) => layer.id));
  const materialIds = new Set(normalized.materials.map((material) => material.id));
  const seenIds = new Set<string>();

  const ensureUnique = (id: string, label: string) => {
    if (seenIds.has(id)) issues.push(`duplicate id: ${label}:${id}`);
    seenIds.add(id);
  };

  normalized.objects.forEach((object) => {
    ensureUnique(object.id, "object");
    if (!assetIds.has(object.assetId)) issues.push(`object ${object.id} missing asset ${object.assetId}`);
    if (!layerIds.has(object.layerId)) issues.push(`object ${object.id} missing layer ${object.layerId}`);
  });
  normalized.placementGroups.forEach((group) => {
    ensureUnique(group.id, "foliage-group");
    if (!group.assetIds.length) issues.push(`placement group ${group.id} has no asset ids`);
    group.instances.forEach((instance) => {
      ensureUnique(instance.id, "foliage-instance");
      if (!assetIds.has(instance.assetId)) issues.push(`foliage instance ${instance.id} missing asset ${instance.assetId}`);
    });
  });
  normalized.zones.forEach((zone) => {
    ensureUnique(zone.id, "scatter-zone");
    if (zone.points.length < 3) issues.push(`zone ${zone.id} must have at least 3 points`);
    if (zone.shape !== "circle" && zone.points.length < 4) issues.push(`zone ${zone.id} polygonal shapes should have at least 4 points`);
    zone.generatedObjectIds.forEach((id) => {
      if (!normalized.objects.some((object) => object.id === id)) issues.push(`zone ${zone.id} missing generated object ${id}`);
    });
  });
  normalized.paths.forEach((road) => {
    ensureUnique(road.id, "road");
    if (road.points.length < 2) issues.push(`path ${road.id} must have at least 2 points`);
    if (!materialIds.has(road.materialId)) issues.push(`path ${road.id} missing material ${road.materialId}`);
  });
  normalized.markers.forEach((marker) => ensureUnique(marker.id, "marker"));
  normalized.layers.forEach((layer) => ensureUnique(layer.id, "layer"));

  const expected = normalized.terrain.resolution * normalized.terrain.resolution;
  if (normalized.terrain.heights.length !== expected) issues.push("terrain heightData length mismatch resolution");
  if (normalized.terrain.materialMap.length !== expected) issues.push("terrain materialMap length mismatch resolution");

  return issues;
}

export function normalizeWorldDocument(document: WorldDocument): WorldDocument {
  const paths = document.paths ?? document.roads ?? [];
  const zones = document.zones ?? document.scatter ?? [];
  const placementGroups = document.placementGroups ?? document.foliage ?? [];
  const normalized: WorldDocument = {
    ...document,
    schemaVersion: WORLD_DOCUMENT_SCHEMA_VERSION,
    paths,
    zones,
    placementGroups,
    roads: paths,
    scatter: zones,
    foliage: placementGroups,
  };
  return attachLegacyAliases(normalized);
}

function attachLegacyAliases<T extends WorldDocument>(document: T): T {
  const aliases: Record<string, () => unknown> = {
    roads: () => document.paths,
    scatter: () => document.zones,
    foliage: () => document.placementGroups,
  };
  for (const [key, getter] of Object.entries(aliases)) {
    Object.defineProperty(document, key, {
      enumerable: false,
      configurable: true,
      get: getter,
    });
  }
  return document;
}


export function createWorldOperation(project: WorldProject): WorldOperation {
  return { type: "createWorld", payload: worldProjectToDocument(project) };
}

export function applyWorldOperations(document: WorldDocument, operations: WorldOperation[]): WorldDocument {
  return operations.reduce((state, operation) => applyWorldOperation(state, operation), document);
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
      next.placementGroups.push(operation.payload);
      break;
    case "updateFoliageGroup":
      next.placementGroups = next.placementGroups.map((group) => (group.id === operation.targetId ? { ...group, ...operation.payload } : group));
      break;
    case "removeFoliageGroup":
      next.placementGroups = next.placementGroups.filter((group) => group.id !== operation.targetId);
      break;
    case "addFoliageInstances":
      next.placementGroups = next.placementGroups.map((group) => (group.id === operation.targetId ? { ...group, instances: [...group.instances, ...operation.payload] } : group));
      break;
    case "removeFoliageInstances":
      next.placementGroups = next.placementGroups.map((group) => (group.id === operation.targetId ? { ...group, instances: group.instances.filter((entry) => !operation.payload.ids.includes(entry.id)) } : group));
      break;
    case "addScatterZone":
      next.zones.push(operation.payload);
      break;
    case "updateScatterZone":
      next.zones = next.zones.map((zone) => (zone.id === operation.targetId ? { ...zone, ...operation.payload } : zone));
      break;
    case "removeScatterZone":
      next.zones = next.zones.filter((zone) => zone.id !== operation.targetId);
      break;
    case "addRoad":
      next.paths.push(operation.payload);
      break;
    case "updateRoad":
      next.paths = next.paths.map((road) => (road.id === operation.targetId ? { ...road, ...operation.payload } : road));
      break;
    case "removeRoad":
      next.paths = next.paths.filter((road) => road.id !== operation.targetId);
      break;
    case "addRoadPoint":
      next.paths = next.paths.map((road) => (road.id === operation.targetId ? { ...road, points: [...road.points, operation.payload] } : road));
      break;
    case "updateRoadPoint":
      next.paths = next.paths.map((road) =>
        road.id === operation.targetId
          ? { ...road, points: road.points.map((point, index) => (index === operation.payload.index ? operation.payload.point : point)) }
          : road,
      );
      break;
    case "removeRoadPoint":
      next.paths = next.paths.map((road) => (road.id === operation.targetId ? { ...road, points: road.points.filter((_, index) => index !== operation.payload.index) } : road));
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
