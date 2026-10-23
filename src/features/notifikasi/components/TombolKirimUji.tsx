'use client';

import * as React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { kirimNotifikasiUjiAction } from '../actions';

export function TombolKirimUji() {
  const [isPending, startTransition] = React.useTransition();

  const handleKirimUji = () => {
    startTransition(async () => {
      try {
        const res = await kirimNotifikasiUjiAction();
        if (res.success) {
          toast.success(res.message);
        } else {
          toast.error(res.message);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal memicu pengujian notifikasi');
      }
    });
  };

  return (
    <Button
      onClick={handleKirimUji}
      disabled={isPending}
      size="sm"
      className="text-xs h-8 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium"
    >
      {isPending ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Mengirim Uji...
        </>
      ) : (
        <>
          <Send className="w-3.5 h-3.5" />
          Kirim Uji Sekarang
        </>
      )}
    </Button>
  );
}
