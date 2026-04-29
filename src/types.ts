export type Vector3Data = {
  x: number;
  y: number;
  z: number;
};

export type TerrainMaterial = {
  id: string;
  name: string;
  color: string;
  roughness?: number;
  scale?: number;
};

export type TerrainData = {
  width: number;
  depth: number;
  resolution: number;
  heights: number[];
  materialMap: string[];
};

export type AssetDefinition = {
  id: string;
  name: string;
  category: string;
  filePath: string;
  fileDataUrl?: string;
  thumbnailPath?: string;
  defaultScale: number;
  defaultRotation?: Vector3Data;
  collisionType: "none" | "box" | "mesh" | "custom";
  canPaint: boolean;
  tags: string[];
};

export type PlacedObject = {
  id: string;
  assetId: string;
  name: string;
  position: Vector3Data;
  rotation: Vector3Data;
  scale: Vector3Data;
  layerId: string;
  visible: boolean;
  locked: boolean;
  collisionEnabled: boolean;
  metadata?: Record<string, unknown>;
};

export type FoliageInstance = {
  id: string;
  assetId: string;
  position: Vector3Data;
  rotation: Vector3Data;
  scale: Vector3Data;
};

export type FoliageBrushSettings = {
  density: number;
  minSpacing: number;
  randomScaleMin: number;
  randomScaleMax: number;
  randomRotation: boolean;
  slopeLimit: number;
  avoidRoads: boolean;
  eraseMode: boolean;
};

export type FoliageGroup = {
  id: string;
  name: string;
  assetIds: string[];
  instances: FoliageInstance[];
  settings: FoliageBrushSettings;
};

export type ScatterSettings = {
  count: number;
  minSpacing: number;
  randomScaleMin: number;
  randomScaleMax: number;
  randomRotation: boolean;
  slopeLimit: number;
};

export type ScatterZone = {
  id: string;
  name: string;
  shape: "circle" | "rectangle" | "polygon";
  points: Vector3Data[];
  assetIds: string[];
  settings: ScatterSettings;
  generatedObjectIds: string[];
};

export type RoadDefinition = {
  id: string;
  name: string;
  points: Vector3Data[];
  width: number;
  materialId: string;
  flattenTerrain: boolean;
  smoothEdges: boolean;
  closedLoop: boolean;
  checkpointIds: string[];
};

export type GameplayMarker = {
  id: string;
  type:
    | "player-spawn"
    | "vehicle-spawn"
    | "enemy-spawn"
    | "checkpoint"
    | "start-finish"
    | "trigger"
    | "camera"
    | "objective"
    | "ai-path";
  name: string;
  position: Vector3Data;
  rotation?: Vector3Data;
  radius?: number;
  metadata?: Record<string, unknown>;
};

export type EnvironmentSettings = {
  backgroundColor: string;
  sunDirection: Vector3Data;
  sunIntensity: number;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor: string;
  fogDensity: number;
  timeOfDay: "morning" | "noon" | "evening" | "night";
  weather: "clear" | "cloudy" | "dusty" | "rain" | "storm";
};

export type LayerDefinition = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type WorldProject = {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  terrain: TerrainData;
  materials: TerrainMaterial[];
  assets: AssetDefinition[];
  objects: PlacedObject[];
  foliageGroups: FoliageGroup[];
  scatterZones: ScatterZone[];
  roads: RoadDefinition[];
  markers: GameplayMarker[];
  environment: EnvironmentSettings;
  layers: LayerDefinition[];
  metadata: {
    description: string;
  };
};

export type WorldExportPackage = {
  packageType: "world-export";
  schemaVersion: string;
  exportedAt: string;
  version: string;
  project: WorldProject;
  worldDocument?: Record<string, unknown>;
  assetManifest: Array<{
    id: string;
    name: string;
    category: string;
    filePath: string;
    defaultScale: number;
    collisionType: AssetDefinition["collisionType"];
    canPaint: boolean;
    tags: string[];
    hasSourceData: boolean;
  }>;
  summary: {
    terrainHeights: number;
    terrainMaterials: number;
    assets: number;
    objects: number;
    foliageInstances: number;
    scatterZones: number;
    roads: number;
    markers: number;
  };
  proof?: {
    generatedBy: "editor" | "proof-runner";
    runId: string;
    createdAt: string;
    notes?: string;
  };
};

export type EditorTool =
  | "select"
  | "terrain-raise"
  | "terrain-lower"
  | "terrain-smooth"
  | "terrain-flatten"
  | "terrain-paint"
  | "asset-place"
  | "foliage-paint"
  | "foliage-erase"
  | "scatter"
  | "road-draw"
  | "road-edit"
  | "marker-place";

export type BrushState = {
  size: number;
  strength: number;
  falloff: "linear" | "smooth" | "hard";
  shape: "circle" | "square";
  materialId: string;
  flattenHeight?: number;
};

export type SelectionState = {
  selectedObjectIds: string[];
  selectedTerrainCell?: { x: number; z: number };
  selectedRoadId?: string;
  selectedMarkerId?: string;
  selectedScatterZoneId?: string;
  selectedAssetId?: string;
};

export type EditorUiState = {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  selectedPanel: "assets" | "validation" | "console" | "layers";
  showGrid: boolean;
  showGizmos: boolean;
  showObjectNames: boolean;
  showCollision: boolean;
  viewportMode: "perspective" | "top" | "front" | "side";
};

export type ValidationStatus = "REAL" | "PARTIAL" | "FAKE" | "MISSING";

export type ValidationResult = {
  status: ValidationStatus;
  category: string;
  ruleId: string;
  message: string;
  severity: "info" | "warning" | "critical";
  evidence?: string[];
  chainChecks?: {
    visible: boolean;
    interactive: boolean;
    persistent: boolean;
    exported: boolean;
    previewRendered: boolean;
  };
  artifactRefs?: string[];
};

export type ProofStepStatus = "PASS" | "FAIL" | "PARTIAL";

export type ProofStepResult = {
  id: string;
  label: string;
  status: ProofStepStatus;
  subsystem: "terrain" | "assets" | "objects" | "foliage" | "scatter" | "roads" | "markers" | "save-load" | "export" | "preview" | "validation";
  reason: string;
  screenshotId: string;
  preHash: string;
  postHash: string;
};

export type ProofRunResult = {
  id: string;
  strictMode: boolean;
  startedAt: string;
  completedAt: string;
  passCount: number;
  failCount: number;
  partialCount: number;
  steps: ProofStepResult[];
};
