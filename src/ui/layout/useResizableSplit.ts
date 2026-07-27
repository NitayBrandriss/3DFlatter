"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { clampSplitHeight } from "./clampSplitHeight";
import {
  SPLIT_2D_DEFAULT,
  SPLIT_2D_MIN,
  STORAGE_KEY_SPLIT_2D,
} from "./constants";
import {
  readStoredNumber,
  writeStoredNumber,
} from "./readLayoutStorage";

const KEYBOARD_STEP_PX = 16;

export function useResizableSplit(containerRef: RefObject<HTMLElement | null>) {
  const [split2dPx, setSplit2dPx] = useState(SPLIT_2D_DEFAULT);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const splitRef = useRef(split2dPx);
  const storageAppliedRef = useRef(false);

  useEffect(() => {
    splitRef.current = split2dPx;
  }, [split2dPx]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const h = container.getBoundingClientRect().height;
      setContainerHeight(h);
      if (h > 0) {
        setSplit2dPx((prev) => {
          const next = clampSplitHeight(h, prev);
          splitRef.current = next;
          return next;
        });
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  // LAYOUT-008 / LAYOUT-010: apply stored split once container is measurable.
  useEffect(() => {
    if (storageAppliedRef.current || containerHeight <= 0) return;
    storageAppliedRef.current = true;
    const stored = readStoredNumber(STORAGE_KEY_SPLIT_2D, SPLIT_2D_DEFAULT);
    const clamped = clampSplitHeight(containerHeight, stored);
    splitRef.current = clamped;
    setSplit2dPx(clamped);
  }, [containerHeight]);

  const applySplit = useCallback(
    (proposedPx: number, persist: boolean) => {
      const container = containerRef.current;
      const viewportH =
        container?.getBoundingClientRect().height ?? containerHeight;
      const next = clampSplitHeight(viewportH, proposedPx);
      splitRef.current = next;
      setSplit2dPx(next);
      if (persist) {
        writeStoredNumber(STORAGE_KEY_SPLIT_2D, next);
      }
    },
    [containerHeight, containerRef],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      document.body.classList.add("is-resizing");

      const updateFromClientY = (clientY: number) => {
        const rect = container.getBoundingClientRect();
        const proposed = rect.bottom - clientY;
        applySplit(proposed, false);
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        updateFromClientY(moveEvent.clientY);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        updateFromClientY(upEvent.clientY);
        writeStoredNumber(STORAGE_KEY_SPLIT_2D, splitRef.current);
        setIsDragging(false);
        document.body.classList.remove("is-resizing");
        event.currentTarget.releasePointerCapture(upEvent.pointerId);
        event.currentTarget.removeEventListener("pointermove", onPointerMove);
        event.currentTarget.removeEventListener("pointerup", onPointerUp);
        event.currentTarget.removeEventListener("pointercancel", onPointerUp);
      };

      event.currentTarget.addEventListener("pointermove", onPointerMove);
      event.currentTarget.addEventListener("pointerup", onPointerUp);
      event.currentTarget.addEventListener("pointercancel", onPointerUp);
    },
    [applySplit, containerRef],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? KEYBOARD_STEP_PX : -KEYBOARD_STEP_PX;
      applySplit(splitRef.current + delta, true);
    },
    [applySplit],
  );

  const maxSplitPx =
    containerHeight > 0
      ? clampSplitHeight(containerHeight, Number.MAX_SAFE_INTEGER)
      : clampSplitHeight(1000, Number.MAX_SAFE_INTEGER);

  return {
    split2dPx,
    isDragging,
    splitHandleProps: {
      onPointerDown,
      onKeyDown,
      tabIndex: 0,
      "aria-valuemin": SPLIT_2D_MIN,
      "aria-valuemax": maxSplitPx,
      "aria-valuenow": split2dPx,
    },
  };
}
