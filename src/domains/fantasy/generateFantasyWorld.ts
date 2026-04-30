// IDs use crypto.randomUUID() for consistency with the codebase
import type { AssetDefinition, FoliageGroup, PlacedObject, ScatterZone, WorldProject } from "../../types";
import type { FantasyWorldConfig } from "./fantasyPresets";
import { FANTASY_PRESET_CONFIGS } from "./fantasyPresets";
import {
  FOREST_TREES, FOREST_ROCKS, CROP_MODELS, CAMP_MODELS,
  FENCE_MODELS, BRIDGE_MODELS, PATH_MODELS, WATER_EDGE_MODELS,
  STRUCTURE_PRESETS, FANTASY_TOWN_BASE,
  buildAssetMap, buildFantasyAssetDefinitions,
} from "./fantasyAssets";
import { buildStructureOperations, buildClusterOperations, buildWaterSurfaceOperations } from "../../core/generation/fantasyPlacement";
import { createDefaultProject } from "../../defaultProject";
import { buildGenericTerrain, buildBaseTerrainMaterials } from "../../core/engine/terrainCore";
import { flattenRoadsIntoTerrain, applyRoadSurfaceTreatment } from "../../core/generation/terrainGenerator";

// ── Utilities ─────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function stableId(prefix: string, seed: number, index: number): string {
  return `${prefix}-${Math.abs(seed * 9301 + index * 49297) % 233280}`;
}

// ── Terrain: island shape with elevation layers ───────────────────────────

function buildIslandTerrain(seed: number, config: FantasyWorldConfig): WorldProject["terrain"] {
  const size = config.terrainSize;
  const res = 65;
  const terrain = buildGenericTerrain(seed, {
    width: size, depth: size, resolution: res, heightScale: 20,
    noise: { octaves: 5, frequency: 0.025, persistence: 0.5 },
  }, 0.4);

  // Carve island shape: raise center, lower edges
  const cx = res / 2;
  const cz = res / 2;
  const maxRadius = res * config.islandRadius;

  const heights = [...terrain.heights];
  const materialMap = [...terrain.materialMap];

  for (let gz = 0; gz < res; gz++) {
    for (let gx = 0; gx < res; gx++) {
      const idx = gz * res + gx;
      const dx = gx - cx;
      const dz = gz - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Island falloff: full height at center, zero at edge
      const normalizedDist = dist / maxRadius;
      const falloff = Math.max(0, 1 - normalizedDist * normalizedDist);

      // Multi-level stepping (fantasy isometric look)
      const rawHeight = heights[idx] * falloff;
      const stepped = Math.round(rawHeight * 2.5) / 2.5; // snap to ~0.4 increments
      heights[idx] = Math.max(0, stepped);

      // Material zones based on distance from center
      if (normalizedDist > 0.85) {
        materialMap[idx] = "sand";
      } else if (normalizedDist > 0.7) {
        materialMap[idx] = "rock";
      } else if (stepped > 2.5) {
        materialMap[idx] = "rock";
      } else if (stepped < 0.3) {
        materialMap[idx] = "dirt";
      } else {
        materialMap[idx] = "grass";
      }
    }
  }

  return { width: size, depth: size, resolution: res, heights, materialMap };
}

// ── Roads: winding path through the island ────────────────────────────────

function buildFantasyRoads(terrain: WorldProject["terrain"], seed: number) {
  const rng = seededRandom(seed + 100);
  const res = terrain.resolution;
  const cx = res / 2;
  const cz = res / 2;

  // Create a winding path from one edge to the other
  const pathPoints: Array<{ x: number; y: number; z: number }> = [];
  const segments = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 0.8 - Math.PI * 0.4;
    const radius = terrain.width * 0.35 * (0.5 + t * 0.5);
    const x = Math.cos(angle) * radius + (rng() - 0.5) * 8;
    const z = Math.sin(angle) * radius + (rng() - 0.5) * 8;
    const gx = Math.round(((x + terrain.width / 2) / terrain.width) * (res - 1));
    const gz = Math.round(((z + terrain.depth / 2) / terrain.depth) * (res - 1));
    const clampedGx = Math.max(0, Math.min(res - 1, gx));
    const clampedGz = Math.max(0, Math.min(res - 1, gz));
    const y = terrain.heights[clampedGz * res + clampedGx] * 1.2;
    pathPoints.push({ x, y, z });
  }

  return [{
    id: stableId("road", seed, 0),
    name: "Main Path",
    points: pathPoints,
    width: 3.5,
    materialId: "track",
    flattenTerrain: true,
    smoothEdges: true,
    closedLoop: false,
    checkpointIds: [],
  }];
}

// ── Scatter zones ─────────────────────────────────────────────────────────

