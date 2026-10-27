'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search,
  LayoutDashboard,
  Package,
  Layers,
  ClipboardCheck,
  ClipboardList,
  Users,
  ShoppingCart,
  ReceiptText,
  ShieldCheck,
  Truck,
  Building2,
  BarChart3,
  TrendingUp,
  UserCog,
  User,
  ShieldAlert,
  Upload,
  Mail,
  CreditCard,
  ArrowRight,
  PlusCircle,
  CornerDownLeft,
  X,
  LucideIcon,
} from 'lucide-react';
import { MENU_ITEMS } from '@/lib/akses';
import type { Peran } from '@/types/auth';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  Layers,
  ClipboardCheck,
  ClipboardList,
  Users,
  ShoppingCart,
  ReceiptText,
  ShieldCheck,
  Truck,
  Building2,
  BarChart3,
  TrendingUp,
  UserCog,
  User,
  ShieldAlert,
  Upload,
  Mail,
  CreditCard,
  PlusCircle,
};

interface SearchableItem {
  id: string;
  title: string;
  href: string;
  icon: string;
  category: string;
  description?: string;
  keywords?: string[];
  roles: Peran[];
}

// Tambahkan aksi cepat (Quick Actions) yang relevan
const QUICK_ACTIONS: SearchableItem[] = [
  {
    id: 'action-pesanan-baru',
    title: 'Buat Pesanan Jual Baru',
    href: '/pesanan/baru',
    icon: 'PlusCircle',
    category: 'Aksi Cepat',
    description: 'Buka formulir input transaksi penjualan baru',
    keywords: ['buat', 'tambah', 'sales order', 'so', 'baru'],
    roles: ['penjualan', 'manajer'],
  },
  {
    id: 'action-pelanggan-baru',
    title: 'Daftar Pelanggan Baru',
    href: '/pelanggan',
    icon: 'PlusCircle',
    category: 'Aksi Cepat',
    description: 'Kelola dan daftarkan pembeli atau toko mitra',
    keywords: ['pelanggan', 'customer', 'klien', 'toko'],
    roles: ['penjualan', 'manajer'],
  },
  {
    id: 'action-penerimaan-barang',
    title: 'Penerimaan Barang (Pembelian)',
    href: '/pembelian',
    icon: 'Truck',
    category: 'Aksi Cepat',
    description: 'Catat dan verifikasi pesanan pembelian dari pemasok',
    keywords: ['beli', 'po', 'purchase order', 'supplier', 'masuk'],
    roles: ['gudang', 'manajer'],
  },
  {
    id: 'action-opname-stok',
    title: 'Mulai Stock Opname',
    href: '/stok/opname',
    icon: 'ClipboardCheck',
    category: 'Aksi Cepat',
    description: 'Penyesuaian dan audit fisik persediaan barang gudang',
    keywords: ['hitung fisik', 'selisih', 'opname', 'rekonsiliasi'],
    roles: ['gudang', 'manajer'],
  },
];

// Peta kategori menu
const MENU_CATEGORIES: Record<string, string> = {
  '/': 'Menu Utama',
  '/barang': 'Inventory & Stok',
  '/stok': 'Inventory & Stok',
  '/stok/opname': 'Inventory & Stok',
  '/gudang/picking': 'Inventory & Stok',
  '/pesanan': 'Transaksi & Penjualan',
  '/pelanggan': 'Transaksi & Penjualan',
  '/pembelian': 'Transaksi & Penjualan',
  '/pemasok': 'Transaksi & Penjualan',
  '/penagihan': 'Transaksi & Penjualan',
  '/kredit': 'Transaksi & Penjualan',
  '/persetujuan': 'Transaksi & Penjualan',
  '/pembayaran': 'Transaksi & Penjualan',
  '/laporan': 'Keuangan & Laporan',
  '/analitik': 'Keuangan & Laporan',
  '/akun': 'Administrasi Sistem',
  '/profil': 'Administrasi Sistem',
  '/audit': 'Administrasi Sistem',
  '/impor': 'Administrasi Sistem',
  '/notifikasi': 'Administrasi Sistem',
};

