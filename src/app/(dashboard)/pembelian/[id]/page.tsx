import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Package,
  Calendar,
  Phone,
  MapPin,
} from 'lucide-react';

import { BadgeStatus } from '@/components/shared/badge-status';
import { Button } from '@/components/ui/button';
import { PembelianActions } from '@/features/pembelian/components/pembelian-actions';
import { PembelianTimeline } from '@/features/pembelian/components/pembelian-timeline';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggalWaktu } from '@/lib/format';
import type { PembelianDetail, StatusPembelian } from '@/features/pembelian/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPembelianPage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  const peran = profil?.peran || 'gudang';

  // Penjualan dilarang mengakses modul pembelian
  if (peran === 'penjualan') {
    redirect('/tidak-berwenang');
  }

  const isManajer = peran === 'manajer';
  const supabase = await createServerClient();

  let poRaw: Record<string, unknown> | null = null;
  let poError: unknown = null;

  if (isManajer) {
    const res = await supabase
      .from('v_pembelian_manajer')
      .select('id, nomor, status, jumlah_dipesan, jumlah_diterima, alasan_tolak, diajukan_oleh, diajukan_pada, diputuskan_oleh, diputuskan_pada, diterima_oleh, diterima_pada, harga_beli_satuan, total_estimasi_beli, pemasok:pemasok_id (id, kode, nama, telepon, alamat), barang:barang_id (id, kode, nama, satuan, stok), pengaju:diajukan_oleh (nama_lengkap), pemutus:diputuskan_oleh (nama_lengkap), penerima:diterima_oleh (nama_lengkap)')
      .eq('id', id)
      .single();
    poRaw = res.data as Record<string, unknown> | null;
    poError = res.error;
  } else {
    const res = await supabase
      .from('v_pembelian')
      .select('id, nomor, status, jumlah_dipesan, jumlah_diterima, alasan_tolak, diajukan_oleh, diajukan_pada, diputuskan_oleh, diputuskan_pada, diterima_oleh, diterima_pada, pemasok:pemasok_id (id, kode, nama, telepon, alamat), barang:barang_id (id, kode, nama, satuan, stok), pengaju:diajukan_oleh (nama_lengkap), pemutus:diputuskan_oleh (nama_lengkap), penerima:diterima_oleh (nama_lengkap)')
      .eq('id', id)
      .single();
    poRaw = res.data as Record<string, unknown> | null;
    poError = res.error;
  }

  if (poError || !poRaw) {
    notFound();
  }

  const pemasok = (Array.isArray(poRaw.pemasok) ? poRaw.pemasok[0] : poRaw.pemasok) as unknown as PembelianDetail['pemasok'];
  const barang = (Array.isArray(poRaw.barang) ? poRaw.barang[0] : poRaw.barang) as unknown as PembelianDetail['barang'];
  const pengaju = (Array.isArray(poRaw.pengaju) ? poRaw.pengaju[0] : poRaw.pengaju) as unknown as PembelianDetail['pengaju'];
  const pemutus = (Array.isArray(poRaw.pemutus) ? poRaw.pemutus[0] : poRaw.pemutus) as unknown as PembelianDetail['pemutus'];
  const penerima = (Array.isArray(poRaw.penerima) ? poRaw.penerima[0] : poRaw.penerima) as unknown as PembelianDetail['penerima'];

  const pembelian: PembelianDetail = {
    id: String(poRaw.id || ''),
    nomor: String(poRaw.nomor || ''),
    pemasok_id: pemasok?.id || '',
    barang_id: barang?.id || '',
    jumlah_dipesan: Number(poRaw.jumlah_dipesan) || 0,
    jumlah_diterima: Number(poRaw.jumlah_diterima) || 0,
    status: (poRaw.status as StatusPembelian) || 'diajukan',
    alasan_tolak: poRaw.alasan_tolak ? String(poRaw.alasan_tolak) : null,
    diajukan_oleh: String(poRaw.diajukan_oleh || ''),
    diajukan_pada: String(poRaw.diajukan_pada || ''),
    diputuskan_oleh: poRaw.diputuskan_oleh ? String(poRaw.diputuskan_oleh) : null,
    diputuskan_pada: poRaw.diputuskan_pada ? String(poRaw.diputuskan_pada) : null,
    diterima_oleh: poRaw.diterima_oleh ? String(poRaw.diterima_oleh) : null,
    diterima_pada: poRaw.diterima_pada ? String(poRaw.diterima_pada) : null,
    pemasok,
    barang,
    pengaju,
    pemutus,
    penerima,
    harga_beli_satuan: isManajer && poRaw.harga_beli_satuan !== undefined && poRaw.harga_beli_satuan !== null ? Number(poRaw.harga_beli_satuan) : null,
    total_estimasi_beli: isManajer && poRaw.total_estimasi_beli !== undefined && poRaw.total_estimasi_beli !== null ? Number(poRaw.total_estimasi_beli) : null,
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header Halaman & Aksi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-slate-300"
            title="Kembali ke Daftar PO"
          >
            <Link href="/pembelian">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight font-mono">
                {pembelian.nomor}
              </h1>
              <BadgeStatus status={pembelian.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Diajukan pada {formatTanggalWaktu(pembelian.diajukan_pada)} oleh{' '}
              <span className="font-medium text-slate-700">
                {pembelian.pengaju?.nama_lengkap || 'Staf'}
              </span>
            </p>
          </div>
        </div>

        <PembelianActions
          pembelianId={pembelian.id}
          nomor={pembelian.nomor}
          status={pembelian.status}
          jumlahDipesan={pembelian.jumlah_dipesan}
          peran={peran}
        />
      </div>

      {/* Timeline Status */}
      <PembelianTimeline pembelian={pembelian} />

      {/* Kartu Informasi PO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pemasok */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <Building2 className="w-3.5 h-3.5" />
            Informasi Pemasok
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{pembelian.pemasok?.nama}</p>
            <p className="text-slate-400 font-mono text-[11px]">{pembelian.pemasok?.kode}</p>
          </div>
          {pembelian.pemasok?.telepon && (
            <p className="text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {pembelian.pemasok.telepon}
            </p>
          )}
          {pembelian.pemasok?.alamat && (
            <p className="text-slate-600 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{pembelian.pemasok.alamat}</span>
            </p>
          )}
        </div>

        {/* Barang Dipesan */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <Package className="w-3.5 h-3.5" />
            Rincian Barang
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{pembelian.barang?.nama}</p>
            <p className="text-slate-400 font-mono text-[11px]">{pembelian.barang?.kode}</p>
          </div>
          <div className="pt-1 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Jumlah Dipesan:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums">
                {pembelian.jumlah_dipesan} {pembelian.barang?.satuan}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jumlah Diterima:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums">
                {pembelian.status === 'diterima'
                  ? `${pembelian.jumlah_diterima} ${pembelian.barang?.satuan}`
                  : 'Belum diterima'}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1">
              <span className="text-slate-500">Stok Master Saat Ini:</span>
              <span className="font-mono text-slate-700">
                {pembelian.barang?.stok} {pembelian.barang?.satuan}
              </span>
            </div>
          </div>
        </div>

        {/* Informasi Keuangan (Khusus Manajer) / Catatan (Gudang) */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <Calendar className="w-3.5 h-3.5" />
            {isManajer ? 'Nilai Pengadaan (Manajer)' : 'Keterangan Pengadaan'}
          </div>

          {isManajer ? (
            <div className="space-y-2 py-1">
              <div>
                <span className="text-slate-500 block text-[11px]">Harga Beli Satuan:</span>
                <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                  {pembelian.harga_beli_satuan ? formatRupiah(pembelian.harga_beli_satuan) : 'Menunggu Penetapan'}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-1.5 flex justify-between">
                <span className="text-slate-500">Total Nilai Pembelian:</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums">
                  {pembelian.total_estimasi_beli ? formatRupiah(pembelian.total_estimasi_beli) : '-'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 space-y-2 text-slate-600">
              <p>
                Informasi harga pengadaan dikelola langsung oleh Manajer sesuai matriks kerahasiaan data perusahaan.
              </p>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500">
                Staf Gudang hanya bertugas mengajukan kuantitas PO dan memverifikasi penerimaan fisik barang.
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-1.5 flex justify-between">
            <span>Status PO:</span>
            <span className="font-medium text-slate-700 uppercase">{pembelian.status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
