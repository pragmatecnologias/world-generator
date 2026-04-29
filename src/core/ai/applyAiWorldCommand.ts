import * as THREE from "three";
import type { WorldProject } from "../../types";
import { applyWorldOperation, worldDocumentToProject, worldProjectToDocument } from "../worldDocument";
import { generateWorld } from "../generation/generateWorld";
import { createSeededRng } from "../generation/random";
import { DEFAULT_WORLD_GENERATION_CONFIG, type WorldGenerationConfig } from "../schema/WorldConfigSchema";
import { applyAiWorldPatch } from "./applyAiWorldPatch";
import type { AiWorldCommand } from "./aiWorldCommandSchema";

function mergeGenerationConfig(seed: number, difficulty: number, partial?: Partial<WorldGenerationConfig>): WorldGenerationConfig {
  const base = structuredClone(DEFAULT_WORLD_GENERATION_CONFIG);
  base.seed = seed;
  base.terrain.heightScale = Math.max(8, base.terrain.heightScale * (1 + difficulty * 0.18));
  base.terrain.noise.persistence = Math.min(0.9, base.terrain.noise.persistence + difficulty * 0.03);
  if (partial) {
    base.theme = partial.theme ?? base.theme;
    base.terrain = { ...base.terrain, ...partial.terrain, noise: { ...base.terrain.noise, ...(partial.terrain?.noise ?? {}) } };
    base.roads = partial.roads ?? base.roads;
    base.biomes = partial.biomes ?? base.biomes;
    base.gameplay = { ...base.gameplay, ...partial.gameplay };
    base.environment = { ...base.environment, ...partial.environment };
    base.metadata = { ...base.metadata, ...partial.metadata };
  }
  return base;
}

export function applyAiWorldCommand(project: WorldProject, command: AiWorldCommand): { project: WorldProject; issues: string[] } {
  switch (command.type) {
    case "generateOffroadTrack":
      return { project: generateWorld(mergeGenerationConfig(command.seed, command.difficulty, command.config)), issues: [] };
    case "addRockyBorder": {
      const rng = createSeededRng(command.seed ?? 1337);
      const radius = 0.42 + command.density * 0.01;
      const patches = Array.from({ length: Math.max(4, Math.round(command.density)) }, (_, index) => {
        const angle = (index / Math.max(1, command.density)) * Math.PI * 2;
        return {
          type: "applyTerrainMaterialPatch" as const,
          payload: {
            materialId: "rock",
            center: {
              x: Math.cos(angle) * radius * project.terrain.width * 0.5,
              z: Math.sin(angle) * radius * project.terrain.depth * 0.5,
            },
            radius: 8 + rng() * 4,
            strength: 0.8,
            falloff: "smooth" as const,
          },
        };
      });
      const nextDocument = patches.reduce((state, patch) => applyWorldOperation(state, patch), worldProjectToDocument(project));
      return { project: worldDocumentToProject(nextDocument), issues: [] };
    }
    case "addMudPits": {
      const rng = createSeededRng(command.seed ?? 2026);
      let next = worldProjectToDocument(project);
      for (let i = 0; i < Math.max(1, command.count); i += 1) {
        const x = (rng() - 0.5) * next.terrain.width * 0.3;
        const z = (rng() - 0.5) * next.terrain.depth * 0.3;
        next = applyWorldOperation(next, {
          type: "applyTerrainMaterialPatch",
          payload: { materialId: "mud", center: { x, z }, radius: 5 + rng() * 5, strength: 0.95, falloff: "smooth" },
        });
      }
      return { project: worldDocumentToProject(next), issues: [] };
    }
    case "makeTerrainMoreDramatic": {
      let next = worldProjectToDocument(project);
      const amount = Math.max(0, command.amount);
      const rng = createSeededRng(command.seed ?? 9001);
      for (let i = 0; i < 3 + Math.ceil(amount * 3); i += 1) {
        const x = (rng() - 0.5) * next.terrain.width * 0.6;
        const z = (rng() - 0.5) * next.terrain.depth * 0.6;
        const mode = i % 2 === 0 ? "raise" : "lower";
        next = applyWorldOperation(next, {
          type: "applyTerrainHeightPatch",
          payload: { mode, center: { x, z }, radius: 6 + rng() * 6, strength: 0.45 + amount * 0.35, falloff: "smooth" },
        });
      }
      return { project: worldDocumentToProject(next), issues: [] };
    }
    case "placeAssetCluster": {
      const rng = createSeededRng(command.seed ?? 77);
      const matching = project.assets.filter((asset) => asset.tags.includes(command.tag) || asset.category.toLowerCase().includes(command.tag.toLowerCase()));
      const assetIds = (matching.length > 0 ? matching : project.assets).map((asset) => asset.id);
      let next = structuredClone(project);
      for (let i = 0; i < Math.max(1, command.count); i += 1) {
        const assetId = assetIds[i % assetIds.length];
        const asset = next.assets.find((entry) => entry.id === assetId) ?? next.assets[0];
        if (!asset) continue;
        next.objects.push({
          id: `ai-cluster-${i + 1}-${asset.id}`,
          assetId: asset.id,
          name: `${asset.name} Cluster ${i + 1}`,
          position: {
            x: (rng() - 0.5) * next.terrain.width * 0.45,
            y: 0.6 + rng() * 0.8,
            z: (rng() - 0.5) * next.terrain.depth * 0.45,
          },
          rotation: { x: 0, y: rng() * Math.PI * 2, z: 0 },
          scale: { x: 0.8 + rng() * 0.7, y: 0.8 + rng() * 0.7, z: 0.8 + rng() * 0.7 },
          layerId: next.layers.find((layer) => layer.id === "layer-props")?.id ?? next.layers[0]?.id ?? "layer-props",
          visible: true,
          locked: false,
          collisionEnabled: true,
        });
      }
      next.updatedAt = new Date().toISOString();
      return { project: next, issues: [] };
    }
    case "applyWorldPatch":
      return applyAiWorldPatch(project, command.patch);
  }
}
