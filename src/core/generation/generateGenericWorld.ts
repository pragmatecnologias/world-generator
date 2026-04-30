import * as THREE from "three";
import type {
  AssetDefinition,
  FoliageGroup,
  GameplayMarker,
  PlacedObject,
  RoadDefinition,
  ScatterZone,
  TerrainData,
  Vector3Data,
  WorldProject,
} from "../../types";
import { createDefaultProject } from "../../defaultProject";
import { buildAssetRegistry, classifyAsset } from "../assets/assetRegistry";
import { buildBaseTerrainMaterials, buildGenericTerrain, applyPathEffects } from "../engine/terrainCore";
import type {
  WorldGenerationConfig,
  WorldGenerationPathConfig,
  WorldGenerationPlacementRuleConfig,
  WorldGenerationZoneConfig,
} from "../schema/WorldConfigSchema";
import { createSeededRng, hashString } from "./random";
import { flattenRoadsIntoTerrain, applyRoadSurfaceTreatment } from "./terrainGenerator";
import { isPointNearRoad, terrainSlopeAt, terrainWorldToGrid } from "../../viewport/terrain";
import { applyTerrainBrush } from "../../viewport/terrain";

type GenericPreset = "offroad" | "city" | "generic";

function stableId(prefix: string, seed: number, index: number, extra = 0) {
  return `${prefix}-${seed}-${index}-${extra}`;
}

function pick<T>(rng: () => number, items: T[]) {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleTerrainHeight(terrain: TerrainData, point: Vector3Data) {
  const grid = terrainWorldToGrid(new THREE.Vector3(point.x, point.y, point.z), terrain);
  return terrain.heights[grid.index] ?? 0;
}

function worldBounds(terrain: TerrainData) {
  return {
    minX: -terrain.width / 2,
    maxX: terrain.width / 2,
    minZ: -terrain.depth / 2,
    maxZ: terrain.depth / 2,
  };
}

function createPolygonFromZone(zone: WorldGenerationZoneConfig) {
  const center = zone.center ?? { x: 0, z: 0 };
  if (zone.type === "rect") {
    const width = zone.width ?? 20;
    const depth = zone.depth ?? 20;
    return [
      { x: center.x - width / 2, y: 0, z: center.z - depth / 2 },
      { x: center.x + width / 2, y: 0, z: center.z - depth / 2 },
      { x: center.x + width / 2, y: 0, z: center.z + depth / 2 },
      { x: center.x - width / 2, y: 0, z: center.z + depth / 2 },
    ];
  }
  const radius = zone.radius ?? 18;
  const points: Vector3Data[] = [];
  const segments = zone.type === "blob" ? 16 : 12;
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const irregularity = zone.type === "blob" ? zone.irregularity ?? 0.28 : 0;
    const wobble = 1 + Math.sin(angle * 3.1 + radius) * irregularity * 0.4;
    points.push({
      x: center.x + Math.cos(angle) * radius * wobble,
      y: 0,
      z: center.z + Math.sin(angle) * radius * wobble,
    });
  }
  return points;
}

function centroidOfZone(zone: ScatterZone) {
  if (zone.points.length === 0) return { x: 0, z: 0 };
  const sum = zone.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 });
  return { x: sum.x / zone.points.length, z: sum.z / zone.points.length };
}

function roadPointAt(road: RoadDefinition, t: number) {
  if (road.points.length === 0) return { x: 0, y: 0, z: 0 };
  if (road.points.length === 1) return road.points[0];
  const clamped = Math.max(0, Math.min(1, t));
  const segmentCount = road.closedLoop ? road.points.length : road.points.length - 1;
  const scaled = clamped * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled));
  const localT = scaled - segmentIndex;
  const a = road.points[segmentIndex];
  const b = road.points[(segmentIndex + 1) % road.points.length] ?? a;
  return {
    x: lerp(a.x, b.x, localT),
    y: lerp(a.y, b.y, localT),
    z: lerp(a.z, b.z, localT),
  };
}

function roadDirectionAt(road: RoadDefinition, t: number) {
  if (road.points.length < 2) return { x: 1, z: 0 };
  const clamped = Math.max(0, Math.min(1, t));
  const segmentCount = road.closedLoop ? road.points.length : road.points.length - 1;
  const scaled = clamped * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled));
  const a = road.points[segmentIndex];
  const b = road.points[(segmentIndex + 1) % road.points.length] ?? a;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

