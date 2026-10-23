'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Truck,
  BarChart3,
  UserCog,
  ShieldAlert,
  User,
  Building2,
  X,
  Layers,
  ClipboardCheck,
  ClipboardList,
  ReceiptText,
  Upload,
  TrendingUp,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MENU_ITEMS, MenuItem } from '@/lib/akses';
import type { Peran } from '@/types/auth';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Layers,
  ClipboardCheck,
  ClipboardList,
  Users,
  ShoppingCart,
  ReceiptText,
  Truck,
  Building2,
  BarChart3,
  TrendingUp,
  UserCog,
  User,
  ShieldAlert,
  Upload,
};

/** Definisi urutan dan pengelompokan section sidebar */
const SIDEBAR_SECTIONS: { label: string; hrefs: string[] }[] = [
  {
    label: 'Menu Utama',
    hrefs: ['/'],
  },
  {
    label: 'Inventory & Gudang',
    hrefs: ['/barang', '/stok', '/stok/opname', '/gudang/picking'],
  },
  {
    label: 'Transaksi & Penjualan',
    hrefs: ['/pelanggan', '/pesanan', '/penagihan', '/persetujuan', '/pembelian', '/pemasok'],
  },
  {
    label: 'Keuangan & Laporan',
    hrefs: ['/laporan', '/analitik'],
  },
  {
    label: 'Administrasi Sistem',
    hrefs: ['/akun', '/profil', '/audit', '/impor'],
  },
];

interface SidebarProps {
  peran: Peran;
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
  const isActive =
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onCloseMobile}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-slate-700/80 text-white font-semibold'
          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          isActive ? 'text-white' : 'text-slate-400'
        )}
      />
      <span>{item.title}</span>
    </Link>
  );
}

function SidebarSection({
  label,
  items,
  pathname,
  onCloseMobile,
}: {
  label: string;
  items: MenuItem[];
  pathname: string;
  onCloseMobile?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="px-2.5 pb-1 pt-0.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 select-none">
          {label}
        </span>
      </div>
      <nav className="space-y-0.5 px-1">
        {items.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            pathname={pathname}
            onCloseMobile={onCloseMobile}
          />
        ))}
      </nav>
    </div>
  );
}

export function Sidebar({
  peran,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  // Filter semua menu items berdasarkan peran
  const allowedItems = MENU_ITEMS.filter((item) => item.roles.includes(peran));

  // Susun section; urutan item mengikuti SIDEBAR_SECTIONS (bukan urutan akses.ts)
  const sections = SIDEBAR_SECTIONS.map((section) => ({
    label: section.label,
    items: section.hrefs
      .map((href) => allowedItems.find((m) => m.href === href))
      .filter((m): m is MenuItem => m !== undefined),
  }));

  const navContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      {/* Brand Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-100">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase leading-tight tracking-wider text-white">
              Sinar Abadi Niaga
            </span>
            <span className="font-mono text-[10px] leading-tight text-slate-500">
              ERP Enterprise
            </span>
          </div>
        </Link>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation — grouped sections */}
      <div className="flex-1 overflow-y-auto px-1 py-3">
        {sections.map((section) => (
          <SidebarSection
            key={section.label}
            label={section.label}
            items={section.items}
            pathname={pathname}
            onCloseMobile={onCloseMobile}
          />
        ))}
      </div>

      {/* Role Footer */}
      <div className="shrink-0 border-t border-slate-800 p-3">
        <div className="flex items-center justify-between rounded bg-slate-800/60 px-2.5 py-1.5 text-[11px] text-slate-400">
          <span>Hak Akses:</span>
          <span className="font-semibold capitalize text-slate-200">
            {peran}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className="z-30 hidden border-r border-slate-800 md:fixed md:inset-y-0 md:flex md:w-56 md:flex-col">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-none"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 flex w-64 flex-1 flex-col">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
