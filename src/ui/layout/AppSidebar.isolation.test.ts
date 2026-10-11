import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFaceMask, maskFromFaces } from "@/logic/isolation/faceMask";
import { openTube } from "@/logic/isolation/testMeshes";
import { buildTopology } from "@/logic/mesh/buildTopology";
import { createSeamRegistry } from "@/logic/seams/seamRegistry";
import {
  readIsolationConfirmBlockReason,
  useMeshSessionStore,
  type MeshSession,
} from "@/state/meshSessionStore";
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
  notifyToast?: (text: string, tone?: "info" | "warning") => void;
  isolationBlockReason?: () => string | null;
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
    notifyToast: options.notifyToast ?? (() => {}),
    isolationBlockReason: options.isolationBlockReason ?? (() => null),
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
    const notifyToast = vi.fn();
    const tree = renderSidebar(
      sidebarProps({
        session: { fileName: "a.obj" } as MeshSession,
        isolationActive: true,
        confirmIsolation,
        exitIsolation,
        notifyToast,
      }),
    );

    const button = buttonByLabel(tree, "Exit isolation");
    expect(button.props.disabled).toBe(false);
    button.props.onClick?.();
    expect(exitIsolation).toHaveBeenCalledTimes(1);
    expect(confirmIsolation).not.toHaveBeenCalled();
    expect(notifyToast).not.toHaveBeenCalled();
  });

  it("disables Isolate when there is no session", () => {
    const notifyToast = vi.fn();
    const tree = renderSidebar(
      sidebarProps({
        session: null,
        isolationActive: false,
        confirmIsolation: () => false,
        exitIsolation: () => {},
        notifyToast,
      }),
    );

    const button = buttonByLabel(tree, "Isolate");
    expect(button.props.disabled).toBe(true);
    button.props.onClick?.();
    expect(notifyToast).not.toHaveBeenCalled();
  });
});

const EMPTY_SENTENCE = "Cannot isolate an empty selection.";
const LENGTH_SENTENCE = "Cannot isolate: mask length does not match the mesh.";
const WHOLE_SENTENCE =
  "Cannot isolate the whole mesh. Add another bracelet or subtract a region.";

describe("ISO-UI-001 isolate button", () => {
  const toasts: { text: string; tone?: "info" | "warning" }[] = [];

  beforeEach(() => {
    toasts.length = 0;
    useMeshSessionStore.setState({
      session: null,
      meshLoadVersion: 0,
      cutStrokes: [],
      patternRevision: 0,
      isLoading: false,
      error: null,
      meshEditTool: "seam",
      toasts: [],
      toastSeq: 0,
      isolation: {
        active: false,
        mask: new Uint8Array(0),
        warnings: [],
        coversAllNonOrphanFaces: false,
      },
    });
  });

  function installTube(mask: Uint8Array, active = false) {
    const mesh = openTube(2, 4);
    expect(mesh.faceCount).toBe(8);
    useMeshSessionStore.setState({
      session: {
        mesh,
        topology: buildTopology(mesh),
        seams: createSeamRegistry(),
        fileName: "tube.obj",
      },
      meshLoadVersion: 4,
      patternRevision: 11,
      cutStrokes: [],
      isolation: {
        active,
        mask,
        warnings: [],
        coversAllNonOrphanFaces: false,
      },
    });
  }

  function propsFromStore(): AppSidebarProps {
    const state = useMeshSessionStore.getState();
    return sidebarProps({
      session: state.session,
      isolationActive: state.isolation.active,
      confirmIsolation: () => useMeshSessionStore.getState().confirmIsolation(),
      exitIsolation: () => useMeshSessionStore.getState().exitIsolation(),
      notifyToast: (text, tone) => {
        toasts.push({ text, tone });
      },
      isolationBlockReason: () =>
        readIsolationConfirmBlockReason(useMeshSessionStore.getState()),
    });
  }

  function clickIsolate() {
    const tree = renderSidebar(propsFromStore());
    buttonByLabel(tree, "Isolate").props.onClick?.();
    return renderSidebar(propsFromStore());
  }

  function expectVersionsStay() {
    const state = useMeshSessionStore.getState();
    expect(state.meshLoadVersion).toBe(4);
    expect(state.patternRevision).toBe(11);
  }

  it("refuses an empty mask and keeps the Isolate label", () => {
    installTube(createFaceMask(8));
    const tree = clickIsolate();
    const state = useMeshSessionStore.getState();

    expect(state.isolation.active).toBe(false);
    expect(state.isolation.mask.length).toBe(8);
    expect(Array.from(state.isolation.mask).every((bit) => bit === 0)).toBe(
      true,
    );
    expect(toasts).toEqual([{ text: EMPTY_SENTENCE, tone: "warning" }]);
    buttonByLabel(tree, "Isolate");
    expectVersionsStay();
  });

  it("confirms a single face and shows Exit isolation", () => {
    installTube(maskFromFaces(8, [0]));
    const tree = clickIsolate();
    const state = useMeshSessionStore.getState();

    expect(state.isolation.active).toBe(true);
    expect(Array.from(state.isolation.mask)).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0,
    ]);
    buttonByLabel(tree, "Exit isolation");
    expect(toasts.map((toast) => toast.text)).not.toContain(EMPTY_SENTENCE);
    expect(toasts.map((toast) => toast.text)).not.toContain(LENGTH_SENTENCE);
    expect(toasts.map((toast) => toast.text)).not.toContain(WHOLE_SENTENCE);
    expectVersionsStay();
  });

  it("refuses a mask that selects the whole mesh", () => {
    installTube(new Uint8Array(8).fill(1));
    clickIsolate();
    const state = useMeshSessionStore.getState();

    expect(state.isolation.active).toBe(false);
    expect(Array.from(state.isolation.mask)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(toasts).toEqual([{ text: WHOLE_SENTENCE, tone: "warning" }]);
    expectVersionsStay();
  });

  it("refuses a short mask before it is widened to an empty selection", () => {
    installTube(new Uint8Array(1));
    clickIsolate();
    const state = useMeshSessionStore.getState();

    expect(state.confirmIsolation()).toBe(false);
    expect(state.isolation.mask.length).toBe(1);
    expect(state.isolation.active).toBe(false);
    expect(toasts).toEqual([{ text: LENGTH_SENTENCE, tone: "warning" }]);
    expectVersionsStay();
  });
});
