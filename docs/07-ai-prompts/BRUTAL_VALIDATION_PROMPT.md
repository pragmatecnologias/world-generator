# Brutal Validation Prompt

Use this prompt after the AI/dev agent claims the app is done.

```text
Run BRUTAL REALITY CHECK MODE on the Three.js Game World Creator app.

Do not summarize. Test the app.

Evaluate whether it is a real world editor or just a fake demo.

The app goal:
It must allow me to create game worlds by editing terrain, painting materials, importing custom assets, manually placing assets, batch-painting foliage/trees/rocks, scattering objects realistically, creating roads/tracks, organizing layers, saving/loading, exporting world data, and validating whether the world is game-ready.

For every feature, classify it as:

- REAL: visible, interactive, working, saved/reloaded/exported.
- PARTIAL: visible or partly working but incomplete.
- FAKE: UI exists but does not actually work.
- MISSING: not implemented.

Test all of this:

1. App loads.
2. 3D viewport works.
3. Terrain exists.
4. Terrain can be raised.
5. Terrain can be lowered.
6. Terrain can be smoothed.
7. Terrain can be flattened.
8. Brush size and strength affect terrain editing.
9. Terrain material painting works.
10. At least three terrain materials are visible.
11. Custom GLB/GLTF import works.
12. Imported asset appears in asset library.
13. Imported asset can be placed in the world.
14. Placed object can be moved.
15. Placed object can be rotated.
16. Placed object can be scaled.
17. Placed object can be deleted.
18. Placed object can be duplicated.
19. Foliage brush places multiple objects.
20. Foliage density setting works.
21. Random scale works.
22. Random rotation works.
23. Foliage erase works.
24. Scatter tool creates area-based placement.
25. Road/track tool creates visible roads/tracks.
26. Road points can be edited.
27. Road width changes the mesh.
28. Road/track material is visible.
29. Checkpoints can be added.
30. Start/finish can be added.
31. Layers exist.
32. Hide/show layer works.
33. Lock layer works.
34. Inspector shows selected object properties.
35. Inspector edits update the selected object.
36. Save project works.
37. Reload project restores terrain, assets, objects, foliage, roads, markers.
38. Export world JSON works.
39. Export includes terrain, materials, assets, objects, foliage, roads, markers, environment.
40. Validation panel detects missing/incomplete features.
41. Screenshots prove each major feature.

Output format:

# Final Verdict
REAL / PARTIAL / FAKE / MISSING

# Feature Audit Table
Feature | Status | Evidence | Problem

# Critical Failures
List critical failures only.

# Fake UI
List UI that exists but does not work.

# Persistence/Export Issues
List save/load/export problems.

# Usability Issues
List editor workflow problems.

# Priority Fix Plan
Give exact implementation tasks in order.

Important rule:
If it is not visible in the app, not interactive, not persisted, and not exportable, it is not REAL.
```

