"use client";

import type { ReactNode } from "react";
import { usePeekThroughBind } from "./usePeekThrough";

type PeekThroughControlProps = {
  enabled: boolean;
  isPeeking: boolean;
  onPeekChange: (next: boolean) => void;
  children: ReactNode;
};

export function PeekThroughControl({
  enabled,
  isPeeking,
  onPeekChange,
  children,
}: PeekThroughControlProps) {
  const bind = usePeekThroughBind(enabled, onPeekChange);

  return (
    <div
      className={isPeeking ? "peek-through-target" : undefined}
      {...bind}
    >
      {children}
    </div>
  );
}
