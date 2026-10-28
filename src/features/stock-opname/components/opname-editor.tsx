'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Send,
  AlertCircle,
  Layers,
  CheckSquare,
  Search,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { buatOpnameAction, ubahDrafOpnameAction } from '../actions';
import type { BarangKatalogOpname, ItemOpnameStok } from '../types';

interface OpnameEditorProps {
  katalogBarang: BarangKatalogOpname[];
  initialData?: {
    id: string;
    catatan: string | null;
    items: ItemOpnameStok[];
  };
}

interface EditorRow {
  barang_id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok_sistem: number;
  stok_fisik: number | '';
  keterangan: string;
}

export function OpnameEditor({ katalogBarang, initialData }: OpnameEditorProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const [catatan, setCatatan] = React.useState(initialData?.catatan || '');
  const [selectedBarangId, setSelectedBarangId] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter & Pencarian
  const [tableSearchQuery, setTableSearchQuery] = React.useState('');
  const [isMultiSelectOpen, setIsMultiSelectOpen] = React.useState(false);
  const [modalSearch, setModalSearch] = React.useState('');
  const [selectedModalIds, setSelectedModalIds] = React.useState<Set<string>>(new Set());

  // Inisialisasi baris tabel
  const [rows, setRows] = React.useState<EditorRow[]>(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map((i) => ({
        barang_id: i.barang_id,
        kode: i.kode_barang || '',
        nama: i.nama_barang || '',
        satuan: i.satuan || '',
        stok_sistem: i.stok_sistem,
        stok_fisik: i.stok_fisik,
        keterangan: i.keterangan || '',
      }));
    }
    return [];
  });

  // Set ID barang yang sudah ada di tabel
  const existingBarangIdSet = React.useMemo(() => {
    return new Set(rows.map((r) => r.barang_id));
  }, [rows]);

  // Daftar barang yang belum ada di tabel (untuk dropdown satuan)
  const availableBarang = React.useMemo(() => {
    return katalogBarang.filter((b) => !existingBarangIdSet.has(b.id));
  }, [katalogBarang, existingBarangIdSet]);

  // Tambah 1 barang ke tabel
  const handleAddBarang = (barangIdToAdd?: string) => {
    const targetId = barangIdToAdd || selectedBarangId;
    if (!targetId) return;

    if (existingBarangIdSet.has(targetId)) {
      setErrorMessage('Barang tersebut sudah ada di dalam tabel opname.');
      return;
    }

    const b = katalogBarang.find((item) => item.id === targetId);
    if (!b) return;

    setErrorMessage(null);
    setRows((prev) => [
      ...prev,
      {
        barang_id: b.id,
        kode: b.kode,
        nama: b.nama,
        satuan: b.satuan,
        stok_sistem: b.stok,
        stok_fisik: b.stok, // default awal sama dengan stok sistem
        keterangan: '',
      },
    ]);
    setSelectedBarangId('');
  };

  // Tambah banyak barang sekaligus dari modal multi-select
  const handleAddMultipleBarang = (barangIds: string[]) => {
    if (barangIds.length === 0) return;
    setErrorMessage(null);

    const newRows: EditorRow[] = [];
    for (const id of barangIds) {
      if (existingBarangIdSet.has(id)) continue;
      const b = katalogBarang.find((item) => item.id === id);
      if (!b) continue;
      newRows.push({
        barang_id: b.id,
        kode: b.kode,
        nama: b.nama,
        satuan: b.satuan,
        stok_sistem: b.stok,
        stok_fisik: b.stok,
        keterangan: '',
      });
    }

    if (newRows.length > 0) {
      setRows((prev) => [...prev, ...newRows]);
    }
  };

  // Muat semua barang aktif sekaligus
  const handleLoadAllBarang = () => {
    setErrorMessage(null);
    const newRows: EditorRow[] = katalogBarang.map((b) => {
      const existing = rows.find((r) => r.barang_id === b.id);
      if (existing) return existing;
      return {
        barang_id: b.id,
        kode: b.kode,
        nama: b.nama,
        satuan: b.satuan,
        stok_sistem: b.stok,
        stok_fisik: b.stok,
        keterangan: '',
      };
    });
    setRows(newRows);
  };

  // Kosongkan seluruh daftar barang (Clear All)
  const handleClearAll = () => {
    if (rows.length === 0) return;

    // Jika ada nilai stok fisik yang diubah atau catatan yang diisi, tanyakan konfirmasi keamanan
    const hasModified = rows.some(
      (r) =>
        (typeof r.stok_fisik === 'number' && r.stok_fisik !== r.stok_sistem) ||
        r.keterangan.trim().length > 0
    );

    if (hasModified) {
      const confirmClear = window.confirm(
        `Terdapat nilai stok fisik atau keterangan yang sudah Anda ubah pada ${rows.length} barang. Yakin ingin mengosongkan seluruh daftar opname?`
      );
      if (!confirmClear) return;
    }

    setRows([]);
    setTableSearchQuery('');
    setErrorMessage(null);
  };

  // Hapus satu baris
  const handleRemoveRow = (barangId: string) => {
    setRows((prev) => prev.filter((r) => r.barang_id !== barangId));
  };

  // Ubah stok fisik
  const handleStokFisikChange = (barangId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.barang_id !== barangId) return r;
        if (val === '') return { ...r, stok_fisik: '' };
        const num = parseInt(val, 10);
        return { ...r, stok_fisik: isNaN(num) ? 0 : Math.max(0, num) };
      })
    );
  };

  // Ubah keterangan
  const handleKeteranganChange = (barangId: string, val: string) => {
    setRows((prev) =>
      prev.map((r) => (r.barang_id === barangId ? { ...r, keterangan: val } : r))
    );
  };

  // Kalkulasi agregat
  const agregat = React.useMemo(() => {
    let cocok = 0;
    let defisit = 0;
    let surplus = 0;
    let totalSelisih = 0;

    rows.forEach((r) => {
      const fisik = typeof r.stok_fisik === 'number' ? r.stok_fisik : 0;
      const selisih = fisik - r.stok_sistem;
      totalSelisih += selisih;
      if (selisih === 0) cocok++;
      else if (selisih < 0) defisit++;
      else surplus++;
    });

    return { total: rows.length, cocok, defisit, surplus, totalSelisih };
  }, [rows]);

  // Baris tabel terfilter berdasarkan pencarian lokal di tabel
  const displayedRows = React.useMemo(() => {
    const q = tableSearchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) => r.nama.toLowerCase().includes(q) || r.kode.toLowerCase().includes(q)
    );
  }, [rows, tableSearchQuery]);

  // Barang di modal terfilter berdasarkan pencarian modal
  const filteredModalBarang = React.useMemo(() => {
    const q = modalSearch.toLowerCase().trim();
    if (!q) return katalogBarang;
    return katalogBarang.filter(
      (b) => b.nama.toLowerCase().includes(q) || b.kode.toLowerCase().includes(q)
    );
  }, [katalogBarang, modalSearch]);

  const availableInFilteredModal = React.useMemo(() => {
    return filteredModalBarang.filter((b) => !existingBarangIdSet.has(b.id));
  }, [filteredModalBarang, existingBarangIdSet]);

  const isAllModalFilteredSelected =
    availableInFilteredModal.length > 0 &&
    availableInFilteredModal.every((b) => selectedModalIds.has(b.id));

  const toggleModalItem = (id: string) => {
    setSelectedModalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllModalFiltered = () => {
    if (isAllModalFilteredSelected) {
      setSelectedModalIds((prev) => {
        const next = new Set(prev);
        availableInFilteredModal.forEach((b) => next.delete(b.id));
        return next;
      });
    } else {
      setSelectedModalIds((prev) => {
        const next = new Set(prev);
        availableInFilteredModal.forEach((b) => next.add(b.id));
        return next;
      });
    }
  };

  const handleOpenMultiSelectModal = () => {
    setSelectedModalIds(new Set());
    setModalSearch('');
    setIsMultiSelectOpen(true);
  };

  const handleApplyModalSelection = () => {
    handleAddMultipleBarang(Array.from(selectedModalIds));
    setIsMultiSelectOpen(false);
  };

  // Submit Handler
  const handleSubmit = async (langsungAjukan: boolean) => {
    setErrorMessage(null);

    if (rows.length === 0) {
      setErrorMessage('Sesi opname harus berisi minimal 1 item barang.');
      return;
    }

    for (const r of rows) {
      const fisik = typeof r.stok_fisik === 'number' ? r.stok_fisik : 0;
      if (fisik !== r.stok_sistem && r.keterangan.trim().length < 10) {
        setErrorMessage(
          `Item "${r.nama}" memiliki selisih stok dan wajib memiliki keterangan minimal 10 karakter.`
        );
        return;
      }
    }

    const payloadItems = rows.map((r) => ({
      barang_id: r.barang_id,
      stok_fisik: typeof r.stok_fisik === 'number' ? r.stok_fisik : 0,
      stok_sistem: r.stok_sistem,
      keterangan: r.keterangan.trim() || null,
    }));

    setIsSubmitting(true);
    try {
      if (isEditing && initialData) {
        const res = await ubahDrafOpnameAction({
          id: initialData.id,
          catatan: catatan.trim() || undefined,
          items: payloadItems,
        });

        if (!res.success) {
          setErrorMessage(res.message || 'Gagal memperbarui draf opname.');
          setIsSubmitting(false);
          return;
        }

        router.push(`/stok/opname/${initialData.id}`);
      } else {
        const res = await buatOpnameAction({
          catatan: catatan.trim() || undefined,
          items: payloadItems,
          langsung_ajukan: langsungAjukan,
        });

        if (!res.success) {
          setErrorMessage(res.message || 'Gagal menyimpan sesi opname.');
          setIsSubmitting(false);
          return;
        }

        router.push(`/stok/opname/${res.data?.id}`);
      }
    } catch {
      setErrorMessage('Terjadi kesalahan koneksi sistem.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title={isEditing ? 'Ubah Draf Stock Opname' : 'Mulai Sesi Stock Opname'}
        description="Lakukan pencocokan antara data fisik di rak gudang dengan catatan stok di sistem."
      >
        <Link
          href={isEditing && initialData ? `/stok/opname/${initialData.id}` : '/stok/opname'}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
          <span>Kembali</span>
        </Link>
      </PageHeader>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Form Metadata Sesi & Pemilihan Barang */}
      <div className="rounded-2xl border border-white/80 bg-white/80 backdrop-blur-md p-5 shadow-neu-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <FormField label="Catatan / Area Audit" id="catatan" hint="Opsional">
              <input
                id="catatan"
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Audit Rutin Akhir Bulan Rak Sembako A & B"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              />
            </FormField>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tambah Barang ke Sesi
            </label>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={selectedBarangId}
                onChange={(e) => setSelectedBarangId(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800 min-w-[140px]"
              >
                <option value="">
                  {availableBarang.length === 0
                    ? '-- Seluruh barang sudah masuk --'
                    : `-- Pilih Barang (${availableBarang.length}) --`}
                </option>
                {availableBarang.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.kode} - {b.nama} (Stok: {b.stok} {b.satuan})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleAddBarang()}
                disabled={!selectedBarangId}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-800 transition-colors shrink-0"
                title="Tambahkan 1 barang terpilih"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMultiSelectModal}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
                title="Pilih beberapa barang sekaligus dengan fitur pencarian"
              >
                <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
                <span>Pilih Banyak</span>
              </button>
            </div>
          </div>
        </div>

        {/* Shortcut Tombol Aksi Cepat */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Pilih barang satuan, pilih beberapa item tertentu, atau muat seluruh katalog gudang sekaligus.
          </span>
          <div className="flex items-center gap-4">
            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium hover:underline transition-colors"
                title="Kosongkan seluruh barang yang sudah dimuat"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Kosongkan Daftar ({rows.length} Item)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLoadAllBarang}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium hover:underline transition-colors"
              title="Masukkan seluruh barang aktif katalog ke sesi"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Muat Semua Barang Aktif ({katalogBarang.length} Item)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Hitung Fisik Interaktif */}
      <div className="rounded-2xl border border-white/80 bg-white shadow-neu-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Rincian Inventarisasi Fisik ({rows.length} Barang)
            </h3>
            {rows.length > 0 && (
              <span className="text-[11px] text-slate-500 hidden md:inline">
                — Masukkan jumlah fisik riil di rak gudang pada kolom Stok Fisik.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {rows.length > 3 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Cari di tabel..."
                  className="rounded-md border border-slate-200 bg-white pl-8 pr-7 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800 w-36 sm:w-48"
                />
                {tableSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTableSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Hapus filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {rows.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors shadow-none"
                title="Hapus semua barang dari sesi opname"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
            <p>Belum ada barang yang dimasukkan ke sesi opname fisik.</p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              <button
                type="button"
                onClick={handleOpenMultiSelectModal}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
                <span>Pilih Banyak Barang</span>
              </button>
              <span className="text-slate-400">atau</span>
              <button
                type="button"
                onClick={handleLoadAllBarang}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium hover:underline transition-colors"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Muat Semua Barang Aktif ({katalogBarang.length} Item)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 text-left w-12">No</th>
                  <th className="py-2 px-3 text-left w-28">Kode</th>
                  <th className="py-2 px-3 text-left">Nama Barang & Satuan</th>
                  <th className="py-2 px-3 text-right w-28">Stok Sistem</th>
                  <th className="py-2 px-3 text-right w-36">Stok Fisik (Riil)</th>
                  <th className="py-2 px-3 text-center w-28">Selisih</th>
                  <th className="py-2 px-3 text-left w-64">Keterangan / Alasan</th>
                  <th className="py-2 px-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                      Tidak ada barang di tabel yang cocok dengan pencarian &quot;{tableSearchQuery}&quot;.
                      <button
                        type="button"
                        onClick={() => setTableSearchQuery('')}
                        className="ml-2 text-indigo-600 hover:underline font-medium"
                      >
                        Reset pencarian
                      </button>
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((r, idx) => {
                    const fisik = typeof r.stok_fisik === 'number' ? r.stok_fisik : 0;
                    const selisih = fisik - r.stok_sistem;

                    let selisihClass = 'bg-slate-100 text-slate-600 border-slate-200';
                    let selisihLabel = 'Cocok (0)';
                    if (selisih < 0) {
                      selisihClass = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                      selisihLabel = `${selisih} ${r.satuan}`;
                    } else if (selisih > 0) {
                      selisihClass = 'bg-blue-50 text-blue-700 border-blue-200 font-semibold';
                      selisihLabel = `+${selisih} ${r.satuan}`;
                    }

                    return (
                      <tr
                        key={r.barang_id}
                        className={`hover:bg-slate-50/75 transition-colors ${
                          selisih !== 0 ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">
                          {r.kode}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {r.nama}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            ({r.satuan})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                          {r.stok_sistem} {r.satuan}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              value={r.stok_fisik}
                              onChange={(e) =>
                                handleStokFisikChange(r.barang_id, e.target.value)
                              }
                              className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                            />
                            <span className="text-[11px] text-slate-500 w-10 text-left">
                              {r.satuan}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-mono ${selisihClass}`}
                          >
                            {selisihLabel}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={r.keterangan}
                            onChange={(e) =>
                              handleKeteranganChange(r.barang_id, e.target.value)
                            }
                            placeholder={
                              selisih !== 0
                                ? 'Wajib/disarankan isi alasan selisih (min 10 karakter)'
                                : 'Catatan opsional'
                            }
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(r.barang_id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={`Hapus ${r.nama} dari sesi`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Panel Ringkasan di Bawah Tabel */}
        {rows.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="border-r border-slate-200 pr-2">
              <span className="text-slate-500 block">Total Item Diperiksa:</span>
              <span className="font-semibold text-slate-900 text-sm">
                {agregat.total} barang
                {tableSearchQuery && (
                  <span className="text-[11px] font-normal text-slate-500 ml-1">
                    (menampilkan {displayedRows.length})
                  </span>
                )}
              </span>
            </div>
            <div className="border-r border-slate-200 pr-2">
              <span className="text-slate-500 block">Stok Sesuai (Cocok):</span>
              <span className="font-semibold text-emerald-700 text-sm">
                {agregat.cocok} barang
              </span>
            </div>
            <div className="border-r border-slate-200 pr-2">
              <span className="text-slate-500 block">Ada Selisih Fisik:</span>
              <span className="font-semibold text-amber-700 text-sm">
                {agregat.defisit + agregat.surplus} barang
                <span className="text-[11px] font-normal text-slate-500 ml-1">
                  ({agregat.defisit} defisit, {agregat.surplus} surplus)
                </span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Net Selisih Unit:</span>
              <span
                className={`font-semibold text-sm ${
                  agregat.totalSelisih < 0
                    ? 'text-red-700'
                    : agregat.totalSelisih > 0
                    ? 'text-blue-700'
                    : 'text-slate-900'
                }`}
              >
                {agregat.totalSelisih > 0 ? `+${agregat.totalSelisih}` : agregat.totalSelisih} unit
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tombol Simpan & Navigasi */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        <Link
          href={isEditing && initialData ? `/stok/opname/${initialData.id}` : '/stok/opname'}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Batalkan Perubahan
        </Link>

        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-none"
        >
          <Save className="h-3.5 w-3.5 text-slate-600" />
          <span>{isSubmitting ? 'Menyimpan...' : 'Simpan sebagai Draf'}</span>
        </button>

        {!isEditing && (
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting || rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-none"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Memproses...' : 'Simpan & Ajukan ke Manajer'}</span>
          </button>
        )}
      </div>

      {/* Modal Dialog Multi-Pilih Barang */}
      <Dialog open={isMultiSelectOpen} onOpenChange={setIsMultiSelectOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
          <DialogHeader className="p-4 border-b border-slate-100">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Pilih Barang untuk Sesi Opname
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pilih satu atau beberapa barang tertentu yang ingin diaudit secara fisik di rak gudang.
            </DialogDescription>

            {/* Input Pencarian Modal */}
            <div className="pt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Cari nama atau kode SKU barang..."
                  className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
                {modalSearch && (
                  <button
                    type="button"
                    onClick={() => setModalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Hapus kata kunci"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {availableInFilteredModal.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllModalFiltered}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <span>
                    {isAllModalFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua Hasil'}
                  </span>
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Daftar Barang dengan Checkbox */}
          <div className="flex-1 overflow-y-auto max-h-[50vh] divide-y divide-slate-100">
            {filteredModalBarang.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Tidak ditemukan barang dengan kata kunci &quot;{modalSearch}&quot;.
              </div>
            ) : (
              filteredModalBarang.map((b) => {
                const isAlreadyAdded = existingBarangIdSet.has(b.id);
                const isChecked = selectedModalIds.has(b.id);

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (!isAlreadyAdded) {
                        toggleModalItem(b.id);
                      }
                    }}
                    className={`flex items-center justify-between p-3 text-xs transition-colors ${
                      isAlreadyAdded
                        ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                        : isChecked
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/60 cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => toggleModalItem(b.id)}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                            {b.kode}
                          </span>
                          <span className="font-medium text-slate-900 truncate">
                            {b.nama}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Stok Sistem: <strong className="text-slate-700">{b.stok} {b.satuan}</strong>
                        </span>
                      </div>
                    </div>

                    <div>
                      {isAlreadyAdded ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Sudah di Sesi
                        </span>
                      ) : isChecked ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Terpilih
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Modal */}
          <DialogFooter className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-600 font-medium">
              {selectedModalIds.size} barang dipilih
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMultiSelectOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyModalSelection}
                disabled={selectedModalIds.size === 0}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambahkan ({selectedModalIds.size}) Barang</span>
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

