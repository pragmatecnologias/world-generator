import type { AssetDefinition } from "../../types";

export type AssetRegistryEntry = AssetDefinition & {
  bounds?: {
    width: number;
    height: number;
    depth: number;
  };
  placementRules?: NonNullable<AssetDefinition["placementRules"]>;
};

export type AssetRegistry = {
  entries: AssetRegistryEntry[];
  byId: Record<string, AssetRegistryEntry>;
  byCategory: Record<string, AssetRegistryEntry[]>;
  byTag: Record<string, AssetRegistryEntry[]>;
};

export function normalizeAssetDefinition(asset: AssetDefinition): AssetRegistryEntry {
  return {
    ...asset,
    sourceType: asset.sourceType ?? (asset.filePath === "built-in" ? "builtin" : asset.filePath.endsWith(".gltf") ? "gltf" : "glb"),
    bounds: asset.bounds ?? { width: 1, height: 1, depth: 1 },
    placementRules: asset.placementRules ?? {
      paintEligible: asset.canPaint,
      scatterEligible: true,
      alignToTerrain: true,
      minScale: Math.max(0.5, asset.defaultScale * 0.8),
      maxScale: asset.defaultScale * 1.4,
    },
  };
}

export function buildAssetRegistry(assets: AssetDefinition[]): AssetRegistry {
  const entries = assets.map(normalizeAssetDefinition);
  const byId: Record<string, AssetRegistryEntry> = {};
  const byCategory: Record<string, AssetRegistryEntry[]> = {};
  const byTag: Record<string, AssetRegistryEntry[]> = {};

  for (const entry of entries) {
    byId[entry.id] = entry;
    byCategory[entry.category] = byCategory[entry.category] ? [...byCategory[entry.category], entry] : [entry];
    for (const tag of entry.tags) {
      byTag[tag] = byTag[tag] ? [...byTag[tag], entry] : [entry];
    }
  }

  return { entries, byId, byCategory, byTag };
}

export function getScatterEligibleAssets(assets: AssetDefinition[]) {
  return buildAssetRegistry(assets).entries.filter((asset) => asset.placementRules?.scatterEligible !== false);
}

export function getPaintEligibleAssets(assets: AssetDefinition[]) {
  return buildAssetRegistry(assets).entries.filter((asset) => asset.placementRules?.paintEligible !== false);
}
