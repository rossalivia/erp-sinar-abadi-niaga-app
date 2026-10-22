import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { RowError } from '../types';

interface TabelGalatProps {
  galat: RowError[];
}

export function TabelGalat({ galat }: TabelGalatProps) {
  if (galat.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 p-3 bg-red-50/80 border border-red-200 rounded-lg text-red-900 text-xs">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
        <p className="font-medium">
          Ditemukan <span className="font-bold">{galat.length} galat</span> pada berkas CSV. Perbaiki data pada berkas Anda sebelum mengimpor. Tombol &quot;Impor Sekarang&quot; dinonaktifkan.
        </p>
      </div>

      <div className="border border-red-200 rounded-lg overflow-hidden bg-white max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-red-50/50 text-red-950 sticky top-0 border-b border-red-200 font-semibold">
            <tr>
              <th className="py-2 px-3 w-16">Baris</th>
              <th className="py-2 px-3 w-32">Kolom</th>
              <th className="py-2 px-3 w-20">Kode</th>
              <th className="py-2 px-3">Pesan Kesalahan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {galat.map((err, idx) => (
              <tr key={idx} className="hover:bg-red-50/30">
                <td className="py-1.5 px-3 font-mono font-medium text-slate-900">{err.baris}</td>
                <td className="py-1.5 px-3 font-mono text-slate-600">{err.kolom}</td>
                <td className="py-1.5 px-3 font-mono text-red-700">{err.kodeError}</td>
                <td className="py-1.5 px-3 text-red-800 font-medium">{err.pesan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
