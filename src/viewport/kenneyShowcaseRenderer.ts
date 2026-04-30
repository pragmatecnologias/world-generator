import * as THREE from "three";
import type { RoadDefinition, ScatterZone, TerrainData, WorldProject } from "../types";
import { DEFAULT_KENNEY_SHOWCASE_LAYOUT } from "../core/schema/ShowcaseLayoutSchema";
import { terrainIndex, terrainSlopeAt, terrainCellToWorld, isPointNearRoad } from "./terrain";
import { createPlacedKenneyModel } from "./kenneyModelLibrary";
import { buildKenneyShowcaseComposition } from "./kenneyShowcaseComposer";
import { buildKenneyIsoShowcaseComposition, buildKenneyReferencePlateComposition } from "./kenneyIsoShowcaseComposer";

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const GROUND_TILES = {
  grass: [
    "/assets/kenney_nature-kit/Isometric/ground_grass_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_grass_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_grass_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_grass_SW.png",
  ],
  path: [
    "/assets/kenney_nature-kit/Isometric/ground_pathTile_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathTile_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathTile_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathTile_SW.png",
  ],
  river: [
    "/assets/kenney_nature-kit/Isometric/ground_riverTile_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverTile_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverTile_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverTile_SW.png",
  ],
  riverBank: [
    "/assets/kenney_nature-kit/Isometric/ground_riverBendBank_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverBendBank_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverBendBank_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_riverBendBank_SW.png",
  ],
  pathBank: [
    "/assets/kenney_nature-kit/Isometric/ground_pathBendBank_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathBendBank_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathBendBank_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathBendBank_SW.png",
  ],
  pathRocks: [
    "/assets/kenney_nature-kit/Isometric/ground_pathRocks_NE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathRocks_NW.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathRocks_SE.png",
    "/assets/kenney_nature-kit/Isometric/ground_pathRocks_SW.png",
  ],
  cliffTop: [
    "/assets/kenney_nature-kit/Isometric/cliff_top_rock_NE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_top_rock_NW.png",
    "/assets/kenney_nature-kit/Isometric/cliff_top_rock_SE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_top_rock_SW.png",
  ],
  cliffLarge: [
    "/assets/kenney_nature-kit/Isometric/cliff_large_rock_NE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_large_rock_NW.png",
    "/assets/kenney_nature-kit/Isometric/cliff_large_rock_SE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_large_rock_SW.png",
  ],
  cliffCorner: [
    "/assets/kenney_nature-kit/Isometric/cliff_corner_rock_NE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_corner_rock_NW.png",
    "/assets/kenney_nature-kit/Isometric/cliff_corner_rock_SE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_corner_rock_SW.png",
  ],
  cliffStep: [
    "/assets/kenney_nature-kit/Isometric/cliff_steps_rock_NE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_steps_rock_NW.png",
    "/assets/kenney_nature-kit/Isometric/cliff_steps_rock_SE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_steps_rock_SW.png",
  ],
  waterfall: [
    "/assets/kenney_nature-kit/Isometric/cliff_waterfall_rock_NE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_waterfall_rock_NW.png",
    "/assets/kenney_nature-kit/Isometric/cliff_waterfall_rock_SE.png",
    "/assets/kenney_nature-kit/Isometric/cliff_waterfall_rock_SW.png",
  ],
  treeTall: [
    "/assets/kenney_nature-kit/Isometric/tree_pineTallA_detailed_NE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineTallB_detailed_NW.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineTallC_detailed_SE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineTallD_detailed_SW.png",
  ],
  treeRound: [
    "/assets/kenney_nature-kit/Isometric/tree_pineRoundA_NE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineRoundB_NW.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineRoundC_SE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineRoundD_SW.png",
  ],
  treeSmall: [
    "/assets/kenney_nature-kit/Isometric/tree_pineSmallA_NE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineSmallB_NW.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineSmallC_SE.png",
    "/assets/kenney_nature-kit/Isometric/tree_pineSmallD_SW.png",
  ],
  rockLarge: [
    "/assets/kenney_nature-kit/Isometric/rock_largeA_NE.png",
    "/assets/kenney_nature-kit/Isometric/rock_largeB_NW.png",
    "/assets/kenney_nature-kit/Isometric/rock_largeC_SE.png",
    "/assets/kenney_nature-kit/Isometric/rock_largeD_SW.png",
    "/assets/kenney_nature-kit/Isometric/rock_largeE_NE.png",
    "/assets/kenney_nature-kit/Isometric/rock_largeF_NW.png",
  ],
  rockSmall: [
    "/assets/kenney_nature-kit/Isometric/rock_smallA_NE.png",
    "/assets/kenney_nature-kit/Isometric/rock_smallB_NW.png",
    "/assets/kenney_nature-kit/Isometric/rock_smallC_SE.png",
    "/assets/kenney_nature-kit/Isometric/rock_smallD_SW.png",
    "/assets/kenney_nature-kit/Isometric/rock_smallE_NE.png",
    "/assets/kenney_nature-kit/Isometric/rock_smallF_NW.png",
  ],
  bridge: [
    "/assets/kenney_nature-kit/Isometric/bridge_woodRound_NE.png",
    "/assets/kenney_nature-kit/Isometric/bridge_woodRound_NW.png",
    "/assets/kenney_nature-kit/Isometric/bridge_woodRound_SE.png",
    "/assets/kenney_nature-kit/Isometric/bridge_woodRound_SW.png",
  ],
  campfire: [
    "/assets/kenney_nature-kit/Isometric/campfire_stones_NE.png",
    "/assets/kenney_nature-kit/Isometric/campfire_stones_NW.png",
    "/assets/kenney_nature-kit/Isometric/campfire_stones_SE.png",
    "/assets/kenney_nature-kit/Isometric/campfire_stones_SW.png",
  ],
  tent: [
    "/assets/kenney_nature-kit/Isometric/tent_smallOpen_NE.png",
    "/assets/kenney_nature-kit/Isometric/tent_smallOpen_NW.png",
    "/assets/kenney_nature-kit/Isometric/tent_smallOpen_SE.png",
    "/assets/kenney_nature-kit/Isometric/tent_smallOpen_SW.png",
  ],
  fence: [
    "/assets/kenney_nature-kit/Isometric/fence_simpleLow_NE.png",
    "/assets/kenney_nature-kit/Isometric/fence_simpleLow_NW.png",
    "/assets/kenney_nature-kit/Isometric/fence_simpleLow_SE.png",
    "/assets/kenney_nature-kit/Isometric/fence_simpleLow_SW.png",
  ],
  sign: [
    "/assets/kenney_nature-kit/Isometric/sign_NE.png",
    "/assets/kenney_nature-kit/Isometric/sign_NW.png",
    "/assets/kenney_nature-kit/Isometric/sign_SE.png",
    "/assets/kenney_nature-kit/Isometric/sign_SW.png",
  ],
} as const;

