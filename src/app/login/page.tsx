'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, AlertCircle, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { loginAction, type LoginState } from './actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next') || '/';
  const errorParam = searchParams.get('error');

  const [state, formAction, isPending] = React.useActionState<LoginState | null, FormData>(
    loginAction,
    null
  );

  let initialErrorMsg: string | undefined;
  if (errorParam === 'nonaktif') {
    initialErrorMsg = 'Akun Anda dinonaktifkan. Silakan hubungi Manajer.';
  } else if (errorParam === 'auth') {
    initialErrorMsg = 'Silakan masuk terlebih dahulu untuk mengakses sistem.';
  }

  const errorMessage = state?.error || initialErrorMsg;

  return (
    <>
      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form action={formAction} className="space-y-3.5">
        <input type="hidden" name="next" value={nextParam} />

        <FormField
          id="email"
          label="Alamat Email"
          required
          error={state?.fieldErrors?.email?.[0]}
        >
          <div className="relative">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@sinarabadi.co.id"
              required
              disabled={isPending}
              className="pl-8"
            />
            <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </FormField>

        <FormField
          id="password"
          label="Kata Sandi"
          required
          error={state?.fieldErrors?.password?.[0]}
        >
          <div className="relative">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isPending}
              className="pl-8"
            />
            <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </FormField>

        <Button
          type="submit"
          className="w-full mt-2 h-9 text-xs"
          disabled={isPending}
        >
          {isPending ? 'Memproses...' : 'Masuk ke Sistem'}
        </Button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm">
        <Card className="border-slate-300 shadow-sm">
          <CardHeader className="text-center pb-4 pt-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white mb-2">
              <Building2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900">
              CV Sinar Abadi Niaga
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Sistem Informasi Manajemen Terpadu (ERP)
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <React.Suspense
              fallback={
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                  Memuat formulir masuk...
                </div>
              }
            >
              <LoginForm />
            </React.Suspense>

            <div className="mt-5 text-center border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-400">
                Akses internal terbatas. Akun dikelola oleh Administrator Manajer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
