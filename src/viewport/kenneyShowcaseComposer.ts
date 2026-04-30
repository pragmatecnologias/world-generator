import * as THREE from "three";
import type { ShowcaseLayoutConfig, WorldProject } from "../types";
import { terrainCellToWorld } from "./terrain";
import { createPlacedKenneyModel } from "./kenneyModelLibrary";

const TREE_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineTallA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineTallB.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineTallC.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineTallD.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineRoundA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineRoundB.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_pineDefaultA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_small.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/tree_oak.glb",
];

const ROCK_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeB.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeC.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeD.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeE.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/rock_largeF.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_largeA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_largeB.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_largeC.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_smallA.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_smallB.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_smallD.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/stone_smallE.glb",
];

const CLIFF_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_block_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_block_rock.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_corner_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_corner_rock.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_half_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_half_rock.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_steps_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_steps_rock.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_top_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/cliff_top_rock.glb",
];

const PATH_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/path_stone.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/path_stoneCorner.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/path_stoneCircle.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/path_stoneEnd.glb",
];

const RIVER_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/ground_riverStraight.glb",
];

const RIVER_EDGE_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/ground_riverRocks.glb",
];

const BANK_POOL = [
  "/assets/kenney_nature-kit/Models/GLTF format/ground_riverBendBank.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/ground_pathBendBank.glb",
  "/assets/kenney_nature-kit/Models/GLTF format/ground_riverRocks.glb",
];

type ModelCellKind = "grass" | "path" | "river";
type ModelCell = { col: number; row: number; height: number; kind: ModelCellKind };
type ModelGrid = Map<string, ModelCell>;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function pick<T>(seed: number, index: number, list: T[]) {
  if (list.length === 0) return undefined;
  return list[(Math.abs(seed) + index * 13) % list.length];
}

function tile(group: THREE.Group, path: string, x: number, y: number, z: number, rotationY = 0, fit = 4.5, maxScale = 2.0) {
  const model = createPlacedKenneyModel(path, {
    x,
    y,
    z,
    rotationY,
    fitHeight: fit,
    fitWidth: fit,
    fitDepth: fit,
    maxScale,
  });
  group.add(model);
  return model;
}

function modelKey(col: number, row: number) {
  return `${col}:${row}`;
}

function modelCellToWorld(col: number, row: number, level: number) {
  return {
    x: (col - row) * 0.78,
    y: level * 0.52,
    z: (col + row) * 0.46,
  };
}

function applyModelMask(grid: ModelGrid, originCol: number, originRow: number, rows: string[], height: number) {
  rows.forEach((line, rowIndex) => {
    [...line].forEach((char, colIndex) => {
      if (char === ".") return;
      const col = originCol + colIndex;
      const row = originRow + rowIndex;
      const key = modelKey(col, row);
      const current = grid.get(key);
      if (!current || current.height < height) {
        grid.set(key, { col, row, height, kind: current?.kind ?? "grass" });
      }
    });
  });
}

function rasterizeModelPath(points: Array<{ col: number; row: number }>) {
  const cells = new Set<string>();
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row), 1) * 3;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      cells.add(modelKey(Math.round(lerp(a.col, b.col, t)), Math.round(lerp(a.row, b.row, t))));
    }
  }
  return cells;
}

function buildModelGrid() {
  const grid: ModelGrid = new Map();

  // ── Base island (diamond shape, level 1) ──────────────────────────────
  applyModelMask(
    grid,
    -8,
    -6,
    [
      "......xxxxx......",
      "....xxxxxxxxxx...",
      "..xxxxxxxxxxxxxxx",
      ".xxxxxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxxxxxxxx",
      ".xxxxxxxxxxxxxxxxxxx",
      "..xxxxxxxxxxxxxxxxx",
      "...xxxxxxxxxxxxxxx",
      "....xxxxxxxxxxxxx.",
      ".....xxxxxxxxxxx..",
      ".......xxxxxxxxx..",
      ".........xxxxxxx..",
      "..........xxxxx...",
    ],
    1,
  );

  // ── Mid-level plateau (level 2-3) ─────────────────────────────────────
  applyModelMask(grid, -6, -4, ["..xxxxxxx..", ".xxxxxxxxx.", "xxxxxxxxxxx", "xxxxxxxxxxxx", ".xxxxxxxxxxx", "..xxxxxxxxx.", "...xxxxxxx.."], 2);
  applyModelMask(grid, -4, -3, ["..xxxxxxx.", ".xxxxxxxxx", "xxxxxxxxxx", "xxxxxxxxxx", ".xxxxxxxxx", "..xxxxxxx."], 3);

  // ── High ridge / peak (level 4-5) — ruins landmark ────────────────────
  applyModelMask(grid, -2, -5, ["..xxxx.", ".xxxxxx", "xxxxxxx", "xxxxxxx", ".xxxxxx", "..xxxx."], 4);
  applyModelMask(grid, -1, -4, ["..xxx.", ".xxxxx", "xxxxxx", "xxxxxx", ".xxxxx", "..xxx."], 5);

  // ── Eastern gentle rise (level 2) — farm zone ──────────────────────────
  applyModelMask(grid, 2, -2, [".xxxxx", "xxxxxx", "xxxxxx", ".xxxxx"], 2);

  // ── Forest bump NW (level 3) — tree cluster ───────────────────────────
  applyModelMask(grid, -7, -5, ["..xxxx", ".xxxxx", "xxxxxx", "xxxxxx", ".xxxxx", "..xxx."], 3);

  // ── Camp area SE (level 2) ────────────────────────────────────────────
  applyModelMask(grid, 0, 4, [".xxxxx", "xxxxxx", "xxxxxx", ".xxxxx"], 2);

  // ── Winding path ──────────────────────────────────────────────────────
  const pathCells = rasterizeModelPath([
    { col: -2, row: 8 },   // start: south shore
    { col: -4, row: 6 },   // curve west
    { col: -6, row: 4 },   // past pond edge
    { col: -7, row: 2 },   // curve back east
    { col: -5, row: 0 },   // through mid zone
    { col: -3, row: -1 },  // approach ridge
    { col: -1, row: -3 },  // ascend ridge
    { col: 0, row: -5 },   // near peak
    { col: 2, row: -4 },   // descend east
    { col: 4, row: -2 },   // to farm area
    { col: 5, row: 0 },    // curve south
    { col: 4, row: 3 },    // back toward camp
  ]);

  for (const cell of grid.values()) {
    const key = modelKey(cell.col, cell.row);
    cell.kind = pathCells.has(key) ? "path" : "grass";
  }
  return grid;
}

