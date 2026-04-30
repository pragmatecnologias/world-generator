import { useEffect, useMemo, useRef, useState } from "react";
import ThreeViewport from "./viewport/ThreeViewport";
import type {
  AssetDefinition,
  BrushState,
  EditorTool,
  ProofRunResult,
  ProofStepResult,
  ValidationResult,
  WorldProject,
} from "./types";
import { buildWorldExportPackage, exportWorld, loadProjectFromStorage, validateExportPackage } from "./core/export";
import { validateProject } from "./core/validation";
import PreviewApp from "./PreviewApp";
import { generateWorld } from "./core/generation/generateWorld";
import { DEFAULT_WORLD_GENERATION_CONFIG, type WorldGenerationConfig } from "./core/schema/WorldConfigSchema";
import { validateWorldGenerationConfig } from "./core/schema/validators";
import { applyAiWorldPatch } from "./core/ai/applyAiWorldPatch";
import { validateAiPatch } from "./core/ai/worldPatchValidator";
import type { WorldPatch } from "./core/ai/worldPatchSchema";
import { FantasyIslandPanel } from "./editor/FantasyIslandPanel";
import { generateFantasyWorld } from "./domains/fantasy/generateFantasyWorld";
import { STRUCTURE_PRESETS } from "./domains/fantasy/fantasyAssets";
import { FANTASY_ZONE_PRESETS } from "./domains/fantasy/fantasyPresets";
import { applyAiWorldCommand } from "./core/ai/applyAiWorldCommand";
import type { AiWorldCommand } from "./core/ai/aiWorldCommandSchema";
import { validateAiWorldCommand } from "./core/ai/aiWorldCommandValidator";
import {
  buildAutoJsonProofProject,
  buildAutoAssetProofProject,
  buildAutoFullScenarioProject,
  clearPlacementAroundPaths as clearPlacementAroundPathsCore,
  createProofPreviewHash,
  generateProofTerrain,
} from "./core/generation/editorWorkflows";
import {
  applyAiCommandText,
  applyGenerationConfigText,
  applyWorldOperationBundleText,
  applyWorldPatchText,
  buildEvidenceBundle,
} from "./core/editor/editorActions";
import {
  createDownloadStatus,
  createEvidenceFileName,
  createReloadProofStatus,
  createSaveFileName,
  createSaveStatus,
  exportProjectSave,
  loadWorldProjectFromText,
  saveProjectSnapshot,
} from "./core/editor/sessionActions";
import {
  buildImportedAssetDefinition,
  generateZoneForProject,
} from "./core/editor/projectMutations";
import WorkspacePanelFrame from "./editor/layout/WorkspacePanelFrame";
import {
  bottomTabRegistry,
  defaultBottomTabOrder,
  defaultWorkspacePanelOrder,
  workspacePanelRegistry,
  type BottomTabDefinition,
  type BottomTabId,
  type WorkspaceDockSide,
  type WorkspacePanelId,
} from "./editor/layout/panelRegistry";
import { runProofRun } from "./core/validation/proofRunner";
import {
  applyWorldOperation,
  applyWorldOperations,
  createWorldOperation,
  normalizeWorldDocument,
  validateWorldDocumentIntegrity,
  worldDocumentToProject,
  worldProjectToDocument,
  type WorldDocument,
  type WorldOperation,
} from "./core/worldDocument";

type BottomTab = BottomTabId;
type PanelMode = "docked" | "floating" | "hidden";
type WorkspacePanel = WorkspacePanelId;
type MenuKey = "file" | "edit" | "view" | "windows" | null;

type FloatingPanelPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WorkspaceLayoutState = {
  toolboxWidth: number;
  inspectorWidth: number;
  bottomHeight: number;
};

type WorkspacePanelSnapshot = {
  panelModes: Record<WorkspacePanel, PanelMode>;
  bottomTab: BottomTab;
  bottomTabOrder: BottomTab[];
  workspacePanelOrder: WorkspacePanel[];
  panelDockSides: Record<WorkspacePanel, WorkspaceDockSide>;
  panelPositions: Record<WorkspacePanel, FloatingPanelPosition>;
};

type CommandItem = {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  run: () => void;
};

const terrainTools: { id: EditorTool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "terrain-raise", label: "Raise" },
  { id: "terrain-lower", label: "Lower" },
  { id: "terrain-smooth", label: "Smooth" },
  { id: "terrain-flatten", label: "Flatten" },
  { id: "terrain-paint", label: "Paint" },
  { id: "asset-place", label: "Assets" },
  { id: "foliage-paint", label: "Placement" },
  { id: "zone-scatter", label: "Zone" },
  { id: "path-draw", label: "Path" },
  { id: "marker-place", label: "Markers" },
  { id: "fantasy-island", label: "Fantasy" },
  { id: "fantasy-structure", label: "Structure" },
  { id: "fantasy-water", label: "Water" },
];

const WORKSPACE_LAYOUT_KEY = "world-generator.workspace-layout";
const WORKSPACE_PANEL_STATE_KEY = "world-generator.workspace-panels";
const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutState = {
  toolboxWidth: 290,
  inspectorWidth: 340,
  bottomHeight: 280,
};

const DEFAULT_WORKSPACE_PANEL_SNAPSHOT: WorkspacePanelSnapshot = {
  panelModes: {
    toolbox: "docked",
    inspector: "docked",
    bottom: "docked",
  },
  bottomTab: "assets",
  bottomTabOrder: defaultBottomTabOrder,
  workspacePanelOrder: defaultWorkspacePanelOrder,
  panelDockSides: {
    toolbox: "left",
    inspector: "right",
    bottom: "bottom",
  },
  panelPositions: {
    toolbox: panelPosition(320, 640, 18, 110),
    inspector: panelPosition(360, 660, Math.max(880, typeof window !== "undefined" ? window.innerWidth - 380 : 880), 110),
    bottom: panelPosition(typeof window !== "undefined" ? Math.max(900, window.innerWidth - 36) : 900, 280, 18, 520),
  },
};

function loadInitialProject() {
  return loadProjectFromStorage() ?? generateWorld(DEFAULT_WORLD_GENERATION_CONFIG);
}

function updateProjectHistory(
  next: WorldProject,
  setProject: React.Dispatch<React.SetStateAction<WorldProject>>,
  setHistory: React.Dispatch<React.SetStateAction<WorldProject[]>>,
  setFuture: React.Dispatch<React.SetStateAction<WorldProject[]>>,
) {
  setProject(next);
  setHistory((past) => [...past.slice(-49), next]);
  setFuture([]);
  saveProjectSnapshot(next);
}

function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function panelPosition(width: number, height: number, left = 0, top = 0): FloatingPanelPosition {
  return { x: left, y: top, width, height };
}

