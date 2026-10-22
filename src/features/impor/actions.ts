'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getProfil } from '@/lib/profil';
import { getErrorMessage } from '@/lib/errors';
import {
  BarangImportRow,
  PelangganImportRow,
  ValidationResult,
  ImporDataRow,
} from './types';
import type { Json } from '@/types/database';
import { parseBarangCsv, parsePelangganCsv } from './utils';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

export interface ActionResponse<T> {
  sukses: boolean;
  pesan?: string;
  hasil?: T;
  nomor?: string;
  jumlahDibuat?: number;
}

/**
 * Validasi kering (dry-run) berkas CSV Barang
 */
export async function validasiBarangCsvAction(
  formData: FormData
): Promise<ActionResponse<ValidationResult<BarangImportRow>>> {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return { sukses: false, pesan: 'Akses ditolak. Hanya Manajer yang dapat mengimpor data.' };
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return { sukses: false, pesan: 'Berkas tidak ditemukan. Harap pilih berkas CSV.' };
  }

  const filename = file.name.toLowerCase();
  if (!filename.endsWith('.csv')) {
    return {
      sukses: false,
      pesan: 'Format berkas tidak didukung, harap unggah berkas berekstensi .csv (Berkas Excel .xlsx tidak didukung).',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { sukses: false, pesan: 'Ukuran berkas CSV melebihi batas maksimal 1 MB.' };
  }

  try {
    const csvContent = await file.text();
    const supabase = await createServerClient();

    // Ambil seluruh kode barang yang sudah ada di database untuk validasi duplikasi
    const { data: existingRows } = await supabase.from('barang').select('kode');
    const existingCodes = new Set((existingRows || []).map((r) => r.kode.toUpperCase()));

    const validation = parseBarangCsv(csvContent, existingCodes);
    return { sukses: true, hasil: validation };
  } catch (err) {
    return { sukses: false, pesan: getErrorMessage(err) };
  }
}

/**
 * Validasi kering (dry-run) berkas CSV Pelanggan
 */
export async function validasiPelangganCsvAction(
  formData: FormData
): Promise<ActionResponse<ValidationResult<PelangganImportRow>>> {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return { sukses: false, pesan: 'Akses ditolak. Hanya Manajer yang dapat mengimpor data.' };
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return { sukses: false, pesan: 'Berkas tidak ditemukan. Harap pilih berkas CSV.' };
  }

  const filename = file.name.toLowerCase();
  if (!filename.endsWith('.csv')) {
    return {
      sukses: false,
      pesan: 'Format berkas tidak didukung, harap unggah berkas berekstensi .csv (Berkas Excel .xlsx tidak didukung).',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { sukses: false, pesan: 'Ukuran berkas CSV melebihi batas maksimal 1 MB.' };
  }

  try {
    const csvContent = await file.text();
    const supabase = await createServerClient();

    // Ambil seluruh kode pelanggan eksisting
    const { data: existingRows } = await supabase.from('pelanggan').select('kode');
    const existingCodes = new Set((existingRows || []).map((r) => r.kode.toUpperCase()));

    const validation = parsePelangganCsv(csvContent, existingCodes);
    return { sukses: true, hasil: validation };
  } catch (err) {
    return { sukses: false, pesan: getErrorMessage(err) };
  }
}

/**
 * Eksekusi atomik impor data Barang via RPC rpc_impor_barang
 */
export async function eksekusiImporBarangAction(
  namaBerkas: string,
  items: BarangImportRow[]
): Promise<ActionResponse<void>> {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return { sukses: false, pesan: 'Akses ditolak. Hanya Manajer yang dapat mengimpor data.' };
  }

  if (!items || items.length === 0) {
    return { sukses: false, pesan: 'Tidak ada data valid yang dapat diimpor.' };
  }

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('rpc_impor_barang', {
      p_nama_berkas: namaBerkas,
      p_items: items as unknown as Json,
    });

    if (error) {
      return { sukses: false, pesan: getErrorMessage(error) };
    }

    revalidatePath('/barang');
    revalidatePath('/impor');
    revalidatePath('/impor/riwayat');

    const result = data as { nomor: string; jumlah_dibuat: number };
    return {
      sukses: true,
      nomor: result.nomor,
      jumlahDibuat: result.jumlah_dibuat,
    };
  } catch (err) {
    return { sukses: false, pesan: getErrorMessage(err) };
  }
}

/**
 * Eksekusi atomik impor data Pelanggan via RPC rpc_impor_pelanggan
 */
export async function eksekusiImporPelangganAction(
  namaBerkas: string,
  items: PelangganImportRow[]
): Promise<ActionResponse<void>> {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return { sukses: false, pesan: 'Akses ditolak. Hanya Manajer yang dapat mengimpor data.' };
  }

  if (!items || items.length === 0) {
    return { sukses: false, pesan: 'Tidak ada data valid yang dapat diimpor.' };
  }

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.rpc('rpc_impor_pelanggan', {
      p_nama_berkas: namaBerkas,
      p_items: items as unknown as Json,
    });

    if (error) {
      return { sukses: false, pesan: getErrorMessage(error) };
    }

    revalidatePath('/pelanggan');
    revalidatePath('/impor');
    revalidatePath('/impor/riwayat');

    const result = data as { nomor: string; jumlah_dibuat: number };
    return {
      sukses: true,
      nomor: result.nomor,
      jumlahDibuat: result.jumlah_dibuat,
    };
  } catch (err) {
    return { sukses: false, pesan: getErrorMessage(err) };
  }
}

/**
 * Mengambil daftar riwayat transaksi impor
 */
export async function ambilRiwayatImporAction(
  page: number = 1,
  pageSize: number = 15
): Promise<{ rows: ImporDataRow[]; totalCount: number; error?: string }> {
  const profile = await getProfil();
  if (!profile || profile.peran !== 'manajer') {
    return { rows: [], totalCount: 0, error: 'Akses ditolak' };
  }

  try {
    const supabase = await createServerClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
      .from('impor_data')
      .select('*, profiles:dibuat_oleh(nama_lengkap)', { count: 'exact' })
      .order('dibuat_pada', { ascending: false })
      .range(from, to);

    if (error) {
      return { rows: [], totalCount: 0, error: getErrorMessage(error) };
    }

    const rows: ImporDataRow[] = (data || []).map((row) => {
      const p = row.profiles as { nama_lengkap: string } | null;
      return {
        id: row.id,
        nomor: row.nomor,
        jenis: row.jenis as 'barang' | 'pelanggan',
        nama_berkas: row.nama_berkas,
        jumlah_baris: row.jumlah_baris,
        jumlah_dibuat: row.jumlah_dibuat,
        status: row.status as 'berhasil' | 'gagal',
        ringkasan: (row.ringkasan as Record<string, unknown>) || {},
        dibuat_oleh: row.dibuat_oleh,
        dibuat_pada: row.dibuat_pada,
        pelaksana_nama: p?.nama_lengkap || 'Manajer',
      };
    });

    return { rows, totalCount: count || 0 };
  } catch (err) {
    return { rows: [], totalCount: 0, error: getErrorMessage(err) };
  }
}
