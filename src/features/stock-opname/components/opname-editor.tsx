'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, ArrowLeft, Save, Send, AlertCircle, Layers } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
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

  // Tambah 1 barang ke tabel
  const handleAddBarang = (barangIdToAdd?: string) => {
    const targetId = barangIdToAdd || selectedBarangId;
    if (!targetId) return;

    if (rows.some((r) => r.barang_id === targetId)) {
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

  // Hapus baris
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

      {/* Form Metadata Sesi */}
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
            <div className="flex items-center gap-2">
              <select
                value={selectedBarangId}
                onChange={(e) => setSelectedBarangId(e.target.value)}
                className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
              >
                <option value="">-- Pilih Barang --</option>
                {katalogBarang.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.kode} - {b.nama} (Stok: {b.stok} {b.satuan})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleAddBarang()}
                disabled={!selectedBarangId}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah</span>
              </button>
            </div>
          </div>
        </div>

        {/* Shortcut Tombol Muat Semua Barang */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Pilih barang satuan atau masukkan seluruh katalog gudang sekaligus.
          </span>
          <button
            type="button"
            onClick={handleLoadAllBarang}
            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium hover:underline"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Muat Semua Barang Aktif ({katalogBarang.length} Item)</span>
          </button>
        </div>
      </div>

      {/* Tabel Hitung Fisik Interaktif */}
      <div className="rounded-2xl border border-white/80 bg-white shadow-neu-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Rincian Inventarisasi Fisik ({rows.length} Barang)
          </h3>
          <span className="text-[11px] text-slate-500">
            Ketikkan jumlah fisik riil di rak gudang pada kolom Stok Fisik.
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Belum ada barang yang dimasukkan. Pilih barang di atas atau klik &quot;Muat Semua Barang Aktif&quot;.
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
                  <th className="py-2 px-3 text-center w-16">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => {
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
                          placeholder={selisih !== 0 ? 'Wajib/disarankan isi alasan selisih' : 'Catatan opsional'}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.barang_id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Hapus baris"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
