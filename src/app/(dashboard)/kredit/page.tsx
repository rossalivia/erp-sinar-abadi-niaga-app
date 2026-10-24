import { redirect } from 'next/navigation';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { formatRupiah } from '@/lib/format';
import { ambilDaftarPemantauanKreditAction } from '@/features/kredit/actions';
import { PemantauanKreditTable } from '@/features/kredit/components/PemantauanKreditTable';
import { 
  Wallet, 
  Receipt, 
  Clock, 
  Users 
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pemantauan Kredit Pelanggan | CV Sinar Abadi Niaga',
  robots: 'noindex, nofollow',
};

export default async function PemantauanKreditPage() {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const res = await ambilDaftarPemantauanKreditAction();
  const items = res.success && res.data ? res.data : [];

  // Hitung Metrik Eksekutif
  const distribusi = {
    A: items.filter((i) => i.kelas === 'A').length,
    B: items.filter((i) => i.kelas === 'B').length,
    C: items.filter((i) => i.kelas === 'C').length,
    D: items.filter((i) => i.kelas === 'D').length,
    belumCukup: items.filter((i) => i.kelas === 'Data belum cukup').length,
  };

  const totalPlafonLimit = items.reduce((acc, curr) => acc + Number(curr.batas_kredit || 0), 0);
  const totalPiutangBerjalan = items.reduce((acc, curr) => acc + Number(curr.piutang_berjalan || 0), 0);
  const rasioUtilisasi = totalPlafonLimit > 0 ? (totalPiutangBerjalan / totalPlafonLimit) * 100 : 0;
  const totalPerluTinjau = items.filter(
    (i) => i.status_tinjau === 'perlu_tinjau' || i.status_tinjau === 'terlambat'
  ).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Pemantauan Kredit Pelanggan"
        description="Ikhtisar kesehatan piutang, kelas perilaku bayar toko, dan rekomendasi batas kredit berbasis algoritma database."
      />

      {/* 4 Kartu Ringkasan Eksekutif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Kartu 1: Distribusi Kelas */}
        <Card className="border-slate-200 shadow-none bg-white">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Distribusi Kelas</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                A: {distribusi.A}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                B: {distribusi.B}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                C: {distribusi.C}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
                D: {distribusi.D}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                ?: {distribusi.belumCukup}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Total {items.length} pelanggan aktif
            </div>
          </CardContent>
        </Card>

        {/* Kartu 2: Total Plafon Limit */}
        <Card className="border-slate-200 shadow-none bg-white">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Plafon Limit</span>
              <Wallet className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1.5 tabular-nums">
              {formatRupiah(totalPlafonLimit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Akumulasi batas kredit seluruh toko
            </div>
          </CardContent>
        </Card>

        {/* Kartu 3: Total Piutang Berjalan */}
        <Card className="border-slate-200 shadow-none bg-white">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Piutang Berjalan</span>
              <Receipt className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1.5 tabular-nums">
              {formatRupiah(totalPiutangBerjalan)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Rasio Utilisasi Portofolio:{' '}
              <strong className="text-slate-800 tabular-nums">
                {rasioUtilisasi.toFixed(1)}%
              </strong>
            </div>
          </CardContent>
        </Card>

        {/* Kartu 4: Perlu Ditinjau */}
        <Card className="border-slate-200 shadow-none bg-white">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Perlu Ditinjau</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1.5 tabular-nums flex items-center gap-1.5">
              <span>{totalPerluTinjau}</span>
              <span className="text-xs font-normal text-slate-500">toko</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Mencapai &ge;90 hari sejak tinjau limit
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Data Pemantauan */}
      <PemantauanKreditTable initialItems={items} />
    </div>
  );
}
