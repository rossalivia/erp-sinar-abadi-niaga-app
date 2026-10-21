import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { PesananEditor } from '@/features/pesanan/components/pesanan-editor';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import type { BarangOption, PelangganOption } from '@/features/pesanan/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UbahPesananPage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';

  if (peran === 'gudang') {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // Ambil data pesanan
  const { data: pesanan, error: pesananError } = await supabase
    .from('pesanan_jual')
    .select('id, nomor, pelanggan_id, status, dibuat_oleh')
    .eq('id', id)
    .single();

  if (pesananError || !pesanan) {
    notFound();
  }

  // Validasi status harus draf
  if (pesanan.status !== 'draf') {
    redirect(`/pesanan/${id}`);
  }

  // Penjualan hanya boleh mengubah draf miliknya
  if (peran === 'penjualan' && pesanan.dibuat_oleh !== profil?.id) {
    redirect('/tidak-berwenang');
  }

  // Ambil pelanggan aktif
  const { data: pelangganData } = await supabase
    .from('pelanggan')
    .select('id, kode, nama_toko, alamat, termin_hari, batas_kredit')
    .eq('aktif', true)
    .order('nama_toko', { ascending: true });

  // Ambil barang aktif dari view v_barang
  const { data: barangData } = await supabase
    .from('v_barang')
    .select('id, kode, nama, satuan, harga_jual, stok')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  // Ambil baris item yang sudah ada
  const { data: existingItems } = await supabase
    .from('v_item_pesanan_jual')
    .select('barang_id, jumlah, diskon_persen')
    .eq('pesanan_jual_id', id);

  const pelangganList: PelangganOption[] = (pelangganData || []).map((p) => ({
    id: p.id,
    kode: p.kode,
    nama_toko: p.nama_toko,
    alamat: p.alamat || '',
    termin_hari: p.termin_hari ?? 0,
    batas_kredit: Number(p.batas_kredit) || 0,
  }));

  const barangList: BarangOption[] = (barangData || [])
    .filter((b) => Boolean(b.id))
    .map((b) => ({
      id: b.id || '',
      kode: b.kode || '',
      nama: b.nama || '',
      satuan: b.satuan || '',
      harga_jual: Number(b.harga_jual) || 0,
      stok: Number(b.stok) || 0,
    }));

  const initialItems = (existingItems || [])
    .filter((it) => Boolean(it.barang_id))
    .map((it) => ({
      barang_id: it.barang_id || '',
      jumlah: Number(it.jumlah) || 1,
      diskon_persen: Number(it.diskon_persen) || 0,
    }));

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title={`Ubah Draf Pesanan ${pesanan.nomor}`}
        description="Perbarui informasi pelanggan atau daftar barang pesanan sebelum dikonfirmasi."
      />

      <PesananEditor
        peran={peran}
        pelangganList={pelangganList}
        barangList={barangList}
        initialData={{
          id: pesanan.id,
          nomor: pesanan.nomor,
          pelanggan_id: pesanan.pelanggan_id,
          items: initialItems,
        }}
      />
    </div>
  );
}
