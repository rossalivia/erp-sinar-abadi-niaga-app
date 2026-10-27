import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMayarClient } from './mayar-client';
import { normalisasiNomorTelepon } from '@/features/penagihan/utils';
import type {
  BuatTagihanInput,
  ServiceResult,
  TagihanMayarRow,
  MayarClient,
} from './types';

interface SiapkanDbRow {
  pesanan_id: string;
  nomor_pesanan: string;
  kode_pelanggan: string;
  nama_toko: string;
  telepon_pelanggan: string | null;
  total_tagihan: number;
}

interface TagihanCariDbRow {
  id: string;
  pesanan_jual_id: string;
  mayar_invoice_id: string;
  mayar_transaction_id: string | null;
  tautan: string;
  jumlah: number;
  status: string;
  berlaku_sampai: string;
}

/**
 * Service pembuatan tagihan pembayaran online Mayar oleh Manajer (M5).
 */
export async function buatTagihanMayarService(
  input: BuatTagihanInput,
  customClient?: MayarClient
): Promise<ServiceResult<{ id: string; tautan: string }>> {
  const supabase = await createServerClient();
  const client = getMayarClient(customClient);

  // 1. Fase 1: Validasi dan Kunci Pesanan di Database
  const rpcCaller = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: SiapkanDbRow[] | null; error: { message: string; code?: string } | null }>;
  };

  const { data: siapkanData, error: siapkanError } = await rpcCaller.rpc(
    'rpc_siapkan_tagihan_mayar',
    { p_pesanan_id: input.pesananId }
  );

  if (siapkanError || !siapkanData || siapkanData.length === 0) {
    return {
      success: false,
      message: siapkanError?.message || 'Gagal menyiapkan data pesanan untuk tagihan Mayar',
      errorCode: siapkanError?.code,
    };
  }

  const pesanan = siapkanData[0];
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const redirectUrl = `${appUrl}/pembayaran/selesai`;

  // Normalisasi nomor telepon untuk Mayar
  const telpNorm = normalisasiNomorTelepon(pesanan.telepon_pelanggan);
  const mobile = telpNorm.valid ? telpNorm.nomor : '6281200000000';

  // Hitung tanggal kedaluwarsa ISO 8601 UTC
  const days = Math.max(1, Math.min(30, Number(input.masaBerlakuHari) || 7));
  const expiredDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const expiredAt = expiredDate.toISOString();

  let mayarResponse;
  try {
    // 2. Panggil Mayar API Gateway
    mayarResponse = await client.createInvoice({
      name: pesanan.nama_toko,
      email: input.email.trim().toLowerCase(),
      mobile,
      redirectUrl,
      description: `Pembayaran Pesanan ${pesanan.nomor_pesanan}`,
      expiredAt,
      items: [
        {
          quantity: 1,
          rate: Number(pesanan.total_tagihan),
          description: `Pesanan ${pesanan.nomor_pesanan}`,
        },
      ],
      extraData: {
        noCustomer: pesanan.kode_pelanggan,
        idProd: pesanan.nomor_pesanan,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Kegagalan komunikasi dengan gateway Mayar';
    return {
      success: false,
      message: errorMsg,
    };
  }

  // 3. Fase 2: Simpan Hasil ke Database
  const saveCaller = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { id: string; tautan: string; status: string } | null; error: { message: string; code?: string } | null }>;
  };

  const { data: simpanData, error: simpanError } = await saveCaller.rpc(
    'rpc_simpan_tagihan_mayar',
    {
      p_pesanan_id: input.pesananId,
      p_mayar_invoice_id: mayarResponse.id,
      p_mayar_transaction_id: mayarResponse.transactionId || null,
      p_tautan: mayarResponse.link,
      p_jumlah: Number(pesanan.total_tagihan),
      p_email_penerima: input.email.trim().toLowerCase(),
      p_berlaku_sampai: expiredAt,
    }
  );

  if (simpanError || !simpanData) {
    // Best effort close di Mayar jika penyimpanan di DB gagal
    await client.closeInvoice(mayarResponse.id).catch(() => null);
    return {
      success: false,
      message: simpanError?.message || 'Gagal menyimpan rekaman tagihan di basis data',
      errorCode: simpanError?.code,
    };
  }

  return {
    success: true,
    message: 'Tautan pembayaran Mayar berhasil diterbitkan',
    data: {
      id: simpanData.id,
      tautan: simpanData.tautan,
    },
  };
}

/**
 * Service pengecekan status manual ("Periksa Status") oleh Manajer (M11).
 */
