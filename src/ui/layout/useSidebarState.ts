"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DESKTOP_MEDIA_QUERY,
  SIDEBAR_DRAWER_ID,
  STORAGE_KEY_SIDEBAR,
} from "./constants";
import {
  readStoredBoolean,
  writeStoredBoolean,
} from "./readLayoutStorage";
import { useMediaQuery } from "./useMediaQuery";

export function useSidebarState() {
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [userOverride, setUserOverride] = useState<boolean | null>(() =>
    readStoredBoolean(STORAGE_KEY_SIDEBAR),
  );
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef<boolean | null>(null);

  // First visit: desktop open, mobile closed. Persist wins after explicit toggle.
  const sidebarOpen = userOverride ?? isDesktop;

  const persistOverride = useCallback((open: boolean) => {
    setUserOverride(open);
    writeStoredBoolean(STORAGE_KEY_SIDEBAR, open);
  }, []);

  const toggleSidebar = useCallback(() => {
    persistOverride(!(userOverride ?? isDesktop));
  }, [isDesktop, persistOverride, userOverride]);

  const closeSidebar = useCallback(() => {
    persistOverride(false);
  }, [persistOverride]);

  const closeIfMobile = useCallback(() => {
    if (!isDesktop) {
      persistOverride(false);
    }
  }, [isDesktop, persistOverride]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      persistOverride(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [persistOverride, sidebarOpen]);

  // Focus open control after close (button mounts only when collapsed — A11Y-001).
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = sidebarOpen;
    if (wasOpen === true && !sidebarOpen) {
      openButtonRef.current?.focus();
    }
  }, [sidebarOpen]);

  return {
    isDesktop,
    sidebarOpen,
    toggleSidebar,
    closeSidebar,
    closeIfMobile,
    openButtonRef,
    sidebarDrawerId: SIDEBAR_DRAWER_ID,
  };
}
