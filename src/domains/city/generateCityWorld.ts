import type { AssetDefinition, WorldProject } from "../../types";
import type { WorldGenerationConfig, WorldGenerationPathConfig, WorldGenerationPlacementRuleConfig, WorldGenerationZoneConfig } from "../../core/schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "../../core/schema/validators";
import { generateGenericWorld } from "../../core/generation/generateGenericWorld";

function buildCityPathConfigs(config: WorldGenerationConfig): WorldGenerationPathConfig[] {
  const terrain = config.terrain;
  const streetWidth = Math.max(4, terrain.width * 0.03);
  const half = terrain.width * 0.35;
  const rows = [
    [
      { x: -half, y: 0.1, z: -terrain.depth * 0.1 },
      { x: half, y: 0.1, z: -terrain.depth * 0.1 },
    ],
    [
      { x: -half, y: 0.1, z: terrain.depth * 0.1 },
      { x: half, y: 0.1, z: terrain.depth * 0.1 },
    ],
    [
      { x: -terrain.width * 0.1, y: 0.1, z: -half },
      { x: -terrain.width * 0.1, y: 0.1, z: half },
    ],
    [
      { x: terrain.width * 0.1, y: 0.1, z: -half },
      { x: terrain.width * 0.1, y: 0.1, z: half },
    ],
  ];

  return rows.map((points, index) => ({
    id: `city-path-${index + 1}`,
    type: "path",
    tags: ["street", "grid", index % 2 === 0 ? "arterial" : "local"],
    width: streetWidth,
    complexity: 4,
    smoothing: 0.5,
    points,
    materialId: index % 2 === 0 ? "track" : "dirt",
    flattenTerrain: true,
    smoothEdges: true,
  }));
}

function buildCityZones(config: WorldGenerationConfig): WorldGenerationZoneConfig[] {
  const halfWidth = config.terrain.width * 0.4;
  const halfDepth = config.terrain.depth * 0.25;
  return [
    {
      id: "city-residential",
      type: "rect",
      tags: ["residential", "street"],
      center: { x: -config.terrain.width * 0.18, z: -config.terrain.depth * 0.05 },
      width: halfWidth,
      depth: halfDepth,
      materialId: "dirt",
      assetTags: ["prop"],
    },
    {
      id: "city-commercial",
      type: "rect",
      tags: ["commercial", "street"],
      center: { x: config.terrain.width * 0.16, z: config.terrain.depth * 0.08 },
      width: halfWidth * 0.85,
      depth: halfDepth * 0.72,
      materialId: "track",
      assetTags: ["prop"],
    },
  ];
}

function buildCityPlacementRules(): WorldGenerationPlacementRuleConfig[] {
  return [
    {
      id: "city-props",
      assetTags: ["prop", "structure"],
      zoneTags: ["residential", "commercial"],
      avoidPathTags: ["street", "grid"],
      slopeMax: 18,
      density: 0.55,
      count: 16,
      minSpacing: 6,
      cluster: { enabled: true, clusterCount: 5, radius: 12 },
    },
    {
      id: "city-nature",
      assetTags: ["rock", "foliage", "tree"],
      zoneTags: ["residential"],
      avoidPathTags: ["street"],
      slopeMax: 25,
      density: 0.28,
      count: 10,
      minSpacing: 8,
    },
  ];
}

export function generateCityWorld(config: WorldGenerationConfig, assetSource?: AssetDefinition[]): WorldProject {
  const issues = validateWorldGenerationConfig(config);
  if (issues.length > 0) throw new Error(`Invalid world generation config: ${issues.join(" | ")}`);
  return generateGenericWorld(
    {
      ...config,
      generator: "generic",
      paths: buildCityPathConfigs(config),
      zones: buildCityZones(config),
      placementRules: buildCityPlacementRules(),
    },
    "city",
    assetSource,
  );
}
