# Validation System

## Purpose

The validation system prevents fake completion.

It checks whether the world is actually usable, not just visually present.

## Status Types

Each validation rule returns one of:

- `REAL` — fully implemented, visible, functional, persistent, exportable.
- `PARTIAL` — visible or partly working, but incomplete.
- `FAKE` — UI exists but behavior does not work.
- `MISSING` — not implemented.

## Validation Result Model

```ts
type ValidationResult = {
  status: "REAL" | "PARTIAL" | "FAKE" | "MISSING";
  category: string;
  ruleId: string;
  message: string;
  severity: "info" | "warning" | "critical";
  evidence?: string[];
};
```

## Required Rule Categories

### Terrain

Checks:

- Terrain exists.
- Terrain has editable height data.
- Height variation exists.
- Terrain has painted materials.
- Terrain saves and reloads.
- Terrain exports.

### Assets

Checks:

- Asset library exists.
- Custom asset imported.
- Imported asset is placeable.
- Placed asset is visible.
- Object transform works.
- Asset data saves/loads/exports.

### Foliage

Checks:

- Foliage brush exists.
- Foliage can be painted.
- Erase mode works.
- Density affects placement.
- Random scale/rotation works.
- Foliage avoids roads when enabled.

### Roads/Tracks

Checks:

- Road tool exists.
- Road can be drawn.
- Road is visible.
- Road has width/material.
- Road can be edited.
- Road exports.
- Checkpoints exist for racing maps.

### Save/Load

Checks:

- Project can be saved.
- Project can be loaded.
- Terrain persists.
- Assets persist.
- Objects persist.
- Foliage persists.
- Roads persist.
- Markers persist.

### Export

Checks:

- Export file generated.
- Export includes terrain.
- Export includes materials.
- Export includes assets.
- Export includes objects.
- Export includes foliage.
- Export includes roads.
- Export includes markers.
- Export includes environment.

## Validation UI

Validation panel should show:

- Overall verdict.
- Rule list.
- Critical issues.
- Warnings.
- Fix recommendations.

Example:

```json
{
  "overallStatus": "PARTIAL",
  "criticalIssues": 3,
  "warnings": 5,
  "results": [
    {
      "status": "MISSING",
      "category": "assets",
      "ruleId": "custom-asset-import",
      "message": "No custom asset has been imported.",
      "severity": "critical"
    }
  ]
}
```

## Acceptance

Validation is REAL only if it detects both success and failure states.

A validation panel that always says success is FAKE.

