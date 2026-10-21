import * as React from 'react';
import { CheckCircle2, Clock, Truck, Check, XCircle } from 'lucide-react';
import { formatTanggalWaktu, formatTanggal } from '@/lib/format';
import type { PesananJualDetail } from '../types';

interface PesananTimelineProps {
  pesanan: PesananJualDetail;
}

export function PesananTimeline({ pesanan }: PesananTimelineProps) {
  const isDibatalkan = pesanan.status === 'dibatalkan';

  const steps = [
    {
      id: 'draf',
      title: 'Draf Pesanan',
      time: pesanan.dibuat_pada ? formatTanggalWaktu(pesanan.dibuat_pada) : null,
      desc: pesanan.pembuat?.nama_lengkap
        ? `Oleh ${pesanan.pembuat.nama_lengkap}`
        : 'Draf dibuat',
      isCompleted: true,
      icon: Clock,
    },
    {
      id: 'dikonfirmasi',
      title: 'Dikonfirmasi',
      time: pesanan.dikonfirmasi_pada ? formatTanggalWaktu(pesanan.dikonfirmasi_pada) : null,
      desc: pesanan.dikonfirmasi_pada ? 'Stok telah dikurangi' : 'Menunggu konfirmasi',
      isCompleted: Boolean(pesanan.dikonfirmasi_pada),
      icon: CheckCircle2,
    },
    {
      id: 'dikirim',
      title: 'Dikirim',
      time: pesanan.dikirim_pada ? formatTanggalWaktu(pesanan.dikirim_pada) : null,
      desc: pesanan.jatuh_tempo
        ? `Jatuh tempo: ${formatTanggal(pesanan.jatuh_tempo)}`
        : 'Pengiriman barang',
      isCompleted: Boolean(pesanan.dikirim_pada),
      icon: Truck,
    },
    {
      id: 'lunas',
      title: 'Lunas',
      time: pesanan.dilunasi_pada ? formatTanggalWaktu(pesanan.dilunasi_pada) : null,
      desc: pesanan.dilunasi_pada ? 'Pembayaran lunas' : 'Menunggu pembayaran',
      isCompleted: Boolean(pesanan.dilunasi_pada),
      icon: Check,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
        Alur Status Pesanan
      </h3>

      {isDibatalkan ? (
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-md text-red-900 text-xs">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Pesanan Dibatalkan</p>
            <p className="text-slate-600">
              Waktu:{' '}
              <span className="font-medium text-slate-800">
                {formatTanggalWaktu(pesanan.dibatalkan_pada)}
              </span>
            </p>
            {pesanan.alasan_batal && (
              <p className="text-slate-700 mt-1">
                Alasan:{' '}
                <span className="italic font-normal text-slate-900 bg-white/70 px-1.5 py-0.5 rounded border border-red-100">
                  &ldquo;{pesanan.alasan_batal}&rdquo;
                </span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
