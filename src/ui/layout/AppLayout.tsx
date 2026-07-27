"use client";

import type { ReactNode } from "react";
import { ToastStack } from "@/ui/ToastStack";
import type { ToastMessage } from "@/state/meshSessionStore";

type AppLayoutProps = {
  sidebarOpen: boolean;
  isDesktop: boolean;
  isPeeking: boolean;
  onCloseSidebar: () => void;
  sidebar: ReactNode;
  toasts: ToastMessage[];
  onDismissToast: (id: number) => void;
  children: ReactNode;
};

/** LAYOUT-007: page shell — mobile backdrop lives with layout chrome, not loose in page. */
export function AppLayout({
  sidebarOpen,
  isDesktop,
  isPeeking,
  onCloseSidebar,
  sidebar,
  toasts,
  onDismissToast,
  children,
}: AppLayoutProps) {
  const showMobileBackdrop = !isDesktop && sidebarOpen && !isPeeking;

  return (
    <div
      className="page"
      data-sidebar={sidebarOpen ? "open" : "collapsed"}
      data-sidebar-peek={isPeeking ? "true" : "false"}
    >
      {showMobileBackdrop ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={onCloseSidebar}
        />
      ) : null}

      {sidebar}
      <ToastStack toasts={toasts} onDismiss={onDismissToast} />
      {children}
    </div>
  );
}
