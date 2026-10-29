'use client';

import * as React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export interface PrintButtonProps {
  /**
   * URL tujuan navigasi tombol kembali (misal: `/pesanan/${id}` atau `/pesanan`).
   */
  backHref?: string;
  /**
   * URL cadangan jika tidak ada riwayat navigasi sebelumnya di browser.
   */
  fallbackUrl?: string;
  /**
   * Teks label tombol kembali (default: 'Kembali').
   */
  backLabel?: string;
  /**
   * Handler khusus opsional ketika tombol kembali ditekan.
   */
  onBack?: () => void;
  className?: string;
}

export function PrintButton({
  backHref,
  fallbackUrl = '/pesanan',
  backLabel = 'Kembali',
  onBack,
  className = '',
}: PrintButtonProps = {}) {
  const router = useRouter();
  const targetHref = backHref || fallbackUrl;

  const handleBack = (e?: React.MouseEvent) => {
    if (onBack) {
      e?.preventDefault();
      onBack();
      return;
    }

    if (backHref) {
      // Jika backHref diberikan dan event handler dipanggil langsung
      e?.preventDefault();
      router.push(backHref);
      return;
    }

    // Jika tidak ada backHref eksplisit, cek riwayat browser
    if (typeof window !== 'undefined' && window.history.length > 1) {
      e?.preventDefault();
      router.back();
    } else {
      e?.preventDefault();
      router.push(fallbackUrl);
    }
  };

  return (
    <div className={`flex items-center gap-2 print:hidden mb-6 ${className}`}>
      {targetHref ? (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="text-xs h-8 gap-1.5 print:hidden border-slate-300 text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <Link href={targetHref}>
            <ArrowLeft className="w-3.5 h-3.5 print:hidden" />
            {backLabel}
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="text-xs h-8 gap-1.5 print:hidden border-slate-300 text-slate-700 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 print:hidden" />
          {backLabel}
        </Button>
      )}

      <Button
        type="button"
        size="sm"
        onClick={() => window.print()}
        className="text-xs h-8 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-none print:hidden"
      >
        <Printer className="w-3.5 h-3.5 print:hidden" />
        Cetak Sekarang
      </Button>
    </div>
  );
}

