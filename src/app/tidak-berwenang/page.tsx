import Link from 'next/link';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function TidakBerwenangPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-300 text-center">
        <CardHeader className="pb-3 pt-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2">
            <ShieldX className="h-6 w-6" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900">
            Akses Ditolak (403)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Peran akun Anda tidak memiliki hak otorisasi untuk membuka modul atau halaman ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-200 text-left">
            Berdasarkan kebijakan keamanan sistem internal CV Sinar Abadi Niaga,
            akses menu dibatasi secara ketat sesuai peran kerja (Penjualan, Gudang, atau Manajer).
          </p>
          <div className="flex justify-center pt-2">
            <Button asChild variant="default" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
