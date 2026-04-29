# MVP Requirements

## MVP Goal

The MVP must prove the app is a real editor, not a visual demo.

The MVP is complete only when the user can create a world, sculpt terrain, paint terrain materials, import a custom asset, place it, batch-place foliage, save, reload, export, and validate.

## MVP Features

### 1. 3D Viewport

Required:

- Three.js scene.
- Orbit/pan/zoom camera.
- Grid helper toggle.
- Lighting.
- Terrain mesh visible.
- Object selection.
- Transform controls.

### 2. Terrain Editing

Required:

- Raise terrain.
- Lower terrain.
- Smooth terrain.
- Flatten terrain.
- Brush size.
- Brush strength.
- Brush falloff.
- Undo/redo.

### 3. Terrain Painting

Required materials:

- Grass.
- Dirt.
- Mud.
- Rock.
- Sand.
- Track/asphalt.

Minimum acceptable implementation:

- Material regions are visibly different.
- Painted areas persist after save/load.
- Export contains terrain material information.

### 4. Asset Library

Required:

- Import GLB/GLTF.
- Save asset definition.
- Show asset list.
- Categorize asset.
- Preview or thumbnail placeholder.
- Use imported asset for placement.

### 5. Manual Placement

Required:

- Select asset.
- Click terrain to place.
- Move object.
- Rotate object.
- Scale object.
- Delete object.
- Duplicate object.
- Snap to terrain.

### 6. Foliage Paint

Required:

- Select foliage asset.
- Paint many objects with a brush.
- Density setting.
- Random rotation.
- Random scale.
- Minimum spacing.
- Erase foliage mode.

### 7. Scatter Tool

Required:

- Select an area.
- Choose one or more assets.
- Generate random placement.
- Control count/spacing/scale/rotation.
- Apply placement.

### 8. Road/Track Tool

MVP version:

- Draw path points.
- Display road/track mesh or strip.
- Adjust width.
- Paint/assign road material.
- Save/load/export road data.

### 9. Save/Load

Required:

- Save project JSON.
- Load project JSON.
- All terrain, materials, assets, objects, foliage, roads, markers, and environment settings persist.

### 10. Export

Required:

- Export world JSON.
- Export asset manifest.
- Export terrain height data.
- Export object placement data.
- Export road/track data.
- Export gameplay markers.

### 11. Validation

Required:

- Show validation panel.
- Check missing features/data.
- Mark each check as REAL, PARTIAL, FAKE, or MISSING.
- Show actionable issues.

## MVP Done Criteria

The MVP is done only if all of this works visibly:

1. Create terrain.
2. Sculpt terrain.
3. Paint at least three terrain materials.
4. Import GLB/GLTF.
5. Place imported asset.
6. Transform imported asset.
7. Batch paint foliage.
8. Scatter rocks or trees.
9. Draw a road or track.
10. Save the project.
11. Reload the project.
12. Export the world.
13. Validate the world.
14. Produce screenshot evidence.

