'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  Star,
  Download,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  ShoppingCart,
  Boxes,
  BadgePercent,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Peran } from '@/types/auth';

interface ModuleCard {
  id: string;
  title: string;
  category: 'penjualan' | 'gudang' | 'keuangan';
  description: string;
  iconBg: string;
  iconColor: string;
  formats: ('PDF' | 'XLSX' | 'DOC')[];
  lastRun: string;
  href: string;
  isFavorite?: boolean;
}

const INITIAL_MODULES: ModuleCard[] = [
  {
    id: 'm1',
    title: 'Faktur & Omzet Penjualan',
    category: 'penjualan',
    description: 'Rekapitulasi penjualan per sales, faktur tertagih, dan tren komoditas.',
    iconBg: 'bg-[#0c1b3a]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '15 mnt lalu',
    href: '/pesanan',
    isFavorite: true,
  },
  {
    id: 'm2',
    title: 'Kartu Stok & Mutasi FIFO',
    category: 'gudang',
    description: 'Pencatatan keluar masuk barang real-time per batch gudang pusat.',
    iconBg: 'bg-[#2563eb]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '40 mnt lalu',
    href: '/stok',
    isFavorite: true,
  },
  {
    id: 'm3',
    title: 'Aging Piutang & Plafon Kredit',
    category: 'keuangan',
    description: 'Distribusi faktur jatuh tempo toko kelontong dan limit utang aktif.',
    iconBg: 'bg-[#059669]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '1 jam lalu',
    href: '/kredit',
    isFavorite: false,
  },
  {
    id: 'm4',
    title: 'Surat Jalan & Picking List',
    category: 'gudang',
    description: 'Daftar ambil koli barang dan manifes muatan armada pengiriman.',
    iconBg: 'bg-[#d97706]',
    iconColor: 'text-white',
    formats: ['PDF'],
    lastRun: '2 jam lalu',
    href: '/gudang/picking',
    isFavorite: false,
  },
  {
    id: 'm5',
    title: 'Pengadaan & PO Pemasok',
    category: 'penjualan',
    description: 'Purchase Order resmi bahan pokok grosir dan verifikasi penerimaan.',
    iconBg: 'bg-[#7c3aed]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '1 hari lalu',
    href: '/pembelian',
    isFavorite: true,
  },
  {
    id: 'm6',
    title: 'Berita Acara Stock Opname',
    category: 'gudang',
    description: 'Pemeriksaan fisik stok periodik, verifikasi selisih, dan adjustment.',
    iconBg: 'bg-[#0284c7]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '3 hari lalu',
    href: '/stok/opname',
    isFavorite: false,
  },
];

interface ScheduleItem {
  id: string;
  title: string;
  schedule: string;
  pic: string;
  formats: ('PDF' | 'XLSX' | 'PPT')[];
  enabled: boolean;
}

const SCHEDULE_ITEMS: ScheduleItem[] = [
  {
    id: 's1',
    title: 'Pengiriman Rute 1 (Pasar Grosir)',
    schedule: 'Setiap Hari 08:00 WIB',
    pic: 'AM',
    formats: ['PDF'],
    enabled: true,
  },
  {
    id: 's2',
    title: 'Pemberitahuan Tempo Jatuh Piutang',
    schedule: 'Setiap Senin 09:00 WIB',
    pic: 'AM',
    formats: ['PDF', 'XLSX'],
    enabled: true,
  },
  {
    id: 's3',
    title: 'Evaluasi Penjualan & Margin Mingguan',
    schedule: 'Jumat 16:30 WIB',
    pic: 'JS',
    formats: ['PDF'],
    enabled: true,
  },
  {
    id: 's4',
    title: 'Rekapitulasi Kas & Mutasi Stok Harian',
    schedule: 'Setiap Hari 17:00 WIB',
    pic: 'AM',
    formats: ['XLSX'],
    enabled: false,
  },
];

export interface DashboardMidRowProps {
  peran: Peran;
}

