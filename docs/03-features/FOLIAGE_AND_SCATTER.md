# Foliage and Scatter Tools

## Purpose

The editor must help the user quickly decorate large environments.

Manual placement is necessary, but large worlds require batch tools.

## Foliage Paint Tool

The foliage paint tool places many assets using a brush.

Typical assets:

- Trees.
- Bushes.
- Grass.
- Rocks.
- Flowers.
- Logs.
- Debris.

## Brush Settings

```ts
type FoliageBrushSettings = {
  brushSize: number;
  density: number;
  minSpacing: number;
  randomRotation: boolean;
  minScale: number;
  maxScale: number;
  alignToTerrain: boolean;
  slopeLimitDegrees: number;
  avoidRoads: boolean;
  avoidWater: boolean;
  selectedAssetIds: string[];
};
```

## Placement Rules

When painting foliage:

1. Raycast brush center to terrain.
2. Generate random candidate points inside brush circle.
3. For each point:
   - Check terrain height.
   - Check slope.
   - Check spacing.
   - Check road exclusion.
   - Check water exclusion.
   - Pick random asset from selected set.
   - Apply random rotation.
   - Apply random scale.
   - Place instance.

## Erase Mode

Erase mode removes foliage instances inside brush radius.

Required:

- Erase all foliage.
- Erase only selected asset types.
- Erase by layer/group.

## Scatter Tool

Scatter places objects inside a defined region.

Region types:

- Circle.
- Rectangle.
- Polygon.
- Painted mask.

Settings:

```ts
type ScatterSettings = {
  areaId: string;
  assetIds: string[];
  count: number;
  minSpacing: number;
  minScale: number;
  maxScale: number;
  randomRotation: boolean;
  slopeLimitDegrees: number;
  avoidRoads: boolean;
  avoidWater: boolean;
  seed?: number;
};
```

## Realistic Placement Rules

To avoid fake-looking placement:

- Avoid perfect grids unless user enables grid placement.
- Randomize rotation.
- Randomize scale.
- Use clusters for natural foliage.
- Use lower density near roads.
- Avoid steep slopes for trees.
- Allow rocks on steeper slopes.
- Use biome-specific assets.

## Acceptance Checks

Foliage/scatter is REAL only if:

- Brush can place many objects.
- Density changes output.
- Random scale/rotation works.
- Erase mode works.
- Scatter can fill an area.
- Spacing rules prevent obvious overlap.
- Road avoidance works when enabled.
- Foliage/scatter data saves, reloads, and exports.