function applyScenicLandforms(terrain: TerrainData, config: WorldGenerationConfig, preset: GenericPreset) {
  if (preset === "city") return terrain;
  const rng = createSeededRng(config.seed + 24601);
  const showcasePreset = Boolean(config.metadata?.tags?.some((tag) => /showcase|kenney/i.test(tag)));
  let next = terrain;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  const isDramatic = config.theme === "mountain" || config.theme === "biblical";
  const plateaus = [
    { x: -halfW * 0.38, z: halfD * 0.18, size: terrain.width * 0.18, strength: isDramatic ? 1.28 : 1.05, materialId: "rock", mode: "raise" as const },
    { x: halfW * 0.18, z: -halfD * 0.14, size: terrain.width * 0.16, strength: isDramatic ? 1.18 : 0.94, materialId: "rock", mode: "raise" as const },
    { x: halfW * 0.03, z: halfD * 0.3, size: terrain.width * 0.14, strength: isDramatic ? 1.02 : 0.82, materialId: "grass", mode: "raise" as const },
    { x: halfW * 0.33, z: halfD * 0.05, size: terrain.width * 0.12, strength: isDramatic ? 1.12 : 0.9, materialId: "rock", mode: "raise" as const },
  ];
  for (const plateau of plateaus) {
    next = applyTerrainBrush(
      next,
      new THREE.Vector3(plateau.x, 0, plateau.z),
      {
        size: plateau.size,
        strength: plateau.strength,
        falloff: "smooth",
        materialId: plateau.materialId,
      },
      plateau.mode,
    );
  }

  const valleys = [
    { x: -halfW * 0.1, z: halfD * 0.02, size: terrain.width * 0.14, strength: 0.86, materialId: config.theme === "desert" ? "sand" : "mud" },
    { x: halfW * 0.12, z: -halfD * 0.1, size: terrain.width * 0.12, strength: 0.82, materialId: config.theme === "desert" ? "sand" : "mud" },
    { x: -halfW * 0.28, z: halfD * 0.22, size: terrain.width * 0.1, strength: 0.74, materialId: config.theme === "desert" ? "sand" : "mud" },
    { x: halfW * 0.28, z: halfD * 0.18, size: terrain.width * 0.09, strength: 0.7, materialId: config.theme === "desert" ? "sand" : "mud" },
  ];
  for (const valley of valleys) {
    next = applyTerrainBrush(
      next,
      new THREE.Vector3(valley.x + (rng() - 0.5) * terrain.width * 0.06, 0, valley.z + (rng() - 0.5) * terrain.depth * 0.05),
      {
        size: valley.size,
        strength: valley.strength,
        falloff: "smooth",
        materialId: valley.materialId,
      },
      "lower",
    );
  }

  if (showcasePreset) {
    const heroFeatures = [
      { x: -halfW * 0.12, z: -halfD * 0.06, size: terrain.width * 0.22, strength: 1.95, materialId: "rock", mode: "raise" as const },
      { x: halfW * 0.18, z: halfD * 0.1, size: terrain.width * 0.2, strength: 1.72, materialId: "rock", mode: "raise" as const },
      { x: -halfW * 0.34, z: halfD * 0.18, size: terrain.width * 0.12, strength: 1.28, materialId: "rock", mode: "raise" as const },
      { x: halfW * 0.08, z: -halfD * 0.24, size: terrain.width * 0.14, strength: 1.18, materialId: "mud", mode: "lower" as const },
      { x: -halfW * 0.24, z: halfD * 0.22, size: terrain.width * 0.12, strength: 1.08, materialId: "mud", mode: "lower" as const },
    ];
    for (const feature of heroFeatures) {
      next = applyTerrainBrush(
        next,
        new THREE.Vector3(feature.x, 0, feature.z),
        {
          size: feature.size,
          strength: feature.strength,
          falloff: "smooth",
          materialId: feature.materialId,
        },
        feature.mode,
      );
    }
  }

  return next;
}

