import * as THREE from "three";
import type { ShowcaseLayoutConfig, WorldProject } from "../types";

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const ISO = "/assets/kenney_nature-kit/Isometric";
const CELL_W = 2.25;
const CELL_H = 1.12;
const LEVEL_Y = 2.55;

const spriteSets = {
  grass: [`${ISO}/ground_grass_NE.png`],
  path: [
    `${ISO}/ground_pathTile_NE.png`,
    `${ISO}/ground_pathStraight_NE.png`,
    `${ISO}/ground_pathBend_NE.png`,
    `${ISO}/ground_pathCorner_NE.png`,
    `${ISO}/ground_pathSide_NE.png`,
  ],
  river: [
    `${ISO}/ground_riverTile_NE.png`,
    `${ISO}/ground_riverStraight_NE.png`,
    `${ISO}/ground_riverBend_NE.png`,
    `${ISO}/ground_riverCorner_NE.png`,
    `${ISO}/ground_riverOpen_NE.png`,
  ],
  cliffStone: [
    `${ISO}/cliff_large_stone_NE.png`,
    `${ISO}/cliff_block_stone_NE.png`,
    `${ISO}/cliff_corner_stone_NE.png`,
    `${ISO}/cliff_half_stone_NE.png`,
    `${ISO}/cliff_steps_stone_NE.png`,
  ],
  cliffRock: [
    `${ISO}/cliff_large_rock_NE.png`,
    `${ISO}/cliff_block_rock_NE.png`,
    `${ISO}/cliff_corner_rock_NE.png`,
    `${ISO}/cliff_half_rock_NE.png`,
    `${ISO}/cliff_steps_rock_NE.png`,
  ],
  cliffTop: [
    `${ISO}/cliff_top_stone_NE.png`,
    `${ISO}/cliff_topDiagonal_stone_NE.png`,
    `${ISO}/cliff_cornerTop_stone_NE.png`,
  ],
  treeTall: [
    `${ISO}/tree_pineTallA_detailed_NE.png`,
    `${ISO}/tree_pineTallB_detailed_NE.png`,
    `${ISO}/tree_pineTallC_detailed_NE.png`,
    `${ISO}/tree_pineTallD_detailed_NE.png`,
  ],
  treeRound: [
    `${ISO}/tree_default_NE.png`,
    `${ISO}/tree_oak_NE.png`,
    `${ISO}/tree_detailed_NE.png`,
    `${ISO}/tree_fat_NE.png`,
  ],
  palm: [
    `${ISO}/tree_palmTall_NE.png`,
    `${ISO}/tree_palmDetailedTall_NE.png`,
    `${ISO}/tree_palmBend_NE.png`,
  ],
  rock: [
    `${ISO}/rock_largeA_NE.png`,
    `${ISO}/rock_largeB_NE.png`,
    `${ISO}/rock_largeC_NE.png`,
    `${ISO}/stone_largeA_NE.png`,
    `${ISO}/stone_largeB_NE.png`,
  ],
  flowers: [
    `${ISO}/grass_large_NE.png`,
    `${ISO}/grass_leafs_NE.png`,
    `${ISO}/flower_yellowA_NE.png`,
    `${ISO}/flower_redA_NE.png`,
    `${ISO}/flower_purpleA_NE.png`,
    `${ISO}/plant_bushDetailed_NE.png`,
  ],
  fence: [
    `${ISO}/fence_simpleLow_NE.png`,
    `${ISO}/fence_simple_NE.png`,
    `${ISO}/fence_planks_NE.png`,
    `${ISO}/fence_corner_NE.png`,
    `${ISO}/fence_gate_NE.png`,
  ],
  crops: [
    `${ISO}/crops_dirtRow_NE.png`,
    `${ISO}/crops_dirtDoubleRow_NE.png`,
    `${ISO}/crops_cornStageB_NE.png`,
    `${ISO}/crops_wheatStageB_NE.png`,
    `${ISO}/crops_leafsStageB_NE.png`,
  ],
  platforms: [
    `${ISO}/platform_grass_NE.png`,
    `${ISO}/platform_stone_NE.png`,
    `${ISO}/platform_beach_NE.png`,
  ],
  pathDecor: [
    `${ISO}/path_stone_NE.png`,
    `${ISO}/path_stoneCorner_NE.png`,
    `${ISO}/path_stoneCircle_NE.png`,
    `${ISO}/path_wood_NE.png`,
    `${ISO}/path_woodCorner_NE.png`,
  ],
  smallNature: [
    `${ISO}/mushroom_redGroup_NE.png`,
    `${ISO}/mushroom_tanGroup_NE.png`,
    `${ISO}/stump_roundDetailed_NE.png`,
    `${ISO}/stump_squareDetailedWide_NE.png`,
    `${ISO}/plant_bushSmall_NE.png`,
    `${ISO}/plant_bushTriangle_NE.png`,
  ],
} as const;

