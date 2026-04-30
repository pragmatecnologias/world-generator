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

export type AssetSemanticRole = "foliage" | "rock" | "barrier" | "prop" | "structure" | "generic";

export function classifyAsset(asset: AssetDefinition): AssetSemanticRole {
  const name = `${asset.name} ${asset.category} ${asset.filePath}`.toLowerCase();
  const tags = asset.tags.map((tag) => tag.toLowerCase());
  if (tags.some((tag) => /cliff|canyon|ridge/.test(tag)) || /cliff|canyon|ridge/.test(name)) return "rock";
  if (tags.some((tag) => /tree|foliage|bush|plant|grass/.test(tag)) || /tree|foliage|bush|plant|grass/.test(name)) return "foliage";
  if (tags.some((tag) => /rock|stone|boulder/.test(tag)) || /rock|stone|boulder/.test(name)) return "rock";
  if (tags.some((tag) => /barrier|fence|guardrail|wall/.test(tag)) || /barrier|fence|guardrail|wall/.test(name)) return "barrier";
  if (tags.some((tag) => /house|building|structure|hut|shed/.test(tag)) || /house|building|structure|hut|shed/.test(name)) return "structure";
  if (tags.some((tag) => /prop|deco|decor|sign|crate/.test(tag)) || /prop|deco|decor|sign|crate/.test(name)) return "prop";
  return "generic";
}

export function inferAssetCategory(asset: AssetDefinition): string {
  const role = classifyAsset(asset);
  switch (role) {
    case "foliage":
      return "Nature";
    case "rock":
      return "Nature";
    case "barrier":
      return "Track";
    case "structure":
      return "Structure";
    case "prop":
      return "Prop";
    default:
      return asset.category && asset.category !== "Imported" ? asset.category : "Imported";
  }
}

export function inferAssetTags(asset: AssetDefinition): string[] {
  const tags = new Set(asset.tags.map((tag) => tag.toLowerCase()));
  const role = classifyAsset(asset);
  tags.add(role);
  if (role === "foliage") {
    tags.add("tree");
    tags.add("nature");
  } else if (role === "rock") {
    tags.add("rock");
    tags.add("nature");
    if (/cliff|canyon|ridge/i.test(asset.name) || /cliff|canyon|ridge/i.test(asset.filePath)) {
      tags.add("cliff");
    }
  } else if (role === "barrier") {
    tags.add("barrier");
    tags.add("track");
  } else if (role === "structure") {
    tags.add("structure");
  } else if (role === "prop") {
    tags.add("prop");
  }
  return [...tags];
}

export function normalizeAssetDefinition(asset: AssetDefinition): AssetRegistryEntry {
  const inferredCategory = inferAssetCategory(asset);
  const inferredTags = inferAssetTags(asset);
  return {
    ...asset,
    category: asset.category === "Imported" ? inferredCategory : asset.category,
    sourceType: asset.sourceType ?? (asset.filePath === "built-in" ? "builtin" : asset.filePath.endsWith(".gltf") ? "gltf" : "glb"),
    bounds: asset.bounds ?? { width: 1, height: 1, depth: 1 },
    placementRules: asset.placementRules ?? {
      paintEligible: asset.canPaint,
      scatterEligible: true,
      alignToTerrain: true,
      minScale: Math.max(0.5, asset.defaultScale * 0.8),
      maxScale: asset.defaultScale * 1.4,
    },
    tags: inferredTags,
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

export function getAssetsByRole(assets: AssetDefinition[], role: AssetSemanticRole) {
  return buildAssetRegistry(assets).entries.filter((asset) => classifyAsset(asset) === role);
}