function pointInPolygon(point: { x: number; z: number }, polygon: Vector3Data[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect = ((zi > point.z) !== (zj > point.z)) && point.x < ((xj - xi) * (point.z - zi)) / ((zj - zi) || 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function zoneContainsPoint(zone: ScatterZone, point: { x: number; z: number }) {
  if (zone.shape === "circle" && zone.points.length <= 2) {
    const [a, b] = zone.points;
    if (!a || !b) return false;
    const radius = Math.hypot(b.x - a.x, b.z - a.z) * 0.5;
    const center = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    return Math.hypot(point.x - center.x, point.z - center.z) <= radius;
  }
  if (zone.shape === "rectangle" && zone.points.length <= 2) {
    const [a, b] = zone.points;
    if (!a || !b) return false;
    return point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) && point.z >= Math.min(a.z, b.z) && point.z <= Math.max(a.z, b.z);
  }
  return pointInPolygon(point, zone.points);
}

function chooseAssetByTags(assets: AssetDefinition[], tags: string[], rng: () => number) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  const tagged = assets.filter((asset) => normalizedTags.some((tag) => asset.tags.some((assetTag) => assetTag.toLowerCase().includes(tag))));
  const pool = tagged.length > 0 ? tagged : assets;
  return pick(rng, pool);
}

function buildFallbackPathConfig(config: WorldGenerationConfig, preset: GenericPreset): WorldGenerationPathConfig[] {
  if (config.paths?.length) return config.paths;
  if (preset === "city") {
    return [
      {
        id: "city-grid-main",
        type: "grid",
        tags: ["street", "grid"],
        width: Math.max(4, config.terrain.width * 0.03),
        complexity: 0.4,
        smoothing: 0.6,
        spacing: Math.max(14, Math.round(config.terrain.width * 0.18)),
        closedLoop: false,
        materialId: "track",
        flattenTerrain: true,
        smoothEdges: true,
      },
    ];
  }
  return config.roads.map((road, index) => ({
    id: `legacy-road-${config.seed}-${index + 1}`,
    type: road.type === "loop" ? "loop" : road.type === "trail" ? "trail" : "path",
    tags: [road.type, road.materialId, preset, road.checkpoints > 0 ? "checkpointed" : "route"],
    width: road.width,
    complexity: Math.max(4, road.complexity ?? 6),
    smoothing: 0.6,
    materialId: road.materialId,
    flattenTerrain: true,
    smoothEdges: true,
    checkpoints: road.checkpoints,
  }));
}

function buildPathRoads(paths: WorldGenerationPathConfig[], terrain: TerrainData, config: WorldGenerationConfig, preset: GenericPreset): RoadDefinition[] {
  const bounds = worldBounds(terrain);
  const roads: RoadDefinition[] = [];
  const rng = createSeededRng(config.seed + 8191);

  for (const [pathIndex, path] of paths.entries()) {
    if (path.type === "grid") {
      const spacing = path.spacing ?? Math.max(12, Math.round(Math.min(terrain.width, terrain.depth) * 0.2));
      const count = Math.max(2, Math.round((terrain.width / spacing) * 0.6));
      for (let i = 0; i < count; i += 1) {
        const offset = lerp(bounds.minX * 0.5, bounds.maxX * 0.5, count === 1 ? 0.5 : i / (count - 1));
        const points = [
          { x: offset, y: 0.2, z: bounds.minZ },
          { x: offset + Math.sin(i * 0.9) * spacing * 0.15, y: 0.2, z: bounds.maxZ },
        ];
        roads.push({
          id: stableId(path.id ?? "grid-path", config.seed, pathIndex, i),
          name: `${preset === "city" ? "Street" : "Path"} ${pathIndex + 1}-${i + 1}`,
          points,
          width: path.width,
          materialId: path.materialId ?? "track",
          flattenTerrain: path.flattenTerrain ?? true,
          smoothEdges: path.smoothEdges ?? true,
          closedLoop: false,
          checkpointIds: [],
        });
      }
      continue;
    }

    if (path.points && path.points.length > 0) {
      const points = path.points.map((point, pointIndex) => ({
        x: point.x,
        y: point.y ?? sampleTerrainHeight(terrain, { x: point.x, y: 0, z: point.z }) + 0.2,
        z: point.z,
      }));
      roads.push({
        id: path.id ?? stableId("path", config.seed, pathIndex),
        name: `${path.type === "loop" ? "Loop" : path.type === "ring" ? "Ring" : "Path"} ${pathIndex + 1}`,
        points,
        width: path.width,
        materialId: path.materialId ?? (preset === "city" ? "dirt" : "track"),
        flattenTerrain: path.flattenTerrain ?? true,
        smoothEdges: path.smoothEdges ?? true,
        closedLoop: path.closedLoop ?? (path.type === "loop" || path.type === "ring"),
        checkpointIds: Array.from({ length: Math.max(0, path.checkpoints ?? 0) }, (_, checkpointIndex) => stableId(`${path.id ?? "path"}-cp`, config.seed, checkpointIndex)),
      });
      continue;
    }

    if (path.type === "loop" || path.type === "ring") {
      const center = path.center ?? { x: 0, z: 0 };
      const radius = path.radius ?? Math.min(terrain.width, terrain.depth) * 0.28;
      const pointCount = Math.max(8, Math.round((path.complexity || 8) * 1.2));
      const points = Array.from({ length: pointCount }, (_, pointIndex) => {
        const t = pointIndex / pointCount;
        const angle = t * Math.PI * 2;
        const wobble = 0.82 + Math.sin(angle * 3 + config.seed * 0.03) * 0.12 + rng() * 0.08;
        return {
          x: center.x + Math.cos(angle) * radius * wobble,
          y: sampleTerrainHeight(terrain, { x: center.x, y: 0, z: center.z }) + 0.2,
          z: center.z + Math.sin(angle) * radius * wobble,
        };
      });
      roads.push({
        id: path.id ?? stableId("path", config.seed, pathIndex),
        name: `${path.type === "ring" ? "Ring" : "Loop"} ${pathIndex + 1}`,
        points,
        width: path.width,
        materialId: path.materialId ?? "track",
        flattenTerrain: path.flattenTerrain ?? true,
        smoothEdges: path.smoothEdges ?? true,
        closedLoop: true,
        checkpointIds: Array.from({ length: Math.max(0, path.checkpoints ?? 0) }, (_, checkpointIndex) => stableId(`${path.id ?? "path"}-cp`, config.seed, checkpointIndex)),
      });
      continue;
    }

    if (path.type === "branching") {
      const start = path.start ?? { x: bounds.minX * 0.68, z: bounds.minZ * 0.1 };
      const end = path.end ?? { x: bounds.maxX * 0.72, z: bounds.maxZ * 0.12 };
      const spinePointCount = Math.max(6, Math.round(path.complexity * 1.1));
      const spine = Array.from({ length: spinePointCount }, (_, pointIndex) => {
        const t = spinePointCount === 1 ? 0 : pointIndex / (spinePointCount - 1);
        const sway = Math.sin(t * Math.PI) * terrain.width * 0.04 * (path.complexity / 10);
        const x = lerp(start.x, end.x, t) + sway * Math.sin((config.seed + pathIndex) * 0.02 + t * 3.1);
        const z = lerp(start.z, end.z, t) + sway * Math.cos((config.seed + pathIndex) * 0.015 + t * 2.8);
        return {
          x,
          y: sampleTerrainHeight(terrain, { x, y: 0, z }) + 0.2,
          z,
        };
      });
      roads.push({
        id: path.id ?? stableId("path", config.seed, pathIndex),
        name: `${preset === "city" ? "Street" : "Path"} Spine ${pathIndex + 1}`,
        points: spine,
        width: path.width,
        materialId: path.materialId ?? "track",
        flattenTerrain: path.flattenTerrain ?? true,
        smoothEdges: path.smoothEdges ?? true,
        closedLoop: false,
        checkpointIds: Array.from({ length: Math.max(0, path.checkpoints ?? 0) }, (_, checkpointIndex) => stableId(`${path.id ?? "path"}-cp`, config.seed, checkpointIndex)),
      });
      const branchCount = Math.max(2, path.branches ?? 2);
      const midPoint = spine[Math.floor(spine.length / 2)] ?? spine[0];
      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const direction = branchIndex % 2 === 0 ? 1 : -1;
        const points = [
          { x: midPoint.x, y: midPoint.y, z: midPoint.z },
          {
            x: midPoint.x + direction * terrain.width * 0.08,
            y: sampleTerrainHeight(terrain, { x: midPoint.x + direction * terrain.width * 0.08, y: 0, z: midPoint.z + terrain.depth * 0.06 }) + 0.2,
            z: midPoint.z + terrain.depth * (0.06 + branchIndex * 0.015),
          },
          {
            x: midPoint.x + direction * terrain.width * 0.16,
            y: sampleTerrainHeight(terrain, { x: midPoint.x + direction * terrain.width * 0.16, y: 0, z: midPoint.z + terrain.depth * 0.11 }) + 0.2,
            z: midPoint.z + terrain.depth * (0.11 + branchIndex * 0.02),
          },
        ];
        roads.push({
          id: stableId(path.id ?? "branch", config.seed, pathIndex, branchIndex),
          name: `${preset === "city" ? "Avenue" : "Branch"} ${pathIndex + 1}-${branchIndex + 1}`,
          points,
          width: Math.max(3, path.width * 0.75),
          materialId: path.materialId ?? "track",
          flattenTerrain: path.flattenTerrain ?? true,
          smoothEdges: path.smoothEdges ?? true,
          closedLoop: false,
          checkpointIds: [],
        });
      }
      continue;
    }

    const start = path.start ?? { x: bounds.minX * 0.7, z: bounds.minZ * 0.1 };
    const end = path.end ?? { x: bounds.maxX * 0.7, z: bounds.maxZ * 0.15 };
    const segmentCount = Math.max(5, Math.round(path.complexity * 1.2));
    const points = Array.from({ length: segmentCount }, (_, pointIndex) => {
      const t = segmentCount === 1 ? 0 : pointIndex / (segmentCount - 1);
      const bend = Math.sin(t * Math.PI) * (path.complexity * 0.08) * terrain.width;
      const x = lerp(start.x, end.x, t) + bend * Math.sin((config.seed + pathIndex) * 0.013 + t * 2.4);
      const z = lerp(start.z, end.z, t) + bend * Math.cos((config.seed + pathIndex) * 0.011 + t * 1.7);
      return {
        x,
        y: sampleTerrainHeight(terrain, { x, y: 0, z }) + 0.2,
        z,
      };
    });
    roads.push({
      id: path.id ?? stableId("path", config.seed, pathIndex),
      name: `${path.type === "trail" ? "Trail" : "Path"} ${pathIndex + 1}`,
      points,
      width: path.width,
      materialId: path.materialId ?? "track",
      flattenTerrain: path.flattenTerrain ?? true,
      smoothEdges: path.smoothEdges ?? true,
      closedLoop: Boolean(path.closedLoop),
      checkpointIds: Array.from({ length: Math.max(0, path.checkpoints ?? 0) }, (_, checkpointIndex) => stableId(`${path.id ?? "path"}-cp`, config.seed, checkpointIndex)),
    });
  }

  return roads;
}