export async function periksaStatusMayarService(
  tagihanId: string,
  customClient?: MayarClient
): Promise<ServiceResult<{ status: string }>> {
  const supabase = await createServerClient();
  const client = getMayarClient(customClient);

  // Ambil detail tagihan aktif
  const { data: tagihan, error: tagihanError } = await supabase
    .from('tagihan_mayar')
    .select('id, pesanan_jual_id, mayar_invoice_id, status, jumlah')
    .eq('id', tagihanId)
    .single();

  if (tagihanError || !tagihan) {
    return {
      success: false,
      message: 'Tagihan tidak ditemukan',
    };
  }

  try {
    const invoice = await client.getInvoice(tagihan.mayar_invoice_id);

    if (invoice.status === 'paid') {
      // Pelunasan otomatis via admin client (service_role)
      const adminClient = createAdminClient();
      const adminCaller = adminClient as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: { success: boolean; status: string; message: string } | null; error: { message: string } | null }>;
      };

      const { data: lunasData, error: lunasError } = await adminCaller.rpc(
        'rpc_sistem_lunaskan_dari_mayar',
        {
          p_tagihan_id: tagihan.id,
          p_referensi_transaksi: invoice.transactionId || invoice.id,
          p_jumlah_terverifikasi: Math.round(invoice.amount),
        }
      );

      if (lunasError || !lunasData) {
        return {
          success: false,
          message: lunasError?.message || 'Gagal memproses pelunasan sistem',
        };
      }

      return {
        success: lunasData.success,
        message: lunasData.message,
        data: { status: lunasData.status },
      };
    } else if (invoice.status === 'closed') {
      // Tutup lokal
      const caller = supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
      await caller.rpc('rpc_tutup_tagihan_mayar', {
        p_tagihan_id: tagihan.id,
        p_alasan: 'Tagihan telah ditutup di gerbang pembayaran Mayar',
      });

      return {
        success: true,
        message: 'Tagihan telah ditutup di Mayar',
        data: { status: 'ditutup' },
      };
    }

    return {
      success: true,
      message: `Status Mayar saat ini: ${invoice.status}`,
      data: { status: invoice.status },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Gagal menghubungi gateway Mayar',
    };
  }
}

/**
 * Service penutupan tagihan manual oleh Manajer (M5 / M11).
 */
export async function tutupTagihanMayarService(
  tagihanId: string,
  alasan?: string,
  customClient?: MayarClient
): Promise<ServiceResult> {
  const supabase = await createServerClient();
  const client = getMayarClient(customClient);

  // Ambil invoice ID
  const { data: tagihan } = await supabase
    .from('tagihan_mayar')
    .select('mayar_invoice_id')
    .eq('id', tagihanId)
    .single();

  if (tagihan?.mayar_invoice_id) {
    await client.closeInvoice(tagihan.mayar_invoice_id).catch(() => null);
  }

  const caller = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  };

  const { error } = await caller.rpc('rpc_tutup_tagihan_mayar', {
    p_tagihan_id: tagihanId,
    p_alasan: alasan || 'Dibatalkan oleh Manajer',
  });

  if (error) {
    return {
      success: false,
      message: error.message,
      errorCode: error.code,
    };
  }

  return {
    success: true,
    message: 'Tagihan Mayar berhasil ditutup',
  };
}

/**
 * Service pemrosesan Webhook Mayar (M7).
 * Dilindungi token constant-time, idempotensi, verifikasi aktif, dan eksekusi pelunasan via service_role.
 */
