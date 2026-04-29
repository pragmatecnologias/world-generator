# Editor State Model

## Principle

The editor state must be serializable.

Everything visible in the world should be recoverable from project JSON.

## Main State Areas

```ts
type EditorState = {
  project: WorldProject;
  ui: EditorUiState;
  selection: SelectionState;
  activeTool: EditorTool;
  brush: BrushState;
  transform: TransformState;
  history: HistoryState;
  runtime: RuntimeState;
};
```

## Tool State

```ts
type EditorTool =
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
```

## UI State

```ts
type EditorUiState = {
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
```

## Selection State

```ts
type SelectionState = {
  selectedObjectIds: string[];
  selectedTerrainCell?: { x: number; z: number };
  selectedRoadId?: string;
  selectedMarkerId?: string;
};
```

## Brush State

```ts
type BrushState = {
  size: number;
  strength: number;
  falloff: "linear" | "smooth" | "hard";
  shape: "circle" | "square";
  materialId?: string;
  flattenHeight?: number;
};
```

## History State

```ts
type HistoryState = {
  undoStack: EditorCommand[];
  redoStack: EditorCommand[];
};
```

## Runtime State

Runtime state should not be exported.

```ts
type RuntimeState = {
  isDragging: boolean;
  isPainting: boolean;
  hoveredObjectId?: string;
  loadedAssetCache: Record<string, unknown>;
};
```

## Rule

If data is needed after save/load, it belongs in `project`.

If data only controls the temporary UI, it belongs in `ui` or `runtime`.