function buildZonesFromConfig(config: WorldGenerationConfig, terrain: TerrainData, preset: GenericPreset): ScatterZone[] {
  const rng = createSeededRng(config.seed + 14413);
  const zoneConfigs = config.zones?.length ? config.zones : config.biomes.map((biome, index) => ({
    id: biome.id || `biome-${index + 1}`,
    type: "blob" as const,
    tags: [biome.id, ...biome.assetTags, preset],
    center: {
      x: (rng() - 0.5) * terrain.width * 0.5,
      z: (rng() - 0.5) * terrain.depth * 0.5,
    },
    radius: Math.max(12, Math.min(terrain.width, terrain.depth) * (0.16 + biome.density * 0.18)),
    irregularity: 0.18 + biome.density * 0.18,
    materialId: biome.materialId,
    assetTags: biome.assetTags,
  })) as WorldGenerationZoneConfig[];

  return zoneConfigs.map((zone, index) => {
    const polygon = createPolygonFromZone(zone);
    const assetIds = zone.assetTags ?? [];
    return {
      id: zone.id ?? stableId("zone", config.seed, index),
      name: zone.tags[0] ?? `Zone ${index + 1}`,
      shape: zone.type === "circle" ? "circle" : zone.type === "rect" ? "rectangle" : "polygon",
      points: polygon,
      assetIds,
      tags: [...zone.tags],
      materialId: zone.materialId,
      settings: {
        count: Math.max(1, Math.round((zone.assetTags?.length ?? 1) * 6)),
        minSpacing: 2.5,
        randomScaleMin: 0.8,
        randomScaleMax: 1.4,
        randomRotation: true,
        slopeLimit: 35,
      },
      generatedObjectIds: [],
    };
  });
}

