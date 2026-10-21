import * as React from 'react';
import { Clock, CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
import { formatTanggalWaktu } from '@/lib/format';
import type { PembelianDetail } from '../types';

interface PembelianTimelineProps {
  pembelian: PembelianDetail;
}

export function PembelianTimeline({ pembelian }: PembelianTimelineProps) {
  const isDitolak = pembelian.status === 'ditolak';

  const steps = [
    {
      id: 'diajukan',
      title: 'PO Diajukan',
      time: pembelian.diajukan_pada ? formatTanggalWaktu(pembelian.diajukan_pada) : null,
      desc: pembelian.pengaju?.nama_lengkap
        ? `Oleh ${pembelian.pengaju.nama_lengkap}`
        : 'Pengajuan dibuat',
      isCompleted: true,
      icon: Clock,
    },
    {
      id: 'disetujui',
      title: 'Disetujui Manajer',
      time: pembelian.diputuskan_pada ? formatTanggalWaktu(pembelian.diputuskan_pada) : null,
      desc: pembelian.pemutus?.nama_lengkap
        ? `Oleh ${pembelian.pemutus.nama_lengkap}`
        : 'Menunggu keputusan Manajer',
      isCompleted: Boolean(pembelian.diputuskan_pada && pembelian.status !== 'ditolak'),
      icon: CheckCircle2,
    },
    {
      id: 'diterima',
      title: 'Barang Diterima',
      time: pembelian.diterima_pada ? formatTanggalWaktu(pembelian.diterima_pada) : null,
      desc: pembelian.diterima_pada
        ? `${pembelian.jumlah_diterima} unit diterima (${pembelian.penerima?.nama_lengkap || 'Gudang'})`
        : 'Menunggu penerimaan fisik',
      isCompleted: Boolean(pembelian.diterima_pada),
      icon: PackageCheck,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Alur Proses Pembelian (PO)
      </h3>

      {isDitolak ? (
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-md text-red-900 text-xs">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Pengajuan PO Ditolak oleh Manajer</p>
            <p className="text-slate-600">
              Waktu:{' '}
              <span className="font-medium text-slate-800">
                {formatTanggalWaktu(pembelian.diputuskan_pada)}
              </span>{' '}
              oleh{' '}
              <span className="font-medium text-slate-800">
                {pembelian.pemutus?.nama_lengkap || 'Manajer'}
              </span>
            </p>
            {pembelian.alasan_tolak && (
              <p className="text-slate-700 mt-1">
                Alasan Penolakan:{' '}
                <span className="italic font-normal text-slate-900 bg-white/70 px-1.5 py-0.5 rounded border border-red-100">
                  &ldquo;{pembelian.alasan_tolak}&rdquo;
                </span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 rounded-md border text-xs transition-colors ${
                  step.isCompleted
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-dashed border-slate-200 opacity-60'
                }`}
              >
                <div
                  className={`p-1.5 rounded shrink-0 ${
                    step.isCompleted
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{step.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{step.desc}</p>
                  {step.time && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{step.time}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