// Deskripsi bantuan untuk pencarian cerdas
const MENU_METADATA: Record<string, { desc: string; keywords: string[] }> = {
  '/': { desc: 'Ringkasan performa penjualan dan status operasional', keywords: ['home', 'beranda', 'ringkasan'] },
  '/barang': { desc: 'Katalog master barang, SKU, harga, dan satuan', keywords: ['produk', 'item', 'katalog', 'master barang'] },
  '/stok': { desc: 'Mutasi kartu stok masuk dan keluar per gudang', keywords: ['kartu stok', 'riwayat', 'logistik'] },
  '/stok/opname': { desc: 'Formulir opname fisik dan penyesuaian selisih stok', keywords: ['cek fisik', 'audit stok'] },
  '/gudang/picking': { desc: 'Daftar pengambilan barang untuk pesanan siap kirim', keywords: ['picking list', 'ambil barang', 'surat jalan'] },
  '/pesanan': { desc: 'Daftar seluruh pesanan penjualan & status pengiriman', keywords: ['so', 'faktur', 'order jual', 'invoice'] },
  '/pelanggan': { desc: 'Daftar direktori pelanggan, limit kredit, dan kontak', keywords: ['customer', 'toko', 'debitur'] },
  '/pembelian': { desc: 'Pesanan pembelian ke supplier dan penerimaan PO', keywords: ['po', 'purchase order', 'kulakan', 'supplier'] },
  '/pemasok': { desc: 'Direktori data distributor dan pemasok barang', keywords: ['vendor', 'supplier', 'distributor'] },
  '/penagihan': { desc: 'Daftar faktur belum lunas dan jadwal jatuh tempo', keywords: ['piutang', 'ar', 'tagihan', 'jatuh tempo'] },
  '/kredit': { desc: 'Pengawasan limit kredit dan riwayat pembayaran pelanggan', keywords: ['plafon kredit', 'resiko piutang'] },
  '/persetujuan': { desc: 'Persetujuan diskon khusus dan harga di bawah standar', keywords: ['approval', 'diskon', 'margin'] },
  '/pembayaran': { desc: 'Integrasi gerbang pembayaran Mayar & riwayat pelunasan', keywords: ['qris', 'transfer', 'va', 'mayar'] },
  '/laporan': { desc: 'Laporan laba kotor, HPP, piutang, dan mutasi barang', keywords: ['laba rugi', 'keuangan', 'omset', 'margin'] },
  '/analitik': { desc: 'Grafik tren omset, produk terlaris, dan performa tim', keywords: ['chart', 'grafik', 'metrik', 'tren'] },
  '/akun': { desc: 'Manajemen pengguna, penugasan peran, dan hak akses', keywords: ['user', 'password', 'pegawai', 'role'] },
  '/profil': { desc: 'Informasi identitas akun dan peran saya', keywords: ['akun saya', 'biodata', 'email'] },
  '/audit': { desc: 'Catatan aktivitas transaksi dan jejak keamanan sistem', keywords: ['audit trail', 'log sistem', 'riwayat akses'] },
  '/impor': { desc: 'Impor massal data barang atau pelanggan via CSV', keywords: ['upload', 'csv', 'excel', 'bulk import'] },
  '/notifikasi': { desc: 'Riwayat pengiriman peringatan email stok menipis', keywords: ['email', 'alert', 'peringatan'] },
};

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peran: Peran;
}

