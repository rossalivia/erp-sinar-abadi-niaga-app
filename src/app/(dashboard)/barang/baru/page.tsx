import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { BarangForm } from '@/features/barang/components/barang-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function TambahBarangPage() {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tambah Barang Baru"
        description="Daftarkan master barang baru ke katalog persediaan CV Sinar Abadi Niaga"
        action={
          <Link
            href="/barang"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Kembali ke Katalog</span>
          </Link>
        }
      />

      <BarangForm />
    </div>
  );
}
