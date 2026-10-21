'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatTanggalWaktu, formatRupiah } from '@/lib/format';
import type { AuditLogItem } from '../types';

interface AuditDiffDialogProps {
  item: AuditLogItem | null;
  onClose: () => void;
}

export function AuditDiffDialog({ item, onClose }: AuditDiffDialogProps) {
  if (!item) return null;

  const oldVal = item.nilai_lama || {};
  const newVal = item.nilai_baru || {};

  // Kumpulkan seluruh kunci properti unik
  const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)])).sort();

  // Helper pemformat nilai agar informatif
  const formatValue = (key: string, val: unknown): string => {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'boolean') return val ? 'Aktif (Ya)' : 'Nonaktif (Tidak)';
    if (typeof val === 'number') {
      if (key.includes('harga') || key.includes('batas') || key.includes('total') || key.includes('subtotal') || key.includes('piutang')) {
        return formatRupiah(val);
      }
      return String(val);
    }
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-sm font-bold text-slate-900">
              Rincian Perubahan Data Audit
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-mono">
              #{item.id}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Dicatat pada {formatTanggalWaktu(item.dibuat_pada)} oleh{' '}
            <strong className="text-slate-700">{item.pelaku_nama || 'Sistem'}</strong> ({item.pelaku_peran || '-'})
          </DialogDescription>
        </DialogHeader>

        {/* Ringkasan Metadata Aksi */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Aksi:</span>
            <span className="font-semibold text-slate-900 font-mono">{item.aksi}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Tabel:</span>
            <span className="font-semibold text-slate-900 font-mono">{item.nama_tabel}</span>
          </div>
          <div>
            <span className="text-slate-500 block">ID Data:</span>
            <span className="font-mono text-slate-700 truncate block" title={item.data_id || '-'}>
              {item.data_id ? `${item.data_id.slice(0, 8)}...` : '-'}
            </span>
          </div>
        </div>

        {/* Tabel Komparasi Nilai Lama vs Nilai Baru */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md my-2">
          {allKeys.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Tidak ada data payload lama atau baru yang tersimpan
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/75 sticky top-0">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="w-1/3 text-xs font-semibold text-slate-700">Atribut / Kolom</TableHead>
                  <TableHead className="w-1/3 text-xs font-semibold text-slate-700">Nilai Sebelumnya</TableHead>
                  <TableHead className="w-1/3 text-xs font-semibold text-slate-700">Nilai Baru</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allKeys.map((key) => {
                  const hasOld = key in oldVal;
                  const hasNew = key in newVal;
                  const vOld = oldVal[key];
                  const vNew = newVal[key];
                  const isChanged = JSON.stringify(vOld) !== JSON.stringify(vNew);

                  return (
                    <TableRow
                      key={key}
                      className={`border-b border-slate-100 ${
                        isChanged ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <TableCell className="text-xs font-mono font-medium text-slate-800">
                        {key}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 tabular-nums">
                        {hasOld ? (
                          <span className={isChanged ? 'text-red-700 line-through mr-1' : ''}>
                            {formatValue(key, vOld)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">(tidak ada)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-900 tabular-nums font-medium">
                        {hasNew ? (
                          <span className={isChanged ? 'text-emerald-700 font-semibold' : ''}>
                            {formatValue(key, vNew)}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">(dihapus)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
