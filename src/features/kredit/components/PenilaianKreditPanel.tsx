'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatRupiah } from '@/lib/format';
import { simulasiLimitAction, terapkanRekomendasiLimitAction } from '../actions';
import type { AnalisisKredit, SimulasiLimitHasil } from '../types';
import { 
  ShieldCheck, 
  AlertCircle, 
  Calculator, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus 
} from 'lucide-react';

interface PenilaianKreditPanelProps {
  analisis: AnalisisKredit;
  currentBatasKredit: number;
}

export function PenilaianKreditPanel({
  analisis,
  currentBatasKredit,
}: PenilaianKreditPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State Simulasi
  const [inputLimitHipotetik, setInputLimitHipotetik] = useState<string>(
    analisis.rekomendasi_limit ? String(analisis.rekomendasi_limit) : String(currentBatasKredit)
  );
  const [simulasiHasil, setSimulasiHasil] = useState<SimulasiLimitHasil | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const getBadgeKelasStyle = (kelas: string) => {
    switch (kelas) {
      case 'A':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'B':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'C':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'D':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusRekomendasiBadge = (status: string | null) => {
    switch (status) {
      case 'Naikkan':
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ArrowUpRight className="h-3 w-3" /> Naikkan
          </span>
        );
      case 'Tinjau penurunan':
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-50 text-red-800 border border-red-200">
            <ArrowDownRight className="h-3 w-3" /> Tinjau Penurunan
          </span>
        );
      case 'Pertahankan':
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
            <Minus className="h-3 w-3" /> Pertahankan
          </span>
        );
      default:
        return null;
    }
  };

  const handleSimulasi = async () => {
    const nilai = Number(inputLimitHipotetik);
    if (isNaN(nilai) || nilai < 0) return;

    setIsSimulating(true);
    const res = await simulasiLimitAction(analisis.pelanggan_id, nilai);
    setIsSimulating(false);

    if (res.success && res.data) {
      setSimulasiHasil(res.data);
    }
  };

  const handleTerapkan = () => {
    if (!analisis.rekomendasi_limit) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await terapkanRekomendasiLimitAction(
        analisis.pelanggan_id,
        analisis.rekomendasi_limit!
      );
      setConfirmOpen(false);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              <CardTitle className="text-base font-semibold text-slate-900">
                Penilaian & Rekomendasi Kredit
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Indikasi berdasarkan riwayat transaksi, bukan keputusan.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold ${getBadgeKelasStyle(
                analisis.kelas
              )}`}
            >
              {analisis.kelas === 'Data belum cukup' ? 'Data Belum Cukup' : `Kelas ${analisis.kelas}`}
            </span>
            {analisis.skor_total !== null && (
              <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 tabular-nums">
                Skor: {analisis.skor_total}/100
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {feedback && (
          <div
            className={`p-3 rounded text-xs border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {!analisis.data_cukup ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>Data Riwayat Belanja Belum Memenuhi Ambang Evaluasi</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {analisis.alasan_data_kurang ||
                'Pelanggan memerlukan minimal 3 faktur lunas dan riwayat belanja sekurang-kurangnya 28 hari sejak pengiriman pertama untuk menghasilkan skor dan rekomendasi kredit.'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 text-slate-700">
              <div>
                <span className="text-slate-500">Faktur Lunas:</span>{' '}
                <strong className="tabular-nums">{analisis.faktur_lunas} / 3 faktur</strong>
              </div>
              <div>
                <span className="text-slate-500">Lama Riwayat:</span>{' '}
                <strong className="tabular-nums">{analisis.lama_pelanggan_hari} / 28 hari</strong>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Ikhtisar Rekomendasi Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded border border-slate-100 bg-slate-50/50">
              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Rekomendasi Batas Kredit
                </div>
                <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                  {formatRupiah(analisis.rekomendasi_limit)}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {getStatusRekomendasiBadge(analisis.status_rekomendasi)}
                  {analisis.selisih_limit !== null && analisis.selisih_limit !== 0 && (
                    <span className="text-xs text-slate-500 tabular-nums">
                      ({analisis.selisih_limit > 0 ? '+' : ''}
                      {formatRupiah(analisis.selisih_limit)})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Pembatas Mengikat
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1">
                  {analisis.pembatas_mengikat || '-'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Kebutuhan: {formatRupiah(analisis.kebutuhan_limit)}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Status Tinjau Limit
                </div>
                <div className="text-xs font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {analisis.status_tinjau === 'terlambat' ? (
                    <span className="text-red-700 font-bold">Terlambat ({analisis.hari_sejak_tinjau_limit} hari)</span>
                  ) : analisis.status_tinjau === 'perlu_tinjau' ? (
                    <span className="text-amber-700 font-semibold">Perlu Tinjau ({analisis.hari_sejak_tinjau_limit} hari)</span>
                  ) : (
                    <span className="text-slate-600">Normal ({analisis.hari_sejak_tinjau_limit} hari)</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Utilisasi: {analisis.pemakaian_limit_persen}%
                </div>
              </div>
            </div>

            {/* 4 Pilar Skor */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-800">
                Rincian 4 Pilar Skor Perilaku (Total: {analisis.skor_total}/100)
              </div>

              <div className="space-y-2.5">
                {/* Pilar 1: Ketepatan Bayar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>1. Ketepatan Pembayaran ({analisis.persen_tepat_waktu}% tepat waktu)</span>
                    <strong className="text-slate-900 tabular-nums">{analisis.skor_tepat_waktu} / 50</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${((analisis.skor_tepat_waktu || 0) / 50) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Pilar 2: Deviasi Keterlambatan */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>2. Deviasi Keterlambatan (Rata-rata {analisis.rata_hari_terlambat} hari telat)</span>
                    <strong className="text-slate-900 tabular-nums">{analisis.skor_keterlambatan} / 20</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${((analisis.skor_keterlambatan || 0) / 20) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Pilar 3: Kondisi Tagihan Saat Ini */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>
                      3. Kondisi Tagihan Saat Ini (
                      {analisis.hari_overdue_terlama > 0
                        ? `Overdue terlama ${analisis.hari_overdue_terlama} hari`
                        : 'Lancar tanpa overdue'}
                      )
                    </span>
                    <strong className="text-slate-900 tabular-nums">{analisis.skor_kondisi_sekarang} / 20</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 rounded-full"
                      style={{ width: `${((analisis.skor_kondisi_sekarang || 0) / 20) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Pilar 4: Kedalaman Riwayat */}
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>4. Kedalaman Riwayat Transaksi ({analisis.faktur_lunas} faktur lunas selesai)</span>
                    <strong className="text-slate-900 tabular-nums">{analisis.skor_kedalaman} / 10</strong>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full"
                      style={{ width: `${((analisis.skor_kedalaman || 0) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Aksi Terapkan Rekomendasi */}
            {analisis.rekomendasi_limit !== null && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Batas saat ini:{' '}
                  <strong className="text-slate-800 tabular-nums">{formatRupiah(currentBatasKredit)}</strong>
                  {' → '}Saran baru:{' '}
                  <strong className="text-slate-900 tabular-nums">{formatRupiah(analisis.rekomendasi_limit)}</strong>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={isPending || currentBatasKredit === analisis.rekomendasi_limit}
                  onClick={() => setConfirmOpen(true)}
                  className="bg-slate-900 text-white hover:bg-slate-800 shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {currentBatasKredit === analisis.rekomendasi_limit
                    ? 'Limit Sudah Sesuai Saran'
                    : 'Terapkan Rekomendasi Limit'}
                </Button>
              </div>
            )}

            {/* Simulasi Limit Hipotetik */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Calculator className="h-3.5 w-3.5 text-slate-600" />
                <span>Simulasi Dampak Limit Hipotetik</span>
              </div>

              <div className="flex items-center gap-2 max-w-sm">
                <Input
                  type="number"
                  min="0"
                  step="100000"
                  value={inputLimitHipotetik}
                  onChange={(e) => setInputLimitHipotetik(e.target.value)}
                  placeholder="Masukkan nominal limit (Rp)"
                  className="h-8 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulasi}
                  disabled={isSimulating}
                  className="h-8 text-xs shrink-0"
                >
                  {isSimulating ? 'Menghitung...' : 'Simulasikan'}
                </Button>
              </div>

              {simulasiHasil && (
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-500">Proyeksi Utilisasi:</span>{' '}
                    <strong className="tabular-nums text-slate-900">
                      {simulasiHasil.pemakaian_persen_hipotetik}%
                    </strong>{' '}
                    <span className="text-[10px] text-slate-400">
                      (Saat ini: {simulasiHasil.pemakaian_persen_sekarang}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Selisih vs Saran:</span>{' '}
                    <strong className="tabular-nums text-slate-900">
                      {simulasiHasil.selisih_terhadap_rekomendasi > 0 ? '+' : ''}
                      {formatRupiah(simulasiHasil.selisih_terhadap_rekomendasi)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Plafon Portofolio:</span>{' '}
                    <strong className="tabular-nums text-slate-900">
                      {formatRupiah(simulasiHasil.total_limit_semua_sesudah)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Terapkan Rekomendasi Batas Kredit"
        description={`Apakah Anda yakin ingin memperbarui batas kredit pelanggan ini dari ${formatRupiah(
          currentBatasKredit
        )} menjadi ${formatRupiah(
          analisis.rekomendasi_limit
        )}? Perubahan ini akan segera dicatat di audit log sistem.`}
        confirmLabel="Ya, Terapkan"
        cancelLabel="Batal"
        isLoading={isPending}
        onConfirm={handleTerapkan}
      />
    </Card>
  );
}