function modelHeight(grid: ModelGrid, col: number, row: number) {
  return grid.get(modelKey(col, row))?.height ?? 0;
}

function addModelTopTiles(group: THREE.Group, grid: ModelGrid, seed: number) {
  const pool = {
    grass: ["/assets/kenney_nature-kit/Models/GLTF format/ground_grass.glb"],
    path: PATH_POOL,
    river: RIVER_POOL,
  } satisfies Record<ModelCellKind, string[]>;
  for (const cell of [...grid.values()].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const world = modelCellToWorld(cell.col, cell.row, cell.height - 1);
    const path = pick(seed, cell.col * 31 + cell.row * 19, pool[cell.kind]) ?? pool[cell.kind][0];
    const yOff = cell.kind === "path" ? 0.012 : 0;
    tile(group, path, world.x, world.y + yOff, world.z, ((cell.col + cell.row) & 1) ? Math.PI / 2 : 0, cell.kind === "grass" ? 1.35 : 1.1, 1.4);
  }
}

function addModelCliffs(group: THREE.Group, grid: ModelGrid, seed: number) {
  for (const cell of grid.values()) {
    const frontDrop = Math.max(0, cell.height - modelHeight(grid, cell.col, cell.row + 1));
    const rightDrop = Math.max(0, cell.height - modelHeight(grid, cell.col + 1, cell.row));
    const leftDrop = Math.max(0, cell.height - modelHeight(grid, cell.col - 1, cell.row));
    for (let drop = 0; drop < frontDrop; drop += 1) {
      const world = modelCellToWorld(cell.col, cell.row, cell.height - drop - 1);
      const path = pick(seed + 100, cell.col * 17 + cell.row * 13 + drop, cell.height >= 4 ? CLIFF_POOL.slice(0, 5) : CLIFF_POOL) ?? CLIFF_POOL[0];
      tile(group, path, world.x, world.y - 0.48, world.z + 0.55, 0, 1.3, 1.55);
    }
    for (let drop = 0; drop < rightDrop; drop += 1) {
      const world = modelCellToWorld(cell.col, cell.row, cell.height - drop - 1);
      const path = pick(seed + 200, cell.col * 19 + cell.row * 11 + drop, CLIFF_POOL) ?? CLIFF_POOL[0];
      tile(group, path, world.x + 0.55, world.y - 0.42, world.z, Math.PI / 2, 1.25, 1.5);
    }
    if (leftDrop > 0 && cell.col < -3) {
      const world = modelCellToWorld(cell.col, cell.row, cell.height - 1);
      const path = pick(seed + 300, cell.col * 7 + cell.row * 29, CLIFF_POOL) ?? CLIFF_POOL[0];
      tile(group, path, world.x - 0.55, world.y - 0.42, world.z, -Math.PI / 2, 1.2, 1.45);
    }
  }
}

function placeModel(group: THREE.Group, path: string, col: number, row: number, level: number, fit: number, maxScale: number, rotationY = 0, yOffset = 0) {
  const world = modelCellToWorld(col, row, level);
  tile(group, path, world.x, world.y + yOffset, world.z, rotationY, fit, maxScale);
}

function resolveGroundLevel(grid: ModelGrid, col: number, row: number, fallbackLevel: number) {
  const direct = modelHeight(grid, col, row);
  if (direct > 0) return direct - 1;
  let best = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      best = Math.max(best, modelHeight(grid, col + dx, row + dz));
    }
  }
  if (best > 0) return best - 1;
  return Math.max(0, fallbackLevel);
}

function hasGroundSupport(grid: ModelGrid, col: number, row: number) {
  if (modelHeight(grid, col, row) > 0) return true;
  // Avoid floating props: only allow neighbor fallback when support is strong.
  let neighbors = 0;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue;
      if (modelHeight(grid, col + dx, row + dz) > 0) neighbors += 1;
    }
  }
  return neighbors >= 3;
}

function placeModelGrounded(
  group: THREE.Group,
  grid: ModelGrid,
  path: string,
  col: number,
  row: number,
  fallbackLevel: number,
  fit: number,
  maxScale: number,
  rotationY = 0,
  yOffset = 0,
) {
  if (!hasGroundSupport(grid, col, row)) return;
  const level = resolveGroundLevel(grid, col, row, fallbackLevel);
  placeModel(group, path, col, row, level, fit, maxScale, rotationY, Math.min(0.02, Math.max(-0.03, yOffset)));
}