type TileKind = "grass" | "path" | "river";
type CellRecord = { col: number; row: number; height: number; kind: TileKind };
type GridMap = Map<string, CellRecord>;

function loadTexture(path: string) {
  const cached = textureCache.get(path);
  if (cached) return cached;
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  textureCache.set(path, texture);
  return texture;
}

function pick<T>(seed: number, index: number, list: readonly T[]) {
  return list[Math.abs(seed + index * 17) % list.length];
}

function createIsoSprite(path: string, x: number, y: number, z: number, width: number, height: number, renderOrder: number) {
  const material = new THREE.SpriteMaterial({
    map: loadTexture(path),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    alphaTest: 0.05,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = renderOrder;
  return sprite;
}

function cellKey(col: number, row: number) {
  return `${col}:${row}`;
}

function gridToWorld(col: number, row: number, level: number) {
  return {
    x: (col - row) * CELL_W,
    y: -(col + row) * CELL_H + level * LEVEL_Y,
    z: level * 0.02 - (col + row) * 0.01,
  };
}

function rasterizePath(points: Array<{ col: number; row: number }>, width: number) {
  const cells = new Set<string>();
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row), 1) * 3;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const baseCol = Math.round(a.col + (b.col - a.col) * t);
      const baseRow = Math.round(a.row + (b.row - a.row) * t);
      for (let dx = -width; dx <= width; dx += 1) {
        for (let dy = -width; dy <= width; dy += 1) {
          if (Math.abs(dx) + Math.abs(dy) > width + 1) continue;
          cells.add(cellKey(baseCol + dx, baseRow + dy));
        }
      }
    }
  }
  return cells;
}

function applyHeightMask(grid: GridMap, originCol: number, originRow: number, rows: string[], height: number) {
  rows.forEach((line, rowIndex) => {
    [...line].forEach((char, colIndex) => {
      if (char === ".") return;
      const col = originCol + colIndex;
      const row = originRow + rowIndex;
      const key = cellKey(col, row);
      const current = grid.get(key);
      if (!current || current.height < height) {
        grid.set(key, { col, row, height, kind: current?.kind ?? "grass" });
      }
    });
  });
}

function removeHeightMask(grid: GridMap, originCol: number, originRow: number, rows: string[]) {
  rows.forEach((line, rowIndex) => {
    [...line].forEach((char, colIndex) => {
      if (char === ".") return;
      grid.delete(cellKey(originCol + colIndex, originRow + rowIndex));
    });
  });
}

