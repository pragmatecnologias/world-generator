# Implementation Roadmap

## Phase 1 — Editor Foundation

Goal: make the app feel like a real editor.

Tasks:

1. Create Three.js viewport.
2. Add camera controls.
3. Add grid/helper tools.
4. Add editor shell layout.
5. Add project state model.
6. Add command pattern.
7. Add undo/redo foundation.
8. Add object selection.
9. Add transform controls.

Done when:

- User can select and transform a cube or placeholder object.
- State updates correctly.

## Phase 2 — Terrain

Tasks:

1. Create heightmap terrain mesh.
2. Add terrain raycasting.
3. Add brush preview.
4. Implement raise/lower.
5. Implement smooth/flatten.
6. Implement terrain material painting.
7. Save/load terrain.
8. Export terrain.

Done when:

- Terrain can be sculpted and painted.
- Changes survive reload.

## Phase 3 — Assets

Tasks:

1. Add GLB/GLTF import.
2. Add asset library UI.
3. Add categories/tags.
4. Add placement mode.
5. Add terrain snapping.
6. Add transform controls to placed objects.
7. Save/load/export assets and placements.

Done when:

- User can import a custom GLB and place it.

## Phase 4 — Productivity Tools

Tasks:

1. Add foliage brush.
2. Add density/spacing/random settings.
3. Add erase mode.
4. Add scatter area tool.
5. Add slope filtering.
6. Add road/water avoidance.
7. Optimize with instancing.

Done when:

- User can decorate an area quickly.

## Phase 5 — Road/Track Tool

Tasks:

1. Add road draw mode.
2. Add editable control points.
3. Generate road mesh.
4. Add width/material settings.
5. Add terrain flattening under road.
6. Add checkpoints.
7. Add start/finish marker.
8. Export road/track data.

Done when:

- User can draw a visible track and export it.

## Phase 6 — Validation and Export

Tasks:

1. Add validation engine.
2. Add validation panel.
3. Add REAL/PARTIAL/FAKE/MISSING statuses.
4. Add export package.
5. Add export verification.
6. Add preview loader.

Done when:

- App can prove whether a world is game-ready.

## Phase 7 — Polish

Tasks:

1. Better thumbnails.
2. Better material blending.
3. Better road smoothing.
4. Biome presets.
5. Environment presets.
6. Water tools.
7. Performance improvements.
8. Play/test mode.

