'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { formatTanggal } from '@/lib/format';
import type { LaporanRingkasan, LaporanAgingPiutang, LaporanMarginMingguanItem } from '@/features/laporan/types';

export interface DashboardFinansialResult {
  success: boolean;
  message?: string;
  data?: {
    kpiFinansial: LaporanRingkasan | null;
    marginData: LaporanMarginMingguanItem[];
    agingPiutang: LaporanAgingPiutang | null;
    periodeJudul: string;
    dari: string;
    sampai: string;
  };
}

export async function getDashboardFinansialAction(params: {
  preset: string;
  dari?: string;
  sampai?: string;
}): Promise<DashboardFinansialResult> {
  // 1. Proteksi Akses Ketat BR-12 (Hanya Manajer)
  const user = await getProfil();
  if (!user || user.peran !== 'manajer') {
    return {
      success: false,
      message: 'Akses ditolak: Hanya Manajer yang berwenang melihat data finansial dan omzet (BR-12)',
    };
  }

  const supabase = await createServerClient();

  // Hitung tanggal zona Asia/Jakarta
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const preset = params.preset || 'bulan_ini';
  let dari = params.dari || '';
  let sampai = params.sampai || todayStr;

  // Hitung rentang 8 minggu terakhir untuk baseline mingguan
  const d8m = new Date(now);
  d8m.setDate(d8m.getDate() - 56);
  const dari8Minggu = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d8m);

  if (preset === 'hari_ini') {
    dari = todayStr;
    sampai = todayStr;
  } else if (preset === '7h') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    dari = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    sampai = todayStr;
  } else if (preset === 'minggu_ini') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    dari = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(monday);
    sampai = todayStr;
  } else if (preset === 'bulan_ini') {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    dari = `${year}-${month}-01`;
    sampai = todayStr;
  } else if (preset === '30h') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    dari = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    sampai = todayStr;
  } else if (!dari) {
    dari = todayStr;
  }

  // Label dinamis periode aktif
  let periodeJudul = 'Bulan Berjalan';
  if (preset === 'hari_ini') {
    periodeJudul = `Hari Ini (${formatTanggal(todayStr)})`;
  } else if (preset === '7h') {
    periodeJudul = `7 Hari Terakhir (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === 'minggu_ini') {
    periodeJudul = `Minggu Berjalan (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === 'bulan_ini') {
    periodeJudul = `Bulan Berjalan (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === '30h') {
    periodeJudul = `30 Hari Terakhir (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else {
    periodeJudul = `Periode Terpilih (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  }

  // Rentang untuk grafik mingguan: Jika rentang filter sempit (< 4 minggu), ambil minimal 8 minggu s.d. sampai
  const chartDari = preset === 'hari_ini' || preset === '7h' || preset === 'minggu_ini' ? dari8Minggu : dari;

  try {
    const [ringkasanRes, marginRes, agingRes] = await Promise.all([
      supabase.rpc('rpc_laporan_ringkasan', { p_dari: dari, p_sampai: sampai }),
      supabase.rpc('rpc_laporan_margin_mingguan', { p_dari: chartDari, p_sampai: sampai }),
      supabase.rpc('rpc_laporan_aging_piutang'),
    ]);

    if (ringkasanRes.error) {
      return { success: false, message: ringkasanRes.error.message };
    }

    let kpiFinansial: LaporanRingkasan | null = null;
    const ringkasanRaw = Array.isArray(ringkasanRes.data) ? ringkasanRes.data[0] : ringkasanRes.data;
    if (ringkasanRaw) {
      kpiFinansial = {
        total_omzet: Number(ringkasanRaw.total_omzet) || 0,
        total_hpp: Number(ringkasanRaw.total_hpp) || 0,
        total_margin: Number(ringkasanRaw.total_margin) || 0,
        margin_persen: Number(ringkasanRaw.margin_persen) || 0,
        jumlah_pesanan: Number(ringkasanRaw.jumlah_pesanan) || 0,
        pesanan_dikirim: Number(ringkasanRaw.pesanan_dikirim) || 0,
        pesanan_lunas: Number(ringkasanRaw.pesanan_lunas) || 0,
      };
    }

    let agingPiutang: LaporanAgingPiutang | null = null;
    const agingRaw = (Array.isArray(agingRes.data) ? agingRes.data[0] : agingRes.data) as Record<string, unknown> | null;
    if (agingRaw) {
      agingPiutang = {
        total_piutang_berjalan: Number(agingRaw.total_piutang_berjalan ?? agingRaw.total_piutang_dikirim) || 0,
        total_piutang_dikirim: Number(agingRaw.total_piutang_dikirim) || 0,
        belum_jatuh_tempo: Number(agingRaw.belum_jatuh_tempo) || 0,
        lewat_1_30_hari: Number(agingRaw.lewat_1_30_hari) || 0,
        lewat_gt_30_hari: Number(agingRaw.lewat_gt_30_hari) || 0,
        jumlah_pesanan_lewat_tempo: Number(agingRaw.jumlah_pesanan_lewat_tempo) || 0,
        total_pesanan: Number(agingRaw.total_pesanan ?? agingRaw.total_pesanan_dikirim) || 0,
        total_pesanan_dikirim: Number(agingRaw.total_pesanan_dikirim) || 0,
        total_pesanan_berjalan: Number(agingRaw.total_pesanan_berjalan ?? agingRaw.total_pesanan ?? agingRaw.total_pesanan_dikirim) || 0,
      };
    }

    const marginData = (marginRes.data || []) as LaporanMarginMingguanItem[];

    return {
      success: true,
      data: {
        kpiFinansial,
        marginData,
        agingPiutang,
        periodeJudul,
        dari,
        sampai,
      },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal mengambil data finansial dashboard',
    };
  }
}