function buildShowcaseGrid(seed: number) {
  const pathCells = rasterizePath(
    [
      { col: -6, row: 4 },
      { col: -4, row: 2 },
      { col: -2, row: 1 },
      { col: 0, row: 0 },
      { col: 2, row: -1 },
      { col: 4, row: -2 },
      { col: 6, row: -4 },
    ],
    1,
  );
  const campPathCells = rasterizePath(
    [
      { col: -5, row: 0 },
      { col: -4, row: -1 },
      { col: -2, row: -1 },
      { col: -1, row: -2 },
    ],
    0,
  );
  const riverCells = rasterizePath(
    [
      { col: -8, row: 1 },
      { col: -6, row: 0 },
      { col: -4, row: -1 },
      { col: -2, row: -2 },
      { col: 0, row: -3 },
      { col: 2, row: -4 },
      { col: 4, row: -4 },
      { col: 6, row: -3 },
    ],
    1,
  );
  const grid: GridMap = new Map();
  applyHeightMask(
    grid,
    -7,
    -3,
    [
      '...xxxxx....',
      '..xxxxxxxx..',
      '.xxxxxxxxxx..',
      'xxxxxxxxxxxx.',
      'xxxxxxxxxxxxx',
      '.xxxxxxxxxxxx',
      '..xxxxxxxxxxx',
      '...xxxxxxxxx.',
      '....xxxxxxx..',
    ],
    1,
  );
  applyHeightMask(
    grid,
    -5,
    -2,
    [
      '..xxxxx.',
      '.xxxxxxx',
      'xxxxxxxx',
      '.xxxxxxx',
      '..xxxxx.',
    ],
    2,
  );
  applyHeightMask(
    grid,
    -1,
    -6,
    [
      '..xxxx',
      '.xxxxx',
      'xxxxxx',
      '.xxxxx',
      '..xxx.',
    ],
    3,
  );
  applyHeightMask(
    grid,
    0,
    -5,
    [
      '..xx',
      '.xxx',
      'xxxx',
      '.xxx',
      '..xx',
    ],
    4,
  );
  applyHeightMask(
    grid,
    1,
    -4,
    [
      '.xx',
      'xxx',
      '.xx',
    ],
    5,
  );
  applyHeightMask(
    grid,
    4,
    -1,
    [
      '.xxxx.',
      'xxxxxx',
      'xxxxxx',
      '.xxxxx',
      '..xxx.',
    ],
    2,
  );
  applyHeightMask(
    grid,
    2,
    3,
    [
      '..xxx.',
      '.xxxxx',
      'xxxxxx',
      '.xxxx.',
    ],
    2,
  );
  applyHeightMask(
    grid,
    6,
    0,
    [
      '.xxx.',
      'xxxxx',
      'xxxxx',
      '.xxx.',
    ],
    2,
  );
  applyHeightMask(
    grid,
    -8,
    4,
    [
      '.xxx',
      'xxxx',
      '.xx.',
    ],
    1,
  );
  applyHeightMask(
    grid,
    -6,
    2,
    [
      '.xxx.',
      'xxxxx',
      '.xxx.',
    ],
    2,
  );
  applyHeightMask(
    grid,
    3,
    5,
    [
      '.xx.',
      'xxxx',
      '.xx.',
    ],
    2,
  );
  removeHeightMask(grid, -6, -2, ['x..x', '....', '..x.']);
  removeHeightMask(grid, 2, -2, ['.x.', 'x..']);
  removeHeightMask(grid, -3, 3, ['x..', '..x']);
  removeHeightMask(grid, -8, 1, ['.x..', '..x.']);
  removeHeightMask(grid, 8, -1, ['..x', '.x.']);

  for (const cell of grid.values()) {
    const key = cellKey(cell.col, cell.row);
    cell.kind = riverCells.has(key) ? 'river' : pathCells.has(key) || campPathCells.has(key) ? 'path' : 'grass';
  }

  return { grid, pathCells, campPathCells, riverCells };
}

function cellHeight(grid: GridMap, col: number, row: number) {
  return grid.get(cellKey(col, row))?.height ?? 0;
}

function topLevelFor(col: number, row: number, grid: GridMap) {
  return cellHeight(grid, col, row) - 1;
}

function addTopTiles(group: THREE.Group, grid: GridMap, seed: number) {
  for (const cell of [...grid.values()].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const world = gridToWorld(cell.col, cell.row, topLevelFor(cell.col, cell.row, grid));
    const texture = pick(seed, cell.col * 37 + cell.row * 13, spriteSets[cell.kind]);
    const size = cell.kind === "grass" ? 20.2 : 19.4;
    group.add(createIsoSprite(texture, world.x, world.y, world.z, size, size, 1000 + (cell.col + cell.row) * 8));
  }
}

function addCliffFace(group: THREE.Group, col: number, row: number, level: number, seed: number, stoneBias: boolean, xOffset: number, yOffset: number, order: number) {
  const world = gridToWorld(col, row, level);
  const set = stoneBias ? spriteSets.cliffStone : spriteSets.cliffRock;
  const texture = pick(seed, col * 23 + row * 19 + level * 7, set);
  group.add(createIsoSprite(texture, world.x + xOffset, world.y + yOffset, world.z - 0.1, 12.7, 13.9, order));
}