function addOrganicFilledPond(
  group: THREE.Group,
  grid: ModelGrid,
  centerCol: number,
  centerRow: number,
  radiusCol: number,
  radiusRow: number,
  seed: number,
) {
  const baseLevel = resolveGroundLevel(grid, centerCol, centerRow, 1);
  const centerWorld = modelCellToWorld(centerCol, centerRow, baseLevel);
  const shapePoints: THREE.Vector2[] = [];
  const segments = 14;
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const jitter = 0.82 + (((seed + i * 19) % 100) / 100) * 0.32;
    const col = centerCol + Math.cos(t) * radiusCol * jitter;
    const row = centerRow + Math.sin(t) * radiusRow * jitter;
    const world = modelCellToWorld(col, row, baseLevel);
    shapePoints.push(new THREE.Vector2(world.x - centerWorld.x, world.z - centerWorld.z));
  }

  const surfaceShape = new THREE.Shape(shapePoints);
  const surface = new THREE.Mesh(
    new THREE.ShapeGeometry(surfaceShape),
    new THREE.MeshStandardMaterial({
      color: 0x3b8fbe,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(centerWorld.x, centerWorld.y + 0.02, centerWorld.z);
  surface.renderOrder = 62;
  group.add(surface);

  const innerPoints = shapePoints.map((point) => point.clone().multiplyScalar(0.78));
  const innerShape = new THREE.Shape(innerPoints);
  const inner = new THREE.Mesh(
    new THREE.ShapeGeometry(innerShape),
    new THREE.MeshStandardMaterial({
      color: 0x2f7ea8,
      roughness: 0.16,
      metalness: 0.03,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(centerWorld.x, centerWorld.y + 0.025, centerWorld.z);
  inner.renderOrder = 63;
  group.add(inner);
}

function addFilledWaterRibbon(
  group: THREE.Group,
  points: Array<{ x: number; y: number; z: number }>,
  halfWidth: number,
  color: number,
  yOffset: number,
  opacity: number,
) {
  if (points.length < 2) return;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dirX = next.x - prev.x;
    const dirZ = next.z - prev.z;
    const len = Math.max(0.0001, Math.hypot(dirX, dirZ));
    const nx = -dirZ / len;
    const nz = dirX / len;
    const px = points[i].x;
    const py = points[i].y + yOffset;
    const pz = points[i].z;
    vertices.push(px + nx * halfWidth, py, pz + nz * halfWidth);
    vertices.push(px - nx * halfWidth, py, pz - nz * halfWidth);
    if (i > 0) {
      const base = i * 2;
      const prevBase = base - 2;
      indices.push(prevBase, prevBase + 1, base);
      indices.push(base, prevBase + 1, base + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.02,
    transparent: opacity < 1,
    opacity,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 70;
  group.add(mesh);
}

function addModelFence(group: THREE.Group, points: Array<{ col: number; row: number; level: number }>) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row), 1);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      placeModel(group, "/assets/kenney_nature-kit/Models/GLTF format/fence_simpleLow.glb", Math.round(lerp(a.col, b.col, t)), Math.round(lerp(a.row, b.row, t)), a.level, 0.9, 1.3, i % 2 ? Math.PI / 2 : 0, 0.06);
    }
  }
}

function addModelProps(group: THREE.Group, seed: number, grid: ModelGrid) {
  // ═══ FOREST ZONE (NW, dense tree cluster) ════════════════════════════════
  const forestTrees: Array<[number, number, number, number]> = [
    [-9, -6, 3, 0], [-8, -7, 2, 1], [-7, -6, 3, 2], [-8, -5, 3, 3],
    [-7, -5, 2, 0], [-6, -6, 2, 1], [-9, -4, 1, 2], [-8, -3, 1, 3],
    [-6, -4, 2, 0], [-5, -5, 2, 1], [-7, -4, 2, 2], [-6, -3, 1, 3],
    [-8, -2, 1, 0], [-5, -3, 1, 1], [-4, -4, 1, 2],
  ];
  forestTrees.forEach(([col, row, level, variant], i) => {
    const tree = pick(seed + 500, i, i % 3 === 0 ? TREE_POOL.slice(0, 4) : TREE_POOL) ?? TREE_POOL[0];
    placeModelGrounded(group, grid, tree, col, row, level, i % 3 === 0 ? 2.1 : 1.6, 2.0, variant * (Math.PI / 2), 0.01);
  });

  // Shrubs at forest edge
  const shrubs = [
    "/assets/kenney_nature-kit/Models/GLTF format/plant_bushSmall.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/plant_bush.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/grass_leafsLarge.glb",
  ];
  [[-6, -2, 1], [-5, -1, 1], [-7, -1, 1], [-4, -3, 1]].forEach(([col, row, level], i) => {
    placeModelGrounded(group, grid, pick(seed + 510, i, shrubs) ?? shrubs[0], col, row, level, 0.55, 0.85, 0, 0.0);
  });

  // ═══ FARM ZONE (E, crop rows with fences) ═══════════════════════════════
  const cropTypes = [
    "/assets/kenney_nature-kit/Models/GLTF format/crops_cornStageC.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/crops_wheatStageB.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/crops_leafsStageB.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/crops_cornStageB.glb",
  ];
  const dirtRowTypes = [
    "/assets/kenney_nature-kit/Models/GLTF format/crops_dirtRow.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/crops_dirtDoubleRow.glb",
  ];
  // Crop rows (3 rows x 4 cols)
  for (let row = -3; row <= -1; row += 1) {
    for (let col = 4; col <= 7; col += 1) {
      const crop = pick(seed + 400, col * 7 + row, cropTypes) ?? cropTypes[0];
      placeModelGrounded(group, grid, crop, col, row, 1, 0.82, 1.12, 0, 0.01);
    }
  }
  // Dirt furrows between crop rows
  for (let row = -3; row <= -1; row += 1) {
    const dirt = pick(seed + 410, row, dirtRowTypes) ?? dirtRowTypes[0];
    placeModelGrounded(group, grid, dirt, 5, row, 1, 1.0, 1.2, 0, 0.0);
  }
  // Farm fence (rectangular enclosure)
  addModelFence(group, [
    { col: 3, row: -4, level: 1 },
    { col: 8, row: -4, level: 1 },
    { col: 8, row: 0, level: 1 },
    { col: 3, row: 0, level: 1 },
    { col: 3, row: -4, level: 1 },
  ]);
  // Farm sign
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/sign.glb", 3, -4, 1, 0.85, 1.1, Math.PI / 4, 0.0);

  // ═══ RUINS LANDMARK (peak, high point) ═════════════════════════════════
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_ring.glb", 0, -4, 4, 1.4, 1.75, Math.PI / 6, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_columnDamaged.glb", -1, -5, 4, 0.95, 1.25, Math.PI / 8, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_columnDamaged.glb", 1, -5, 4, 0.95, 1.25, -Math.PI / 5, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_obelisk.glb", 0, -6, 4, 1.1, 1.4, 0, 0.0);
  // Scattered ruins fragments near the peak
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_block.glb", 1, -4, 4, 0.7, 0.9, Math.PI / 3, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/statue_head.glb", -1, -4, 4, 0.6, 0.85, -Math.PI / 4, 0.0);

  // ═══ CAMP (SE, cozy campsite) ══════════════════════════════════════════
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/tent_smallOpen.glb", 2, 3, 1, 1.35, 1.55, -Math.PI / 3, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/tent_detailedOpen.glb", 0, 5, 1, 1.2, 1.45, Math.PI / 6, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/campfire_stones.glb", 1, 4, 1, 0.88, 1.1, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/log_stackLarge.glb", 3, 4, 1, 1.1, 1.35, Math.PI / 4, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/sign.glb", 2, 2, 1, 0.82, 1.05, Math.PI / 6, 0.0);
  // Camp firewood
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/log_large.glb", 0, 4, 1, 0.9, 1.15, Math.PI / 3, 0.0);

  // ═══ PATH ACCENTS (signs, stone steps, markers along the winding path) ═
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/sign.glb", -4, 6, 1, 0.8, 1.0, -Math.PI / 6, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/sign.glb", -3, -1, 3, 0.8, 1.0, Math.PI / 4, 0.0);
  // Stone stepping path on the ridge ascent
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/path_stoneEnd.glb", -2, 0, 2, 0.85, 1.1, Math.PI / 6, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/path_stone.glb", -1, -2, 3, 0.9, 1.15, Math.PI / 4, 0.0);

  // ═══ EDGE ROCKS (scattered along island perimeter) ═════════════════════
  const edgeRocks: Array<[number, number, number]> = [
    [-10, -2, 1], [-9, 1, 1], [-8, 4, 0], [-6, 7, 0],
    [6, 8, 0], [8, 3, 0], [9, -1, 0], [8, -4, 0],
    [-3, -8, 0], [1, -9, 0], [5, -7, 0],
  ];
  edgeRocks.forEach(([col, row, level], i) => {
    placeModelGrounded(group, grid, pick(seed + 600, i, ROCK_POOL) ?? ROCK_POOL[0], col, row, level, 0.95, 1.25, i * 0.7, 0.0);
  });

  // ═══ PATHSIDE BOULDERS (accent the winding path) ═══════════════════════
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/rock_largeA.glb", -5, 5, 1, 1.1, 1.4, Math.PI / 5, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/rock_largeC.glb", -8, 1, 1, 0.95, 1.2, -Math.PI / 7, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/rock_tallA.glb", 3, -3, 1, 1.0, 1.3, 0, 0.0);

  // ═══ FLOWERS (intentional clusters, not random) ═════════════════════════
  const flowers = [
    "/assets/kenney_nature-kit/Models/GLTF format/flower_yellowA.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/flower_redA.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/flower_purpleA.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/mushroom_redGroup.glb",
  ];
  // Forest floor flowers
  [[-5, -4, 2], [-6, -5, 2], [-4, -2, 1]].forEach(([col, row, level], i) => {
    placeModelGrounded(group, grid, pick(seed + 700, i, flowers) ?? flowers[0], col, row, level, 0.5, 0.85, 0, 0.0);
  });
  // Farm edge wildflowers
  [[3, -2, 1], [8, -2, 0], [7, 1, 1]].forEach(([col, row, level], i) => {
    placeModelGrounded(group, grid, pick(seed + 710, i, flowers) ?? flowers[0], col, row, level, 0.5, 0.85, 0, 0.0);
  });
  // Camp area mushrooms
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/mushroom_tanGroup.glb", 1, 5, 1, 0.7, 0.95, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/mushroom_redGroup.glb", 3, 5, 1, 0.65, 0.9, 0, 0.0);

  // ═══ FANTASY ACCENT: stone platform near ruins ══════════════════════════
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/platform_stone.glb", -1, -3, 3, 1.15, 1.4, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/campfire_logs.glb", 0, -3, 4, 0.82, 1.0, 0, 0.0);
}