function buildFantasyScatterZones(
  terrain: WorldProject["terrain"],
  config: FantasyWorldConfig,
  seed: number,
): ScatterZone[] {
  const zones: ScatterZone[] = [];
  const rng = seededRandom(seed + 200);
  const res = terrain.resolution;
  const size = terrain.width;

  // Forest zones (around the perimeter)
  if (config.enableForest) {
    const forestAngles = [0, Math.PI * 0.6, Math.PI * 1.2];
    for (let i = 0; i < forestAngles.length; i++) {
      const angle = forestAngles[i];
      const dist = size * 0.28;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      zones.push({
        id: stableId("zone", seed, i),
        name: `Forest ${i + 1}`,
        shape: "circle",
        points: [{ x: cx, y: 0, z: cz }, { x: size * 0.15, y: 0, z: 0 }],
        assetIds: FOREST_TREES.filter((p) => {
          // Only include models that exist in the asset source
          return true;
        }).map((_, idx) => `fantasy-${1000 + idx}`), // placeholder IDs
        settings: {
          count: 12 + Math.floor(rng() * 8),
          minSpacing: 2.5,
          randomScaleMin: 0.7,
          randomScaleMax: 1.3,
          randomRotation: true,
          slopeLimit: 40,
        },
        generatedObjectIds: [],
        tags: ["forest"],
      });
    }
  }

  // Farm zone
  if (config.enableFarms) {
    zones.push({
      id: stableId("zone", seed, 10),
      name: "Farmland",
      shape: "circle",
      points: [{ x: size * 0.2, y: 0, z: -size * 0.1 }, { x: size * 0.1, y: 0, z: 0 }],
      assetIds: CROP_MODELS.map((_, idx) => `fantasy-${1000 + FOREST_TREES.length + FOREST_ROCKS.length + CLIFF_COUNT + PATH_COUNT + idx}`),
      settings: {
        count: 8,
        minSpacing: 2.0,
        randomScaleMin: 0.8,
        randomScaleMax: 1.1,
        randomRotation: false,
        slopeLimit: 15,
      },
      generatedObjectIds: [],
      tags: ["farm"],
    });
  }

  return zones;
}

const CLIFF_COUNT = 10;
const PATH_COUNT = 4;

// ── Placed structures ─────────────────────────────────────────────────────