function addCliffFaces(group: THREE.Group, grid: GridMap, seed: number) {
  for (const cell of grid.values()) {
    const leftHeight = cellHeight(grid, cell.col - 1, cell.row);
    const rightHeight = cellHeight(grid, cell.col + 1, cell.row);
    const frontHeight = cellHeight(grid, cell.col, cell.row + 1);
    const backHeight = cellHeight(grid, cell.col, cell.row - 1);
    const visibleFrontDrop = Math.max(0, cell.height - frontHeight);
    const visibleRightDrop = Math.max(0, cell.height - rightHeight);
    const visibleLeftDrop = Math.max(0, cell.height - leftHeight);
    const nearTop = cell.height >= 4;

    for (let drop = 0; drop < visibleFrontDrop; drop += 1) {
      addCliffFace(group, cell.col, cell.row, cell.height - drop - 1, seed + 100, nearTop, 0, -2.2, 700 + cell.col + cell.row + drop);
    }
    for (let drop = 0; drop < visibleRightDrop; drop += 1) {
      addCliffFace(group, cell.col, cell.row, cell.height - drop - 1, seed + 200, nearTop, 1.2, -1.6, 730 + cell.col + cell.row + drop);
    }
    if (visibleLeftDrop > 0 && cell.col <= -4) {
      addCliffFace(group, cell.col, cell.row, cell.height - 1, seed + 300, nearTop, -1.3, -1.4, 710 + cell.col + cell.row);
    }
    if (backHeight < cell.height && cell.height >= 4) {
      const world = gridToWorld(cell.col, cell.row, cell.height - 1);
      const topTexture = pick(seed + 400, cell.col * 11 + cell.row * 7, spriteSets.cliffTop);
      group.add(createIsoSprite(topTexture, world.x, world.y + 0.8, world.z - 0.15, 6.4, 6.4, 860 + cell.col + cell.row));
    }
  }
}

function placeSprite(group: THREE.Group, path: string, col: number, row: number, level: number, width: number, height: number, order: number, yOffset = 0) {
  const world = gridToWorld(col, row, level);
  group.add(createIsoSprite(path, world.x, world.y + yOffset, world.z, width, height, order));
}

function addFenceLine(group: THREE.Group, points: Array<{ col: number; row: number; level: number }>, seed: number) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const steps = Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row), 1) * 2;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const col = Math.round(a.col + (b.col - a.col) * t);
      const row = Math.round(a.row + (b.row - a.row) * t);
      const level = a.level;
      const texture = pick(seed, i * 31 + step, spriteSets.fence);
      placeSprite(group, texture, col, row, level, 4.2, 3.8, 1500 + i * 10 + step, 1.35);
    }
  }
}

function addCropPatch(group: THREE.Group, col0: number, row0: number, cols: number, rows: number, level: number, seed: number) {
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const texture = pick(seed + row * 13, col, spriteSets.crops);
      placeSprite(group, texture, col0 + col, row0 + row, level, 5.0, 4.3, 1410 + row * 10 + col, 0.45);
    }
  }
}

function addTerraceCaps(group: THREE.Group, seed: number) {
  const placements = [
    { col: -5, row: 3, level: 2, size: 7.5 },
    { col: -4, row: 4, level: 2, size: 7.0 },
    { col: 0, row: -4, level: 4, size: 7.8 },
    { col: 2, row: -5, level: 5, size: 6.5 },
    { col: 5, row: 1, level: 2, size: 7.2 },
    { col: 2, row: 5, level: 2, size: 7.0 },
    { col: 7, row: 3, level: 2, size: 6.6 },
  ];
  placements.forEach((placement, index) => {
    const texture = pick(seed, index, spriteSets.platforms);
    placeSprite(group, texture, placement.col, placement.row, placement.level, placement.size, placement.size, 1180 + index, 0.45);
  });
}

function addPathAccents(group: THREE.Group, seed: number) {
  const placements = [
    { col: -3, row: -1, level: 1 },
    { col: -2, row: 0, level: 1 },
    { col: 0, row: 1, level: 1 },
    { col: 2, row: 3, level: 1 },
    { col: 4, row: 5, level: 1 },
    { col: -5, row: 1, level: 1 },
    { col: 3, row: 4, level: 1 },
  ];
  placements.forEach((placement, index) => {
    const texture = pick(seed, index, spriteSets.pathDecor);
    placeSprite(group, texture, placement.col, placement.row, placement.level, 4.4, 3.8, 1440 + index, 0.55);
  });
}

function addTreeCluster(group: THREE.Group, center: { col: number; row: number }, level: number, count: number, radius: number, seed: number, set: typeof spriteSets.treeTall | typeof spriteSets.treeRound | typeof spriteSets.palm) {
  for (let i = 0; i < count; i += 1) {
    const angle = seed * 0.014 + i * 1.33;
    const distance = radius * (0.35 + (((seed + i * 23) % 100) / 100) * 0.65);
    const col = center.col + Math.round(Math.cos(angle) * distance);
    const row = center.row + Math.round(Math.sin(angle) * distance);
    const texture = pick(seed, i, set);
    const isPalm = set === spriteSets.palm;
    const size = isPalm ? { w: 8.5, h: 12.0 } : set === spriteSets.treeTall ? { w: 9.0, h: 14.0 } : { w: 7.2, h: 10.5 };
    placeSprite(group, texture, col, row, level, size.w, size.h, 1700 + i, 1.55);
  }
}

