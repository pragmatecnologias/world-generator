import type { WorldProject } from "./types";

const now = new Date().toISOString();

export function createDefaultProject(): WorldProject {
  return {
    id: crypto.randomUUID(),
    name: "Untitled World",
    version: "0.1.0",
    createdAt: now,
    updatedAt: now,
    terrain: {
      width: 80,
      depth: 80,
      resolution: 65,
      heights: Array.from({ length: 65 * 65 }, (_, index) => {
        const x = index % 65;
        const z = Math.floor(index / 65);
        const dx = x / 64 - 0.5;
        const dz = z / 64 - 0.5;
        return Math.max(0, 1 - Math.hypot(dx * 1.6, dz * 1.6)) * 1.2;
      }),
      materialMap: Array.from({ length: 65 * 65 }, (_, index) => {
        const x = index % 65;
        if (x < 14) return "sand";
        if (x < 28) return "grass";
        if (x < 42) return "dirt";
        if (x < 52) return "rock";
        return "track";
      }),
    },
    materials: [
      { id: "grass", name: "Grass", color: "#6ea95e", roughness: 0.95, scale: 1 },
      { id: "dirt", name: "Dirt", color: "#8d6b44", roughness: 1, scale: 1 },
      { id: "mud", name: "Mud", color: "#53402f", roughness: 1, scale: 1 },
      { id: "rock", name: "Rock", color: "#7d8791", roughness: 0.9, scale: 1 },
      { id: "sand", name: "Sand", color: "#d8c27f", roughness: 1, scale: 1 },
      { id: "track", name: "Track", color: "#4b4b4f", roughness: 1, scale: 1 },
    ],
    assets: [
      {
        id: "demo-tree",
        name: "Demo Tree",
        category: "Foliage",
        filePath: "built-in",
        sourceType: "builtin",
        defaultScale: 1,
        collisionType: "box",
        canPaint: true,
        tags: ["demo", "foliage"],
        placementRules: {
          paintEligible: true,
          scatterEligible: true,
          alignToTerrain: true,
          minScale: 0.8,
          maxScale: 1.4,
        },
      },
      {
        id: "demo-rock",
        name: "Demo Rock",
        category: "Props",
        filePath: "built-in",
        sourceType: "builtin",
        defaultScale: 1,
        collisionType: "box",
        canPaint: true,
        tags: ["demo", "rock"],
        placementRules: {
          paintEligible: true,
          scatterEligible: true,
          alignToTerrain: true,
          minScale: 0.8,
          maxScale: 1.5,
        },
      },
    ],
    objects: [
      {
        id: "obj-demo-rock",
        assetId: "demo-rock",
        name: "Demo Rock",
        position: { x: 8, y: 1.2, z: -4 },
        rotation: { x: 0, y: 0.4, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      },
      {
        id: "obj-demo-rock-2",
        assetId: "demo-rock",
        name: "Demo Rock 2",
        position: { x: -10, y: 0.9, z: 12 },
        rotation: { x: 0, y: 1.2, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      },
      {
        id: "obj-demo-rock-3",
        assetId: "demo-rock",
        name: "Demo Rock 3",
        position: { x: 14, y: 1.0, z: -6 },
        rotation: { x: 0, y: -0.2, z: 0 },
        scale: { x: 0.9, y: 0.9, z: 0.9 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      },
    ],
    foliageGroups: [
      {
        id: "foliage-demo",
        name: "Demo Trees",
        assetIds: ["demo-tree"],
        instances: [
          {
            id: "foliage-tree-1",
            assetId: "demo-tree",
            position: { x: -16, y: 0.4, z: -10 },
            rotation: { x: 0, y: 0.5, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
          {
            id: "foliage-tree-2",
            assetId: "demo-tree",
            position: { x: -13, y: 0.45, z: -7 },
            rotation: { x: 0, y: 1.3, z: 0 },
            scale: { x: 1.1, y: 1.1, z: 1.1 },
          },
          {
            id: "foliage-tree-3",
            assetId: "demo-tree",
            position: { x: -18, y: 0.35, z: -6 },
            rotation: { x: 0, y: 2.2, z: 0 },
            scale: { x: 0.9, y: 0.9, z: 0.9 },
          },
          {
            id: "foliage-tree-4",
            assetId: "demo-tree",
            position: { x: -11, y: 0.55, z: -13 },
            rotation: { x: 0, y: 0.9, z: 0 },
            scale: { x: 1.2, y: 1.2, z: 1.2 },
          },
          {
            id: "foliage-tree-5",
            assetId: "demo-tree",
            position: { x: -8, y: 0.5, z: -8 },
            rotation: { x: 0, y: 2.7, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          },
        ],
        settings: {
          density: 6,
          minSpacing: 3,
          randomScaleMin: 0.8,
          randomScaleMax: 1.3,
          randomRotation: true,
          slopeLimit: 35,
          avoidRoads: true,
          eraseMode: false,
        },
      },
    ],
    scatterZones: [],
    roads: [
      {
        id: "road-demo",
        name: "Demo Track",
        points: [
          { x: -24, y: 0.2, z: 8 },
          { x: -10, y: 0.2, z: 20 },
          { x: 8, y: 0.2, z: 18 },
          { x: 24, y: 0.2, z: 2 },
        ],
        width: 4.4,
        materialId: "track",
        flattenTerrain: true,
        smoothEdges: true,
        closedLoop: false,
        checkpointIds: [],
      },
    ],
    markers: [
      {
        id: "marker-start",
        type: "start-finish",
        name: "Start / Finish",
        position: { x: -24, y: 0.5, z: 8 },
      },
    ],
    environment: {
      backgroundColor: "#97c7ff",
      sunDirection: { x: 0.35, y: 1, z: 0.2 },
      sunIntensity: 2.1,
      ambientIntensity: 0.9,
      fogEnabled: true,
      fogColor: "#cfe8ff",
      fogDensity: 0.006,
      timeOfDay: "noon",
      weather: "clear",
    },
    layers: [
      { id: "layer-terrain", name: "Terrain", visible: true, locked: true },
      { id: "layer-props", name: "Props", visible: true, locked: false },
      { id: "layer-foliage", name: "Foliage", visible: true, locked: false },
      { id: "layer-road", name: "Roads", visible: true, locked: false },
      { id: "layer-markers", name: "Markers", visible: true, locked: false },
    ],
    metadata: {
      description: "Starter world generated from the MVP docs.",
    },
  };
}
