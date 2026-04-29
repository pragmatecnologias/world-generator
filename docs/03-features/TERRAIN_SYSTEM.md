# Terrain System

## Terrain Representation

Use a grid-based heightmap terrain.

Recommended:

```ts
type TerrainData = {
  width: number;
  depth: number;
  resolution: number;
  heights: number[];
  materialWeights: TerrainMaterialWeights;
};
```

`heights` can be a flat array:

```text
index = z * resolution + x
```

## Terrain Mesh

Generate a `BufferGeometry` from the heightmap.

Each vertex position:

```text
x = gridX mapped to world width
z = gridZ mapped to world depth
y = heightmap[index]
```

After edits:

- Update vertex positions.
- Recompute normals.
- Mark position attribute as needing update.
- Update collision/raycast data if needed.

## Sculpting Tools

### Raise

Adds height inside brush radius.

### Lower

Subtracts height inside brush radius.

### Smooth

Averages height with neighboring vertices.

### Flatten

Moves affected vertices toward a target height.

### Noise

Adds random or procedural height variation.

## Brush Falloff

Supported falloffs:

- Hard.
- Linear.
- Smooth.

Smooth falloff example:

```ts
function smoothFalloff(distance: number, radius: number): number {
  const t = Math.max(0, Math.min(1, 1 - distance / radius));
  return t * t * (3 - 2 * t);
}
```

## Terrain Painting

Basic MVP options:

1. Vertex color painting.
2. Texture splat map.
3. Material ID grid.

For MVP, a material ID grid is acceptable if it visibly shows painted areas.

Better version:

- Use splat map texture.
- Each terrain material has a weight.
- Shader blends textures.

## Acceptance Checks

Terrain system is REAL only if:

- Terrain mesh is visible.
- Terrain height changes are visible.
- Raise/lower/smooth/flatten work.
- Terrain materials can be painted.
- Terrain data saves and reloads.
- Terrain data exports.

