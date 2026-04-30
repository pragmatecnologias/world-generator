import * as THREE from "three";
import type { AssetDefinition } from "../types";

type KenneyKind = "tree" | "rock" | "cliff" | "bridge" | "tent" | "campfire" | "sign" | "fence" | "shrub" | "generic";

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const shadowTextureCache = new Map<string, THREE.Texture>();

function lower(value: string | undefined) {
  return (value ?? "").toLowerCase();
}

function looksLike(asset: AssetDefinition, ...needles: string[]) {
  const category = lower(asset.category);
  const name = lower(asset.name);
  const tags = asset.tags.map((tag) => lower(tag));
  return needles.some((needle) => category.includes(needle) || name.includes(needle) || tags.some((tag) => tag.includes(needle)));
}

function inferKind(asset: AssetDefinition): KenneyKind {
  if (looksLike(asset, "bridge")) return "bridge";
  if (looksLike(asset, "tent")) return "tent";
  if (looksLike(asset, "camp", "fire")) return "campfire";
  if (looksLike(asset, "sign")) return "sign";
  if (looksLike(asset, "fence", "barrier", "gate")) return "fence";
  if (looksLike(asset, "cliff")) return "cliff";
  if (looksLike(asset, "rock", "stone", "boulder", "cliff", "crag")) return "rock";
  if (looksLike(asset, "tree", "foliage", "bush", "plant", "shrub", "pine", "palm")) return "tree";
  if (looksLike(asset, "shrub", "bush", "plant", "grass")) return "shrub";
  return "generic";
}

function loadTexture(path: string, onLoad?: (texture: THREE.Texture) => void) {
  const cached = textureCache.get(path);
  if (cached) {
    if (onLoad) queueMicrotask(() => onLoad(cached));
    return cached;
  }
  const texture = textureLoader.load(path, (loadedTexture) => {
    loadedTexture.colorSpace = THREE.SRGBColorSpace;
    loadedTexture.anisotropy = 4;
    textureCache.set(path, loadedTexture);
    onLoad?.(loadedTexture);
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textureCache.set(path, texture);
  return texture;
}

function createShadowTexture(key: string) {
  const cached = shadowTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    shadowTextureCache.set(key, texture);
    return texture;
  }
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 58);
  gradient.addColorStop(0, "rgba(0,0,0,0.34)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.16)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  shadowTextureCache.set(key, texture);
  return texture;
}

function spriteScaleForKind(kind: KenneyKind, asset: AssetDefinition) {
  const defaultScale = asset.defaultScale ?? 1;
  switch (kind) {
    case "tree":
      return { width: 2.1 * defaultScale, height: 6.2 * defaultScale };
    case "shrub":
      return { width: 1.45 * defaultScale, height: 1.35 * defaultScale };
    case "rock":
      return { width: 2.2 * defaultScale, height: 1.15 * defaultScale };
    case "cliff":
      return { width: 3.45 * defaultScale, height: 3.65 * defaultScale };
    case "bridge":
      return { width: 3.4 * defaultScale, height: 1.15 * defaultScale };
    case "tent":
      return { width: 2.0 * defaultScale, height: 1.2 * defaultScale };
    case "campfire":
      return { width: 1.15 * defaultScale, height: 0.6 * defaultScale };
    case "sign":
    case "fence":
      return { width: 1.7 * defaultScale, height: 1.05 * defaultScale };
    default:
      return { width: 1.55 * defaultScale, height: 1.55 * defaultScale };
  }
}

function imageAspect(texture: THREE.Texture) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image?.height) return 1;
  return image.width / image.height;
}

function scaleSprite(sprite: THREE.Sprite, kind: KenneyKind, asset: AssetDefinition, texture: THREE.Texture) {
  const base = spriteScaleForKind(kind, asset);
  const aspect = imageAspect(texture);
  const width = base.width;
  const height = Math.max(0.18, width / Math.max(0.12, aspect));
  sprite.scale.set(width, height, 1);
}

function createShadow(kind: KenneyKind, asset: AssetDefinition) {
  const texture = createShadowTexture(`${kind}:${asset.id}`);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.68,
    color: 0xffffff,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  const base = spriteScaleForKind(kind, asset);
  mesh.scale.set(base.width * 0.95, base.height * 0.95, 1);
  mesh.renderOrder = -20;
  return mesh;
}

function texturePathForAsset(asset: AssetDefinition) {
  return asset.thumbnailPath ?? asset.filePath ?? undefined;
}

export function createKenneyAssetObject(asset: AssetDefinition) {
  const texturePath = texturePathForAsset(asset);
  if (!texturePath) return null;

  const kind = inferKind(asset);
  const group = new THREE.Group();
  group.name = `${asset.name}-kenney`;
  group.add(createShadow(kind, asset));

  const texture = loadTexture(texturePath, (loadedTexture) => {
    scaleSprite(sprite, kind, asset, loadedTexture);
  });
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    color: 0xffffff,
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0.06);
  sprite.renderOrder = 10;
  scaleSprite(sprite, kind, asset, texture);
  group.add(sprite);

  return group;
}

export function isKenneySpriteCandidate(asset: AssetDefinition) {
  return !!texturePathForAsset(asset) && inferKind(asset) !== "generic";
}
