import type { Bbox2d } from "../../mesh/types";

export type SvgExportTier = "preview" | "manufacturing";

export type SvgExportOptions = {
  tier: SvgExportTier;
  /** Tier 1 only; default true */
  includeSeams?: boolean;
  paddingRatio?: number;
  /** SVG <title> and metadata; not embedded as geometry */
  title?: string;
};

export type CutPath2d = {
  points: { x: number; y: number }[];
  closed: boolean;
};

export type SvgViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  pad: number;
  bounds: Bbox2d;
};

export type SvgBuildStats = {
  facePolygonCount: number;
  seamLineCount: number;
  cutPathCount: number;
  cutSegmentCount: number;
};

export type SvgBuildResult = {
  svg: string;
  viewBox: SvgViewBox;
  stats: SvgBuildStats;
};
