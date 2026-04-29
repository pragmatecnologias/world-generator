import type { GameplayMarker, RoadDefinition } from "../../types";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";

export function generateMarkers(config: WorldGenerationConfig, roads: RoadDefinition[]) {
  const markers: GameplayMarker[] = [];
  const road = roads[0];
  if (!road) return markers;
  const firstPoint = road.points[0];
  const lastPoint = road.points[road.points.length - 1] ?? road.points[0];
  if (config.gameplay.startFinish) {
    markers.push({
      id: "start-finish-generated",
      type: "start-finish",
      name: "Start / Finish",
      position: { ...firstPoint },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 8,
      metadata: { generated: true },
    });
  }

  const checkpointCount = Math.max(0, config.gameplay.checkpoints);
  for (let i = 0; i < checkpointCount; i += 1) {
    const pointIndex = Math.min(road.points.length - 1, Math.max(1, Math.floor(((i + 1) / (checkpointCount + 1)) * road.points.length)));
    const point = road.points[pointIndex] ?? road.points[road.points.length - 1] ?? firstPoint;
    markers.push({
      id: `checkpoint-generated-${i + 1}`,
      type: "checkpoint",
      name: `Checkpoint ${i + 1}`,
      position: { ...point },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 8,
      metadata: { order: i + 1 },
    });
  }

  if (roads[0]?.closedLoop === false && lastPoint !== firstPoint) {
    markers.push({
      id: "finish-generated",
      type: "objective",
      name: "Finish Zone",
      position: { ...lastPoint },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 8,
      metadata: { generated: true },
    });
  }

  return markers;
}

