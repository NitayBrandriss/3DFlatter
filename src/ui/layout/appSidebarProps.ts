import type { RefObject } from "react";
import type { UnfoldMeshResult } from "@/logic/mesh/types";
import type { QualityIssueCounts } from "@/logic/unfold/qualitySummary";
import type { MeshEditTool } from "@/state/meshEditTool";
import type { MeshSession, computeSessionStats } from "@/state/meshSessionStore";

type SessionStats = ReturnType<typeof computeSessionStats>;

export type AppSidebarLayoutProps = {
  sidebarOpen: boolean;
  sidebarDrawerId: string;
  openButtonRef: RefObject<HTMLButtonElement | null>;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  closeIfMobile: () => void;
  peekEnabled: boolean;
  isPeeking: boolean;
  onPeekChange: (next: boolean) => void;
};

export type AppSidebarSessionProps = {
  session: MeshSession | null;
  stats: SessionStats;
  isLoading: boolean;
  error: string | null;
  meshEditTool: MeshEditTool;
  setMeshEditTool: (tool: MeshEditTool) => void;
  clearAllSeams: () => void;
  cutStrokeCount: number;
  clearCutStrokes: () => void;
  deleteLastCutStroke: () => void;
};

export type AppSidebarFlattenProps = {
  flattening: boolean;
  flattenResult: UnfoldMeshResult | null;
  qualityCounts: QualityIssueCounts | null;
  showQualityOverlay: boolean;
  setShowQualityOverlay: (value: boolean) => void;
  includeSeamsInExport: boolean;
  setIncludeSeamsInExport: (value: boolean) => void;
  onFlatten: () => boolean;
  onExportSvg: () => void;
};

export type AppSidebarViewProps = {
  wireframe: boolean;
  setWireframe: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  showAxes: boolean;
  setShowAxes: (value: boolean) => void;
  modelScale: number;
  setModelScale: (value: number) => void;
};

export type AppSidebarDemoProps = {
  selectedDemoId: string;
  setSelectedDemoId: (value: string) => void;
  onPickFile: (file: File | null) => Promise<boolean>;
  onLoadDemo: () => Promise<boolean>;
};

export type AppSidebarProps = {
  layout: AppSidebarLayoutProps;
  session: AppSidebarSessionProps;
  flatten: AppSidebarFlattenProps;
  view: AppSidebarViewProps;
  demo: AppSidebarDemoProps;
};
