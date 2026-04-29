import type { EnvironmentSettings, PlacedObject, RoadDefinition, TerrainData, WorldProject } from "../../types";

export type WorldPatch =
  | { op: "setTerrainConfig"; value: Partial<TerrainData> }
  | { op: "addPath"; value: RoadDefinition }
  | { op: "addRoad"; value: RoadDefinition }
  | { op: "updatePath"; targetId: string; value: Partial<RoadDefinition> }
  | { op: "removePath"; targetId: string }
  | { op: "addPlacementZone"; value: { id: string; materialId: string; density: number; assetTags: string[] } }
  | { op: "addBiome"; value: { id: string; materialId: string; density: number; assetTags: string[] } }
  | { op: "addZone"; value: { id: string; materialId: string; density: number; assetTags: string[] } }
  | { op: "placeAsset"; assetId: string; position: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number }; scale?: { x: number; y: number; z: number }; layerId?: string }
  | { op: "scatterAssets"; tag: string; zoneId: string; count: number }
  | { op: "setEnvironment"; value: Partial<EnvironmentSettings> }
  | { op: "updateProjectMetadata"; value: Partial<WorldProject["metadata"]> }
  | { op: "updateObject"; targetId: string; value: Partial<PlacedObject> }
  | { op: "removeObject"; targetId: string };