function addModelWatercourse(group: THREE.Group, seed: number, grid: ModelGrid) {
  // Waterfall from the ridge flowing down into the pond
  const waterfallPoints = [
    { x: -1.8, y: 0.56, z: 2.8 },   // top of ridge
    { x: -2.2, y: 0.50, z: 2.2 },   // mid descent
    { x: -2.8, y: 0.44, z: 1.6 },   // approaching pond
    { x: -3.4, y: 0.40, z: 1.1 },   // pond edge
  ];

  addFilledWaterRibbon(
    group,
    waterfallPoints.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    0.28,
    0x3f95bf,
    0.03,
    0.92,
  );
  addFilledWaterRibbon(
    group,
    waterfallPoints.map((p) => ({ x: p.x, y: p.y + 0.002, z: p.z })),
    0.16,
    0x2f7ea8,
    0.035,
    0.7,
  );
  placeChain(
    group,
    seed + 840,
    RIVER_EDGE_POOL,
    waterfallPoints.map((p, i) => ({
      x: p.x + 0.22,
      y: p.y - 0.02 + ((i % 3) - 1) * 0.005,
      z: p.z + 0.14,
    })),
    1.0, 0.55, 0.8, 2.8, -0.02,
  );
  placeChain(
    group,
    seed + 860,
    RIVER_EDGE_POOL,
    waterfallPoints.map((p, i) => ({
      x: p.x - 0.20,
      y: p.y - 0.02 - ((i % 3) - 1) * 0.005,
      z: p.z - 0.12,
    })),
    1.0, 0.55, 0.8, 2.8, -0.02,
  );

  // Waterfall cliff models at the ridge edge
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/cliff_waterfallTop_stone.glb", -3, 4, 3, 1.2, 1.55, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/cliff_waterfall_stone.glb", -3, 5, 2, 1.6, 1.8, 0, -0.01);

  // Bridge crossing the stream near the path
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/bridge_woodNarrow.glb", -5, 4, 1, 1.0, 1.2, Math.PI / 3, 0.0);
}



