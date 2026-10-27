'use client';

import * as React from 'react';
import { Send, Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { kirimNotifikasiUjiAction } from '../actions';

const STORAGE_KEY = 'erp_notif_uji_last_timestamp';
const COOLDOWN_SECONDS = 60;

export function TombolKirimUji() {
  const [isPending, startTransition] = React.useTransition();
  const [cooldown, setCooldown] = React.useState<number>(0);

  // Inisialisasi dan cek sisa cooldown dari localStorage
  React.useEffect(() => {
    const checkCooldown = () => {
      try {
        const lastTimeStr = localStorage.getItem(STORAGE_KEY);
        if (lastTimeStr) {
          const lastTime = parseInt(lastTimeStr, 10);
          const elapsedSec = Math.floor((Date.now() - lastTime) / 1000);
          if (elapsedSec < COOLDOWN_SECONDS) {
            setCooldown(COOLDOWN_SECONDS - elapsedSec);
            return;
          }
        }
      } catch {
        // Abaikan jika localStorage tidak tersedia
      }
      setCooldown(0);
    };

    checkCooldown();
  }, []);

  // Interval timer hitung mundur jika cooldown aktif
  React.useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const mulaiCooldown = () => {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // Abaikan jika localStorage error
    }
    setCooldown(COOLDOWN_SECONDS);
  };

  const handleKirimUji = () => {
    if (cooldown > 0 || isPending) return;

    startTransition(async () => {
      try {
        const res = await kirimNotifikasiUjiAction();
        if (res.success) {
          mulaiCooldown();
          toast.success(res.message || 'Email uji coba berhasil dikirim!', {
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          });
        } else {
          // Jika ditolak karena limit 1 menit, tetap picu cooldown
          if (res.message?.toLowerCase().includes('1 kali per menit') || res.message?.toLowerCase().includes('1 menit')) {
            mulaiCooldown();
          }
          toast.error(res.message || 'Gagal mengirim email uji coba', {
            icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal memicu pengujian notifikasi');
      }
    });
  };

  const isDisabled = isPending || cooldown > 0;

  return (
    <div className="flex flex-col items-start sm:items-end gap-1.5">
      <Button
        onClick={handleKirimUji}
        disabled={isDisabled}
        size="sm"
        className="text-xs h-8 px-3 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 dark:text-slate-600" />
            <span>Mengirim Uji Coba...</span>
          </>
        ) : cooldown > 0 ? (
          <>
            <Clock className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600 animate-pulse" />
            <span>Tunggu {cooldown}s (Anti-Spam)</span>
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            <span>Kirim Email Uji Coba</span>
          </>
        )}
      </Button>

      {/* Indikator limitasi anti-spam */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            cooldown > 0 ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
          }`}
        />
        <span>
          {cooldown > 0
            ? `Cooldown aktif: sisa ${cooldown} detik`
            : 'Limit pengujian: maksimal 1 kali per menit'}
        </span>
      </div>
    </div>
  );
}

