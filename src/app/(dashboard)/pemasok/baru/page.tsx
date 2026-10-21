import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { PemasokForm } from '@/features/pemasok/components/pemasok-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function TambahPemasokPage() {
  const profile = await getProfil();
  if (!profile || !['gudang', 'manajer'].includes(profile.peran)) {
    redirect('/tidak-berwenang');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tambah Pemasok Baru"
        description="Daftarkan distributor rekanan baru untuk pengadaan persediaan barang"
        action={
          <Link
            href="/pemasok"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Kembali ke Daftar</span>
          </Link>
        }
      />

      <PemasokForm />
    </div>
  );
}
