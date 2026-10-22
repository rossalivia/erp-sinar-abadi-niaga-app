import * as React from 'react';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { ambilDaftarTagihanAction } from '@/features/penagihan/actions';
import { hitungRingkasanTagihan } from '@/features/penagihan/utils';
import { KartuMetrikPenagihan } from '@/features/penagihan/components/KartuMetrikPenagihan';
import { TabelTagihan } from '@/features/penagihan/components/TabelTagihan';

export const metadata: Metadata = {
  title: 'Penagihan Piutang | CV Sinar Abadi Niaga',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PenagihanPage() {
  const profil = await getProfil();

  // Route guard: Hanya Manajer dan Penjualan yang diizinkan
  if (!profil || (profil.peran !== 'manajer' && profil.peran !== 'penjualan')) {
    redirect('/tidak-berwenang');
  }

  const res = await ambilDaftarTagihanAction();
  const tagihanList = res.success && res.data ? res.data : [];
  const ringkasan = hitungRingkasanTagihan(tagihanList);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penagihan Piutang & Monitoring Tagihan"
        description="Monitoring faktur terkirim yang belum lunas, pengingat WhatsApp, dan catatan janji bayar pelanggan."
      />

      {/* Kartu Ringkasan Metrik (KPI) */}
      <KartuMetrikPenagihan ringkasan={ringkasan} />

      {/* Tabel Data Tagihan dengan Filter & Aksi */}
      <TabelTagihan initialItems={tagihanList} peran={profil.peran} />
    </div>
  );
}
