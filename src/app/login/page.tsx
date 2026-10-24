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
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Selamat Datang di Enterprise SAN
        </h1>
        <p className="text-xs text-slate-500">
          Masuk untuk mengakses dasbor distribusi, pesanan, dan kontrol inventori.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-none border border-red-300 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={nextParam} />

        {/* Input Email / Username ala Jira */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            Email / Username
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
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-none text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors font-mono disabled:opacity-50"
            />
          </div>
          {state?.fieldErrors?.email?.[0] && (
            <p className="text-[11px] text-red-600 font-medium">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        {/* Input Password ala Jira */}
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
              className="text-[11px] text-indigo-600 hover:underline font-medium cursor-pointer"
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
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-none text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors font-mono disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
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
        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded-none border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-600 select-none">
            Ingat sesi masuk di perangkat ini
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-none text-xs tracking-wide transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-none border-2 border-white border-t-transparent"></span>
              <span>Memproses Otentikasi...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Sistem</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Modal Dialog Bantuan Pemulihan Kata Sandi */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-md rounded-none border-slate-300">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-none">
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
            <p className="bg-slate-50 p-3 border border-slate-200 text-slate-700">
              Untuk menjaga keamanan dan kerahasiaan data transaksi CV Sinar Abadi Niaga,
              pengaturan dan pemulihan kata sandi dilakukan secara terpusat oleh{' '}
              <strong className="text-slate-900 font-semibold">Administrator Manajer</strong>.
            </p>
            <p className="text-slate-600">
              Silakan hubungi{' '}
              <strong className="text-slate-800 font-medium">Manajer Operasional</strong> untuk
              permohonan reset kata sandi akun Anda.
            </p>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowHelpDialog(false)}
              className="w-full sm:w-auto h-8 text-xs bg-slate-900 hover:bg-slate-800 rounded-none"
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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 lg:p-8">
      {/* Container utama dengan sudut sharp / clean industrial box */}
      <div className="w-full max-w-5xl h-[640px] bg-white border border-slate-800 shadow-2xl flex overflow-hidden rounded-none">
        {/* SISI KIRI: Form Login ala Jira (Clean, Sharp, Form Label di atas input) */}
        <div className="w-full lg:w-1/2 p-8 lg:p-12 flex flex-col justify-between bg-white z-10">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-none flex items-center justify-center text-white font-bold tracking-wider shadow-sm">
              SA
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-sm">
                CV Sinar Abadi Niaga
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
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
          <div className="text-[11px] text-slate-500 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span>CV Sinar Abadi Niaga © 2026</span>
            <span className="font-mono text-slate-400">Secure B2B Node</span>
          </div>
        </div>

        {/* SISI KANAN: Visual Korporat Distribusi (Gaya Logistics Supply Chain) */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 flex-col justify-end p-12 overflow-hidden border-l border-slate-800">
          {/* Background Image / Gradient overlay dengan nuansa high-tech logistics */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/80 to-slate-950 z-0" />

          {/* Decorative Grid Lines */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] z-0" />

          {/* Content Overlay */}
          <div className="relative z-20 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-mono rounded-none">
              <Building2 className="h-3.5 w-3.5" />
              <span>Distribution & Supply Chain Hub</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Plan, Supply & Deliver.
            </h2>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Sistem ERP terintegrasi untuk pengelolaan stok gudang, otomatisasi pesanan B2B, dan
              pencatatan transaksi real-time dengan keamanan ketat.
            </p>

            {/* Slider Indicators */}
            <div className="flex items-center gap-1.5 pt-4">
              <div className="w-8 h-1 bg-indigo-500 rounded-none"></div>
              <div className="w-2 h-1 bg-slate-700 rounded-none"></div>
              <div className="w-2 h-1 bg-slate-700 rounded-none"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
