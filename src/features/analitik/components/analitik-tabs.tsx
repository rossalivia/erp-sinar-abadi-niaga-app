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
    <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={getTabHref(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              isActive
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
