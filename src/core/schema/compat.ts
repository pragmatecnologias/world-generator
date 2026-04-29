import type { FoliageGroup, RoadDefinition, ScatterZone } from "../../types";
import type { PathDefinition, ZoneDefinition } from "./CoreWorldSchema";

export function roadsToPaths(roads: RoadDefinition[]): PathDefinition[] {
  return roads.map((road) => ({ ...road }));
}

export function pathsToRoads(paths: PathDefinition[]): RoadDefinition[] {
  return paths.map((path, index) => ({
    id: path.id,
    name: `Path ${index + 1}`,
    points: path.points.map((point) => ({ ...point })),
    width: path.width,
    materialId: path.tags?.includes("track") ? "track" : "dirt",
    flattenTerrain: true,
    smoothEdges: true,
    closedLoop: Boolean(path.closedLoop),
    checkpointIds: [],
  }));
}

export function scatterZonesToZones(zones: ScatterZone[]): ZoneDefinition[] {
  return zones.map((zone) => ({
    id: zone.id,
    area: zone.points.map((point) => ({ ...point })),
    tags: [zone.name.toLowerCase(), zone.shape],
  }));
}

export function foliageGroupsToPlacementGroups(groups: FoliageGroup[]): FoliageGroup[] {
  return groups.map((group) => ({
    ...group,
    instances: group.instances.map((instance) => ({ ...instance })),
  }));
}
