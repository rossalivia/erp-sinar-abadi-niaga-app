import * as React from 'react';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { PageHeader } from '@/components/shared/page-header';
import { AuditTable } from '@/features/audit/components/audit-table';
import type { AuditLogItem } from '@/features/audit/types';

interface PageProps {
  searchParams: Promise<{
    aksi?: string;
    tabel?: string;
    dari?: string;
    sampai?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 15;

export default async function AuditLogPage({ searchParams }: PageProps) {
  const profil = await getProfil();

  // Lapis 2: Pemeriksaan Otorisasi Server Component
  if (!profil || profil.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  const params = await searchParams;
  const aksiFilter = params.aksi || '';
  const tabelFilter = params.tabel || '';
  const dariFilter = params.dari || '';
  const sampaiFilter = params.sampai || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const from = (currentPage - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const supabase = await createServerClient();

  // Query audit_log dengan pagination dan filter
  let query = supabase
    .from('audit_log')
    .select(
      'id, pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada, pelaku:pelaku_id (nama_lengkap, peran)',
      { count: 'exact' }
    );

  if (aksiFilter) query = query.eq('aksi', aksiFilter);
  if (tabelFilter) query = query.eq('nama_tabel', tabelFilter);
  if (dariFilter) query = query.gte('dibuat_pada', `${dariFilter}T00:00:00+07:00`);
  if (sampaiFilter) query = query.lte('dibuat_pada', `${sampaiFilter}T23:59:59+07:00`);

  const { data: rawLogs, count, error } = await query
    .order('dibuat_pada', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching audit_log:', error);
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const logs: AuditLogItem[] = ((rawLogs || []) as Record<string, unknown>[]).map((r) => {
    const pelaku = (Array.isArray(r.pelaku) ? r.pelaku[0] : r.pelaku) as {
      nama_lengkap?: string;
      peran?: string;
    } | null;

    return {
      id: Number(r.id),
      pelaku_id: r.pelaku_id ? String(r.pelaku_id) : '',
      pelaku_nama: pelaku?.nama_lengkap || (!r.pelaku_id ? 'Sistem (Mayar)' : 'Sistem'),
      pelaku_email: '',
      pelaku_peran: pelaku?.peran || '',
      aksi: String(r.aksi || ''),
      nama_tabel: String(r.nama_tabel || ''),
      data_id: r.data_id ? String(r.data_id) : null,
      nilai_lama: (r.nilai_lama as Record<string, unknown>) || null,
      nilai_baru: (r.nilai_baru as Record<string, unknown>) || null,
      dibuat_pada: String(r.dibuat_pada || ''),
    };
  });

  // Opsi Aksi & Tabel umum untuk filter
  const aksiOptions = [
    'ubah_harga_jual',
    'ubah_harga_pokok',
    'ubah_batas_kredit',
    'ubah_termin_hari',
    'ubah_peran',
    'ubah_status_aktif',
    'konfirmasi_pesanan',
    'batalkan_pesanan',
    'kirim_pesanan',
    'catat_pelunasan',
    'ajukan_pembelian',
    'setujui_pembelian',
    'tolak_pembelian',
    'batalkan_pembelian',
    'terima_pembelian',
    'penyesuaian_stok',
  ];

  const tabelOptions = [
    'barang',
    'pelanggan',
    'profiles',
    'pesanan_jual',
    'pembelian',
    'mutasi_stok',
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Log Perubahan Sistem"
        description="Jejak audit append-only seluruh perubahan data sensitif, otorisasi peran, penyesuaian stok, dan transaksi keuangan."
      />

      <AuditTable
        logs={logs}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        aksiOptions={aksiOptions}
        tabelOptions={tabelOptions}
      />
    </div>
  );
}
