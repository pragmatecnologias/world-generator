import type { EnvironmentSettings, WorldProject } from "../../types";

export type TerrainNoiseConfig = {
  type: "simplex" | "perlin";
  octaves: number;
  frequency: number;
  persistence: number;
};

export type WorldGenerationZoneConfig = {
  id?: string;
  type: "circle" | "rect" | "blob";
  tags: string[];
  center?: { x: number; z: number };
  radius?: number;
  width?: number;
  depth?: number;
  irregularity?: number;
  materialId?: string;
  assetTags?: string[];
};

export type WorldGenerationPathConfig = {
  id?: string;
  type: "loop" | "trail" | "path" | "grid" | "ring" | "branching";
  tags: string[];
  width: number;
  complexity: number;
  smoothing: number;
  closedLoop?: boolean;
  start?: { x: number; z: number };
  end?: { x: number; z: number };
  center?: { x: number; z: number };
  radius?: number;
  spacing?: number;
  branches?: number;
  points?: { x: number; y?: number; z: number }[];
  materialId?: string;
  flattenTerrain?: boolean;
  smoothEdges?: boolean;
  checkpoints?: number;
};

export type WorldGenerationPlacementRuleConfig = {
  id?: string;
  assetTags: string[];
  zoneTags?: string[];
  avoidPathTags?: string[];
  slopeMax?: number;
  density?: number;
  count?: number;
  minSpacing?: number;
  cluster?: {
    enabled: boolean;
    clusterCount: number;
    radius: number;
  };
};

export type WorldGenerationRoadConfig = {
  type: "loop" | "trail" | "path";
  width: number;
  materialId: string;
  complexity: number;
  checkpoints: number;
};

export type WorldGenerationBiomeConfig = {
  id: string;
  materialId: string;
  density: number;
  assetTags: string[];
};

export type WorldGenerationConfig = {
  seed: number;
  generator?: "offroad" | "city" | "generic";
  theme: "offroad" | "desert" | "forest" | "biblical" | "mountain";
  terrain: {
    width: number;
    depth: number;
    resolution: number;
    heightScale: number;
    noise: TerrainNoiseConfig;
  };
  paths?: WorldGenerationPathConfig[];
  zones?: WorldGenerationZoneConfig[];
  placementRules?: WorldGenerationPlacementRuleConfig[];
  roads: WorldGenerationRoadConfig[];
  biomes: WorldGenerationBiomeConfig[];
  gameplay: {
    startFinish: boolean;
    checkpoints: number;
    enemySpawnCount?: number;
  };
  environment?: Partial<EnvironmentSettings>;
  metadata?: Partial<WorldProject["metadata"]> & {
    description?: string;
    tags?: string[];
  };
};

