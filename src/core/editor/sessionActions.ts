import type { AssetDefinition, WorldProject } from "../../types";
import { parseWorldPayload, resolveWorldProject, saveProjectToStorage } from "../export";

export function saveProjectSnapshot(project: WorldProject) {
  saveProjectToStorage(project);
}

export function exportProjectSave(project: WorldProject) {
  return JSON.stringify(project, null, 2);
}

export function loadWorldProjectFromText(text: string): WorldProject | null {
  const payload = parseWorldPayload(text);
  if (!payload) return null;
  return resolveWorldProject(payload);
}

export function createSaveFileName(project: WorldProject) {
  return `${project.name.replace(/\s+/g, "-").toLowerCase()}-save.json`;
}

export function createEvidenceFileName(project: WorldProject) {
  return `${project.name.replace(/\s+/g, "-").toLowerCase()}-evidence.json`;
}

export function createAssetImportStatus(fileName: string) {
  return `Imported ${fileName}`;
}

export function createReloadProofStatus() {
  return "Saved and reloaded the current world from local storage";
}

export function createSaveStatus() {
  return "Saved to local storage";
}

export function createDownloadStatus() {
  return "Downloaded save file";
}

export function createImportedAssetList(asset: AssetDefinition) {
  return asset;
}
