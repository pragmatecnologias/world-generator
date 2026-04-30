import type { EnvironmentSettings, WorldProject } from "../../types";
import { DEFAULT_KENNEY_SHOWCASE_LAYOUT } from "./ShowcaseLayoutSchema";

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
  generator?: "offroad" | "city" | "generic" | "fantasy";
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
    width: 120,
    depth: 120,
    resolution: 129,
    heightScale: 46,
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
      width: 4.8,
      complexity: 14,
      smoothing: 0.84,
      center: { x: 0, z: 0 },
      radius: 24,
      checkpoints: 4,
      materialId: "track",
      flattenTerrain: true,
      smoothEdges: true,
    },
    {
      id: "river-curve",
      type: "trail",
      tags: ["river", "water", "secondary"],
      width: 1.6,
      complexity: 10,
      smoothing: 0.84,
      start: { x: -35, z: 12 },
      end: { x: 32, z: -10 },
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
      start: { x: -28, z: -22 },
      end: { x: 26, z: 18 },
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
      center: { x: -26, z: 14 },
      radius: 28,
      irregularity: 0.28,
      materialId: "grass",
      assetTags: ["tree", "foliage"],
    },
    {
      id: "east-rocks",
      type: "blob",
      tags: ["rock", "ridge"],
      center: { x: 28, z: -10 },
      radius: 20,
      irregularity: 0.22,
      materialId: "rock",
      assetTags: ["rock", "boulder", "prop", "cliff"],
    },
    {
      id: "west-cliffs",
      type: "blob",
      tags: ["cliff", "ridge", "waterfall"],
      center: { x: -34, z: 7 },
      radius: 20,
      irregularity: 0.2,
      materialId: "rock",
      assetTags: ["cliff", "rock", "waterfall", "wall"],
    },
    {
      id: "south-clearing",
      type: "rect",
      tags: ["clearing", "open"],
      center: { x: 10, z: -24 },
      width: 42,
      depth: 22,
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
      density: 0.86,
      count: 72,
      minSpacing: 2.8,
      cluster: { enabled: true, clusterCount: 8, radius: 11 },
    },
    {
      id: "rock-borders",
      assetTags: ["rock", "boulder", "prop", "cliff"],
      zoneTags: ["rock", "cliff"],
      avoidPathTags: ["primary"],
      slopeMax: 36,
      density: 0.56,
      count: 28,
      minSpacing: 3.8,
      cluster: { enabled: true, clusterCount: 5, radius: 10 },
    },
    {
      id: "cliff-walls",
      assetTags: ["cliff", "rock"],
      zoneTags: ["cliff", "ridge"],
      avoidPathTags: ["primary", "trail"],
      slopeMax: 48,
      density: 0.5,
      count: 18,
      minSpacing: 3.1,
      cluster: { enabled: true, clusterCount: 4, radius: 10 },
    },
    {
      id: "trailside-shrubs",
      assetTags: ["shrub", "foliage"],
      zoneTags: ["clearing", "forest"],
      avoidPathTags: ["primary", "trail"],
      slopeMax: 24,
      density: 0.38,
      count: 24,
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
      count: 6,
      minSpacing: 4,
      cluster: { enabled: true, clusterCount: 3, radius: 9 },
    },
  ],
  roads: [],
  biomes: [
    {
      id: "grasslands",
      materialId: "grass",
      density: 0.78,
      assetTags: ["foliage", "tree"],
    },
    {
      id: "rock-belt",
      materialId: "rock",
      density: 0.32,
      assetTags: ["rock", "prop"],
    },
    {
      id: "shrub-edge",
      materialId: "grass",
      density: 0.44,
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
    backgroundColor: "#14202d",
    sunDirection: { x: -0.38, y: 1.18, z: 0.22 },
    sunIntensity: 2.55,
    ambientIntensity: 0.68,
    fogEnabled: true,
    fogColor: "#34465d",
    fogDensity: 0.0026,
    timeOfDay: "noon",
    weather: "clear",
  },
  metadata: {
    description: "AI-friendly scenic generation preset",
    tags: ["generated", "generic", "ai-ready", "cinematic", "showcase", "kenney"],
    showcaseLayout: DEFAULT_KENNEY_SHOWCASE_LAYOUT,
  },
};
