export type WorkspacePanelId = "toolbox" | "inspector" | "bottom";
export type BottomTabId = "assets" | "layers" | "scene" | "validation" | "console" | "export" | "json";
export type WorkspaceDockSide = "left" | "right" | "bottom";

export type WorkspacePanelDefinition = {
  id: WorkspacePanelId;
  title: string;
  summary: string;
  side: WorkspaceDockSide;
  defaultMode: "docked" | "floating" | "hidden";
};

export type BottomTabDefinition = {
  id: BottomTabId;
  label: string;
};

export const workspacePanelRegistry: Record<WorkspacePanelId, WorkspacePanelDefinition> = {
  toolbox: {
    id: "toolbox",
    title: "Brush & tools",
    summary: "Shape terrain, paint materials, and place content directly in the world.",
    side: "left",
    defaultMode: "docked",
  },
  inspector: {
    id: "inspector",
    title: "Inspector & validation",
    summary: "Edit selected world data and verify what is truly saved, exported, and previewable.",
    side: "right",
    defaultMode: "docked",
  },
  bottom: {
    id: "bottom",
    title: "Workspace drawer",
    summary: "Switch between assets, layers, scene, validation, console, export, and JSON control planes.",
    side: "bottom",
    defaultMode: "docked",
  },
};

export const bottomTabRegistry: BottomTabDefinition[] = [
  { id: "assets", label: "Assets" },
  { id: "layers", label: "Layers" },
  { id: "scene", label: "Scene" },
  { id: "validation", label: "Validation" },
  { id: "console", label: "Console" },
  { id: "export", label: "Export" },
  { id: "json", label: "JSON" },
];

export const defaultBottomTabOrder: BottomTabId[] = bottomTabRegistry.map((tab) => tab.id);

export const defaultWorkspacePanelOrder: WorkspacePanelId[] = ["toolbox", "inspector", "bottom"];
