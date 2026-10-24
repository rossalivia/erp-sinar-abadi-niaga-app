import * as React from 'react';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { PrintButton } from '@/features/pesanan/components/print-button';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { Logo } from '@/components/ui/logo';
import { TagihanItem } from '@/features/penagihan/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Kartu Piutang Pelanggan | CV Sinar Abadi Niaga',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function KartuPiutangPage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();

  if (!profil || (profil.peran !== 'manajer' && profil.peran !== 'penjualan')) {
    redirect('/tidak-berwenang');
  }

  const supabase = await createServerClient();

  // 1. Ambil data profil pelanggan
  const { data: pelanggan, error: plgError } = await supabase
    .from('pelanggan')
    .select('id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari')
    .eq('id', id)
    .single();

  if (plgError || !pelanggan) {
    notFound();
  }

  // 2. Ambil seluruh faktur tagihan terkirim belum lunas dari v_tagihan
  const { data: tagihanRaw } = await supabase
    .from('v_tagihan')
    .select('*')
    .eq('pelanggan_id', id)
    .order('jatuh_tempo', { ascending: true })
    .order('dibuat_pada', { ascending: true });

  const tagihanList = (tagihanRaw || []) as unknown as TagihanItem[];

  // 3. Kalkulasi rekapitulasi umur piutang
  let totalBelumTempo = 0;
  let totalHariIni = 0;
  let totalOverdue = 0;
  let grandTotal = 0;

  for (const t of tagihanList) {
    grandTotal += t.total;
    if (t.klasifikasi.startsWith('overdue')) {
      totalOverdue += t.total;
    } else if (t.klasifikasi === 'hari_ini') {
      totalHariIni += t.total;
    } else {
      totalBelumTempo += t.total;
    }
  }

  const tanggalCetak = formatTanggal(new Date());

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Kontrol Cetak (Disembunyikan saat cetak fisik) */}
      <PrintButton />

      {/* Dokumen Kartu Piutang */}
      <div className="border border-slate-200 rounded-lg p-6 sm:p-8 bg-white print:border-none print:p-0">
        {/* Kop Surat CV Sinar Abadi Niaga */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div className="space-y-1">
            <Logo variant="monochrome" size="sm" showSubdeskripsi={true} />
            <p className="text-[11px] text-slate-500 pt-0.5">
              Jl. Industri Niaga No. 88, Kawasan Pergudangan, Surabaya &bull; Telp: (031) 8990-1234 &bull; Email: admin@sinarabadi.test
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 rounded">
              Kartu Piutang
            </span>
            <p className="text-xs text-slate-500 mt-1">
              Tanggal Cetak: <span className="font-semibold text-slate-800">{tanggalCetak}</span>
            </p>
          </div>
        </div>

        {/* Informasi Pelanggan */}
        <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50/70 p-4 border border-slate-200 text-xs mb-6">
          <div>
            <p className="text-slate-500 font-medium">Ditujukan Kepada:</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{pelanggan.nama_toko}</p>
            <p className="font-mono text-slate-600 text-[11px]">{pelanggan.kode}</p>
            <p className="text-slate-700 mt-1">{pelanggan.alamat || 'Alamat tidak tercantum'}</p>
            <p className="text-slate-700">Telp: {pelanggan.telepon || '-'}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-slate-500 font-medium">Ketentuan Kredit:</p>
            <p className="text-slate-700">
              Termin Pembayaran:{' '}
              <span className="font-semibold text-slate-900">{pelanggan.termin_hari} Hari</span>
            </p>
            <p className="text-slate-700">
              Plafon Kredit:{' '}
              <span className="font-semibold text-slate-900">{formatRupiah(pelanggan.batas_kredit)}</span>
            </p>
            <p className="text-slate-700">
              Jumlah Faktur Terbuka:{' '}
              <span className="font-semibold text-slate-900">{tagihanList.length} Faktur</span>
            </p>
          </div>
        </div>

        {/* Tabel Rincian Faktur Terkirim */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-800">
                <th className="py-2 px-2.5 text-left font-semibold">No</th>
                <th className="py-2 px-2.5 text-left font-semibold">No. Faktur SO</th>
                <th className="py-2 px-2.5 text-left font-semibold">Tgl Kirim</th>
                <th className="py-2 px-2.5 text-left font-semibold">Jatuh Tempo</th>
                <th className="py-2 px-2.5 text-left font-semibold">Status / Umur</th>
                <th className="py-2 px-2.5 text-right font-semibold">Nilai Tagihan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {tagihanList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Tidak ada faktur piutang berjalan yang tercatat untuk pelanggan ini.
                  </td>
                </tr>
              ) : (
                tagihanList.map((faktur, idx) => (
                  <tr key={faktur.pesanan_id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2.5 text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-mono font-medium text-slate-900">
                      {faktur.nomor_pesanan}
                    </td>
                    <td className="py-2 px-2.5 text-slate-600 tabular-nums">
                      {formatTanggal(faktur.dikirim_pada)}
                    </td>
                    <td className="py-2 px-2.5 font-medium tabular-nums text-slate-900">
                      {formatTanggal(faktur.jatuh_tempo)}
                    </td>
                    <td className="py-2 px-2.5">
                      {faktur.klasifikasi === 'hari_ini' ? (
                        <span className="font-semibold text-amber-800">Jatuh Tempo Hari Ini</span>
                      ) : faktur.klasifikasi.startsWith('overdue') ? (
                        <span className="font-bold text-red-700">
                          Terlambat {faktur.hari_terlambat} Hari
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          {faktur.hari_menuju} Hari Menuju Tempo
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {formatRupiah(faktur.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ringkasan Umur Piutang */}
        <div className="grid grid-cols-2 gap-6 items-start mb-8">
          <div className="rounded border border-slate-200 p-3 bg-slate-50 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Catatan Pembayaran:</p>
            <p>&bull; Pembayaran via transfer Bank BCA: <strong>8890-123-456</strong> a.n. CV Sinar Abadi Niaga.</p>
            <p>&bull; Konfirmasikan bukti transfer kepada Staf Penjualan terkait atau Admin Keuangan.</p>
          </div>

          <div className="rounded border border-slate-200 bg-white p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Total Belum Jatuh Tempo:</span>
              <span className="font-medium tabular-nums">{formatRupiah(totalBelumTempo)}</span>
            </div>
            <div className="flex justify-between text-amber-800">
              <span>Jatuh Tempo Hari Ini:</span>
              <span className="font-semibold tabular-nums">{formatRupiah(totalHariIni)}</span>
            </div>
            <div className="flex justify-between text-red-700">
              <span>Total Menunggak (Overdue):</span>
              <span className="font-bold tabular-nums">{formatRupiah(totalOverdue)}</span>
            </div>
            <div className="border-t-2 border-slate-900 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
              <span>Total Piutang Tertagih:</span>
              <span className="tabular-nums">{formatRupiah(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Kolom Tanda Tangan */}
        <div className="grid grid-cols-3 gap-6 text-center text-xs pt-4 border-t border-slate-200">
          <div>
            <p className="text-slate-500">Dibuat Oleh:</p>
            <div className="h-16"></div>
            <p className="font-medium text-slate-900 border-t border-slate-300 pt-1">
              {profil.nama_lengkap || 'Staf Penjualan'}
            </p>
            <p className="text-[10px] text-slate-400">Bagian Penjualan / Kolektor</p>
          </div>

          <div>
            <p className="text-slate-500">Disetujui:</p>
            <div className="h-16"></div>
            <p className="font-medium text-slate-900 border-t border-slate-300 pt-1">
              ( .................................... )
            </p>
            <p className="text-[10px] text-slate-400">Manajer Keuangan</p>
          </div>

          <div>
            <p className="text-slate-500">Diterima / Mengetahui:</p>
            <div className="h-16"></div>
            <p className="font-medium text-slate-900 border-t border-slate-300 pt-1">
              ( .................................... )
            </p>
            <p className="text-[10px] text-slate-400">Pihak Toko / Pelanggan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
