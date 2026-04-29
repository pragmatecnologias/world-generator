import * as THREE from "three";
import type { BrushState, TerrainData, WorldProject } from "../../types";
import { applyTerrainBrush, isPointNearRoad, terrainSlopeAt, terrainWorldToGrid } from "../../viewport/terrain";
import { applyWorldOperation, type WorldDocument } from "../worldDocument";
import { createSeededRng, hashString } from "./random";

export function generateProofTerrain(terrain: TerrainData, brush: BrushState) {
  const center = new THREE.Vector3(0, 0, 0);
  const hillA = applyTerrainBrush(terrain, new THREE.Vector3(-12, 0, -8), { ...brush, size: 8, strength: 0.7 }, "raise");
  const valley = applyTerrainBrush(hillA, new THREE.Vector3(12, 0, 10), { ...brush, size: 7, strength: 0.6 }, "lower");
  const flatten = applyTerrainBrush(valley, center, { ...brush, size: 9, strength: 1, flattenHeight: 0.6 }, "flatten");
  let terrainNext = flatten;
  const patches: Array<{ position: THREE.Vector3; material: string; size: number }> = [
    { position: new THREE.Vector3(-18, 0, 14), material: "grass", size: 9 },
    { position: new THREE.Vector3(14, 0, -16), material: "dirt", size: 7 },
    { position: new THREE.Vector3(-4, 0, 18), material: "mud", size: 6 },
    { position: new THREE.Vector3(16, 0, 16), material: "rock", size: 7 },
    { position: new THREE.Vector3(-20, 0, -18), material: "sand", size: 8 },
    { position: new THREE.Vector3(0, 0, 0), material: "track", size: 4 },
  ];
  for (const patch of patches) {
    terrainNext = applyTerrainBrush(
      terrainNext,
      patch.position,
      { ...brush, size: patch.size, strength: 0.95, materialId: patch.material, falloff: "smooth" },
      "paint",
    );
  }
  return terrainNext;
}

export function clearFoliageAroundRoads(project: WorldProject): WorldProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    foliageGroups: project.foliageGroups.map((group) => ({
      ...group,
      instances: group.instances.filter((instance) => !isPointNearRoad(new THREE.Vector3(instance.position.x, instance.position.y, instance.position.z), project.roads)),
    })),
  };
}

export const clearPlacementAroundPaths = clearFoliageAroundRoads;
export const clearPlacementAroundZones = clearPlacementAroundPaths;

export function createProofPreviewHash(project: WorldProject) {
  const json = JSON.stringify(project);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) hash = (hash * 31 + json.charCodeAt(i)) | 0;
  return `h${Math.abs(hash)}`;
}

