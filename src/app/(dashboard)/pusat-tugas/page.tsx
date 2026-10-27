import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Zap, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  TugasHariIniSection,
  TugasHariIniSkeleton,
} from '@/features/pusat-tugas/components/tugas-hari-ini-section';

export const metadata: Metadata = {
  title: 'Pusat Tugas Prioritas | CV Sinar Abadi Niaga',
  description: 'Antrean operasional dan transaksi harian yang memerlukan tindakan segera.',
  robots: { index: false, follow: false },
};

export default async function PusatTugasPage() {
  const user = await getProfil();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Pusat Tugas Prioritas"
          description={`Antrean operasional harian yang memerlukan tindakan segera untuk akun ${user.nama_lengkap} (${user.peran.toUpperCase()}).`}
        />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-slate-300 dark:border-slate-700">
            <Link href="/">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Dashboard</span>
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs gap-1.5 bg-[#0c1b3a] dark:bg-blue-600 text-white hover:bg-[#152a54]">
            <Link href="/pusat-tugas">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan Antrean</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero Information Card */}
      <div className="surface-raised rounded-2xl p-4 sm:p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-colors duration-150">
        <div className="flex items-start gap-3.5">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0c1a30] dark:text-slate-100">
              Antrean Operasional Terintegrasi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Seluruh item tugas dihitung secara otomatis melalui fungsi database sistem (RPC). Klik kartu tindakan di bawah untuk langsung menuju dokumen atau formulir terkait guna menyelesaikan antrean.
            </p>
          </div>
        </div>
      </div>

      {/* Bagian Tugas Hari Ini */}
      <Suspense fallback={<TugasHariIniSkeleton />}>
        <TugasHariIniSection />
      </Suspense>
    </div>
  );
}
