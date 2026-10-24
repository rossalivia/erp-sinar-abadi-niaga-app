'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, LogOut, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logoutAction } from '@/app/login/actions';
import type { UserProfile } from '@/types/auth';

interface HeaderProps {
  user: UserProfile;
  onOpenMobileSidebar?: () => void;
  onOpenSearch?: () => void;
}

const PERAN_BADGE_STYLE: Record<string, { label: string; variant: 'secondary' | 'info' | 'default' }> = {
  penjualan: { label: 'Staf Penjualan', variant: 'secondary' },
  gudang: { label: 'Staf Gudang', variant: 'info' },
  manajer: { label: 'Manajer', variant: 'default' },
};

export function Header({ user, onOpenMobileSidebar, onOpenSearch }: HeaderProps) {
  const [isPending, startTransition] = React.useTransition();
  const peranInfo = PERAN_BADGE_STYLE[user.peran] || {
    label: user.peran,
    variant: 'secondary' as const,
  };

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-white/70 bg-white/75 backdrop-blur-md px-4 sm:px-6 shadow-neu-flat">
      {/* Sisi Kiri: Tombol Menu Mobile & Search Quick Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-xl p-1.5 text-slate-600 hover:bg-slate-100/80 active:scale-95 transition-all md:hidden"
          aria-label="Buka navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block text-xs font-bold text-slate-800 tracking-tight">
          CV Sinar Abadi Niaga
        </div>

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 text-xs text-slate-500 bg-[#f4f7fb] hover:bg-white hover:text-indigo-600 border border-white/90 shadow-neu-sm rounded-xl transition-all cursor-pointer group"
            title="Cari Cepat Menu (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            <span className="text-[11px] font-mono">Cepat cari menu...</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.2 bg-white/90 border border-slate-200/80 rounded-md text-slate-400 shadow-xs">
              Ctrl+K
            </kbd>
          </button>
        )}
      </div>

      {/* Sisi Kanan: Pengguna & Tombol Keluar */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/profil"
          className="flex items-center gap-2.5 bg-white/60 hover:bg-white/90 border border-white/80 p-1.5 pr-2.5 rounded-full shadow-neu-sm transition-all"
          title="Buka Profil Saya"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shadow-xs">
            {user.nama_lengkap ? user.nama_lengkap.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800 leading-none">
              {user.nama_lengkap}
            </span>
            <span className="text-[9px] text-slate-400 capitalize mt-0.5">
              {peranInfo.label}
            </span>
          </div>
          <Badge variant={peranInfo.variant} className="ml-1 text-[9px] py-0 px-2">
            {user.peran}
          </Badge>
        </Link>

        <div className="h-4 w-px bg-slate-200/80 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isPending}
          className="text-slate-500 hover:text-red-600 hover:bg-red-50/80 rounded-xl text-xs px-2.5 gap-1.5"
          title="Keluar dari sistem"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>
  );
}
