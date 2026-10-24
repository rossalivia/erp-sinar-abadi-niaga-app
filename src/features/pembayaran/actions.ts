'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getProfil } from '@/lib/profil';
import {
  buatTagihanMayarService,
  periksaStatusMayarService,
  tutupTagihanMayarService,
} from './service';
import type { ServiceResult } from './types';

const buatTagihanSchema = z.object({
  pesananId: z.string().uuid({ message: 'ID pesanan tidak valid' }),
  email: z.string().email({ message: 'Format email pelanggan tidak valid' }),
  masaBerlakuHari: z.coerce.number().min(1).max(30).default(7),
});

/**
 * Server Action: Menerbitkan tagihan pembayaran Mayar baru oleh Manajer.
 */
export async function buatTagihanMayarAction(
  formData: FormData
): Promise<ServiceResult<{ id: string; tautan: string }>> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return {
      success: false,
      message: 'Hanya Manajer yang berwenang menerbitkan tagihan Mayar',
      errorCode: 'E0001',
    };
  }

  const raw = {
    pesananId: formData.get('pesananId'),
    email: formData.get('email'),
    masaBerlakuHari: formData.get('masaBerlakuHari') || 7,
  };

  const parsed = buatTagihanSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Input data tagihan tidak valid';
    return {
      success: false,
      message: errorMsg,
    };
  }

  const res = await buatTagihanMayarService({
    pesananId: parsed.data.pesananId,
    email: parsed.data.email,
    masaBerlakuHari: parsed.data.masaBerlakuHari,
  });

  if (res.success) {
    revalidatePath(`/pesanan/${parsed.data.pesananId}`);
    revalidatePath('/pembayaran');
  }

  return res;
}

/**
 * Server Action: Melakukan pengecekan status manual ke gateway Mayar.
 */
export async function periksaStatusMayarAction(
  tagihanId: string,
  pesananId?: string
): Promise<ServiceResult<{ status: string }>> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return {
      success: false,
      message: 'Hanya Manajer yang berwenang memeriksa status tagihan Mayar',
      errorCode: 'E0001',
    };
  }

  if (!tagihanId) {
    return {
      success: false,
      message: 'ID tagihan tidak valid',
    };
  }

  const res = await periksaStatusMayarService(tagihanId);

  if (pesananId) {
    revalidatePath(`/pesanan/${pesananId}`);
  }
  revalidatePath('/pembayaran');
  revalidatePath('/penagihan');

  return res;
}

/**
 * Server Action: Menutup/membatalkan tagihan Mayar aktif secara manual.
 */
export async function tutupTagihanMayarAction(
  tagihanId: string,
  alasan?: string,
  pesananId?: string
): Promise<ServiceResult> {
  const profil = await getProfil();
  if (!profil || profil.peran !== 'manajer') {
    return {
      success: false,
      message: 'Hanya Manajer yang berwenang menutup tagihan Mayar',
      errorCode: 'E0001',
    };
  }

  if (!tagihanId) {
    return {
      success: false,
      message: 'ID tagihan tidak valid',
    };
  }

  const res = await tutupTagihanMayarService(tagihanId, alasan);

  if (res.success) {
    if (pesananId) {
      revalidatePath(`/pesanan/${pesananId}`);
    }
    revalidatePath('/pembayaran');
  }

  return res;
}
