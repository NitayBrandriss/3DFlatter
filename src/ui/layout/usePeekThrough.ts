"use client";

import { useCallback, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export function usePeekThrough() {
  const [isPeeking, setIsPeeking] = useState(false);

  const onPeekChange = useCallback((next: boolean) => {
    setIsPeeking(next);
  }, []);

  return { isPeeking, onPeekChange };
}

export function usePeekThroughBind(
  enabled: boolean,
  onPeekChange: (next: boolean) => void,
) {
  const endPeek = useCallback(() => {
    if (enabled) {
      onPeekChange(false);
    }
  }, [enabled, onPeekChange]);

  // LAYOUT-009: no pointer capture — avoids stealing moves from nested range inputs.
  return useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!enabled) {
          return;
        }
        if (event.button !== 0) {
          return;
        }
        onPeekChange(true);
      },
      onPointerUp: () => {
        endPeek();
      },
      onPointerCancel: () => {
        endPeek();
      },
    }),
    [enabled, endPeek, onPeekChange],
  );
}
