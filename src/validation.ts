import { createDefaultProject } from "./defaultProject";
import type { ValidationResult, WorldProject } from "./types";
import { validateWorldDocumentIntegrity, worldProjectToDocument } from "./worldDocument";

const baseline = createDefaultProject();

function arraysDiffer(a: number[] | string[], b: number[] | string[], epsilon = 0.0001) {
  if (a.length !== b.length) return true;
  return a.some((value, index) => typeof value === "number" && typeof b[index] === "number"
    ? Math.abs(value - (b[index] as number)) > epsilon
    : value !== b[index]);
}

function hasCustomAsset(project: WorldProject) {
  return project.assets.some((asset) => asset.fileDataUrl && asset.filePath !== "built-in");
}

function hasUserEditedTerrain(project: WorldProject) {
  return arraysDiffer(project.terrain.heights, baseline.terrain.heights) || arraysDiffer(project.terrain.materialMap, baseline.terrain.materialMap);
}

function hasUserPlacedObject(project: WorldProject) {
  return project.objects.some((object) => !object.id.startsWith("obj-demo") && object.assetId !== "demo-rock");
}

function hasUserRoad(project: WorldProject) {
  return project.roads.some((road) => road.id !== "road-demo" && road.points.length >= 2)
    || project.roads.some((road) => road.id === "road-demo" && arraysDiffer(
      road.points.flatMap((point) => [point.x, point.y, point.z]),
      baseline.roads[0]?.points.flatMap((point) => [point.x, point.y, point.z]) ?? [],
    ));
}

function hasUserFoliage(project: WorldProject) {
  return project.foliageGroups.some((group) => group.instances.length > baseline.foliageGroups[0]?.instances.length || group.instances.some((instance) => instance.assetId !== "demo-tree"));
}

function overall(statuses: ValidationResult["status"][]) {
  if (statuses.includes("FAKE")) return "FAKE";
  if (statuses.includes("MISSING") || statuses.includes("PARTIAL")) return "PARTIAL";
  return "REAL";
}

type ValidationContext = {
  strictMode?: boolean;
  exportValid?: boolean;
  previewRendered?: boolean;
  persisted?: boolean;
  artifactRefs?: string[];
};

function withChain(
  status: ValidationResult["status"],
  category: string,
  ruleId: string,
  message: string,
  severity: ValidationResult["severity"],
  checks: ValidationResult["chainChecks"],
  evidence?: string[],
  artifactRefs?: string[],
): ValidationResult {
  return { status, category, ruleId, message, severity, chainChecks: checks, evidence, artifactRefs };
}