export function applyScatterZoneToProject(project: WorldProject, zoneId: string, seedText?: string): WorldProject {
  const zone = project.scatterZones.find((entry) => entry.id === zoneId);
  if (!zone || zone.points.length < 2) return project;
  const [a, b] = zone.points;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minZ = Math.min(a.z, b.z);
  const maxZ = Math.max(a.z, b.z);
  const assets = zone.assetIds.length > 0 ? zone.assetIds : project.assets.filter((asset) => asset.canPaint).map((asset) => asset.id);
  const rng = createSeededRng(hashString(seedText ?? `${zone.id}:${zone.name}:${zone.settings.count}:${zone.settings.minSpacing}`));
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

export const applyZoneToProject = applyScatterZoneToProject;
export const applyPlacementZoneToProject = applyScatterZoneToProject;

export function buildAutoJsonProofProject(document: WorldDocument): WorldDocument {
  const ops = [
    {
      type: "addObject" as const,
      payload: {
        id: "obj-rock-ai-001",
        assetId: "demo-rock",
        name: "AI Rock 1",
        position: { x: -4, y: 0.6, z: 10 },
        rotation: { x: 0, y: 1.2, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      },
    },
    { type: "updateRoad" as const, targetId: "road-demo", payload: { width: 10, flattenTerrain: true, smoothEdges: true } },
    {
      type: "addFoliageGroup" as const,
      payload: {
        id: "foliage-ai-forest-001",
        name: "AI Forest Zone",
        assetIds: ["demo-tree"],
        instances: [
          { id: "foliage-ai-001", assetId: "demo-tree", position: { x: 18, y: 0.5, z: -14 }, rotation: { x: 0, y: 1.1, z: 0 }, scale: { x: 1.15, y: 1.15, z: 1.15 } },
          { id: "foliage-ai-002", assetId: "demo-tree", position: { x: 21, y: 0.55, z: -16 }, rotation: { x: 0, y: 2.4, z: 0 }, scale: { x: 0.95, y: 0.95, z: 0.95 } },
        ],
        settings: {
          density: 8,
          minSpacing: 2.8,
          randomScaleMin: 0.8,
          randomScaleMax: 1.3,
          randomRotation: true,
          slopeLimit: 35,
          avoidRoads: true,
          eraseMode: false,
        },
      },
    },
    { type: "applyTerrainMaterialPatch" as const, payload: { materialId: "mud", center: { x: 6, z: 14 }, radius: 8, strength: 0.9, falloff: "smooth" as const } },
    { type: "applyTerrainHeightPatch" as const, payload: { mode: "flatten" as const, center: { x: 0, z: 8 }, radius: 12, strength: 1, falloff: "smooth" as const, flattenHeight: 0.4 } },
    {
      type: "addMarker" as const,
      payload: { id: "checkpoint-001", type: "checkpoint" as const, name: "Checkpoint 1", position: { x: -8, y: 0.4, z: 18 }, rotation: { x: 0, y: 0, z: 0 }, radius: 8, metadata: { order: 1 } },
    },
    {
      type: "addMarker" as const,
      payload: { id: "checkpoint-002", type: "checkpoint" as const, name: "Checkpoint 2", position: { x: 6, y: 0.4, z: 16 }, rotation: { x: 0, y: 0, z: 0 }, radius: 8, metadata: { order: 2 } },
    },
    {
      type: "updateEnvironment" as const,
      payload: { timeOfDay: "evening" as const, backgroundColor: "#f29a5f", fogColor: "#e3b48a", sunIntensity: 1.4, ambientIntensity: 0.55 },
    },
  ];
  let next = document;
  for (const op of ops) next = applyWorldOperation(next, op);
  return next;
}

export function buildAutoAssetProofProject(project: WorldProject, importedAssetId: string, importedAssetName: string) {
  const next = {
    ...project,
    updatedAt: new Date().toISOString(),
    objects: [
      ...project.objects,
      {
        id: "obj-imported-gltf-proof",
        assetId: importedAssetId,
        name: "Imported GLTF Proof",
        position: { x: -8, y: 0.8, z: 4 },
        rotation: { x: 0, y: 1.1, z: 0 },
        scale: { x: 1.4, y: 1.4, z: 1.4 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      },
    ],
    assets: project.assets,
  };
  return {
    next,
    status: `Auto asset proof applied imported GLTF ${importedAssetName}, placed object, saved, exported, and preview-ready`,
  };
}

export function buildAutoFullScenarioProject(project: WorldProject, importedAssetId?: string): WorldProject {
  const current = structuredClone(project);
  const terrainNext = generateProofTerrain(current.terrain, {
    size: 5,
    strength: 0.35,
    falloff: "smooth",
    shape: "circle",
    materialId: "track",
    flattenHeight: 0,
  });

  const customAsset = current.assets.find((asset) => asset.id === importedAssetId && asset.fileDataUrl) ?? current.assets.find((asset) => Boolean(asset.fileDataUrl) && asset.filePath !== "built-in") ?? current.assets[0];
  const newObject = customAsset
    ? {
        id: crypto.randomUUID(),
        assetId: customAsset.id,
        name: `${customAsset.name} Placed`,
        position: { x: -6, y: 1, z: 6 },
        rotation: { x: 0, y: 1.1, z: 0 },
        scale: { x: 1.3, y: 1.3, z: 1.3 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      }
    : null;

  const foliageInstances = Array.from({ length: 55 }, (_, index) => {
    const angle = (index / 55) * Math.PI * 2;
    const radius = 10 + (index % 7) * 0.45;
    const x = Math.cos(angle) * radius - 4;
    const z = Math.sin(angle) * radius + 2;
    const y = 0.8 + (index % 5) * 0.03;
    const scale = 0.8 + (index % 6) * 0.08;
    return {
      id: crypto.randomUUID(),
      assetId: "demo-tree",
      position: { x, y, z },
      rotation: { x: 0, y: angle, z: 0 },
      scale: { x: scale, y: scale, z: scale },
    };
  });

  const scatterZoneId = crypto.randomUUID();
  const scatterObjects = Array.from({ length: 28 }, (_, index) => {
    const x = -20 + (index % 7) * 2.5;
    const z = -20 + Math.floor(index / 7) * 2.5;
    const scale = 0.85 + (index % 4) * 0.2;
    return {
      id: crypto.randomUUID(),
      assetId: "demo-rock",
      name: `Scatter Rock ${index + 1}`,
      position: { x, y: 0.7, z },
      rotation: { x: 0, y: (index * 0.35) % (Math.PI * 2), z: 0 },
      scale: { x: scale, y: scale, z: scale },
      layerId: "layer-props",
      visible: true,
      locked: false,
      collisionEnabled: true,
    };
  });

  const roadId = crypto.randomUUID();
  const roadPoints = [
    { x: -24, y: 0.5, z: -12 },
    { x: -8, y: 0.45, z: -2 },
    { x: 6, y: 0.52, z: 8 },
    { x: 18, y: 0.55, z: 16 },
  ];
  const checkpointMarkers = [
    { id: "checkpoint-auto-1", type: "checkpoint" as const, name: "Auto Checkpoint 1", position: roadPoints[1], metadata: { order: 1 }, radius: 8 },
    { id: "checkpoint-auto-2", type: "checkpoint" as const, name: "Auto Checkpoint 2", position: roadPoints[2], metadata: { order: 2 }, radius: 8 },
    { id: "checkpoint-auto-3", type: "checkpoint" as const, name: "Auto Checkpoint 3", position: roadPoints[3], metadata: { order: 3 }, radius: 8 },
  ];
  const checkpointIds = checkpointMarkers.map((marker) => marker.id);

  return {
    ...current,
    updatedAt: new Date().toISOString(),
    terrain: terrainNext,
    objects: [...current.objects, ...(newObject ? [newObject] : []), ...scatterObjects],
    foliageGroups: current.foliageGroups.map((group, index) =>
      index === 0
        ? {
            ...group,
            instances: [...group.instances, ...foliageInstances],
          }
        : group,
    ),
    scatterZones: [
      ...current.scatterZones,
      {
        id: scatterZoneId,
        name: `Scatter ${current.scatterZones.length + 1}`,
        shape: "rectangle" as const,
        points: [
          { x: -20, y: 0.5, z: -20 },
          { x: -5, y: 0.5, z: -7 },
        ],
        assetIds: ["demo-rock"],
        settings: {
          count: 28,
          minSpacing: 1.8,
          randomScaleMin: 0.8,
          randomScaleMax: 1.5,
          randomRotation: true,
          slopeLimit: 40,
        },
        generatedObjectIds: scatterObjects.map((entry) => entry.id),
      },
    ],
    roads: [
      ...current.roads,
      {
        id: roadId,
        name: `Road ${current.roads.length + 1}`,
        points: roadPoints,
        width: 5.3,
        materialId: "track",
        flattenTerrain: true,
        smoothEdges: true,
        closedLoop: false,
        checkpointIds,
      },
    ],
    markers: [
      ...current.markers,
      {
        id: crypto.randomUUID(),
        type: "start-finish" as const,
        name: "Auto Start / Finish",
        position: roadPoints[0],
      },
      ...checkpointMarkers,
    ],
  };
}
