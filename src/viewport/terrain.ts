import * as THREE from "three";
import type { TerrainData } from "../types";

const MATERIAL_COLORS: Record<string, string> = {
  grass: "#6ea95e",
  dirt: "#8d6b44",
  mud: "#53402f",
  rock: "#7d8791",
  sand: "#d8c27f",
  track: "#4b4b4f",
};

export function terrainIndex(x: number, z: number, resolution: number) {
  return z * resolution + x;
}

export function terrainWorldToGrid(
  point: THREE.Vector3,
  terrain: TerrainData,
) {
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  const gridX = Math.max(0, Math.min(terrain.resolution - 1, Math.round(((point.x + halfW) / terrain.width) * (terrain.resolution - 1))));
  const gridZ = Math.max(0, Math.min(terrain.resolution - 1, Math.round(((point.z + halfD) / terrain.depth) * (terrain.resolution - 1))));
  return { gridX, gridZ, index: terrainIndex(gridX, gridZ, terrain.resolution) };
}

export function sampleTerrainHeight(point: THREE.Vector3, terrain: TerrainData) {
  const { gridX, gridZ, index } = terrainWorldToGrid(point, terrain);
  return { gridX, gridZ, index, height: terrain.heights[index] ?? 0 };
}

export function terrainCellToWorld(
  x: number,
  z: number,
  terrain: TerrainData,
  heightOffset = 0,
) {
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  const worldX = (x / (terrain.resolution - 1)) * terrain.width - halfW;
  const worldZ = (z / (terrain.resolution - 1)) * terrain.depth - halfD;
  const index = terrainIndex(x, z, terrain.resolution);
  return new THREE.Vector3(worldX, (terrain.heights[index] ?? 0) + heightOffset, worldZ);
}

export function worldToTerrainHeight(point: THREE.Vector3, terrain: TerrainData) {
  return sampleTerrainHeight(point, terrain).height;
}

export function createTerrainGeometry(terrain: TerrainData) {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;

  for (let z = 0; z < terrain.resolution; z += 1) {
    for (let x = 0; x < terrain.resolution; x += 1) {
      const index = terrainIndex(x, z, terrain.resolution);
      const worldX = (x / (terrain.resolution - 1)) * terrain.width - halfW;
      const worldZ = (z / (terrain.resolution - 1)) * terrain.depth - halfD;
      positions.push(worldX, terrain.heights[index] ?? 0, worldZ);
      const color = new THREE.Color(MATERIAL_COLORS[terrain.materialMap[index] ?? "grass"] ?? "#ffffff");
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let z = 0; z < terrain.resolution - 1; z += 1) {
    for (let x = 0; x < terrain.resolution - 1; x += 1) {
      const a = terrainIndex(x, z, terrain.resolution);
      const b = terrainIndex(x + 1, z, terrain.resolution);
      const c = terrainIndex(x, z + 1, terrain.resolution);
      const d = terrainIndex(x + 1, z + 1, terrain.resolution);
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function updateTerrainGeometry(geometry: THREE.BufferGeometry, terrain: TerrainData) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const color = geometry.getAttribute("color") as THREE.BufferAttribute;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;

  for (let z = 0; z < terrain.resolution; z += 1) {
    for (let x = 0; x < terrain.resolution; x += 1) {
      const index = terrainIndex(x, z, terrain.resolution);
      const vertexIndex = index * 3;
      const worldX = (x / (terrain.resolution - 1)) * terrain.width - halfW;
      const worldZ = (z / (terrain.resolution - 1)) * terrain.depth - halfD;
      position.setXYZ(index, worldX, terrain.heights[index] ?? 0, worldZ);
      const colorValue = MATERIAL_COLORS[terrain.materialMap[index] ?? "grass"] ?? "#ffffff";
      const c = new THREE.Color(colorValue);
      color.setXYZ(index, c.r, c.g, c.b);
      void vertexIndex;
    }
  }

  position.needsUpdate = true;
  color.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function terrainMaterialColor(materialId: string) {
  return MATERIAL_COLORS[materialId] ?? "#ffffff";
}

export function applyTerrainBrush(
  terrain: TerrainData,
  center: THREE.Vector3,
  brush: { size: number; strength: number; falloff: "linear" | "smooth" | "hard"; materialId: string; flattenHeight?: number },
  mode: "raise" | "lower" | "smooth" | "flatten" | "paint",
) {
  const next = structuredClone(terrain);
  const resolution = terrain.resolution;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  const radiusX = (brush.size / terrain.width) * (resolution - 1);
  const radiusZ = (brush.size / terrain.depth) * (resolution - 1);
  const cx = ((center.x + halfW) / terrain.width) * (resolution - 1);
  const cz = ((center.z + halfD) / terrain.depth) * (resolution - 1);
  const minX = Math.max(0, Math.floor(cx - radiusX - 1));
  const maxX = Math.min(resolution - 1, Math.ceil(cx + radiusX + 1));
  const minZ = Math.max(0, Math.floor(cz - radiusZ - 1));
  const maxZ = Math.min(resolution - 1, Math.ceil(cz + radiusZ + 1));

  const falloff = (distance: number) => {
    const t = Math.max(0, Math.min(1, 1 - distance / brush.size));
    if (brush.falloff === "hard") return t > 0 ? 1 : 0;
    if (brush.falloff === "linear") return t;
    return t * t * (3 - 2 * t);
  };

  const getHeight = (x: number, z: number) => next.heights[terrainIndex(x, z, resolution)] ?? 0;

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const worldX = (x / (resolution - 1)) * terrain.width - halfW;
      const worldZ = (z / (resolution - 1)) * terrain.depth - halfD;
      const distance = Math.hypot(worldX - center.x, worldZ - center.z);
      if (distance > brush.size) continue;
      const influence = falloff(distance) * brush.strength;
      const index = terrainIndex(x, z, resolution);
      const current = next.heights[index] ?? 0;

      if (mode === "raise") {
        next.heights[index] = current + influence * 0.8;
      } else if (mode === "lower") {
        next.heights[index] = current - influence * 0.8;
      } else if (mode === "flatten") {
        const target = brush.flattenHeight ?? current;
        next.heights[index] = THREE.MathUtils.lerp(current, target, influence);
      } else if (mode === "smooth") {
        let total = 0;
        let count = 0;
        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue;
            total += getHeight(nx, nz);
            count += 1;
          }
        }
        const average = total / Math.max(1, count);
        next.heights[index] = THREE.MathUtils.lerp(current, average, influence * 0.7);
      } else if (mode === "paint") {
        next.materialMap[index] = brush.materialId;
      }
    }
  }

  return next;
}