function buildPlacementRules(config: WorldGenerationConfig, preset: GenericPreset) {
  if (config.placementRules?.length) {
    return config.placementRules;
  }
  const avoidTag = preset === "city" ? "street" : "primary";
  return config.biomes.map((biome, index) => ({
    id: biome.id || `placement-${index + 1}`,
    assetTags: biome.assetTags.length ? biome.assetTags : [biome.id],
    zoneTags: [biome.id],
    avoidPathTags: [avoidTag],
    slopeMax: Math.max(12, 35 - Math.round(biome.density * 18)),
    density: biome.density,
    count: Math.max(1, Math.round(biome.density * 18)),
    minSpacing: biome.density > 0.5 ? 3 : 5,
    cluster: biome.density > 0.4
      ? { enabled: true, clusterCount: Math.max(2, Math.round(biome.density * 6)), radius: 10 + biome.density * 8 }
      : undefined,
  }));
}

function zoneAreaContainsPoint(zone: ScatterZone, point: Vector3Data) {
  return zoneContainsPoint(zone, { x: point.x, z: point.z });
}

function choosePlacementPoint(
  terrain: TerrainData,
  zones: ScatterZone[],
  rule: WorldGenerationPlacementRuleConfig,
  roads: RoadDefinition[],
  rng: () => number,
) {
  const bounds = worldBounds(terrain);
  const selectedZones = rule.zoneTags?.length
    ? zones.filter((zone) => rule.zoneTags!.some((tag) => (zone.tags ?? []).some((zoneTag) => zoneTag.toLowerCase().includes(tag.toLowerCase())) || zone.name.toLowerCase().includes(tag.toLowerCase()) || zone.assetIds.some((assetId) => assetId.toLowerCase().includes(tag.toLowerCase()))))
    : zones;
  const zonePool = selectedZones.length > 0 ? selectedZones : zones;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const zone = pick(rng, zonePool);
    let x = 0;
    let z = 0;
    if (zone) {
      const xs = zone.points.map((point) => point.x);
      const zs = zone.points.map((point) => point.z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      for (let zoneAttempt = 0; zoneAttempt < 20; zoneAttempt += 1) {
        x = lerp(minX, maxX, rng());
        z = lerp(minZ, maxZ, rng());
        if (zoneContainsPoint(zone, { x, z })) break;
      }
    } else {
      x = lerp(bounds.minX, bounds.maxX, rng());
      z = lerp(bounds.minZ, bounds.maxZ, rng());
    }

    const point = { x: x ?? 0, y: 0, z: z ?? 0 };
    const grid = terrainWorldToGrid(new THREE.Vector3(point.x, 0, point.z), terrain);
    point.y = terrain.heights[grid.index] ?? 0;
    const slope = terrainSlopeAt(new THREE.Vector3(point.x, point.y, point.z), terrain);
    if (rule.slopeMax !== undefined && slope > rule.slopeMax) continue;
    if (rule.avoidPathTags?.length && roads.length > 0) {
      if (isPointNearRoad(new THREE.Vector3(point.x, point.y, point.z), roads)) continue;
    }
    return point;
  }
  return null;
}

function generatePlacements(
  config: WorldGenerationConfig,
  terrain: TerrainData,
  roads: RoadDefinition[],
  zones: ScatterZone[],
  preset: GenericPreset,
  assetSource: AssetDefinition[],
): PlacedObject[] {
  const registry = buildAssetRegistry(assetSource);
  const rules = buildPlacementRules(config, preset);
  const placed: PlacedObject[] = [];
  const occupied: Vector3Data[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    const targetCount = rule.count ?? Math.max(1, Math.round((rule.density ?? 0.25) * 16));
    const ruleRng = createSeededRng(hashString(`${config.seed}:${rule.id ?? ruleIndex}:${preset}`));
    let spawned = 0;
    for (let i = 0; i < targetCount * 20 && spawned < targetCount; i += 1) {
      const point = choosePlacementPoint(terrain, zones, rule, roads, ruleRng);
      if (!point) continue;
      const minSpacing = rule.minSpacing ?? 0;
      if (minSpacing > 0 && occupied.some((entry) => Math.hypot(entry.x - point.x, entry.z - point.z) < minSpacing)) continue;
      if (rule.avoidPathTags?.length && roads.some((road) => rule.avoidPathTags!.some((tag) => road.name.toLowerCase().includes(tag.toLowerCase()) || road.id.toLowerCase().includes(tag.toLowerCase())) && isPointNearRoad(new THREE.Vector3(point.x, point.y, point.z), [road]))) {
        continue;
      }
      const asset = chooseAssetByTags(registry.entries, rule.assetTags, ruleRng);
      if (!asset || asset.placementRules?.scatterEligible === false) continue;
      const role = classifyAsset(asset);
      const roleScaleBoost = role === "foliage" ? 1.28 : role === "rock" ? 1.14 : role === "structure" ? 1.02 : role === "barrier" ? 0.96 : 1;
      const roleScaleSpread = role === "foliage" ? 1.42 : role === "rock" ? 1.26 : role === "structure" ? 1.1 : role === "barrier" ? 1.05 : 1.15;
      const scaleMin = (asset.placementRules?.minScale ?? asset.defaultScale * 0.85) * roleScaleBoost;
      const scaleMax = (asset.placementRules?.maxScale ?? asset.defaultScale * 1.2) * roleScaleSpread;
      const scale = lerp(scaleMin, scaleMax, ruleRng());
      const object: PlacedObject = {
        id: stableId("obj", config.seed, placed.length, ruleIndex),
        assetId: asset.id,
        name: `${asset.name} ${placed.length + 1}`,
        position: point,
        rotation: { x: 0, y: ruleRng() * Math.PI * 2, z: 0 },
        scale: { x: scale, y: scale, z: scale },
        layerId: role === "foliage" ? "layer-foliage" : "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: role !== "foliage",
      };
      placed.push(object);
      occupied.push(point);
      spawned += 1;
    }
  }

  return placed;
}

