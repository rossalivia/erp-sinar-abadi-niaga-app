'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Warehouse,
  Truck,
  Store,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { loginAction, type LoginState } from './actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/';
  const errorParam = searchParams.get('error');

  const [state, formAction, isPending] = React.useActionState<LoginState | null, FormData>(
    loginAction,
    null
  );

  const [showPassword, setShowPassword] = React.useState(false);
  const [showHelpDialog, setShowHelpDialog] = React.useState(false);

  let initialErrorMsg: string | undefined;
  if (errorParam === 'nonaktif') {
    initialErrorMsg = 'Akun Anda dinonaktifkan. Silakan hubungi Manajer Operasional.';
  } else if (errorParam === 'auth') {
    initialErrorMsg = 'Sesi Anda telah berakhir. Silakan masuk kembali ke sistem.';
  }

  const errorMessage = state?.error || initialErrorMsg;

  return (
    <div className="space-y-6 w-full">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-0.5">
            <span className="font-semibold block">Gagal Masuk</span>
            <span className="text-red-700 leading-relaxed">{errorMessage}</span>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextParam} />

        {/* Input Email / Akun */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Alamat Email Akun
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </span>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isPending}
              placeholder="nama@sinarabadi.co.id"
              className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors disabled:opacity-50 disabled:bg-slate-50"
            />
          </div>
          {state?.fieldErrors?.email?.[0] && (
            <p className="text-xs text-red-600 font-medium mt-1">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        {/* Input Kata Sandi */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-700"
            >
              Kata Sandi
            </label>
            <button
              type="button"
              onClick={() => setShowHelpDialog(true)}
              className="text-xs text-slate-600 hover:text-slate-900 hover:underline font-medium transition-colors cursor-pointer"
            >
              Lupa kata sandi?
            </button>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </span>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              disabled={isPending}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors disabled:opacity-50 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {state?.fieldErrors?.password?.[0] && (
            <p className="text-xs text-red-600 font-medium mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
          />
          <label htmlFor="remember-me" className="text-xs text-slate-600 select-none cursor-pointer">
            Ingat sesi masuk di perangkat ini
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-10 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-medium rounded-lg text-sm tracking-normal transition-colors flex items-center justify-center gap-2 shadow-none cursor-pointer mt-2 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Memverifikasi Akses...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Sistem</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Modal Dialog Bantuan Pemulihan Kata Sandi */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md rounded-xl border-slate-200 bg-white">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-slate-900 tracking-tight">
                  Pemulihan Kata Sandi
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Prosedur Keamanan Akses Internal
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-slate-600 leading-relaxed">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-slate-700 space-y-1.5">
              <p className="font-medium text-slate-900">
                Akses Terkendali Terpusat
              </p>
              <p>
                Guna memelihara integritas data transaksi dan keamanan rantai pasok CV Sinar Abadi Niaga,
                pengaturan ulang kata sandi diproses langsung oleh Administrator/Manajer Operasional.
              </p>
            </div>
            <p className="text-slate-500">
              Silakan hubungi <strong className="text-slate-800 font-semibold">Manajer Operasional</strong> atau staf HRD kantor pusat untuk verifikasi identitas dan permohonan reset akun.
            </p>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowHelpDialog(false)}
              className="w-full sm:w-auto h-9 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              Saya Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-900">
      {/* SISI KIRI: Panel Gelap Berwibawa (Corporate Identity & Security Badges) */}
      <div className="w-full lg:w-[46%] xl:w-[42%] bg-slate-900 text-slate-100 flex flex-col justify-between p-8 sm:p-12 lg:p-14 border-r border-slate-800 relative select-none">
        {/* Bagian Atas: Logo Resmi Tajam & Proporsional */}
        <div>
          <Logo size="md" inverted={true} showSubdeskripsi={true} />
        </div>

        {/* Bagian Tengah: Identitas Usaha & Cakupan Operasional */}
        <div className="my-10 lg:my-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>SISTEM DISTRIBUSI PUSAT • LIVE NODE</span>
          </div>

          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
              Distributor Sembako &amp; Kebutuhan Toko Kelontong
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
              Infrastruktur terpusat pengelolaan pengadaan komoditas pangan, otomatisasi pesanan tempo, verifikasi limit kredit, dan kartu stok FIFO terintegrasi.
            </p>
          </div>

          {/* Statistik Entitas Nyata */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Warehouse className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Gudang</span>
              </div>
              <span className="text-sm font-semibold text-white">1 Pusat</span>
              <span className="block text-[10px] text-slate-400">Bekasi</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Truck className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Pemasok</span>
              </div>
              <span className="text-sm font-semibold text-white">4 Mitra</span>
              <span className="block text-[10px] text-slate-400">Komoditas Pokok</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/70">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Store className="h-3.5 w-3.5 text-slate-300" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Jangkauan</span>
              </div>
              <span className="text-sm font-semibold text-white">~60 Toko</span>
              <span className="block text-[10px] text-slate-400">Bekasi &amp; Jaktim</span>
            </div>
          </div>

          {/* Badge Keamanan Audit Log & Kepatuhan */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Protokol Audit Log &amp; Pemisahan Akses Aktif</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Seluruh transaksi, riwayat persetujuan kredit, dan mutasi inventori diverifikasi dan dicatat pada database terenkripsi sesuai wewenang peran (Manajer, Penjualan, Gudang).
            </p>
          </div>
        </div>

        {/* Bagian Bawah: Copyright & Identitas Resmi */}
        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>CV Sinar Abadi Niaga © 2026</span>
          <span className="font-mono text-slate-400">Versi 2.4.0 (Enterprise)</span>
        </div>
      </div>

      {/* SISI KANAN: Form Login Putih Bersih (Enterprise Card) */}
      <div className="w-full lg:w-[54%] xl:w-[58%] bg-slate-50 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 sm:p-10 shadow-sm">
          {/* Logo Mobile Only (Tampil saat di layar kecil) */}
          <div className="lg:hidden pb-6 mb-6 border-b border-slate-100">
            <Logo size="sm" showSubdeskripsi={true} />
          </div>

          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Masuk ke Sistem
            </h2>
            <p className="text-xs text-slate-500">
              Gunakan kredensial akun terdaftar untuk mengakses modul operasional ERP.
            </p>
          </div>

          <React.Suspense
            fallback={
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse font-mono">
                Menyiapkan otentikasi aman...
              </div>
            }
          >
            <LoginForm />
          </React.Suspense>

          {/* Catatan Kepatuhan di Bagian Bawah Form */}
          <div className="mt-8 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 leading-normal">
              Akses terbatas hanya untuk personel berwenang CV Sinar Abadi Niaga.
              Aktivitas tidak sah akan dicatat dan ditindaklanjuti.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
