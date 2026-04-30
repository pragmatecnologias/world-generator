import { useState } from "react";
import type { FantasyWorldPreset, FantasyWorldConfig } from "../domains/fantasy/fantasyPresets";
import { FANTASY_PRESET_CONFIGS } from "../domains/fantasy/fantasyPresets";

type Props = {
  onGenerate: (config: FantasyWorldConfig) => void;
};

const PRESET_INFO: Record<FantasyWorldPreset, { label: string; description: string }> = {
  "island-village": {
    label: "Island Village",
    description: "Raised island with central town, surrounding forest, and water edges.",
  },
  "forest-hamlet": {
    label: "Forest Hamlet",
    description: "Flatter world with dense tree coverage and a small clearing.",
  },
  "coastal-town": {
    label: "Coastal Town",
    description: "Shoreline with a larger town and harbor area.",
  },
};

export function FantasyIslandPanel({ onGenerate }: Props) {
  const [preset, setPreset] = useState<FantasyWorldPreset>("island-village");
  const [seed, setSeed] = useState(42);
  const [enableWater, setEnableWater] = useState(true);
  const [enableForest, setEnableForest] = useState(true);
  const [enableFarms, setEnableFarms] = useState(true);
  const [density, setDensity] = useState<"sparse" | "normal" | "dense">("normal");

  const handleGenerate = () => {
    const config: FantasyWorldConfig = {
      ...FANTASY_PRESET_CONFIGS[preset],
      seed,
      enableWater,
      enableForest,
      enableFarms,
      structureDensity: density,
    };
    onGenerate(config);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {/* Preset selector */}
      <div className="field">
        <label>World Preset</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {(Object.keys(PRESET_INFO) as FantasyWorldPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreset(p);
                setSeed(FANTASY_PRESET_CONFIGS[p].seed);
              }}
              style={{
                textAlign: "left",
                padding: "0.4rem 0.6rem",
                background: preset === p ? "var(--accent)" : "var(--panel-bg)",
                color: preset === p ? "#fff" : undefined,
                border: `1px solid ${preset === p ? "var(--accent)" : "var(--border)"}`,
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <strong>{PRESET_INFO[p].label}</strong>
              <div className="muted" style={{ fontSize: "0.75rem" }}>{PRESET_INFO[p].description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Seed */}
      <div className="field">
        <label>Seed: {seed}</label>
        <input type="range" min="1" max="999" step="1" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
      </div>

      {/* Density */}
      <div className="field">
        <label>Structure Density</label>
        <div className="chip-row">
          {(["sparse", "normal", "dense"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={density === d ? "active" : ""}
              style={{ textTransform: "capitalize" }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="field" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
          <input type="checkbox" checked={enableWater} onChange={(e) => setEnableWater(e.target.checked)} />
          Water
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
          <input type="checkbox" checked={enableForest} onChange={(e) => setEnableForest(e.target.checked)} />
          Forest
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
          <input type="checkbox" checked={enableFarms} onChange={(e) => setEnableFarms(e.target.checked)} />
          Farms
        </label>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        style={{
          padding: "0.6rem 1rem",
          background: "var(--accent, #4a9)",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        Generate Fantasy World
      </button>
    </div>
  );
}
