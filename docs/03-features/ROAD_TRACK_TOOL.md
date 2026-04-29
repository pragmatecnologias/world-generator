# Road and Track Tool

## Purpose

The road/track tool is essential for racing/off-road games.

The user must be able to draw and edit playable roads or tracks directly on the terrain.

## Core Concepts

A road or track is represented by a path with control points.

```ts
type RoadDefinition = {
  id: string;
  name: string;
  points: Vector3Data[];
  width: number;
  materialId: string;
  flattenTerrain: boolean;
  smoothEdges: boolean;
  closedLoop: boolean;
  checkpoints: CheckpointMarker[];
};
```

## MVP Features

Required:

- Draw road points.
- Show connected road strip.
- Edit path points.
- Set width.
- Assign material.
- Save/load road data.
- Export road data.

## Better Features

- Flatten terrain under road.
- Smooth road edges.
- Clear foliage from road area.
- Add barriers along road.
- Add signs/arrows along road.
- Add start/finish line.
- Add checkpoints.
- Add jumps.
- Add banking.

## Road Mesh Generation

For each path segment:

1. Calculate direction.
2. Calculate perpendicular vector.
3. Generate left and right edge points.
4. Build triangle strip.
5. Project onto terrain height.
6. Apply material.

## Terrain Interaction

When road flattening is enabled:

- Find terrain vertices inside road width.
- Move heights toward road centerline height.
- Smooth edges using falloff.
- Recompute normals.

## Foliage Exclusion

Roads should define an exclusion zone.

Foliage tools should use this zone to avoid placing trees/rocks on the road.

## Checkpoints

Roads can contain checkpoints.

```ts
type CheckpointMarker = {
  id: string;
  roadId: string;
  order: number;
  position: Vector3Data;
  radius: number;
};
```

## Acceptance Checks

Road/track tool is REAL only if:

- User can draw a road.
- Road is visible.
- User can edit points.
- Width is adjustable.
- Road persists after save/load.
- Road exports.
- Road can be validated for continuity.
- Checkpoints can be added and exported.

