# Export Format

## Goal

Export should produce a complete game-readable world package.

The exported data must allow the game runtime to recreate the world without relying on editor-only state.

## Export Package Structure

```text
world-export/
  world.json
  asset-manifest.json
  terrain-heightmap.json
  terrain-material-map.json
  assets/
    tree_oak_01.glb
    rock_large_01.glb
  textures/
    grass.png
    dirt.png
  thumbnails/
```

## world.json

```json
{
  "id": "offroad_world_001",
  "name": "Offroad Canyon Track",
  "version": "1.0.0",
  "terrain": {
    "width": 1024,
    "depth": 1024,
    "resolution": 257,
    "heightmap": "terrain-heightmap.json",
    "materialMap": "terrain-material-map.json"
  },
  "materials": [],
  "assets": "asset-manifest.json",
  "objects": [],
  "foliageGroups": [],
  "roads": [],
  "markers": [],
  "environment": {}
}
```

## asset-manifest.json

```json
{
  "assets": [
    {
      "id": "tree_oak_01",
      "name": "Oak Tree",
      "category": "trees",
      "path": "assets/tree_oak_01.glb",
      "collisionType": "box",
      "defaultScale": 1
    }
  ]
}
```

## Object Placement Export

```json
{
  "id": "object_001",
  "assetId": "tree_oak_01",
  "position": { "x": 12, "y": 1.2, "z": 40 },
  "rotation": { "x": 0, "y": 130, "z": 0 },
  "scale": { "x": 1.1, "y": 1.1, "z": 1.1 },
  "collisionEnabled": true
}
```

## Road Export

```json
{
  "id": "track_main",
  "name": "Main Track",
  "points": [
    { "x": 0, "y": 0, "z": 0 },
    { "x": 50, "y": 1, "z": 20 }
  ],
  "width": 12,
  "materialId": "mud_track",
  "closedLoop": true,
  "checkpointIds": ["checkpoint_001"]
}
```

## Marker Export

```json
{
  "id": "checkpoint_001",
  "type": "checkpoint",
  "position": { "x": 20, "y": 0, "z": 30 },
  "radius": 8,
  "metadata": {
    "order": 1
  }
}
```

## Export Acceptance Criteria

Export is REAL only if:

- Export button creates files/data.
- Export contains terrain.
- Export contains material map.
- Export contains asset manifest.
- Export contains placed objects.
- Export contains foliage instances/groups.
- Export contains roads/tracks.
- Export contains markers.
- Export contains environment settings.
- Export can be loaded by a preview/runtime loader.

