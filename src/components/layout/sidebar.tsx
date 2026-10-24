'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Search,
  Command,
  X,
  Layers,
  ClipboardCheck,
  ClipboardList,
  ReceiptText,
  Upload,
  TrendingUp,
  Mail,
  CreditCard,
  ShieldCheck,
  UserCog,
  User,
  ShieldAlert,
  LucideIcon,
} from 'lucide-react';
import { MENU_ITEMS, type MenuItem } from '@/lib/akses';
import type { Peran } from '@/types/auth';

const ICON_MAP: Record<string, LucideIcon> = {
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
  Layers,
  ClipboardCheck,
  ClipboardList,
  ReceiptText,
  Upload,
  TrendingUp,
  Mail,
  CreditCard,
  ShieldCheck,
  UserCog,
  User,
  ShieldAlert,
};

/** Definisi 5 urutan section sidebar sesuai standar enterprise */
const SIDEBAR_SECTIONS: { label: string; isRestricted?: boolean; hrefs: string[] }[] = [
  {
    label: 'Menu Utama',
    hrefs: ['/'],
  },
  {
    label: 'Inventory & Stok',
    hrefs: ['/barang', '/stok', '/stok/opname', '/gudang/picking'],
  },
  {
    label: 'Transaksi & Penjualan',
    hrefs: [
      '/pesanan',
      '/pelanggan',
      '/pembelian',
      '/pemasok',
      '/penagihan',
      '/kredit',
      '/persetujuan',
      '/pembayaran',
    ],
  },
  {
    label: 'Keuangan & Laporan',
    isRestricted: true,
    hrefs: ['/laporan', '/analitik'],
  },
  {
    label: 'Admin',
    hrefs: ['/akun', '/profil', '/audit', '/impor', '/notifikasi'],
  },
];

export interface SidebarProps {
  peran?: Peran;
  userRole?: 'manager' | 'sales' | 'warehouse' | Peran;
  userName?: string;
  onOpenSearch?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

function NavItem({
  item,
  pathname,
  onCloseMobile,
}: {
  item: MenuItem;
  pathname: string;
  onCloseMobile?: () => void;
}) {
  const Icon = ICON_MAP[item.icon] || LayoutDashboard;
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onCloseMobile}
      className={`flex items-center justify-between px-3 py-2 rounded-none text-xs font-medium transition-colors ${
        isActive
          ? 'bg-indigo-600 text-white shadow-sm font-semibold'
          : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
        <span className="truncate">{item.title}</span>
      </div>

      {/* Badge aksen untuk menu tertentu */}
      {item.href === '/pesanan' && (
        <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-none text-[10px] font-mono font-semibold">
          B2B
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  peran,
  userRole,
  userName,
  onOpenSearch,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  // Normalisasi peran pengguna
  const normalizedRole: Peran =
    peran ||
    (userRole === 'manager'
      ? 'manajer'
      : userRole === 'sales'
        ? 'penjualan'
        : userRole === 'warehouse'
          ? 'gudang'
          : (userRole as Peran)) ||
    'penjualan';

  const canViewFinancials = normalizedRole === 'manajer';
  const displayName =
    userName ||
    (normalizedRole === 'manajer'
      ? 'Manajer'
      : normalizedRole === 'penjualan'
        ? 'Staf Penjualan'
        : 'Staf Gudang');

  // Filter menu yang diizinkan untuk peran pengguna aktif
  const allowedItems = MENU_ITEMS.filter((item) => item.roles.includes(normalizedRole));

  // Kelompokkan menu ke dalam 5 section resmi
  const sections = SIDEBAR_SECTIONS.map((section) => ({
    label: section.label,
    isRestricted: section.isRestricted,
    items: section.hrefs
      .map((href) => allowedItems.find((m) => m.href === href))
      .filter((m): m is MenuItem => m !== undefined),
  })).filter((section) => section.items.length > 0);

  const navContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-slate-950 shrink-0">
        <Link href="/" onClick={onCloseMobile} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-none bg-indigo-600 flex items-center justify-center font-bold text-white text-xs tracking-widest shadow-sm">
            SA
          </div>
          <div className="flex flex-col truncate">
            <span className="font-bold text-xs text-slate-100 tracking-wide truncate">
              Sinar Abadi Niaga
            </span>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider">
              ERP DISTRIBUSI
            </span>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="rounded-none p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Search Trigger */}
      <div className="px-3 pt-3.5 pb-2 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-none text-xs text-slate-400 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-200" />
            <span className="font-mono text-[11px]">Cepat cari menu...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded-none">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div
              className={`px-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between ${
                section.isRestricted && canViewFinancials
                  ? 'text-amber-400/90'
                  : 'text-slate-400'
              }`}
            >
              <span>{section.label}</span>
              {section.isRestricted && canViewFinancials && (
                <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1 rounded-none font-mono">
                  Restricted
                </span>
              )}
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onCloseMobile={onCloseMobile}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5 truncate">
          <div className="h-7 w-7 rounded-none bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-xs font-medium text-slate-200 truncate">{displayName}</span>
            <span className="text-[9px] uppercase font-mono text-indigo-400 font-semibold tracking-wider">
              {normalizedRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed w-64) */}
      <aside className="z-30 hidden border-r border-slate-800 md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-none"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 flex w-64 flex-1 flex-col shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
