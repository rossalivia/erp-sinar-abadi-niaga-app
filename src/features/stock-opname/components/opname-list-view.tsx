'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Eye, ClipboardCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { EmptyState } from '@/components/shared/empty-state';
import { formatTanggalWaktu, formatRupiah } from '@/lib/format';
import type { OpnameStokHeader } from '../types';
import type { Peran } from '@/types/auth';

interface OpnameListViewProps {
  data: OpnameStokHeader[];
  peran: Peran;
}

const STATUS_FILTERS = [
  { label: 'Semua', value: 'semua' },
  { label: 'Draf', value: 'draf' },
  { label: 'Diajukan', value: 'diajukan' },
  { label: 'Disetujui', value: 'disetujui' },
  { label: 'Dibatalkan', value: 'dibatalkan' },
];

export function OpnameListView({ data, peran }: OpnameListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || 'semua';

  const filteredData = React.useMemo(() => {
    if (currentStatus === 'semua') return data;
    return data.filter((item) => item.status === currentStatus);
  }, [data, currentStatus]);

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'semua') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`/stok/opname?${params.toString()}`);
  };

  const columns: Column<OpnameStokHeader>[] = [
    {
      header: 'Nomor Sesi',
      cell: (item: OpnameStokHeader) => (
        <Link
          href={`/stok/opname/${item.id}`}
          className="font-mono text-xs font-semibold text-slate-900 hover:underline hover:text-slate-700"
        >
          {item.nomor}
        </Link>
      ),
      className: 'w-36',
    },
    {
      header: 'Tanggal Dibuat',
      cell: (item: OpnameStokHeader) => (
        <span className="text-xs text-slate-600">
          {formatTanggalWaktu(item.dibuat_pada)}
        </span>
      ),
      className: 'w-44',
    },
    {
      header: 'Dibuat Oleh',
      cell: (item: OpnameStokHeader) => (
        <span className="text-xs text-slate-700 font-medium">
          {item.pembuat_nama || '-'}
        </span>
      ),
      className: 'w-40',
    },
    {
      header: 'Item',
      cell: (item: OpnameStokHeader) => (
        <span className="tabular-nums text-xs text-slate-700 text-right block">
          {item.total_item} barang
        </span>
      ),
      align: 'right',
      className: 'w-24',
    },
    {
      header: 'Selisih Unit',
      cell: (item: OpnameStokHeader) => {
        const sel = item.total_selisih_unit;
        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
        let prefix = '';
        if (sel < 0) {
          badgeColor = 'bg-red-50 text-red-700 border-red-200';
        } else if (sel > 0) {
          badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
          prefix = '+';
        }

        return (
          <div className="flex justify-end">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${badgeColor}`}
            >
              {prefix}
              {sel} unit
            </span>
          </div>
        );
      },
      align: 'right',
      className: 'w-32',
    },
    ...(peran === 'manajer'
      ? ([
          {
            header: 'Estimasi Nilai Selisih',
            cell: (item: OpnameStokHeader) => {
              const val = item.estimasi_nilai_selisih || 0;
              const isNegative = val < 0;
              return (
                <span
                  className={`tabular-nums text-xs font-medium text-right block ${
                    isNegative ? 'text-red-700' : val > 0 ? 'text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {formatRupiah(val)}
                </span>
              );
            },
            align: 'right' as const,
            className: 'w-40',
          },
        ] as Column<OpnameStokHeader>[])
      : []),
    {
      header: 'Status',
      cell: (item: OpnameStokHeader) => <BadgeStatus status={item.status} />,
      align: 'center',
      className: 'w-28',
    },
    {
      header: 'Aksi',
      cell: (item: OpnameStokHeader) => (
        <div className="flex items-center justify-end">
          <Link
            href={`/stok/opname/${item.id}`}
            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 px-2 py-1 rounded transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span>Detail</span>
          </Link>
        </div>
      ),
      align: 'right',
      className: 'w-24',
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Opname & Penyesuaian Fisik"
        description="Pencatatan inventarisasi fisik rak gudang, perbandingan stok komputer, dan penyesuaian kartu stok."
      >
        <Link
          href="/stok/opname/baru"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-none hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Mulai Sesi Opname</span>
        </Link>
      </PageHeader>

      {/* Filter Status Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
        {STATUS_FILTERS.map((f) => {
          const isActive = currentStatus === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusChange(f.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors font-medium ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Tabel Data */}
      {filteredData.length === 0 ? (
        <EmptyState
          title="Tidak ada sesi stock opname"
          description={
            currentStatus === 'semua'
              ? 'Belum ada sesi stock opname yang tercatat. Klik tombol Mulai Sesi Opname untuk membuat sesi audit baru.'
              : `Tidak ada sesi stock opname dengan status "${currentStatus}".`
          }
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      ) : (
        <DataTable columns={columns} data={filteredData} keyExtractor={(item) => item.id} />
      )}
    </div>
  );
}
