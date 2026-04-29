import type { ProofRunResult, ProofStepResult, ValidationResult, WorldProject } from "../../types";
import { createDefaultProject } from "../../defaultProject";
import { buildWorldExportPackage, validateExportPackage } from "../export";
import { validateProject } from "../../validation";
import { worldProjectToDocument } from "../worldDocument";

type ProofContext = {
  strictValidationMode: boolean;
  persisted: boolean;
  previewConfirmed: boolean;
};

export function runProofRun(project: WorldProject, context: ProofContext): ProofRunResult {
  const startedAt = new Date().toISOString();
  const preHash = stableHash(project);
  const exportPackage = buildWorldExportPackage(project);
  const exportValidation = validateExportPackage(exportPackage);
  const localValidation = validateProject(project, {
    strictMode: context.strictValidationMode,
    persisted: context.persisted,
    exportValid: exportValidation.valid,
    previewRendered: context.previewConfirmed,
    artifactRefs: [],
  });
  const validationStrictPass = localValidation.every((entry) => entry.status === "REAL");
  const foliageCount = project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0);
  const customAssetReady = project.assets.some((asset) => Boolean(asset.fileDataUrl) && asset.filePath !== "built-in");
  const pathHasCurve = project.roads.some((road) => road.points.length >= 3 && road.id !== "road-demo");
  const checkpoints = project.markers.filter((marker) => marker.type === "checkpoint").length;
  const userPlacedObjects = project.objects.filter((object) => !object.id.startsWith("obj-demo")).length;
  const scatterGenerated = project.scatterZones.reduce((sum, zone) => sum + zone.generatedObjectIds.length, 0);

  const step = (id: string, label: string, pass: boolean, subsystem: ProofStepResult["subsystem"], reason: string): ProofStepResult => ({
    id,
    label,
    status: pass ? "PASS" : "FAIL",
    subsystem,
    reason,
    screenshotId: `${id}-${Date.now()}`,
    preHash,
    postHash: stableHash(project),
  });

  const steps: ProofStepResult[] = [
    step("terrain-edited", "Terrain sculpted and painted", new Set(project.terrain.materialMap).size >= 4 && stableHash(project.terrain.heights) !== stableHash(createDefaultProject().terrain.heights), "terrain", "Terrain must differ from starter and include diverse materials"),
    step("asset-import", "Custom asset imported", customAssetReady, "assets", "Needs imported GLB/GLTF source data"),
    step("object-flow", "Manual placement + transform flow", userPlacedObjects >= 1, "objects", "Needs at least one user-placed object"),
    step("foliage-flow", "Placement paint/erase flow", foliageCount >= 50, "placement", "Needs meaningful placement density"),
    step("scatter-flow", "Zone generation flow", scatterGenerated >= 20, "zone", "Needs applied zone output"),
    step("road-flow", "Path draw/edit flow", pathHasCurve, "path", "Needs drawn/edited path points"),
    step("marker-flow", "Start/finish + checkpoints", project.markers.some((marker) => marker.type === "start-finish") && checkpoints >= 3, "markers", "Needs race markers"),
    step("save-reload", "Save/reload persistence", context.persisted, "save-load", "Project should be saved in local storage"),
    step("export-valid", "Export contract validity", exportValidation.valid, "export", exportValidation.valid ? "Export package valid" : exportValidation.errors.join(", ")),
    step("preview-proof", "Preview runtime confirmed", context.previewConfirmed, "preview", "Use Open Preview (strict) + confirm"),
    step("validation-chain", "Validation chain checks", validationStrictPass, "validation", "Validation should satisfy strict REAL chain"),
  ];

  const passCount = steps.filter((item) => item.status === "PASS").length;
  const failCount = steps.filter((item) => item.status === "FAIL").length;

  return {
    id: crypto.randomUUID(),
    strictMode: context.strictValidationMode,
    startedAt,
    completedAt: new Date().toISOString(),
    passCount,
    failCount,
    partialCount: 0,
    steps,
  };
}

function stableHash(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}`;
}