export function validateProject(project: WorldProject, context: ValidationContext = {}): ValidationResult[] {
  const persisted = context.persisted ?? true;
  const exportValid = context.exportValid ?? true;
  const previewRendered = context.previewRendered ?? false;
  const artifacts = context.artifactRefs ?? [];
  const terrainEdited = hasUserEditedTerrain(project);
  const customAsset = hasCustomAsset(project);
  const placedObject = hasUserPlacedObject(project) || project.objects.some((object) => object.assetId !== "demo-rock");
  const foliagePainted = hasUserFoliage(project);
  const roadEdited = hasUserRoad(project);
  const materialCount = new Set(project.terrain.materialMap).size;
  const worldDocument = worldProjectToDocument(project);
  const integrityIssues = validateWorldDocumentIntegrity(worldDocument);

  const chainFor = (interactive: boolean, visible = true) => ({
    visible,
    interactive,
    persistent: persisted,
    exported: exportValid,
    previewRendered,
  });

  const results: ValidationResult[] = [
    withChain(
      terrainEdited ? "REAL" : "PARTIAL",
      "terrain",
      "terrain-editable",
      terrainEdited ? "Terrain height and/or material data has been edited." : "Terrain exists but is still matching the starter world.",
      terrainEdited ? "info" : "critical",
      chainFor(terrainEdited),
      [`edited=${terrainEdited}`, `heightCount=${project.terrain.heights.length}`],
      artifacts,
    ),
    withChain(
      terrainEdited || materialCount >= 3 ? "REAL" : "PARTIAL",
      "terrain",
      "terrain-painted",
      "Terrain material regions are visible and editable.",
      materialCount >= 3 ? "info" : "warning",
      chainFor(materialCount >= 3),
      [`materials=${materialCount}`],
      artifacts,
    ),
    withChain(
      customAsset ? "REAL" : "PARTIAL",
      "assets",
      "custom-asset-import",
      customAsset ? "A custom asset has been imported." : "Only demo assets are present so far.",
      customAsset ? "info" : "critical",
      chainFor(customAsset),
      [`customAssets=${project.assets.filter((asset) => asset.fileDataUrl).length}`],
      artifacts,
    ),
    withChain(
      placedObject ? "REAL" : "PARTIAL",
      "assets",
      "placed-object",
      placedObject ? "At least one user-placed object exists." : "Only the starter object is present.",
      "critical",
      chainFor(placedObject),
      [`objects=${project.objects.length}`],
      artifacts,
    ),
    withChain(
      foliagePainted ? "REAL" : "PARTIAL",
      "foliage",
      "foliage-painted",
      foliagePainted ? "Foliage instances were painted by the user." : "Foliage is still only starter content.",
      foliagePainted ? "info" : "warning",
      chainFor(foliagePainted),
      [`foliageInstances=${project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0)}`],
      artifacts,
    ),
    withChain(
      roadEdited ? "REAL" : "PARTIAL",
      "roads",
      "road-visible",
      roadEdited ? "Road data has been drawn or edited." : "Only the demo road is present.",
      roadEdited ? "info" : "critical",
      chainFor(roadEdited),
      [`roads=${project.roads.length}`],
      artifacts,
    ),
    withChain(
      project.markers.length > 0 ? "REAL" : "MISSING",
      "markers",
      "markers-present",
      "Gameplay markers are available for export.",
      "info",
      chainFor(project.markers.length > 0),
      [`markers=${project.markers.length}`],
      artifacts,
    ),
    withChain(
      project.environment ? "REAL" : "MISSING",
      "export",
      "environment-present",
      "Environment settings are part of the project.",
      "info",
      chainFor(Boolean(project.environment)),
      undefined,
      artifacts,
    ),
    withChain(
      integrityIssues.length === 0 ? "REAL" : "PARTIAL",
      "json-contract",
      "world-document-integrity",
      integrityIssues.length === 0
        ? "WorldDocument reference integrity checks passed."
        : "WorldDocument integrity has broken references or schema mismatches.",
      integrityIssues.length === 0 ? "info" : "critical",
      chainFor(integrityIssues.length === 0),
      integrityIssues.length === 0 ? ["integrity=clean"] : integrityIssues,
      artifacts,
    ),
  ];

  if (context.strictMode) {
    const anyBrokenChain = results.some((entry) => {
      const checks = entry.chainChecks;
      return !checks || !checks.visible || !checks.interactive || !checks.persistent || !checks.exported || !checks.previewRendered;
    });
    results.push(
      withChain(
        anyBrokenChain ? "PARTIAL" : "REAL",
        "summary",
        "strict-chain",
        anyBrokenChain
          ? "Strict mode: one or more features failed visible/interactivity/persistence/export/preview checks."
          : "Strict mode: all feature chains satisfy visibility, interaction, persistence, export, and preview rendering.",
        anyBrokenChain ? "critical" : "info",
        chainFor(!anyBrokenChain),
        [],
        artifacts,
      ),
    );
  }

  const counts = {
    real: results.filter((result) => result.status === "REAL").length,
    partial: results.filter((result) => result.status === "PARTIAL").length,
    missing: results.filter((result) => result.status === "MISSING").length,
    fake: results.filter((result) => result.status === "FAKE").length,
  };

  results.unshift({
    status: overall(results.map((result) => result.status)),
    category: "summary",
    ruleId: "overall-readiness",
    message: `REAL ${counts.real}, PARTIAL ${counts.partial}, MISSING ${counts.missing}, FAKE ${counts.fake}`,
    severity: counts.fake > 0 ? "critical" : counts.missing > 0 ? "warning" : "info",
    evidence: [
      `terrainEdited=${terrainEdited}`,
      `customAsset=${customAsset}`,
      `placedObject=${placedObject}`,
      `foliagePainted=${foliagePainted}`,
      `roadEdited=${roadEdited}`,
      `persisted=${persisted}`,
      `exportValid=${exportValid}`,
      `previewRendered=${previewRendered}`,
    ],
    chainChecks: chainFor(!results.some((entry) => entry.status !== "REAL")),
    artifactRefs: artifacts,
  });

  return results;
}
