import Link from 'next/link';
import { ArrowRight, CheckSquare, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toneEfektif } from '../utils';
import type { ToneTugas, WidgetTugas } from '../types';
import type { Peran } from '@/types/auth';

const GAYA_KARTU: Record<ToneTugas, string> = {
  neutral: 'border-slate-200 bg-white',
  info: 'border-blue-200 bg-blue-50/50',
  warning: 'border-amber-200 bg-amber-50/50',
  danger: 'border-red-200 bg-red-50/50',
};

const GAYA_ANGKA: Record<ToneTugas, string> = {
  neutral: 'text-slate-900',
  info: 'text-blue-800',
  warning: 'text-amber-800',
  danger: 'text-red-700',
};

const VARIAN_BADGE: Record<
  ToneTugas,
  'neutral' | 'info' | 'warning' | 'danger'
> = {
  neutral: 'neutral',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
};

interface TugasHariIniProps {
  widgets: WidgetTugas[];
  peran: Peran;
}

export function TugasHariIniHeader({
  peran,
  denganAksi = true,
}: {
  peran: Peran;
  denganAksi?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-600">
          <CheckSquare className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Tugas Hari Ini
          </h3>
          <p className="text-[11px] text-slate-500">
            Antrean pekerjaan dan status operasional yang memerlukan perhatian
            Anda hari ini
          </p>
        </div>
      </div>
      {denganAksi && peran !== 'penjualan' && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 self-start text-xs sm:self-auto"
        >
          <Link href="/gudang/picking">
            <ClipboardList className="h-3.5 w-3.5" />
            Daftar Ambil Barang
          </Link>
        </Button>
      )}
    </div>
  );
}

export function TugasHariIni({ widgets, peran }: TugasHariIniProps) {
  return (
    <section className="space-y-3" aria-label="Tugas Hari Ini">
      <TugasHariIniHeader peran={peran} />

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {widgets.map((widget) => {
          const tone = toneEfektif(widget.tone, widget.nilai);
          const nol = widget.nilai === 0;

          return (
            <Link
              key={widget.key}
              href={widget.href}
              className={cn(
                'group flex flex-col justify-between rounded-md border p-3.5 transition-colors hover:border-slate-300',
                GAYA_KARTU[tone]
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-[11px] font-semibold leading-snug text-slate-700">
                    {widget.judul}
                  </p>
                  {!nol && (
                    <Badge
                      variant={VARIAN_BADGE[tone]}
                      className="shrink-0 text-[9px] leading-tight"
                    >
                      {widget.indikator}
                    </Badge>
                  )}
                </div>

                <p
                  className={cn(
                    'mt-1.5 text-2xl font-bold leading-none tabular-nums',
                    nol ? 'text-slate-400' : GAYA_ANGKA[tone]
                  )}
                >
                  {widget.nilai.toLocaleString('id-ID')}
                  {widget.satuan && (
                    <span className="ml-1 text-[10px] font-medium text-slate-500">
                      {widget.satuan}
                    </span>
                  )}
                </p>

                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  {widget.keterangan}
                </p>
              </div>

              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 group-hover:text-slate-900">
                Buka antrean
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
