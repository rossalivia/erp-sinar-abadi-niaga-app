import type { Metadata } from 'next';
import { CheckCircle2, ShieldCheck, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pembayaran Diterima | CV Sinar Abadi Niaga',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PembayaranSelesaiPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-8 text-center space-y-5">
        {/* Identitas CV Sinar Abadi Niaga */}
        <div className="flex items-center justify-center gap-2 text-slate-800">
          <Building2 className="w-5 h-5 text-slate-700" />
          <span className="font-bold text-sm tracking-wide uppercase">
            CV Sinar Abadi Niaga
          </span>
        </div>

        {/* Ikon Sukses */}
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Pembayaran Sedang Diverifikasi
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Terima kasih atas pembayaran Anda. Transaksi Anda sedang diverifikasi secara otomatis oleh sistem kami melalui jalur resmi.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs text-slate-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-700 font-medium text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Verifikasi Pembayaran Dua Arah
          </div>
          <p className="text-[11px] text-slate-400">
            Status pelunasan faktur pesanan Anda akan diperbarui secara otomatis setelah verifikasi selesai.
          </p>
        </div>

        <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
          Anda dapat menutup halaman ini sekarang. Bukti pembayaran resmi telah dikirimkan ke alamat email Anda.
        </div>
      </div>
    </div>
  );
}