function addRockScatter(group: THREE.Group, placements: Array<{ col: number; row: number; level: number }>, seed: number) {
  placements.forEach((placement, index) => {
    const texture = pick(seed, index, spriteSets.rock);
    placeSprite(group, texture, placement.col, placement.row, placement.level, 5.8, 4.8, 1320 + index, 0.8);
  });
}

function addFlowerScatter(group: THREE.Group, placements: Array<{ col: number; row: number; level: number }>, seed: number) {
  placements.forEach((placement, index) => {
    const texture = pick(seed, index, spriteSets.flowers);
    placeSprite(group, texture, placement.col, placement.row, placement.level, 3.6, 3.0, 1260 + index, 0.5);
  });
}

function addSmallNatureScatter(group: THREE.Group, placements: Array<{ col: number; row: number; level: number }>, seed: number) {
  placements.forEach((placement, index) => {
    const texture = pick(seed, index, spriteSets.smallNature);
    placeSprite(group, texture, placement.col, placement.row, placement.level, 4.2, 3.8, 1280 + index, 0.75);
  });
}

function addBackdropCliffs(group: THREE.Group) {
  const wallPlacements = [
    { col: -1, row: -6, level: 4 },
    { col: 0, row: -6, level: 4 },
    { col: 1, row: -6, level: 4 },
    { col: 2, row: -6, level: 4 },
    { col: 2, row: -5, level: 5 },
    { col: 3, row: -5, level: 4 },
    { col: 4, row: -4, level: 3 },
  ];
  wallPlacements.forEach((placement, index) => {
    const texture = pick(91, index, spriteSets.cliffStone);
    placeSprite(group, texture, placement.col, placement.row, placement.level, 12.5, 15.5, 820 + index, -0.6);
  });
}

