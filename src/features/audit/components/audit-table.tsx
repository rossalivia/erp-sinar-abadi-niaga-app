'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Eye, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatTanggalWaktu } from '@/lib/format';
import { AuditDiffDialog } from './audit-diff-dialog';
import type { AuditLogItem } from '../types';

interface AuditTableProps {
  logs: AuditLogItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  aksiOptions: string[];
  tabelOptions: string[];
}

export function AuditTable({
  logs,
  totalCount,
  totalPages,
  currentPage,
  aksiOptions,
  tabelOptions,
}: AuditTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedItem, setSelectedItem] = React.useState<AuditLogItem | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const [aksiFilter, setAksiFilter] = React.useState(searchParams.get('aksi') || '');
  const [tabelFilter, setTabelFilter] = React.useState(searchParams.get('tabel') || '');
  const [dariFilter, setDariFilter] = React.useState(searchParams.get('dari') || '');
  const [sampaiFilter, setSampaiFilter] = React.useState(searchParams.get('sampai') || '');

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (aksiFilter) params.set('aksi', aksiFilter);
    else params.delete('aksi');

    if (tabelFilter) params.set('tabel', tabelFilter);
    else params.delete('tabel');

    if (dariFilter) params.set('dari', dariFilter);
    else params.delete('dari');

    if (sampaiFilter) params.set('sampai', sampaiFilter);
    else params.delete('sampai');

    params.set('page', '1');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const resetFilters = () => {
    setAksiFilter('');
    setTabelFilter('');
    setDariFilter('');
    setSampaiFilter('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const formatAksiBadge = (aksi: string) => {
    if (aksi.includes('hapus') || aksi.includes('batal') || aksi.includes('tolak')) {
      return (
        <Badge variant="destructive" className="text-[11px] font-mono">
          {aksi}
        </Badge>
      );
    }
    if (aksi.includes('ubah') || aksi.includes('set_') || aksi.includes('penyesuaian')) {
      return (
        <Badge variant="warning" className="text-[11px] font-mono bg-amber-50 text-amber-800 border-amber-200">
          {aksi}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[11px] font-mono bg-slate-100 text-slate-800">
        {aksi}
      </Badge>
    );
  };

  return (
    <>
      {/* Filter Bar */}
      <Card className="p-4">
        <form onSubmit={applyFilters} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Aksi</label>
            <select
              value={aksiFilter}
              onChange={(e) => setAksiFilter(e.target.value)}
              className="w-full h-8 text-xs px-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">Semua Aksi</option>
              {aksiOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tabel</label>
            <select
              value={tabelFilter}
              onChange={(e) => setTabelFilter(e.target.value)}
              className="w-full h-8 text-xs px-2 rounded-md border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">Semua Tabel</option>
              {tabelOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Dari Tanggal</label>
            <Input
              type="date"
              value={dariFilter}
              onChange={(e) => setDariFilter(e.target.value)}
              className="h-8 text-xs px-2"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Sampai Tanggal</label>
            <Input
              type="date"
              value={sampaiFilter}
              onChange={(e) => setSampaiFilter(e.target.value)}
              className="h-8 text-xs px-2"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs flex-1 bg-slate-900 text-white hover:bg-slate-800"
              disabled={isPending}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              Saring
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2.5 text-slate-600 border-slate-300"
              onClick={resetFilters}
              disabled={isPending}
            >
              Reset
            </Button>
          </div>
        </form>
      </Card>

      {/* Tabel Data Audit */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
            Log Aktivitas Perubahan Data
          </CardTitle>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            Total {totalCount} rekaman
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Tidak ada riwayat aktivitas audit yang sesuai kriteria saringan
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow className="border-b border-slate-200">
                    <TableHead className="w-12 text-center text-xs font-semibold text-slate-700">#</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Waktu (WIB)</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Pelaku</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Aksi</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700">Tabel</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 font-mono">ID Data</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-700">Perubahan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="text-center text-xs text-slate-500 font-mono">
                        {log.id}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                        {formatTanggalWaktu(log.dibuat_pada)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-slate-900 block">{log.pelaku_nama || 'Sistem'}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {log.pelaku_peran ? `[${log.pelaku_peran}]` : ''} {log.pelaku_email || ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{formatAksiBadge(log.aksi)}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-600">{log.nama_tabel}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {log.data_id ? `${log.data_id.slice(0, 8)}...` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100"
                          onClick={() => setSelectedItem(log)}
                        >
                          <Eye className="h-3 w-3 mr-1 text-slate-500" />
                          Rincian
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Paginasi Sisi-Server */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 border-slate-200"
                disabled={currentPage <= 1 || isPending}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 border-slate-200"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => goToPage(currentPage + 1)}
              >
                Berikutnya
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog Diff JSON Perubahan Data */}
      <AuditDiffDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
