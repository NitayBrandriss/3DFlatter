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
      openButtonRef.current?.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [persistOverride, sidebarOpen]);

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
