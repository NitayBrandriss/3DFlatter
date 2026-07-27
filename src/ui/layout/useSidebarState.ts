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
  // LAYOUT-004 / LAYOUT-010: defer localStorage until after mount.
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevOpenRef = useRef<boolean | null>(null);

  // LAYOUT-004 / LAYOUT-010: hydrate persisted sidebar preference after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only storage read
    setUserOverride(readStoredBoolean(STORAGE_KEY_SIDEBAR));
  }, []);

  // First visit after hydrate: desktop open, mobile closed. Persist wins when set.
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
    if (!sidebarOpen || isDesktop) {
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
  }, [isDesktop, persistOverride, sidebarOpen]);

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
