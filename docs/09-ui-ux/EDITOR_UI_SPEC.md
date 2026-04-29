# Editor UI Specification

## Layout

```text
+--------------------------------------------------------------------------------+
| Top Toolbar: New | Open | Save | Undo | Redo | Play/Test | Export | Validate   |
+----------------------+---------------------------------------------------------+
| Left Tool Panel      | Main Three.js Viewport                                  |
| - Select             |                                                         |
| - Terrain            |                                                         |
| - Paint              |                                                         |
| - Assets             |                                                         |
| - Foliage            |                                                         |
| - Scatter            |                                                         |
| - Road/Track         |                                                         |
| - Markers            |                                                         |
| - Environment        |                                                         |
+----------------------+---------------------------------------------------------+
| Bottom Panel: Asset Browser | Layers | Validation | Console                  |
+----------------------+---------------------------------------------------------+
| Right Inspector: Selected object / brush / road / material settings            |
+--------------------------------------------------------------------------------+
```

## Top Toolbar

Required buttons:

- New.
- Open.
- Save.
- Save As.
- Undo.
- Redo.
- Select.
- Terrain.
- Paint.
- Assets.
- Foliage.
- Scatter.
- Road.
- Markers.
- Play/Test.
- Validate.
- Export.

## Left Panel

The left panel changes tools.

### Terrain Section

- Raise.
- Lower.
- Smooth.
- Flatten.
- Noise.
- Brush size.
- Brush strength.
- Falloff.

### Paint Section

- Material list.
- Brush size.
- Brush strength.

### Asset Section

- Import asset.
- Select asset.
- Placement mode.

### Foliage Section

- Select foliage assets.
- Density.
- Min spacing.
- Random scale.
- Random rotation.
- Slope limit.
- Avoid roads.
- Paint/erase toggle.

### Road Section

- Draw road.
- Edit road.
- Road width.
- Road material.
- Flatten terrain.
- Add checkpoint.
- Add start/finish.

## Right Inspector

When an object is selected, show:

- Name.
- Asset ID.
- Position.
- Rotation.
- Scale.
- Layer.
- Visible.
- Locked.
- Collision enabled.
- Metadata.

When terrain tool is selected, show:

- Brush settings.
- Active mode.
- Active material.

When road is selected, show:

- Road name.
- Width.
- Material.
- Closed loop.
- Flatten terrain.
- Checkpoints.

## Bottom Panel

Tabs:

- Asset Browser.
- Scene Hierarchy.
- Layers.
- Validation.
- Console.

## Usability Rules

- User should always know which tool is active.
- Brush cursor should be visible.
- Selection highlight should be visible.
- Transform gizmo should be obvious.
- Destructive actions should support undo.
- Save/load/export should provide clear feedback.
- Validation errors should be actionable.

