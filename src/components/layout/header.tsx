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
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Sisi Kiri: Tombol Menu Mobile & Search Quick Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="rounded p-1 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Buka navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block text-xs text-slate-500 font-medium">
          CV Sinar Abadi Niaga
        </div>

        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="hidden md:flex items-center gap-2 px-2.5 py-1 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-none transition-colors cursor-pointer"
            title="Cari Cepat Menu (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[11px] font-mono">Cari cepat...</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 bg-white border border-slate-200 text-slate-400">
              Ctrl+K
            </kbd>
          </button>
        )}
      </div>

      {/* Sisi Kanan: Pengguna & Tombol Keluar */}
      <div className="flex items-center gap-3">
        <Link
          href="/profil"
          className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-md transition-colors"
          title="Buka Profil Saya"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-800 leading-none">
              {user.nama_lengkap}
            </span>
            <span className="text-[10px] text-slate-400 capitalize mt-0.5">
              {peranInfo.label}
            </span>
          </div>
          <Badge variant={peranInfo.variant} className="ml-1 text-[10px] py-0">
            {user.peran}
          </Badge>
        </Link>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isPending}
          className="text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs px-2 gap-1.5"
          title="Keluar dari sistem"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>
  );
}
