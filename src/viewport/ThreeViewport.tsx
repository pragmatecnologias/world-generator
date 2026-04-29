import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type {
  AssetDefinition,
  BrushState,
  EditorTool,
  GameplayMarker,
  PlacedObject,
  RoadDefinition,
  ScatterZone,
  TerrainData,
  WorldProject,
} from "../types";
import type { WorldOperation } from "../core/worldDocument";
import {
  applyTerrainBrush,
  createTerrainGeometry,
  isPointNearRoad,
  sampleTerrainHeight,
  terrainMaterialColor,
  terrainSlopeAt,
  worldToTerrainHeight,
} from "./terrain";

type FoliagePaintSettings = {
  density: number;
  minSpacing: number;
  randomScaleMin: number;
  randomScaleMax: number;
  randomRotation: boolean;
  alignToTerrain: boolean;
  avoidRoads: boolean;
  slopeLimit: number;
  eraseMode: boolean;
};

type ScatterPaintSettings = {
  count: number;
  minSpacing: number;
  randomScaleMin: number;
  randomScaleMax: number;
  randomRotation: boolean;
  slopeLimit: number;
};

type Props = {
  project: WorldProject;
  activeTool: EditorTool;
  brush: BrushState;
  selectionObjectId?: string;
  selectedAssetId?: string;
  foliageSettings: FoliagePaintSettings;
  scatterSettings: ScatterPaintSettings;
  playMode?: boolean;
  readOnly?: boolean;
  onSelectObject: (id?: string) => void;
  onSelectTerrainCell: (cell?: { x: number; z: number }) => void;
  onProjectChange: (updater: (project: WorldProject) => WorldProject) => void;
  onWorldOperations?: (operations: WorldOperation[]) => void;
  onStatus: (message: string) => void;
  onStats?: (stats: { fps: number; drawCalls: number; sceneObjects: number }) => void;
};

type SceneObjectRecord = {
  object: THREE.Object3D;
  source: "placed" | "foliage" | "marker" | "path" | "zone";
};

