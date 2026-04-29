import type { RoadDefinition, TerrainData } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePoint(x: number, y: number, z: number) {
  return { x, y, z };
}

export function generateRoads(config: WorldGenerationConfig, terrain: TerrainData): RoadDefinition[] {
  const rng = mulberry32(config.seed);
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  return config.roads.map((roadConfig, index) => {
    const points = [];
    const pointCount = Math.max(3, roadConfig.complexity);
    const radiusX = terrain.width * (roadConfig.type === "loop" ? 0.22 : 0.34);
    const radiusZ = terrain.depth * (roadConfig.type === "loop" ? 0.18 : 0.24);
    const centerX = roadConfig.type === "loop" ? 0 : -halfW * 0.28;
    const centerZ = roadConfig.type === "loop" ? 0 : 0;

    for (let i = 0; i < pointCount; i += 1) {
      const t = pointCount === 1 ? 0 : i / (pointCount - 1);
      const angle = roadConfig.type === "loop"
        ? t * Math.PI * 2
        : -Math.PI * 0.7 + t * Math.PI * 1.35;
      const wobble = 0.75 + rng() * 0.25;
      const x = centerX + Math.cos(angle) * radiusX * wobble;
      const z = centerZ + Math.sin(angle) * radiusZ * wobble;
      const y = (Math.sin(angle * 2 + config.seed * 0.01) * 0.15) + (roadConfig.type === "loop" ? 0.1 : 0.2);
      points.push(makePoint(x, y, z));
    }

    const checkpointCount = Math.max(roadConfig.checkpoints, config.gameplay.checkpoints, 0);
    const checkpointIds = Array.from({ length: checkpointCount }, (_, checkpointIndex) => `cp-${index + 1}-${checkpointIndex + 1}`);

    return {
      id: `road-${index + 1}`,
      name: `${roadConfig.type === "loop" ? "Loop" : "Trail"} ${index + 1}`,
      points,
      width: roadConfig.width,
      materialId: roadConfig.materialId,
      flattenTerrain: true,
      smoothEdges: true,
      closedLoop: roadConfig.type === "loop",
      checkpointIds,
    };
  });
}