export function distancePointToSegment2D(
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
) {
  const vx = end.x - start.x;
  const vz = end.z - start.z;
  const wx = point.x - start.x;
  const wz = point.z - start.z;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const projX = start.x + vx * t;
  const projZ = start.z + vz * t;
  return Math.hypot(point.x - projX, point.z - projZ);
}

export function isPointNearRoad(point: THREE.Vector3, roads: { points: { x: number; y: number; z: number }[]; width: number }[]) {
  for (const road of roads) {
    if (road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const start = new THREE.Vector3(road.points[i].x, road.points[i].y, road.points[i].z);
      const end = new THREE.Vector3(road.points[i + 1].x, road.points[i + 1].y, road.points[i + 1].z);
      if (distancePointToSegment2D(point, start, end) <= road.width * 0.65) {
        return true;
      }
    }
  }
  return false;
}

export function flattenRoadTerrain(
  terrain: TerrainData,
  roads: { points: { x: number; y: number; z: number }[]; width: number; flattenTerrain: boolean; closedLoop?: boolean }[],
): TerrainData {
  const next = structuredClone(terrain);
  const resolution = terrain.resolution;
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;

  for (const road of roads) {
    if (!road.flattenTerrain || road.points.length < 2) continue;
    const halfWidth = road.width / 2;

    const segmentCount = road.closedLoop ? road.points.length : road.points.length - 1;
    for (let i = 0; i < segmentCount; i += 1) {
      const start = new THREE.Vector3(road.points[i].x, road.points[i].y, road.points[i].z);
      const nextPoint = road.points[(i + 1) % road.points.length];
      const end = new THREE.Vector3(nextPoint.x, nextPoint.y, nextPoint.z);

      // Compute terrain grid bounds for this segment
      const minX = Math.max(0, Math.min(terrain.resolution - 1, Math.floor(((Math.min(start.x, end.x) - halfWidth + halfW) / terrain.width) * (resolution - 1))));
      const maxX = Math.max(0, Math.min(terrain.resolution - 1, Math.ceil(((Math.max(start.x, end.x) + halfWidth + halfW) / terrain.width) * (resolution - 1))));
      const minZ = Math.max(0, Math.min(terrain.resolution - 1, Math.floor(((Math.min(start.z, end.z) - halfWidth + halfD) / terrain.depth) * (resolution - 1))));
      const maxZ = Math.max(0, Math.min(terrain.resolution - 1, Math.ceil(((Math.max(start.z, end.z) + halfWidth + halfD) / terrain.depth) * (resolution - 1))));

      for (let gz = minZ; gz <= maxZ; gz += 1) {
        for (let gx = minX; gx <= maxX; gx += 1) {
          const worldX = (gx / (resolution - 1)) * terrain.width - halfW;
          const worldZ = (gz / (resolution - 1)) * terrain.depth - halfD;
          const point = new THREE.Vector3(worldX, 0, worldZ);

          const dist = distancePointToSegment2D(point, start, end);
          if (dist > halfWidth) continue;

          // Interpolate road height at this point's XZ position
          const vx = end.x - start.x;
          const vz = end.z - start.z;
          const lenSq = vx * vx + vz * vz;
          const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((worldX - start.x) * vx + (worldZ - start.z) * vz) / lenSq));
          const roadY = start.y + t * (end.y - start.y);

          const idx = terrainIndex(gx, gz, resolution);
          next.heights[idx] = roadY;
        }
      }
    }
  }

  return next;
}

export function terrainSlopeAt(point: THREE.Vector3, terrain: TerrainData) {
  const { gridX, gridZ } = terrainWorldToGrid(point, terrain);
  const center = terrain.heights[terrainIndex(gridX, gridZ, terrain.resolution)] ?? 0;
  const sample = (x: number, z: number) => terrain.heights[terrainIndex(Math.max(0, Math.min(terrain.resolution - 1, x)), Math.max(0, Math.min(terrain.resolution - 1, z)), terrain.resolution)] ?? center;
  const dx = sample(gridX + 1, gridZ) - sample(gridX - 1, gridZ);
  const dz = sample(gridX, gridZ + 1) - sample(gridX, gridZ - 1);
  const rise = Math.hypot(dx, dz) / 2;
  return Math.atan(rise) * (180 / Math.PI);
}
