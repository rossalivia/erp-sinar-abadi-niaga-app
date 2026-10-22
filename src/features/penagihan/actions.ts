'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/lib/errors';
import { catatPenagihanSchema, type CatatPenagihanInput } from './schemas';
import { TagihanItem, CatatanPenagihanItem } from './types';

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Mengambil daftar seluruh faktur terkirim yang belum lunas.
 * View v_tagihan otomatis menyaring berdasarkan hak akses peran (RLS).
 * Urutan default: jatuh tempo terlama ke terbaru (overdue teratas).
 */
export async function ambilDaftarTagihanAction(): Promise<ActionResult<TagihanItem[]>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('v_tagihan')
    .select('*')
    .order('jatuh_tempo', { ascending: true })
    .order('dibuat_pada', { ascending: true });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  return {
    success: true,
    data: (data || []) as unknown as TagihanItem[],
  };
}

/**
 * Mengambil riwayat catatan penagihan dan janji bayar per pelanggan / faktur.
 */
export async function ambilRiwayatPenagihanAction(
  pelangganId: string,
  pesananJualId?: string | null
): Promise<ActionResult<CatatanPenagihanItem[]>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('rpc_baca_catatan_penagihan', {
    p_pelanggan_id: pelangganId,
    p_pesanan_jual_id: pesananJualId || undefined,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  return {
    success: true,
    data: (data || []) as unknown as CatatanPenagihanItem[],
  };
}

/**
 * Menyimpan catatan penagihan atau janji bayar baru.
 * Memanggil RPC rpc_catat_penagihan.
 */
export async function simpanCatatanPenagihanAction(
  payload: CatatPenagihanInput
): Promise<ActionResult<{ id: string; dibuat_pada: string }>> {
  const parsed = catatPenagihanSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || 'Data catatan penagihan tidak valid',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('rpc_catat_penagihan', {
    p_pelanggan_id: parsed.data.pelangganId,
    p_pesanan_jual_id: parsed.data.pesananJualId || undefined,
    p_jenis: parsed.data.jenis,
    p_isi: parsed.data.isi,
    p_janji_bayar_tanggal:
      parsed.data.jenis === 'janji_bayar' && parsed.data.janjiBayarTanggal
        ? parsed.data.janjiBayarTanggal
        : undefined,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/penagihan');
  revalidatePath('/');
  revalidatePath(`/pelanggan/${parsed.data.pelangganId}`);
  revalidatePath(`/pelanggan/${parsed.data.pelangganId}/piutang`);

  return {
    success: true,
    data: data as { id: string; dibuat_pada: string },
    message: 'Catatan penagihan berhasil disimpan',
  };
}

/**
 * Merekam pengiriman pesan pengingat WhatsApp secara otomatis ke dalam riwayat penagihan.
 */
export async function rekamPengingatWhatsAppAction(
  pelangganId: string,
  pesananJualId: string | null | undefined,
  isi: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc('rpc_catat_penagihan', {
    p_pelanggan_id: pelangganId,
    p_pesanan_jual_id: pesananJualId || undefined,
    p_jenis: 'pengingat_wa',
    p_isi: isi.trim() || 'Pengiriman pengingat jatuh tempo via WhatsApp',
    p_janji_bayar_tanggal: undefined,
  });

  if (error) {
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }

  revalidatePath('/penagihan');
  revalidatePath(`/pelanggan/${pelangganId}/piutang`);

  return {
    success: true,
    data: data as { id: string },
  };
}
