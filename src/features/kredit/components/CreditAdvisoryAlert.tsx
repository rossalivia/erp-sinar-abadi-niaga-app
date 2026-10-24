'use client';

import * as React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { PeringatanEditor } from '../types';

interface CreditAdvisoryAlertProps {
  warnings: PeringatanEditor[];
}

export function CreditAdvisoryAlert({ warnings }: CreditAdvisoryAlertProps) {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 my-3">
      {warnings.map((w, idx) => {
        const isWarning = w.level === 'warning';
        return (
          <div
            key={idx}
            className={`flex items-start gap-2.5 p-3 rounded-md border text-xs leading-relaxed ${
              isWarning
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            {isWarning ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span>{w.pesan}</span>
              <span className="block text-[11px] opacity-75 mt-0.5">
                Peringatan ini bersifat informatif dan tidak menghalangi penyimpanan draf atau pengajuan pesanan.
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
