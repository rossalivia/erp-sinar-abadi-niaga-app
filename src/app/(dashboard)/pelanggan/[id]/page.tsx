import * as React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { PelangganDetailView } from '@/features/pelanggan/components/pelanggan-detail-view';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPelangganPage({ params }: PageProps) {
  const profile = await getProfil();
  if (!profile || !['penjualan', 'manajer'].includes(profile.peran)) {
    redirect('/tidak-berwenang');
  }

  const { id } = await params;
  const supabase = await createServerClient();

  const { data: pelanggan, error } = await supabase
    .from('v_pelanggan_piutang')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !pelanggan) {
    notFound();
  }

  const isManajer = profile.peran === 'manajer';

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Pelanggan: ${pelanggan.nama_toko}`}
        description={`Kode: ${pelanggan.kode} — Ringkasan piutang, batas kredit, dan pengaturan pelanggan`}
        action={
          <Link
            href="/pelanggan"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Daftar Pelanggan</span>
          </Link>
        }
      />

      <PelangganDetailView pelanggan={pelanggan} isManajer={isManajer} />
    </div>
  );
}