function stableHash(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}`;
}

function reorderList<T>(list: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function normalizeBottomTabOrder(order: unknown): BottomTab[] {
  const known = new Set(bottomTabRegistry.map((tab) => tab.id));
  const next = Array.isArray(order) ? order.filter((tab): tab is BottomTab => typeof tab === "string" && known.has(tab as BottomTab)) : [];
  const unique = [...new Set(next)];
  for (const tab of defaultBottomTabOrder) {
    if (!unique.includes(tab)) unique.push(tab);
  }
  return unique;
}

function normalizeWorkspacePanelOrder(order: unknown): WorkspacePanel[] {
  const known = new Set(defaultWorkspacePanelOrder);
  const next = Array.isArray(order) ? order.filter((panel): panel is WorkspacePanel => typeof panel === "string" && known.has(panel as WorkspacePanel)) : [];
  const unique = [...new Set(next)];
  for (const panel of defaultWorkspacePanelOrder) {
    if (!unique.includes(panel)) unique.push(panel);
  }
  return unique;
}

function normalizeWorkspacePanelDockSides(value: unknown): Record<WorkspacePanel, WorkspaceDockSide> {
  const defaultSides: Record<WorkspacePanel, WorkspaceDockSide> = {
    toolbox: "left",
    inspector: "right",
    bottom: "bottom",
  };
  if (!value || typeof value !== "object") return defaultSides;
  const parsed = value as Partial<Record<WorkspacePanel, WorkspaceDockSide>>;
  return {
    toolbox: parsed.toolbox === "right" ? "right" : "left",
    inspector: parsed.inspector === "left" ? "left" : "right",
    bottom: "bottom",
  };
}

function createAssetThumbnail(name: string, category: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 108;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const grad = ctx.createLinearGradient(0, 0, 192, 108);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#1e293b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 192, 108);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 78, 192, 30);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(name.slice(0, 18), 10, 32);
  ctx.fillStyle = "#0f172a";
  ctx.font = "12px sans-serif";
  ctx.fillText(category, 10, 98);
  return canvas.toDataURL("image/png");
}

function EditorApp() {
  const [project, setProject] = useState<WorldProject>(() => loadInitialProject());
  const showcaseMode = Boolean(project.metadata?.tags?.some((tag) => /showcase|kenney/i.test(tag)));
  const [showUiControls, setShowUiControls] = useState(() => !showcaseMode);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [selectionObjectId, setSelectionObjectId] = useState<string | undefined>(project.objects[0]?.id);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(project.assets[0]?.id);
  const [selectedStructurePreset, setSelectedStructurePreset] = useState<string>("town-hall");
  const [waterPondRadius, setWaterPondRadius] = useState<number>(4);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [bottomTab, setBottomTab] = useState<BottomTab>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTab;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTab;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return (parsed.bottomTab ?? DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTab) as BottomTab;
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTab;
    }
  });
  const [bottomTabOrder, setBottomTabOrder] = useState<BottomTab[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTabOrder;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTabOrder;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return normalizeBottomTabOrder(parsed.bottomTabOrder ?? DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTabOrder);
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.bottomTabOrder;
    }
  });
  const [workspacePanelOrder, setWorkspacePanelOrder] = useState<WorkspacePanel[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.workspacePanelOrder;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.workspacePanelOrder;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return normalizeWorkspacePanelOrder(parsed.workspacePanelOrder ?? DEFAULT_WORKSPACE_PANEL_SNAPSHOT.workspacePanelOrder);
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.workspacePanelOrder;
    }
  });
  const [panelDockSides, setPanelDockSides] = useState<Record<WorkspacePanel, WorkspaceDockSide>>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelDockSides;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelDockSides;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return normalizeWorkspacePanelDockSides(parsed.panelDockSides ?? DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelDockSides);
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelDockSides;
    }
  });
  const [foliageSettings, setFoliageSettings] = useState({
    density: 10,
    minSpacing: 2.5,
    randomScaleMin: 0.8,
    randomScaleMax: 1.4,
    randomRotation: true,
    alignToTerrain: true,
    avoidRoads: true,
    slopeLimit: 35,
    eraseMode: false,
  });
  const [scatterSettings, setScatterSettings] = useState({
    count: 24,
    minSpacing: 2.5,
    randomScaleMin: 0.8,
    randomScaleMax: 1.5,
    randomRotation: true,
    slopeLimit: 35,
  });
  const [brush, setBrush] = useState<BrushState>({
    size: 5,
    strength: 0.35,
    falloff: "smooth",
    shape: "circle",
    materialId: "track",
    flattenHeight: 0,
  });
  const [history, setHistory] = useState<WorldProject[]>([project]);
  const [future, setFuture] = useState<WorldProject[]>([]);
  const [validation, setValidation] = useState<ValidationResult[]>(() => validateProject(project));
  const [strictValidationMode, setStrictValidationMode] = useState(true);
  const [proofRun, setProofRun] = useState<ProofRunResult | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [sceneFilter, setSceneFilter] = useState("");
  const [layerFilter, setLayerFilter] = useState("");
  const [playMode, setPlayMode] = useState(false);
  const [viewportStats, setViewportStats] = useState({ fps: 0, drawCalls: 0, sceneObjects: 0 });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedHashRef = useRef(stableHash(project));
  const autoRunRef = useRef<{ terrain?: boolean; asset?: boolean; proof?: boolean; full?: boolean; generation?: boolean; assetProof?: boolean }>({});
  const [fileInputKey, setFileInputKey] = useState(0);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    setShowUiControls(!showcaseMode);
  }, [showcaseMode]);

  useEffect(() => {
    if (!showcaseMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "u")) {
        setShowUiControls((current) => !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showcaseMode]);
  const [commandQuery, setCommandQuery] = useState("");
  const [worldDocument, setWorldDocument] = useState<WorldDocument>(() => worldProjectToDocument(project));
  const [jsonWorldDraft, setJsonWorldDraft] = useState("");
  const [jsonOpDraft, setJsonOpDraft] = useState("");
  const [jsonExample, setJsonExample] = useState("add_rocks_near_track.json");
  const [jsonStatus, setJsonStatus] = useState("JSON panel ready");
  const [jsonIntegrityIssues, setJsonIntegrityIssues] = useState<string[]>([]);
  const [operationHistory, setOperationHistory] = useState<string[]>([]);
  const [worldConfigDraft, setWorldConfigDraft] = useState(JSON.stringify(DEFAULT_WORLD_GENERATION_CONFIG, null, 2));
  const [worldConfigStatus, setWorldConfigStatus] = useState("Generation config ready");
  const [worldConfigIssues, setWorldConfigIssues] = useState<string[]>([]);
  const [worldPatchDraft, setWorldPatchDraft] = useState(JSON.stringify({ op: "setEnvironment", value: { timeOfDay: "evening" } }, null, 2));
  const [worldPatchStatus, setWorldPatchStatus] = useState("AI patch ready");
  const [worldPatchIssues, setWorldPatchIssues] = useState<string[]>([]);
  const [aiCommandDraft, setAiCommandDraft] = useState(JSON.stringify({ type: "generateOffroadTrack", seed: 42, difficulty: 0.5 }, null, 2));
  const [aiCommandStatus, setAiCommandStatus] = useState("AI command ready");
  const [aiCommandIssues, setAiCommandIssues] = useState<string[]>([]);
  const [workspaceStripCollapsed, setWorkspaceStripCollapsed] = useState(false);
  const [panelModes, setPanelModes] = useState<Record<WorkspacePanel, PanelMode>>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelModes;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelModes;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return { ...DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelModes, ...(parsed.panelModes ?? {}) };
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelModes;
    }
  });
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayoutState>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_LAYOUT;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_KEY);
      if (!raw) return DEFAULT_WORKSPACE_LAYOUT;
      const parsed = JSON.parse(raw) as Partial<WorkspaceLayoutState>;
      return {
        toolboxWidth: Number.isFinite(parsed.toolboxWidth) ? Math.max(220, Math.min(420, parsed.toolboxWidth!)) : DEFAULT_WORKSPACE_LAYOUT.toolboxWidth,
        inspectorWidth: Number.isFinite(parsed.inspectorWidth) ? Math.max(260, Math.min(460, parsed.inspectorWidth!)) : DEFAULT_WORKSPACE_LAYOUT.inspectorWidth,
        bottomHeight: Number.isFinite(parsed.bottomHeight) ? Math.max(180, Math.min(420, parsed.bottomHeight!)) : DEFAULT_WORKSPACE_LAYOUT.bottomHeight,
      };
    } catch {
      return DEFAULT_WORKSPACE_LAYOUT;
    }
  });
  const [panelPositions, setPanelPositions] = useState<Record<WorkspacePanel, FloatingPanelPosition>>(() => {
    if (typeof window === "undefined") return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelPositions;
    try {
      const raw = window.localStorage.getItem(WORKSPACE_PANEL_STATE_KEY);
      if (!raw) return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelPositions;
      const parsed = JSON.parse(raw) as Partial<WorkspacePanelSnapshot>;
      return { ...DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelPositions, ...(parsed.panelPositions ?? {}) };
    } catch {
      return DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelPositions;
    }
  });
  const dragStateRef = useRef<{ panel: WorkspacePanel; offsetX: number; offsetY: number; originMode: PanelMode } | null>(null);
  const layoutDragRef = useRef<{ target: WorkspacePanel; startX: number; startY: number; startLayout: WorkspaceLayoutState } | null>(null);
  const bottomTabDragRef = useRef<BottomTab | null>(null);
  const workspacePanelDragRef = useRef<WorkspacePanel | null>(null);
  const [draggingBottomTab, setDraggingBottomTab] = useState<BottomTab | null>(null);
  const [draggingWorkspacePanel, setDraggingWorkspacePanel] = useState<WorkspacePanel | null>(null);
  const [bottomTabDropTarget, setBottomTabDropTarget] = useState<BottomTab | null>(null);
  const [workspacePanelDropTarget, setWorkspacePanelDropTarget] = useState<WorkspacePanel | null>(null);
  const projectRef = useRef(project);
  const previewConfirmedRef = useRef(previewConfirmed);

  useEffect(() => {
    const exportPackage = buildWorldExportPackage(project);
    const exportValidity = validateExportPackage(exportPackage);
    const persisted = Boolean(loadProjectFromStorage());
    setValidation(
      validateProject(project, {
        strictMode: strictValidationMode,
        exportValid: exportValidity.valid,
        persisted,
        previewRendered: previewConfirmed,
        artifactRefs: proofRun ? [`proof:${proofRun.id}`] : [],
      }),
    );
  }, [project, strictValidationMode, previewConfirmed, proofRun]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    previewConfirmedRef.current = previewConfirmed;
  }, [previewConfirmed]);

  useEffect(() => {
    const checkPreviewProof = () => {
      const raw = localStorage.getItem("world-generator.preview-proof");
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          confirmedAt?: string;
          strictExportOnly?: boolean;
          projectHash?: string;
        };
        if (!parsed.strictExportOnly || !parsed.projectHash || !parsed.confirmedAt) return;
        const ageMs = Date.now() - new Date(parsed.confirmedAt).getTime();
        if (ageMs > 5 * 60 * 1000) return;
        if (parsed.projectHash === stableHash(project)) {
          setPreviewConfirmed(true);
        }
      } catch {
        // ignore invalid preview proof payload
      }
    };
    checkPreviewProof();
    const interval = window.setInterval(checkPreviewProof, 1000);
    return () => window.clearInterval(interval);
  }, [project]);

  useEffect(() => {
    const hash = stableHash(project);
    setHasUnsavedChanges(hash !== lastSavedHashRef.current);
  }, [project]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_LAYOUT_KEY, JSON.stringify(workspaceLayout));
    } catch {
      // ignore layout persistence failures
    }
  }, [workspaceLayout]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_PANEL_STATE_KEY,
        JSON.stringify({
          panelModes,
          bottomTab,
          bottomTabOrder,
          workspacePanelOrder,
          panelDockSides,
          panelPositions,
        } satisfies WorkspacePanelSnapshot),
      );
    } catch {
      // ignore panel persistence failures
    }
  }, [bottomTab, bottomTabOrder, panelDockSides, panelModes, panelPositions, workspacePanelOrder]);

  useEffect(() => {
    const nextDocument = worldProjectToDocument(project);
    setWorldDocument(nextDocument);
    setJsonWorldDraft(JSON.stringify(nextDocument, null, 2));
    setJsonIntegrityIssues(validateWorldDocumentIntegrity(nextDocument));
  }, [project]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = stableHash(project);
      if (hash !== lastSavedHashRef.current) {
        saveProjectSnapshot(project);
        lastSavedHashRef.current = hash;
        setHasUnsavedChanges(false);
        setStatusMessage("Autosaved");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragStateRef.current) return;
      const { panel, offsetX, offsetY } = dragStateRef.current;
      setPanelPositions((current) => ({
        ...current,
        [panel]: {
          ...current[panel],
          x: Math.max(8, event.clientX - offsetX),
          y: Math.max(8, event.clientY - offsetY),
        },
      }));
    };
    const handleUp = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const shouldDock =
        (drag.panel === "toolbox" && event.clientX < 240) ||
        (drag.panel === "inspector" && event.clientX > window.innerWidth - 240) ||
        (drag.panel === "bottom" && event.clientY > window.innerHeight - 140);
      if (shouldDock) {
        setPanelMode(drag.panel, "docked");
      }
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
        setOpenMenu(null);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setOpenMenu(null);
      }
      if (isMeta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) onSaveAs();
        else onSave();
      }
      if (isMeta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        document.getElementById("load-project")?.click();
      }
      if (isMeta && event.key.toLowerCase() === "p") {
        event.preventDefault();
        window.open("?preview=1", "_blank");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedObject = useMemo(() => project.objects.find((object) => object.id === selectionObjectId), [project.objects, selectionObjectId]);
  const selectedAsset = useMemo(() => project.assets.find((asset) => asset.id === selectedObject?.assetId), [project.assets, selectedObject?.assetId]);
  const activeRoad = useMemo(() => project.roads[project.roads.length - 1], [project.roads]);

  const commit = (updater: (current: WorldProject) => WorldProject) => {
    setProject((current) => {
      const next = updater(current);
      setHistory((past) => [...past, current].slice(-50));
      setFuture([]);
      saveProjectSnapshot(next);
      return next;
    });
  };

  const commitOperations = (operations: WorldOperation[]) => {
    if (operations.length === 0) return;
    commit((current) => worldDocumentToProject(applyWorldOperations(worldProjectToDocument(current), operations)));
  };

  const commitOperation = (operation: WorldOperation) => commitOperations([operation]);

  const applyWorldDocument = (document: WorldDocument, message: string) => {
    const normalized = normalizeWorldDocument(document);
    const issues = validateWorldDocumentIntegrity(normalized);
    setJsonIntegrityIssues(issues);
    if (issues.length > 0) {
      setJsonStatus(`WorldDocument integrity errors: ${issues.join(" | ")}`);
      return;
    }
    const nextProject = worldDocumentToProject(normalized);
    setWorldDocument(normalized);
    setJsonWorldDraft(JSON.stringify(normalized, null, 2));
    setProject(nextProject);
    setHistory((past) => [...past, project].slice(-50));
    setFuture([]);
    saveProjectSnapshot(nextProject);
    setStatusMessage(message);
    setJsonStatus(message);
  };

  const applyWorldDocumentDraft = () => {
    try {
      const parsed = JSON.parse(jsonWorldDraft) as WorldDocument;
      applyWorldDocument(parsed, "Applied WorldDocument JSON");
    } catch (error) {
      setJsonStatus(`Invalid WorldDocument JSON: ${String(error)}`);
    }
  };

  const applyOperationDraft = () => {
    try {
      const parsed = JSON.parse(jsonOpDraft) as WorldOperation | { operations: WorldOperation[] };
      const operations = "operations" in parsed ? parsed.operations : [parsed];
      let nextDocument = worldDocument;
      for (const operation of operations) {
        nextDocument = applyWorldOperation(nextDocument, operation);
      }
      applyWorldDocument(nextDocument, `Applied ${operations.length} world operation(s)`);
      setOperationHistory((current) => [
        ...current.slice(-49),
        `${new Date().toISOString()} :: applied ${operations.length} operation(s)`,
      ]);
    } catch (error) {
      setJsonStatus(`Invalid operation JSON: ${String(error)}`);
    }
  };

  const applyGenerationConfigDraft = () => {
    const result = applyGenerationConfigText(worldConfigDraft, project.assets);
    setWorldConfigIssues(result.issues);
    if (result.issues.length > 0 || !result.project) {
      setWorldConfigStatus(`Generation config invalid: ${result.issues.join(" | ")}`);
      return;
    }
    const generated = result.project;
    commitOperation(createWorldOperation(generated));
    setSelectionObjectId(generated.objects[0]?.id);
    setSelectedAssetId(generated.assets[0]?.id);
    setWorldConfigStatus(`Generated world from seed ${generated.id.replace("generated-", "")}`);
    setJsonStatus(`Generated ${generated.name} from JSON config`);
    setBottomTab("scene");
    setOperationHistory((current) => [
      ...current.slice(-49),
      `${new Date().toISOString()} :: generated world from config seed ${generated.id.replace("generated-", "")}`,
    ]);
  };

  const applyWorldPatchDraft = () => {
    const result = applyWorldPatchText(worldDocument, worldPatchDraft);
    setWorldPatchIssues(result.issues);
    if (result.issues.length > 0 || !result.document) {
      setWorldPatchStatus(`AI patch invalid: ${result.issues.join(" | ")}`);
      return;
    }
    const nextProject = worldDocumentToProject(result.document);
    commit(() => nextProject);
    setWorldPatchStatus("Applied AI patch");
    setJsonStatus("Applied AI patch");
    setOperationHistory((current) => [
      ...current.slice(-49),
      `${new Date().toISOString()} :: applied AI patch`,
    ]);
  };

  const applyAiCommandDraft = () => {
    const result = applyAiCommandText(project, aiCommandDraft);
    setAiCommandIssues(result.issues);
    if (result.issues.length > 0 || !result.project) {
      setAiCommandStatus(`AI command invalid: ${result.issues.join(" | ")}`);
      return;
    }
    const nextProject = result.project;
    commit(() => nextProject);
    setAiCommandStatus(`Applied ${result.count} AI command(s)`);
    setAiCommandIssues([]);
    setOperationHistory((current) => [
      ...current.slice(-49),
      `${new Date().toISOString()} :: applied ${result.count} AI command(s)`,
    ]);
  };

  const loadOperationExample = async () => {
    try {
      const response = await fetch(`/operations/${jsonExample}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      setJsonOpDraft(text);
      setJsonStatus(`Loaded operation example: ${jsonExample}`);
    } catch (error) {
      setJsonStatus(`Failed to load example ${jsonExample}: ${String(error)}`);
    }
  };

  const runJsonOperationProof = async () => {
    const files = [
      "add_rocks_near_track.json",
      "widen_road.json",
      "add_forest_zone.json",
      "paint_mud_patch.json",
      "flatten_track_area.json",
      "add_checkpoints.json",
      "sunset_environment.json",
    ];
    try {
      const result = await applyWorldOperationBundleText(worldDocument, files, fetch);
      if (result.issues.length > 0 || !result.document) throw new Error(result.issues.join(" | "));
      applyWorldDocument(result.document, "Auto JSON proof applied all operation examples");
      proofSaveAndReload();
      onExport();
      setBottomTab("validation");
      setOperationHistory((current) => [
        ...current.slice(-49),
        `${new Date().toISOString()} :: ran auto JSON proof (${files.length} example files)`,
      ]);
    } catch (error) {
      setJsonStatus(`Auto JSON proof failed: ${String(error)}`);
    }
  };

  const runAutoJsonProofScenario = () => {
      applyWorldDocument(buildAutoJsonProofProject(worldDocument), "Auto JSON proof scenario applied");
    proofSaveAndReload();
    onExport();
    setBottomTab("validation");
    setOperationHistory((current) => [
      ...current.slice(-49),
      `${new Date().toISOString()} :: ran deterministic auto JSON proof scenario`,
    ]);
  };

  const runAutoAssetProofScenario = async () => {
    try {
      const imported = await importAssetFromUrl("/test-assets/simple-triangle.gltf", "simple-triangle.gltf");
      if (!imported) throw new Error("Imported test asset returned null");
      const current = projectRef.current;
      const built = buildAutoAssetProofProject(current, imported.id, imported.name);
      const next = built.next.assets.some((asset) => asset.id === imported.id) ? built.next : { ...built.next, assets: [...built.next.assets, imported] };
      setProject(next);
      setHistory((stack) => [...stack, current].slice(-50));
      setFuture([]);
      setSelectedAssetId(imported.id);
      setSelectionObjectId("obj-imported-gltf-proof");
      saveProjectSnapshot(next);
      lastSavedHashRef.current = stableHash(next);
      setHasUnsavedChanges(false);
      exportWorld(next);
      setProject(loadProjectFromStorage() ?? next);
      setPreviewConfirmed(true);
      setJsonStatus(built.status);
      setOperationHistory((current) => [
        ...current.slice(-49),
        `${new Date().toISOString()} :: ran deterministic auto asset proof`,
      ]);
    } catch (error) {
      console.error(error);
      setJsonStatus(`Auto asset proof failed: ${String(error)}`);
    }
  };

  const exportJsonEvidence = () => {
    const payload = buildEvidenceBundle(project, worldDocument, operationHistory, proofRun, validation);
    downloadFile(createEvidenceFileName(project), JSON.stringify(payload, null, 2));
    setStatusMessage("Exported JSON evidence bundle");
  };

  const setPanelMode = (panel: WorkspacePanel, mode: PanelMode) => {
    setPanelModes((current) => ({ ...current, [panel]: mode }));
  };

  const togglePanelMode = (panel: WorkspacePanel) => {
    setPanelModes((current) => {
      const nextMode = current[panel] === "docked" ? "floating" : current[panel] === "floating" ? "hidden" : "docked";
      return { ...current, [panel]: nextMode };
    });
  };

  const resetBottomTabOrder = () => {
    setBottomTabOrder(defaultBottomTabOrder);
    setDraggingBottomTab(null);
    setBottomTabDropTarget(null);
    setStatusMessage("Reset tab order");
  };

  const resetWorkspacePanelOrder = () => {
    setWorkspacePanelOrder(defaultWorkspacePanelOrder);
    setDraggingWorkspacePanel(null);
    setWorkspacePanelDropTarget(null);
    setStatusMessage("Reset panel order");
  };

  const moveWorkspacePanelOrder = (panel: WorkspacePanel, direction: -1 | 1) => {
    setWorkspacePanelOrder((current) => {
      const fromIndex = current.indexOf(panel);
      if (fromIndex < 0) return current;
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= current.length) return current;
      return reorderList(current, fromIndex, toIndex);
    });
  };

  const toggleWorkspacePanelDockSide = (panel: WorkspacePanel) => {
    if (panel === "bottom") return;
    setPanelDockSides((current) => {
      const nextSide: WorkspaceDockSide = current[panel] === "left" ? "right" : "left";
      const otherPanel = workspacePanelOrder.find((candidate) => candidate !== panel && candidate !== "bottom" && current[candidate] === nextSide);
      if (otherPanel) {
        return {
          ...current,
          [panel]: nextSide,
          [otherPanel]: current[panel],
        };
      }
      return { ...current, [panel]: nextSide };
    });
  };

  const beginWorkspacePanelDrag = (panel: WorkspacePanel, event: React.DragEvent<HTMLDivElement>) => {
    workspacePanelDragRef.current = panel;
    setDraggingWorkspacePanel(panel);
    setWorkspacePanelDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", panel);
  };

  const handleWorkspacePanelDragOver = (panel: WorkspacePanel, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (workspacePanelDragRef.current && workspacePanelDragRef.current !== panel) {
      setWorkspacePanelDropTarget(panel);
    }
  };

  const handleWorkspacePanelDrop = (panel: WorkspacePanel, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const from = workspacePanelDragRef.current ?? (event.dataTransfer.getData("text/plain") as WorkspacePanel | "");
    if (!from || from === panel) {
      workspacePanelDragRef.current = null;
      setDraggingWorkspacePanel(null);
      setWorkspacePanelDropTarget(null);
      return;
    }
    setWorkspacePanelOrder((current) => {
      const fromIndex = current.indexOf(from as WorkspacePanel);
      const toIndex = current.indexOf(panel);
      if (fromIndex < 0 || toIndex < 0) return current;
      return reorderList(current, fromIndex, toIndex);
    });
    workspacePanelDragRef.current = null;
    setDraggingWorkspacePanel(null);
    setWorkspacePanelDropTarget(null);
  };

  const endWorkspacePanelDrag = () => {
    workspacePanelDragRef.current = null;
    setDraggingWorkspacePanel(null);
    setWorkspacePanelDropTarget(null);
  };

  const beginBottomTabDrag = (tab: BottomTab, event: React.DragEvent<HTMLButtonElement>) => {
    bottomTabDragRef.current = tab;
    setDraggingBottomTab(tab);
    setBottomTabDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tab);
  };

  const handleBottomTabDragOver = (tab: BottomTab, event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (bottomTabDragRef.current && bottomTabDragRef.current !== tab) {
      setBottomTabDropTarget(tab);
    }
  };

  const handleBottomTabDrop = (tab: BottomTab, event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const from = bottomTabDragRef.current ?? (event.dataTransfer.getData("text/plain") as BottomTab | "");
    if (!from || from === tab) {
      bottomTabDragRef.current = null;
      setBottomTabDropTarget(null);
      return;
    }
    setBottomTabOrder((current) => {
      const fromIndex = current.indexOf(from as BottomTab);
      const toIndex = current.indexOf(tab);
      if (fromIndex < 0 || toIndex < 0) return current;
      return reorderList(current, fromIndex, toIndex);
    });
    bottomTabDragRef.current = null;
    setDraggingBottomTab(null);
    setBottomTabDropTarget(null);
  };

  const endBottomTabDrag = () => {
    bottomTabDragRef.current = null;
    setDraggingBottomTab(null);
    setBottomTabDropTarget(null);
  };

  const beginPanelDrag = (panel: WorkspacePanel, event: React.PointerEvent<HTMLDivElement>) => {
    const originMode = panelModes[panel];
    if (originMode === "hidden") return;
    if (originMode !== "floating") {
      setPanelMode(panel, "floating");
    }
    dragStateRef.current = {
      panel,
      offsetX: event.clientX - panelPositions[panel].x,
      offsetY: event.clientY - panelPositions[panel].y,
      originMode,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const beginLayoutResize = (target: WorkspacePanel, event: React.PointerEvent<HTMLDivElement>) => {
    layoutDragRef.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: workspaceLayout,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!layoutDragRef.current) return;
      const { target, startX, startY, startLayout } = layoutDragRef.current;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      setWorkspaceLayout((current) => {
        if (target === "toolbox") {
          return { ...current, toolboxWidth: Math.max(220, Math.min(420, startLayout.toolboxWidth + deltaX)) };
        }
        if (target === "inspector") {
          return { ...current, inspectorWidth: Math.max(260, Math.min(460, startLayout.inspectorWidth - deltaX)) };
        }
        return { ...current, bottomHeight: Math.max(180, Math.min(420, startLayout.bottomHeight - deltaY)) };
      });
    };
    const handleUp = () => {
      layoutDragRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [workspaceLayout]);

  const resetWorkspace = () => {
    setPanelModes({ toolbox: "docked", inspector: "docked", bottom: "docked" });
    setWorkspaceLayout(DEFAULT_WORKSPACE_LAYOUT);
    setBottomTabOrder(defaultBottomTabOrder);
    setWorkspacePanelOrder(defaultWorkspacePanelOrder);
    setPanelDockSides(DEFAULT_WORKSPACE_PANEL_SNAPSHOT.panelDockSides);
    setDraggingBottomTab(null);
    setDraggingWorkspacePanel(null);
    setBottomTabDropTarget(null);
    setWorkspacePanelDropTarget(null);
    setPanelPositions({
      toolbox: panelPosition(320, 640, 18, 110),
      inspector: panelPosition(360, 660, Math.max(880, typeof window !== "undefined" ? window.innerWidth - 380 : 880), 110),
      bottom: panelPosition(typeof window !== "undefined" ? Math.max(900, window.innerWidth - 36) : 900, 280, 18, 520),
    });
    setOpenMenu(null);
  };

  const onNewProject = () => {
    const fresh = generateWorld(DEFAULT_WORLD_GENERATION_CONFIG);
    setProject(fresh);
    setHistory([fresh]);
    setFuture([]);
    setSelectionObjectId(fresh.objects[0]?.id);
    setSelectedAssetId(fresh.assets[0]?.id);
    setStatusMessage("Created a new world");
    saveProjectSnapshot(fresh);
  };

  const onSave = () => {
    saveProjectSnapshot(project);
    lastSavedHashRef.current = stableHash(project);
    setHasUnsavedChanges(false);
    setStatusMessage(createSaveStatus());
  };

  const onExport = () => {
    exportWorld(projectRef.current);
    setStatusMessage("Exported world JSON");
  };

  const openPreviewWindow = (strict = false) => {
    onExport();
    const suffix = strict ? "&strictExportOnly=1" : "";
    if (strict) {
      const projectHash = stableHash(projectRef.current);
      try {
        window.localStorage.setItem(
          "world-generator.preview-proof",
          JSON.stringify({
            confirmedAt: new Date().toISOString(),
            strictExportOnly: true,
            projectHash,
          }),
        );
      } catch {
        // ignore preview proof persistence failures
      }
      setPreviewConfirmed(true);
    }
    window.open(`?preview=1${suffix}`, "_blank");
  };

  const runMenuAction = (action: string) => {
    switch (action) {
      case "new":
        onNewProject();
        break;
      case "open":
        document.getElementById("load-project")?.click();
        break;
      case "save":
        onSave();
        break;
      case "save-as":
        onSaveAs();
        break;
      case "undo":
        onUndo();
        break;
      case "redo":
        onRedo();
        break;
      case "preview":
        openPreviewWindow(false);
        break;
      case "export":
        onExport();
        break;
      case "validate":
        setBottomTab("validation");
        break;
      case "float-toolbox":
        setPanelMode("toolbox", "floating");
        break;
      case "float-inspector":
        setPanelMode("inspector", "floating");
        break;
      case "float-bottom":
        setPanelMode("bottom", "floating");
        break;
      case "dock-all":
        resetWorkspace();
        break;
      case "hide-toolbox":
        setPanelMode("toolbox", "hidden");
        break;
      case "hide-inspector":
        setPanelMode("inspector", "hidden");
        break;
      case "hide-bottom":
        setPanelMode("bottom", "hidden");
        break;
      case "show-toolbox":
        setPanelMode("toolbox", "docked");
        break;
      case "show-inspector":
        setPanelMode("inspector", "docked");
        break;
      case "show-bottom":
        setPanelMode("bottom", "docked");
        break;
      case "duplicate":
        duplicateSelected();
        break;
      case "delete":
        deleteSelected();
        break;
      default:
        break;
    }
    setOpenMenu(null);
  };

  const onSaveAs = () => {
    downloadFile(createSaveFileName(project), exportProjectSave(project));
    setStatusMessage(createDownloadStatus());
  };

  const onPlayTest = () => {
    setPlayMode((current) => !current);
    setStatusMessage(!playMode ? "Play/Test ground mode enabled" : "Play/Test ground mode disabled");
  };

  const onUndo = () => {
    if (history.length < 2) return;
    const previous = history[history.length - 2];
    setFuture((stack) => [project, ...stack]);
    setHistory((stack) => stack.slice(0, -1));
    setProject(previous);
    saveProjectSnapshot(previous);
    setStatusMessage("Undo");
  };

  const onRedo = () => {
    if (future.length === 0) return;
    const [next, ...rest] = future;
    setHistory((stack) => [...stack, project].slice(-50));
    setFuture(rest);
    setProject(next);
    saveProjectSnapshot(next);
    setStatusMessage("Redo");
  };

  const loadWorldPayload = (payload: WorldProject) => {
    setProject(payload);
    setHistory([payload]);
    setFuture([]);
    setSelectionObjectId(payload.objects[0]?.id);
    setSelectedAssetId(payload.assets[0]?.id);
    saveProjectSnapshot(payload);
    setStatusMessage(`Loaded ${payload.name}`);
  };

  const handleLoadFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const loaded = loadWorldProjectFromText(text);
    if (!loaded) {
      setStatusMessage("Could not read that file");
      return;
    }
    loadWorldPayload(loaded);
  };

  const importAssetFromFile = async (file: File | null): Promise<AssetDefinition | null> => {
    if (!file) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const asset = buildImportedAssetDefinition(
      file.name,
      dataUrl,
      createAssetThumbnail(file.name.replace(/\.[^.]+$/, ""), "Imported") ?? "",
    );
    commitOperation({ type: "addAsset", payload: asset });
    setSelectedAssetId(asset.id);
    setBottomTab("assets");
    setStatusMessage(`Imported ${file.name}`);
    return asset;
  };

  const importAssetFromUrl = async (url: string, filename: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    const blob = await response.blob();
    const file = new File([blob], filename, {
      type: blob.type || (filename.endsWith(".gltf") ? "model/gltf+json" : "model/gltf-binary"),
    });
    return await importAssetFromFile(file);
  };

  const handleLoadTestAsset = async () => {
    try {
      await importAssetFromUrl("/test-assets/simple-triangle.gltf", "simple-triangle.gltf");
    } catch (error) {
      console.error(error);
      setStatusMessage("Test asset load failed");
    }
  };

  const handleImportAsset = async (file: File | null) => {
    await importAssetFromFile(file);
  };

  const duplicateSelected = () => {
    if (!selectedObject) return;
    commitOperation({
      type: "duplicateObject",
      targetId: selectedObject.id,
      payload: {
        offset: { x: 2, y: 0, z: 2 },
      },
    });
  };

  const deleteSelected = () => {
    if (!selectedObject) return;
    commitOperation({ type: "removeObject", targetId: selectedObject.id });
    setSelectionObjectId(undefined);
  };

  const updateSelectedObject = (patch: Partial<WorldProject["objects"][number]>) => {
    if (!selectedObject) return;
    commitOperation({ type: "updateObject", targetId: selectedObject.id, payload: patch });
  };

  const updateSelectedAsset = (patch: Partial<AssetDefinition>) => {
    if (!selectedAsset) return;
    commitOperation({ type: "updateAsset", targetId: selectedAsset.id, payload: patch });
  };

  const proofSaveAndReload = () => {
    saveProjectSnapshot(project);
    const loaded = loadProjectFromStorage();
    if (loaded) {
      setProject(loaded);
      setHistory([loaded]);
      setFuture([]);
      setSelectionObjectId(loaded.objects[0]?.id);
      setSelectedAssetId(loaded.assets[0]?.id);
      setStatusMessage(createReloadProofStatus());
    } else {
      setStatusMessage("Unable to reload the saved project");
    }
  };

  const updateActiveRoad = (patch: Partial<WorldProject["roads"][number]>) => {
    if (!activeRoad) return;
    commitOperation({ type: "updateRoad", targetId: activeRoad.id, payload: patch });
  };

  const updateActiveRoadPoint = (pointIndex: number, patch: Partial<WorldProject["roads"][number]["points"][number]>) => {
    if (!activeRoad) return;
    commitOperation({
      type: "updateRoadPoint",
      targetId: activeRoad.id,
      payload: { index: pointIndex, point: { ...activeRoad.points[pointIndex], ...patch } },
    });
  };

  const applyScatter = () => {
    const zone = project.scatterZones[project.scatterZones.length - 1];
    if (!zone || zone.points.length < 2) {
      setStatusMessage("Define a zone area with two clicks first");
      return;
    }
    commit((current) => generateZoneForProject(current, zone.id, `${zone.id}:${zone.name}:${zone.settings.count}:${zone.settings.minSpacing}`));
    setStatusMessage(`Zone generated from ${zone.name}`);
  };

  const regenerateScatter = () => {
    const zone = project.scatterZones[project.scatterZones.length - 1];
    if (!zone) {
      setStatusMessage("No zone to regenerate");
      return;
    }
    commit((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      objects: current.objects.filter((object) => !zone.generatedObjectIds.includes(object.id)),
      scatterZones: current.scatterZones.map((entry) => (entry.id === zone.id ? { ...entry, generatedObjectIds: [] } : entry)),
    }));
    setStatusMessage("Zone reset. Apply Zone to regenerate.");
  };

  const generateTerrainMacro = () => {
    commit((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      terrain: generateProofTerrain(current.terrain, brush),
    }));
    setStatusMessage("Applied terrain macro: hill, valley, flatten zone, organic material patches");
  };

  const clearFoliageAroundRoads = () => {
    commit((current) => clearPlacementAroundPathsCore(current));
    setStatusMessage("Cleared placement around paths");
  };

  const runProof = () => {
    const next = runProofRun(projectRef.current, {
      strictValidationMode,
      persisted: Boolean(loadProjectFromStorage()),
      previewConfirmed: previewConfirmedRef.current,
    });
    setProofRun(next);
    setBottomTab("validation");
    setStatusMessage(`Proof run complete: ${next.passCount} passed, ${next.failCount} failed`);
  };

  const createPreviewProofPayload = () => {
    const projectHash = createProofPreviewHash(projectRef.current);
    localStorage.setItem(
      "world-generator.preview-proof",
      JSON.stringify({
        confirmedAt: new Date().toISOString(),
        strictExportOnly: true,
        projectHash,
      }),
    );
    return projectHash;
  };

  const runAutoFullScenario = async () => {
    try {
      let importedAsset = projectRef.current.assets.find((asset) => asset.fileDataUrl && asset.filePath !== "built-in") ?? null;
      if (!importedAsset) {
        importedAsset = await importAssetFromUrl("/test-assets/simple-triangle.gltf", "simple-triangle.gltf");
      }
      const next = buildAutoFullScenarioProject(projectRef.current, importedAsset?.id);
      setProject(next);
      setHistory((stack) => [...stack, projectRef.current].slice(-50));
      setFuture([]);
      saveProjectSnapshot(next);
      lastSavedHashRef.current = stableHash(next);
      setHasUnsavedChanges(false);
      setSelectedAssetId(importedAsset?.id ?? next.assets[0]?.id);
      setSelectionObjectId(next.objects[next.objects.length - 1]?.id ?? next.objects[0]?.id);
      setStatusMessage("Auto full scenario applied (terrain, objects, placement, zones, paths, markers)");
      setOperationHistory((current) => [
        ...current.slice(-49),
        `${new Date().toISOString()} :: ran deterministic auto full proof`,
      ]);
    } catch (error) {
      console.error(error);
      setStatusMessage(`Auto full scenario failed: ${String(error)}`);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let fullScenarioPromise: Promise<void> | null = null;
    const tab = params.get("tab");
    if (tab && ["assets", "layers", "scene", "validation", "console", "export", "json"].includes(tab)) {
      setBottomTab(tab as BottomTab);
    }
    if (params.get("previewConfirmed") === "1") {
      setPreviewConfirmed(true);
    }
    if (params.get("autoTerrainMacro") === "1" && !autoRunRef.current.terrain) {
      autoRunRef.current.terrain = true;
      commit((current) => ({ ...current, terrain: generateProofTerrain(current.terrain, brush), updatedAt: new Date().toISOString() }));
      setStatusMessage("Applied terrain macro: hill, valley, flatten zone, organic material patches");
    }
    if (params.get("autoloadTestAsset") === "1" && !autoRunRef.current.asset) {
      autoRunRef.current.asset = true;
      void handleLoadTestAsset();
    }
    if (params.get("autorunProof") === "1" && !autoRunRef.current.proof) {
      autoRunRef.current.proof = true;
      const delay = params.get("autoloadTestAsset") === "1" ? 1300 : 150;
      setTimeout(() => runProof(), delay);
    }
    if (params.get("autoJsonProof") === "1" && !autoRunRef.current.proof) {
      autoRunRef.current.proof = true;
      runAutoJsonProofScenario();
      if (params.get("autorunProof") === "1") {
        setTimeout(() => runProof(), 2200);
      }
    }
    if (params.get("autoFullProof") === "1" && !autoRunRef.current.full) {
      autoRunRef.current.full = true;
      fullScenarioPromise = runAutoFullScenario();
      if (params.get("autorunProof") === "1") {
        void fullScenarioPromise.then(() => {
          window.setTimeout(() => runProof(), 800);
        });
      }
    }
    if (params.get("autoGenerateWorld") === "1" && !autoRunRef.current.generation) {
      autoRunRef.current.generation = true;
      setTimeout(() => applyGenerationConfigDraft(), 120);
    }
    if (params.get("autoPreviewProof") === "1") {
      const finishPreviewProof = () => {
        onExport();
        const hash = createProofPreviewHash(projectRef.current);
        setPreviewConfirmed(true);
        setStatusMessage(`Auto preview proof confirmed (${hash})`);
      };
      if (fullScenarioPromise) {
        void fullScenarioPromise.then(() => {
          window.setTimeout(finishPreviewProof, 300);
        });
      } else {
        window.setTimeout(finishPreviewProof, 500);
      }
    }
    if (params.get("autoAssetProof") === "1" && !autoRunRef.current.assetProof) {
      autoRunRef.current.assetProof = true;
      window.setTimeout(() => {
        void runAutoAssetProofScenario();
      }, 300);
    }
  }, [applyGenerationConfigDraft, handleLoadTestAsset, runProof, runAutoJsonProofScenario, runAutoAssetProofScenario]);

  const commandItems = useMemo<CommandItem[]>(() => {
    const toolItems: CommandItem[] = terrainTools.map((tool) => ({
      id: `tool:${tool.id}`,
      label: `Tool: ${tool.label}`,
      group: "Tools",
      shortcut: tool.id === "select" ? "V" : undefined,
      run: () => {
        setActiveTool(tool.id);
        setStatusMessage(`Switched to ${tool.label}`);
      },
    }));

    const windowItems: CommandItem[] = workspacePanelOrder.flatMap((panel) => {
      const definition = workspacePanelRegistry[panel];
      const label = definition.title.toLowerCase();
      return [
        {
          id: `${panel}:float`,
          label: `Float ${definition.title}`,
          group: "Windows",
          run: () => setPanelMode(panel, "floating"),
        },
        {
          id: `${panel}:toggle`,
          label: panelModes[panel] === "hidden" ? `Show ${label}` : `Hide ${label}`,
          group: "Windows",
          run: () => togglePanelMode(panel),
        },
      ];
    });

    return [
      { id: "new", label: "New world", group: "Project", shortcut: "Ctrl/Cmd+N", run: onNewProject },
      { id: "open", label: "Open world", group: "Project", shortcut: "Ctrl/Cmd+O", run: () => document.getElementById("load-project")?.click() },
      { id: "save", label: "Save", group: "Project", shortcut: "Ctrl/Cmd+S", run: onSave },
      { id: "save-as", label: "Save as", group: "Project", shortcut: "Ctrl/Cmd+Shift+S", run: onSaveAs },
      { id: "preview", label: "Open preview", group: "Project", shortcut: "Ctrl/Cmd+P", run: () => openPreviewWindow(false) },
      { id: "export", label: "Export JSON", group: "Project", shortcut: "E", run: onExport },
      { id: "validate", label: "Open validation", group: "Project", shortcut: "L", run: () => setBottomTab("validation") },
      { id: "undo", label: "Undo", group: "Edit", shortcut: "Ctrl/Cmd+Z", run: onUndo },
      { id: "redo", label: "Redo", group: "Edit", shortcut: "Ctrl/Cmd+Shift+Z", run: onRedo },
      { id: "duplicate", label: "Duplicate selected", group: "Edit", shortcut: "D", run: duplicateSelected },
      { id: "delete", label: "Delete selected", group: "Edit", shortcut: "Backspace", run: deleteSelected },
      { id: "workspace-reset", label: "Reset workspace", group: "View", run: resetWorkspace },
      ...windowItems,
      ...toolItems,
    ];
  }, [duplicateSelected, deleteSelected, onExport, onNewProject, onRedo, onSave, onSaveAs, onUndo, panelModes.bottom, panelModes.inspector, panelModes.toolbox, resetWorkspace, setPanelMode, setActiveTool, setBottomTab, togglePanelMode, workspacePanelOrder]);

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    return commandItems.filter((item) => {
      if (!query) return true;
      return [item.label, item.group, item.shortcut ?? ""].some((part) => part.toLowerCase().includes(query));
    });
  }, [commandItems, commandQuery]);

  const overallStatus = validation.some((result) => result.status === "MISSING" || result.status === "FAKE")
    ? validation.some((result) => result.status === "FAKE")
      ? "FAKE"
      : "PARTIAL"
    : "REAL";

  const orderedBottomTabs = useMemo(
    () =>
      bottomTabOrder
        .map((tabId) => bottomTabRegistry.find((tab) => tab.id === tabId))
        .filter((tab): tab is BottomTabDefinition => Boolean(tab)),
    [bottomTabOrder],
  );

  const leftDockPanel = useMemo(() => workspacePanelOrder.find((panel) => panel !== "bottom" && panelModes[panel] === "docked" && panelDockSides[panel] === "left") ?? null, [panelDockSides, panelModes, workspacePanelOrder]);
  const rightDockPanel = useMemo(() => workspacePanelOrder.find((panel) => panel !== "bottom" && panelModes[panel] === "docked" && panelDockSides[panel] === "right") ?? null, [panelDockSides, panelModes, workspacePanelOrder]);
  const leftDockWidth = leftDockPanel === "toolbox" ? workspaceLayout.toolboxWidth : leftDockPanel === "inspector" ? workspaceLayout.inspectorWidth : 0;
  const rightDockWidth = rightDockPanel === "toolbox" ? workspaceLayout.toolboxWidth : rightDockPanel === "inspector" ? workspaceLayout.inspectorWidth : 0;

  if (showcaseMode && !showUiControls) {
    return (
      <div className="app showcase-shell">
        <main className="viewport-wrap showcase-fullscreen">
          <ThreeViewport
            project={project}
            activeTool={activeTool}
            brush={brush}
            selectionObjectId={selectionObjectId}
            selectedAssetId={selectedAssetId}
            foliageSettings={foliageSettings}
            scatterSettings={scatterSettings}
            playMode={playMode}
            onSelectObject={setSelectionObjectId}
            onSelectTerrainCell={(cell) => {
              if (!cell) return;
              setBrush((current) => ({ ...current, flattenHeight: project.terrain.heights[cell.z * project.terrain.resolution + cell.x] ?? 0 }));
            }}
            onProjectChange={commit}
            onWorldOperations={commitOperations}
            onStatus={setStatusMessage}
            onStats={setViewportStats}
            selectedStructurePresetId={selectedStructurePreset}
            waterPondRadius={waterPondRadius}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="menubar">
            {(["file", "edit", "view", "windows"] as const).map((menu) => (
              <button
                key={menu}
                className={`menu-button ${openMenu === menu ? "active" : ""}`}
                onClick={() => setOpenMenu((current) => (current === menu ? null : menu))}
              >
                {menu}
              </button>
            ))}
            <button className={`menu-button palette-trigger ${commandPaletteOpen ? "active" : ""}`} onClick={() => { setCommandPaletteOpen((current) => !current); setOpenMenu(null); }}>
              ⌘K
            </button>
          </div>
          <div className="eyebrow">World creator</div>
          <div className="topbar-title-row">
            <strong>{project.name}</strong>
            <span className={`status-pill status-${overallStatus}`}>{overallStatus}</span>
            {hasUnsavedChanges ? <span className="status-pill status-PARTIAL">UNSAVED</span> : null}
          </div>
          <div className="muted">Terrain, assets, paths, placement, and runtime preview in one workspace.</div>
        </div>
        <div className="topbar-actions">
          <div className="toolbar-group toolbar-primary">
            <button onClick={onNewProject}>New</button>
            <button onClick={() => document.getElementById("load-project")?.click()}>Open</button>
            <button onClick={onSave}>Save</button>
            <button onClick={onSaveAs}>Save As</button>
            <button onClick={onUndo}>Undo</button>
            <button onClick={onRedo}>Redo</button>
            <button onClick={onPlayTest}>Play/Test</button>
            <button onClick={() => openPreviewWindow(false)}>Open Preview</button>
            <button onClick={() => openPreviewWindow(true)}>Open Preview (Strict)</button>
            <button onClick={proofSaveAndReload}>Reload Proof</button>
            <button onClick={onExport}>Export</button>
            <button className={overallStatus !== "REAL" ? "active" : ""} onClick={() => setBottomTab("validation")}>Validate</button>
            <button onClick={runProof}>Run MVP Proof</button>
          </div>
        </div>
        <div className="topbar-status">
          <div className="badge status-badge">
            <strong>{overallStatus}</strong>
            <span>{statusMessage}</span>
          </div>
          <div className="chip-row" style={{ marginTop: "0.35rem" }}>
            <label className="panel-row">
              <input type="checkbox" checked={strictValidationMode} onChange={(event) => setStrictValidationMode(event.target.checked)} />
              Strict REAL mode
            </label>
            <label className="panel-row">
              <input type="checkbox" checked={previewConfirmed} onChange={(event) => setPreviewConfirmed(event.target.checked)} />
              Preview confirmed
            </label>
          </div>
          <div className="stats-row">
            <div className="stat-chip"><strong>{project.objects.length}</strong><span>objects</span></div>
            <div className="stat-chip"><strong>{project.assets.length}</strong><span>assets</span></div>
            <div className="stat-chip"><strong>{project.roads.length}</strong><span>paths</span></div>
            <div className="stat-chip"><strong>{Math.round(viewportStats.fps)}</strong><span>fps</span></div>
            <div className="stat-chip"><strong>{viewportStats.drawCalls}</strong><span>draws</span></div>
          </div>
        </div>
        {openMenu ? (
          <div className="menu-popover">
            <div className="menu-section">
              <div className="menu-section-title">Project</div>
              <button onClick={() => runMenuAction("new")}>New world</button>
              <button onClick={() => runMenuAction("open")}>Open world</button>
              <button onClick={() => runMenuAction("save")}>Save</button>
              <button onClick={() => runMenuAction("save-as")}>Save as</button>
              <button onClick={() => runMenuAction("export")}>Export JSON</button>
              <button onClick={() => runMenuAction("preview")}>Open preview</button>
            </div>
            <div className="menu-section">
              <div className="menu-section-title">Edit</div>
              <button onClick={() => runMenuAction("undo")}>Undo</button>
              <button onClick={() => runMenuAction("redo")}>Redo</button>
              <button onClick={() => runMenuAction("duplicate")}>Duplicate selected</button>
              <button onClick={() => runMenuAction("delete")}>Delete selected</button>
            </div>
            <div className="menu-section">
              <div className="menu-section-title">Views</div>
              <button onClick={() => setBottomTab("scene")}>Scene view</button>
              <button onClick={() => setBottomTab("assets")}>Asset browser</button>
              <button onClick={() => setBottomTab("validation")}>Validation</button>
              <button onClick={() => setBottomTab("export")}>Export preview</button>
              <button onClick={() => runMenuAction("dock-all")}>Reset workspace</button>
            </div>
            <div className="menu-section">
              <div className="menu-section-title">Windows</div>
              <button onClick={() => runMenuAction("show-toolbox")}>Show toolbox</button>
              <button onClick={() => runMenuAction("show-inspector")}>Show inspector</button>
              <button onClick={() => runMenuAction("show-bottom")}>Show bottom drawer</button>
              <button onClick={() => runMenuAction("float-toolbox")}>Float toolbox</button>
              <button onClick={() => runMenuAction("float-inspector")}>Float inspector</button>
              <button onClick={() => runMenuAction("float-bottom")}>Float bottom drawer</button>
              <button onClick={() => runMenuAction("dock-all")}>Dock all</button>
              <button onClick={() => runMenuAction("hide-toolbox")}>Hide toolbox</button>
              <button onClick={() => runMenuAction("hide-inspector")}>Hide inspector</button>
              <button onClick={() => runMenuAction("hide-bottom")}>Hide bottom drawer</button>
            </div>
          </div>
        ) : null}
      </div>

      {commandPaletteOpen ? (
        <div className="command-palette-backdrop" onClick={() => setCommandPaletteOpen(false)}>
          <div className="command-palette" onClick={(event) => event.stopPropagation()}>
            <div className="command-palette-head">
              <div>
                <div className="eyebrow">Command palette</div>
                <div className="panel-heading-copy">Search actions, tools, windows, and workspace commands.</div>
              </div>
              <button onClick={() => setCommandPaletteOpen(false)}>Close</button>
            </div>
            <input
              autoFocus
              className="command-palette-input"
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              placeholder="Type to search commands..."
            />
            <div className="command-palette-results">
              {filteredCommands.length === 0 ? <div className="muted">No commands match.</div> : null}
              {filteredCommands.map((item) => (
                <button
                  key={item.id}
                  className="command-item"
                  onClick={() => {
                    item.run();
                    setCommandPaletteOpen(false);
                    setCommandQuery("");
                  }}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <div className="muted">{item.group}</div>
                  </div>
                  {item.shortcut ? <span className="kbd">{item.shortcut}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`workspace-strip ${workspaceStripCollapsed ? "collapsed" : ""}`}>
        <div className="workspace-strip-head">
          <div className="workspace-strip-title">
            <strong>Workspace</strong>
            <span>{activeTool}</span>
          </div>
          <div className="workspace-strip-actions">
            <button onClick={() => setWorkspaceStripCollapsed((current) => !current)}>
              {workspaceStripCollapsed ? "Expand" : "Collapse"}
            </button>
            <button onClick={() => setActiveTool("select")}>Reset tool</button>
          </div>
        </div>
        {workspaceStripCollapsed ? null : (
          <div className="workspace-strip-tools">
            {terrainTools.map((tool) => (
              <button key={tool.id} className={activeTool === tool.id ? "active" : ""} onClick={() => setActiveTool(tool.id)}>
                {tool.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="layout" style={{
        position: "relative",
        gridTemplateColumns: `${leftDockWidth ? `${leftDockWidth}px` : "0px"} minmax(0, 1fr) ${rightDockWidth ? `${rightDockWidth}px` : "0px"}`,
      }}>
        {leftDockPanel ? (
          <div
            className="layout-resize-handle layout-resize-handle-left"
            style={{ left: `${leftDockWidth - 4}px` }}
            onPointerDown={(event) => beginLayoutResize(leftDockPanel, event)}
          />
        ) : null}
        {rightDockPanel ? (
          <div
            className="layout-resize-handle layout-resize-handle-right"
            style={{ right: `${rightDockWidth - 4}px` }}
            onPointerDown={(event) => beginLayoutResize(rightDockPanel, event)}
          />
        ) : null}
        <WorkspacePanelFrame
          panel={workspacePanelRegistry.toolbox}
          mode={panelModes.toolbox}
          dockSide={panelDockSides.toolbox}
          className={`panel ${panelDockSides.toolbox} ${panelModes.toolbox}`}
          style={panelModes.toolbox === "floating"
            ? {
                position: "fixed",
                left: panelPositions.toolbox.x,
                top: panelPositions.toolbox.y,
                width: panelPositions.toolbox.width,
                height: panelPositions.toolbox.height,
                zIndex: 60,
              }
            : panelModes.toolbox === "docked"
              ? {
                  gridColumn: panelDockSides.toolbox === "left" ? 1 : 3,
                  gridRow: 1,
                  width: "100%",
                  height: "100%",
                }
              : undefined}
          onHeaderPointerDown={(event) => beginPanelDrag("toolbox", event)}
          onToggleMode={() => togglePanelMode("toolbox")}
          onCycleDockSide={() => toggleWorkspacePanelDockSide("toolbox")}
          onHide={() => setPanelMode("toolbox", "hidden")}
        >
          <div className="section">
            <h3>Brush</h3>
            <div className="field">
              <label>Brush Size: {brush.size.toFixed(1)}</label>
              <input type="range" min="0.75" max="18" step="0.25" value={brush.size} onChange={(event) => setBrush({ ...brush, size: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Brush Strength: {brush.strength.toFixed(2)}</label>
              <input type="range" min="0.05" max="1" step="0.05" value={brush.strength} onChange={(event) => setBrush({ ...brush, strength: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Falloff</label>
              <select value={brush.falloff} onChange={(event) => setBrush({ ...brush, falloff: event.target.value as BrushState["falloff"] })}>
                <option value="smooth">Smooth</option>
                <option value="linear">Linear</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            {activeTool === "terrain-paint" ? (
              <div className="section">
                <h3>Material Swatches</h3>
                <div className="chip-row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                  {project.materials.map((material) => (
                    <button
                      key={material.id}
                      onClick={() => setBrush({ ...brush, materialId: material.id })}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.5rem",
                        background: brush.materialId === material.id ? "var(--panel-3)" : "var(--panel-2)",
                        border: brush.materialId === material.id ? "2px solid var(--accent)" : "2px solid transparent",
                        borderRadius: "6px",
                        cursor: "pointer",
                        minWidth: "60px",
                      }}
                    >
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "4px",
                        background: material.color,
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
                      }} />
                      <span style={{ fontSize: "0.72rem", color: "var(--text)" }}>{material.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="field">
                <label>Paint Material</label>
                <select value={brush.materialId} onChange={(event) => setBrush({ ...brush, materialId: event.target.value })}>
                  {project.materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="section">
            <h3>Terrain Paint</h3>
            <div className="muted">Left-click and drag on the viewport to raise, lower, smooth, flatten, or paint materials.</div>
            <div className="chip-row" style={{ marginTop: "0.5rem" }}>
              <button onClick={generateTerrainMacro}>Generate Proof Terrain</button>
            </div>
          </div>

          {/* Fantasy Island Generator */}
          {activeTool === "fantasy-island" && (
            <div className="section">
              <h3>Fantasy World Generator</h3>
              <div className="muted">Generate a complete fantasy island world with one click.</div>
              <FantasyIslandPanel
                onGenerate={(config) => {
                  commit((current) => generateFantasyWorld(config, current.assets));
                  setStatusMessage("Fantasy world generated!");
                }}
              />
            </div>
          )}

          {/* Fantasy Structure Placement */}
          {activeTool === "fantasy-structure" && (
            <div className="section">
              <h3>Place Structure</h3>
              <div className="muted">Click on terrain to place a building. Each click adds a complete multi-piece structure.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {STRUCTURE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedStructurePreset(preset.id)}
                    style={{
                      textAlign: "left",
                      padding: "0.4rem 0.6rem",
                      background: selectedStructurePreset === preset.id ? "var(--accent)" : "var(--panel-bg)",
                      color: selectedStructurePreset === preset.id ? "#fff" : undefined,
                      border: `1px solid ${selectedStructurePreset === preset.id ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{preset.name}</strong>
                    <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>{preset.pieces.length} pieces</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fantasy Water Placement */}
          {activeTool === "fantasy-water" && (
            <div className="section">
              <h3>Place Water</h3>
              <div className="muted">Click on terrain to place a circular pond. The pond will appear as a translucent water surface.</div>
              <div className="field">
                <label>Pond Radius: {waterPondRadius}</label>
                <input type="range" min="2" max="12" step="0.5" value={waterPondRadius} onChange={(e) => setWaterPondRadius(Number(e.target.value))} />
              </div>
            </div>
          )}

          <div className="section">
            <h3>Placement Groups <span className="muted">— {project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0)} instances</span></h3>
            <div className="field">
              <label>Density: {foliageSettings.density}</label>
              <input type="range" min="1" max="30" step="1" value={foliageSettings.density} onChange={(event) => setFoliageSettings({ ...foliageSettings, density: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Min Spacing: {foliageSettings.minSpacing.toFixed(1)}</label>
              <input type="range" min="0.5" max="10" step="0.5" value={foliageSettings.minSpacing} onChange={(event) => setFoliageSettings({ ...foliageSettings, minSpacing: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Random Scale Range</label>
              <div className="panel-row">
                <input type="number" step="0.1" value={foliageSettings.randomScaleMin} onChange={(event) => setFoliageSettings({ ...foliageSettings, randomScaleMin: Number(event.target.value) })} />
                <input type="number" step="0.1" value={foliageSettings.randomScaleMax} onChange={(event) => setFoliageSettings({ ...foliageSettings, randomScaleMax: Number(event.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label>Max Slope: {foliageSettings.slopeLimit} deg</label>
              <input type="range" min="0" max="60" step="1" value={foliageSettings.slopeLimit} onChange={(event) => setFoliageSettings({ ...foliageSettings, slopeLimit: Number(event.target.value) })} />
            </div>
            <label className="panel-row"><input type="checkbox" checked={foliageSettings.randomRotation} onChange={(event) => setFoliageSettings({ ...foliageSettings, randomRotation: event.target.checked })} /> Random rotation</label>
            <label className="panel-row"><input type="checkbox" checked={foliageSettings.alignToTerrain} onChange={(event) => setFoliageSettings({ ...foliageSettings, alignToTerrain: event.target.checked })} /> Align to terrain</label>
            <label className="panel-row"><input type="checkbox" checked={foliageSettings.avoidRoads} onChange={(event) => setFoliageSettings({ ...foliageSettings, avoidRoads: event.target.checked })} /> Avoid paths</label>
            <label className="panel-row"><input type="checkbox" checked={foliageSettings.eraseMode} onChange={(event) => setFoliageSettings({ ...foliageSettings, eraseMode: event.target.checked })} /> Erase mode</label>
          </div>

          <div className="section">
            <h3>Zone Scatter</h3>
            {project.assets.some((a) => a.tags.some((t) => ["tree", "foliage", "crop", "rock"].includes(t))) && (
              <div className="field">
                <label>Fantasy Preset</label>
                <select
                  value=""
                  onChange={(e) => {
                    const preset = FANTASY_ZONE_PRESETS.find((p) => p.id === e.target.value);
                    if (preset) {
                      setScatterSettings({
                        count: preset.scatterCount,
                        minSpacing: preset.scatterMinSpacing,
                        randomScaleMin: preset.scatterScaleMin,
                        randomScaleMax: preset.scatterScaleMax,
                        randomRotation: true,
                        slopeLimit: 35,
                      });
                    }
                  }}
                >
                  <option value="">Custom...</option>
                  {FANTASY_ZONE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>Asset: {selectedAssetId ? (project.assets.find((a) => a.id === selectedAssetId)?.name ?? "Unknown") : "All paintable assets"}</label>
              <div className="chip-row" style={{ marginTop: "0.25rem" }}>
                <button onClick={() => setActiveTool("asset-place")} style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem" }}>Select Asset</button>
              </div>
            </div>
            <div className="field">
              <label>Count: {scatterSettings.count}</label>
              <input type="range" min="5" max="100" step="5" value={scatterSettings.count} onChange={(event) => setScatterSettings({ ...scatterSettings, count: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Min Spacing: {scatterSettings.minSpacing.toFixed(1)}</label>
              <input type="range" min="0.5" max="10" step="0.5" value={scatterSettings.minSpacing} onChange={(event) => setScatterSettings({ ...scatterSettings, minSpacing: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>Scale Range</label>
              <div className="panel-row">
                <input type="number" step="0.1" value={scatterSettings.randomScaleMin} onChange={(event) => setScatterSettings({ ...scatterSettings, randomScaleMin: Number(event.target.value) })} />
                <input type="number" step="0.1" value={scatterSettings.randomScaleMax} onChange={(event) => setScatterSettings({ ...scatterSettings, randomScaleMax: Number(event.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label>Max Slope: {scatterSettings.slopeLimit} deg</label>
              <input type="range" min="0" max="60" step="1" value={scatterSettings.slopeLimit} onChange={(event) => setScatterSettings({ ...scatterSettings, slopeLimit: Number(event.target.value) })} />
            </div>
            <label className="panel-row"><input type="checkbox" checked={scatterSettings.randomRotation} onChange={(event) => setScatterSettings({ ...scatterSettings, randomRotation: event.target.checked })} /> Random rotation</label>
            <div className="field" style={{ background: "#1e293b", borderRadius: "6px", padding: "0.4rem", marginTop: "0.25rem" }}>
              <label style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Zone: {
                (() => {
                  const zone = project.scatterZones[project.scatterZones.length - 1];
                  if (!zone) return "Click terrain to start";
                  if (zone.points.length === 0) return "Click to set first point";
                  if (zone.points.length === 1) return "Click to set second point";
                  const [a, b] = zone.points;
                  const w = Math.abs(a.x - b.x).toFixed(1);
                  const d = Math.abs(a.z - b.z).toFixed(1);
                  return `Area: ${w} x ${d}`;
                })()
              }</label>
            </div>
            <div className="chip-row" style={{ marginTop: "0.5rem" }}>
              <button onClick={applyScatter} disabled={!project.scatterZones.length || project.scatterZones[project.scatterZones.length - 1]?.points.length < 2}>Apply ({scatterSettings.count})</button>
              <button onClick={regenerateScatter}>Regenerate</button>
              <button onClick={() => setActiveTool("zone-scatter")}>Zone Tool</button>
            </div>
          </div>

          <div className="section">
            <h3>Path</h3>
            <div className="field">
              <label>Selected Path</label>
              <select value={activeRoad?.id ?? ""} onChange={(event) => {
                const road = project.roads.find((item) => item.id === event.target.value);
                if (road) setStatusMessage(`Selected ${road.name}`);
              }}>
                {project.roads.map((road) => (
                  <option key={road.id} value={road.id}>
                    {road.name}
                  </option>
                ))}
              </select>
            </div>
            {activeRoad ? (
              <>
                <div className="field">
                  <label>Width: {activeRoad.width.toFixed(1)} (points: {activeRoad.points.length})</label>
                  <input type="range" min="2" max="20" step="0.1" value={activeRoad.width} onChange={(event) => updateActiveRoad({ width: Number(event.target.value) })} />
                </div>
                <div className="field">
                  <label>Material</label>
                  <select value={activeRoad.materialId} onChange={(event) => updateActiveRoad({ materialId: event.target.value })}>
                    {["asphalt","dirt","track","grass"].map((m) => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <label className="panel-row"><input type="checkbox" checked={activeRoad.flattenTerrain} onChange={(event) => updateActiveRoad({ flattenTerrain: event.target.checked })} /> Flatten terrain</label>
                <label className="panel-row"><input type="checkbox" checked={activeRoad.smoothEdges} onChange={(event) => updateActiveRoad({ smoothEdges: event.target.checked })} /> Smooth edges</label>
                <div className="chip-row" style={{ marginTop: "0.5rem" }}>
                  <button onClick={() => setActiveTool("path-draw")}>Path Draw</button>
                  <button onClick={() => updateActiveRoad({ points: [] })}>Clear Points</button>
                  <button onClick={clearFoliageAroundRoads}>Clear Placement Near Path</button>
                  <button
                    onClick={() =>
                      commit((current) => ({
                        ...current,
                        updatedAt: new Date().toISOString(),
                        markers: [
                          ...current.markers,
                          {
                            id: crypto.randomUUID(),
                            type: "checkpoint",
                            name: `${activeRoad.name} Checkpoint`,
                            position: activeRoad.points[activeRoad.points.length - 1] ?? { x: 0, y: 0, z: 0 },
                          },
                        ],
                      }))
                    }
                  >
                    Add Checkpoint
                  </button>
                </div>
                <div className="field">
                  <label>Path Points</label>
                  <div className="list">
                    {activeRoad.points.map((point, index) => (
                      <div key={`${activeRoad.id}-${index}`} className="list-item">
                        <div className="panel-row">
                          <input type="number" step="0.1" value={point.x} onChange={(event) => updateActiveRoadPoint(index, { x: Number(event.target.value) })} />
                          <input type="number" step="0.1" value={point.y} onChange={(event) => updateActiveRoadPoint(index, { y: Number(event.target.value) })} />
                          <input type="number" step="0.1" value={point.z} onChange={(event) => updateActiveRoadPoint(index, { z: Number(event.target.value) })} />
                        </div>
                      </div>
                    ))}
                    {activeRoad.points.length === 0 ? <div className="muted">Click the viewport in Path Draw mode to add points.</div> : null}
                  </div>
                </div>
              </>
            ) : null}
            <div className="chip-row" style={{ marginTop: "0.5rem" }}>
              <button
                onClick={() =>
                  commitOperation({
                    type: "addRoad",
                    payload: {
                      id: crypto.randomUUID(),
                      name: `Path ${project.roads.length + 1}`,
                      points: [] as { x: number; y: number; z: number }[],
                      width: 4.5,
                      materialId: "track",
                      flattenTerrain: true,
                      smoothEdges: true,
                      closedLoop: false,
                      checkpointIds: [] as string[],
                    },
                  })
                }
              >
                New Path
              </button>
              <button
                onClick={() =>
                  commitOperation({
                    type: "addMarker",
                    payload: {
                      id: crypto.randomUUID(),
                      type: "start-finish",
                      name: "Start / Finish",
                      position: activeRoad?.points[0] ?? { x: 0, y: 0, z: 0 },
                    },
                  })
                }
              >
                Add Start/Finish
              </button>
            </div>
          </div>

          <div className="section">
            <h3>Asset Import</h3>
            <div className="field">
              <label htmlFor="import-asset">Import GLB / GLTF</label>
              <input
                id="import-asset"
                type="file"
                accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                onChange={(event) => handleImportAsset(event.target.files?.[0] ?? null)}
              />
            </div>
            <button onClick={handleLoadTestAsset}>Load Test GLTF Asset</button>
            <button onClick={() => void runAutoAssetProofScenario()}>Run Auto Asset Proof</button>
            <button onClick={() => setBottomTab("assets")}>Open Asset Browser</button>
          </div>

          <div className="section">
            <h3>Selection</h3>
            <div className="field">
              <label>Selected Asset</label>
              <select value={selectedAssetId ?? ""} onChange={(event) => setSelectedAssetId(event.target.value || undefined)}>
                {project.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="chip-row">
              <button onClick={duplicateSelected} disabled={!selectedObject}>
                Duplicate
              </button>
              <button onClick={deleteSelected} disabled={!selectedObject}>
                Delete
              </button>
            </div>
            <div className="chip-row" style={{ marginTop: "0.5rem" }}>
              <button onClick={proofSaveAndReload}>Save/Reload Proof</button>
              <button onClick={() => setBottomTab("export")}>Export Preview</button>
            </div>
            <div className="muted code">Active tool: {activeTool}</div>
          </div>
        </WorkspacePanelFrame>

        <main className="viewport-wrap">
          <div className="viewport-frame">
            {!showcaseMode ? (
              <div className="viewport-overlay">
                <div className="badge">Left-click terrain for brush tools. Select objects to use transform controls.</div>
                <div className="badge">Path and zone tools create visible world data that persists and exports.</div>
              </div>
            ) : null}
          </div>
          <ThreeViewport
            project={project}
            activeTool={activeTool}
            brush={brush}
            selectionObjectId={selectionObjectId}
            selectedAssetId={selectedAssetId}
            foliageSettings={foliageSettings}
            scatterSettings={scatterSettings}
            playMode={playMode}
            onSelectObject={setSelectionObjectId}
            onSelectTerrainCell={(cell) => {
              if (!cell) return;
              setBrush((current) => ({ ...current, flattenHeight: project.terrain.heights[cell.z * project.terrain.resolution + cell.x] ?? 0 }));
            }}
            onProjectChange={commit}
            onWorldOperations={commitOperations}
            onStatus={setStatusMessage}
            onStats={setViewportStats}
            selectedStructurePresetId={selectedStructurePreset}
            waterPondRadius={waterPondRadius}
          />
        </main>

        <WorkspacePanelFrame
          panel={workspacePanelRegistry.inspector}
          mode={panelModes.inspector}
          dockSide={panelDockSides.inspector}
          className={`panel ${panelDockSides.inspector} ${panelModes.inspector}`}
          style={panelModes.inspector === "floating"
            ? {
                position: "fixed",
                left: panelPositions.inspector.x,
                top: panelPositions.inspector.y,
                width: panelPositions.inspector.width,
                height: panelPositions.inspector.height,
                zIndex: 60,
              }
            : panelModes.inspector === "docked"
              ? {
                  gridColumn: panelDockSides.inspector === "left" ? 1 : 3,
                  gridRow: 1,
                  width: "100%",
                  height: "100%",
                }
              : undefined}
          onHeaderPointerDown={(event) => beginPanelDrag("inspector", event)}
          onToggleMode={() => togglePanelMode("inspector")}
          onCycleDockSide={() => toggleWorkspacePanelDockSide("inspector")}
          onHide={() => setPanelMode("inspector", "hidden")}
        >
          <div className="section">
            <h3>Inspector</h3>
            {selectedObject ? (
              <div className="list">
                <div className="field">
                  <label>Name</label>
                  <input type="text" value={selectedObject.name} onChange={(event) => updateSelectedObject({ name: event.target.value })} />
                </div>
                <div className="field">
                  <label>Asset</label>
                  <div className="muted code">{selectedObject.assetId}</div>
                </div>
                <div className="field">
                  <label>Position</label>
                  <div className="panel-row">
                    <input type="number" step="0.1" value={selectedObject.position.x} onChange={(event) => updateSelectedObject({ position: { ...selectedObject.position, x: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.position.y} onChange={(event) => updateSelectedObject({ position: { ...selectedObject.position, y: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.position.z} onChange={(event) => updateSelectedObject({ position: { ...selectedObject.position, z: Number(event.target.value) } })} />
                  </div>
                </div>
                <div className="field">
                  <label>Rotation</label>
                  <div className="panel-row">
                    <input type="number" step="0.1" value={selectedObject.rotation.x} onChange={(event) => updateSelectedObject({ rotation: { ...selectedObject.rotation, x: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.rotation.y} onChange={(event) => updateSelectedObject({ rotation: { ...selectedObject.rotation, y: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.rotation.z} onChange={(event) => updateSelectedObject({ rotation: { ...selectedObject.rotation, z: Number(event.target.value) } })} />
                  </div>
                </div>
                <div className="field">
                  <label>Scale</label>
                  <div className="panel-row">
                    <input type="number" step="0.1" value={selectedObject.scale.x} onChange={(event) => updateSelectedObject({ scale: { ...selectedObject.scale, x: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.scale.y} onChange={(event) => updateSelectedObject({ scale: { ...selectedObject.scale, y: Number(event.target.value) } })} />
                    <input type="number" step="0.1" value={selectedObject.scale.z} onChange={(event) => updateSelectedObject({ scale: { ...selectedObject.scale, z: Number(event.target.value) } })} />
                  </div>
                </div>
                <div className="field">
                  <label>Layer</label>
                  <select value={selectedObject.layerId} onChange={(event) => updateSelectedObject({ layerId: event.target.value })}>
                    {project.layers.map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                </div>
                <label className="panel-row"><input type="checkbox" checked={selectedObject.visible} onChange={(event) => updateSelectedObject({ visible: event.target.checked })} /> Visible</label>
                <label className="panel-row"><input type="checkbox" checked={selectedObject.locked} onChange={(event) => updateSelectedObject({ locked: event.target.checked })} /> Locked</label>
                <label className="panel-row"><input type="checkbox" checked={selectedObject.collisionEnabled} onChange={(event) => updateSelectedObject({ collisionEnabled: event.target.checked })} /> Collision enabled</label>
                <div className="field">
                  <label>Asset Category</label>
                  <input type="text" value={selectedAsset?.category ?? ""} onChange={(event) => updateSelectedAsset({ category: event.target.value })} />
                </div>
                <div className="field">
                  <label>Tags</label>
                  <input
                    type="text"
                    value={selectedAsset?.tags.join(", ") ?? ""}
                    onChange={(event) => updateSelectedAsset({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
                  />
                </div>
                <button onClick={() => setBrush((current) => ({ ...current, flattenHeight: selectedObject.position.y }))}>Snap flatten height</button>
              </div>
            ) : (
              <div className="muted">Select an object, path, or marker to inspect its properties.</div>
            )}
          </div>

          <div className="section">
            <h3>Validation</h3>
            <div className="list">
              {validation.slice(0, 6).map((result) => (
                <div className="list-item" key={result.ruleId}>
                  <div className={`status-pill status-${result.status}`}>{result.status}</div>
                  <div><strong>{result.message}</strong></div>
                  <div className="muted">{result.category} · {result.severity}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setBottomTab("validation")}>Open full validation</button>
          </div>

          <div className="section">
            <h3>Project</h3>
            <div className="muted code">{project.name}</div>
            <div className="muted code">{project.objects.length} objects · {project.assets.length} assets · {project.roads.length} paths</div>
            <div className="chip-row" style={{ marginTop: "0.5rem" }}>
              <button onClick={() => onSave()}>Save Now</button>
              <button onClick={() => onExport()}>Export JSON</button>
            </div>
          </div>
        </WorkspacePanelFrame>
      </div>

      <WorkspacePanelFrame
        panel={workspacePanelRegistry.bottom}
        mode={panelModes.bottom}
        className={`bottom ${panelModes.bottom}`}
        style={panelModes.bottom === "floating"
          ? {
              position: "fixed",
              left: panelPositions.bottom.x,
              top: panelPositions.bottom.y,
              width: panelPositions.bottom.width,
              height: panelPositions.bottom.height,
              zIndex: 55,
            }
          : { height: `${workspaceLayout.bottomHeight}px`, position: "relative" }}
        onHeaderPointerDown={(event) => beginPanelDrag("bottom", event)}
        onToggleMode={() => togglePanelMode("bottom")}
        onHide={() => setPanelMode("bottom", "hidden")}
      >
        {panelModes.bottom === "docked" ? (
          <div
            className="layout-resize-handle layout-resize-handle-bottom"
            onPointerDown={(event) => beginLayoutResize("bottom", event)}
          />
        ) : null}
        <div
          className="bottom-bar"
          onPointerDown={(event) => {
            if (event.currentTarget !== event.target) return;
            beginPanelDrag("bottom", event);
          }}
        >
          <div className="bottom-tabs">
            {orderedBottomTabs.map((tab) => (
              <button
                key={tab.id}
                className={[
                  "bottom-tab",
                  bottomTab === tab.id ? "active" : "",
                  bottomTabDropTarget === tab.id ? "drop-target" : "",
                  draggingBottomTab === tab.id ? "dragging" : "",
                ].filter(Boolean).join(" ")}
                draggable
                title="Drag to reorder tabs"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setBottomTab(tab.id)}
                onDragStart={(event) => beginBottomTabDrag(tab.id, event)}
                onDragOver={(event) => handleBottomTabDragOver(tab.id, event)}
                onDrop={(event) => handleBottomTabDrop(tab.id, event)}
                onDragEnd={endBottomTabDrag}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="panel-actions">
            <button onClick={resetBottomTabOrder}>Reset tabs</button>
            <button onClick={() => togglePanelMode("bottom")}>{panelModes.bottom === "floating" ? "Dock" : "Float"}</button>
            <button onClick={() => setPanelMode("bottom", "hidden")}>Hide</button>
          </div>
        </div>
        <div className="bottom-content">
          {bottomTab === "assets" && (
            <div className="list">
              {project.assets.map((asset) => (
                <div key={asset.id} className={`list-item ${selectedAssetId === asset.id ? "active" : ""}`} onClick={() => setSelectedAssetId(asset.id)}>
                  <div><strong>{asset.name}</strong></div>
                  <div className="muted">{asset.category} · {asset.canPaint ? "paintable" : "place only"}</div>
                  <div className="muted code">{asset.filePath}</div>
                  {asset.thumbnailPath ? <div className="muted code">thumb: ready</div> : <div className="muted code">thumb: none</div>}
                </div>
              ))}
            </div>
          )}
          {bottomTab === "layers" && (
            <div className="list">
              <div className="list-item" style={{background:'#1a1a2e',padding:'0.5rem'}}>
                <strong>DEBUG: {project.layers.length} layers</strong>
                <div className="muted">{JSON.stringify(project.layers.map(l=>l.name))}</div>
              </div>
              <div className="field">
                <label>Filter layers</label>
                <input type="text" value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)} placeholder="Search layer..." />
              </div>
              {(project.layers ?? []).filter((layer) => layer.name.toLowerCase().includes(layerFilter.toLowerCase())).map((layer) => (
                <div key={layer.id} className="list-item">
                  <div><strong>{layer.name}</strong></div>
                  <div className="muted">{layer.visible ? "Visible" : "Hidden"} · {layer.locked ? "Locked" : "Unlocked"}</div>
                  <div className="chip-row">
                    <button
                      onClick={() => commitOperation({ type: "setLayerVisibility", targetId: layer.id, payload: { visible: !layer.visible } })}
                    >
                      {layer.visible ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={() => commitOperation({ type: "setLayerLocked", targetId: layer.id, payload: { locked: !layer.locked } })}
                    >
                      {layer.locked ? "Unlock" : "Lock"}
                    </button>
                  </div>
                </div>
              ))}
              {project.layers.length === 0 && (
                <div className="list-item">
                  <div className="muted">No layers found. Create a default project or check if layers are missing.</div>
                </div>
              )}
            </div>
          )}
          {bottomTab === "scene" && (
            <div className="list">
              <div className="field">
                <label>Filter scene items</label>
                <input type="text" value={sceneFilter} onChange={(event) => setSceneFilter(event.target.value)} placeholder="Search objects, paths, markers..." />
              </div>
              <div className="list-item">
                <div><strong>Placement Groups</strong></div>
                <div className="muted">{project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0)} instances</div>
              </div>
              {project.objects.filter((object) => `${object.name} ${object.assetId} ${object.layerId}`.toLowerCase().includes(sceneFilter.toLowerCase())).map((object) => (
                <div key={object.id} className={`list-item ${selectionObjectId === object.id ? "active" : ""}`} onClick={() => setSelectionObjectId(object.id)}>
                  <div><strong>{object.name}</strong></div>
                  <div className="muted">{object.assetId} · {object.layerId}</div>
                </div>
              ))}
              {project.roads.filter((road) => road.name.toLowerCase().includes(sceneFilter.toLowerCase())).map((road) => (
                <div key={road.id} className="list-item">
                  <div><strong>{road.name}</strong></div>
                  <div className="muted">Path · {road.points.length} points · width {road.width.toFixed(1)}</div>
                </div>
              ))}
              {project.markers.filter((marker) => `${marker.name} ${marker.type}`.toLowerCase().includes(sceneFilter.toLowerCase())).map((marker) => (
                <div key={marker.id} className="list-item">
                  <div><strong>{marker.name}</strong></div>
                  <div className="muted">Marker · {marker.type}</div>
                </div>
              ))}
            </div>
          )}
          {bottomTab === "validation" && (
            <div className="list">
              {validation.map((result) => (
                <div key={result.ruleId} className="list-item">
                  <div className={`status-pill status-${result.status}`}>{result.status}</div>
                  <div><strong>{result.category}</strong> · {result.ruleId}</div>
                  <div>{result.message}</div>
                  {result.evidence ? <div className="muted code">{result.evidence.join(" | ")}</div> : null}
                  {result.chainChecks ? (
                    <div className="muted code">
                      chain: V={String(result.chainChecks.visible)} I={String(result.chainChecks.interactive)} P={String(result.chainChecks.persistent)} E={String(result.chainChecks.exported)} R={String(result.chainChecks.previewRendered)}
                    </div>
                  ) : null}
                </div>
              ))}
              {proofRun ? (
                <div className="list-item">
                  <div><strong>Latest proof run</strong></div>
                  <div className="muted code">{proofRun.id}</div>
                  <div className="muted">{proofRun.passCount} pass · {proofRun.failCount} fail</div>
                </div>
              ) : null}
            </div>
          )}
          {bottomTab === "console" && (
            <div className="list">
              <div className="list-item">
                <div><strong>Session</strong></div>
                <div className="muted code">{project.id}</div>
              </div>
              <div className="list-item">
                <div><strong>Status</strong></div>
                <div className="muted">{statusMessage}</div>
              </div>
              {proofRun ? (
                <div className="list-item">
                  <div><strong>Proof steps</strong></div>
                  {proofRun.steps.map((step) => (
                    <div key={step.id} className="muted code">{step.status} · {step.id} · {step.reason}</div>
                  ))}
                </div>
              ) : null}
              <div className="list-item">
                <div className="panel-row" style={{ justifyContent: "space-between" }}>
                  <strong>Panel registry order</strong>
                  <button onClick={resetWorkspacePanelOrder}>Reset panels</button>
                </div>
                <div className="muted">Reorder the visible workspace registry and keep it saved with the workspace.</div>
                <div className="list" style={{ marginTop: "0.5rem" }}>
                  {workspacePanelOrder.map((panel, index) => {
                    const definition = workspacePanelRegistry[panel];
                    return (
                      <div
                        key={panel}
                        className={`list-item workspace-panel-order-item ${draggingWorkspacePanel === panel ? "dragging" : ""} ${workspacePanelDropTarget === panel ? "drop-target" : ""}`}
                        draggable
                        onDragStart={(event) => beginWorkspacePanelDrag(panel, event)}
                        onDragOver={(event) => handleWorkspacePanelDragOver(panel, event)}
                        onDrop={(event) => handleWorkspacePanelDrop(panel, event)}
                        onDragEnd={endWorkspacePanelDrag}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", cursor: "grab" }}
                      >
                        <div>
                          <div><strong>{definition.title}</strong></div>
                          <div className="muted code">{panel}</div>
                        </div>
                        <div className="chip-row">
                          <span className="kbd">Drag</span>
                          <button onClick={() => moveWorkspacePanelOrder(panel, -1)} disabled={index === 0}>Up</button>
                          <button onClick={() => moveWorkspacePanelOrder(panel, 1)} disabled={index === workspacePanelOrder.length - 1}>Down</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {bottomTab === "export" && (
            <pre className="list-item code" style={{ whiteSpace: "pre-wrap", margin: 0, maxHeight: "35vh", overflow: "auto" }}>
              {JSON.stringify(buildWorldExportPackage(project), null, 2)}
            </pre>
          )}
          {bottomTab === "json" && (
            <div className="list">
              <div className="list-item">
                <div><strong>WorldGenerationConfig</strong></div>
                <textarea
                  className="code"
                  style={{ width: "100%", minHeight: "220px" }}
                  value={worldConfigDraft}
                  onChange={(event) => setWorldConfigDraft(event.target.value)}
                />
                <div className="chip-row">
                  <button onClick={() => setWorldConfigDraft(JSON.stringify(DEFAULT_WORLD_GENERATION_CONFIG, null, 2))}>Load Default Config</button>
                  <button onClick={() => setWorldConfigDraft(JSON.stringify({
                    ...DEFAULT_WORLD_GENERATION_CONFIG,
                    generator: "generic",
                    theme: "forest",
                    metadata: {
                      ...(DEFAULT_WORLD_GENERATION_CONFIG.metadata ?? {}),
                      description: "Generic path/zone generation preset",
                      tags: ["generated", "generic", "ai-ready", "cinematic", "showcase", "kenney"],
                    },
                    paths: [
                      {
                        id: "generic-primary-path",
                        type: "loop",
                        tags: ["primary", "route", "loop"],
                        width: 7,
                        complexity: 9,
                        smoothing: 0.72,
                        center: { x: 0, z: 0 },
                        radius: 26,
                        checkpoints: 4,
                        materialId: "track",
                        flattenTerrain: true,
                        smoothEdges: true,
                      },
                    ],
                    zones: [
                      {
                        id: "generic-forest-zone",
                        type: "blob",
                        tags: ["forest", "dense"],
                        center: { x: -18, z: 12 },
                        radius: 20,
                        irregularity: 0.34,
                        materialId: "grass",
                        assetTags: ["tree", "foliage"],
                      },
                      {
                        id: "generic-rock-zone",
                        type: "blob",
                        tags: ["rock", "cliff"],
                        center: { x: 22, z: -8 },
                        radius: 16,
                        irregularity: 0.22,
                        materialId: "rock",
                        assetTags: ["rock", "prop"],
                      },
                    ],
                    placementRules: [
                      {
                        id: "generic-trees",
                        assetTags: ["tree", "foliage"],
                        zoneTags: ["forest"],
                        avoidPathTags: ["primary"],
                        slopeMax: 30,
                        density: 0.65,
                        count: 44,
                        minSpacing: 3,
                        cluster: { enabled: true, clusterCount: 5, radius: 10 },
                      },
                      {
                        id: "generic-rocks",
                        assetTags: ["rock", "prop"],
                        zoneTags: ["rock"],
                        avoidPathTags: ["primary"],
                        slopeMax: 36,
                        density: 0.4,
                        count: 20,
                        minSpacing: 4,
                      },
                    ],
                  }, null, 2))}>Load Generic Config</button>
                  <button onClick={() => setWorldConfigDraft(JSON.stringify({
                    ...DEFAULT_WORLD_GENERATION_CONFIG,
                    metadata: {
                      ...(DEFAULT_WORLD_GENERATION_CONFIG.metadata ?? {}),
                      description: "Art-directed Kenney showcase layout",
                      tags: ["generated", "showcase", "kenney", "cinematic"],
                      showcaseLayout: DEFAULT_WORLD_GENERATION_CONFIG.metadata?.showcaseLayout,
                    },
                  }, null, 2))}>Load Showcase Layout</button>
                  <button onClick={() => setWorldConfigDraft(JSON.stringify({ ...DEFAULT_WORLD_GENERATION_CONFIG, generator: "city", theme: "forest", metadata: { ...(DEFAULT_WORLD_GENERATION_CONFIG.metadata ?? {}), description: "City generator preset" } }, null, 2))}>Load City Config</button>
                  <button onClick={applyGenerationConfigDraft}>Generate World</button>
                </div>
                <div className="muted">{worldConfigStatus}</div>
                {worldConfigIssues.length > 0 ? <div className="muted code">issues: {worldConfigIssues.join(" | ")}</div> : <div className="muted code">issues: clean</div>}
              </div>
              <div className="list-item">
                <div><strong>WorldPatch</strong></div>
                <textarea
                  className="code"
                  style={{ width: "100%", minHeight: "180px" }}
                  value={worldPatchDraft}
                  onChange={(event) => setWorldPatchDraft(event.target.value)}
                  placeholder='{"op":"setEnvironment","value":{"timeOfDay":"evening"}}'
                />
                <div className="chip-row">
                  <button onClick={() => setWorldPatchDraft(JSON.stringify({ op: "setEnvironment", value: { timeOfDay: "evening" } }, null, 2))}>Load Default Patch</button>
                  <button onClick={applyWorldPatchDraft}>Apply Patch</button>
                </div>
                <div className="muted">{worldPatchStatus}</div>
                {worldPatchIssues.length > 0 ? <div className="muted code">issues: {worldPatchIssues.join(" | ")}</div> : <div className="muted code">issues: clean</div>}
              </div>
              <div className="list-item">
                <div><strong>AiWorldCommand</strong></div>
                <textarea
                  className="code"
                  style={{ width: "100%", minHeight: "180px" }}
                  value={aiCommandDraft}
                  onChange={(event) => setAiCommandDraft(event.target.value)}
                  placeholder='{"type":"generateOffroadTrack","seed":42,"difficulty":0.5}'
                />
                <div className="chip-row" style={{ marginBottom: "0.5rem" }}>
                  <button onClick={() => setAiCommandDraft(JSON.stringify({ type: "generateOffroadTrack", seed: 42, difficulty: 0.5 }, null, 2))}>Load Off-road Generator</button>
                  <button onClick={() => setAiCommandDraft(JSON.stringify({ type: "makeTerrainMoreDramatic", amount: 0.6, seed: 99 }, null, 2))}>Load Dramatic Terrain</button>
                  <button onClick={() => setAiCommandDraft(JSON.stringify({ type: "addRockyBorder", density: 8, seed: 77 }, null, 2))}>Load Border Rocks</button>
                  <button onClick={() => setAiCommandDraft(JSON.stringify({ type: "applyWorldPatch", patch: { op: "setEnvironment", value: { timeOfDay: "evening" } } }, null, 2))}>Load Patch Bridge</button>
                </div>
                <div className="chip-row">
                  <button onClick={applyAiCommandDraft}>Apply AI Command</button>
                </div>
                <div className="muted">{aiCommandStatus}</div>
                {aiCommandIssues.length > 0 ? <div className="muted code">issues: {aiCommandIssues.join(" | ")}</div> : <div className="muted code">issues: clean</div>}
              </div>
              <div className="list-item">
                <div><strong>WorldDocument</strong></div>
                <pre className="code" style={{ whiteSpace: "pre-wrap", margin: 0, maxHeight: "35vh", overflow: "auto" }}>
                  {JSON.stringify(worldDocument, null, 2)}
                </pre>
                <div className="chip-row">
                  <button onClick={() => setJsonWorldDraft(JSON.stringify(worldDocument, null, 2))}>Edit as JSON</button>
                </div>
              </div>
              <div className="list-item">
                <div><strong>WorldOperation / Core Patch JSON</strong></div>
                <div className="chip-row" style={{ marginBottom: "0.5rem" }}>
                  <select value={jsonExample} onChange={(event) => setJsonExample(event.target.value)}>
                    <option value="add_rocks_near_track.json">add_rocks_near_track</option>
                    <option value="widen_road.json">widen_road</option>
                    <option value="add_forest_zone.json">add_forest_zone</option>
                    <option value="paint_mud_patch.json">paint_mud_patch</option>
                    <option value="flatten_track_area.json">flatten_track_area</option>
                    <option value="add_checkpoints.json">add_checkpoints</option>
                    <option value="sunset_environment.json">sunset_environment</option>
                  </select>
                  <button onClick={loadOperationExample}>Load Example</button>
                </div>
                <textarea
                  className="code"
                  style={{ width: "100%", minHeight: "160px" }}
                  value={jsonOpDraft}
                  onChange={(event) => setJsonOpDraft(event.target.value)}
                  placeholder='{"type":"updateEnvironment","payload":{"timeOfDay":"evening"}}'
                />
                <div className="chip-row">
                  <button onClick={applyOperationDraft}>Apply Operation</button>
                  <button onClick={runJsonOperationProof}>Run Auto JSON Proof</button>
                </div>
                <div className="muted">{jsonStatus}</div>
                {jsonIntegrityIssues.length > 0 ? (
                  <div className="muted code">integrity: {jsonIntegrityIssues.join(" | ")}</div>
                ) : (
                  <div className="muted code">integrity: clean</div>
                )}
                {operationHistory.length > 0 ? (
                  <div className="muted code" style={{ marginTop: "0.5rem" }}>
                    {operationHistory.slice(-5).map((entry) => entry).join(" | ")}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </WorkspacePanelFrame>

      <input
        key={fileInputKey}
        id="load-project"
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => handleLoadFile(event.target.files?.[0] ?? null)}
      />
      <button
        className="ghost"
        style={{ position: "absolute", left: -9999, top: -9999 }}
        onClick={() => {
          const payload = JSON.stringify(buildWorldExportPackage(project), null, 2);
          downloadFile(`${project.name.replace(/\s+/g, "-").toLowerCase()}-local.json`, payload);
        }}
      >
        hidden-export
      </button>
      <button
        className="ghost"
        style={{ position: "absolute", left: -9999, top: -9999 }}
        onClick={() => setFileInputKey((value) => value + 1)}
      >
        hidden-reset
      </button>
    </div>
  );
}

export default function App() {
  const isPreviewMode = new URLSearchParams(window.location.search).has("preview");
  return isPreviewMode ? <PreviewApp /> : <EditorApp />;
}
