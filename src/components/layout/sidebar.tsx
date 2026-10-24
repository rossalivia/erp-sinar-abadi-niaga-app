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
  ClipboardList,
  Layers,
  User,
  ShieldCheck,
  CreditCard,
  Upload,
} from 'lucide-react';
import type { Peran } from '@/types/auth';

export interface SidebarProps {
  peran: Peran;
  userName: string;
  onOpenSearch?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  userRole?: string;
}

export function Sidebar({
  peran,
  userName,
  onOpenSearch,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(path));

  // Hak akses ketat berdasarkan RBAC Matrix
  const canViewFinancials = peran === 'manajer';
  const isPenjualan = peran === 'penjualan' || peran === 'manajer';
  const isGudang = peran === 'gudang' || peran === 'manajer';

  return (
    <>
      {/* Backdrop Mobile Drawer */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900/95 backdrop-blur-xl text-slate-300 flex flex-col border-r border-slate-800/80 select-none transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <Link href="/" onClick={onCloseMobile} className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-xs tracking-wider shadow-inner border border-white/20">
              SA
            </div>
            <div className="flex flex-col truncate">
              <span className="font-bold text-xs text-slate-100 tracking-wide truncate">
                Sinar Abadi Niaga
              </span>
              <span className="text-[9px] text-indigo-400 font-mono tracking-wider font-semibold">
                ERP DISTRIBUSI B2B
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Search Bar Trigger (Command Palette) */}
        <div className="px-3 pt-3.5 pb-2 shrink-0">
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-xs text-slate-400 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
              <span className="font-mono text-[11px]">Cepat cari menu...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded-lg">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Navigation Sections (5 Kategori Resmi) */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {/* 1. Menu Utama */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Menu Utama
            </div>
            <Link
              href="/"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                pathname === '/'
                  ? 'bg-indigo-600 text-white shadow-neu-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Dashboard</span>
            </Link>
            {isPenjualan && (
              <Link
                href="/pesanan"
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/pesanan')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span>Pesanan B2B</span>
                </div>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.2 rounded-full text-[10px] font-mono font-semibold">
                  12
                </span>
              </Link>
            )}
            {isPenjualan && (
              <Link
                href="/pelanggan"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/pelanggan')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>Pelanggan / Toko</span>
              </Link>
            )}
          </div>

          {/* 2. Inventory & Gudang */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Inventory & Gudang
            </div>
            <Link
              href="/barang"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive('/barang')
                  ? 'bg-indigo-600 text-white shadow-neu-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              <span>Katalog & Stok Barang</span>
            </Link>
            {isGudang && (
              <Link
                href="/stok"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/stok') && !pathname.includes('/stok/opname')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>Kartu Stok & Mutasi</span>
              </Link>
            )}
            {isGudang && (
              <Link
                href="/stok/opname"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/stok/opname')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Stok Opname Gudang</span>
              </Link>
            )}
            {isGudang && (
              <Link
                href="/gudang/picking"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/gudang/picking')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span>Daftar Ambil Barang</span>
              </Link>
            )}
          </div>

          {/* 3. Transaksi & Penjualan */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Transaksi & Penjualan
            </div>
            {isGudang && (
              <Link
                href="/pembelian"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/pembelian')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>Pembelian Pemasok</span>
              </Link>
            )}
            {isGudang && (
              <Link
                href="/pemasok"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/pemasok')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Truck className="h-4 w-4 shrink-0" />
                <span>Daftar Pemasok</span>
              </Link>
            )}
            {isPenjualan && (
              <Link
                href="/penagihan"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/penagihan')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                <span>Penagihan Piutang</span>
              </Link>
            )}
            {canViewFinancials && (
              <Link
                href="/persetujuan"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/persetujuan')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Persetujuan Harga</span>
              </Link>
            )}
          </div>

          {/* 4. Keuangan & Laporan (Manajer Only) */}
          {canViewFinancials && (
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between font-mono">
                <span>Keuangan & Laporan</span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-mono">
                  Restricted
                </span>
              </div>
              <Link
                href="/laporan"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/laporan')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Laporan Laba/Rugi & HPP</span>
              </Link>
              <Link
                href="/analitik"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/analitik')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Analitik Penjualan</span>
              </Link>
              <Link
                href="/pembayaran"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/pembayaran')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>Pembayaran Mayar</span>
              </Link>
            </div>
          )}

          {/* 5. Administrasi Sistem */}
          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              Administrasi Sistem
            </div>
            <Link
              href="/profil"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive('/profil')
                  ? 'bg-indigo-600 text-white shadow-neu-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Profil Saya</span>
            </Link>
            {canViewFinancials && (
              <Link
                href="/akun"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/akun') || isActive('/pengaturan/akun')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Pengaturan Akun & Peran</span>
              </Link>
            )}
            {canViewFinancials && (
              <Link
                href="/audit"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/audit') || isActive('/pengaturan/audit-log')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Database className="h-4 w-4 shrink-0" />
                <span>Append-Only Audit Log</span>
              </Link>
            )}
            {canViewFinancials && (
              <Link
                href="/impor"
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive('/impor')
                    ? 'bg-indigo-600 text-white shadow-neu-sm'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>Impor Data CSV</span>
              </Link>
            )}
          </div>
        </div>

        {/* User Footer Profile */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 truncate">
            <div className="h-8.5 w-8.5 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-bold text-slate-200 shadow-inner">
              {userName ? userName.charAt(0) : 'U'}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {userName || 'Pengguna'}
              </span>
              <span className="text-[9px] uppercase font-mono text-indigo-400 font-bold tracking-wider">
                {peran}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
