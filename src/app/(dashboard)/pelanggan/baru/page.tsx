import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { PelangganForm } from '@/features/pelanggan/components/pelanggan-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function TambahPelangganPage() {
  const profile = await getProfil();
  if (!profile || !['penjualan', 'manajer'].includes(profile.peran)) {
    redirect('/tidak-berwenang');
  }

  const isManajer = profile.peran === 'manajer';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tambah Pelanggan Baru"
        description="Daftarkan toko rekanan baru ke dalam sistem ERP CV Sinar Abadi Niaga"
        action={
          <Link
            href="/pelanggan"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Link>
        }
      />

      <PelangganForm isManajer={isManajer} />
    </div>
  );
}
