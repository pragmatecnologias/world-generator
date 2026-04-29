import type { ProofRunResult, ValidationResult, WorldProject } from "../../types";
import { generateWorld } from "../generation/generateWorld";
import { validateWorldGenerationConfig } from "../schema/validators";
import { validateAiPatch } from "../ai/worldPatchValidator";
import { validateAiWorldCommand } from "../ai/aiWorldCommandValidator";
import { applyAiWorldPatch } from "../ai/applyAiWorldPatch";
import { applyAiWorldCommand } from "../ai/applyAiWorldCommand";
import { applyWorldOperation, worldDocumentToProject, worldProjectToDocument, type WorldDocument, type WorldOperation } from "../worldDocument";
import type { WorldGenerationConfig } from "../schema/WorldConfigSchema";
import type { AiWorldCommand } from "../ai/aiWorldCommandSchema";
import type { WorldPatch } from "../ai/worldPatchSchema";
import { buildWorldExportPackage } from "../export";

export function applyGenerationConfigText(text: string): { project?: WorldProject; issues: string[] } {
  try {
    const parsed = JSON.parse(text) as WorldGenerationConfig;
    const issues = validateWorldGenerationConfig(parsed);
    if (issues.length > 0) return { issues };
    return { project: generateWorld(parsed), issues: [] };
  } catch (error) {
    return { issues: [String(error)] };
  }
}

export function applyWorldPatchText(document: WorldDocument, text: string): { document?: WorldDocument; issues: string[] } {
  try {
    const parsed = JSON.parse(text) as WorldPatch;
    const issues = validateAiPatch(parsed);
    if (issues.length > 0) return { issues };
    const result = applyAiWorldPatch(worldDocumentToProject(document), parsed);
    if (result.issues.length > 0) return { issues: result.issues };
    return { document: worldProjectToDocument(result.project), issues: [] };
  } catch (error) {
    return { issues: [String(error)] };
  }
}

export function applyAiCommandText(project: WorldProject, text: string): { project?: WorldProject; issues: string[]; count: number } {
  try {
    const parsed = JSON.parse(text) as AiWorldCommand | { commands: AiWorldCommand[] };
    const commands = "commands" in parsed ? parsed.commands : [parsed];
    const commandIssues = commands.flatMap((command) => validateAiWorldCommand(command));
    if (commandIssues.length > 0) return { issues: commandIssues, count: commands.length };
    let next = project;
    for (const command of commands) {
      const result = applyAiWorldCommand(next, command);
      if (result.issues.length > 0) return { issues: result.issues, count: commands.length };
      next = result.project;
    }
    return { project: next, issues: [], count: commands.length };
  } catch (error) {
    return { issues: [String(error)], count: 0 };
  }
}

export async function applyWorldOperationBundleText(document: WorldDocument, files: string[], fetcher: (url: string) => Promise<Response>): Promise<{ document?: WorldDocument; issues: string[]; count: number }> {
  try {
    let nextDocument = document;
    let count = 0;
    for (const file of files) {
      const response = await fetcher(`/operations/${file}`);
      if (!response.ok) throw new Error(`Failed to load ${file}: HTTP ${response.status}`);
      const payload = JSON.parse(await response.text()) as WorldOperation | { operations: WorldOperation[] };
      const operations = "operations" in payload ? payload.operations : [payload];
      for (const operation of operations) {
        nextDocument = applyWorldOperation(nextDocument, operation);
        count += 1;
      }
    }
    return { document: nextDocument, issues: [], count };
  } catch (error) {
    return { issues: [String(error)], count: 0 };
  }
}

export function buildEvidenceBundle(
  project: WorldProject,
  worldDocument: WorldDocument,
  operationHistory: string[],
  proofRun: ProofRunResult | null,
  validation: ValidationResult[],
) {
  return {
    createdAt: new Date().toISOString(),
    projectHash: stableHash(project),
    worldDocumentHash: stableHash(worldDocument),
    operationHistory,
    proofRun,
    validation,
    worldDocument,
    exportPackage: buildWorldExportPackage(project),
  };
}

function stableHash(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i += 1) hash = (hash * 31 + json.charCodeAt(i)) | 0;
  return `h${Math.abs(hash)}`;
}