function generatePlacementGroups(
  config: WorldGenerationConfig,
  terrain: TerrainData,
  roads: RoadDefinition[],
  zones: ScatterZone[],
  preset: GenericPreset,
  assetSource: AssetDefinition[],
): FoliageGroup[] {
  const registry = buildAssetRegistry(assetSource);
  const rules = buildPlacementRules(config, preset);
  const groups: FoliageGroup[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    const targetCount = Math.max(3, rule.count ?? Math.max(1, Math.round((rule.density ?? 0.25) * 16)));
    const groupAssetIds = registry.entries
      .filter((asset) => rule.assetTags.some((tag) => asset.tags.some((assetTag) => assetTag.toLowerCase().includes(tag.toLowerCase())) || asset.category.toLowerCase().includes(tag.toLowerCase())))
      .map((asset) => asset.id);
    const assetIds = groupAssetIds.length > 0 ? groupAssetIds : registry.entries.slice(0, 2).map((asset) => asset.id);
    const groupRng = createSeededRng(hashString(`${config.seed}:${rule.id ?? ruleIndex}:group:${preset}`));
    const instances = Array.from({ length: targetCount }, (_, instanceIndex) => {
      const point = choosePlacementPoint(terrain, zones, rule, roads, groupRng) ?? {
        x: (groupRng() - 0.5) * terrain.width * 0.35,
        y: 0,
        z: (groupRng() - 0.5) * terrain.depth * 0.35,
      };
      const assetId = assetIds[instanceIndex % assetIds.length];
      const asset = registry.byId[assetId] ?? registry.entries[0];
      const role = asset ? classifyAsset(asset) : "generic";
      const roleScaleBoost = role === "foliage" ? 1.35 : role === "rock" ? 1.16 : role === "structure" ? 1.04 : role === "barrier" ? 0.96 : 1;
      const roleScaleSpread = role === "foliage" ? 1.48 : role === "rock" ? 1.32 : role === "structure" ? 1.12 : role === "barrier" ? 1.05 : 1.16;
      const scaleMin = (asset?.placementRules?.minScale ?? asset?.defaultScale ?? 1) * roleScaleBoost;
      const scaleMax = (asset?.placementRules?.maxScale ?? asset?.defaultScale ?? 1.2) * roleScaleSpread;
      const scale = lerp(scaleMin, scaleMax, groupRng());
      return {
        id: stableId("placement", config.seed, groups.length, instanceIndex),
        assetId: asset?.id ?? assetIds[0],
        position: point,
        rotation: { x: 0, y: groupRng() * Math.PI * 2, z: 0 },
        scale: { x: scale, y: scale, z: scale },
      };
    });

    groups.push({
      id: `placement-${rule.id ?? ruleIndex}`,
      name: `${preset === "city" ? "City" : "Placement"} ${rule.id ?? ruleIndex + 1}`,
      assetIds,
      instances,
      settings: {
        density: rule.density ?? 0.35,
        minSpacing: rule.minSpacing ?? 2.5,
        randomScaleMin: 0.8,
        randomScaleMax: 1.4,
        randomRotation: true,
        slopeLimit: rule.slopeMax ?? 35,
        avoidRoads: true,
        eraseMode: false,
      },
    });
  }

  return groups;
}

