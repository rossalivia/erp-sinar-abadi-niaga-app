import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-300 text-center">
        <CardHeader className="pb-3 pt-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-2">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle className="text-base font-bold text-slate-900">
            Halaman Tidak Ditemukan (404)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Alamat URL yang Anda tuju tidak terdaftar atau telah dipindahkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center pt-2">
            <Button asChild variant="default" size="sm" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Beranda
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
