import type { AssetDefinition } from "../../types";

// ── Kit base paths ────────────────────────────────────────────────────────
export const FANTASY_TOWN_BASE = "/assets/kenney_fantasy-town-kit_2.0/Models/GLB format";
export const FANTASY_NATURE_BASE = "/assets/kenney_nature-kit/Models/GLTF format";

// ── Model pools (proven in kenneyShowcaseComposer.ts) ─────────────────────

export const FOREST_TREES = [
  `${FANTASY_NATURE_BASE}/tree_pineTallA.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineTallB.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineTallC.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineTallD.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineRoundA.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineRoundB.glb`,
  `${FANTASY_NATURE_BASE}/tree_pineDefaultA.glb`,
  `${FANTASY_NATURE_BASE}/tree_small.glb`,
  `${FANTASY_NATURE_BASE}/tree_oak.glb`,
];

export const FOREST_ROCKS = [
  `${FANTASY_NATURE_BASE}/rock_largeA.glb`,
  `${FANTASY_NATURE_BASE}/rock_largeB.glb`,
  `${FANTASY_NATURE_BASE}/rock_largeC.glb`,
  `${FANTASY_NATURE_BASE}/rock_largeD.glb`,
  `${FANTASY_NATURE_BASE}/rock_largeE.glb`,
  `${FANTASY_NATURE_BASE}/rock_largeF.glb`,
  `${FANTASY_NATURE_BASE}/stone_largeA.glb`,
  `${FANTASY_NATURE_BASE}/stone_largeB.glb`,
  `${FANTASY_NATURE_BASE}/stone_largeC.glb`,
  `${FANTASY_NATURE_BASE}/stone_smallA.glb`,
];

export const CLIFF_MODELS = [
  `${FANTASY_NATURE_BASE}/cliff_block_stone.glb`,
  `${FANTASY_NATURE_BASE}/cliff_block_rock.glb`,
  `${FANTASY_NATURE_BASE}/cliff_corner_stone.glb`,
  `${FANTASY_NATURE_BASE}/cliff_corner_rock.glb`,
  `${FANTASY_NATURE_BASE}/cliff_half_stone.glb`,
  `${FANTASY_NATURE_BASE}/cliff_half_rock.glb`,
  `${FANTASY_NATURE_BASE}/cliff_steps_stone.glb`,
  `${FANTASY_NATURE_BASE}/cliff_steps_rock.glb`,
  `${FANTASY_NATURE_BASE}/cliff_top_stone.glb`,
  `${FANTASY_NATURE_BASE}/cliff_top_rock.glb`,
];

export const PATH_MODELS = [
  `${FANTASY_NATURE_BASE}/path_stone.glb`,
  `${FANTASY_NATURE_BASE}/path_stoneCorner.glb`,
  `${FANTASY_NATURE_BASE}/path_stoneCircle.glb`,
  `${FANTASY_NATURE_BASE}/path_stoneEnd.glb`,
];

export const WATER_EDGE_MODELS = [
  `${FANTASY_NATURE_BASE}/ground_riverRocks.glb`,
  `${FANTASY_NATURE_BASE}/ground_riverBendBank.glb`,
  `${FANTASY_NATURE_BASE}/ground_pathBendBank.glb`,
];

export const CROP_MODELS = [
  `${FANTASY_NATURE_BASE}/crops_cornStageC.glb`,
  `${FANTASY_NATURE_BASE}/crops_wheatStageB.glb`,
  `${FANTASY_NATURE_BASE}/crops_leafsStageB.glb`,
  `${FANTASY_NATURE_BASE}/crops_cornStageB.glb`,
  `${FANTASY_NATURE_BASE}/crops_dirtRow.glb`,
  `${FANTASY_NATURE_BASE}/crops_dirtDoubleRow.glb`,
];

export const CAMP_MODELS = [
  `${FANTASY_NATURE_BASE}/campfire_stones.glb`,
  `${FANTASY_NATURE_BASE}/tent_smallOpen.glb`,
  `${FANTASY_NATURE_BASE}/tent_detailedOpen.glb`,
  `${FANTASY_NATURE_BASE}/campfire_logs.glb`,
];

export const FENCE_MODELS = [
  `${FANTASY_NATURE_BASE}/fence_simpleLow.glb`,
  `${FANTASY_NATURE_BASE}/fence_simple.glb`,
];

