import { AlertTriangle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { getErrorMessage } from '@/lib/errors';
import { getWidgetsTugasHarian, parseTugasHarian } from '../utils';
import { TugasHariIni, TugasHariIniHeader } from './tugas-hari-ini';

/** Skeleton halus selama RPC tugas harian dimuat. */
export function TugasHariIniSkeleton() {
  return (
    <section className="space-y-3" aria-busy="true" aria-live="polite">
      <TugasHariIniHeader peran="penjualan" denganAksi={false} />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md p-4 shadow-neu-sm"
          >
            <div className="h-2.5 w-3/4 rounded-full bg-slate-200" />
            <div className="mt-3 h-6 w-10 rounded-lg bg-slate-200" />
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100" />
            <div className="mt-3 h-2 w-1/3 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

function TugasHariIniError({ pesan }: { pesan: string }) {
  return (
    <section className="space-y-3" aria-label="Tugas Hari Ini">
      <TugasHariIniHeader peran="penjualan" denganAksi={false} />
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="font-semibold">Tugas hari ini belum dapat dimuat</p>
          <p className="mt-0.5 text-[11px] text-red-700">{pesan}</p>
          <p className="mt-1 text-[11px] text-red-700/80">
            Bagian lain dasbor tetap dapat digunakan.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Server component mandiri: seluruh ringkasan tugas diambil lewat satu RPC.
 * Komponen ini dibungkus Suspense di halaman dasbor sehingga kegagalannya
 * tidak menjatuhkan widget lain.
 */
export async function TugasHariIniSection() {
  const profil = await getProfil();
  if (!profil) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_get_tugas_harian');

  if (error) {
    return <TugasHariIniError pesan={getErrorMessage(error)} />;
  }

  const tugas = parseTugasHarian(data);
  if (!tugas || tugas.peran !== profil.peran) {
    return (
      <TugasHariIniError pesan="Data tugas harian tidak sesuai dengan peran pengguna." />
    );
  }

  return (
    <TugasHariIni
      widgets={getWidgetsTugasHarian(tugas)}
      peran={profil.peran}
    />
  );
}
