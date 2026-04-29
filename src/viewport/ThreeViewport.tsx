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
  onStatus: (message: string) => void;
  onStats?: (stats: { fps: number; drawCalls: number; sceneObjects: number }) => void;
};

type SceneObjectRecord = {
  object: THREE.Object3D;
  source: "placed" | "foliage" | "marker" | "path" | "zone";
};

function makePlaceholderMesh(asset: AssetDefinition) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(terrainMaterialColor(asset.category.toLowerCase())),
    roughness: 0.85,
    metalness: 0.05,
  });
  if (asset.category.toLowerCase().includes("tree") || asset.name.toLowerCase().includes("tree")) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), new THREE.MeshStandardMaterial({ color: "#6b4f32" }));
    trunk.position.y = 0.55;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 10), material);
    crown.position.y = 1.7;
    const group = new THREE.Group();
    group.add(trunk, crown);
    return group;
  }
  if (asset.name.toLowerCase().includes("rock")) {
    return new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), material);
  }
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
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
    positions.push(pair.left.x, pair.left.y + 0.05, pair.left.z);
    positions.push(pair.right.x, pair.right.y + 0.05, pair.right.z);
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
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
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

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    if (playMode) {
      camera.position.set(0, 2.2, 14);
      camera.lookAt(0, 1.5, 0);
    } else {
      camera.position.set(46, 48, 46);
      camera.lookAt(0, 0, 0);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, playMode ? 1.5 : 0, 0);
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

    const ambient = new THREE.AmbientLight(0xffffff, project.environment.ambientIntensity);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, project.environment.sunIntensity);
    sun.position.set(project.environment.sunDirection.x, project.environment.sunDirection.y, project.environment.sunDirection.z).normalize();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
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
    (grid.material as THREE.Material).opacity = 0.25;
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
      onProjectChange((current) => ({
        ...current,
        updatedAt: new Date().toISOString(),
        objects: [...current.objects, object],
      }));
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