export const BRIDGE_MODELS = [
  `${FANTASY_NATURE_BASE}/bridge_woodRound.glb`,
  `${FANTASY_NATURE_BASE}/bridge_stoneNarrow.glb`,
  `${FANTASY_NATURE_BASE}/bridge_woodNarrow.glb`,
];

// ── Town kit pieces ───────────────────────────────────────────────────────

export const TOWN_TREES = [
  `${FANTASY_TOWN_BASE}/tree.glb`,
  `${FANTASY_TOWN_BASE}/tree-crooked.glb`,
  `${FANTASY_TOWN_BASE}/tree-high.glb`,
  `${FANTASY_TOWN_BASE}/tree-high-round.glb`,
];

// ── Structure presets (adapted from addFantasyTown in kenneyShowcaseComposer.ts) ──

export type TownPiece = {
  model: string;
  dx: number;
  dz: number;
  dy?: number;
  ry?: number;
  fit?: number;
  sc?: number;
};

export type StructurePreset = {
  id: string;
  name: string;
  category: string;
  pieces: TownPiece[];
  defaultScale: number;
};

export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    id: "town-hall",
    name: "Town Hall",
    category: "Structure",
    defaultScale: 0.5,
    pieces: [
      { model: "wall", dx: -0.38, dz: -0.22, ry: 0 },
      { model: "wall", dx: 0.38, dz: -0.22, ry: 0 },
      { model: "wall", dx: -0.38, dz: 0.22, ry: Math.PI },
      { model: "wall", dx: 0.38, dz: 0.22, ry: Math.PI },
      { model: "wall-side", dx: -0.72, dz: 0.0, ry: Math.PI / 2 },
      { model: "wall-side", dx: 0.72, dz: 0.0, ry: -Math.PI / 2 },
      { model: "wall-door", dx: 0.0, dz: -0.22, ry: 0, dy: 0.01 },
      { model: "roof-gable", dx: 0.0, dz: -0.22, dy: 0.55, ry: 0, sc: 0.55 },
      { model: "roof-gable", dx: 0.0, dz: 0.22, dy: 0.55, ry: Math.PI, sc: 0.55 },
      { model: "roof-gable-top", dx: 0.0, dz: 0.0, dy: 0.72, ry: 0, sc: 0.55 },
      { model: "wall-window-round", dx: -0.38, dz: -0.22, ry: 0, dy: 0.01, sc: 0.45 },
      { model: "wall-window-round", dx: 0.38, dz: -0.22, ry: 0, dy: 0.01, sc: 0.45 },
      { model: "chimney", dx: 0.5, dz: 0.15, dy: 0.7, ry: 0, sc: 0.35 },
      { model: "banner-green", dx: 0.0, dz: -0.32, dy: 0.5, ry: 0, sc: 0.35 },
    ],
  },
  {
    id: "stone-cottage",
    name: "Stone Cottage",
    category: "Structure",
    defaultScale: 0.5,
    pieces: [
      { model: "wall", dx: -0.35, dz: -0.2, ry: 0 },
      { model: "wall", dx: 0.35, dz: -0.2, ry: 0 },
      { model: "wall", dx: -0.35, dz: 0.2, ry: Math.PI },
      { model: "wall", dx: 0.35, dz: 0.2, ry: Math.PI },
      { model: "wall-side", dx: -0.65, dz: 0.0, ry: Math.PI / 2 },
      { model: "wall-side", dx: 0.65, dz: 0.0, ry: -Math.PI / 2 },
      { model: "wall-door", dx: 0.35, dz: -0.2, ry: 0, dy: 0.01 },
      { model: "roof-gable", dx: 0.0, dz: -0.2, dy: 0.5, ry: 0, sc: 0.5 },
      { model: "roof-gable", dx: 0.0, dz: 0.2, dy: 0.5, ry: Math.PI, sc: 0.5 },
      { model: "roof-gable-top", dx: 0.0, dz: 0.0, dy: 0.65, ry: 0, sc: 0.5 },
      { model: "wall-window-shutters", dx: -0.35, dz: -0.2, ry: 0, dy: 0.01, sc: 0.4 },
      { model: "chimney", dx: -0.35, dz: 0.15, dy: 0.6, ry: 0, sc: 0.3 },
    ],
  },
  {
    id: "wood-cottage",
    name: "Wood Cottage",
    category: "Structure",
    defaultScale: 0.5,
    pieces: [
      { model: "wall-wood", dx: -0.35, dz: -0.2, ry: 0 },
      { model: "wall-wood", dx: 0.35, dz: -0.2, ry: 0 },
      { model: "wall-wood", dx: -0.35, dz: 0.2, ry: Math.PI },
      { model: "wall-wood", dx: 0.35, dz: 0.2, ry: Math.PI },
      { model: "wall-wood-side", dx: -0.65, dz: 0.0, ry: Math.PI / 2 },
      { model: "wall-wood-side", dx: 0.65, dz: 0.0, ry: -Math.PI / 2 },
      { model: "wall-wood-door", dx: -0.35, dz: -0.2, ry: 0, dy: 0.01 },
      { model: "roof-gable", dx: 0.0, dz: -0.2, dy: 0.5, ry: 0, sc: 0.5 },
      { model: "roof-gable", dx: 0.0, dz: 0.2, dy: 0.5, ry: Math.PI, sc: 0.5 },
      { model: "roof-gable-top", dx: 0.0, dz: 0.0, dy: 0.65, ry: 0, sc: 0.5 },
      { model: "wall-wood-window-shutters", dx: 0.35, dz: -0.2, ry: 0, dy: 0.01, sc: 0.4 },
    ],
  },
  {
    id: "windmill",
    name: "Windmill",
    category: "Structure",
    defaultScale: 0.5,
    pieces: [
      { model: "wall-block", dx: 0.0, dz: 0.0, ry: 0, sc: 0.5 },
      { model: "wall-block", dx: 0.0, dz: 0.0, dy: 0.42, ry: 0, sc: 0.45 },
      { model: "roof-high-point", dx: 0.0, dz: 0.0, dy: 0.82, ry: 0, sc: 0.5 },
      { model: "wall-wood-door", dx: 0.0, dz: -0.28, ry: 0, dy: 0.01, sc: 0.4 },
      { model: "wheel", dx: 0.0, dz: -0.35, dy: 0.5, ry: 0, sc: 0.45 },
    ],
  },
  {
    id: "watermill",
    name: "Watermill",
    category: "Structure",
    defaultScale: 0.5,
    pieces: [
      { model: "wall-wood", dx: -0.35, dz: -0.18, ry: 0 },
      { model: "wall-wood", dx: 0.35, dz: -0.18, ry: 0 },
      { model: "wall-wood", dx: -0.35, dz: 0.18, ry: Math.PI },
      { model: "wall-wood", dx: 0.35, dz: 0.18, ry: Math.PI },
      { model: "wall-wood-side", dx: -0.65, dz: 0.0, ry: Math.PI / 2 },
      { model: "wall-wood-side", dx: 0.65, dz: 0.0, ry: -Math.PI / 2 },
      { model: "roof-gable", dx: 0.0, dz: -0.18, dy: 0.48, ry: 0, sc: 0.48 },
      { model: "roof-gable", dx: 0.0, dz: 0.18, dy: 0.48, ry: Math.PI, sc: 0.48 },
      { model: "roof-gable-top", dx: 0.0, dz: 0.0, dy: 0.62, ry: 0, sc: 0.48 },
      { model: "watermill", dx: 0.75, dz: 0.0, dy: 0.05, ry: -Math.PI / 2, sc: 0.45 },
    ],
  },
  {
    id: "market-stall",
    name: "Market Stall",
    category: "Prop",
    defaultScale: 0.45,
    pieces: [
      { model: "stall-green", dx: 0, dz: 0, ry: 0, sc: 0.45 },
      { model: "stall-bench", dx: 0, dz: 0.18, ry: 0, sc: 0.38 },
    ],
  },
  {
    id: "fountain",
    name: "Fountain",
    category: "Prop",
    defaultScale: 0.5,
    pieces: [
      { model: "fountain-round", dx: 0.0, dz: 0.0, ry: 0, sc: 0.5 },
      { model: "fountain-round-detail", dx: 0.0, dz: 0.0, dy: 0.01, ry: 0, sc: 0.45 },
      { model: "fountain-center", dx: 0.0, dz: 0.0, dy: 0.08, ry: 0, sc: 0.4 },
    ],
  },
  {
    id: "fence-segment",
    name: "Fence with Gate",
    category: "Prop",
    defaultScale: 0.5,
    pieces: [
      { model: "fence", dx: -0.55, dz: 0, ry: Math.PI / 2, sc: 0.5 },
      { model: "fence", dx: 0.0, dz: 0, ry: Math.PI / 2, sc: 0.5 },
      { model: "fence", dx: 0.55, dz: 0, ry: Math.PI / 2, sc: 0.5 },
      { model: "fence-gate", dx: 0, dz: -0.15, ry: 0, sc: 0.45 },
    ],
  },
];

