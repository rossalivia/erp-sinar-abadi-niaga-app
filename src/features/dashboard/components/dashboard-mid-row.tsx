'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  Star,
  Sparkles,
  ArrowRight,
  Clock,
  Search,
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
  roles: Peran[];
  isFavorite?: boolean;
}

const INITIAL_MODULES: ModuleCard[] = [
  {
    id: 'm1',
    title: 'Pesanan Jual & Faktur',
    category: 'penjualan',
    description: 'Penerbitan faktur penjualan toko kelontong, draf transaksi, dan riwayat pesanan.',
    iconBg: 'bg-[#0c1b3a]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '15 mnt lalu',
    href: '/pesanan',
    roles: ['penjualan', 'manajer'],
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
    roles: ['gudang', 'manajer'],
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
    roles: ['manajer'],
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
    roles: ['gudang', 'manajer'],
    isFavorite: false,
  },
  {
    id: 'm5',
    title: 'Pengadaan & PO Pemasok',
    category: 'gudang',
    description: 'Purchase Order resmi bahan pokok grosir dan verifikasi penerimaan.',
    iconBg: 'bg-[#7c3aed]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '1 hari lalu',
    href: '/pembelian',
    roles: ['gudang', 'manajer'],
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
    roles: ['gudang', 'manajer'],
    isFavorite: false,
  },
  {
    id: 'm7',
    title: 'Database Toko & Pelanggan',
    category: 'penjualan',
    description: 'Buku mitra toko kelontong, kontak pemilik, dan riwayat transaksi.',
    iconBg: 'bg-[#0d9488]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '2 jam lalu',
    href: '/pelanggan',
    roles: ['penjualan', 'manajer'],
    isFavorite: true,
  },
  {
    id: 'm8',
    title: 'Monitoring Penagihan Piutang',
    category: 'penjualan',
    description: 'Rekapitulasi jadwal jatuh tempo faktur toko untuk kelancaran pemesanan.',
    iconBg: 'bg-[#ea580c]',
    iconColor: 'text-white',
    formats: ['PDF'],
    lastRun: '30 mnt lalu',
    href: '/penagihan',
    roles: ['penjualan', 'manajer'],
    isFavorite: false,
  },
  {
    id: 'm9',
    title: 'Katalog SKU & Komoditas',
    category: 'gudang',
    description: 'Daftar kode barang, satuan, sisa stok gudang, dan stok minimum.',
    iconBg: 'bg-[#334155]',
    iconColor: 'text-white',
    formats: ['PDF', 'XLSX'],
    lastRun: '10 mnt lalu',
    href: '/barang',
    roles: ['penjualan', 'gudang', 'manajer'],
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
  roles: Peran[];
}

const SCHEDULE_ITEMS: ScheduleItem[] = [
  {
    id: 's1',
    title: 'Pengiriman Armada Rute Bekasi & Jaktim',
    schedule: 'Setiap Hari 08:00 WIB',
    pic: 'AM',
    formats: ['PDF'],
    enabled: true,
    roles: ['gudang', 'manajer'],
  },
  {
    id: 's2',
    title: 'Pemberitahuan Tempo Jatuh Piutang Toko',
    schedule: 'Setiap Senin 09:00 WIB',
    pic: 'SL',
    formats: ['PDF', 'XLSX'],
    enabled: true,
    roles: ['penjualan', 'manajer'],
  },
  {
    id: 's3',
    title: 'Evaluasi Penjualan & Margin Mingguan',
    schedule: 'Jumat 16:30 WIB',
    pic: 'MN',
    formats: ['PDF'],
    enabled: true,
    roles: ['manajer'],
  },
  {
    id: 's4',
    title: 'Rekapitulasi Kas & Mutasi Stok Harian',
    schedule: 'Setiap Hari 17:00 WIB',
    pic: 'GD',
    formats: ['XLSX'],
    enabled: false,
    roles: ['gudang', 'manajer'],
  },
  {
    id: 's5',
    title: 'Follow-up Toko Menjelang Jatuh Tempo',
    schedule: 'Setiap Hari 10:00 WIB',
    pic: 'SL',
    formats: ['PDF'],
    enabled: true,
    roles: ['penjualan', 'manajer'],
  },
];

export interface DashboardMidRowProps {
  peran: Peran;
}

export function DashboardMidRow({ peran = 'penjualan' }: DashboardMidRowProps) {
  const [activeTab, setActiveTab] = React.useState<string>('semua');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [schedules, setSchedules] = React.useState<ScheduleItem[]>(() =>
    SCHEDULE_ITEMS.filter((s) => s.roles.includes(peran))
  );
  const [favorites, setFavorites] = React.useState<Record<string, boolean>>({
    m1: true,
    m2: true,
    m5: true,
    m7: true,
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
      if (peran === 'gudang') {
        setAiResponse(
          `Analisis Logistik: Stok Minyak Goreng Sawit 2L sisa 14 karton dan Beras Ramos 25kg sisa 18 sak. Direkomendasikan segera memproses penerimaan PO dari PT Sinar Mas dan menjadwalkan muatan rute Rawalumbu besok pagi.`
        );
      } else if (peran === 'penjualan') {
        setAiResponse(
          `Analisis Penjualan: Toko Berkah Jaya dan Toko Rezeki Baru memiliki transaksi pesanan aktif. Tagihan berjalan Toko Berkah masih dalam batas aman (65% plafon). Anda dapat menawarkan promo Minyak Goreng 2L.`
        );
      } else {
        setAiResponse(
          `Analisis Finansial: Margin kotor minggu ini berada di 13.8% (target 12.5%). Rasio piutang tertagih tepat waktu mencapai 85%. Disarankan menyetujui pengajuan diskon volume untuk Toko Subur Makmur.`
        );
      }
    }, 700);
  };

  // Saring modul sesuai peran pengguna
  const roleModules = React.useMemo(() => {
    return INITIAL_MODULES.filter((m) => m.roles.includes(peran));
  }, [peran]);

  // Tab filter sesuai hak akses peran
  const availableTabs = React.useMemo(() => {
    if (peran === 'penjualan') {
      return [
        { id: 'semua', label: 'Semua Modul' },
        { id: 'favorit', label: '★ Favorit' },
        { id: 'penjualan', label: 'Penjualan' },
      ];
    }
    if (peran === 'gudang') {
      return [
        { id: 'semua', label: 'Semua Modul' },
        { id: 'favorit', label: '★ Favorit' },
        { id: 'gudang', label: 'Pergudangan' },
      ];
    }
    return [
      { id: 'semua', label: 'Semua Modul' },
      { id: 'favorit', label: '★ Favorit' },
      { id: 'penjualan', label: 'Penjualan' },
      { id: 'gudang', label: 'Gudang' },
      { id: 'keuangan', label: 'Keuangan' },
    ];
  }, [peran]);

  // Filter modules berdasarkan tab & search
  const filteredModules = roleModules.filter((mod) => {
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
      <div className="lg:col-span-5 xl:col-span-6 rounded-2xl p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          {/* Header Library */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0c1a30] dark:text-slate-100">
                {peran === 'gudang'
                  ? 'Pusat Dokumen & Logistik Pergudangan'
                  : peran === 'penjualan'
                  ? 'Pusat Dokumen & Transaksi Penjualan'
                  : 'Pusat Dokumen & Modul ERP'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {peran === 'gudang'
                  ? 'Pintasan instan surat jalan, kartu stok, dan PO masuk'
                  : peran === 'penjualan'
                  ? 'Pintasan instan faktur penjualan, data toko, dan tagihan'
                  : 'Pintasan instan faktur, surat jalan, modul keuangan, dan audit'}
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
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-36 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 mb-4 overflow-x-auto scrollbar-none text-xs">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-[#0c1b3a] dark:bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  className="rounded-xl p-3.5 border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-slate-700 hover:shadow-sm transition-all group flex flex-col justify-between"
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
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        className="text-slate-300 dark:text-slate-600 hover:text-amber-500 transition-colors cursor-pointer p-0.5"
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

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Jalan: {item.lastRun}</span>

                    <div className="flex items-center gap-1.5">
                      {item.formats.map((fmt) => (
                        <span
                          key={fmt}
                          className={cn(
                            'px-1.5 py-0.2 rounded font-mono font-bold text-[9px]',
                            fmt === 'PDF'
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                          )}
                        >
                          {fmt}
                        </span>
                      ))}

                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 ml-1"
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

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
            Menampilkan {filteredModules.length} modul berhak akses
          </span>
          {peran === 'manajer' ? (
            <Link href="/laporan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1">
              Lihat semua laporan &rarr;
            </Link>
          ) : peran === 'gudang' ? (
            <Link href="/stok" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1">
              Buku Kartu Stok Gudang &rarr;
            </Link>
          ) : (
            <Link href="/pesanan" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1">
              Semua Pesanan Penjualan &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* 2. BAGIAN TENGAH: JADWAL OPERASIONAL & ANTRIAN (3.5 Kolom Desktop) */}
      <div className="lg:col-span-3 xl:col-span-3 rounded-2xl p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                {peran === 'gudang'
                  ? 'Jadwal Muatan & Armada'
                  : peran === 'penjualan'
                  ? 'Jadwal Penagihan & Order'
                  : 'Jadwal & Antrean'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Operasional terprogram</p>
            </div>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {schedules.filter((s) => s.enabled).length} Aktif
            </span>
          </div>

          <div className="space-y-2.5">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[9px] font-bold flex items-center justify-center shrink-0">
                      {item.pic}
                    </span>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.title}
                    </h5>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.schedule}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1.5">
                    {item.formats.map((f) => (
                      <span
                        key={f}
                        className="text-[8px] font-mono px-1 py-0.2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
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
                    item.enabled ? 'bg-[#0c1b3a] dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
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

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
          {peran === 'gudang' ? (
            <Link href="/gudang/picking" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              Buka Jadwal Muatan Truk &rarr;
            </Link>
          ) : peran === 'penjualan' ? (
            <Link href="/penagihan" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              Buka Jadwal Penagihan &rarr;
            </Link>
          ) : (
            <Link href="/laporan" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              Semua Jadwal &amp; Laporan &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* 3. BAGIAN KANAN: AI ERP INSIGHTS & REKOMENDASI (3.5 Kolom Desktop) */}
      <div className="lg:col-span-4 xl:col-span-3 rounded-2xl p-5 border border-[#e2ebf6] dark:border-slate-800 bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900/95 dark:to-indigo-950/20 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-[#0c1a30] dark:text-slate-100 uppercase tracking-wider font-mono">
                AI ERP Advisor
              </h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
              Cerdas
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
            {peran === 'gudang'
              ? 'Asisten analitik cerdas untuk estimasi kebutuhan restock komoditas dan jadwal bongkar muat.'
              : peran === 'penjualan'
              ? 'Asisten analitik cerdas untuk estimasi permintaan toko kelontong dan prioritas penagihan.'
              : 'Asisten analitik cerdas untuk estimasi kebutuhan stok sembako dan mitigasi risiko piutang.'}
          </p>

          {/* Interactive Simulation Input */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <input
                type="text"
                placeholder={
                  peran === 'gudang'
                    ? 'misal: Cek sisa stok fisik beras...'
                    : peran === 'penjualan'
                    ? 'misal: Cek batas kredit toko...'
                    : 'misal: Cek stok aman minyak goreng...'
                }
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateAi()}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            <Button
              type="button"
              onClick={handleGenerateAi}
              disabled={isGenerating || !aiPrompt.trim()}
              className="w-full h-8 text-xs bg-[#0c1b3a] hover:bg-[#152a54] dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl font-medium gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGenerating ? 'Menganalisis...' : 'Hasilkan Rekomendasi'}
            </Button>
          </div>

          {/* AI Response Display */}
          {aiResponse && (
            <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 leading-relaxed animate-in fade-in">
              {aiResponse}
            </div>
          )}

          {/* Suggested Proactive Insights */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Rekomendasi Terkini
            </span>

            {peran === 'gudang' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrompt('Analisis restock Minyak Goreng Sawit 2L');
                    setAiResponse(
                      'Minyak Goreng Sawit 2L sisa 14 karton (batas minimum 25 karton). Rekomendasikan segera buat pengajuan PO ke pemasok resmi.'
                    );
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Peringatan Restock Minyak Goreng
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    Stok kritis, sisa di bawah stok minimum
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrompt('Jadwal Stock Opname');
                    setAiResponse(
                      'Sesi stock opname kuartal ini mencakup 48 SKU aktif. Disarankan verifikasi fisik tepung terigu dan beras sebelum akhir pekan.'
                    );
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Audit Fisik Rutin Gudang
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    Sinkronisasi fisik vs kartu mutasi stok
                  </p>
                </button>
              </>
            ) : peran === 'penjualan' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrompt('Plafon kredit Toko Berkah Jaya');
                    setAiResponse(
                      'Toko Berkah Jaya memiliki sisa batas kredit Rp 3.500.000. Masih memenuhi syarat pesanan draf berikutnya dengan termin 14 hari.'
                    );
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Kelayakan Kredit Toko Berkah
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    Batas kredit aman untuk order baru
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrompt('Prioritas follow-up jatuh tempo');
                    setAiResponse(
                      'Terdapat faktur Toko Subur Makmur mendekati batas jatuh tempo. Lakukan konfirmasi penerimaan barang dan jadwal pelunasan.'
                    );
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Follow-up Tagihan Toko
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    Mencegah tagihan lewat jatuh tempo
                  </p>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAiPrompt('Analisis restock Minyak Goreng Sawit 2L');
                    setAiResponse(
                      'Minyak Goreng Sawit 2L sisa 14 karton (batas aman 25 karton). Penjualan harian rata-rata 5 karton/hari ke toko kelontong mitra. Disarankan ajukan PO ke pemasok utama.'
                    );
                  }}
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Prediksi Re-order Minyak Goreng 2L
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
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
                  className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-all text-[11px] text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-950 dark:text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Peringatan Plafon Kredit Toko
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    2 toko mendekati ambang batas 80% kredit
                  </p>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2 text-center">
          {peran === 'manajer' ? (
            <Link href="/analitik" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              Jelajahi Analitik Komprehensif &rarr;
            </Link>
          ) : peran === 'gudang' ? (
            <Link href="/barang" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              Katalog SKU &amp; Stok Gudang &rarr;
            </Link>
          ) : (
            <Link href="/pesanan" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
              Kelola Pesanan Penjualan &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
