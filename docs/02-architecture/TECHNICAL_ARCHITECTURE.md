# Technical Architecture

## Recommended Stack

Frontend:

- React or Vue.
- Three.js.
- TypeScript.
- Zustand, Pinia, Redux, or equivalent state management.
- IndexedDB for local persistence.
- Optional Electron/Tauri for file-system based projects.

Core Three.js modules:

- `Scene`
- `PerspectiveCamera`
- `WebGLRenderer`
- `OrbitControls`
- `TransformControls`
- `Raycaster`
- `GLTFLoader`
- `InstancedMesh`
- `BufferGeometry`
- `DataTexture`

## High-Level Modules

```text
src/
  app/
    App.tsx
    EditorShell.tsx
  editor/
    EditorStore.ts
    EditorCommands.ts
    SelectionService.ts
    UndoRedoService.ts
  three/
    ThreeViewport.tsx
    SceneManager.ts
    CameraController.ts
    RaycastService.ts
    TransformGizmoService.ts
  terrain/
    TerrainMesh.ts
    TerrainBrushService.ts
    TerrainMaterialService.ts
    HeightmapService.ts
  assets/
    AssetLibrary.ts
    AssetImportService.ts
    AssetPreviewService.ts
    AssetPlacementService.ts
  foliage/
    FoliagePaintService.ts
    ScatterService.ts
    FoliageRules.ts
  roads/
    RoadPathService.ts
    RoadMeshBuilder.ts
    TrackMarkerService.ts
  project/
    SaveLoadService.ts
    ExportService.ts
    ProjectSchema.ts
  validation/
    ValidationEngine.ts
    ValidationRules.ts
  ui/
    Toolbar.tsx
    LeftToolPanel.tsx
    InspectorPanel.tsx
    AssetBrowser.tsx
    ValidationPanel.tsx
```

## Architecture Principle

Three.js scene objects should not be the source of truth.

The source of truth should be a serializable project state model.

Three.js objects are runtime representations generated from project state.

Correct flow:

```text
User action -> Command -> Editor State -> Three.js Scene Update -> Save/Export
```

Wrong flow:

```text
User action -> mutate Three.js mesh only -> lose data on save/export
```

## Command System

Every meaningful edit should be a command so undo/redo works.

Examples:

- `SculptTerrainCommand`
- `PaintTerrainMaterialCommand`
- `PlaceObjectCommand`
- `MoveObjectCommand`
- `RotateObjectCommand`
- `ScaleObjectCommand`
- `DeleteObjectCommand`
- `PaintFoliageCommand`
- `ScatterObjectsCommand`
- `CreateRoadCommand`
- `UpdateRoadPointCommand`

## Runtime Services

### SceneManager

Responsible for:

- Creating scene.
- Managing lights.
- Managing helpers.
- Adding/removing runtime meshes.
- Rebuilding scene from project state.

### TerrainBrushService

Responsible for:

- Raycasting onto terrain.
- Finding affected vertices.
- Applying raise/lower/smooth/flatten.
- Updating heightmap.
- Recomputing normals.

### AssetPlacementService

Responsible for:

- Loading GLB/GLTF assets.
- Creating placed object instances.
- Snapping to terrain.
- Applying transform.
- Updating editor state.

### FoliagePaintService

Responsible for:

- Brush-based multi-object placement.
- Spacing rules.
- Random rotation/scale.
- Slope filtering.
- Road/water exclusion.

### ExportService

Responsible for:

- Serializing world state.
- Producing asset manifest.
- Producing terrain data.
- Producing material maps.
- Producing gameplay marker data.

## Performance Requirements

For many repeated objects such as grass, bushes, and rocks, use `InstancedMesh` where possible.

The editor should separate:

- Individually editable objects.
- Foliage batches.
- Instanced decorative objects.

Important:

- Manual objects need full transform control.
- Foliage can be instanced for performance.
- Export should still preserve each instance position/rotation/scale or batch rules.

