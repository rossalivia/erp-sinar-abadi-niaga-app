import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, CreditCard, Building2, Phone, MapPin } from 'lucide-react';

import { BadgeStatus } from '@/components/shared/badge-status';
import { Button } from '@/components/ui/button';
import { PesananActions } from '@/features/pesanan/components/pesanan-actions';
import { PesananTimeline } from '@/features/pesanan/components/pesanan-timeline';
import { PesananItemsTable } from '@/features/pesanan/components/pesanan-items-table';
import { PersetujuanPanel } from '@/features/pesanan/components/persetujuan-panel';
import { MayarPaymentPanel } from '@/features/pembayaran/components/MayarPaymentPanel';
import { isMayarConfigured } from '@/features/pembayaran/mayar-client';
import { ambilRiwayatTagihanMayarService } from '@/features/pembayaran/service';
import type { TagihanMayarRow } from '@/features/pembayaran/types';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggal, formatTanggalWaktu } from '@/lib/format';
import type { ItemPesananJualRow, PesananJualDetail, StatusPesanan, PersetujuanHargaRow } from '@/features/pesanan/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPesananPage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';
  const userId = profil?.id || '';

  const supabase = await createServerClient();

  // 1. Ambil data pesanan jual beserta pelanggan & profil pembuat
  const { data: pesananRaw, error: pesananError } = await supabase
    .from('pesanan_jual')
    .select(`
      id, nomor, status, total, dibuat_oleh, dibuat_pada,
      dikonfirmasi_pada, dikirim_pada, jatuh_tempo, dilunasi_pada,
      dibatalkan_pada, alasan_batal,
      pelanggan:pelanggan_id (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari),
      pembuat:dibuat_oleh (id, nama_lengkap, peran)
    `)
    .eq('id', id)
    .single();

  if (pesananError || !pesananRaw) {
    notFound();
  }

  // Normalisasi objek relasi
  const pelanggan = (Array.isArray(pesananRaw.pelanggan)
    ? pesananRaw.pelanggan[0]
    : pesananRaw.pelanggan) as unknown as PesananJualDetail['pelanggan'];

  const pembuat = (Array.isArray(pesananRaw.pembuat)
    ? pesananRaw.pembuat[0]
    : pesananRaw.pembuat) as unknown as PesananJualDetail['pembuat'];

  const pesanan: PesananJualDetail = {
    ...pesananRaw,
    status: pesananRaw.status as unknown as StatusPesanan,
    total: Number(pesananRaw.total) || 0,
    pelanggan,
    pembuat,
  };

  // 2. Ambil baris item pesanan
  // PENTING: Non-Manajer mengambil dari v_item_pesanan_jual (tanpa hpp_satuan)
  // Manajer mengambil dari v_item_pesanan_jual_manajer (memuat hpp_satuan & margin)
  const isManajer = peran === 'manajer';
  let items: ItemPesananJualRow[] = [];

  if (isManajer) {
    const { data: itemsManajer } = await supabase
      .from('v_item_pesanan_jual_manajer')
      .select(`
        id, pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal,
        hpp_satuan, margin,
        barang:barang_id (id, kode, nama, satuan, stok)
      `)
      .eq('pesanan_jual_id', id);

    items = (itemsManajer || []).map((row) => {
      const b = (Array.isArray(row.barang) ? row.barang[0] : row.barang) as unknown as {
        id: string;
        kode: string;
        nama: string;
        satuan: string;
        stok: number;
      };
      return {
        id: row.id || '',
        pesanan_jual_id: row.pesanan_jual_id || id,
        barang_id: row.barang_id || '',
        jumlah: Number(row.jumlah),
        harga_satuan: Number(row.harga_satuan),
        diskon_persen: Number(row.diskon_persen),
        subtotal: Number(row.subtotal),
        hpp_satuan: row.hpp_satuan !== null ? Number(row.hpp_satuan) : null,
        margin: row.margin !== null ? Number(row.margin) : null,
        barang: b,
      };
    });
  } else {
    const { data: itemsPublik } = await supabase
      .from('v_item_pesanan_jual')
      .select(`
        id, pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal,
        barang:barang_id (id, kode, nama, satuan, stok)
      `)
      .eq('pesanan_jual_id', id);

    items = (itemsPublik || []).map((row) => {
      const b = (Array.isArray(row.barang) ? row.barang[0] : row.barang) as unknown as {
        id: string;
        kode: string;
        nama: string;
        satuan: string;
        stok: number;
      };
      return {
        id: row.id || '',
        pesanan_jual_id: row.pesanan_jual_id || id,
        barang_id: row.barang_id || '',
        jumlah: Number(row.jumlah),
        harga_satuan: Number(row.harga_satuan),
        diskon_persen: Number(row.diskon_persen),
        subtotal: Number(row.subtotal),
        barang: b,
      };
    });
  }

  // 3. Ambil riwayat / persetujuan harga aktif (bila ada)
  const { data: persetujuanRaw } = await supabase
    .from('v_persetujuan_harga')
    .select(`
      id, pesanan_jual_id, nomor_pesanan, status, diajukan_pada,
      keputusan_pada, berlaku_sampai, dipakai_pada, catatan_pengaju,
      catatan_keputusan, alasan_tolak, nama_pengaju, nama_pemutus
    `)
    .eq('pesanan_jual_id', id)
    .order('diajukan_pada', { ascending: false })
    .limit(1)
    .maybeSingle();

  const persetujuan: PersetujuanHargaRow | null = persetujuanRaw
    ? (persetujuanRaw as unknown as PersetujuanHargaRow)
    : null;

  // 4. Ambil data tagihan Mayar jika peran = manajer (M1, M11)
  let tagihanMayarList: TagihanMayarRow[] = [];
  if (isManajer) {
    tagihanMayarList = await ambilRiwayatTagihanMayarService(pesanan.id);
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header Halaman & Aksi */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-slate-300"
            title="Kembali ke Daftar Pesanan"
          >
            <Link href="/pesanan">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight font-mono">
                {pesanan.nomor}
              </h1>
              <BadgeStatus status={pesanan.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dibuat pada {formatTanggalWaktu(pesanan.dibuat_pada)} oleh{' '}
              <span className="font-medium text-slate-700">
                {pesanan.pembuat?.nama_lengkap || 'Pengguna'}
              </span>
            </p>
          </div>
        </div>

        <PesananActions
          pesananId={pesanan.id}
          nomor={pesanan.nomor}
          status={pesanan.status}
          peran={peran}
          userId={userId}
          dibuatOleh={pesanan.dibuat_oleh}
        />
      </div>

      {/* Timeline Status */}
      <PesananTimeline pesanan={pesanan} />

      {/* Kartu Ringkasan Informasi Pelanggan & Keuangan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kolom 1: Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <Building2 className="w-3.5 h-3.5" />
            Informasi Pelanggan
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{pesanan.pelanggan?.nama_toko}</p>
            <p className="text-slate-400 font-mono text-[11px]">{pesanan.pelanggan?.kode}</p>
          </div>
          {pesanan.pelanggan?.telepon && (
            <p className="text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {pesanan.pelanggan.telepon}
            </p>
          )}
          {pesanan.pelanggan?.alamat && (
            <p className="text-slate-600 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{pesanan.pelanggan.alamat}</span>
            </p>
          )}
        </div>

        {/* Kolom 2: Ketentuan Pembayaran */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <CreditCard className="w-3.5 h-3.5" />
            Ketentuan Kredit & Jatuh Tempo
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Termin Pembayaran:</span>
              <span className="font-medium text-slate-800">
                {pesanan.pelanggan?.termin_hari} hari
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Batas Kredit:</span>
              <span className="font-medium text-slate-800 font-mono tabular-nums">
                {formatRupiah(pesanan.pelanggan?.batas_kredit)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <span className="text-slate-500">Jatuh Tempo Pesanan:</span>
              <span className="font-semibold text-slate-900">
                {pesanan.jatuh_tempo ? formatTanggal(pesanan.jatuh_tempo) : 'Belum ditentukan (saat kirim)'}
              </span>
            </div>
          </div>
        </div>

        {/* Kolom 3: Total Nilai */}
        <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2 text-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
            <Calendar className="w-3.5 h-3.5" />
            Ringkasan Tagihan
          </div>
          <div className="py-2">
            <span className="text-slate-500 block text-[11px]">Total Nilai Pesanan:</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatRupiah(pesanan.total)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5 flex justify-between">
            <span>Status Pembayaran:</span>
            <span className="font-medium text-slate-800 capitalize">
              {pesanan.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
            </span>
          </div>
        </div>
      </div>

      {/* Panel Alur Persetujuan Harga di Bawah HPP */}
      <PersetujuanPanel
        pesananId={pesanan.id}
        nomor={pesanan.nomor}
        statusPesanan={pesanan.status}
        peran={peran}
        userId={userId}
        dibuatOleh={pesanan.dibuat_oleh}
        persetujuan={persetujuan}
      />

      {/* Panel Pembayaran Digital Mayar (Khusus Manajer, M1, M11) */}
      {isManajer && (pesanan.status === 'dikirim' || tagihanMayarList.length > 0) && (
        <MayarPaymentPanel
          pesananId={pesanan.id}
          nomorPesanan={pesanan.nomor}
          totalPesanan={pesanan.total}
          statusPesanan={pesanan.status}
          namaToko={pesanan.pelanggan?.nama_toko || 'Pelanggan'}
          teleponToko={pesanan.pelanggan?.telepon}
          tagihanList={tagihanMayarList}
          isMayarActive={isMayarConfigured()}
        />
      )}

      {/* Tabel Baris Item */}
      <PesananItemsTable
        items={items}
        totalPesanan={pesanan.total}
        isManajer={isManajer}
      />
    </div>
  );
}
