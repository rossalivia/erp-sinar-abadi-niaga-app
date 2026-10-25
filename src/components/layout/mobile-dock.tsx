'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Search,
  Menu,
} from 'lucide-react';
import type { Peran } from '@/types/auth';

interface MobileDockProps {
  peran: Peran;
  onOpenSearch?: () => void;
  onOpenMobileSidebar?: () => void;
}

export function MobileDock({
  onOpenSearch,
  onOpenMobileSidebar,
}: MobileDockProps) {
  const pathname = usePathname();
  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(path));

  return (
    <nav
      aria-label="Navigasi Bawah Mobile"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 md:hidden w-[90%] max-w-sm rounded-full bg-white/90 backdrop-blur-xl border border-[#e2ebf6] shadow-2xl px-3 py-1.5 flex items-center justify-around transition-all"
    >
      {/* 1. Dashboard */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center p-2 rounded-full transition-all ${
          pathname === '/'
            ? 'bg-[#0c1b3a] text-white shadow-neu-sm'
            : 'text-slate-600 hover:text-[#0c1b3a] active:scale-95'
        }`}
        title="Dashboard"
      >
        <LayoutDashboard className="h-4 w-4" />
        <span className="sr-only">Dashboard</span>
      </Link>

      {/* 2. Pesanan Jual */}
      <Link
        href="/pesanan"
        className={`flex flex-col items-center justify-center p-2 rounded-full transition-all ${
          isActive('/pesanan')
            ? 'bg-[#0c1b3a] text-white shadow-neu-sm'
            : 'text-slate-600 hover:text-[#0c1b3a] active:scale-95'
        }`}
        title="Pesanan"
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="sr-only">Pesanan</span>
      </Link>

      {/* 3. Quick Search Trigger (Tengah / Menonjol) */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center justify-center h-10 w-10 rounded-full bg-[#0c1b3a] text-white shadow-neu-sm hover:bg-[#162d5c] active:scale-90 transition-all cursor-pointer -translate-y-2 border-2 border-white"
        title="Cari Cepat (Ctrl+K)"
        aria-label="Buka pencarian cepat"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* 4. Katalog Barang */}
      <Link
        href="/barang"
        className={`flex flex-col items-center justify-center p-2 rounded-full transition-all ${
          isActive('/barang')
            ? 'bg-[#0c1b3a] text-white shadow-neu-sm'
            : 'text-slate-600 hover:text-[#0c1b3a] active:scale-95'
        }`}
        title="Katalog Barang"
      >
        <Package className="h-4 w-4" />
        <span className="sr-only">Barang</span>
      </Link>

      {/* 5. Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex flex-col items-center justify-center p-2 rounded-full text-slate-600 hover:text-slate-900 active:scale-95 transition-all cursor-pointer"
        title="Buka Menu Lengkap"
        aria-label="Buka menu lengkap"
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Menu</span>
      </button>
    </nav>
  );
}
