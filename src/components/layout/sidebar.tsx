"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  ShoppingBag,
  Truck,
  Wallet,
  FileText,
  BarChart3,
  Settings,
  Database,
  Building2,
  ClipboardList,
  Layers,
  User,
  ShieldCheck,
  CreditCard,
  Upload,
  Mail,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Lock,
} from "lucide-react";
import type { Peran } from "@/types/auth";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

export interface SidebarProps {
  peran: Peran;
  userName: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: "amber" | "indigo" | "emerald";
  exact?: boolean;
}

interface NavCategory {
  title: string;
  restricted?: boolean;
  items: NavItem[];
}

export function Sidebar({
  peran,
  userName,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string, exact?: boolean) => {
    if (exact || path === "/") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const isManajer = peran === "manajer";
  const isPenjualan = peran === "penjualan" || peran === "manajer";
  const isGudang = peran === "gudang" || peran === "manajer";

  // State untuk collapsible category headers
  const [collapsedCategories, setCollapsedCategories] = React.useState<Record<string, boolean>>({});

  const toggleCategory = (title: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // 5 Kategori Navigasi Resmi sesuai Aturan Kerja (AGENTS.md Bagian 8.7)
  const navCategories: NavCategory[] = [
    {
      title: "Menu Utama",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/pusat-tugas", label: "Pusat Tugas", icon: Zap },
        { href: "/pesanan", label: "Pesanan B2B", icon: ShoppingCart },
        ...(isPenjualan
          ? [{ href: "/pelanggan", label: "Pelanggan & Toko", icon: Users }]
          : []),
      ],
    },
    {
      title: "Inventory & Gudang",
      items: [
        { href: "/barang", label: "Katalog & Stok Barang", icon: Package },
        ...(isGudang
          ? [
              { href: "/stok", label: "Kartu Stok & Mutasi", icon: Layers, exact: true },
              { href: "/stok/opname", label: "Stok Opname Gudang", icon: Building2 },
              { href: "/gudang/picking", label: "Daftar Ambil Barang", icon: ClipboardList },
            ]
          : []),
      ],
    },
    {
      title: "Transaksi & Penjualan",
      items: [
        ...(isGudang
          ? [
              { href: "/pembelian", label: "Pembelian Pemasok", icon: ShoppingBag },
              { href: "/pemasok", label: "Daftar Pemasok", icon: Truck },
            ]
          : []),
        ...(isPenjualan
          ? [{ href: "/penagihan", label: "Penagihan Piutang", icon: Wallet }]
          : []),
        ...(isManajer
          ? [{ href: "/persetujuan", label: "Persetujuan Harga", icon: ShieldCheck }]
          : []),
      ],
    },
    ...(isManajer
      ? [
          {
            title: "Keuangan & Laporan",
            restricted: true,
            items: [
              { href: "/laporan", label: "Laba/Rugi & HPP", icon: FileText },
              { href: "/analitik", label: "Analitik Penjualan", icon: BarChart3 },
              { href: "/pembayaran", label: "Pembayaran Mayar", icon: CreditCard },
            ],
          },
        ]
      : []),
    {
      title: "Administrasi Sistem",
      items: [
        { href: "/profil", label: "Profil Saya", icon: User },
        ...(isManajer
          ? [
              { href: "/akun", label: "Akun & Peran", icon: Settings },
              { href: "/audit", label: "Audit Log Sistem", icon: Database },
              { href: "/impor", label: "Impor Data CSV", icon: Upload },
              { href: "/notifikasi", label: "Notifikasi Stok", icon: Mail },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {/* Backdrop Mobile Drawer */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/75 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 bg-[#070f1e] text-slate-300 flex flex-col select-none transition-all duration-250 ease-in-out md:translate-x-0 md:shadow-none shadow-2xl",
          isCollapsed ? "w-16 border-r border-[#152747]" : "w-60",
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-[#152747] bg-[#050b17]/95 backdrop-blur-md shrink-0">
          <Link
            href="/"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-2.5 transition-all overflow-hidden",
              isCollapsed && "justify-center w-full"
            )}
            title="CV Sinar Abadi Niaga — Distributor Kebutuhan Toko Kelontong"
          >
            {isCollapsed ? (
              <Logo size="xs" variant="icon" inverted={true} />
            ) : (
              <div className="flex items-center justify-between w-full">
                <Logo size="xs" inverted={true} showSubdeskripsi={false} />
                <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[9px] font-mono font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ERP Live</span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div
          className={cn(
            "flex-1 overflow-y-auto py-3 space-y-4 sidebar-scroll",
            isCollapsed ? "px-2" : "pl-3 pr-0"
          )}
        >
          {navCategories.map((category) => {
            const isCategoryCollapsed = collapsedCategories[category.title] && !isCollapsed;

            return (
              <div key={category.title} className="space-y-1">
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.title)}
                    className="w-full flex items-center justify-between pl-2 pr-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#637d9f] hover:text-slate-200 transition-colors font-mono cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{category.title}</span>
                      {category.restricted && (
                        <Lock className="h-2.5 w-2.5 text-amber-400/80 shrink-0" />
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 transition-transform duration-200 shrink-0 text-[#435973]",
                        isCategoryCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <div className="my-1.5 border-t border-[#152747]/80 mx-1" />
                )}

                {/* Items Container */}
                <AnimatePresence initial={false}>
                  {!isCategoryCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-0.5"
                    >
                      {category.items.map((item) => {
                        const active = isActive(item.href, item.exact);
                        const Icon = item.icon;

                        // Collapsed Mode Item
                        if (isCollapsed) {
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onCloseMobile}
                              title={item.label}
                              className={cn(
                                "relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-150 group",
                                active
                                  ? "bg-[#142852] text-white border border-[#2b4d91] shadow-xs"
                                  : "text-[#8ea2c2] hover:text-white hover:bg-white/[0.06]"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
                              {active && (
                                <span className="absolute -left-1 top-2.5 bottom-2.5 w-1 rounded-r-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                              )}
                            </Link>
                          );
                        }

                        // Expanded Mode Item with Outside Concave Curve Effect
                        if (active) {
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onCloseMobile}
                              className="relative flex items-center gap-2.5 pl-3 pr-4 py-2.5 text-xs font-semibold bg-[var(--background)] text-slate-900 dark:text-white rounded-l-2xl z-30 group transition-all duration-150 -mr-[1px] w-[calc(100%+1px)] active:scale-[0.99]"
                            >
                              {/* Amber Dawn Pip ("Sinar Abadi" brand element) */}
                              <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />

                              {/* Top Outside Concave Curve (Inverted Corner) */}
                              <svg
                                className="absolute -top-4 -right-[1px] w-4 h-4 text-[var(--background)] fill-current pointer-events-none z-30"
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                              >
                                <path d="M16 0 C16 8.837 8.837 16 0 16 H16 V0 Z" />
                              </svg>

                              {/* Bottom Outside Concave Curve (Inverted Corner) */}
                              <svg
                                className="absolute -bottom-4 -right-[1px] w-4 h-4 text-[var(--background)] fill-current pointer-events-none z-30"
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                              >
                                <path d="M16 16 C16 7.163 8.837 0 0 0 H16 V16 Z" />
                              </svg>

                              <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform" />

                              <span className="truncate flex-1 tracking-tight font-semibold">
                                {item.label}
                              </span>

                              {item.badge !== undefined && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0 bg-slate-200/90 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        }

                        // Inactive Item
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onCloseMobile}
                            className="relative flex items-center gap-2.5 pl-3 pr-3.5 py-2 mr-2.5 text-xs font-medium text-[#8da3c5] hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-150 group active:scale-[0.99]"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-[#728aa9] group-hover:text-slate-200 group-hover:scale-105 transition-all" />
                            <span className="truncate flex-1 tracking-tight">{item.label}</span>
                            {item.badge !== undefined && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium shrink-0 bg-white/[0.07] text-slate-400 border border-white/[0.05]">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer: User Badge & Connection Status */}
        <div className="p-2.5 border-t border-[#152747] bg-[#050b17]/95 backdrop-blur-md flex items-center justify-between shrink-0 gap-2">
          <Link
            href="/profil"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-2 truncate p-1 rounded-xl hover:bg-white/[0.06] transition-colors flex-1",
              isCollapsed && "justify-center p-0"
            )}
            title="Buka Pengaturan Profil Saya"
          >
            <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-[#183163] to-[#0c1a35] border border-[#2b4c8f]/70 flex items-center justify-center text-xs font-bold text-sky-200 shrink-0 shadow-xs">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#070f1e]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate text-left">
                <span className="text-xs font-semibold text-slate-100 truncate leading-tight">
                  {userName || "Pengguna"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "text-[9px] uppercase font-mono font-bold tracking-wider leading-none px-1 py-0.2 rounded",
                      peran === "manajer" && "text-amber-400 bg-amber-500/15 border border-amber-500/30",
                      peran === "penjualan" && "text-blue-400 bg-blue-500/15 border border-blue-500/30",
                      peran === "gudang" && "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30"
                    )}
                  >
                    {peran}
                  </span>
                </div>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "hidden md:flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer",
                isCollapsed && "w-full mt-1.5"
              )}
              title={isCollapsed ? "Buka Sidebar (Expand)" : "Sempitkan Sidebar (Collapse)"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