function addHeroProps(group: THREE.Group, seed: number) {
  addTerraceCaps(group, seed + 20);
  addPathAccents(group, seed + 40);
  placeSprite(group, `${ISO}/log_stackLarge_NE.png`, 1, -6, 4, 8.5, 5.5, 1900, 2.4);
  placeSprite(group, `${ISO}/tent_smallOpen_NE.png`, -5, 1, 1, 8.8, 8.2, 1910, 2.0);
  placeSprite(group, `${ISO}/campfire_stones_NE.png`, 3, 0, 1, 4.6, 4.0, 1915, 1.6);
  placeSprite(group, `${ISO}/sign_NE.png`, -4, 1, 1, 4.0, 4.2, 1918, 1.5);
  placeSprite(group, `${ISO}/bridge_center_wood_NE.png`, 2, 3, 1, 10.0, 7.2, 1920, 1.4);
  placeSprite(group, `${ISO}/bridge_side_wood_NE.png`, 1, 3, 1, 8.4, 6.8, 1919, 1.4);
  placeSprite(group, `${ISO}/bridge_side_wood_NE.png`, 3, 3, 1, 8.4, 6.8, 1921, 1.4);
  placeSprite(group, `${ISO}/cliff_waterfallTop_stone_NE.png`, 4, -2, 1, 11.5, 11.5, 1880, 2.0);
  placeSprite(group, `${ISO}/cliff_waterfall_stone_NE.png`, 4, -1, 0, 13.0, 13.8, 1879, -1.0);
  placeSprite(group, `${ISO}/cliff_waterfallTop_stone_NW.png`, -6, 2, 2, 11.5, 11.5, 1881, 1.8);
  placeSprite(group, `${ISO}/cliff_waterfall_stone_NW.png`, -6, 3, 1, 13.0, 13.8, 1878, -0.8);
  placeSprite(group, `${ISO}/ground_riverOpen_NE.png`, 2, 6, 1, 11.0, 11.0, 1860, 0.5);
  placeSprite(group, `${ISO}/statue_obelisk_NE.png`, 7, 6, 1, 5.0, 8.6, 1930, 2.2);
  placeSprite(group, `${ISO}/bridge_woodRound_NE.png`, 0, 1, 1, 9.6, 7.0, 1922, 1.35);
  placeSprite(group, `${ISO}/bridge_stoneRound_NE.png`, 2, 2, 1, 9.0, 6.8, 1923, 1.35);
  placeSprite(group, `${ISO}/ground_riverCornerSmall_NE.png`, -2, 4, 0, 8.5, 8.5, 1862, 0.3);

  addFenceLine(
    group,
    [
      { col: -4, row: 2, level: 1 },
      { col: -2, row: 2, level: 1 },
      { col: -2, row: 4, level: 1 },
      { col: -4, row: 4, level: 1 },
      { col: -4, row: 2, level: 1 },
    ],
    seed + 70,
  );
  addFenceLine(
    group,
    [
      { col: 1, row: 4, level: 1 },
      { col: 3, row: 4, level: 1 },
      { col: 3, row: 6, level: 1 },
      { col: 1, row: 6, level: 1 },
      { col: 1, row: 4, level: 1 },
    ],
    seed + 90,
  );
  addFenceLine(
    group,
    [
      { col: 6, row: 1, level: 1 },
      { col: 9, row: 1, level: 1 },
      { col: 9, row: 4, level: 1 },
      { col: 6, row: 4, level: 1 },
      { col: 6, row: 1, level: 1 },
    ],
    seed + 110,
  );
  addCropPatch(group, 6, 1, 4, 4, 1, seed + 130);

  addTreeCluster(group, { col: 1, row: -6 }, 4, 4, 2.0, seed + 200, spriteSets.treeTall);
  addTreeCluster(group, { col: -5, row: -1 }, 1, 4, 2.2, seed + 220, spriteSets.treeRound);
  addTreeCluster(group, { col: -7, row: 4 }, 0, 3, 2.2, seed + 240, spriteSets.treeRound);
  addTreeCluster(group, { col: 8, row: 0 }, 1, 4, 1.8, seed + 260, spriteSets.palm);
  addTreeCluster(group, { col: 4, row: 4 }, 1, 3, 1.6, seed + 280, spriteSets.treeRound);
  addTreeCluster(group, { col: 6, row: -5 }, 0, 3, 1.6, seed + 290, spriteSets.treeTall);
  addTreeCluster(group, { col: -2, row: 6 }, 0, 3, 1.8, seed + 295, spriteSets.treeRound);
  addTreeCluster(group, { col: -7, row: -2 }, 1, 3, 1.4, seed + 296, spriteSets.treeRound);
  addTreeCluster(group, { col: 6, row: 5 }, 1, 3, 1.4, seed + 297, spriteSets.palm);

  addRockScatter(
    group,
    [
      { col: -2, row: -4, level: 2 },
      { col: 0, row: -4, level: 3 },
      { col: 4, row: 0, level: 1 },
      { col: 1, row: 6, level: 1 },
      { col: -6, row: 0, level: 1 },
      { col: 8, row: 5, level: 0 },
    ],
    seed + 300,
  );
  addFlowerScatter(
    group,
    [
      { col: -3, row: 3, level: 1 },
      { col: -2, row: 4, level: 1 },
      { col: 0, row: 6, level: 1 },
      { col: 2, row: 5, level: 1 },
      { col: 5, row: 5, level: 1 },
      { col: 7, row: 1, level: 1 },
    ],
    seed + 330,
  );
  addSmallNatureScatter(
    group,
    [
      { col: -6, row: 3, level: 2 },
      { col: -5, row: 5, level: 1 },
      { col: -1, row: 3, level: 1 },
      { col: 1, row: -3, level: 2 },
      { col: 3, row: -5, level: 4 },
      { col: 4, row: 2, level: 2 },
      { col: 6, row: 5, level: 2 },
      { col: 8, row: 3, level: 2 },
    ],
    seed + 360,
  );
}

export function buildKenneyReferencePlateComposition() {
  const group = new THREE.Group();
  group.name = "kenney-reference-plate-composition";
  const sprite = createIsoSprite(`${ISO}/../Sample.png`, 0, 0, 0, 81.75, 46, 10);
  sprite.name = "kenney-nature-kit-sample-reference";
  group.add(sprite);
  return group;
}

export function buildKenneyIsoShowcaseComposition(project: WorldProject, layout: ShowcaseLayoutConfig) {
  const group = new THREE.Group();
  group.name = "kenney-iso-showcase-composition";
  const seed = Number(project.id.split("-").at(-1)) || 42;
  const { grid } = buildShowcaseGrid(seed);

  addTopTiles(group, grid, seed);
  addCliffFaces(group, grid, seed);
  addBackdropCliffs(group);
  addHeroProps(group, seed);

  const cameraBias = layout.camera.target;
  group.position.set(-cameraBias.x * 0.15, -cameraBias.y * 0.15 + 2.6, 0);
  return group;
}
