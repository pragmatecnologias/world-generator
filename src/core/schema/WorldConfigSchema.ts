import type { EnvironmentSettings, WorldProject } from "../../types";

export type TerrainNoiseConfig = {
  type: "simplex" | "perlin";
  octaves: number;
  frequency: number;
  persistence: number;
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
  theme: "offroad" | "desert" | "forest" | "biblical" | "mountain";
  terrain: {
    width: number;
    depth: number;
    resolution: number;
    heightScale: number;
    noise: TerrainNoiseConfig;
  };
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
  theme: "offroad",
  terrain: {
    width: 120,
    depth: 120,
    resolution: 65,
    heightScale: 12,
    noise: {
      type: "simplex",
      octaves: 4,
      frequency: 0.035,
      persistence: 0.52,
    },
  },
  roads: [
    {
      type: "loop",
      width: 8,
      materialId: "track",
      complexity: 12,
      checkpoints: 3,
    },
  ],
  biomes: [
    {
      id: "grasslands",
      materialId: "grass",
      density: 0.58,
      assetTags: ["foliage", "tree"],
    },
    {
      id: "rock-belt",
      materialId: "rock",
      density: 0.22,
      assetTags: ["rock", "prop"],
    },
  ],
  gameplay: {
    startFinish: true,
    checkpoints: 3,
  },
  environment: {
    backgroundColor: "#8fc7ff",
    sunDirection: { x: -0.5, y: 1, z: 0.4 },
    sunIntensity: 1.8,
    ambientIntensity: 0.8,
    fogEnabled: true,
    fogColor: "#cfe7ff",
    fogDensity: 0.005,
    timeOfDay: "noon",
    weather: "clear",
  },
  metadata: {
    description: "AI-friendly offroad generation preset",
    tags: ["generated", "offroad", "ai-ready"],
  },
};

