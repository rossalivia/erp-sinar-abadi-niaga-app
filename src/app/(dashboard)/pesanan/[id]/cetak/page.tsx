import * as React from 'react';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/features/pesanan/components/print-button';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatRupiah, formatTanggal } from '@/lib/format';
import { Logo } from '@/components/ui/logo';
import type { PesananJualDetail } from '@/features/pesanan/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CetakPesananPage({ params }: PageProps) {
  const { id } = await params;
  const profil = await getProfil();
  const peran = profil?.peran || 'penjualan';
  const isGudang = peran === 'gudang';

  const supabase = await createServerClient();

  const { data: pesananRaw, error: pesananError } = await supabase
    .from('pesanan_jual')
    .select(`
      id, nomor, status, total, dibuat_pada, dikirim_pada, jatuh_tempo,
      pelanggan:pelanggan_id (id, kode, nama_toko, telepon, alamat, termin_hari),
      pembuat:dibuat_oleh (id, nama_lengkap)
    `)
    .eq('id', id)
    .single();

  if (pesananError || !pesananRaw) {
    notFound();
  }

  const pelanggan = (Array.isArray(pesananRaw.pelanggan)
    ? pesananRaw.pelanggan[0]
    : pesananRaw.pelanggan) as unknown as PesananJualDetail['pelanggan'];

  const pembuat = (Array.isArray(pesananRaw.pembuat)
    ? pesananRaw.pembuat[0]
    : pesananRaw.pembuat) as unknown as PesananJualDetail['pembuat'];

  // Query baris item memakai v_item_pesanan_jual (bebas kolom rahasia HPP)
  const { data: itemsRaw } = await supabase
    .from('v_item_pesanan_jual')
    .select(`
      id, jumlah, harga_satuan, diskon_persen, subtotal,
      barang:barang_id (kode, nama, satuan)
    `)
    .eq('pesanan_jual_id', id);

  const items = (itemsRaw || []).map((row) => {
    const b = (Array.isArray(row.barang) ? row.barang[0] : row.barang) as unknown as {
      kode: string;
      nama: string;
      satuan: string;
    };
    return {
      id: row.id,
      jumlah: Number(row.jumlah),
      harga_satuan: Number(row.harga_satuan),
      diskon_persen: Number(row.diskon_persen),
      subtotal: Number(row.subtotal),
      barang: b,
    };
  });

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Kontrol Cetak (Disembunyikan saat di-print) */}
      <PrintButton backHref={`/pesanan/${id}`} />

      {/* Dokumen Kertas */}
      <div className="border border-slate-300 p-8 sm:p-10 rounded-sm space-y-6 print:border-none print:p-0">
        {/* Header Dokumen */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <Logo variant="monochrome" size="sm" showSubdeskripsi={true} />
            <p className="text-[11px] text-slate-500 pt-0.5">
              Jl. Industri Niaga No. 88, Kawasan Pergudangan, Bekasi &bull; Telp: (021) 8990-1234
            </p>
          </div>

          <div className="text-right">
            <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900">
              {isGudang ? 'SURAT JALAN' : 'FAKTUR PENJUALAN'}
            </h2>
            <p className="text-xs font-mono font-medium text-slate-700 mt-1">
              No: {pesananRaw.nomor}
            </p>
            <p className="text-xs text-slate-500">
              Tanggal: {formatTanggal(pesananRaw.dibuat_pada)}
            </p>
          </div>
        </div>

        {/* Informasi Penerima & Detail Dokumen */}
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Tujuan Pengiriman / Pembeli:
            </p>
            <p className="text-sm font-bold text-slate-900">{pelanggan?.nama_toko}</p>
            <p className="text-slate-500 font-mono">Kode: {pelanggan?.kode}</p>
            <p className="text-slate-600 mt-1">{pelanggan?.alamat || '-'}</p>
            <p className="text-slate-600">Telp: {pelanggan?.telepon || '-'}</p>
          </div>

          <div className="space-y-1 text-right">
            <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Keterangan:
            </p>
            {!isGudang && (
              <>
                <p className="text-slate-600">
                  Termin Pembayaran:{' '}
                  <span className="font-medium text-slate-900">
                    {pelanggan?.termin_hari} hari
                  </span>
                </p>
                <p className="text-slate-600">
                  Jatuh Tempo:{' '}
                  <span className="font-medium text-slate-900">
                    {pesananRaw.jatuh_tempo ? formatTanggal(pesananRaw.jatuh_tempo) : '-'}
                  </span>
                </p>
              </>
            )}
            <p className="text-slate-600">
              Status Pesanan:{' '}
              <span className="font-medium uppercase text-slate-900">
                {pesananRaw.status}
              </span>
            </p>
            {pesananRaw.dikirim_pada && (
              <p className="text-slate-600">
                Tgl Kirim: {formatTanggal(pesananRaw.dikirim_pada)}
              </p>
            )}
          </div>
        </div>

        {/* Tabel Barang */}
        <div className="pt-2">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-semibold">
                <th className="py-2 px-3 w-10 text-center border-r border-slate-300">No</th>
                <th className="py-2 px-3 w-28 border-r border-slate-300">Kode</th>
                <th className="py-2 px-3 border-r border-slate-300">Nama Barang</th>
                <th className="py-2 px-3 w-20 text-right border-r border-slate-300">Jumlah</th>
                <th className="py-2 px-3 w-16 text-center border-r border-slate-300">Satuan</th>
                {!isGudang && (
                  <>
                    <th className="py-2 px-3 w-28 text-right border-r border-slate-300">
                      Harga Satuan
                    </th>
                    <th className="py-2 px-3 w-16 text-right border-r border-slate-300">
                      Diskon
                    </th>
                    <th className="py-2 px-3 w-32 text-right">Subtotal</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {items.map((it, idx) => (
                <tr key={it.id} className="border-b border-slate-200">
                  <td className="py-2 px-3 text-center border-r border-slate-300">{idx + 1}</td>
                  <td className="py-2 px-3 font-mono font-medium border-r border-slate-300">
                    {it.barang?.kode}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-300">
                    {it.barang?.nama}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold border-r border-slate-300">
                    {it.jumlah}
                  </td>
                  <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-300">
                    {it.barang?.satuan}
                  </td>
                  {!isGudang && (
                    <>
                      <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-slate-300">
                        {formatRupiah(it.harga_satuan)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-slate-300">
                        {it.diskon_persen > 0 ? `${it.diskon_persen}%` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        {formatRupiah(it.subtotal)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            {!isGudang && (
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                  <td colSpan={7} className="py-2.5 px-3 text-right uppercase text-xs">
                    Total Pembayaran:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sm text-slate-900">
                    {formatRupiah(Number(pesananRaw.total) || 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Tanda Tangan */}
        <div className="pt-10 grid grid-cols-3 gap-6 text-center text-xs">
          {isGudang ? (
            <>
              <div className="space-y-14">
                <p className="text-slate-600">Disiapkan Oleh (Gudang),</p>
                <div className="border-b border-slate-400 w-36 mx-auto"></div>
                <p className="text-[11px] text-slate-500">( Petugas Gudang )</p>
              </div>
              <div className="space-y-14">
                <p className="text-slate-600">Sopir / Pengirim,</p>
                <div className="border-b border-slate-400 w-36 mx-auto"></div>
                <p className="text-[11px] text-slate-500">( Sopir Ekspedisi )</p>
              </div>
              <div className="space-y-14">
                <p className="text-slate-600">Diterima Oleh,</p>
                <div className="border-b border-slate-400 w-36 mx-auto"></div>
                <p className="text-[11px] text-slate-500">( Cap & Tanda Tangan Toko )</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-14">
                <p className="text-slate-600">Dibuat Oleh,</p>
                <div className="border-b border-slate-400 w-36 mx-auto"></div>
                <p className="text-[11px] text-slate-700 font-medium">
                  {pembuat?.nama_lengkap || 'Staf Penjualan'}
                </p>
              </div>
              <div></div>
              <div className="space-y-14">
                <p className="text-slate-600">Penerima / Pembeli,</p>
                <div className="border-b border-slate-400 w-36 mx-auto"></div>
                <p className="text-[11px] text-slate-500">( {pelanggan?.nama_toko} )</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
