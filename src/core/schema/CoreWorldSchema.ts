import type { Vector3Data } from "../../types";

export type PathDefinition = {
  id: string;
  points: Vector3Data[];
  width: number;
  tags?: string[];
  closedLoop?: boolean;
  materialId?: string;
};

export type ZoneDefinition = {
  id: string;
  area: Vector3Data[];
  tags: string[];
};

export type PlacementRule = {
  assetTag: string;
  zoneTags?: string[];
  avoidPathTags?: string[];
  slopeMax?: number;
  density?: number;
};

export type CoreWorldGeneratorConfig = {
  seed: number;
  terrain: {
    width: number;
    depth: number;
    resolution: number;
    heightScale: number;
    noise: {
      type: "simplex" | "perlin";
      octaves: number;
      frequency: number;
      persistence: number;
    };
  };
  paths: PathDefinition[];
  zones: ZoneDefinition[];
  placementRules: PlacementRule[];
  markerTags?: string[];
};
