import * as React from 'react';
import { redirect } from 'next/navigation';
import { getProfil } from '@/lib/profil';
import { createServerClient } from '@/lib/supabase/server';
import { ambilRiwayatTagihanMayarService, getAppBaseUrl } from '@/features/pembayaran/service';
import { PageHeader } from '@/components/shared/page-header';
import { PembayaranMayarView, type PesananDikirimItem } from '@/features/pembayaran/components/PembayaranMayarView';

export const dynamic = 'force-dynamic';

export default async function PembayaranMayarPage() {
  const profile = await getProfil();
  if (!profile) {
    redirect('/login');
  }

  // 1. Otorisasi Lapisan Server Component: Khusus Manajer (M1)
  if (profile.peran !== 'manajer') {
    redirect('/tidak-berwenang');
  }

  // 2. Ambil riwayat tagihan Mayar
  const tagihanList = await ambilRiwayatTagihanMayarService();

  // 3. Ambil pesanan berstatus 'dikirim' yang siap dibuatkan tautan bayar
  const supabase = await createServerClient();
  const { data: pesananDikirimRaw } = await supabase
    .from('pesanan_jual')
    .select(`
      id,
      nomor,
      total,
      status,
      dibuat_pada,
      dikirim_pada,
      jatuh_tempo,
      pelanggan:pelanggan_id (
        id,
        kode,
        nama_toko,
        telepon
      )
    `)
    .eq('status', 'dikirim')
    .order('dikirim_pada', { ascending: false });

  // Normalisasi hasil join pelanggan Supabase
  const pesananDikirimList: PesananDikirimItem[] = ((pesananDikirimRaw || []) as unknown as Array<{
    id: string;
    nomor: string;
    total: number;
    status: string;
    dibuat_pada: string;
    dikirim_pada: string | null;
    jatuh_tempo: string | null;
    pelanggan:
      | { id: string; kode: string; nama_toko: string; telepon: string | null }
      | Array<{ id: string; kode: string; nama_toko: string; telepon: string | null }>
      | null;
  }>).map((p) => {
    const pel = Array.isArray(p.pelanggan) ? p.pelanggan[0] || null : p.pelanggan;
    return {
      id: p.id,
      nomor: p.nomor,
      total: Number(p.total),
      status: p.status,
      dibuat_pada: p.dibuat_pada,
      dikirim_pada: p.dikirim_pada,
      jatuh_tempo: p.jatuh_tempo,
      pelanggan: pel
        ? {
            id: pel.id,
            kode: pel.kode,
            nama_toko: pel.nama_toko,
            telepon: pel.telepon,
          }
        : null,
    };
  });

  const hasRealKey = Boolean(
    process.env.MAYAR_API_KEY &&
    process.env.MAYAR_API_KEY.trim() !== '' &&
    !process.env.MAYAR_API_KEY.includes('placeholder')
  );

  const webhookToken = process.env.MAYAR_WEBHOOK_TOKEN || 'sandbox_webhook_token_rahasia';
  const appUrl = getAppBaseUrl();
  const webhookUrl = `${appUrl}/api/webhooks/mayar/${webhookToken}`;
  const defaultCustomerEmail = process.env.DEFAULT_CUSTOMER_EMAIL || 'toko.pelanggan@sinarabadi.co.id';

  const perluTinjauCount = tagihanList.filter(
    (t) => t.status === 'perlu_tinjau' || t.status_efektif === 'perlu_tinjau'
  ).length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Monitoring Pembayaran Digital Mayar"
        description="Riwayat penerbitan tautan bayar online Mayar sandbox, status pelunasan otomatis, dan rekonsiliasi transaksi."
      />

      {perluTinjauCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Perhatian:</span>
            <span>
              Terdapat <strong>{perluTinjauCount}</strong> transaksi pembayaran yang memerlukan
              peninjauan Manajer (anomali nominal, status pesanan tidak sesuai, atau indikasi
              pembayaran ganda). Pesanan terkait belum dilunasi.
            </span>
          </div>
        </div>
      )}

      <PembayaranMayarView
        tagihanList={tagihanList}
        pesananDikirimList={pesananDikirimList}
        webhookUrl={webhookUrl}
        hasRealKey={hasRealKey}
        defaultCustomerEmail={defaultCustomerEmail}
      />
    </div>
  );
}
