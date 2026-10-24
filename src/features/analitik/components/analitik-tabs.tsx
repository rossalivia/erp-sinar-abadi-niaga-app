'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Users, Award, UserX, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabAnalitik } from '../types';

interface AnalitikTabsProps {
  activeTab: TabAnalitik;
}

export function AnalitikTabs({ activeTab }: AnalitikTabsProps) {
  const searchParams = useSearchParams();

  function getTabHref(tab: TabAnalitik) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    return `/analitik?${params.toString()}`;
  }

  const tabs: { key: TabAnalitik; label: string; icon: React.ElementType }[] = [
    { key: 'sales', label: 'Performa Sales', icon: Users },
    { key: 'pelanggan', label: 'Pelanggan Teratas', icon: Award },
    { key: 'dormant', label: 'Pelanggan Pasif', icon: UserX },
    { key: 'deadstock', label: 'Barang Tidak Bergerak', icon: PackageX },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-neu-inset overflow-x-auto w-fit">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={getTabHref(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap',
              isActive
                ? 'bg-white text-slate-900 font-semibold shadow-neu-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', isActive && 'text-indigo-600')} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