function makePlaceholderMesh(asset: AssetDefinition) {
  const category = asset.category.toLowerCase();
  const name = asset.name.toLowerCase();
  const tags = asset.tags.map((tag) => tag.toLowerCase());
  const looksLike = (...needles: string[]) =>
    needles.some((needle) => category.includes(needle) || name.includes(needle) || tags.some((tag) => tag.includes(needle)));
  const hash = asset.id.split("").reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 17);
  const rand = (offset = 0) => {
    const value = (hash + offset * 1013904223) >>> 0;
    return ((value ^ (value >>> 16)) % 1000) / 1000;
  };

  const tint = new THREE.Color(terrainMaterialColor(category));
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: looksLike("pine") ? new THREE.Color("#3d6d2f") : tint.clone().lerp(new THREE.Color("#5c9d42"), 0.76),
    roughness: 0.9,
    metalness: 0.02,
  });
  const barkMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#6a4a2d"),
    roughness: 1,
    metalness: 0,
  });
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: tint.clone().lerp(new THREE.Color("#c8b59d"), 0.4),
    roughness: 0.96,
    metalness: 0.02,
  });
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: tint.clone().lerp(new THREE.Color("#caa56d"), 0.32),
    roughness: 0.92,
    metalness: 0.01,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: tint.clone().lerp(new THREE.Color("#ffffff"), 0.15),
    roughness: 0.75,
    metalness: 0.05,
  });

  if (looksLike("tree", "foliage", "bush", "plant", "shrub", "pine")) {
    const group = new THREE.Group();
    const trunkHeight = 1.15 + rand(1) * 0.55;
    const trunkRadius = 0.11 + rand(2) * 0.06;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkRadius * 0.9, trunkRadius * 1.15, trunkHeight, 8), barkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.rotation.z = rand(3) * 0.03 - 0.015;
    group.add(trunk);

    const canopyHeight = looksLike("shrub") ? 0.95 + rand(4) * 0.2 : 2.0 + rand(4) * 0.72;
    const canopyRadius = looksLike("shrub") ? 0.44 + rand(5) * 0.14 : 0.88 + rand(5) * 0.34;
    const coneCount = looksLike("pine") ? 4 : 3;
    for (let i = 0; i < coneCount; i += 1) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(canopyRadius * (1 - i * 0.16), canopyHeight * (1 - i * 0.1), 10, 1),
        leafMaterial,
      );
      cone.position.y = trunkHeight + canopyHeight * 0.24 + i * 0.32;
      cone.rotation.y = rand(10 + i) * Math.PI * 2;
      cone.scale.setScalar(1 - i * 0.08);
      group.add(cone);
    }

    const crown = new THREE.Mesh(new THREE.SphereGeometry(canopyRadius * 1.05, 10, 9), leafMaterial);
    crown.position.y = trunkHeight + canopyHeight * 0.7;
    crown.scale.set(1.2, looksLike("shrub") ? 0.78 : 0.95, 1.2);
    group.add(crown);
    return group;
  }

  if (looksLike("rock", "stone", "boulder", "cliff", "crag")) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82 + rand(1) * 0.22, 0), rockMaterial);
    base.scale.set(1.2, 0.82, 1.35);
    base.rotation.set(rand(2) * 0.25, rand(3) * Math.PI * 2, rand(4) * 0.15);
    group.add(base);

    const chip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48 + rand(5) * 0.12, 0), rockMaterial);
    chip.position.set(0.34, 0.24, -0.08);
    chip.rotation.set(rand(6) * 0.5, rand(7) * Math.PI * 2, rand(8) * 0.5);
    group.add(chip);

    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 0.38, 6), rockMaterial);
    slab.position.set(-0.2, -0.24, 0.16);
    slab.rotation.set(rand(9) * 0.18 - 0.09, rand(10) * Math.PI * 2, rand(11) * 0.18 - 0.09);
    group.add(slab);
    return group;
  }

  if (looksLike("building", "house", "cabin", "barn", "shed", "hut", "tower", "structure")) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 1.1), buildingMaterial);
    body.position.y = 0.48;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.72, 4), accentMaterial);
    roof.position.y = 1.08;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1.1, 1);
    group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.04), barkMaterial);
    door.position.set(0, 0.28, 0.58);
    group.add(door);
    return group;
  }

  if (looksLike("barrier", "fence", "sign", "post", "marker", "prop")) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6), accentMaterial);
    pole.position.y = 0.6;
    group.add(pole);

    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.12), buildingMaterial);
    crossbar.position.set(0, 1.05, 0);
    crossbar.rotation.z = rand(1) * 0.12 - 0.06;
    group.add(crossbar);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), barkMaterial);
    brace.position.set(0.24, 0.42, 0);
    brace.rotation.z = -0.55;
    group.add(brace);
    return group;
  }

  if (looksLike("bridge")) {
    const group = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.55), buildingMaterial);
    deck.position.y = 0.45;
    group.add(deck);
    const railL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.08), barkMaterial);
    railL.position.set(0, 0.95, 0.22);
    group.add(railL);
    const railR = railL.clone();
    railR.position.z = -0.22;
    group.add(railR);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), barkMaterial);
    postL.position.set(-1.05, 0.3, 0);
    group.add(postL);
    const postR = postL.clone();
    postR.position.x = 1.05;
    group.add(postR);
    return group;
  }

  if (looksLike("tent")) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.9, 3), buildingMaterial);
    base.position.y = 0.45;
    base.rotation.y = Math.PI / 2;
    group.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 5), barkMaterial);
    pole.position.y = 0.6;
    group.add(pole);
    const flap = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.72, 4), accentMaterial);
    flap.position.y = 0.92;
    flap.rotation.y = Math.PI / 4;
    group.add(flap);
    return group;
  }

  if (looksLike("camp", "fire")) {
    const group = new THREE.Group();
    const logs = [
      new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), barkMaterial),
      new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), barkMaterial),
      new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), barkMaterial),
    ];
    logs[0].rotation.z = Math.PI / 2;
    logs[1].rotation.z = Math.PI / 3;
    logs[2].rotation.z = -Math.PI / 3;
    logs.forEach((log) => group.add(log));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 5), new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff7d2b", emissiveIntensity: 1.1, roughness: 0.7 }));
    flame.position.y = 0.25;
    group.add(flame);
    return group;
  }

  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.82, 4, 8), materialForAsset(asset, tint));
  body.position.y = 0.72;
  body.rotation.y = rand(1) * Math.PI * 2;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), accentMaterial);
  cap.position.y = 1.26;
  cap.scale.set(1, 0.55, 1);
  group.add(cap);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, 0.22, 8), rockMaterial);
  base.position.y = 0.11;
  group.add(base);
  return group;
}

