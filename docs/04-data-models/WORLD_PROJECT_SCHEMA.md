# World Project Schema

## WorldProject

```ts
type WorldProject = {
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
  metadata: ProjectMetadata;
};
```

## Vector3Data

```ts
type Vector3Data = {
  x: number;
  y: number;
  z: number;
};
```

## TerrainData

```ts
type TerrainData = {
  width: number;
  depth: number;
  resolution: number;
  heights: number[];
  materialMap: string[];
};
```

## TerrainMaterial

```ts
type TerrainMaterial = {
  id: string;
  name: string;
  color?: string;
  albedoTexture?: string;
  normalTexture?: string;
  roughness?: number;
  scale?: number;
};
```

## AssetDefinition

```ts
type AssetDefinition = {
  id: string;
  name: string;
  category: string;
  filePath: string;
  thumbnailPath?: string;
  defaultScale: number;
  defaultRotation?: Vector3Data;
  collisionType: "none" | "box" | "mesh" | "custom";
  canPaint: boolean;
  tags: string[];
};
```

## PlacedObject

```ts
type PlacedObject = {
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
```

## FoliageGroup

```ts
type FoliageGroup = {
  id: string;
  name: string;
  assetIds: string[];
  instances: FoliageInstance[];
  settings: FoliageBrushSettings;
};
```

## FoliageInstance

```ts
type FoliageInstance = {
  id: string;
  assetId: string;
  position: Vector3Data;
  rotation: Vector3Data;
  scale: Vector3Data;
};
```

## ScatterZone

```ts
type ScatterZone = {
  id: string;
  name: string;
  shape: "circle" | "rectangle" | "polygon";
  points: Vector3Data[];
  assetIds: string[];
  settings: ScatterSettings;
  generatedObjectIds: string[];
};
```

## RoadDefinition

```ts
type RoadDefinition = {
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
```

## GameplayMarker

```ts
type GameplayMarker = {
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
```

## EnvironmentSettings

```ts
type EnvironmentSettings = {
  skybox?: string;
  backgroundColor?: string;
  sunDirection: Vector3Data;
  sunIntensity: number;
  ambientIntensity: number;
  fogEnabled: boolean;
  fogColor?: string;
  fogDensity?: number;
  timeOfDay?: "morning" | "noon" | "evening" | "night";
  weather?: "clear" | "cloudy" | "dusty" | "rain" | "storm";
};
```

## LayerDefinition

```ts
type LayerDefinition = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};
```

