import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/format';
import type { LaporanPiutangPelangganItem } from '../types';

interface PiutangPelangganTableProps {
  items: LaporanPiutangPelangganItem[];
}

export function PiutangPelangganTable({ items }: PiutangPelangganTableProps) {
  return (
    <Card className="border-slate-200 shadow-none bg-white">
      <CardHeader className="py-3 px-5 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 tracking-tight">
          Status Piutang Berjalan per Pelanggan (BR-05)
        </CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          Piutang berjalan mencakup pesanan berstatus dikonfirmasi &amp; dikirim terhadap batas kredit
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Tidak ada data pelanggan dengan riwayat piutang
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75">
                <TableRow className="border-b border-slate-200">
                  <TableHead className="text-xs font-semibold text-slate-700">Pelanggan</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-slate-700">Termin</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Piutang Berjalan</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Batas Kredit</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Sisa Kredit</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Lewat Jatuh Tempo</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-slate-700">Status Risiko</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => {
                  const isKreditHabis = p.sisa_kredit <= 0 && p.batas_kredit > 0;
                  const isKreditNol = p.batas_kredit === 0;

                  return (
                    <TableRow key={p.pelanggan_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="text-xs">
                        <Link
                          href={`/pelanggan/${p.pelanggan_id}`}
                          className="font-medium text-slate-900 hover:underline block"
                        >
                          {p.nama_toko}
                        </Link>
                        <span className="text-[11px] text-slate-400 font-mono">{p.kode}</span>
                      </TableCell>
                      <TableCell className="text-center text-xs text-slate-600">
                        {p.termin_hari} hari
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-900 font-medium">
                        {formatRupiah(p.total_piutang)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-700">
                        {formatRupiah(p.batas_kredit)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs tabular-nums font-medium ${
                          p.sisa_kredit < 0
                            ? 'text-red-600'
                            : isKreditHabis
                            ? 'text-amber-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatRupiah(p.sisa_kredit)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-semibold">
                        {p.piutang_lewat_jatuh_tempo > 0 ? (
                          <span className="text-red-600">
                            {formatRupiah(p.piutang_lewat_jatuh_tempo)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Rp0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {p.ada_lewat_jatuh_tempo ? (
                          <Badge variant="destructive" className="text-[11px] font-medium gap-1 bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            Macet
                          </Badge>
                        ) : isKreditHabis ? (
                          <Badge variant="warning" className="text-[11px] font-medium bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                            Limit Penuh
                          </Badge>
                        ) : isKreditNol ? (
                          <Badge variant="secondary" className="text-[11px] font-medium bg-slate-100 text-slate-600">
                            Kredit Rp0
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] font-medium gap-1 bg-emerald-50 text-emerald-800 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Lancar
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