function injectHeroLandmarks(
  config: WorldGenerationConfig,
  terrain: TerrainData,
  roads: RoadDefinition[],
  zones: ScatterZone[],
  assetSource: AssetDefinition[],
  project: WorldProject,
): WorldProject {
  const registry = buildAssetRegistry(assetSource);
  const next = structuredClone(project);
  const objects = [...next.objects];
  const occupy = (position: Vector3Data, minDistance = 3.5) =>
    objects.some((entry) => Math.hypot(entry.position.x - position.x, entry.position.z - position.z) < minDistance);

  const bridgeAsset = registry.byTag.bridge?.[0] ?? registry.entries.find((entry) => entry.id === "demo-bridge");
  const tentAsset = registry.byTag.tent?.[0] ?? registry.entries.find((entry) => entry.id === "demo-tent");
  const campfireAsset = registry.byTag.camp?.[0] ?? registry.byTag.fire?.[0] ?? registry.entries.find((entry) => entry.id === "demo-campfire");
  const towerAsset = registry.byTag.tower?.[0];
  const boulderAsset = registry.byTag.boulder?.[0] ?? registry.byTag.rock?.[0] ?? registry.entries.find((entry) => entry.id === "demo-boulder");

  const waterRoad = roads.find((road) => road.materialId === "water") ?? roads.find((road) => road.name.toLowerCase().includes("river"));
  const primaryRoad = roads.find((road) => road.id.includes("primary")) ?? roads[0];
  if (waterRoad && bridgeAsset) {
    const bridgePoint = roadPointAt(waterRoad, 0.5);
    const tangent = roadDirectionAt(primaryRoad ?? waterRoad, 0.5);
    const bridgePosition = {
      x: bridgePoint.x,
      y: sampleTerrainHeight(terrain, { x: bridgePoint.x, y: 0, z: bridgePoint.z }) + 1.0,
      z: bridgePoint.z,
    };
    if (!occupy(bridgePosition, 5.5)) {
      objects.push({
        id: stableId("landmark-bridge", config.seed, 0),
        assetId: bridgeAsset.id,
        name: bridgeAsset.name,
        position: bridgePosition,
        rotation: { x: 0, y: Math.atan2(tangent.x, tangent.z), z: 0 },
        scale: { x: 1.95, y: 1.95, z: 1.95 },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      });
    }
    if (boulderAsset) {
      const sideOffsets = [
        { x: 3.5, z: 2.2 },
        { x: -4.1, z: -2.6 },
      ];
      for (const [index, offset] of sideOffsets.entries()) {
        const rockPoint = {
          x: bridgePosition.x + offset.x,
          y: sampleTerrainHeight(terrain, { x: bridgePosition.x + offset.x, y: 0, z: bridgePosition.z + offset.z }) + 0.15,
          z: bridgePosition.z + offset.z,
        };
        if (occupy(rockPoint, 2.5)) continue;
        objects.push({
          id: stableId("landmark-rock", config.seed, index),
          assetId: boulderAsset.id,
          name: `${boulderAsset.name} ${index + 1}`,
          position: rockPoint,
          rotation: { x: 0, y: index * 1.47, z: 0 },
          scale: { x: 1.35 + index * 0.12, y: 1.35 + index * 0.12, z: 1.35 + index * 0.12 },
          layerId: "layer-props",
          visible: true,
          locked: false,
          collisionEnabled: true,
        });
      }
    }
  }

  const clearingZone = zones.find((zone) => (zone.tags ?? []).some((tag) => tag.toLowerCase().includes("clearing")));
  if (clearingZone && tentAsset && campfireAsset) {
    const center = centroidOfZone(clearingZone);
    const baseY = sampleTerrainHeight(terrain, { x: center.x, y: 0, z: center.z }) + 0.12;
    const campPoints = [
      { asset: tentAsset, position: { x: center.x + 3.2, y: baseY, z: center.z - 1.2 }, rotationY: 0.35, scale: 1.32 },
      { asset: tentAsset, position: { x: center.x - 2.8, y: baseY, z: center.z + 1.8 }, rotationY: -0.84, scale: 1.18 },
      { asset: campfireAsset, position: { x: center.x + 0.3, y: baseY, z: center.z + 0.5 }, rotationY: 0.0, scale: 1.0 },
    ];
    for (const [index, entry] of campPoints.entries()) {
      if (occupy(entry.position, 3.0)) continue;
      objects.push({
        id: stableId("camp", config.seed, index),
        assetId: entry.asset.id,
        name: `${entry.asset.name} ${index + 1}`,
        position: entry.position,
        rotation: { x: 0, y: entry.rotationY, z: 0 },
        scale: { x: entry.scale, y: entry.scale, z: entry.scale },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      });
    }
  }

  if (towerAsset) {
    const candidateZones = zones.filter((zone) => (zone.tags ?? []).some((tag) => /ridge|rock|forest/i.test(tag)));
    const zone = candidateZones[0] ?? zones[0];
    if (zone) {
      const centroid = centroidOfZone(zone);
      const towerY = sampleTerrainHeight(terrain, { x: centroid.x, y: 0, z: centroid.z }) + 0.2;
      const towerPosition = { x: centroid.x - 6, y: towerY, z: centroid.z - 4 };
      if (!occupy(towerPosition, 4)) {
        objects.push({
          id: stableId("lookout", config.seed, 0),
          assetId: towerAsset.id,
          name: towerAsset.name,
          position: towerPosition,
          rotation: { x: 0, y: 0.52, z: 0 },
          scale: { x: 1.55, y: 1.55, z: 1.55 },
          layerId: "layer-props",
          visible: true,
          locked: false,
          collisionEnabled: true,
        });
      }
    }
  }

  next.objects = objects;
  return next;
}

