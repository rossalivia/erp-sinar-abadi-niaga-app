"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CommandMenu } from "./command-menu";
import { MobileDock } from "./mobile-dock";
import type { UserProfile } from "@/types/auth";
import { cn } from "@/lib/utils";

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("erp_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("erp_sidebar_collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Global shortcut handler untuk Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen flex bg-transparent">
      {/* Sidebar (Desktop Collapsible & Mobile Drawer) */}
      <Sidebar
        peran={user.peran}
        userName={user.nama_lengkap}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      {/* Main Container dengan responsive dynamic padding */}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 transition-all duration-250 ease-in-out",
          isSidebarCollapsed ? "md:pl-16" : "md:pl-60"
        )}
        data-app-shell-content
      >
        {/* Top Header */}
        <Header
          user={user}
          onOpenMobileSidebar={() => setIsMobileMenuOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />

        {/* Content Area dengan bottom padding untuk Apple Mobile Dock */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Apple-style Floating Glass Mobile Dock */}
      <MobileDock
        peran={user.peran}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenMobileSidebar={() => setIsMobileMenuOpen(true)}
      />

      {/* Global Quick Search / Command Palette */}
      <CommandMenu
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        peran={user.peran}
      />
    </div>
  );
}