function addModelPond(group: THREE.Group, seed: number, grid: ModelGrid) {
  // Organic pond in the SW area — the main water feature
  addOrganicFilledPond(group, grid, -8, 2, 2.4, 1.8, seed + 911);

  // Smaller decorative pond near the ridge base
  addOrganicFilledPond(group, grid, -3, 1, 1.0, 0.7, seed + 977);

  // Pond edge rocks (natural border)
  const edgeCells = [
    { col: -10, row: 2, rot: Math.PI / 2 },
    { col: -11, row: 3, rot: Math.PI / 3 },
    { col: -9, row: 4, rot: Math.PI / 3 },
    { col: -7, row: 4, rot: -Math.PI / 4 },
    { col: -6, row: 1, rot: Math.PI / 6 },
    { col: -8, row: 0, rot: -Math.PI / 3 },
    { col: -9, row: 1, rot: Math.PI / 2 },
    { col: -7, row: 5, rot: -Math.PI / 6 },
    { col: -10, row: 4, rot: Math.PI / 4 },
    { col: -6, row: 3, rot: -Math.PI / 3 },
  ];
  edgeCells.forEach((cell, index) => {
    placeModelGrounded(
      group,
      grid,
      pick(seed + 930, index, RIVER_EDGE_POOL) ?? RIVER_EDGE_POOL[0],
      cell.col,
      cell.row,
      1,
      0.82,
      1.05,
      cell.rot,
      0.0,
    );
  });

  // Lily pads on the pond surface
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/lily_large.glb", -8, 2, 1, 0.6, 0.88, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/lily_small.glb", -9, 1, 1, 0.55, 0.78, Math.PI / 4, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/lily_large.glb", -7, 2, 1, 0.58, 0.85, -Math.PI / 6, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/lily_small.glb", -10, 3, 1, 0.52, 0.75, Math.PI / 3, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/lily_large.glb", -9, 3, 1, 0.56, 0.82, -Math.PI / 4, 0.0);

  // Reeds / plants at pond edge
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/grass_leafsLarge.glb", -10, 3, 0, 0.7, 1.0, 0, 0.0);
  placeModelGrounded(group, grid, "/assets/kenney_nature-kit/Models/GLTF format/grass_leafsLarge.glb", -6, 4, 0, 0.65, 0.95, Math.PI / 3, 0.0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FANTASY TOWN  (kenney_fantasy-town-kit_2.0)
// ═══════════════════════════════════════════════════════════════════════════

const TOWN_BASE = "/assets/kenney_fantasy-town-kit_2.0/Models/GLB format";

type TownPiece = { model: string; dx: number; dz: number; dy?: number; ry?: number; fit?: number; sc?: number };

function placeStructure(
  group: THREE.Group,
  grid: ModelGrid,
  originCol: number,
  originRow: number,
  baseLevel: number,
  pieces: TownPiece[],
) {
  const origin = modelCellToWorld(originCol, originRow, baseLevel);
  for (const p of pieces) {
    const wx = origin.x + p.dx;
    const wz = origin.z + p.dz;
    const wy = origin.y + (p.dy ?? 0);
    tile(group, `${TOWN_BASE}/${p.model}.glb`, wx, wy, wz, p.ry ?? 0, p.fit ?? 999, p.sc ?? 0.5);
  }
}

function addFantasyTown(group: THREE.Group, grid: ModelGrid, seed: number) {
  // Terrain cell spacing: X ≈ 0.78, Z ≈ 0.46 per grid step.
  // Town kit models are ~2 units wide at natural scale.
  // We scale all structural pieces to 0.5 so walls ≈ 1 unit = ~1.3 cells.
  // Offsets use fractions of a grid cell (±0.4 X, ±0.25 Z for a 1-cell building).

  // ── TOWN HALL (stone, on the mid-level plateau) ───────────────────────
  placeStructure(group, grid, -2, 0, 3, [
    // front wall (2 panels)
    { model: "wall",               dx: -0.38, dz: -0.22, ry: 0 },
    { model: "wall",               dx:  0.38, dz: -0.22, ry: 0 },
    // back wall (2 panels)
    { model: "wall",               dx: -0.38, dz:  0.22, ry: Math.PI },
    { model: "wall",               dx:  0.38, dz:  0.22, ry: Math.PI },
    // side walls
    { model: "wall-side",          dx: -0.72, dz:  0.0, ry: Math.PI / 2 },
    { model: "wall-side",          dx:  0.72, dz:  0.0, ry: -Math.PI / 2 },
    // door
    { model: "wall-door",          dx:  0.0, dz: -0.22, ry: 0, dy: 0.01 },
    // roof
    { model: "roof-gable",         dx:  0.0, dz: -0.22, dy: 0.55, ry: 0, sc: 0.55 },
    { model: "roof-gable",         dx:  0.0, dz:  0.22, dy: 0.55, ry: Math.PI, sc: 0.55 },
    { model: "roof-gable-top",     dx:  0.0, dz:  0.0,  dy: 0.72, ry: 0, sc: 0.55 },
    // windows
    { model: "wall-window-round",  dx: -0.38, dz: -0.22, ry: 0, dy: 0.01, sc: 0.45 },
    { model: "wall-window-round",  dx:  0.38, dz: -0.22, ry: 0, dy: 0.01, sc: 0.45 },
    // chimney
    { model: "chimney",            dx:  0.5, dz:  0.15, dy: 0.7, ry: 0, sc: 0.35 },
    // banner
    { model: "banner-green",       dx:  0.0, dz: -0.32, dy: 0.5, ry: 0, sc: 0.35 },
  ]);

  // ── HOUSE 1 (stone cottage) ───────────────────────────────────────────
  placeStructure(group, grid, -4, 1, 2, [
    { model: "wall",               dx: -0.35, dz: -0.2, ry: 0 },
    { model: "wall",               dx:  0.35, dz: -0.2, ry: 0 },
    { model: "wall",               dx: -0.35, dz:  0.2, ry: Math.PI },
    { model: "wall",               dx:  0.35, dz:  0.2, ry: Math.PI },
    { model: "wall-side",          dx: -0.65, dz:  0.0, ry: Math.PI / 2 },
    { model: "wall-side",          dx:  0.65, dz:  0.0, ry: -Math.PI / 2 },
    { model: "wall-door",          dx:  0.35, dz: -0.2, ry: 0, dy: 0.01 },
    { model: "roof-gable",         dx:  0.0, dz: -0.2, dy: 0.5, ry: 0, sc: 0.5 },
    { model: "roof-gable",         dx:  0.0, dz:  0.2, dy: 0.5, ry: Math.PI, sc: 0.5 },
    { model: "roof-gable-top",     dx:  0.0, dz:  0.0, dy: 0.65, ry: 0, sc: 0.5 },
    { model: "wall-window-shutters", dx: -0.35, dz: -0.2, ry: 0, dy: 0.01, sc: 0.4 },
    { model: "chimney",            dx: -0.35, dz:  0.15, dy: 0.6, ry: 0, sc: 0.3 },
  ]);

  // ── HOUSE 2 (wood cottage) ────────────────────────────────────────────
  placeStructure(group, grid, 3, -1, 2, [
    { model: "wall-wood",          dx: -0.35, dz: -0.2, ry: 0 },
    { model: "wall-wood",          dx:  0.35, dz: -0.2, ry: 0 },
    { model: "wall-wood",          dx: -0.35, dz:  0.2, ry: Math.PI },
    { model: "wall-wood",          dx:  0.35, dz:  0.2, ry: Math.PI },
    { model: "wall-wood-side",     dx: -0.65, dz:  0.0, ry: Math.PI / 2 },
    { model: "wall-wood-side",     dx:  0.65, dz:  0.0, ry: -Math.PI / 2 },
    { model: "wall-wood-door",     dx: -0.35, dz: -0.2, ry: 0, dy: 0.01 },
    { model: "roof-gable",         dx:  0.0, dz: -0.2, dy: 0.5, ry: 0, sc: 0.5 },
    { model: "roof-gable",         dx:  0.0, dz:  0.2, dy: 0.5, ry: Math.PI, sc: 0.5 },
    { model: "roof-gable-top",     dx:  0.0, dz:  0.0, dy: 0.65, ry: 0, sc: 0.5 },
    { model: "wall-wood-window-shutters", dx:  0.35, dz: -0.2, ry: 0, dy: 0.01, sc: 0.4 },
  ]);

  // ── WINDMILL (on the ridge near the peak) ─────────────────────────────
  placeStructure(group, grid, 1, -5, 4, [
    { model: "wall-block",         dx:  0.0, dz:  0.0, ry: 0, sc: 0.5 },
    { model: "wall-block",         dx:  0.0, dz:  0.0, dy: 0.42, ry: 0, sc: 0.45 },
    { model: "roof-high-point",    dx:  0.0, dz:  0.0, dy: 0.82, ry: 0, sc: 0.5 },
    { model: "wall-wood-door",     dx:  0.0, dz: -0.28, ry: 0, dy: 0.01, sc: 0.4 },
    { model: "wheel",              dx:  0.0, dz: -0.35, dy: 0.5, ry: 0, sc: 0.45 },
  ]);

  // ── WATERMILL (near the pond edge) ────────────────────────────────────
  placeStructure(group, grid, -6, 3, 1, [
    { model: "wall-wood",          dx: -0.35, dz: -0.18, ry: 0 },
    { model: "wall-wood",          dx:  0.35, dz: -0.18, ry: 0 },
    { model: "wall-wood",          dx: -0.35, dz:  0.18, ry: Math.PI },
    { model: "wall-wood",          dx:  0.35, dz:  0.18, ry: Math.PI },
    { model: "wall-wood-side",     dx: -0.65, dz:  0.0, ry: Math.PI / 2 },
    { model: "wall-wood-side",     dx:  0.65, dz:  0.0, ry: -Math.PI / 2 },
    { model: "roof-gable",         dx:  0.0, dz: -0.18, dy: 0.48, ry: 0, sc: 0.48 },
    { model: "roof-gable",         dx:  0.0, dz:  0.18, dy: 0.48, ry: Math.PI, sc: 0.48 },
    { model: "roof-gable-top",     dx:  0.0, dz:  0.0,  dy: 0.62, ry: 0, sc: 0.48 },
    { model: "watermill",          dx:  0.75, dz:  0.0, dy: 0.05, ry: -Math.PI / 2, sc: 0.45 },
  ]);

  // ── MARKET STALLS (near the town square) ──────────────────────────────
  const stallColors = ["stall-green", "stall-red"];
  for (let i = 0; i < 4; i += 1) {
    const col = -1 + (i % 2) * 2;
    const row = 2 + Math.floor(i / 2);
    placeStructure(group, grid, col, row, 2, [
      { model: stallColors[i % 2], dx: 0, dz: 0, ry: i * Math.PI / 2, sc: 0.45 },
      { model: "stall-bench",      dx: 0, dz: 0.18, ry: i * Math.PI / 2, sc: 0.38 },
    ]);
  }

  // ── TOWN SQUARE FOUNTAIN ──────────────────────────────────────────────
  placeStructure(group, grid, 0, 2, 2, [
    { model: "fountain-round",        dx: 0.0, dz: 0.0, ry: 0, sc: 0.5 },
    { model: "fountain-round-detail", dx: 0.0, dz: 0.0, dy: 0.01, ry: 0, sc: 0.45 },
    { model: "fountain-center",       dx: 0.0, dz: 0.0, dy: 0.08, ry: 0, sc: 0.4 },
  ]);

  // ── TOWN WALLS (perimeter fence with gate) ────────────────────────────
  placeStructure(group, grid, -3, -2, 2, [
    { model: "fence", dx: -0.55, dz: 0, ry: Math.PI / 2, sc: 0.5 },
    { model: "fence", dx:  0.0,  dz: 0, ry: Math.PI / 2, sc: 0.5 },
    { model: "fence", dx:  0.55, dz: 0, ry: Math.PI / 2, sc: 0.5 },
    { model: "fence-gate", dx: 0, dz: -0.15, ry: 0, sc: 0.45 },
  ]);

  // ── HEDGES (along the farm boundary) ──────────────────────────────────
  placeStructure(group, grid, 3, -4, 1, [
    { model: "hedge", dx: -0.45, dz: 0, ry: Math.PI / 2, sc: 0.45 },
    { model: "hedge", dx:  0.0,  dz: 0, ry: Math.PI / 2, sc: 0.45 },
    { model: "hedge", dx:  0.45, dz: 0, ry: Math.PI / 2, sc: 0.45 },
    { model: "hedge-curved", dx: 0.8, dz: 0.2, ry: -Math.PI / 4, sc: 0.42 },
  ]);

  // ── LANTERNS (along the path) ─────────────────────────────────────────
  const lanternPositions: Array<[number, number, number, number]> = [
    [-3, 3, 2, Math.PI / 6],
    [-1, 1, 3, -Math.PI / 4],
    [2, -2, 2, Math.PI / 3],
    [4, 1, 2, -Math.PI / 6],
    [-5, 2, 1, Math.PI / 2],
  ];
  lanternPositions.forEach(([col, row, level, rot]) => {
    placeModelGrounded(group, grid, `${TOWN_BASE}/lantern.glb`, col, row, level, 0.4, 0.55, rot, 0.0);
  });

  // ── TREES (from town kit, scattered near buildings) ────────────────────
  const townTrees: Array<[number, number, number, number]> = [
    [-5, -1, 2, 0], [4, 2, 2, Math.PI / 3], [-3, 4, 1, Math.PI / 2],
    [5, -3, 1, -Math.PI / 4], [-2, 5, 1, Math.PI / 6],
  ];
  townTrees.forEach(([col, row, level, rot], i) => {
    const treeModel = i % 2 === 0 ? "tree" : "tree-crooked";
    placeModelGrounded(group, grid, `${TOWN_BASE}/${treeModel}.glb`, col, row, level, 0.9, 1.1, rot, 0.0);
  });

  // ── CARTS (near market) ───────────────────────────────────────────────
  placeModelGrounded(group, grid, `${TOWN_BASE}/cart.glb`, -2, 3, 2, 0.6, 0.75, Math.PI / 5, 0.0);
  placeModelGrounded(group, grid, `${TOWN_BASE}/cart-high.glb`, 2, 4, 2, 0.55, 0.7, -Math.PI / 3, 0.0);

  // ── STONE STAIRS (connecting elevation levels) ────────────────────────
  placeStructure(group, grid, -1, -1, 2, [
    { model: "stairs-stone", dx: 0, dz: 0, ry: Math.PI, sc: 0.45 },
  ]);
  placeStructure(group, grid, 1, -3, 3, [
    { model: "stairs-stone", dx: 0, dz: 0, ry: Math.PI / 2, sc: 0.45 },
  ]);

  // ── PLANKS (loading dock near watermill) ──────────────────────────────
  placeModelGrounded(group, grid, `${TOWN_BASE}/planks.glb`, -5, 3, 1, 0.7, 0.65, Math.PI / 4, 0.0);
  placeModelGrounded(group, grid, `${TOWN_BASE}/planks-half.glb`, -7, 3, 1, 0.6, 0.55, -Math.PI / 6, 0.0);

  // ── BANNERS on town hall ──────────────────────────────────────────────
  placeModelGrounded(group, grid, `${TOWN_BASE}/banner-red.glb`, -2, 0, 4, 0.4, 0.5, Math.PI, 0.0);
}

function buildAuthoredModelDiorama(project: WorldProject) {
  const group = new THREE.Group();
  group.name = "kenney-authored-model-diorama";
  const seed = Number(project.id.split("-").at(-1)) || 42;

  // Water base plane (surrounds the island)
  const waterBase = new THREE.Mesh(
    new THREE.CircleGeometry(22, 48),
    new THREE.MeshStandardMaterial({
      color: 0x3b8fbe,
      roughness: 0.15,
      metalness: 0.03,
      transparent: true,
      opacity: 0.88,
    }),
  );
  waterBase.rotation.x = -Math.PI / 2;
  waterBase.position.y = -0.08;
  waterBase.receiveShadow = true;
  waterBase.renderOrder = 5;
  group.add(waterBase);

  const grid = buildModelGrid();
  addModelTopTiles(group, grid, seed);
  addModelCliffs(group, grid, seed);
  addModelWatercourse(group, seed, grid);
  addModelPond(group, seed, grid);
  addModelProps(group, seed, grid);
  addFantasyTown(group, grid, seed);
  group.scale.setScalar(1.15);
  group.position.set(0, -0.55, 0);
  return group;
}

function placeDiamond(group: THREE.Group, cx: number, cz: number, levels: number, tileFit: number, baseY: number, scale: number) {
  for (let row = -levels; row <= levels; row += 1) {
    const span = levels - Math.abs(row);
    for (let col = -span; col <= span; col += 1) {
      const x = (cx + col * 2.15) * scale;
      const z = (cz + row * 2.15) * scale;
      const y = baseY + Math.abs(row) * 0.04 + Math.abs(col) * 0.02;
      tile(group, "/assets/kenney_nature-kit/Models/GLTF format/ground_grass.glb", x, y, z, ((row + col) & 1) === 0 ? 0 : Math.PI / 2, tileFit, 1.4);
    }
  }
}

function placeChain(
  group: THREE.Group,
  seed: number,
  paths: string[],
  points: Array<{ x: number; y?: number; z: number }>,
  scale: number,
  fit: number,
  maxScale: number,
  spacing = 4.2,
  yOffset = 0,
) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.round(length / (spacing * scale)));
    for (let s = 0; s <= steps; s += 1) {
      const t = steps === 0 ? 0 : s / steps;
      const x = lerp(a.x, b.x, t) * scale;
      const z = lerp(a.z, b.z, t) * scale;
      const y = lerp(a.y ?? 0, b.y ?? 0, t) + yOffset;
      const path = pick(seed + i * 17, s, paths) ?? paths[0];
      tile(group, path, x, y, z, Math.atan2(dx, dz) + Math.PI / 4, fit, maxScale);
    }
  }
}

