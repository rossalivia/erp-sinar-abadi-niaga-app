"use client";

import * as React from "react";
import Link from "next/link";
import {
  Menu,
  LogOut,
  User,
  Search,
  ChevronDown,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import type { UserProfile } from "@/types/auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

import { ThemeToggle } from "@/components/theme/theme-toggle";

interface HeaderProps {
  user: UserProfile;
  onOpenMobileSidebar?: () => void;
  onOpenSearch?: () => void;
}

const PERAN_BADGE_STYLE: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  penjualan: {
    label: "Staf Penjualan",
    bg: "bg-[#e5f0fd] dark:bg-blue-950/60 border-[#bfdbfe] dark:border-blue-900",
    text: "text-[#1e40af] dark:text-blue-300",
  },
  gudang: {
    label: "Staf Gudang",
    bg: "bg-[#fef7e6] dark:bg-amber-950/60 border-[#fde68a] dark:border-amber-900",
    text: "text-[#92400e] dark:text-amber-300",
  },
  manajer: {
    label: "Manajer",
    bg: "bg-[#eaf1f9] dark:bg-slate-800 border-[#cbdff2] dark:border-slate-700",
    text: "text-[#0c1b3a] dark:text-slate-200",
  },
};

export function Header({
  user,
  onOpenMobileSidebar,
  onOpenSearch,
}: HeaderProps) {
  const [isPending, startTransition] = React.useTransition();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const peranInfo = PERAN_BADGE_STYLE[user.peran] || {
    label: user.peran,
    bg: "bg-[#f0f5fa] dark:bg-slate-800 border-[#e2ebf6] dark:border-slate-700",
    text: "text-[#0c1a30] dark:text-slate-200",
  };

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#e2ebf6] dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 shadow-[0_1px_3px_0_rgba(12,27,58,0.03)] dark:shadow-none transition-colors duration-150">
      {/* Sisi Kiri: Mobile Hamburger & Brand/Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-1.5 text-slate-600 dark:text-slate-400 hover:bg-[#f0f5fa] dark:hover:bg-slate-800 active:scale-95 transition-all md:hidden cursor-pointer"
          aria-label="Buka navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center">
          <Logo size="xs" showSubdeskripsi={false} />
        </div>
      </div>

      {/* Sisi Tengah: Single Command Palette Trigger */}
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-[#f0f5fa] dark:bg-slate-800/80 border border-[#e2ebf6] dark:border-slate-700/80 rounded-full hover:text-slate-800 dark:hover:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group max-w-xs sm:w-64 justify-between"
          title="Cari Cepat Menu (Ctrl+K)"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#2563eb] transition-colors" />
            <span className="text-xs truncate">Cari menu & pintasan...</span>
          </div>
          <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 bg-white dark:bg-slate-900 border border-[#e2ebf6] dark:border-slate-700 rounded text-slate-500 dark:text-slate-400 shadow-2xs">
            Ctrl+K
          </kbd>
        </button>
      )}

      {/* Sisi Kanan: Theme Toggle & Unified Profile & Account Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-[#f0f5fa] dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
          >
            <div className="h-7 w-7 rounded-full bg-[#0c1b3a] dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {user.nama_lengkap
                ? user.nama_lengkap.charAt(0).toUpperCase()
                : <User className="h-3.5 w-3.5" />}
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#0c1a30] dark:text-slate-100 leading-tight">
                {user.nama_lengkap}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {peranInfo.label}
              </span>
            </div>

            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-slate-400 transition-transform duration-150",
                isProfileOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-xl glass-dropdown border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-lg py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.nama_lengkap}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.2 rounded-full border font-semibold",
                      peranInfo.bg,
                      peranInfo.text
                    )}
                  >
                    {peranInfo.label}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  href="/profil"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profil & Pengaturan Akun</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isPending}
                  className="w-full flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-950/40 transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isPending ? "Sedang keluar..." : "Keluar dari Sistem"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
