'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
    initialErrorMsg = 'Akun Anda dinonaktifkan. Silakan hubungi Manajer.';
  } else if (errorParam === 'auth') {
    initialErrorMsg = 'Silakan masuk terlebih dahulu untuk mengakses sistem.';
  }

  const errorMessage = state?.error || initialErrorMsg;

  return (
    <div className="space-y-5 max-w-sm w-full mx-auto">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Selamat Datang
        </h1>
        <p className="text-xs text-slate-500 font-normal">
          Masuk ke portal distribusi, pesanan grosir, dan inventori terpadu.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 shadow-neu-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextParam} />

        {/* Input Email / Username */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            Email / Akun
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
              className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 shadow-neu-inset focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 focus:bg-white transition-all font-mono disabled:opacity-50"
            />
          </div>
          {state?.fieldErrors?.email?.[0] && (
            <p className="text-[11px] text-red-600 font-medium">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        {/* Input Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Kata Sandi
            </label>
            <button
              type="button"
              onClick={() => setShowHelpDialog(true)}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline font-semibold cursor-pointer"
            >
              Lupa sandi?
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
              className="w-full pl-9 pr-10 py-2 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 shadow-neu-inset focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-400 focus:bg-white transition-all font-mono disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {state?.fieldErrors?.password?.[0] && (
            <p className="text-[11px] text-red-600 font-medium">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center gap-2">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 shadow-neu-inset focus:ring-indigo-500 cursor-pointer"
          />
          <label htmlFor="remember-me" className="text-xs text-slate-600 select-none cursor-pointer">
            Ingat sesi masuk di perangkat ini
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl text-xs tracking-wide transition-all shadow-neu-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {isPending ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Memproses Otentikasi...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Sistem</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>

      {/* Modal Dialog Bantuan Pemulihan Kata Sandi */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="p-2.5 bg-indigo-50 border border-indigo-200/80 rounded-xl shadow-neu-sm">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900 tracking-tight">
                  Pemulihan Kata Sandi Akun
                </DialogTitle>
                <DialogDescription className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
                  Prosedur Keamanan Internal
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs text-slate-600 leading-relaxed">
            <p className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200/80 text-slate-700 shadow-neu-inset">
              Untuk menjaga keamanan dan kerahasiaan data transaksi CV Sinar Abadi Niaga,
              pengaturan dan pemulihan kata sandi dilakukan secara terpusat oleh{' '}
              <strong className="text-slate-900 font-semibold">Administrator Manajer</strong>.
            </p>
            <p className="text-slate-600">
              Silakan hubungi{' '}
              <strong className="text-slate-800 font-semibold">Manajer Operasional</strong> untuk
              permohonan reset kata sandi akun Anda.
            </p>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowHelpDialog(false)}
              className="w-full sm:w-auto h-8 text-xs rounded-xl"
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-8 bg-[#f4f7fb]">
      {/* Container utama hybrid Neumorphic-Glassmorphic */}
      <div className="w-full max-w-5xl h-[640px] bg-white/80 backdrop-blur-2xl border border-white/80 shadow-2xl flex overflow-hidden rounded-3xl">
        {/* SISI KIRI: Form Login Glassmorphic */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between z-10">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold tracking-wider shadow-neu-sm border border-white/30">
              SA
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-sm">
                CV Sinar Abadi Niaga
              </span>
              <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-widest font-semibold">
                Enterprise B2B Portal
              </span>
            </div>
          </div>

          {/* Form Content */}
          <div className="my-auto py-4">
            <React.Suspense
              fallback={
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse font-mono">
                  Memuat antarmuka otentikasi...
                </div>
              }
            >
              <LoginForm />
            </React.Suspense>
          </div>

          {/* Footer Info */}
          <div className="text-[11px] text-slate-500 pt-4 border-t border-slate-100/80 flex items-center justify-between">
            <span>CV Sinar Abadi Niaga © 2026</span>
            <span className="font-mono text-slate-400">Secure B2B Node</span>
          </div>
        </div>

        {/* SISI KANAN: Visual Korporat Distribusi (Gaya Logistics Supply Chain) */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 flex-col justify-end p-12 overflow-hidden border-l border-slate-800/80">
          {/* Background Image / Gradient overlay dengan nuansa high-tech logistics */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/80 to-slate-950 z-0" />

          {/* Decorative Grid Lines */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] z-0" />

          {/* Content Overlay */}
          <div className="relative z-20 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono rounded-full backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5" />
              <span>Distribution & Supply Chain Hub</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Plan, Supply & Deliver.
            </h2>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Sistem ERP terintegrasi untuk pengelolaan stok gudang, otomatisasi pesanan B2B, dan
              pencatatan transaksi real-time dengan keamanan ketat.
            </p>

            {/* Slider Indicators */}
            <div className="flex items-center gap-2 pt-4">
              <div className="w-8 h-1.5 bg-indigo-500 rounded-full shadow-xs" />
              <div className="w-2 h-1.5 bg-slate-700 rounded-full" />
              <div className="w-2 h-1.5 bg-slate-700 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
