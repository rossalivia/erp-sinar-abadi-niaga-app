'use client';

import * as React from 'react';
import Link from 'next/link';
import { SlidersHorizontal, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PenyesuaianDialog } from './penyesuaian-dialog';
import type { Peran } from '@/types/auth';

interface KartuStokActionsProps {
  barangId: string;
  kode: string;
  nama: string;
  satuan: string;
  stokSaatIni: number;
  stokMenipis: boolean;
  peran: Peran;
}

export function KartuStokActions({
  barangId,
  kode,
  nama,
  satuan,
  stokSaatIni,
  stokMenipis,
  peran,
}: KartuStokActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const canAdjust = peran === 'gudang' || peran === 'manajer';
  const canPO = peran === 'gudang' || peran === 'manajer';

  return (
    <div className="flex items-center gap-2">
      {canPO && stokMenipis && (
        <Button
          asChild
          size="sm"
          className="text-xs h-8 gap-1.5 bg-blue-700 hover:bg-blue-800 text-white shadow-none"
        >
          <Link href={`/pembelian/baru?barang=${barangId}`}>
            <ShoppingCart className="w-3.5 h-3.5" />
            Ajukan PO
          </Link>
        </Button>
      )}

      {canAdjust && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsDialogOpen(true)}
          className="text-xs h-8 gap-1.5 border-slate-300"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Penyesuaian Stok (Opname)
        </Button>
      )}

      <PenyesuaianDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        barangId={barangId}
        kodeBarang={kode}
        namaBarang={nama}
        stokSaatIni={stokSaatIni}
        satuan={satuan}
      />
    </div>
  );
}
