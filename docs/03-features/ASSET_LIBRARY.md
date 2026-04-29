# Asset Library

## Purpose

The asset library lets the user import and manage custom assets that can be placed in the world.

This is a non-negotiable requirement.

Without custom asset import and placement, the editor is not useful.

## Supported Formats

MVP:

- GLB.
- GLTF.
- PNG/JPG/WebP for billboards or thumbnails.

Later:

- FBX.
- OBJ.
- ZIP asset packs.

## Asset Definition

```ts
type AssetDefinition = {
  id: string;
  name: string;
  category: AssetCategory;
  filePath: string;
  thumbnailPath?: string;
  defaultScale: number;
  defaultRotation?: Vector3Data;
  collisionType: "none" | "box" | "mesh" | "custom";
  canPaint: boolean;
  tags: string[];
};
```

## Categories

- Trees.
- Bushes.
- Grass.
- Rocks.
- Buildings.
- Props.
- Roads.
- Track pieces.
- Barriers.
- Fences.
- Water.
- Lighting.
- Ancient world.
- Medieval.
- Racing.
- Custom.

## Import Flow

1. User clicks Import Asset.
2. User selects file.
3. App loads asset with `GLTFLoader`.
4. App shows preview.
5. User sets name/category/default scale/collision/can-paint.
6. App stores asset definition.
7. Asset appears in library.
8. User can place it in world.

## Placement Flow

1. User selects asset.
2. User activates placement mode.
3. User clicks terrain.
4. App raycasts to terrain.
5. App creates placed object.
6. Object snaps to terrain height.
7. Object appears in scene and hierarchy.
8. Transform gizmo can edit object.

## Acceptance Checks

Asset library is REAL only if:

- User can import GLB/GLTF.
- Imported asset appears in library.
- User can place imported asset.
- Placed asset is visible.
- Transform works.
- Asset and placements persist after save/load.
- Export references the asset and placement data.