function placeRing(
  group: THREE.Group,
  seed: number,
  modelPaths: string[],
  center: { x: number; z: number },
  radiusX: number,
  radiusZ: number,
  count: number,
  y: number,
  scale: number,
  fit: number,
  wobble = 0.16,
  maxScale = 1.8,
) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const drift = 1 + Math.sin(seed * 0.013 + i * 1.31) * wobble;
    const x = (center.x + Math.cos(angle) * radiusX * drift) * scale;
    const z = (center.z + Math.sin(angle) * radiusZ * drift) * scale;
    const path = pick(seed + i * 23, i, modelPaths) ?? modelPaths[0];
    tile(group, path, x, y, z, angle + Math.PI / 4, fit, maxScale);
  }
}

function placeCluster(
  group: THREE.Group,
  seed: number,
  kind: ShowcaseLayoutConfig["clusters"][number]["kind"],
  center: { x: number; y: number; z: number },
  radius: number,
  count: number,
  scale: number,
  fit: number,
  maxScale = 1.8,
) {
  const pool = kind === "tree" ? TREE_POOL : kind === "rock" ? ROCK_POOL : kind === "camp" ? [
    "/assets/kenney_nature-kit/Models/GLTF format/campfire_stones.glb",
    "/assets/kenney_nature-kit/Models/GLTF format/tent_smallOpen.glb",
  ] : kind === "fence" ? ["/assets/kenney_nature-kit/Models/GLTF format/fence_simpleLow.glb"] : ["/assets/kenney_nature-kit/Models/GLTF format/sign.glb"];
  for (let i = 0; i < count; i += 1) {
    const angle = seed * 0.01 + i * 2.17;
    const r = radius * (0.28 + ((seed + i * 17) % 100) / 100 * 0.72);
    const x = (center.x + Math.cos(angle) * r) * scale;
    const z = (center.z + Math.sin(angle) * r) * scale;
    const y = center.y + ((i % 3) - 1) * 0.02;
    const path = pick(seed + i * 11, i, pool) ?? pool[0];
    tile(group, path, x, y, z, ((seed + i * 19) % 4) * (Math.PI / 2), fit * (0.88 + ((seed + i * 7) % 100) / 100 * 0.18), maxScale);
  }
}