function generateMarkersFromConfig(config: WorldGenerationConfig, roads: RoadDefinition[]): GameplayMarker[] {
  const markers: GameplayMarker[] = [];
  const primaryRoad = roads[0];
  if (!primaryRoad) return markers;
  const checkpoints = Math.max(0, config.gameplay.checkpoints);
  if (config.gameplay.startFinish) {
    markers.push({
      id: stableId("start", config.seed, 0),
      type: "start-finish",
      name: "Start / Finish",
      position: { ...primaryRoad.points[0] },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 8,
      metadata: { generated: true },
    });
  }
  for (let i = 0; i < checkpoints; i += 1) {
    const pointIndex = Math.min(primaryRoad.points.length - 1, Math.max(1, Math.floor(((i + 1) / (checkpoints + 1)) * primaryRoad.points.length)));
    const point = primaryRoad.points[pointIndex] ?? primaryRoad.points[primaryRoad.points.length - 1] ?? primaryRoad.points[0];
    markers.push({
      id: stableId("checkpoint", config.seed, i + 1),
      type: "checkpoint",
      name: `Checkpoint ${i + 1}`,
      position: { ...point },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 8,
      metadata: { order: i + 1, generated: true },
    });
  }
  return markers;
}

function applyZoneMaterialOverrides(terrain: TerrainData, zones: ScatterZone[]) {
  if (!zones.length) return terrain;
  let next = terrain;
  for (const zone of zones) {
    const materialId = zone.materialId ?? (zone.name.toLowerCase().includes("desert") ? "sand" : zone.name.toLowerCase().includes("rock") ? "rock" : zone.name.toLowerCase().includes("mud") ? "mud" : zone.name.toLowerCase().includes("street") ? "track" : undefined);
    if (!materialId) continue;
    const xs = zone.points.map((point) => point.x);
    const zs = zone.points.map((point) => point.z);
    const minX = Math.floor(Math.min(...xs));
    const maxX = Math.ceil(Math.max(...xs));
    const minZ = Math.floor(Math.min(...zs));
    const maxZ = Math.ceil(Math.max(...zs));
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const worldPoint = { x, y: 0, z };
        if (!zoneAreaContainsPoint(zone, worldPoint)) continue;
        const grid = terrainWorldToGrid(new THREE.Vector3(x, 0, z), next);
        const index = grid.index;
        next = {
          ...next,
          materialMap: next.materialMap.map((entry, mapIndex) => (mapIndex === index ? materialId : entry)),
        };
      }
    }
  }
  return next;
}

export function generateGenericWorld(config: WorldGenerationConfig, preset: GenericPreset, assetSource: AssetDefinition[] = createDefaultProject().assets): WorldProject {
  const base = createDefaultProject();
  const terrain = buildGenericTerrain(config.seed, config.terrain, preset === "city" ? 0.26 : preset === "generic" ? 0.52 : 0.68);
  const scenicTerrain = applyScenicLandforms(terrain, config, preset);
  const pathConfigs = buildFallbackPathConfig(config, preset);
  const roads = buildPathRoads(pathConfigs, scenicTerrain, config, preset);
  const flattened = flattenRoadsIntoTerrain(scenicTerrain, roads);
  const surfaced = applyRoadSurfaceTreatment(flattened, roads, config.seed, config.theme);
  let withPathEffects = surfaced;
  for (const path of roads) {
    withPathEffects = applyPathEffects(
      withPathEffects,
      [{
        id: path.id,
        points: path.points,
        width: path.width,
        tags: [preset, ...(path.closedLoop ? ["loop"] : ["trail"]), path.materialId],
        closedLoop: path.closedLoop,
      }],
      path.materialId ?? "track",
    );
  }
  const zones = buildZonesFromConfig(config, withPathEffects, preset);
  const zoneMaterialTerrain = applyZoneMaterialOverrides(withPathEffects, zones);
  const assetRegistrySource = assetSource.length > 0 ? assetSource : base.assets;
  const project: WorldProject = {
    ...base,
    id: `generated-${preset}-${config.seed}`,
    name: `Generated ${config.theme} World`,
    version: base.version,
    createdAt: new Date(1_700_000_000_000 + config.seed * 1000).toISOString(),
    updatedAt: new Date(1_700_000_000_000 + config.seed * 1000).toISOString(),
    terrain: zoneMaterialTerrain,
    materials: buildBaseTerrainMaterials(),
    assets: base.assets,
    objects: [],
    foliageGroups: [],
    scatterZones: zones,
    roads,
    markers: generateMarkersFromConfig(config, roads),
    environment: { ...base.environment, ...(config.environment ?? {}) },
    layers: base.layers,
    metadata: {
      description: config.metadata?.description ?? `Generated ${preset} world from seed ${config.seed}`,
      tags: [...new Set(["showcase", "kenney", preset, config.theme, ...(config.metadata?.tags ?? [])])],
      showcaseLayout: config.metadata?.showcaseLayout,
    },
  };

  project.assets = assetRegistrySource.map((asset) => ({ ...asset }));
  project.foliageGroups = generatePlacementGroups(config, project.terrain, roads, zones, preset, assetRegistrySource);
  project.objects = generatePlacements(config, project.terrain, roads, zones, preset, assetRegistrySource);
  return injectHeroLandmarks(config, project.terrain, roads, zones, assetRegistrySource, project);
}
