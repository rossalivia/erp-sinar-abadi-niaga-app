'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TabAnalitik } from '../types';

interface FilterBarProps {
  tab: TabAnalitik;
  preset?: string;
  dari?: string;
  sampai?: string;
  ambang?: number;
}

export function FilterBar({ tab, preset = '8', dari = '', sampai = '', ambang = 30 }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tglDari, setTglDari] = React.useState(dari);
  const [tglSampai, setTglSampai] = React.useState(sampai);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Filter untuk Tab Sales & Pelanggan: Berbasis Rentang Tanggal
  if (tab === 'sales' || tab === 'pelanggan') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 border border-white/80 rounded-2xl shadow-neu-sm">
        {/* Preset Periode */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Periode:
          </span>
          {[
            { label: '4 Minggu', val: '4' },
            { label: '8 Minggu', val: '8' },
            { label: '12 Minggu', val: '12' },
          ].map((item) => (
            <Button
              key={item.val}
              size="sm"
              variant={preset === item.val ? 'default' : 'outline'}
              className="text-xs h-7 px-2.5 shadow-none"
              onClick={() => {
                updateQuery({ preset: item.val, dari: null, sampai: null });
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Custom Range Picker */}
        <form
          className="flex items-center gap-2 flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (tglDari && tglSampai) {
              updateQuery({ preset: null, dari: tglDari, sampai: tglSampai });
            }
          }}
        >
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <Input
              type="date"
              value={tglDari}
              onChange={(e) => setTglDari(e.target.value)}
              className="h-7 text-xs w-32 shadow-none"
            />
            <span>s/d</span>
            <Input
              type="date"
              value={tglSampai}
              onChange={(e) => setTglSampai(e.target.value)}
              className="h-7 text-xs w-32 shadow-none"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="text-xs h-7 px-2 shadow-none">
            Terapkan
          </Button>
        </form>
      </div>
    );
  }

  // Filter untuk Tab Dormant & Deadstock: Berbasis Ambang Batas Hari Inaktivitas
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 border border-white/80 rounded-2xl shadow-neu-sm">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1 mr-1">
          <Clock className="w-3.5 h-3.5" />
          Ambang Batas Inaktivitas:
        </span>
        {[
          { label: '≥ 30 Hari', val: 30 },
          { label: '≥ 60 Hari', val: 60 },
          { label: '≥ 90 Hari', val: 90 },
          { label: '≥ 180 Hari', val: 180 },
        ].map((item) => (
          <Button
            key={item.val}
            size="sm"
            variant={ambang === item.val ? 'default' : 'outline'}
            className="text-xs h-7 px-2.5 shadow-none"
            onClick={() => updateQuery({ ambang: item.val.toString() })}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="text-[11px] text-slate-400">
        Menampilkan entitas yang tidak memiliki pergerakan transaksi selama ambang batas terpilih.
      </div>
    </div>
  );
}
