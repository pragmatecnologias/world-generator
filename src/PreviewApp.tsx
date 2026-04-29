import { useEffect, useMemo, useState } from "react";
import ThreeViewport from "./viewport/ThreeViewport";
import { createDefaultProject } from "./defaultProject";
import type { WorldProject } from "./types";
import { loadLastExportPackage, loadProjectFromStorage, parseWorldPayload, resolveWorldProject, saveProjectToStorage, validateExportPackage } from "./export";

function createStrictEmptyProject(): WorldProject {
  const base = createDefaultProject();
  return {
    ...base,
    name: "Strict Preview (No Export Loaded)",
    objects: [],
    assets: [],
    foliageGroups: base.foliageGroups.map((group) => ({ ...group, instances: [] })),
    roads: [],
    markers: [],
    scatterZones: [],
  };
}

function loadInitialPreviewProject(): WorldProject {
  const strictExportOnly = new URLSearchParams(window.location.search).get("strictExportOnly") === "1";
  const exported = loadLastExportPackage();
  if (exported) {
    return resolveWorldProject(exported);
  }
  if (strictExportOnly) {
    return createStrictEmptyProject();
  }
  return loadProjectFromStorage() ?? createDefaultProject();
}

export default function PreviewApp() {
  const [project, setProject] = useState<WorldProject>(() => loadInitialPreviewProject());
  const strictExportOnly = new URLSearchParams(window.location.search).get("strictExportOnly") === "1";
  const [status, setStatus] = useState(strictExportOnly ? "Strict export-only mode: load an exported package." : "Preview ready");
  const [fileKey, setFileKey] = useState(0);
  const exportHash = useMemo(() => {
    const json = JSON.stringify(project);
    let hash = 0;
    for (let i = 0; i < json.length; i += 1) {
      hash = (hash * 31 + json.charCodeAt(i)) | 0;
    }
    return `h${Math.abs(hash)}`;
  }, [project]);

  const summary = useMemo(
    () => ({
      objects: project.objects.length,
      placement: project.foliageGroups.reduce((sum, group) => sum + group.instances.length, 0),
      paths: project.roads.length,
      markers: project.markers.length,
    }),
    [project],
  );

  const loadExport = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const payload = parseWorldPayload(text);
    if (!payload) {
      setStatus("Could not read exported JSON");
      return;
    }
    if ("packageType" in payload && payload.packageType === "world-export") {
      const validation = validateExportPackage(payload);
      if (!validation.valid) {
        setStatus(`Export invalid: ${validation.errors.join(", ")}`);
        return;
      }
    } else if (strictExportOnly) {
      setStatus("Strict mode requires a world-export package");
      return;
    }
    const loaded = resolveWorldProject(payload);
    setProject(loaded);
    saveProjectToStorage(loaded);
    localStorage.setItem(
      "world-generator.preview-proof",
      JSON.stringify({
        confirmedAt: new Date().toISOString(),
        strictExportOnly,
        projectHash: (() => {
          const json = JSON.stringify(loaded);
          let hash = 0;
          for (let i = 0; i < json.length; i += 1) hash = (hash * 31 + json.charCodeAt(i)) | 0;
          return `h${Math.abs(hash)}`;
        })(),
      }),
    );
    setStatus(`Loaded ${loaded.name} into preview`);
  };

  useEffect(() => {
    if (!strictExportOnly) return;
    localStorage.setItem(
      "world-generator.preview-proof",
      JSON.stringify({
        confirmedAt: new Date().toISOString(),
        strictExportOnly: true,
        projectHash: exportHash,
      }),
    );
  }, [strictExportOnly, exportHash]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="toolbar-group">
          <button onClick={() => window.location.assign("/")}>Back to Editor</button>
          <button onClick={() => setFileKey((value) => value + 1)}>Reset Loader</button>
          <button onClick={() => saveProjectToStorage(project)}>Save Preview State</button>
        </div>
        <div className="badge">
          <strong>PREVIEW</strong>
          <span>{status}</span>
        </div>
        {strictExportOnly ? <div className="badge"><strong>STRICT</strong><span>export only</span></div> : null}
      </div>
      <div className="layout" style={{ gridTemplateColumns: "1fr", height: "100%" }}>
        <main className="viewport-wrap">
          <div className="viewport-overlay">
            <div className="badge">This preview scene consumes exported world JSON.</div>
            <div className="badge">
              <strong>{project.name}</strong>
              <span>{summary.objects} objects · {summary.placement} placement · {summary.paths} paths · {summary.markers} markers</span>
            </div>
          </div>
          <ThreeViewport
            project={project}
            activeTool="select"
            brush={{ size: 1, strength: 0, falloff: "smooth", shape: "circle", materialId: "track" }}
            selectionObjectId={undefined}
            selectedAssetId={undefined}
            foliageSettings={{
              density: 0,
              minSpacing: 0,
              randomScaleMin: 1,
              randomScaleMax: 1,
              randomRotation: false,
              alignToTerrain: true,
              avoidRoads: false,
              slopeLimit: 0,
              eraseMode: false,
            }}
            scatterSettings={{
              count: 0,
              minSpacing: 0,
              randomScaleMin: 1,
              randomScaleMax: 1,
              randomRotation: false,
              slopeLimit: 0,
            }}
            playMode
            readOnly
            onSelectObject={() => undefined}
            onSelectTerrainCell={() => undefined}
            onProjectChange={() => project}
            onStatus={setStatus}
          />
        </main>
      </div>
      <div className="bottom">
        <div className="bottom-tabs">
          <button className="active">export-loader</button>
        </div>
        <div className="bottom-content">
          <div className="section" style={{ borderBottom: 0, padding: 0 }}>
            <h3>Load Exported World JSON</h3>
            <input
              key={fileKey}
              type="file"
              accept="application/json"
              onChange={(event) => loadExport(event.target.files?.[0] ?? null)}
            />
            <div className="muted" style={{ marginTop: "0.75rem" }}>
              Use this mode to verify that exported worlds reopen visually without touching code.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
