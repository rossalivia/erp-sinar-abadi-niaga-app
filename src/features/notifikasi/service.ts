import { createAdminClient } from '@/lib/supabase/admin';
import {
  ResendEmailSender,
  type EmailSender,
} from './email-sender';
import { generateEmailStokMenipis } from './templates';
import type {
  BarangStokMenipis,
  PenerimaNotifikasi,
  JenisNotifikasi,
  KirimNotifikasiResult,
  EmailMode,
} from './types';

export interface ProsesNotifikasiOptions {
  jenis?: JenisNotifikasi;
  emailSender?: EmailSender;
  tanggalBisnis?: string;
  forceAppUrl?: string;
}

/**
 * Mendapatkan tanggal bisnis hari ini dalam format YYYY-MM-DD zona waktu Asia/Jakarta.
 */
export function getTanggalBisnisJakarta(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(now);
}

/**
 * Logika orkestrasi pengiriman email notifikasi stok menipis harian / pengujian.
 * Menjalankan klaim basis data (idempotensi), penarikan data via RPC sistem,
 * pembuatan isi email ter-escape, dan pengiriman via EmailSender.
 */
export async function prosesNotifikasiStokHarian(
  options: ProsesNotifikasiOptions = {}
): Promise<KirimNotifikasiResult> {
  const jenis = options.jenis || 'stok_menipis';
  const tanggalBisnis = options.tanggalBisnis || getTanggalBisnisJakarta();

  const emailMode = (process.env.EMAIL_MODE?.toLowerCase() || 'sandbox') as EmailMode;
  const emailSandboxTo = process.env.EMAIL_SANDBOX_TO;
  const emailFrom = process.env.EMAIL_FROM;
  const resendApiKey = process.env.RESEND_API_KEY;
  const appUrl =
    options.forceAppUrl ||
    process.env.APP_URL ||
    process.env.URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000';

interface RpcKlaimRow {
  boleh_kirim: boolean;
  log_id: string;
  pesan: string | null;
}

interface RpcBarangRow {
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  selisih: number;
}

interface RpcPenerimaRow {
  email: string;
  nama_lengkap: string;
  peran: string;
}

interface AdminRpcCaller {
  rpc: <T = unknown>(
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: T | null; error: { message: string } | null }>;
}

  // Inisialisasi Klien Admin (service_role)
  const adminSupabase = createAdminClient();
  const adminRpc = adminSupabase as unknown as AdminRpcCaller;

  // 1. Klaim Notifikasi di Database (Idempotensi / Rate limit)
  const { data: klaimData, error: klaimError } = await adminRpc.rpc<RpcKlaimRow[]>(
    'rpc_sistem_klaim_notifikasi',
    {
      p_jenis: jenis,
      p_tanggal_bisnis: tanggalBisnis,
    }
  );

  if (klaimError || !klaimData || klaimData.length === 0) {
    const errText = klaimError?.message || 'Gagal melakukan klaim notifikasi di database';
    return {
      success: false,
      message: errText,
    };
  }

  const klaim = klaimData[0];
  if (!klaim.boleh_kirim) {
    return {
      success: false,
      message: klaim.pesan || 'Klaim notifikasi ditolak oleh sistem',
      logId: klaim.log_id,
    };
  }

  const logId: string = klaim.log_id;

  try {
    // 2. Ambil Daftar Barang Stok Menipis (HANYA kolom non-uang)
    const { data: itemsRaw, error: itemsError } = await adminRpc.rpc<RpcBarangRow[]>(
      'rpc_sistem_daftar_stok_menipis'
    );

    if (itemsError) {
      throw new Error(`Gagal membaca daftar stok menipis: ${itemsError.message}`);
    }

    const items: BarangStokMenipis[] = (itemsRaw || []).map((it: RpcBarangRow) => ({
      kode: it.kode,
      nama: it.nama,
      satuan: it.satuan,
      stok: Number(it.stok),
      stok_minimum: Number(it.stok_minimum),
      selisih: Number(it.selisih),
    }));

    // Jika tidak ada barang yang stoknya menipis: catat 'dilewati', tidak kirim email (E1)
    if (items.length === 0) {
      await adminRpc.rpc('rpc_sistem_selesaikan_notifikasi', {
        p_log_id: logId,
        p_status: 'dilewati',
        p_jumlah_barang: 0,
        p_jumlah_penerima: 0,
        p_galat: 'Tidak ada barang dengan stok menipis',
      });

      return {
        success: true,
        message: 'Dilewati: Tidak ada barang dengan stok menipis pada hari ini',
        logId,
        status: 'dilewati',
        jumlahBarang: 0,
        jumlahPenerima: 0,
      };
    }

    // 3. Ambil Daftar Penerima (Manajer & Gudang aktif) (E2)
    const { data: recipientsRaw, error: recipientsError } = await adminRpc.rpc<RpcPenerimaRow[]>(
      'rpc_sistem_penerima_notifikasi_stok'
    );

    if (recipientsError) {
      throw new Error(`Gagal membaca daftar penerima email: ${recipientsError.message}`);
    }

    const recipients: PenerimaNotifikasi[] = (recipientsRaw || []).map((r: RpcPenerimaRow) => ({
      email: r.email,
      nama_lengkap: r.nama_lengkap,
      peran: r.peran,
    }));

    if (recipients.length === 0) {
      await adminRpc.rpc('rpc_sistem_selesaikan_notifikasi', {
        p_log_id: logId,
        p_status: 'dilewati',
        p_jumlah_barang: items.length,
        p_jumlah_penerima: 0,
        p_galat: 'Tidak ada akun Manajer atau Gudang aktif dengan email valid',
      });

      return {
        success: true,
        message: 'Dilewati: Tidak ada akun Manajer atau Gudang aktif yang memiliki email',
        logId,
        status: 'dilewati',
        jumlahBarang: items.length,
        jumlahPenerima: 0,
      };
    }

    // 4. Validasi Konfigurasi Lingkungan Pengiriman Email (E8)
    if (emailMode === 'sandbox' && !emailSandboxTo) {
      throw new Error('EMAIL_SANDBOX_TO wajib dikonfigurasi saat EMAIL_MODE=sandbox');
    }

    if (emailMode === 'live' && !emailFrom) {
      throw new Error('EMAIL_FROM wajib dikonfigurasi saat EMAIL_MODE=live');
    }

    // Inisialisasi Pengirim Email
    const sender =
      options.emailSender ||
      new ResendEmailSender(resendApiKey || '');

    const manajerCount = recipients.filter((r) => r.peran === 'manajer').length;
    const gudangCount = recipients.filter((r) => r.peran === 'gudang').length;
    const targetRoleSummary = `${manajerCount} Manajer, ${gudangCount} Staf Gudang (${recipients.length} penerima)`;

    // 5. Eksekusi Pengiriman Berdasarkan Mode
    if (emailMode === 'sandbox') {
      // Mode Sandbox: kirim 1 email ke EMAIL_SANDBOX_TO dengan banner
      const emailContent = generateEmailStokMenipis({
        items,
        tanggalBisnis,
        isUji: jenis === 'uji',
        isSandbox: true,
        targetRoleSummary,
        appUrl,
      });

      await sender.send({
        from: 'onboarding@resend.dev',
        to: [emailSandboxTo!],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `stok-menipis/${tanggalBisnis}/${emailSandboxTo}-${jenis}`,
      });
    } else {
      // Mode Live: kirim email terpisah ke setiap penerima asli
      for (const recipient of recipients) {
        const emailContent = generateEmailStokMenipis({
          items,
          tanggalBisnis,
          isUji: jenis === 'uji',
          isSandbox: false,
          appUrl,
        });

        await sender.send({
          from: emailFrom!,
          to: [recipient.email],
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          idempotencyKey: `stok-menipis/${tanggalBisnis}/${recipient.email}-${jenis}`,
        });
      }
    }

    // 6. Tandai Log sebagai 'terkirim'
    await adminRpc.rpc('rpc_sistem_selesaikan_notifikasi', {
      p_log_id: logId,
      p_status: 'terkirim',
      p_jumlah_barang: items.length,
      p_jumlah_penerima: recipients.length,
      p_galat: null,
    });

    return {
      success: true,
      message: `Berhasil mengirim notifikasi stok menipis (${items.length} barang, ${recipients.length} penerima)`,
      logId,
      status: 'terkirim',
      jumlahBarang: items.length,
      jumlahPenerima: recipients.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kegagalan saat pengiriman email';

    // Perbarui status log menjadi 'gagal' agar dapat diulang (retryable)
    try {
      await adminRpc.rpc('rpc_sistem_selesaikan_notifikasi', {
        p_log_id: logId,
        p_status: 'gagal',
        p_jumlah_barang: 0,
        p_jumlah_penerima: 0,
        p_galat: errorMsg.slice(0, 250),
      });
    } catch {
      // Abaikan jika pencatatan gagal gagal
    }

    return {
      success: false,
      message: errorMsg,
      logId,
      status: 'gagal',
    };
  }
}
