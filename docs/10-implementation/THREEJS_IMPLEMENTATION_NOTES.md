# Three.js Implementation Notes

## Terrain Mesh

Use `BufferGeometry` for terrain.

For MVP:

- Generate a grid of vertices.
- Store height in editor state.
- Update vertex Y values when sculpting.
- Recompute normals after editing.

Important:

```ts
geometry.attributes.position.needsUpdate = true;
geometry.computeVertexNormals();
```

## Raycasting Terrain

Use `Raycaster` from mouse coordinates.

Flow:

1. Convert pointer to normalized device coordinates.
2. Raycast against terrain mesh.
3. Get intersection point.
4. Use point to apply brush or place object.

## Transform Controls

Use `TransformControls` from Three.js examples.

Modes:

- translate.
- rotate.
- scale.

When dragging transform controls, disable orbit controls.

## GLB/GLTF Import

Use `GLTFLoader`.

Store imported file references in asset definition.

For browser-only MVP, use object URLs or IndexedDB.

For Electron/Tauri, copy assets into project folder.

## Object Placement

When placing object:

1. Raycast terrain.
2. Clone loaded GLTF scene.
3. Set position to hit point.
4. Apply default scale.
5. Add to Three.js scene.
6. Add serializable object data to project state.

## Foliage Performance

Use `InstancedMesh` for large numbers of repeated assets.

For MVP, separate objects are acceptable for small counts, but the architecture should allow instancing.

Recommended split:

- Manual objects: regular Object3D/group.
- Foliage: InstancedMesh where possible.

## Material Painting MVP

Fastest implementation:

- Use vertex colors or material ID grid.
- Show different colors for different terrain materials.

Better implementation:

- Use splat map texture.
- Custom shader blends materials.

## Road Mesh

Generate a strip along path points.

For each segment:

- Compute direction.
- Compute perpendicular vector.
- Create left/right vertices.
- Generate triangles.

Project road vertices onto terrain height.

## Save/Load

Do not serialize Three.js objects directly.

Serialize only project state.

On load:

1. Clear scene.
2. Rebuild terrain from state.
3. Reload assets.
4. Recreate placed objects.
5. Recreate foliage.
6. Recreate roads.
7. Recreate markers.

## Common Mistakes

Avoid these:

- Terrain edits only change mesh but not state.
- Asset placement only creates Three.js object but not project object.
- Foliage is visible but not saved.
- Export excludes road/foliage/markers.
- Validation always returns success.
- UI buttons exist but tools do nothing.
- No screenshot evidence.

