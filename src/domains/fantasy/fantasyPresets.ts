export type FantasyWorldPreset = "island-village" | "forest-hamlet" | "coastal-town";

export type FantasyWorldConfig = {
  preset: FantasyWorldPreset;
  seed: number;
  terrainSize: number;
  islandRadius: number;
  townCenter: { x: number; z: number };
  enableWater: boolean;
  enableForest: boolean;
  enableFarms: boolean;
  structureDensity: "sparse" | "normal" | "dense";
};

export const FANTASY_PRESET_CONFIGS: Record<FantasyWorldPreset, FantasyWorldConfig> = {
  "island-village": {
    preset: "island-village",
    seed: 42,
    terrainSize: 80,
    islandRadius: 0.42,
    townCenter: { x: 0, z: 0 },
    enableWater: true,
    enableForest: true,
    enableFarms: true,
    structureDensity: "normal",
  },
  "forest-hamlet": {
    preset: "forest-hamlet",
    seed: 77,
    terrainSize: 100,
    islandRadius: 0.5,
    townCenter: { x: 0, z: 0 },
    enableWater: false,
    enableForest: true,
    enableFarms: true,
    structureDensity: "sparse",
  },
  "coastal-town": {
    preset: "coastal-town",
    seed: 123,
    terrainSize: 90,
    islandRadius: 0.45,
    townCenter: { x: 5, z: -3 },
    enableWater: true,
    enableForest: true,
    enableFarms: false,
    structureDensity: "dense",
  },
};

// ── Zone presets for fantasy zone painting ─────────────────────────────────

export type FantasyZonePreset = {
  id: string;
  name: string;
  assetTagFilter: string[];
  scatterCount: number;
  scatterMinSpacing: number;
  scatterScaleMin: number;
  scatterScaleMax: number;
  foliageDensity: number;
  terrainMaterial?: string;
};

export const FANTASY_ZONE_PRESETS: FantasyZonePreset[] = [
  {
    id: "dense-forest",
    name: "Dense Forest",
    assetTagFilter: ["tree", "foliage"],
    scatterCount: 20,
    scatterMinSpacing: 2.5,
    scatterScaleMin: 0.7,
    scatterScaleMax: 1.3,
    foliageDensity: 8,
    terrainMaterial: "grass",
  },
  {
    id: "sparse-woods",
    name: "Sparse Woods",
    assetTagFilter: ["tree", "rock"],
    scatterCount: 10,
    scatterMinSpacing: 3.5,
    scatterScaleMin: 0.8,
    scatterScaleMax: 1.2,
    foliageDensity: 4,
    terrainMaterial: "grass",
  },
  {
    id: "farmland",
    name: "Farmland",
    assetTagFilter: ["crop", "farm", "fence"],
    scatterCount: 8,
    scatterMinSpacing: 2.0,
    scatterScaleMin: 0.8,
    scatterScaleMax: 1.1,
    foliageDensity: 0,
    terrainMaterial: "dirt",
  },
  {
    id: "town-square",
    name: "Town Square",
    assetTagFilter: ["town", "structure"],
    scatterCount: 4,
    scatterMinSpacing: 3.0,
    scatterScaleMin: 0.9,
    scatterScaleMax: 1.1,
    foliageDensity: 0,
    terrainMaterial: "track",
  },
  {
    id: "rocky-shore",
    name: "Rocky Shore",
    assetTagFilter: ["rock", "stone", "cliff"],
    scatterCount: 12,
    scatterMinSpacing: 2.0,
    scatterScaleMin: 0.7,
    scatterScaleMax: 1.4,
    foliageDensity: 0,
    terrainMaterial: "sand",
  },
  {
    id: "riverbank",
    name: "Riverbank",
    assetTagFilter: ["rock", "fence", "bridge"],
    scatterCount: 6,
    scatterMinSpacing: 2.5,
    scatterScaleMin: 0.7,
    scatterScaleMax: 1.2,
    foliageDensity: 2,
  },
];