export function buildKenneyShowcaseComposition(project: WorldProject, layout: ShowcaseLayoutConfig) {
  if (layout.renderMode === "models") {
    return buildAuthoredModelDiorama(project);
  }
  const terrain = project.terrain;
  const group = new THREE.Group();
  group.name = "kenney-showcase-composition";
  const scale = terrain.width / 150;
  const baseY = terrainCellToWorld(Math.floor(terrain.resolution / 2), Math.floor(terrain.resolution / 2), terrain, 0).y - 0.1;
  const seed = Number(project.id.split("-").at(-1)) || 42;

  for (const landmass of layout.landmasses) {
    placeDiamond(group, landmass.center.x, landmass.center.z, landmass.levels, landmass.tileFit, baseY + (landmass.yOffset ?? 0), scale);
  }

  for (const chain of layout.chains) {
    const fit = chain.fit;
    const maxScale = chain.maxScale ?? 1.8;
    const paths = chain.modelPaths;
    if (chain.kind === "path") {
      placeChain(group, seed, paths, chain.points, scale, fit, maxScale, 4.0, 0.04);
    } else if (chain.kind === "river") {
      placeChain(group, seed + 17, paths, chain.points, scale, fit, maxScale, 4.15, chain.yOffset ?? 0.0);
    } else {
      placeChain(group, seed + 29, paths, chain.points, scale, fit, maxScale, 4.15, chain.yOffset ?? -0.01);
    }
  }

  for (const ring of layout.rings) {
    placeRing(group, seed, ring.modelPaths, ring.center, ring.radiusX, ring.radiusZ, ring.count, ring.y, scale, ring.fit, ring.wobble, ring.maxScale);
  }

  for (const cluster of layout.clusters) {
    placeCluster(group, seed + 97, cluster.kind, cluster.center, cluster.radius, cluster.count, scale, cluster.fit, cluster.maxScale);
  }

  for (const prop of layout.heroProps) {
    tile(group, prop.path, prop.x * scale, prop.y, prop.z * scale, prop.rotationY ?? 0, prop.fit, prop.maxScale ?? 1.8);
  }

  return group;
}