export const DEFAULT_WORLD_GENERATION_CONFIG: WorldGenerationConfig = {
  seed: 42,
  generator: "generic",
  theme: "forest",
  terrain: {
    width: 220,
    depth: 220,
    resolution: 129,
    heightScale: 30,
    noise: {
      type: "simplex",
      octaves: 6,
      frequency: 0.02,
      persistence: 0.54,
    },
  },
  paths: [
    {
      id: "primary-loop",
      type: "loop",
      tags: ["primary", "route", "loop"],
      width: 5.4,
      complexity: 14,
      smoothing: 0.84,
      center: { x: 0, z: 0 },
      radius: 42,
      checkpoints: 4,
      materialId: "track",
      flattenTerrain: true,
      smoothEdges: true,
    },
    {
      id: "river-curve",
      type: "trail",
      tags: ["river", "water", "secondary"],
      width: 3.8,
      complexity: 10,
      smoothing: 0.84,
      start: { x: -76, z: 52 },
      end: { x: 76, z: -52 },
      materialId: "water",
      flattenTerrain: true,
      smoothEdges: true,
      checkpoints: 0,
    },
    {
      id: "ridge-trail",
      type: "trail",
      tags: ["trail", "secondary"],
      width: 4,
      complexity: 7,
      smoothing: 0.62,
      start: { x: -50, z: -38 },
      end: { x: 48, z: 30 },
      materialId: "dirt",
      flattenTerrain: true,
      smoothEdges: true,
      checkpoints: 0,
    },
  ],
  zones: [
    {
      id: "north-forest",
      type: "blob",
      tags: ["forest", "dense"],
      center: { x: -48, z: 26 },
      radius: 50,
      irregularity: 0.28,
      materialId: "grass",
      assetTags: ["tree", "foliage"],
    },
    {
      id: "east-rocks",
      type: "blob",
      tags: ["rock", "ridge"],
      center: { x: 54, z: -18 },
      radius: 38,
      irregularity: 0.22,
      materialId: "rock",
      assetTags: ["rock", "boulder", "prop"],
    },
    {
      id: "south-clearing",
      type: "rect",
      tags: ["clearing", "open"],
      center: { x: 14, z: -50 },
      width: 72,
      depth: 34,
      materialId: "dirt",
      assetTags: ["shrub", "prop"],
    },
  ],
  placementRules: [
    {
      id: "forest-trees",
      assetTags: ["tree", "foliage"],
      zoneTags: ["forest"],
      avoidPathTags: ["primary", "trail"],
      slopeMax: 28,
      density: 0.92,
      count: 112,
      minSpacing: 2.8,
      cluster: { enabled: true, clusterCount: 10, radius: 15 },
    },
    {
      id: "rock-borders",
      assetTags: ["rock", "boulder", "prop"],
      zoneTags: ["rock"],
      avoidPathTags: ["primary"],
      slopeMax: 36,
      density: 0.58,
      count: 44,
      minSpacing: 3.8,
      cluster: { enabled: true, clusterCount: 7, radius: 12 },
    },
    {
      id: "trailside-shrubs",
      assetTags: ["shrub", "foliage"],
      zoneTags: ["clearing", "forest"],
      avoidPathTags: ["primary", "trail"],
      slopeMax: 24,
      density: 0.42,
      count: 36,
      minSpacing: 2.4,
    },
    {
      id: "river-bridge",
      assetTags: ["bridge", "structure"],
      zoneTags: ["river", "valley"],
      avoidPathTags: ["primary"],
      slopeMax: 16,
      density: 0.1,
      count: 1,
      minSpacing: 10,
    },
    {
      id: "camp-details",
      assetTags: ["tent", "camp", "prop"],
      zoneTags: ["clearing"],
      avoidPathTags: ["primary"],
      slopeMax: 20,
      density: 0.34,
      count: 8,
      minSpacing: 4,
      cluster: { enabled: true, clusterCount: 3, radius: 9 },
    },
  ],
  roads: [],
  biomes: [
    {
      id: "grasslands",
      materialId: "grass",
      density: 0.72,
      assetTags: ["foliage", "tree"],
    },
    {
      id: "rock-belt",
      materialId: "rock",
      density: 0.36,
      assetTags: ["rock", "prop"],
    },
    {
      id: "shrub-edge",
      materialId: "grass",
      density: 0.48,
      assetTags: ["bush", "shrub", "foliage"],
    },
    {
      id: "trackside",
      materialId: "dirt",
      density: 0.22,
      assetTags: ["barrier", "track", "sign", "prop"],
    },
  ],
  gameplay: {
    startFinish: true,
    checkpoints: 4,
  },
  environment: {
    backgroundColor: "#a9d0ff",
    sunDirection: { x: -0.5, y: 1.12, z: 0.24 },
    sunIntensity: 2.35,
    ambientIntensity: 0.82,
    fogEnabled: true,
    fogColor: "#dce9f0",
    fogDensity: 0.0032,
    timeOfDay: "noon",
    weather: "clear",
  },
  metadata: {
    description: "AI-friendly scenic generation preset",
    tags: ["generated", "generic", "ai-ready", "cinematic"],
  },
};
