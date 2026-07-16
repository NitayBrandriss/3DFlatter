"use client";

import { useCallback, useState } from "react";
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

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      onPeekChange(true);
    },
    onPointerUp: () => {
      endPeek();
    },
    onPointerCancel: () => {
      endPeek();
    },
    onLostPointerCapture: () => {
      endPeek();
    },
  };
}