function materialForAsset(asset: AssetDefinition, tint: THREE.Color) {
  const category = asset.category.toLowerCase();
  if (category.includes("metal") || category.includes("machine") || category.includes("vehicle")) {
    return new THREE.MeshStandardMaterial({ color: tint.clone().lerp(new THREE.Color("#9ca3af"), 0.5), roughness: 0.55, metalness: 0.35 });
  }
  if (category.includes("wood") || category.includes("furniture")) {
    return new THREE.MeshStandardMaterial({ color: tint.clone().lerp(new THREE.Color("#8b5a2b"), 0.45), roughness: 0.88, metalness: 0.02 });
  }
  return new THREE.MeshStandardMaterial({ color: tint.clone().lerp(new THREE.Color("#d1d5db"), 0.2), roughness: 0.78, metalness: 0.04 });
}

function cloneAssetObject(asset: AssetDefinition, loadedAsset: THREE.Object3D | undefined) {
  const root = loadedAsset ? loadedAsset.clone(true) : makePlaceholderMesh(asset);
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => {
          entry.needsUpdate = true;
        });
      } else if (material) {
        material.needsUpdate = true;
      }
    }
  });
  return root;
}

function createPathMesh(road: RoadDefinition, terrain: TerrainData) {
  if (road.points.length < 2) return null;
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color(terrainMaterialColor(road.materialId));
  const halfWidth = road.width / 2;
  const isWater = road.materialId === "water";

  const points = road.points.map((point) => new THREE.Vector3(point.x, point.y, point.z));

  const buildPoint = (index: number) => {
    const current = points[index];
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = next.clone().sub(prev).setY(0).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(halfWidth);
    const left = current.clone().add(normal);
    const right = current.clone().sub(normal);
    return { left, right };
  };

  const vertices: { left: THREE.Vector3; right: THREE.Vector3 }[] = [];
  for (let i = 0; i < points.length; i += 1) {
    vertices.push(buildPoint(i));
  }

  vertices.forEach((pair) => {
    positions.push(pair.left.x, pair.left.y + (isWater ? -0.08 : 0.05), pair.left.z);
    positions.push(pair.right.x, pair.right.y + (isWater ? -0.08 : 0.05), pair.right.z);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  });

  for (let i = 0; i < vertices.length - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = isWater
    ? new THREE.MeshStandardMaterial({ color: new THREE.Color("#58a7e6"), transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.02 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  return new THREE.Mesh(geometry, material);
}

const createRoadMesh = createPathMesh;

function buildZonePreview(zone: ScatterZone) {
  const points = zone.points.map((point) => new THREE.Vector3(point.x, point.y, point.z));
  if (points.length < 2) return null;
  const minX = Math.min(points[0].x, points[1].x);
  const maxX = Math.max(points[0].x, points[1].x);
  const minZ = Math.min(points[0].z, points[1].z);
  const maxZ = Math.max(points[0].z, points[1].z);
  const shape = new THREE.Shape();
  shape.moveTo(minX, minZ);
  shape.lineTo(maxX, minZ);
  shape.lineTo(maxX, maxZ);
  shape.lineTo(minX, maxZ);
  shape.lineTo(minX, minZ);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.14, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

const buildScatterPreview = buildZonePreview;

function buildSkyDome(environment: WorldProject["environment"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, environment.backgroundColor);
  gradient.addColorStop(0.42, environment.fogColor);
  gradient.addColorStop(1, "#5d6f86");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunX = canvas.width * (0.5 + environment.sunDirection.x * 0.2);
  const sunY = canvas.height * (0.55 - environment.sunDirection.y * 0.18);
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 210);
  sunGlow.addColorStop(0, "rgba(255,255,255,0.75)");
  sunGlow.addColorStop(0.18, "rgba(255,244,200,0.35)");
  sunGlow.addColorStop(0.5, "rgba(255,220,160,0.12)");
  sunGlow.addColorStop(1, "rgba(255,220,160,0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 210, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 18; i += 1) {
    const x = (i / 18) * canvas.width + ((i % 3) - 1) * 36;
    const y = canvas.height * (0.2 + (i % 4) * 0.08);
    ctx.beginPath();
    ctx.ellipse(x, y, 72 + (i % 4) * 18, 18 + (i % 3) * 6, Math.sin(i * 2.1) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 20), material);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  return dome;
}

export default function ThreeViewport({
  project,
  activeTool,
  brush,
  selectionObjectId,
  selectedAssetId,
  foliageSettings,
  scatterSettings,
  playMode = false,
  readOnly = false,
  onSelectObject,
  onSelectTerrainCell,
  onProjectChange,
  onWorldOperations,
  onStatus,
  onStats,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const brushCursorRef = useRef<THREE.Mesh | null>(null);
  const objectMapRef = useRef(new Map<string, SceneObjectRecord>());
  const loadedAssetsRef = useRef<Record<string, THREE.Object3D>>({});
  const pendingPaintRef = useRef<{ active: boolean; pointerId?: number }>({ active: false });
  const roadPreviewRef = useRef<THREE.Group | null>(null);
  const scatterPreviewRef = useRef<THREE.Mesh | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const [assetReady, setAssetReady] = useState(0);

  const terrain = useMemo(() => project.terrain, [project.terrain]);
  const isPathTool = activeTool === "road-draw" || activeTool === "path-draw";
  const isZoneTool = activeTool === "scatter" || activeTool === "zone-scatter";

  useEffect(() => {
    const loader = new GLTFLoader();
    let cancelled = false;
    const assetPromises = project.assets
      .filter((asset) => asset.fileDataUrl)
      .map(
        (asset) =>
          new Promise<void>((resolve) => {
            loader.load(
              asset.fileDataUrl!,
              (gltf) => {
                if (!cancelled) {
                  loadedAssetsRef.current[asset.id] = gltf.scene;
                }
                resolve();
              },
              undefined,
              () => {
                resolve();
              },
            );
          }),
      );
    Promise.all(assetPromises).then(() => {
      if (!cancelled) setAssetReady((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [project.assets]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(project.environment.backgroundColor);
    scene.fog = project.environment.fogEnabled
      ? new THREE.FogExp2(project.environment.fogColor, project.environment.fogDensity)
      : null;

    const skyDome = buildSkyDome(project.environment);
    if (skyDome) {
      scene.add(skyDome);
    }

    const camera = new THREE.PerspectiveCamera(36, container.clientWidth / container.clientHeight, 0.1, 1000);
    if (playMode) {
      camera.position.set(0, 3.0, 12.5);
      camera.lookAt(0, 1.1, 0);
    } else {
      camera.position.set(36, 26, 34);
      camera.lookAt(0, 0.8, 0);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, playMode ? 1.2 : 0.5, 0);
    controls.enablePan = !playMode;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode("translate");
    transformControls.visible = !readOnly && !playMode;
    transformControls.addEventListener("dragging-changed", (event) => {
      controls.enabled = !event.value;
    });
    transformControls.addEventListener("objectChange", () => {
      const selectionId = selectionObjectId;
      if (!selectionId) return;
      const rec = objectMapRef.current.get(selectionId);
      if (!rec) return;
      const { x, y, z } = rec.object.position;
      const { x: rx, y: ry, z: rz } = rec.object.rotation;
      const { x: sx, y: sy, z: sz } = rec.object.scale;
      onProjectChange((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        objects: current.objects.map((object) =>
          object.id === selectionId
            ? {
                ...object,
                position: { x, y, z },
                rotation: { x: rx, y: ry, z: rz },
                scale: { x: sx, y: sy, z: sz },
              }
            : object,
        ),
      }));
    });
    transformRef.current = transformControls;
    scene.add(transformControls);

    const ambient = new THREE.HemisphereLight(0xeaf4ff, 0x6d5436, project.environment.ambientIntensity * 0.8);
    scene.add(ambient);
    const fill = new THREE.DirectionalLight(0xb7d7ff, 0.35);
    fill.position.set(-project.environment.sunDirection.x, Math.max(0.5, project.environment.sunDirection.y * 0.4), -project.environment.sunDirection.z).normalize();
    scene.add(fill);
    const sun = new THREE.DirectionalLight(0xffffff, project.environment.sunIntensity);
    sun.position.set(project.environment.sunDirection.x, project.environment.sunDirection.y, project.environment.sunDirection.z).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);

    const terrainGeometry = createTerrainGeometry(terrain);
    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.rotation.x = 0;
    terrainMeshRef.current = terrainMesh;
    terrainMesh.name = "terrain";
    scene.add(terrainMesh);

    const grid = new THREE.GridHelper(terrain.width, terrain.resolution - 1, 0x7dd3fc, 0x334155);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = readOnly ? 0.12 : 0.18;
    scene.add(grid);

    const brushGeometry = new THREE.RingGeometry(0.96, 1, 48);
    const brushMaterial = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const brushCursor = new THREE.Mesh(brushGeometry, brushMaterial);
    brushCursor.rotation.x = -Math.PI / 2;
    brushCursor.visible = false;
    brushCursorRef.current = brushCursor;
    scene.add(brushCursor);

    const selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.08, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    selectionRing.rotation.x = Math.PI / 2;
    selectionRing.visible = false;
    selectionRingRef.current = selectionRing;
    scene.add(selectionRing);

    const rebuildSceneObjects = () => {
      objectMapRef.current.forEach((record) => scene.remove(record.object));
      objectMapRef.current.clear();

      project.objects.forEach((objectData) => {
        const asset = project.assets.find((entry) => entry.id === objectData.assetId);
        if (!asset) return;
        if (!project.layers.find((layer) => layer.id === objectData.layerId)?.visible) return;
        const root = cloneAssetObject(asset, loadedAssetsRef.current[asset.id]);
        root.name = objectData.name;
        root.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
        root.rotation.set(objectData.rotation.x, objectData.rotation.y, objectData.rotation.z);
        root.scale.set(objectData.scale.x, objectData.scale.y, objectData.scale.z);
        root.userData.objectId = objectData.id;
        root.userData.kind = "placed";
        scene.add(root);
        objectMapRef.current.set(objectData.id, { object: root, source: "placed" });
      });

      project.foliageGroups.forEach((group) => {
        group.instances.forEach((instance) => {
          const asset = project.assets.find((entry) => entry.id === instance.assetId);
          if (!asset) return;
          const root = cloneAssetObject(asset, loadedAssetsRef.current[asset.id]);
          root.position.set(instance.position.x, instance.position.y, instance.position.z);
          root.rotation.set(instance.rotation.x, instance.rotation.y, instance.rotation.z);
          root.scale.set(instance.scale.x, instance.scale.y, instance.scale.z);
          root.userData.kind = "foliage";
          root.userData.instanceId = instance.id;
          scene.add(root);
          objectMapRef.current.set(instance.id, { object: root, source: "foliage" });
        });
      });

      project.markers.forEach((marker: GameplayMarker) => {
        const color = new THREE.Color(
          marker.type === "start-finish"
            ? "#f59e0b"
            : marker.type === "checkpoint"
              ? "#22c55e"
              : "#60a5fa",
        );
        const mesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.6, 1.8, 6),
          new THREE.MeshStandardMaterial({ color }),
        );
        mesh.position.set(marker.position.x, marker.position.y + 0.9, marker.position.z);
        mesh.userData.kind = "marker";
        mesh.userData.markerId = marker.id;
        scene.add(mesh);
        objectMapRef.current.set(marker.id, { object: mesh, source: "marker" });
      });

      project.roads.forEach((road) => {
        const roadMesh = createPathMesh(road, terrain);
        if (roadMesh) {
          roadMesh.userData.kind = "path";
          roadMesh.userData.pathId = road.id;
          roadMesh.userData.roadId = road.id;
          scene.add(roadMesh);
          objectMapRef.current.set(road.id, { object: roadMesh, source: "path" });
        }
      });

      if (project.scatterZones.length > 0) {
        const latest = project.scatterZones[project.scatterZones.length - 1];
        const scatterMesh = buildScatterPreview(latest);
        if (scatterMesh) {
          scatterMesh.userData.kind = "zone";
          scatterMesh.userData.zoneId = latest.id;
          scene.add(scatterMesh);
          scatterPreviewRef.current = scatterMesh;
        }
      }
    };

    rebuildSceneObjects();

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    const setBrushCursor = (point: THREE.Vector3 | null) => {
      if (!brushCursorRef.current) return;
      brushCursorRef.current.visible = !!point;
      if (point) {
        brushCursorRef.current.position.set(point.x, point.y + 0.08, point.z);
        const scale = Math.max(0.4, brush.size / 2.2);
        brushCursorRef.current.scale.set(scale, scale, scale);
      }
    };

    const updateSelectionRing = (point: THREE.Vector3 | null, object?: THREE.Object3D | null) => {
      if (!selectionRingRef.current) return;
      selectionRingRef.current.visible = !!point;
      if (point) {
        selectionRingRef.current.position.set(point.x, point.y + 0.12, point.z);
        selectionRingRef.current.scale.setScalar(object ? Math.max(object.scale.x, object.scale.y, object.scale.z) : 1);
      }
    };

    const syncTransformControls = () => {
      if (!transformRef.current) return;
      const selected = selectionObjectId ? objectMapRef.current.get(selectionObjectId)?.object : null;
      if (!readOnly && selected && activeTool === "select") {
        transformRef.current.attach(selected);
        transformRef.current.visible = true;
      } else {
        transformRef.current.detach();
        transformRef.current.visible = false;
      }
    };

    const applySelectedObjectSelection = (intersection: THREE.Intersection | null) => {
      if (!intersection) {
        onSelectObject(undefined);
        updateSelectionRing(null, null);
        return;
      }
      let object = intersection.object;
      while (object.parent && !object.userData.objectId && !object.userData.markerId && !object.userData.pathId && !object.userData.roadId && !object.userData.zoneId) {
        object = object.parent;
      }
      const objectId = object.userData.objectId ?? object.userData.markerId ?? object.userData.pathId ?? object.userData.roadId ?? object.userData.zoneId;
      if (objectId) {
        onSelectObject(String(objectId));
        updateSelectionRing(object.position.clone(), object);
      }
    };

    const placeAsset = (point: THREE.Vector3) => {
      if (!selectedAssetId) return;
      const asset = project.assets.find((entry) => entry.id === selectedAssetId);
      if (!asset) return;
      const currentHeight = sampleTerrainHeight(point, terrain).height;
      const object: PlacedObject = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        name: asset.name,
        position: { x: point.x, y: currentHeight, z: point.z },
        rotation: asset.defaultRotation ?? { x: 0, y: 0, z: 0 },
        scale: { x: asset.defaultScale, y: asset.defaultScale, z: asset.defaultScale },
        layerId: "layer-props",
        visible: true,
        locked: false,
        collisionEnabled: true,
      };
      onWorldOperations?.([{ type: "addObject", payload: object }]);
      if (!onWorldOperations) {
        onProjectChange((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          objects: [...current.objects, object],
        }));
      }
      onSelectObject(object.id);
      onStatus(`Placed ${asset.name}`);
    };

    const paintFoliageAt = (point: THREE.Vector3) => {
      const asset = project.assets.find((entry) => entry.id === selectedAssetId && entry.canPaint)
        ?? project.assets.find((entry) => entry.canPaint);
      if (!asset) return;
      if (foliageSettings.avoidRoads && isPointNearRoad(point, project.roads)) return;
      if (foliageSettings.slopeLimit > 0 && terrainSlopeAt(point, terrain) > foliageSettings.slopeLimit) return;

      if (foliageSettings.eraseMode) {
        const removeIds = project.foliageGroups.flatMap((group) => group.instances.filter((instance) => {
          const dx = instance.position.x - point.x;
          const dz = instance.position.z - point.z;
          return Math.hypot(dx, dz) <= Math.max(0.8, brush.size * 0.45);
        }).map((instance) => instance.id));
        onProjectChange((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          foliageGroups: current.foliageGroups.map((group) => ({
            ...group,
            instances: group.instances.filter((instance) => {
              const dx = instance.position.x - point.x;
              const dz = instance.position.z - point.z;
              return Math.hypot(dx, dz) > Math.max(0.8, brush.size * 0.45);
            }),
          })),
        }));
        onStatus("Erased foliage");
        return;
      }

      const count = Math.max(1, Math.round(Math.max(1, foliageSettings.density) * brush.strength * 1.5));
      const newInstances = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * brush.size * 0.65;
        const x = point.x + Math.cos(angle) * radius;
        const z = point.z + Math.sin(angle) * radius;
        const y = worldToTerrainHeight(new THREE.Vector3(x, point.y, z), terrain);
        const scaleValue = THREE.MathUtils.lerp(foliageSettings.randomScaleMin, foliageSettings.randomScaleMax, Math.random());
        const slope = terrainSlopeAt(new THREE.Vector3(x, y, z), terrain);
        const slopeTooSteep = foliageSettings.slopeLimit > 0 && slope > foliageSettings.slopeLimit;
        if (slopeTooSteep || (foliageSettings.avoidRoads && isPointNearRoad(new THREE.Vector3(x, y, z), project.roads))) {
          return null;
        }
        return {
          id: crypto.randomUUID(),
          assetId: asset.id,
          position: { x, y: foliageSettings.alignToTerrain ? y : point.y, z },
          rotation: { x: 0, y: foliageSettings.randomRotation ? Math.random() * Math.PI * 2 : 0, z: 0 },
          scale: { x: scaleValue, y: scaleValue, z: scaleValue },
        };
      }).filter(Boolean);

      if (newInstances.length === 0) return;
      const targetGroup = project.foliageGroups[0];
      if (targetGroup) {
        onWorldOperations?.([{ type: "addFoliageInstances", targetId: targetGroup.id, payload: newInstances as typeof targetGroup.instances }]);
      }
      onProjectChange((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        foliageGroups: current.foliageGroups.map((group, index) =>
          index === 0 ? { ...group, instances: [...group.instances, ...(newInstances as typeof group.instances)] } : group,
        ),
      }));
      onStatus(`Painted ${newInstances.length} foliage instances`);
    };

    const paintTerrainAt = (point: THREE.Vector3) => {
      let mode: "raise" | "lower" | "smooth" | "flatten" | "paint" = "raise";
      if (activeTool === "terrain-lower") mode = "lower";
      if (activeTool === "terrain-smooth") mode = "smooth";
      if (activeTool === "terrain-flatten") mode = "flatten";
      if (activeTool === "terrain-paint") mode = "paint";
      const payload = {
        center: { x: point.x, z: point.z },
        radius: brush.size,
        strength: brush.strength,
        falloff: brush.falloff,
        materialId: brush.materialId,
        flattenHeight: brush.flattenHeight,
      } as const;
      onWorldOperations?.([
        mode === "paint"
          ? { type: "applyTerrainMaterialPatch", payload: { materialId: brush.materialId, center: payload.center, radius: payload.radius, strength: payload.strength, falloff: payload.falloff } }
          : { type: "applyTerrainHeightPatch", payload: { mode, center: payload.center, radius: payload.radius, strength: payload.strength, falloff: payload.falloff, flattenHeight: payload.flattenHeight } },
      ]);
      const nextTerrain = applyTerrainBrush(
        terrain,
        point,
        brush,
        mode,
      );
      onProjectChange((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        terrain: nextTerrain,
      }));
    };

    const updateRoadTerrain = (center: THREE.Vector3) => {
      if (!isPathTool) return;
      const path = project.roads[project.roads.length - 1];
      if (!path || !path.flattenTerrain) return;
      const nextTerrain = applyTerrainBrush(
        terrain,
        center,
        {
          size: path.width * 0.6,
          strength: 1,
          falloff: "smooth",
          materialId: path.materialId,
          flattenHeight: center.y,
        },
        "flatten",
      );
      onWorldOperations?.([{ type: "applyTerrainHeightPatch", payload: { mode: "flatten", center: { x: center.x, z: center.z }, radius: path.width * 0.6, strength: 1, falloff: "smooth", flattenHeight: center.y } }]);
      onProjectChange((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        terrain: nextTerrain,
      }));
    };

    const raycastTerrain = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hits = raycasterRef.current.intersectObject(terrainMesh);
      return hits[0] ?? null;
    };

    const raycastObjects = () => {
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const meshes = [...objectMapRef.current.values()].map((record) => record.object);
      return raycasterRef.current.intersectObjects(meshes, true)[0] ?? null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (readOnly) return;
      const terrainHit = raycastTerrain(event);
      if (terrainHit) {
        setBrushCursor(terrainHit.point);
        if (pendingPaintRef.current.active && activeTool.startsWith("terrain-")) {
          paintTerrainAt(terrainHit.point);
        }
        if (pendingPaintRef.current.active && isPathTool) {
          updateRoadTerrain(terrainHit.point);
        }
        if (pendingPaintRef.current.active && (activeTool === "foliage-paint" || activeTool === "foliage-erase")) {
          paintFoliageAt(terrainHit.point);
        }
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (readOnly) return;
      pendingPaintRef.current.active = true;
      pendingPaintRef.current.pointerId = event.pointerId;
      const terrainHit = raycastTerrain(event);
      const objectHit = raycastObjects();

      if (activeTool === "select") {
        applySelectedObjectSelection(objectHit);
        if (terrainHit) {
          const hit = sampleTerrainHeight(terrainHit.point, terrain);
          onSelectTerrainCell({ x: hit.gridX, z: hit.gridZ });
        }
      } else if (activeTool === "asset-place" && terrainHit) {
        placeAsset(terrainHit.point);
      } else if (activeTool === "terrain-raise" || activeTool === "terrain-lower" || activeTool === "terrain-smooth" || activeTool === "terrain-flatten" || activeTool === "terrain-paint") {
        if (terrainHit) {
          paintTerrainAt(terrainHit.point);
          const hit = sampleTerrainHeight(terrainHit.point, terrain);
          onSelectTerrainCell({ x: hit.gridX, z: hit.gridZ });
        }
      } else if (isPathTool && terrainHit) {
        const point = terrainHit.point;
        const path = project.roads[project.roads.length - 1];
        if (path) {
          onWorldOperations?.([{ type: "addRoadPoint", targetId: path.id, payload: { x: point.x, y: point.y, z: point.z } }]);
          onProjectChange((current) => ({
            ...current,
            updatedAt: new Date().toISOString(),
            roads: current.roads.map((entry) =>
              entry.id === path.id
                ? { ...entry, points: [...entry.points, { x: point.x, y: point.y, z: point.z }] }
                : entry,
            ),
          }));
          updateRoadTerrain(point);
          onStatus(`Added path point to ${path.name}`);
        }
      } else if (isZoneTool && terrainHit) {
        const point = terrainHit.point;
        const zone = project.scatterZones[project.scatterZones.length - 1];
        if (!zone || zone.points.length >= 2) {
          onWorldOperations?.([{ type: "addScatterZone", payload: {
            id: crypto.randomUUID(),
            name: `Scatter ${project.scatterZones.length + 1}`,
            shape: "rectangle",
            points: [{ x: point.x, y: point.y, z: point.z }],
            assetIds: selectedAssetId ? [selectedAssetId] : project.assets.filter((asset) => asset.canPaint).slice(0, 3).map((asset) => asset.id),
            settings: {
              count: scatterSettings.count,
              minSpacing: scatterSettings.minSpacing,
              randomScaleMin: scatterSettings.randomScaleMin,
              randomScaleMax: scatterSettings.randomScaleMax,
              randomRotation: scatterSettings.randomRotation,
              slopeLimit: scatterSettings.slopeLimit,
            },
            generatedObjectIds: [],
          } }]);
          onProjectChange((current) => ({
            ...current,
            updatedAt: new Date().toISOString(),
            scatterZones: [
              ...current.scatterZones,
              {
                id: crypto.randomUUID(),
                name: `Scatter ${current.scatterZones.length + 1}`,
                shape: "rectangle",
                points: [{ x: point.x, y: point.y, z: point.z }],
                assetIds: selectedAssetId ? [selectedAssetId] : current.assets.filter((asset) => asset.canPaint).slice(0, 3).map((asset) => asset.id),
                settings: {
                  count: scatterSettings.count,
                  minSpacing: scatterSettings.minSpacing,
                  randomScaleMin: scatterSettings.randomScaleMin,
                  randomScaleMax: scatterSettings.randomScaleMax,
                  randomRotation: scatterSettings.randomRotation,
                  slopeLimit: scatterSettings.slopeLimit,
                },
                generatedObjectIds: [],
              },
            ],
          }));
        } else {
          onWorldOperations?.([{ type: "updateScatterZone", targetId: zone.id, payload: { points: [...zone.points, { x: point.x, y: point.y, z: point.z }] } }]);
          onProjectChange((current) => ({
            ...current,
            updatedAt: new Date().toISOString(),
            scatterZones: current.scatterZones.map((entry) =>
              entry.id === zone.id ? { ...entry, points: [...entry.points, { x: point.x, y: point.y, z: point.z }] } : entry,
            ),
          }));
        }
      }
    };

    const onPointerUp = () => {
      pendingPaintRef.current.active = false;
      pendingPaintRef.current.pointerId = undefined;
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerUp);
    renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

    let rafId = 0;
    const animate = () => {
      if ((animate as unknown as { stopped?: boolean }).stopped) return;
      const now = performance.now();
      const frame = (animate as unknown as { last?: number; acc?: number; count?: number });
      if (!frame.last) frame.last = now;
      if (!frame.acc) frame.acc = 0;
      if (!frame.count) frame.count = 0;
      const dt = now - frame.last;
      frame.last = now;
      frame.acc += dt;
      frame.count += 1;
      controls.update();
      syncTransformControls();
      renderer.render(scene, camera);
      if (onStats && frame.acc >= 500) {
        const fps = (frame.count * 1000) / frame.acc;
        onStats({
          fps,
          drawCalls: renderer.info.render.calls,
          sceneObjects: scene.children.length,
        });
        frame.acc = 0;
        frame.count = 0;
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    onStatus("Viewport ready");

    return () => {
      (animate as unknown as { stopped?: boolean }).stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
      controls.dispose();
      transformControls.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      container.replaceChildren();
    };
  }, [assetReady, brush, activeTool, project, selectedAssetId, selectionObjectId, terrain, onProjectChange, onSelectObject, onSelectTerrainCell, onStatus]);

  useEffect(() => {
    const scene = sceneRef.current;
    const terrainMesh = terrainMeshRef.current;
    if (!scene || !terrainMesh) return;
    const geom = terrainMesh.geometry as THREE.BufferGeometry;
    applyTerrainBrush(terrain, new THREE.Vector3(), brush, "raise");
    createTerrainGeometry(terrain);
    const nextGeom = createTerrainGeometry(terrain);
    terrainMesh.geometry.dispose();
    terrainMesh.geometry = nextGeom;
    scene.background = new THREE.Color(project.environment.backgroundColor);
  }, [project.environment.backgroundColor, terrain, brush]);

  return <div className="canvas-host" ref={mountRef} />;
}
