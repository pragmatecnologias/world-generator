# Playwright Test and Evidence Plan

## Purpose

Use Playwright to verify that the editor actually works.

The testing goal is not only DOM checks. It must capture visual evidence that features exist and work.

## Required Evidence Screenshots

1. Empty editor loaded.
2. Terrain visible.
3. Terrain sculpted with visible height variation.
4. Terrain painted with multiple materials.
5. Custom asset imported in asset library.
6. Custom asset placed in world.
7. Transform gizmo visible on selected object.
8. Foliage painted in batch.
9. Scatter result visible.
10. Road/track drawn.
11. Checkpoints/start marker visible.
12. Validation panel showing results.
13. Save/load roundtrip result.
14. Export result visible or downloaded.

## Test Flow

### Test 1 — App Loads

- Open app.
- Assert canvas exists.
- Assert toolbar exists.
- Assert terrain or new project button exists.
- Screenshot.

### Test 2 — Terrain Sculpting

- Create new world.
- Select raise tool.
- Drag brush over terrain.
- Assert terrain vertex data changed through app state or debug endpoint.
- Screenshot visible terrain change.

### Test 3 — Terrain Painting

- Select paint tool.
- Paint grass.
- Paint dirt.
- Paint rock.
- Assert material map changed.
- Screenshot.

### Test 4 — Asset Import and Placement

- Import test GLB.
- Assert asset appears in library.
- Select asset.
- Click terrain.
- Assert object count increased.
- Screenshot.

### Test 5 — Transform

- Select placed object.
- Move/rotate/scale.
- Assert transform changed in state.
- Screenshot with gizmo.

### Test 6 — Foliage Paint

- Select foliage brush.
- Select tree/rock asset.
- Paint area.
- Assert instance count increased.
- Screenshot.

### Test 7 — Road Tool

- Select road tool.
- Click multiple points.
- Assert road object created.
- Screenshot.

### Test 8 — Save/Load

- Save project.
- Reload page.
- Load project.
- Assert terrain, objects, foliage, roads reappear.
- Screenshot.

### Test 9 — Export

- Click export.
- Read exported JSON/download.
- Assert required sections exist.

### Test 10 — Validation

- Run validation.
- Assert panel has statuses.
- Assert missing items are detected in incomplete project.
- Assert success/partial states change after adding features.

## Important Rule

If a feature cannot be proven by state assertion and screenshot, mark it as PARTIAL or FAKE.

