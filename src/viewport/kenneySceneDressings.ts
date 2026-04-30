import * as THREE from "three";
import type { TerrainData, RoadDefinition } from "../types";
import { terrainIndex, terrainSlopeAt, terrainCellToWorld } from "./terrain";

type Kind = "path" | "river" | "cliff";

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function loadTexture(path: string) {
  const cached = textureCache.get(path);
  if (cached) return cached;
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(path, texture);
  return texture;
}

function chooseTexture(kind: Kind, road?: RoadDefinition) {
  if (kind === "river" || road?.materialId === "water") {
    return "/assets/kenney_nature-kit/Side/ground_riverTile.png";
  }
  return "/assets/kenney_nature-kit/Side/ground_pathTile.png";
}

function createRibbonSegment(
  kind: Kind,
  road: RoadDefinition,
  start: THREE.Vector3,
  end: THREE.Vector3,
  widthScale = 1,
) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const angle = Math.atan2(dx, dz);
  const texture = loadTexture(chooseTexture(kind, road));
  texture.repeat.set(Math.max(1, length / 8), 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: kind === "river" ? 0.92 : 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.PlaneGeometry(length, Math.max(0.8, road.width * widthScale), 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.y = angle;
  mesh.position.set(
    (start.x + end.x) / 2,
    Math.max(start.y, end.y) + 0.04,
    (start.z + end.z) / 2,
  );
  mesh.renderOrder = kind === "river" ? 8 : 6;
  return mesh;
}

function roadKind(road: RoadDefinition): Kind {
  return road.materialId === "water" ? "river" : "path";
}

export function buildKenneyPathDressings(terrain: TerrainData, roads: RoadDefinition[]) {
  const group = new THREE.Group();
  group.name = "kenney-path-dressings";
  for (const road of roads) {
    if (road.points.length < 2) continue;
    const kind = roadKind(road);
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const start = road.points[i];
      const end = road.points[i + 1];
      const startWorld = new THREE.Vector3(start.x, start.y + 0.01, start.z);
      const endWorld = new THREE.Vector3(end.x, end.y + 0.01, end.z);
      group.add(createRibbonSegment(kind, road, startWorld, endWorld, kind === "river" ? 1.2 : 1.08));
    }
    if (road.closedLoop) {
      const start = road.points[road.points.length - 1];
      const end = road.points[0];
      const startWorld = new THREE.Vector3(start.x, start.y + 0.01, start.z);
      const endWorld = new THREE.Vector3(end.x, end.y + 0.01, end.z);
      group.add(createRibbonSegment(kind, road, startWorld, endWorld, kind === "river" ? 1.2 : 1.08));
    }
  }
  return group;
}

function cliffTextureForHeight(height: number) {
  return height > 18
    ? "/assets/kenney_nature-kit/Side/cliff_large_rock.png"
    : "/assets/kenney_nature-kit/Side/cliff_top_rock.png";
}

export function buildKenneyCliffDressings(terrain: TerrainData) {
  const group = new THREE.Group();
  group.name = "kenney-cliff-dressings";
  const step = Math.max(3, Math.floor(terrain.resolution / 24));
  const centerHeight = terrain.heights[Math.floor(terrain.heights.length / 2)] ?? 0;

  for (let z = 1; z < terrain.resolution - 1; z += step) {
    for (let x = 1; x < terrain.resolution - 1; x += step) {
      const index = terrainIndex(x, z, terrain.resolution);
      const height = terrain.heights[index] ?? 0;
      const slope = terrainSlopeAt(terrainCellToWorld(x, z, terrain, 0), terrain);
      if (slope < 18) continue;
      if (height < centerHeight - 3) continue;
      const left = terrain.heights[terrainIndex(Math.max(0, x - 1), z, terrain.resolution)] ?? height;
      const right = terrain.heights[terrainIndex(Math.min(terrain.resolution - 1, x + 1), z, terrain.resolution)] ?? height;
      const up = terrain.heights[terrainIndex(x, Math.min(terrain.resolution - 1, z + 1), terrain.resolution)] ?? height;
      const down = terrain.heights[terrainIndex(x, Math.max(0, z - 1), terrain.resolution)] ?? height;
      const dx = right - left;
      const dz = up - down;
      const facing = Math.atan2(dx, dz);
      const texture = loadTexture(cliffTextureForHeight(height));
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sprite = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 8.6, 1, 1), material);
      sprite.position.set(
        (x / (terrain.resolution - 1)) * terrain.width - terrain.width / 2,
        height + 3.2,
        (z / (terrain.resolution - 1)) * terrain.depth - terrain.depth / 2,
      );
      sprite.rotation.y = facing;
      sprite.rotation.x = -Math.PI / 2;
      sprite.scale.set(1.1 + Math.min(1.1, slope / 38), 1.1 + Math.min(1.2, slope / 32), 1);
      sprite.renderOrder = 5;
      group.add(sprite);
    }
  }

  return group;
}
