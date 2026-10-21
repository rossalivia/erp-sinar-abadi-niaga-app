'use client';

import * as React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 print:hidden mb-6">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.back()}
        className="text-xs h-8 gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Kembali
      </Button>

      <Button
        type="button"
        size="sm"
        onClick={() => window.print()}
        className="text-xs h-8 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-none"
      >
        <Printer className="w-3.5 h-3.5" />
        Cetak Sekarang
      </Button>
    </div>
  );
}
