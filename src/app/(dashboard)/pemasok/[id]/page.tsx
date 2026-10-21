import * as React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { PemasokForm } from '@/features/pemasok/components/pemasok-form';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPemasokPage({ params }: PageProps) {
  const profile = await getProfil();
  if (!profile || !['gudang', 'manajer'].includes(profile.peran)) {
    redirect('/tidak-berwenang');
  }

  const { id } = await params;
  const supabase = await createServerClient();

  const { data: pemasok, error } = await supabase
    .from('pemasok')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !pemasok) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Pemasok: ${pemasok.nama}`}
        description={`Kode: ${pemasok.kode} — Ubah data informasi dan status aktif distributor`}
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

      <PemasokForm initialData={pemasok} />
    </div>
  );
}