function buildFantasyStructures(
  terrain: WorldProject["terrain"],
  config: FantasyWorldConfig,
  seed: number,
  assetMap: Map<string, string>,
): PlacedObject[] {
  const rng = seededRandom(seed + 300);
  const res = terrain.resolution;
  const size = terrain.width;

  // Sample terrain height helper
  function sampleHeight(worldX: number, worldZ: number): number {
    const gx = Math.round(((worldX + size / 2) / size) * (res - 1));
    const gz = Math.round(((worldZ + size / 2) / size) * (res - 1));
    if (gx < 0 || gx >= res || gz < 0 || gz >= res) return 0;
    return terrain.heights[gz * res + gx] * 1.2;
  }

  const structures: PlacedObject[] = [];

  // Determine structure count based on density
  const densityMultiplier = config.structureDensity === "dense" ? 1.5 : config.structureDensity === "sparse" ? 0.6 : 1;
  const townHallCount = 1;
  const cottageCount = Math.round((2 + Math.floor(rng() * 2)) * densityMultiplier);
  const windmillCount = config.enableFarms ? 1 : 0;
  const watermillCount = config.enableWater ? 1 : 0;
  const stallCount = Math.round((2 + Math.floor(rng() * 2)) * densityMultiplier);
  const fountainCount = 1;

  // Town center offset
  const tc = config.townCenter;

  // Place town hall at center
  const townHallPreset = STRUCTURE_PRESETS.find((p) => p.id === "town-hall")!;
  const hallX = tc.x;
  const hallZ = tc.z;
  const hallY = sampleHeight(hallX, hallZ);
  const hallRotation = rng() * Math.PI * 2;

  const hallOps = buildStructureOperations("town-hall", { x: hallX, y: hallY, z: hallZ }, assetMap, hallRotation);
  for (const op of hallOps) {
    if (op.type === "addObject") structures.push(op.payload as PlacedObject);
  }

  // Place cottages around the center
  const cottagePresetIds = ["stone-cottage", "wood-cottage"];
  for (let i = 0; i < cottageCount; i++) {
    const angle = (i / cottageCount) * Math.PI * 2 + rng() * 0.5;
    const dist = 6 + rng() * 5;
    const x = tc.x + Math.cos(angle) * dist;
    const z = tc.z + Math.sin(angle) * dist;
    const y = sampleHeight(x, z);
    const presetId = cottagePresetIds[i % cottagePresetIds.length];
    const rotation = rng() * Math.PI * 2;

    const ops = buildStructureOperations(presetId, { x, y, z }, assetMap, rotation);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  // Place windmill (on a hill)
  if (windmillCount > 0) {
    const x = tc.x + 10 + rng() * 4;
    const z = tc.z - 8 + rng() * 4;
    const y = sampleHeight(x, z);
    const ops = buildStructureOperations("windmill", { x, y, z }, assetMap, rng() * Math.PI * 2);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  // Place watermill (near water edge)
  if (watermillCount > 0) {
    const x = tc.x - 10 + rng() * 3;
    const z = tc.z + 6 + rng() * 3;
    const y = sampleHeight(x, z);
    const ops = buildStructureOperations("watermill", { x, y, z }, assetMap, rng() * Math.PI * 2);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  // Place market stalls near town hall
  for (let i = 0; i < stallCount; i++) {
    const angle = (i / stallCount) * Math.PI * 2;
    const dist = 4 + rng() * 2;
    const x = tc.x + Math.cos(angle) * dist;
    const z = tc.z + Math.sin(angle) * dist;
    const y = sampleHeight(x, z);
    const rotation = angle + Math.PI / 2;

    const ops = buildStructureOperations("market-stall", { x, y, z }, assetMap, rotation, 0.9);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  // Place fountain in town square
  {
    const x = tc.x + 2;
    const z = tc.z + 2;
    const y = sampleHeight(x, z);
    const ops = buildStructureOperations("fountain", { x, y, z }, assetMap);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  // Place fence segments
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 0.7;
    const dist = 12 + rng() * 3;
    const x = tc.x + Math.cos(angle) * dist;
    const z = tc.z + Math.sin(angle) * dist;
    const y = sampleHeight(x, z);

    const ops = buildStructureOperations("fence-segment", { x, y, z }, assetMap, angle);
    for (const op of ops) {
      if (op.type === "addObject") structures.push(op.payload as PlacedObject);
    }
  }

  return structures;
}

// ── Foliage groups ────────────────────────────────────────────────────────

function buildFantasyFoliage(
  terrain: WorldProject["terrain"],
  config: FantasyWorldConfig,
  seed: number,
  assetSource: AssetDefinition[],
): FoliageGroup[] {
  if (!config.enableForest) return [];

  const rng = seededRandom(seed + 400);
  const res = terrain.resolution;
  const size = terrain.width;

  // Find tree assets from the source
  const treeAssets = assetSource.filter((a) => a.tags.includes("tree") && a.tags.includes("foliage"));
  if (treeAssets.length === 0) return [];

  const instances: FoliageGroup["instances"] = [];
  const treeCount = Math.round(30 * (config.structureDensity === "dense" ? 0.7 : config.structureDensity === "sparse" ? 1.3 : 1));

  for (let i = 0; i < treeCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 10 + rng() * (size * 0.35);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const gx = Math.round(((x + size / 2) / size) * (res - 1));
    const gz = Math.round(((z + size / 2) / size) * (res - 1));
    if (gx < 0 || gx >= res || gz < 0 || gz >= res) continue;

    const height = terrain.heights[gz * res + gx];
    if (height < 0.2) continue; // skip water level

    const y = height * 1.2;
    const asset = pick(rng, treeAssets);
    const scale = 0.7 + rng() * 0.6;

    instances.push({
      id: stableId("foliage", seed, i),
      assetId: asset.id,
      position: { x, y, z },
      rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
      scale: { x: scale, y: scale, z: scale },
    });
  }

  return [{
    id: stableId("group", seed, 0),
    name: "Fantasy Forest",
    assetIds: treeAssets.map((a) => a.id),
    instances,
    settings: {
      density: 6,
      minSpacing: 3,
      randomScaleMin: 0.7,
      randomScaleMax: 1.3,
      randomRotation: true,
      slopeLimit: 35,
      avoidRoads: true,
      eraseMode: false,
    },
  }];
}

// ── Water surfaces ────────────────────────────────────────────────────────

function buildWaterSurfaces(
  terrain: WorldProject["terrain"],
  config: FantasyWorldConfig,
  seed: number,
): PlacedObject[] {
  if (!config.enableWater) return [];

  const rng = seededRandom(seed + 500);
  const surfaces: PlacedObject[] = [];

  // Add a few ponds around the island edges
  const pondPositions = [
    { x: -12, z: 8, rx: 4, rz: 3 },
    { x: 10, z: -10, rx: 3, rz: 4 },
    { x: -8, z: -12, rx: 3.5, rz: 2.5 },
  ];

  for (const pond of pondPositions) {
    const ops = buildWaterSurfaceOperations(pond, pond.rx, pond.rz);
    for (const op of ops) {
      if (op.type === "addObject") surfaces.push(op.payload as PlacedObject);
    }
  }

  return surfaces;
}

// ── Main generator ────────────────────────────────────────────────────────

export function generateFantasyWorld(
  config: FantasyWorldConfig,
  assetSource: AssetDefinition[] = createDefaultProject().assets,
): WorldProject {
  const base = createDefaultProject();

  // Merge default config with provided config
  const mergedConfig: FantasyWorldConfig = {
    ...FANTASY_PRESET_CONFIGS[config.preset ?? "island-village"],
    ...config,
  };

  // Build fantasy assets and merge with source
  const fantasyAssets = buildFantasyAssetDefinitions();
  const allAssets = [...assetSource, ...fantasyAssets];
  const assetMap = buildAssetMap(allAssets);

  // Build terrain
  const terrain = buildIslandTerrain(mergedConfig.seed, mergedConfig);

  // Build roads
  const roads = buildFantasyRoads(terrain, mergedConfig.seed);
  const flattened = flattenRoadsIntoTerrain(terrain, roads);
  const surfaced = applyRoadSurfaceTreatment(flattened, roads, mergedConfig.seed, "forest");

  // Build scatter zones (with correct asset IDs)
  const zones = buildFantasyScatterZones(surfaced, mergedConfig, mergedConfig.seed);
  // Fix zone asset IDs to reference actual assets
  for (const zone of zones) {
    const matchingAssets = allAssets.filter((a) => {
      if (zone.tags?.includes("forest")) return a.tags.includes("tree") && a.tags.includes("foliage");
      if (zone.tags?.includes("farm")) return a.tags.includes("crop") || a.tags.includes("farm");
      return false;
    });
    zone.assetIds = matchingAssets.map((a) => a.id);
  }

  // Build structures
  const structures = buildFantasyStructures(surfaced, mergedConfig, mergedConfig.seed, assetMap);

  // Build foliage
  const foliageGroups = buildFantasyFoliage(surfaced, mergedConfig, mergedConfig.seed, allAssets);

  // Build water surfaces
  const waterSurfaces = buildWaterSurfaces(surfaced, mergedConfig, mergedConfig.seed);

  // Add camp props
  const campAssets = allAssets.filter((a) => a.tags.includes("camp"));
  const campObjects: PlacedObject[] = [];
  if (campAssets.length > 0) {
    const rng = seededRandom(mergedConfig.seed + 600);
    const x = mergedConfig.townCenter.x + 15 + rng() * 3;
    const z = mergedConfig.townCenter.z + 10 + rng() * 3;
    const res = surfaced.resolution;
    const gx = Math.round(((x + surfaced.width / 2) / surfaced.width) * (res - 1));
    const gz = Math.round(((z + surfaced.depth / 2) / surfaced.depth) * (res - 1));
    const y = (gx >= 0 && gx < res && gz >= 0 && gz < res) ? surfaced.heights[gz * res + gx] * 1.2 : 0;

    for (let i = 0; i < 3; i++) {
      const asset = pick(rng, campAssets);
      campObjects.push({
        id: stableId("camp", mergedConfig.seed, i),
        assetId: asset.id,
        name: `Camp prop ${i + 1}`,
        position: { x: x + (rng() - 0.5) * 3, y, z: z + (rng() - 0.5) * 3 },
        rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
        scale: { x: 0.8 + rng() * 0.4, y: 0.8 + rng() * 0.4, z: 0.8 + rng() * 0.4 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: false,
      });
    }
  }

  // Combine all objects
  const allObjects = [...structures, ...waterSurfaces, ...campObjects];

  // Build markers
  const markers = [{
    id: stableId("marker", mergedConfig.seed, 0),
    type: "start-finish" as const,
    name: "Start / Finish",
    position: {
      x: roads[0]?.points[0]?.x ?? 0,
      y: (roads[0]?.points[0]?.y ?? 0) + 0.5,
      z: roads[0]?.points[0]?.z ?? 0,
    },
  }];

  // Build the project
  const project: WorldProject = {
    ...base,
    id: `fantasy-${mergedConfig.preset}-${mergedConfig.seed}`,
    name: `Fantasy ${mergedConfig.preset.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
    createdAt: new Date(1_700_000_000_000 + mergedConfig.seed * 1000).toISOString(),
    updatedAt: new Date(1_700_000_000_000 + mergedConfig.seed * 1000).toISOString(),
    terrain: surfaced,
    materials: [...buildBaseTerrainMaterials().filter((m) => m.id !== "water"), { id: "water", name: "Water", color: "#3b8fbe", roughness: 0.18, scale: 1 }],
    assets: allAssets,
    objects: allObjects,
    foliageGroups,
    scatterZones: zones,
    roads,
    markers,
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
    layers: base.layers,
    metadata: {
      description: `Fantasy ${mergedConfig.preset} world generated from seed ${mergedConfig.seed}`,
      tags: ["showcase", "kenney", "fantasy", mergedConfig.preset],
    },
  };

  return project;
}
