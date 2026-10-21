import * as React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusType =
  | 'draf'
  | 'menunggu_persetujuan'
  | 'disetujui'
  | 'diproses'
  | 'dikirim'
  | 'selesai'
  | 'lunas'
  | 'ditolak'
  | 'batal'
  | 'dibatalkan'
  | 'aktif'
  | 'nonaktif'
  | 'menunggu_penerimaan'
  | 'diterima_sebagian'
  | 'diterima_lengkap'
  | 'lewat_jatuh_tempo'
  | string;

interface BadgeStatusProps {
  status: StatusType;
  label?: string;
  className?: string;
}

const STATUS_VARIANT_MAP: Record<string, BadgeProps['variant']> = {
  // Status Pesanan Jual & Pembelian
  draf: 'neutral',
  menunggu_persetujuan: 'warning',
  disetujui: 'info',
  diproses: 'info',
  dikirim: 'info',
  selesai: 'success',
  lunas: 'success',
  ditolak: 'danger',
  batal: 'danger',
  dibatalkan: 'danger',
  menunggu_penerimaan: 'warning',
  diterima_sebagian: 'warning',
  diterima_lengkap: 'success',
  lewat_jatuh_tempo: 'danger',

  // Status Master Data
  aktif: 'success',
  nonaktif: 'neutral',
  true: 'success',
  false: 'neutral',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  draf: 'Draf',
  menunggu_persetujuan: 'Menunggu Persetujuan',
  disetujui: 'Disetujui',
  diproses: 'Diproses',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  lunas: 'Lunas',
  ditolak: 'Ditolak',
  batal: 'Dibatalkan',
  dibatalkan: 'Dibatalkan',
  menunggu_penerimaan: 'Menunggu Penerimaan',
  diterima_sebagian: 'Diterima Sebagian',
  diterima_lengkap: 'Diterima Lengkap',
  lewat_jatuh_tempo: 'Lewat Jatuh Tempo',
  aktif: 'Aktif',
  nonaktif: 'Nonaktif',
};

export function BadgeStatus({ status, label, className }: BadgeStatusProps) {
  const normalized = String(status).toLowerCase();
  const variant = STATUS_VARIANT_MAP[normalized] || 'neutral';
  const displayLabel = label || STATUS_LABEL_MAP[normalized] || status;

  return (
    <Badge variant={variant} className={cn('capitalize font-medium', className)}>
      {displayLabel}
    </Badge>
  );
}
