# Complete Feature Specification

## Feature Groups

1. Viewport and navigation.
2. Terrain editing.
3. Terrain material painting.
4. Custom asset library.
5. Manual placement.
6. Foliage painting.
7. Scatter tools.
8. Road/track tools.
9. Environment tools.
10. Gameplay markers.
11. Layers and hierarchy.
12. Inspector panel.
13. Save/load/export.
14. Validation.
15. Play/test mode.

## 1. Viewport

Required:

- Perspective camera.
- Orbit camera.
- Pan/zoom.
- Top/front/side views.
- Grid toggle.
- Object hover highlight.
- Object select.
- Terrain raycast.
- Transform gizmos.

Acceptance:

- User can navigate around a large terrain.
- User can click terrain.
- User can click objects.
- User can place objects where clicked.

## 2. Terrain Editing

Required:

- Raise.
- Lower.
- Smooth.
- Flatten.
- Noise.
- Brush preview.
- Adjustable brush size/strength/falloff.
- Undo/redo.

Acceptance:

- Terrain visibly changes.
- Changes persist after save/load.
- Export includes changed height data.

## 3. Terrain Painting

Required:

- Paint materials with brush.
- Display different terrain materials.
- Save material map.
- Export material map.

Acceptance:

- User can paint grass, dirt, mud, rock, sand, and track material.
- Painted areas remain after reload.

## 4. Custom Asset Library

Required:

- Import GLB/GLTF.
- Asset list.
- Asset categories.
- Default scale.
- Default collision type.
- Can-paint flag.

Acceptance:

- Imported asset can be placed in the world.
- Imported asset persists in project definition.

## 5. Manual Placement

Required:

- Place asset on terrain.
- Move/rotate/scale.
- Duplicate/delete.
- Snap to terrain.
- Align to terrain normal.

Acceptance:

- User can place custom assets precisely.
- Transforms persist and export correctly.

## 6. Foliage Paint

Required:

- Brush-based placement.
- Density.
- Min spacing.
- Random rotation.
- Random scale.
- Slope limit.
- Road avoidance.
- Erase mode.

Acceptance:

- User can paint trees/rocks/bushes quickly.
- Foliage does not block roads when avoid-roads is enabled.

## 7. Scatter Tool

Required:

- Define area.
- Select assets.
- Set count.
- Set spacing.
- Generate preview.
- Regenerate.
- Apply.

Acceptance:

- User can fill an area with realistic object distribution.

## 8. Road/Track Tool

Required:

- Draw path points.
- Edit points.
- Width.
- Material.
- Flatten terrain under road.
- Smooth road edges.
- Add checkpoints.
- Start/finish marker.

Acceptance:

- Road/track is visible, continuous, saved, loaded, and exported.

## 9. Environment

Required:

- Sky/background.
- Sun direction.
- Ambient light.
- Fog.
- Time of day.

Acceptance:

- Scene has configurable atmosphere.

## 10. Gameplay Markers

Required:

- Player spawn.
- Vehicle spawn.
- Checkpoint.
- Start/finish.
- Trigger zone.
- Enemy spawn.
- AI path.

Acceptance:

- Markers are visible in editor and exported.

## 11. Layers

Required:

- Create layer.
- Assign objects to layers.
- Hide/show layers.
- Lock/unlock layers.
- Filter objects.

Acceptance:

- User can manage large worlds without chaos.

## 12. Inspector

Required:

- Show selected object properties.
- Edit name, transform, layer, visibility, lock, collision.

Acceptance:

- Inspector edits update the scene immediately and persist.

