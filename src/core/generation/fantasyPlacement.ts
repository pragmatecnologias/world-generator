// IDs use crypto.randomUUID() for consistency with the codebase
import type { PlacedObject, WorldProject } from "../../types";
import type { WorldOperation } from "../../worldDocument";
import { STRUCTURE_PRESETS, type TownPiece } from "../../domains/fantasy/fantasyAssets";

// ── Seeded RNG (deterministic scatter) ────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Structure placement ───────────────────────────────────────────────────

export function buildStructureOperations(
  presetId: string,
  origin: { x: number; y: number; z: number },
  assetMap: Map<string, string>,
  rotationY: number = 0,
  scaleFactor: number = 1,
): WorldOperation[] {
  const preset = STRUCTURE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return [];

  const operations: WorldOperation[] = [];
  const baseScale = preset.defaultScale * scaleFactor;

  for (const piece of preset.pieces) {
    const assetId = assetMap.get(piece.model);
    if (!assetId) continue;

    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);
    const rawDx = piece.dx;
    const rawDz = piece.dz;
    const rotDx = rawDx * cosR - rawDz * sinR;
    const rotDz = rawDx * sinR + rawDz * cosR;

    const pieceScale = (piece.sc ?? 1) * baseScale;

    const obj: PlacedObject = {
      id: crypto.randomUUID(),
      assetId,
      name: `${preset.name} - ${piece.model}`,
      position: {
        x: origin.x + rotDx,
        y: origin.y + (piece.dy ?? 0),
        z: origin.z + rotDz,
      },
      rotation: { x: 0, y: (piece.ry ?? 0) + rotationY, z: 0 },
      scale: { x: pieceScale, y: pieceScale, z: pieceScale },
      layerId: "layer-props",
      visible: true,
      locked: false,
      collisionEnabled: true,
    };

    operations.push({
      type: "addObject",
      payload: obj,
    });
  }

  return operations;
}

// ── Cluster scatter (random placement within radius) ──────────────────────

export function buildClusterOperations(
  center: { x: number; z: number },
  radius: number,
  count: number,
  assetIds: string[],
  seed: number,
  terrain?: WorldProject["terrain"],
): WorldOperation[] {
  if (assetIds.length === 0) return [];
  const rng = seededRandom(seed);
  const operations: WorldOperation[] = [];

  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * radius;
    const x = center.x + Math.cos(angle) * dist;
    const z = center.z + Math.sin(angle) * dist;

    // Sample terrain height if available
    let y = 0;
    if (terrain) {
      const res = terrain.resolution;
      const gx = Math.round(((x + terrain.width / 2) / terrain.width) * (res - 1));
      const gz = Math.round(((z + terrain.depth / 2) / terrain.depth) * (res - 1));
      if (gx >= 0 && gx < res && gz >= 0 && gz < res) {
        y = terrain.heights[gz * res + gx] * 1.2;
      }
    }

    const assetId = assetIds[Math.floor(rng() * assetIds.length)];
    const scale = 0.7 + rng() * 0.8;

    const obj: PlacedObject = {
      id: crypto.randomUUID(),
      assetId,
      name: `Cluster item ${i + 1}`,
      position: { x, y, z },
      rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
      scale: { x: scale, y: scale, z: scale },
      layerId: "layer-foliage",
      visible: true,
      locked: false,
      collisionEnabled: false,
    };

    operations.push({ type: "addObject", payload: obj });
  }

  return operations;
}

// ── Chain placement (interpolate along polyline) ──────────────────────────

export function buildChainOperations(
  points: Array<{ x: number; z: number; y?: number }>,
  assetIds: string[],
  spacing: number,
  seed: number,
  terrain?: WorldProject["terrain"],
): WorldOperation[] {
  if (assetIds.length === 0 || points.length < 2) return [];
  const rng = seededRandom(seed);
  const operations: WorldOperation[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segLen = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.floor(segLen / spacing));

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a.x + dx * t;
      const z = a.z + dz * t;

      let y = a.y ?? 0;
      if (terrain) {
        const res = terrain.resolution;
        const gx = Math.round(((x + terrain.width / 2) / terrain.width) * (res - 1));
        const gz = Math.round(((z + terrain.depth / 2) / terrain.depth) * (res - 1));
        if (gx >= 0 && gx < res && gz >= 0 && gz < res) {
          y = terrain.heights[gz * res + gx] * 1.2;
        }
      }

      const assetId = assetIds[Math.floor(rng() * assetIds.length)];
      const rotY = Math.atan2(dx, dz) + (rng() - 0.5) * 0.3;
      const scale = 0.8 + rng() * 0.4;

      const obj: PlacedObject = {
        id: crypto.randomUUID(),
        assetId,
        name: `Chain item ${i}-${s}`,
        position: { x, y: y + 0.02, z },
        rotation: { x: 0, y: rotY, z: 0 },
        scale: { x: scale, y: scale, z: scale },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: false,
      };

      operations.push({ type: "addObject", payload: obj });
    }
  }

  return operations;
}

// ── Water surface marker ──────────────────────────────────────────────────

export function buildWaterSurfaceOperations(
  center: { x: number; z: number },
  radiusX: number,
  radiusZ: number,
): WorldOperation[] {
  const obj: PlacedObject = {
    id: crypto.randomUUID(),
    assetId: "__water-surface__",
    name: "Water Surface",
    position: { x: center.x, y: -0.05, z: center.z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: radiusX, y: 1, z: radiusZ },
    layerId: "layer-terrain",
    visible: true,
    locked: false,
    collisionEnabled: false,
    metadata: { kind: "water-surface", radiusX, radiusZ },
  };

  return [{ type: "addObject", payload: obj }];
}
