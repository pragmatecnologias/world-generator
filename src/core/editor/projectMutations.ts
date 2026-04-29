import type { AssetDefinition, WorldProject } from "../../types";
import type { TerrainData } from "../../types";
import { flattenRoadTerrain, terrainSlopeAt, terrainWorldToGrid } from "../../viewport/terrain";
import * as THREE from "three";

export function buildImportedAssetDefinition(fileName: string, dataUrl: string, thumbnailPath: string): AssetDefinition {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return {
    id: crypto.randomUUID(),
    name: baseName,
    category: "Imported",
    filePath: fileName,
    fileDataUrl: dataUrl,
    defaultScale: 1,
    collisionType: "box",
    canPaint: true,
    tags: ["imported"],
    thumbnailPath,
    sourceType: fileName.endsWith(".gltf") ? "gltf" : "glb",
    importedAt: new Date().toISOString(),
    placementRules: {
      paintEligible: true,
      scatterEligible: true,
      alignToTerrain: true,
      minScale: 0.75,
      maxScale: 1.5,
    },
    bounds: { width: 1, height: 1, depth: 1 },
  };
}

export function appendImportedAsset(project: WorldProject, asset: AssetDefinition): WorldProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    assets: [...project.assets, asset],
  };
}

export function duplicateObjectById(project: WorldProject, objectId: string): WorldProject {
  const object = project.objects.find((entry) => entry.id === objectId);
  if (!object) return project;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    objects: [
      ...project.objects,
      {
        ...object,
        id: crypto.randomUUID(),
        name: `${object.name} Copy`,
        position: { x: object.position.x + 2, y: object.position.y, z: object.position.z + 2 },
      },
    ],
  };
}

export function deleteObjectById(project: WorldProject, objectId: string): WorldProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    objects: project.objects.filter((object) => object.id !== objectId),
  };
}

export function patchObjectById(project: WorldProject, objectId: string, patch: Partial<WorldProject["objects"][number]>): WorldProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    objects: project.objects.map((object) => (object.id === objectId ? { ...object, ...patch } : object)),
  };
}

export function patchAssetById(project: WorldProject, assetId: string, patch: Partial<AssetDefinition>): WorldProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    assets: project.assets.map((asset) => (asset.id === assetId ? { ...asset, ...patch } : asset)),
  };
}

export function patchRoadById(project: WorldProject, roadId: string, patch: Partial<WorldProject["roads"][number]>): WorldProject {
  const updatedRoads = project.roads.map((road) => (road.id === roadId ? { ...road, ...patch } : road));
  const updatedRoad = updatedRoads.find((road) => road.id === roadId);
  const terrain = updatedRoad?.flattenTerrain ? flattenRoadTerrain(project.terrain, updatedRoads) : project.terrain;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    roads: updatedRoads,
    terrain,
  };
}

export const patchPathById = patchRoadById;
export const updatePathById = patchRoadById;

export function patchRoadPointById(
  project: WorldProject,
  roadId: string,
  pointIndex: number,
  patch: Partial<WorldProject["roads"][number]["points"][number]>,
): WorldProject {
  const updatedRoads = project.roads.map((road) =>
    road.id === roadId
      ? {
          ...road,
          points: road.points.map((point, index) => (index === pointIndex ? { ...point, ...patch } : point)),
        }
      : road,
  );
  const updatedRoad = updatedRoads.find((road) => road.id === roadId);
  const terrain = updatedRoad?.flattenTerrain ? flattenRoadTerrain(project.terrain, updatedRoads) : project.terrain;
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    roads: updatedRoads,
    terrain,
  };
}

export const patchPathPointById = patchRoadPointById;
export const updatePathPointById = patchRoadPointById;

export function generateScatterForZone(
  project: WorldProject,
  zoneId: string,
  seed: string,
): WorldProject {
  const zone = project.scatterZones.find((entry) => entry.id === zoneId);
  if (!zone || zone.points.length < 2) return project;
  const [a, b] = zone.points;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minZ = Math.min(a.z, b.z);
  const maxZ = Math.max(a.z, b.z);
  const assets = zone.assetIds.length > 0 ? zone.assetIds : project.assets.filter((asset) => asset.canPaint).map((asset) => asset.id);
  const rng = mulberry32(hashSeed(seed));
  const generatedObjects = Array.from({ length: zone.settings.count }, () => {
    const assetId = assets[Math.floor(rng() * assets.length)];
    const asset = project.assets.find((entry) => entry.id === assetId) ?? project.assets[0];
    if (!asset) return null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const x = minX + rng() * (maxX - minX);
      const z = minZ + rng() * (maxZ - minZ);
      const grid = terrainWorldToGrid(new THREE.Vector3(x, 0, z), project.terrain);
      const y = project.terrain.heights[grid.index] ?? 0;
      const slope = terrainSlopeAt(new THREE.Vector3(x, y, z), project.terrain);
      if (zone.settings.slopeLimit > 0 && slope > zone.settings.slopeLimit) continue;
      if (zone.settings.minSpacing > 0) {
        const tooClose = project.objects.some((object) => Math.hypot(object.position.x - x, object.position.z - z) < zone.settings.minSpacing);
        if (tooClose) continue;
      }
      return {
        id: crypto.randomUUID(),
        assetId,
        name: `${asset.name} Scatter`,
        position: { x, y, z },
        rotation: { x: 0, y: zone.settings.randomRotation ? rng() * Math.PI * 2 : 0, z: 0 },
        scale: {
          x: zone.settings.randomScaleMin + rng() * (zone.settings.randomScaleMax - zone.settings.randomScaleMin),
          y: zone.settings.randomScaleMin + rng() * (zone.settings.randomScaleMax - zone.settings.randomScaleMin),
          z: zone.settings.randomScaleMin + rng() * (zone.settings.randomScaleMax - zone.settings.randomScaleMin),
        },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: false,
      };
    }
    return null;
  }).filter(Boolean);

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    objects: [...project.objects, ...(generatedObjects as WorldProject["objects"])],
    scatterZones: project.scatterZones.map((entry) =>
      entry.id === zone.id ? { ...entry, generatedObjectIds: [...entry.generatedObjectIds, ...(generatedObjects as WorldProject["objects"]).map((item) => item.id)] } : entry,
    ),
  };
}

export const generateZoneForProject = generateScatterForZone;
export const generatePlacementZoneForProject = generateScatterForZone;

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