function loadTexture(path: string) {
  const cached = textureCache.get(path);
  if (cached) return cached;
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  textureCache.set(path, texture);
  return texture;
}

function pickVariant(seed: number, x: number, z: number, variants: readonly string[]) {
  const hash = ((seed * 73856093) ^ (x * 19349663) ^ (z * 83492791)) >>> 0;
  return variants[hash % variants.length];
}

function createIsoSprite(path: string, x: number, y: number, z: number, width: number, height: number, renderOrder = 0) {
  const material = new THREE.SpriteMaterial({
    map: loadTexture(path),
    transparent: true,
    depthWrite: false,
    alphaTest: 0.08,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = renderOrder;
  return sprite;
}

function isInZone(point: { x: number; z: number }, zone: ScatterZone) {
  if (!zone.points.length) return false;
  if (zone.shape === "circle" && zone.points.length >= 2) {
    const [a, b] = zone.points;
    const centerX = (a.x + b.x) / 2;
    const centerZ = (a.z + b.z) / 2;
    const radius = Math.hypot(b.x - a.x, b.z - a.z) / 2;
    return Math.hypot(point.x - centerX, point.z - centerZ) <= radius;
  }
  if (zone.shape === "rectangle" && zone.points.length >= 2) {
    const [a, b] = zone.points;
    return point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) && point.z >= Math.min(a.z, b.z) && point.z <= Math.max(a.z, b.z);
  }
  let inside = false;
  for (let i = 0, j = zone.points.length - 1; i < zone.points.length; j = i++) {
    const xi = zone.points[i].x;
    const zi = zone.points[i].z;
    const xj = zone.points[j].x;
    const zj = zone.points[j].z;
    const intersect = (zi > point.z) !== (zj > point.z) && point.x < ((xj - xi) * (point.z - zi)) / ((zj - zi) || 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function zoneHasTag(zones: ScatterZone[], point: { x: number; z: number }, tags: string[]) {
  return zones.some((zone) => (zone.tags ?? []).some((tag) => tags.includes(tag)) && isInZone(point, zone));
}

function roadAtPoint(roads: RoadDefinition[], point: { x: number; y: number; z: number }) {
  for (const road of roads) {
    if (isPointNearRoad(new THREE.Vector3(point.x, point.y, point.z), [road])) return road;
  }
  return undefined;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function placeRibbon(
  group: THREE.Group,
  variants: readonly string[],
  points: Array<{ x: number; z: number; y?: number }>,
  options: {
    seed: number;
    width: number;
    height: number;
    renderOrder: number;
    spacing: number;
    yOffset?: number;
  },
) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const count = Math.max(1, Math.round(length / options.spacing));
    for (let step = 0; step <= count; step += 1) {
      const t = count === 0 ? 0 : step / count;
      const x = lerp(a.x, b.x, t);
      const z = lerp(a.z, b.z, t);
      const y = lerp(a.y ?? 0, b.y ?? 0, t) + (options.yOffset ?? 0);
      const texture = pickVariant(options.seed + i * 31 + step * 7, Math.floor(x * 10), Math.floor(z * 10), variants);
      group.add(createIsoSprite(texture, x, y, z, options.width, options.height, options.renderOrder));
    }
  }
}

function maybePlaceClusterTiles(
  group: THREE.Group,
  kind: "tree" | "rock" | "camp" | "fence" | "sign",
  seed: number,
  cx: number,
  cy: number,
  cz: number,
  count: number,
) {
  const scale = kind === "tree" ? 3.0 : kind === "rock" ? 2.2 : kind === "camp" ? 2.0 : kind === "fence" ? 1.7 : 1.5;
  const list = kind === "tree" ? [...GROUND_TILES.treeTall, ...GROUND_TILES.treeRound, ...GROUND_TILES.treeSmall]
    : kind === "rock" ? [...GROUND_TILES.rockLarge, ...GROUND_TILES.rockSmall]
      : kind === "camp" ? [...GROUND_TILES.campfire, ...GROUND_TILES.tent]
        : kind === "fence" ? GROUND_TILES.fence
          : GROUND_TILES.sign;
  for (let i = 0; i < count; i += 1) {
    const angle = ((seed + i * 17) % 100) / 100 * Math.PI * 2;
    const radius = 0.8 + ((seed + i * 13) % 100) / 100 * 2.6;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    const y = cy + ((i % 3) - 1) * 0.02;
    const texture = pickVariant(seed + i * 3, Math.floor(x * 10), Math.floor(z * 10), list);
    const width = (kind === "tree" ? 2.4 : kind === "rock" ? 1.8 : kind === "camp" ? 1.6 : 1.4) * scale;
    const height = (kind === "tree" ? 3.9 : kind === "rock" ? 1.4 : kind === "camp" ? 1.1 : 0.95) * scale;
    const sprite = createIsoSprite(texture, x, y, z, width, height, 40 + i);
    sprite.scale.multiplyScalar(0.92 + ((seed + i * 19) % 100) / 500);
    group.add(sprite);
  }
}

export function buildKenneyShowcaseDiorama(project: WorldProject) {
  const terrain = project.terrain;
  const group = new THREE.Group();
  group.name = "kenney-showcase-diorama";

  const projectIdParts = project.id.split("-");
  const seed = Number(projectIdParts[projectIdParts.length - 1]) || 42;
  const showcasePreset = Boolean(project.metadata?.tags?.some((tag) => /showcase|kenney/i.test(tag)));
  if (showcasePreset) {
    const layout = project.metadata?.showcaseLayout ?? DEFAULT_KENNEY_SHOWCASE_LAYOUT;
    if (layout.renderMode === "referencePlate") {
      return buildKenneyReferencePlateComposition();
    }
    return layout.renderMode === "models" ? buildKenneyShowcaseComposition(project, layout) : buildKenneyIsoShowcaseComposition(project, layout);
  }
  const coarseStep = Math.max(4, Math.floor(terrain.resolution / 28));

  for (let z = 0; z < terrain.resolution; z += coarseStep) {
    for (let x = 0; x < terrain.resolution; x += coarseStep) {
      const index = terrainIndex(x, z, terrain.resolution);
      const cell = terrainCellToWorld(x, z, terrain, 0);
      const height = terrain.heights[index] ?? 0;
      const slope = terrainSlopeAt(cell, terrain);
      const point = { x: cell.x, y: height, z: cell.z };
      const road = roadAtPoint(project.roads, point);
      const inForest = zoneHasTag(project.scatterZones, point, ["forest", "dense"]);
      const inCliff = zoneHasTag(project.scatterZones, point, ["cliff", "ridge", "waterfall"]);
      const inClearing = zoneHasTag(project.scatterZones, point, ["clearing", "open"]);

      if (road?.materialId === "water") {
        const texture = pickVariant(seed, x, z, GROUND_TILES.river);
        const sprite = createIsoSprite(texture, cell.x, height + 0.12, cell.z, 5.8, 5.8, 12);
        group.add(sprite);
        const bank = pickVariant(seed + 11, x, z, GROUND_TILES.riverBank);
        group.add(createIsoSprite(bank, cell.x, height + 0.08, cell.z, 6.1, 6.1, 11));
        continue;
      }

      if (road) {
        const texture = pickVariant(seed + 5, x, z, GROUND_TILES.path);
        group.add(createIsoSprite(texture, cell.x, height + 0.06, cell.z, 5.8, 5.8, 10));
        if (slope > 15) {
          const bank = pickVariant(seed + 7, x, z, GROUND_TILES.pathBank);
          group.add(createIsoSprite(bank, cell.x, height + 0.02, cell.z, 6.0, 6.0, 11));
        }
        if (slope > 20) {
          const rocks = pickVariant(seed + 9, x, z, GROUND_TILES.pathRocks);
          group.add(createIsoSprite(rocks, cell.x, height + 0.16, cell.z, 5.2, 5.2, 14));
        }
        continue;
      }

      if (slope > 22 || inCliff) {
        const cliffTile = slope > 32 ? pickVariant(seed + 13, x, z, GROUND_TILES.cliffLarge) : pickVariant(seed + 17, x, z, GROUND_TILES.cliffTop);
        group.add(createIsoSprite(cliffTile, cell.x, height + 0.05, cell.z, 7.2, 7.2, 15));
        if (slope > 28) {
          const stepTile = pickVariant(seed + 21, x, z, GROUND_TILES.cliffStep);
          group.add(createIsoSprite(stepTile, cell.x, height - 0.05, cell.z, 6.7, 6.7, 16));
        }
        if (zoneHasTag(project.scatterZones, point, ["waterfall"]) && slope > 24) {
          const waterfall = pickVariant(seed + 23, x, z, GROUND_TILES.waterfall);
          group.add(createIsoSprite(waterfall, cell.x, height + 0.15, cell.z, 7.8, 7.8, 17));
        }
        continue;
      }

      if (inForest && ((x + z + seed) % 3 === 0) && slope < 18) {
        const treeTexture = pickVariant(seed + x + z, x, z, GROUND_TILES.treeTall);
        group.add(createIsoSprite(treeTexture, cell.x, height + 0.04, cell.z, 5.1, 8.8, 30));
      } else if (inForest && ((x * 3 + z * 5 + seed) % 5 === 0) && slope < 18) {
        const treeTexture = pickVariant(seed + x + z + 1, x, z, GROUND_TILES.treeRound);
        group.add(createIsoSprite(treeTexture, cell.x, height + 0.04, cell.z, 4.5, 7.0, 29));
      } else if (inForest && ((x * 7 + z * 11 + seed) % 13 === 0) && slope < 12) {
        const treeTexture = pickVariant(seed + x + z + 2, x, z, GROUND_TILES.treeSmall);
        group.add(createIsoSprite(treeTexture, cell.x, height + 0.03, cell.z, 3.8, 5.8, 28));
      }

      if (inClearing && ((x + z + seed) % 11 === 0)) {
        const rockTexture = pickVariant(seed + 31, x, z, GROUND_TILES.rockSmall);
        group.add(createIsoSprite(rockTexture, cell.x, height + 0.04, cell.z, 3.2, 2.4, 18));
      }
    }
  }

  const primaryRoad = project.roads[0];
  const riverRoad = project.roads.find((road) => road.materialId === "water");
  if (primaryRoad && riverRoad) {
    const bridgePoint = primaryRoad.points[Math.floor(primaryRoad.points.length / 2)] ?? primaryRoad.points[0];
    const bridgeTexture = pickVariant(seed + 71, Math.round(bridgePoint.x * 10), Math.round(bridgePoint.z * 10), GROUND_TILES.bridge);
    group.add(createIsoSprite(bridgeTexture, bridgePoint.x, bridgePoint.y + 0.18, bridgePoint.z, 6.4, 3.1, 50));
  }

  const clearing = project.scatterZones.find((zone) => (zone.tags ?? []).some((tag) => ["clearing", "open"].includes(tag)));
  if (clearing) {
    const center = clearing.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 });
    const count = Math.max(1, clearing.points.length);
    const cx = center.x / count;
    const cz = center.z / count;
    const cy = terrainCellToWorld(Math.floor(terrain.resolution / 2), Math.floor(terrain.resolution / 2), terrain, 0).y;
    maybePlaceClusterTiles(group, "camp", seed + 97, cx, cy + 0.25, cz, 4);
    maybePlaceClusterTiles(group, "fence", seed + 101, cx + 4.2, cy + 0.2, cz + 1.8, 5);
    maybePlaceClusterTiles(group, "sign", seed + 103, cx - 3.2, cy + 0.18, cz - 2.4, 1);
  }

  project.scatterZones
    .filter((zone) => (zone.tags ?? []).some((tag) => ["forest", "dense"].includes(tag)))
    .forEach((zone, index) => {
      const center = zone.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 });
      const count = Math.max(8, Math.round(zone.points.length * 2.6) + index * 2);
      const cx = center.x / Math.max(1, zone.points.length);
      const cz = center.z / Math.max(1, zone.points.length);
      const cy = terrainCellToWorld(Math.floor(terrain.resolution / 2), Math.floor(terrain.resolution / 2), terrain, 0).y;
      maybePlaceClusterTiles(group, "tree", seed + 131 + index * 17, cx, cy + 0.18, cz, count);
      maybePlaceClusterTiles(group, "rock", seed + 149 + index * 19, cx + 2.8, cy + 0.1, cz - 1.8, Math.max(3, Math.floor(count / 6)));
    });

  const heroHeight = terrainCellToWorld(Math.floor(terrain.resolution / 2), Math.floor(terrain.resolution / 2), terrain, 0).y;
  maybePlaceClusterTiles(group, "tree", seed + 301, -24, heroHeight + 0.18, 22, 12);
  maybePlaceClusterTiles(group, "tree", seed + 303, 22, heroHeight + 0.18, -16, 11);
  maybePlaceClusterTiles(group, "tree", seed + 305, -4, heroHeight + 0.18, -2, 8);
  maybePlaceClusterTiles(group, "rock", seed + 307, -18, heroHeight + 0.08, 8, 7);
  maybePlaceClusterTiles(group, "rock", seed + 309, 18, heroHeight + 0.08, 4, 7);
  maybePlaceClusterTiles(group, "camp", seed + 311, 25, heroHeight + 0.2, 16, 4);

  return group;
}