export function CommandMenu({ open, onOpenChange, peran }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Kumpulkan seluruh item yang diizinkan untuk peran pengguna aktif
  const allSearchableItems: SearchableItem[] = React.useMemo(() => {
    // 1. Menu items
    const menuItems: SearchableItem[] = MENU_ITEMS.filter((item) =>
      item.roles.includes(peran)
    ).map((item) => {
      const meta = MENU_METADATA[item.href] || { desc: '', keywords: [] };
      return {
        id: `menu-${item.href}`,
        title: item.title,
        href: item.href,
        icon: item.icon,
        category: MENU_CATEGORIES[item.href] || 'Menu Navigasi',
        description: meta.desc,
        keywords: meta.keywords,
        roles: item.roles,
      };
    });

    // 2. Quick actions
    const quickActions: SearchableItem[] = QUICK_ACTIONS.filter((action) =>
      action.roles.includes(peran)
    );

    return [...quickActions, ...menuItems];
  }, [peran]);

  // Filter item berdasarkan query
  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allSearchableItems;
    }

    return allSearchableItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) ?? false;
      const matchHref = item.href.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
      return matchTitle || matchCategory || matchDesc || matchHref || matchKeywords;
    });
  }, [allSearchableItems, query]);

  // Kelompokkan hasil per kategori untuk tampilan terstruktur
  const groupedResults = React.useMemo(() => {
    const groups: { category: string; items: { item: SearchableItem; globalIndex: number }[] }[] = [];
    const categoryMap = new Map<string, { item: SearchableItem; globalIndex: number }[]>();

    filteredItems.forEach((item, globalIndex) => {
      const cat = item.category;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push({ item, globalIndex });
    });

    // Urutkan kategori
    const categoryPriority = [
      'Aksi Cepat',
      'Menu Utama',
      'Transaksi & Penjualan',
      'Inventory & Stok',
      'Keuangan & Laporan',
      'Administrasi Sistem',
    ];

    categoryPriority.forEach((cat) => {
      if (categoryMap.has(cat)) {
        groups.push({ category: cat, items: categoryMap.get(cat)! });
        categoryMap.delete(cat);
      }
    });

    categoryMap.forEach((items, cat) => {
      groups.push({ category: cat, items });
    });

    return groups;
  }, [filteredItems]);

  // Auto-focus input saat modal dibuka
  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Scroll item terpilih ke dalam tampilan jika perlu
  React.useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setQuery('');
        setSelectedIndex(0);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const handleSelect = React.useCallback(
    (item: SearchableItem) => {
      handleOpenChange(false);
      router.push(item.href);
    },
    [handleOpenChange, router]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className="fixed left-[50%] top-[16%] z-50 w-full max-w-2xl translate-x-[-50%] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/80 dark:border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-150"
        >
          {/* Header & Search Input */}
          <div className="flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 px-4 py-3.5 shrink-0">
            <Search className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Ketik nama menu, transaksi, atau aksi cepat (mis: pesanan, stok, PO)..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none font-medium"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedIndex(0);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xs">
                ESC
              </kbd>
            )}
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800 select-none"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                <Search className="h-6 w-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-medium text-slate-700 dark:text-slate-300">Tidak ada menu atau halaman yang cocok</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Coba kata kunci lain atau periksa izin akses peran Anda.
                </p>
              </div>
            ) : (
              groupedResults.map((group) => (
                <div key={group.category} className="py-2 first:pt-1 last:pb-1">
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
                    {group.category}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(({ item, globalIndex }) => {
                      const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          role="option"
                          aria-selected={isSelected}
                          data-active={isSelected}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-all rounded-xl ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-neu-sm'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-1.5 rounded-lg shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-700 text-white'
                                  : 'bg-[#f4f7fb] dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-neu-inset'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-semibold truncate ${
                                    isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {item.title}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                                    isSelected
                                      ? 'bg-indigo-700 text-indigo-100 border-indigo-500'
                                      : 'bg-white/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {item.href}
                                </span>
                              </div>
                              {item.description && (
                                <p
                                  className={`text-[11px] truncate mt-0.5 ${
                                    isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 pl-3 shrink-0">
                            {isSelected ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-100">
                                <span>Pilih</span>
                                <CornerDownLeft className="h-3 w-3" />
                              </span>
                            ) : (
                              <ArrowRight className="h-3 w-3 text-slate-300" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Dialog Footer - Keyboard shortcuts helper */}
          <div className="flex items-center justify-between border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] rounded-md shadow-xs">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] rounded-md shadow-xs">
                  ↓
                </kbd>
                <span className="ml-0.5">Navigasi</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] rounded-md shadow-xs">
                  ↵
                </kbd>
                <span className="ml-0.5">Buka</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] rounded-md shadow-xs">
                  ESC
                </kbd>
                <span className="ml-0.5">Tutup</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              Hak Akses: <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">{peran}</span>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
