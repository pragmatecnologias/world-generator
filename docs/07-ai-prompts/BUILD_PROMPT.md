# AI Build Prompt

Use this prompt with an AI coding agent.

```text
You are building a generic Three.js-based Game World Creator app.

This is not a toy Three.js demo. This is a practical world editor for creating game environments.

The app must support terrain editing, terrain material painting, custom asset import, manual asset placement, transform controls, foliage painting, scatter placement, road/track creation, save/load, export, and validation.

Use TypeScript and organize the app into clear modules:

- viewport
- terrain
- assets
- placement
- foliage
- scatter
- roads
- markers
- layers
- inspector
- save/load
- export
- validation

Core requirements:

1. Three.js viewport
- Scene, camera, renderer.
- Orbit controls.
- Grid helper toggle.
- Terrain visible.
- Raycasting onto terrain.
- Object selection.
- Transform controls for move/rotate/scale.

2. Terrain editor
- Heightmap-based terrain mesh.
- Raise/lower/smooth/flatten tools.
- Brush size/strength/falloff.
- Visible brush cursor.
- Undo/redo support.
- Terrain edits must update serializable terrain state.

3. Terrain material painting
- Brush-based material painting.
- At least grass, dirt, mud, rock, sand, and track material.
- Painted materials must be visible.
- Painted material map must save/load/export.

4. Asset library
- Import GLB/GLTF using GLTFLoader.
- Store asset definitions.
- Display imported assets in library.
- Category/name/default scale/collision/canPaint fields.
- Imported assets must be placeable.

5. Manual asset placement
- Select asset.
- Click terrain to place.
- Place at raycast terrain point.
- Move/rotate/scale with TransformControls.
- Duplicate/delete object.
- Snap to terrain.
- Save/load/export object transforms.

6. Foliage paint
- Select one or more paintable assets.
- Brush places multiple instances.
- Density.
- Min spacing.
- Random scale.
- Random rotation.
- Slope limit.
- Avoid roads.
- Erase mode.
- Save/load/export foliage data.

7. Scatter tool
- Define area.
- Select assets.
- Count/spacing/scale/rotation controls.
- Generate preview.
- Apply scatter.
- Save/load/export.

8. Road/track tool
- Draw road points.
- Generate visible road mesh/strip.
- Edit points.
- Set width and material.
- Save/load/export road data.
- Add start/finish and checkpoints.

9. Layers and inspector
- Scene hierarchy.
- Layers for terrain/assets/foliage/roads/markers.
- Hide/show/lock layers.
- Inspector shows selected object properties and allows editing.

10. Project persistence
- Save project JSON.
- Load project JSON.
- Autosave.
- All project data must roundtrip.

11. Export
- Export world JSON.
- Export asset manifest.
- Export terrain height data.
- Export material map.
- Export objects, foliage, roads, markers, and environment.

12. Validation
- Validation panel checks all major features.
- Use REAL/PARTIAL/FAKE/MISSING status.
- Must detect incomplete projects.
- Must not always say success.

Do not ask whether to implement the above. Implement the MVP versions now.

Completion rule:
A feature is not complete unless it is visible, interactive, persisted, reloadable, exportable, and testable.

Deliver:
- Working implementation.
- Clear file structure.
- Demo data.
- Playwright tests.
- Screenshot evidence.
```

