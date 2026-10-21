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
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMenuItemsForRole, MenuItem } from '@/lib/akses';
import type { Peran } from '@/types/auth';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Truck,
  Building2,
  BarChart3,
  UserCog,
  User,
  ShieldAlert,
};

interface SidebarProps {
  peran: Peran;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  peran,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const menuItems = getMenuItemsForRole(peran);

  const navContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-slate-100 border border-slate-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Sinar Abadi Niaga
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
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

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Menu Utama
        </div>
        <nav className="space-y-0.5">
          {menuItems.map((item: MenuItem) => {
            const Icon = ICON_MAP[item.icon] || LayoutDashboard;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-white' : 'text-slate-400'
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Role Footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="rounded bg-slate-800/60 px-2.5 py-1.5 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Hak Akses:</span>
          <span className="capitalize font-semibold text-slate-200">
            {peran}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 z-30 border-r border-slate-800">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-none"
            onClick={onCloseMobile}
          />
          <div className="relative flex w-64 flex-1 flex-col z-50">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