// ── Build AssetDefinition entries ──────────────────────────────────────────

let _nextId = 1000;
function nextId(): string {
  return `fantasy-${_nextId++}`;
}

function makeNatureAsset(
  glbPath: string,
  name: string,
  category: string,
  tags: string[],
  canPaint: boolean,
): AssetDefinition {
  return {
    id: nextId(),
    name,
    category,
    filePath: glbPath,
    sourceType: "glb",
    defaultScale: 1,
    collisionType: "box",
    canPaint,
    tags,
    placementRules: {
      paintEligible: canPaint,
      scatterEligible: true,
      alignToTerrain: true,
      minScale: 0.7,
      maxScale: 1.5,
    },
  };
}

function makeTownAsset(
  modelId: string,
  name: string,
  category: string,
  tags: string[],
): AssetDefinition {
  return {
    id: nextId(),
    name,
    category,
    filePath: `${FANTASY_TOWN_BASE}/${modelId}.glb`,
    sourceType: "glb",
    defaultScale: 0.5,
    collisionType: "box",
    canPaint: false,
    tags,
    placementRules: {
      paintEligible: false,
      scatterEligible: true,
      alignToTerrain: true,
      minScale: 0.3,
      maxScale: 0.8,
    },
  };
}

export function buildFantasyAssetDefinitions(): AssetDefinition[] {
  const assets: AssetDefinition[] = [];

  // Nature kit - trees
  for (const path of FOREST_TREES) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Foliage", ["fantasy", "tree", "foliage"], true));
  }

  // Nature kit - rocks
  for (const path of FOREST_ROCKS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Props", ["fantasy", "rock", "stone"], true));
  }

  // Nature kit - cliffs
  for (const path of CLIFF_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Nature", ["fantasy", "cliff", "rock"], false));
  }

  // Nature kit - paths
  for (const path of PATH_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Track", ["fantasy", "path", "stone"], false));
  }

  // Nature kit - crops
  for (const path of CROP_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Farm", ["fantasy", "crop", "farm"], true));
  }

  // Nature kit - camp
  for (const path of CAMP_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Camp", ["fantasy", "camp", "prop"], false));
  }

  // Nature kit - fences
  for (const path of FENCE_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Structure", ["fantasy", "fence", "wood"], false));
  }

  // Nature kit - bridges
  for (const path of BRIDGE_MODELS) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Structure", ["fantasy", "bridge", "wood"], false));
  }

  // Town kit - trees
  for (const path of TOWN_TREES) {
    const name = path.split("/").pop()!.replace(".glb", "");
    assets.push(makeNatureAsset(path, name, "Fantasy-Town", ["fantasy", "tree", "town"], false));
  }

  // Town kit - key structural pieces
  const townPieces = [
    "wall", "wall-side", "wall-door", "wall-block", "wall-wood", "wall-wood-side", "wall-wood-door",
    "roof-gable", "roof-gable-top", "roof-high-point",
    "stall-green", "stall-red", "stall-bench",
    "fountain-round", "fountain-round-detail", "fountain-center",
    "watermill", "wheel",
    "fence", "fence-gate", "hedge", "hedge-curved",
    "lantern", "banner-green", "banner-red",
    "chimney", "cart", "cart-high",
    "stairs-stone", "planks", "planks-half",
    "wall-window-round", "wall-window-shutters",
    "wall-wood-window-shutters",
  ];
  for (const modelId of townPieces) {
    const name = modelId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    assets.push(makeTownAsset(modelId, name, "Fantasy-Town", ["fantasy", "town", "structure"]));
  }

  return assets;
}

// ── Asset map builder (model filename -> asset ID) ────────────────────────

export function buildAssetMap(assets: AssetDefinition[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const asset of assets) {
    // Extract model filename without extension from filePath
    const filename = asset.filePath.split("/").pop()?.replace(".glb", "") ?? "";
    map.set(filename, asset.id);
    // Also map by full path for nature kit models
    map.set(asset.filePath, asset.id);
  }
  return map;
}
