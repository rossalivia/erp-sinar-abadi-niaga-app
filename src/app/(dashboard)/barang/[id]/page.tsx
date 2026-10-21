import * as React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { BarangDetailView } from '@/features/barang/components/barang-detail-view';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

import type { Database } from '@/types/database';

type BarangRowManajer = Database['public']['Views']['v_barang_manajer']['Row'];
type BarangRowPublik = Database['public']['Views']['v_barang']['Row'];
type BarangItem = BarangRowManajer | BarangRowPublik;

export default async function DetailBarangPage({ params }: PageProps) {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  const { id } = await params;
  const isManajer = profile.peran === 'manajer';
  const supabase = await createServerClient();

  let barangData: BarangItem | null = null;

  if (isManajer) {
    const { data, error } = await supabase
      .from('v_barang_manajer')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      notFound();
    }
    barangData = data;
  } else {
    // Non-Manajer: hanya membaca v_barang tanpa kolom harga_pokok
    const { data, error } = await supabase
      .from('v_barang')
      .select('id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada, stok_menipis')
      .eq('id', id)
      .single();

    if (error || !data) {
      notFound();
    }
    barangData = data;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Barang: ${barangData.nama}`}
        description={`Kode: ${barangData.kode} — Informasi persediaan, spesifikasi satuan, dan ketentuan harga`}
        action={
          <Link
            href="/barang"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'flex items-center gap-1.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Katalog Barang</span>
          </Link>
        }
      />

      <BarangDetailView barang={barangData} peran={profile.peran} />
    </div>
  );
}
