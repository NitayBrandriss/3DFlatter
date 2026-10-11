import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";
import type { MeshSession } from "@/state/meshSessionStore";
import { AppSidebar } from "./AppSidebar";
import type {
  AppSidebarProps,
  AppSidebarSessionProps,
} from "./appSidebarProps";

type ButtonProps = {
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
};

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement(node)) {
    return nodeText((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function collectButtons(
  node: ReactNode,
  out: ReactElement<ButtonProps>[] = [],
): ReactElement<ButtonProps>[] {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectButtons(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  if (node.type === "button") out.push(node as ReactElement<ButtonProps>);
  collectButtons((node.props as { children?: ReactNode }).children, out);
  return out;
}

function renderSidebar(props: AppSidebarProps): ReactElement {
  return (
    AppSidebar as { type: (props: AppSidebarProps) => ReactElement }
  ).type(props);
}

function buttonByLabel(
  tree: ReactElement,
  label: string,
): ReactElement<ButtonProps> {
  const found = collectButtons(tree).find(
    (button) => nodeText(button.props.children).trim() === label,
  );
  expect(found, `button "${label}"`).toBeDefined();
  return found!;
}

function sidebarProps(options: {
  session: MeshSession | null;
  isolationActive: boolean;
  confirmIsolation: () => boolean;
  exitIsolation: () => void;
}): AppSidebarProps {
  const session: AppSidebarSessionProps = {
    session: options.session,
    stats: null,
    isLoading: false,
    error: null,
    meshEditTool: "none",
    setMeshEditTool: () => {},
    clearAllSeams: () => {},
    cutStrokeCount: 0,
    clearCutStrokes: () => {},
    deleteLastCutStroke: () => {},
    deleteEditingCutStroke: () => {},
    editingStrokeId: null,
    cutDraftActive: false,
    cutDraftCanFinalize: false,
    onCutDraftDone: () => {},
    onCutDraftCancel: () => {},
    isolationActive: options.isolationActive,
    confirmIsolation: options.confirmIsolation,
    exitIsolation: options.exitIsolation,
  };

  return {
    layout: {
      sidebarOpen: true,
      sidebarDrawerId: "sidebar-drawer",
      openButtonRef: { current: null },
      onToggleSidebar: () => {},
      onCloseSidebar: () => {},
      closeIfMobile: () => {},
      peekEnabled: false,
      isPeeking: false,
      onPeekChange: () => {},
    },
    session,
    flatten: {
      flattening: false,
      flattenResult: null,
      qualityCounts: null,
      showQualityOverlay: false,
      setShowQualityOverlay: () => {},
      includeSeamsInExport: true,
      setIncludeSeamsInExport: () => {},
      onFlatten: () => false,
      onExportSvg: () => {},
    },
    view: {
      wireframe: false,
      setWireframe: () => {},
      showGrid: false,
      setShowGrid: () => {},
      showAxes: false,
      setShowAxes: () => {},
      modelScale: 1,
      setModelScale: () => {},
    },
    demo: {
      selectedDemoId: "cube",
      setSelectedDemoId: () => {},
      onPickFile: async () => false,
      onLoadDemo: async () => false,
    },
  };
}

describe("AppSidebar isolation button", () => {
  it("confirms isolation when a session is loaded and isolation is inactive", () => {
    const confirmIsolation = vi.fn(() => false);
    const exitIsolation = vi.fn();
    const tree = renderSidebar(
      sidebarProps({
        session: { fileName: "a.obj" } as MeshSession,
        isolationActive: false,
        confirmIsolation,
        exitIsolation,
      }),
    );

    const button = buttonByLabel(tree, "Isolate");
    expect(button.props.disabled).toBe(false);
    button.props.onClick?.();
    expect(confirmIsolation).toHaveBeenCalledTimes(1);
    expect(exitIsolation).not.toHaveBeenCalled();
  });

  it("exits isolation when a session is loaded and isolation is active", () => {
    const confirmIsolation = vi.fn(() => false);
    const exitIsolation = vi.fn();
    const tree = renderSidebar(
      sidebarProps({
        session: { fileName: "a.obj" } as MeshSession,
        isolationActive: true,
        confirmIsolation,
        exitIsolation,
      }),
    );

    const button = buttonByLabel(tree, "Exit isolation");
    expect(button.props.disabled).toBe(false);
    button.props.onClick?.();
    expect(exitIsolation).toHaveBeenCalledTimes(1);
    expect(confirmIsolation).not.toHaveBeenCalled();
  });

  it("disables Isolate when there is no session", () => {
    const tree = renderSidebar(
      sidebarProps({
        session: null,
        isolationActive: false,
        confirmIsolation: () => false,
        exitIsolation: () => {},
      }),
    );

    const button = buttonByLabel(tree, "Isolate");
    expect(button.props.disabled).toBe(true);
  });
});
