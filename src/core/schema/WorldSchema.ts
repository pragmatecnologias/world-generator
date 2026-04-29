export type {
  AssetDefinition,
  BrushState,
  EditorTool,
  EnvironmentSettings,
  FoliageBrushSettings,
  FoliageGroup,
  FoliageInstance,
  GameplayMarker,
  LayerDefinition,
  PlacedObject,
  RoadDefinition,
  ScatterSettings,
  ScatterZone,
  TerrainData,
  TerrainMaterial,
  Vector3Data,
  WorldExportPackage,
  WorldProject,
  ValidationResult,
} from "../../types";

export type {
  PlacementGroupDefinition,
  WorldDocument,
  WorldOperation,
} from "../../worldDocument";
export {
  WORLD_DOCUMENT_SCHEMA_VERSION,
  applyWorldOperations,
  createWorldOperation,
  normalizeWorldDocument,
  worldDocumentToPlacementGroups,
  worldDocumentToPaths,
  worldDocumentToProject,
  worldDocumentToZones,
  worldProjectToDocument,
  worldProjectToPaths,
  worldProjectToZones,
} from "../../worldDocument";
export type { TerrainNoiseConfig, WorldGenerationBiomeConfig, WorldGenerationConfig, WorldGenerationRoadConfig } from "./WorldConfigSchema";
export type { PathDefinition, PlacementRule, ZoneDefinition, CoreWorldGeneratorConfig } from "./CoreWorldSchema";
export { roadsToPaths, pathsToRoads, scatterZonesToZones, foliageGroupsToPlacementGroups } from "./compat";
