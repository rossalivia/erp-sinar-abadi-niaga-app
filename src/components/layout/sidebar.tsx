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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
    return pathname === path || pathname.startsWith(path);
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

  // 5 Kategori Navigasi Resmi sesuai Aturan Kerja
  const navCategories: NavCategory[] = [
    {
      title: "Menu Utama",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
        ...(isPenjualan
          ? [
              {
                href: "/pesanan",
                label: "Pesanan B2B",
                icon: ShoppingCart,
              },
              {
                href: "/pelanggan",
                label: "Pelanggan & Toko",
                icon: Users,
              },
            ]
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
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 bg-[#0c1b3a] text-slate-300 flex flex-col border-r border-[#152a54] select-none transition-all duration-250 ease-in-out md:translate-x-0 shadow-2xl",
          isCollapsed ? "w-16" : "w-60",
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-[#152a54] bg-[#08132b]/90 shrink-0">
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
              <Logo size="xs" variant="icon" />
            ) : (
              <Logo size="xs" inverted={true} showSubdeskripsi={false} />
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-thin scrollbar-thumb-[#152a54]">
          {navCategories.map((category) => {
            const isCategoryCollapsed = collapsedCategories[category.title] && !isCollapsed;

            return (
              <div key={category.title} className="space-y-1">
                {/* Section Header */}
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.title)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#566e94] hover:text-slate-200 transition-colors font-mono cursor-pointer"
                  >
                    <span className="truncate">{category.title}</span>
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 transition-transform duration-200 shrink-0",
                        isCategoryCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <div className="my-1.5 border-t border-[#152a54]/80" />
                )}

                {/* Items */}
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

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onCloseMobile}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                              "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors group",
                              active
                                ? "text-white font-semibold"
                                : "text-[#8ea2c2] hover:text-white hover:bg-white/6",
                              isCollapsed && "justify-center px-0 py-2"
                            )}
                          >
                            {/* Animated Background Pill for Active Link (GeneX Deep Navy Pill) */}
                            {active && (
                              <motion.div
                                layoutId="sidebar-active-pill"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                className="absolute inset-0 bg-[#183162] border border-[#2b4e91]/60 rounded-xl -z-10 shadow-xs"
                              />
                            )}

                            <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />

                            {!isCollapsed && (
                              <span className="truncate flex-1">{item.label}</span>
                            )}

                            {!isCollapsed && item.badge !== undefined && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-semibold shrink-0 border",
                                  item.badgeVariant === "amber"
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                    : "bg-blue-500/25 text-blue-200 border-blue-400/30"
                                )}
                              >
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

        {/* Footer: User Badge & Collapse Toggle */}
        <div className="p-2.5 border-t border-[#152a54] bg-[#08132b]/90 flex items-center justify-between shrink-0">
          <Link
            href="/profil"
            onClick={onCloseMobile}
            className={cn(
              "flex items-center gap-2 truncate p-1 rounded-xl hover:bg-white/6 transition-colors flex-1",
              isCollapsed && "justify-center"
            )}
            title="Buka Profil"
          >
            <div className="h-7 w-7 rounded-lg bg-[#183162] border border-[#2b4e91]/60 flex items-center justify-center text-xs font-bold text-blue-200 shrink-0">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-slate-200 truncate leading-tight">
                  {userName || "Pengguna"}
                </span>
                <span className="text-[9px] uppercase font-mono text-blue-300 font-bold tracking-wider leading-tight">
                  {peran}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={cn(
                "hidden md:flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0",
                isCollapsed && "w-full mt-1"
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
