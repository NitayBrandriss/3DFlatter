"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
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

export function useResizableSplit(containerRef: RefObject<HTMLElement | null>) {
  const [split2dPx, setSplit2dPx] = useState(() =>
    readStoredNumber(STORAGE_KEY_SPLIT_2D, SPLIT_2D_DEFAULT),
  );
  const [isDragging, setIsDragging] = useState(false);
  const splitRef = useRef(split2dPx);
  splitRef.current = split2dPx;

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      document.body.classList.add("is-resizing");

      const container = containerRef.current;
      if (!container) {
        return;
      }

      const updateFromClientY = (clientY: number) => {
        const rect = container.getBoundingClientRect();
        const proposed = rect.bottom - clientY;
        const next = clampSplitHeight(rect.height, proposed);
        splitRef.current = next;
        setSplit2dPx(next);
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
    [containerRef],
  );

  const containerHeight = containerRef.current?.getBoundingClientRect().height ?? 1000;
  const maxSplitPx = clampSplitHeight(containerHeight, Number.MAX_SAFE_INTEGER);

  return {
    split2dPx,
    isDragging,
    splitHandleProps: {
      onPointerDown,
      "aria-valuemin": SPLIT_2D_MIN,
      "aria-valuemax": maxSplitPx,
      "aria-valuenow": split2dPx,
    },
  };
}