export async function prosesWebhookMayarService(
  tokenParam: string,
  bodyRaw: string,
  customClient?: MayarClient
): Promise<{ status: number; message: string }> {
  const expectedToken = process.env.MAYAR_WEBHOOK_TOKEN;

  // 1. Constant-Time Token Verification (M7.1)
  // Gunakan digest SHA-256 untuk menjamin perbandingan waktu konstan meskipun panjang token berbeda
  const tokenParamHash = crypto.createHash('sha256').update(tokenParam || '').digest();
  const expectedTokenHash = crypto.createHash('sha256').update(expectedToken || '').digest();

  if (
    !expectedToken ||
    !tokenParam ||
    !crypto.timingSafeEqual(tokenParamHash, expectedTokenHash)
  ) {
    return { status: 401, message: 'Unauthorized: Token webhook tidak valid' };
  }

  // 1b. Perilaku Fail-Closed di Lingkungan Produksi Tanpa API Key
  if (process.env.NODE_ENV === 'production' && !process.env.MAYAR_API_KEY) {
    return { status: 503, message: 'Layanan Mayar belum dikonfigurasi di lingkungan produksi' };
  }

  // 2. Batas Ukuran Body 100 KB (M7.2)
  if (Buffer.byteLength(bodyRaw, 'utf8') > 100 * 1024) {
    return { status: 413, message: 'Ukuran muatan webhook melebihi batas 100 KB' };
  }

  let payload: {
    event?: string;
    data?: {
      id?: string;
      invoiceId?: string;
      transactionId?: string;
      paymentLinkId?: string;
      status?: string;
      amount?: number;
    };
  };

  try {
    payload = JSON.parse(bodyRaw);
    if (!payload || typeof payload !== 'object') {
      return { status: 400, message: 'Format JSON muatan webhook rusak' };
    }
  } catch {
    return { status: 400, message: 'Format JSON muatan webhook rusak' };
  }

  // 3. Filter Jenis Event: Hanya payment.received yang diproses (M7.3)
  const eventName = payload.event || '';
  if (eventName !== 'payment.received') {
    return { status: 200, message: 'Event diabaikan (hanya payment.received yang diproses)' };
  }

  // 4. Ekstraksi Kandidat ID (M7.4)
  const candidateIds = [
    payload.data?.id,
    payload.data?.invoiceId,
    payload.data?.transactionId,
    payload.data?.paymentLinkId,
  ].filter(Boolean) as string[];

  if (candidateIds.length === 0) {
    return { status: 200, message: 'No Candidate ID Found' };
  }

  // Admin Client HANYA memanggil fungsi rpc_sistem_* (E5)
  const adminClient = createAdminClient();
  const adminCaller = adminClient as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  // 4b. Cari Tagihan di Database
  const { data: tagihanMatches } = await adminCaller.rpc('rpc_sistem_cari_tagihan_mayar', {
    p_candidate_ids: candidateIds,
  });

  const matchingRows = (tagihanMatches || []) as TagihanCariDbRow[];
  if (matchingRows.length === 0) {
    // Rekam tidak dikenal
    await adminCaller.rpc('rpc_sistem_rekam_webhook_event', {
      p_kunci_unik: `unknown_${candidateIds[0]}_${Date.now()}`,
      p_jenis_event: eventName,
      p_referensi_id: candidateIds[0],
      p_hasil: 'tidak_dikenal',
      p_status_mayar: payload.data?.status || null,
      p_jumlah_tercatat: Math.round(Number(payload.data?.amount) || 0),
    });

    return { status: 200, message: 'Tagihan Not Found' };
  }

  const tagihan = matchingRows[0];
  const uniqueKey = `${eventName}_${tagihan.mayar_invoice_id}_${candidateIds.join('_')}`;

  // 4c. Idempotensi Webhook (Kunci event selesai HANYA setelah pelunasan sukses di database)
  const { data: isAlreadyCompleted } = await adminCaller.rpc('rpc_sistem_cek_webhook_event_selesai', {
    p_kunci_unik: uniqueKey,
  });

  if (isAlreadyCompleted) {
    // Event sudah selesai diproses sebelumnya: balas 200 tanpa memproses ulang
    return { status: 200, message: 'Duplicate Event Already Processed' };
  }

  // 5. PEMERIKSAAN ULANG AKTIF KE API MAYAR (M7.5)
  const client = getMayarClient(customClient);
  let verifiedInvoice;

  try {
    verifiedInvoice = await client.getInvoice(tagihan.mayar_invoice_id);
  } catch {
    // Bila server Mayar tidak terjangkau (timeout/network error), balas 500 dan JANGAN tandai selesai agar Mayar mencoba ulang
    return { status: 500, message: 'Gateway Verification Timeout' };
  }

  if (verifiedInvoice.status !== 'paid') {
    return { status: 200, message: 'Invoice Not Paid on Gateway' };
  }

  // 6. Eksekusi Pelunasan Otomatis dan Tandai Event Selesai secara Atomik (M8)
  const { data: lunasRes, error: lunasError } = await adminCaller.rpc('rpc_sistem_lunaskan_dari_mayar', {
    p_tagihan_id: tagihan.id,
    p_referensi_transaksi: verifiedInvoice.transactionId || payload.data?.transactionId || verifiedInvoice.id,
    p_jumlah_terverifikasi: Math.round(verifiedInvoice.amount),
    p_kunci_unik: uniqueKey,
  });

  if (lunasError || !lunasRes) {
    return { status: 500, message: lunasError?.message || 'Database Settlement Error' };
  }

  const resObj = lunasRes as { success: boolean; status: string; message: string };

  return {
    status: 200,
    message: resObj.message || 'Webhook Processed',
  };
}

/**
 * Service pembaca riwayat tagihan Mayar untuk tabel monitoring Manajer (M10 / M11).
 */
export async function ambilRiwayatTagihanMayarService(
  pesananId?: string
): Promise<TagihanMayarRow[]> {
  const supabase = await createServerClient();
  const caller = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: TagihanMayarRow[] | null; error: { message: string } | null }>;
  };

  const { data, error } = await caller.rpc('rpc_riwayat_tagihan_mayar_manajer', {
    p_pesanan_id: pesananId || null,
  });

  if (error || !data) {
    return [];
  }

  return data;
}
