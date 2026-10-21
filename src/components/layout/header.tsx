'use client';

import * as React from 'react';
import { Menu, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logoutAction } from '@/app/login/actions';
import type { UserProfile } from '@/types/auth';

interface HeaderProps {
  user: UserProfile;
  onOpenMobileSidebar?: () => void;
}

const PERAN_BADGE_STYLE: Record<string, { label: string; variant: 'secondary' | 'info' | 'default' }> = {
  penjualan: { label: 'Staf Penjualan', variant: 'secondary' },
  gudang: { label: 'Staf Gudang', variant: 'info' },
  manajer: { label: 'Manajer', variant: 'default' },
};

export function Header({ user, onOpenMobileSidebar }: HeaderProps) {
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
      {/* Sisi Kiri: Tombol Menu Mobile */}
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
      </div>

      {/* Sisi Kanan: Pengguna & Tombol Keluar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
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
        </div>

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
