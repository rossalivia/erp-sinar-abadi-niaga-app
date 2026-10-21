'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/errors';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Hindari log yang membocorkan data rahasia
    console.error('Application Error Boundary caught error');
  }, [error]);

  const displayMessage = getErrorMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-300 text-center">
        <CardHeader className="pb-3 pt-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-2">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900">
            Terjadi Kendala Sistem
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Aplikasi mengalami kesalahan saat memproses permintaan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-md text-left">
            <span className="font-semibold block mb-0.5">Pesan Kesalahan:</span>
            <span>{displayMessage}</span>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reset()}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Coba Lagi
            </Button>
            <Button asChild variant="default" size="sm" className="gap-1.5">
              <Link href="/">
                <Home className="h-3.5 w-3.5" />
                Ke Beranda
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