export function DashboardMidRow({ peran }: DashboardMidRowProps) {
  const [activeTab, setActiveTab] = React.useState<'semua' | 'favorit' | 'penjualan' | 'gudang' | 'keuangan'>('semua');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [schedules, setSchedules] = React.useState<ScheduleItem[]>(SCHEDULE_ITEMS);
  const [favorites, setFavorites] = React.useState<Record<string, boolean>>({
    m1: true,
    m2: true,
    m5: true,
  });

  // AI Prompt Interactive State
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [aiResponse, setAiResponse] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleGenerateAi = () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setAiResponse(
        `Analisis AI Selesai: Berdasarkan data 30 hari terakhir, permintaan Beras IR64 diproyeksikan meningkat 24% dalam 10 hari mendatang. Disarankan menambah kuota PO ke PT Sumber Beras Nusantara minimal 150 sak.`
      );
    }, 800);
  };

  // Filter modules
  const filteredModules = INITIAL_MODULES.filter((mod) => {
    const isFav = favorites[mod.id];
    if (activeTab === 'favorit' && !isFav) return false;
    if (activeTab === 'penjualan' && mod.category !== 'penjualan') return false;
    if (activeTab === 'gudang' && mod.category !== 'gudang') return false;
    if (activeTab === 'keuangan' && mod.category !== 'keuangan') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return mod.title.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* 1. BAGIAN KIRI: MODUL & LAPORAN LIBRARY (6 Kolom Desktop) */}
      <div className="lg:col-span-5 xl:col-span-6 rounded-2xl p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          {/* Header Library */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0c1a30]">
                Pusat Dokumen &amp; Modul Operasional
              </h2>
              <p className="text-xs text-slate-500">
                Pintasan instan penerbitan faktur, surat jalan, dan kartu stok
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari modul..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-36 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 pb-2 mb-4 overflow-x-auto scrollbar-none text-xs">
            {(
              [
                { id: 'semua', label: 'Semua Modul' },
                { id: 'favorit', label: '★ Favorit' },
                { id: 'penjualan', label: 'Penjualan' },
                { id: 'gudang', label: 'Gudang' },
                { id: 'keuangan', label: 'Keuangan' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-[#0c1b3a] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cards 2-Columns Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredModules.map((item) => {
              const isFav = favorites[item.id];
              return (
                <div
                  key={item.id}
                  className="rounded-xl p-3.5 border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs',
                            item.iconBg,
                            item.iconColor
                          )}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors">
                          {item.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        className="text-slate-300 hover:text-amber-500 transition-colors cursor-pointer p-0.5"
                        title="Tandai favorit"
                      >
                        <Star
                          className={cn(
                            'w-3.5 h-3.5',
                            isFav && 'text-amber-500 fill-amber-500'
                          )}
                        />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Jalan: {item.lastRun}</span>

                    <div className="flex items-center gap-1.5">
                      {item.formats.map((fmt) => (
                        <span
                          key={fmt}
                          className={cn(
                            'px-1.5 py-0.2 rounded font-mono font-bold text-[9px]',
                            fmt === 'PDF'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          )}
                        >
                          {fmt}
                        </span>
                      ))}

                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 ml-1"
                      >
                        <Link href={item.href} title="Buka modul">
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">Menampilkan {filteredModules.length} modul</span>
          <Link href="/laporan" className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            Lihat semua laporan terpusat &rarr;
          </Link>
        </div>
      </div>

      {/* 2. BAGIAN TENGAH: JADWAL OPERASIONAL & ANTRIAN (3.5 Kolom Desktop) */}
      <div className="lg:col-span-3 xl:col-span-3 rounded-2xl p-5 border border-[#e2ebf6] bg-white shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                Jadwal &amp; Antrean
              </h3>
              <p className="text-[11px] text-slate-500">Operasional terprogram</p>
            </div>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              {schedules.filter((s) => s.enabled).length} Aktif
            </span>
          </div>

          <div className="space-y-2.5">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                      {item.pic}
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 truncate">
                      {item.title}
                    </h5>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.schedule}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1.5">
                    {item.formats.map((f) => (
                      <span
                        key={f}
                        className="text-[8px] font-mono px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => toggleSchedule(item.id)}
                  className={cn(
                    'w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0',
                    item.enabled ? 'bg-[#0c1b3a]' : 'bg-slate-300'
                  )}
                  title={item.enabled ? 'Matikan jadwal' : 'Aktifkan jadwal'}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-xs',
                      item.enabled ? 'left-4.5' : 'left-0.5'
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-center">
          <Link href="/penagihan" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            Buka Kalender Pengiriman &rarr;
          </Link>
        </div>
      </div>

      {/* 3. BAGIAN KANAN: AI ERP INSIGHTS & REKOMENDASI (3.5 Kolom Desktop) */}
      <div className="lg:col-span-4 xl:col-span-3 rounded-2xl p-5 border border-[#e2ebf6] bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/30 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                AI ERP Advisor
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Cerdas
            </span>
          </div>

          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            Asisten analitik cerdas untuk estimasi kebutuhan stok sembako dan mitigasi risiko piutang.
          </p>

          {/* Interactive Simulation Input */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <input
                type="text"
                placeholder="misal: Cek stok aman minyak goreng..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateAi()}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            <Button
              type="button"
              onClick={handleGenerateAi}
              disabled={isGenerating || !aiPrompt.trim()}
              className="w-full h-8 text-xs bg-[#0c1b3a] hover:bg-[#152a54] text-white rounded-xl font-medium gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Menganalisis...' : 'Hasilkan Rekomendasi'}
            </Button>
          </div>

          {/* AI Response Display */}
          {aiResponse && (
            <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed animate-in fade-in">
              {aiResponse}
            </div>
          )}

          {/* Suggested Proactive Insights */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Rekomendasi Terkini
            </span>

            <button
              type="button"
              onClick={() => {
                setAiPrompt('Analisis restock Beras IR64 25kg');
                setAiResponse(
                  'Beras IR64 25kg sisa 12 sak (batas aman 20 sak). Penjualan harian rata-rata 4 sak/hari. Disarankan ajukan PO sebelum lusa.'
                );
              }}
              className="w-full text-left p-2 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-[11px] text-slate-700 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Prediksi Re-order Beras IR64
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                Stok menipis, sisa 3 hari operasional toko
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiPrompt('Plafon kredit Toko Berkah');
                setAiResponse(
                  'Toko Berkah Jaya memiliki piutang Rp 8.500.000 dari plafon Rp 10.000.000 (85% terpakai). Rekomendasikan pembayaran sebelum pesanan baru.'
                );
              }}
              className="w-full text-left p-2 rounded-lg bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-[11px] text-slate-700 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Peringatan Plafon Kredit Toko
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                2 toko mendekati ambang batas 80% kredit
              </p>
            </button>
          </div>
        </div>

        <div className="mt-3 pt-2 text-center">
          <Link href="/analitik" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
            Jelajahi Analitik Komprehensif &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
