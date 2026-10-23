import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/features/pesanan/components/print-button';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatTanggal, formatTanggalWaktu } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { SuratJalanHeader, SuratJalanItem } from '@/features/pesanan/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SuratJalanPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getProfil();

  if (!user || !user.aktif) {
    notFound();
  }

  const supabase = await createServerClient();

  // 1. Ambil data surat jalan dari view khusus non-uang
  const { data: headerRaw, error: headerError } = await supabase
    .from('v_surat_jalan')
    .select(`
      id, nomor, status, dibuat_oleh, dibuat_pada, dikirim_pada, catatan,
      pelanggan_id, pelanggan_kode, pelanggan_nama, pelanggan_telepon, pelanggan_alamat,
      pembuat_nama
    `)
    .eq('id', id)
    .maybeSingle();

  // 2. Jika tidak ditemukan di v_surat_jalan, periksa status pesanan asli
  if (!headerRaw || headerError) {
    const { data: pesananCek } = await supabase
      .from('pesanan_jual')
      .select('id, status, dibuat_oleh')
      .eq('id', id)
      .maybeSingle();

    // Jika pesanan memang tidak ada atau RLS menolak akses
    if (!pesananCek) {
      notFound();
    }

    // Jika status bukan 'dikirim' (misal: draf, dikonfirmasi, lunas, dibatalkan),
    // tampilkan pesan netral sesuai S1 tanpa membocorkan isi data pesanan.
    if (pesananCek.status !== 'dikirim') {
      return (
        <div className="max-w-xl mx-auto py-12 px-4">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-bold text-slate-900">
                  Surat Jalan Belum Tersedia
                </h1>
                <p className="text-xs text-slate-600">
                  Surat jalan hanya tersedia untuk pesanan berstatus dikirim.
                </p>
              </div>
              <div className="pt-2">
                <Button asChild variant="outline" size="sm" className="text-xs gap-1.5 border-slate-300">
                  <Link href={`/pesanan/${id}`}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Kembali ke Detail Pesanan
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Status dikirim tapi v_surat_jalan kosong = hak akses ditolak oleh RLS (sales bukan pemilik)
    notFound();
  }

  const header = headerRaw as unknown as SuratJalanHeader;

  // 3. Ambil baris item pesanan dari view khusus non-uang
  const { data: itemsRaw } = await supabase
    .from('v_surat_jalan_item')
    .select('id, pesanan_jual_id, barang_id, kode_barang, nama_barang, satuan, jumlah')
    .eq('pesanan_jual_id', id)
    .order('kode_barang', { ascending: true });

  const items: SuratJalanItem[] = (itemsRaw || []).map((it) => ({
    id: it.id,
    pesanan_jual_id: it.pesanan_jual_id,
    barang_id: it.barang_id,
    kode_barang: it.kode_barang || '-',
    nama_barang: it.nama_barang || '-',
    satuan: it.satuan || 'pcs',
    jumlah: Number(it.jumlah) || 0,
  }));

  const totalJenis = items.length;
  const totalKuantitas = items.reduce((sum, it) => sum + it.jumlah, 0);
  const nowWIB = new Date();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-8">
      {/* Kontrol Cetak (Disembunyikan saat di-print) */}
      <div className="max-w-4xl mx-auto">
        <PrintButton />
      </div>

      {/* Lembar Dokumen Kertas Cetak A4 */}
      <div className="bg-white border border-slate-300 p-8 sm:p-10 rounded-sm space-y-6 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full">
        {/* Kop Dokumen Perusahaan */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              CV SINAR ABADI NIAGA
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Distributor & Perdagangan Umum
            </p>
            <p className="text-xs text-slate-500">
              Jl. Industri Niaga No. 88, Kawasan Pergudangan, Surabaya
            </p>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-extrabold uppercase tracking-wider text-slate-900">
              SURAT JALAN
            </h2>
            <p className="text-xs font-mono font-bold text-slate-800 mt-1">
              No: {header.nomor}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Tgl Kirim: {header.dikirim_pada ? formatTanggal(header.dikirim_pada) : formatTanggal(header.dibuat_pada)}
            </p>
          </div>
        </div>

        {/* Informasi Penerima & Pengiriman */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">
              Tujuan Pengiriman / Penerima:
            </p>
            <p className="text-sm font-bold text-slate-900">{header.pelanggan_nama}</p>
            <p className="text-slate-500 font-mono text-[11px]">Kode: {header.pelanggan_kode}</p>
            <p className="text-slate-700 mt-1">{header.pelanggan_alamat || '-'}</p>
            <p className="text-slate-600">Telp: {header.pelanggan_telepon || '-'}</p>
          </div>

          <div className="space-y-1 text-right">
            <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">
              Informasi Operasional:
            </p>
            <p className="text-slate-600">
              Status Pengiriman:{' '}
              <span className="font-bold uppercase text-slate-900">
                {header.status}
              </span>
            </p>
            <p className="text-slate-600">
              Petugas Sales:{' '}
              <span className="font-medium text-slate-900">
                {header.pembuat_nama || '-'}
              </span>
            </p>
            <p className="text-slate-600">
              Dicetak Pada:{' '}
              <span className="font-medium text-slate-900">
                {formatTanggalWaktu(nowWIB)}
              </span>
            </p>
          </div>
        </div>

        {/* Catatan Pengiriman jika ada */}
        {header.catatan && (
          <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Catatan Pengiriman: </span>
            {header.catatan}
          </div>
        )}

        {/* Tabel Barang (Murni kuantitas fisik, ZERO-LEAKAGE data finansial) */}
        <div className="pt-1">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-semibold">
                <th className="py-2 px-3 w-12 text-center border-r border-slate-300">No</th>
                <th className="py-2 px-3 w-32 border-r border-slate-300">Kode Barang</th>
                <th className="py-2 px-3 border-r border-slate-300">Nama Barang</th>
                <th className="py-2 px-3 w-28 text-right border-r border-slate-300">Jumlah</th>
                <th className="py-2 px-3 w-24 text-center">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  className="border-b border-slate-200"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <td className="py-2 px-3 text-center border-r border-slate-300 font-mono text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-mono font-medium text-slate-900 border-r border-slate-300">
                    {it.kode_barang}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-300">
                    {it.nama_barang}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 border-r border-slate-300">
                    {it.jumlah.toLocaleString('id-ID')}
                  </td>
                  <td className="py-2 px-3 text-center text-slate-700 font-medium">
                    {it.satuan}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className="bg-slate-50 font-bold border-t-2 border-slate-400"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-xs text-slate-700">
                  Total Muatan Barang:
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sm text-slate-900 border-r border-slate-300">
                  {totalKuantitas.toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-3 text-center text-xs text-slate-600 font-medium">
                  {totalJenis} Jenis
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3 Kotak Tanda Tangan Logistik */}
        <div
          className="pt-8 grid grid-cols-3 gap-6 text-center text-xs"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          {/* Kolom 1: Pengirim / Gudang */}
          <div className="space-y-16">
            <p className="text-slate-700 font-medium">Disiapkan & Dikirim Oleh,</p>
            <div className="border-b border-slate-400 w-40 mx-auto"></div>
            <p className="text-[11px] text-slate-500 font-medium">( Petugas Gudang )</p>
          </div>

          {/* Kolom 2: Pengemudi / Sopir */}
          <div className="space-y-16">
            <p className="text-slate-700 font-medium">Dibawa Oleh / Pengemudi,</p>
            <div className="border-b border-slate-400 w-40 mx-auto"></div>
            <p className="text-[11px] text-slate-500 font-medium">( Sopir / Ekspedisi )</p>
          </div>

          {/* Kolom 3: Penerima / Toko */}
          <div className="space-y-16">
            <p className="text-slate-700 font-medium">Diterima Oleh,</p>
            <div className="border-b border-slate-400 w-40 mx-auto"></div>
            <p className="text-[11px] text-slate-500 font-medium">
              ( Cap & TTD Toko / Penerima )
            </p>
          </div>
        </div>

        {/* Dokumen Footer */}
        <div
          className="border-t border-slate-200 pt-3 text-[10px] text-slate-500 flex justify-between items-center"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <span>
            Dicetak oleh: <strong className="text-slate-700">{user.nama_lengkap}</strong> ({user.peran}) &bull; Waktu:{' '}
            {formatTanggalWaktu(nowWIB)} WIB
          </span>
          <span className="italic">
            Dokumen sah pengiriman logistik CV Sinar Abadi Niaga &bull; Lembar Pengemudi & Penerima
          </span>
        </div>
      </div>
    </div>
  );
}
