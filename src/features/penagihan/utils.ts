import { formatRupiah } from '@/lib/format';
import { TagihanItem, RingkasanPenagihan, TemplatWaParams } from './types';

/**
 * Normalisasi nomor telepon Indonesia untuk tautan WhatsApp.
 * - Membuang spasi, tanda hubung, titik, kurung, dan karakter non-digit.
 * - Mengubah 08xx menjadi 628xx.
 * - Mempertahankan awalan +62 dan 62.
 * - Valid jika 9–15 digit dan berawalan nomor seluler Indonesia (628).
 */
export function normalisasiNomorTelepon(telepon: string | null | undefined): {
  valid: boolean;
  nomor: string;
  pesanError?: string;
} {
  if (!telepon || typeof telepon !== 'string' || telepon.trim() === '') {
    return {
      valid: false,
      nomor: '',
      pesanError: 'Nomor telepon tidak tersedia',
    };
  }

  // Buang karakter format non-digit selain awalan +
  let cleaned = telepon.trim().replace(/[\s\-\.\(\)]/g, '');

  if (cleaned.startsWith('+62')) {
    cleaned = '62' + cleaned.slice(3);
  } else if (cleaned.startsWith('08')) {
    cleaned = '628' + cleaned.slice(2);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Hanya boleh berisi digit angka
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      nomor: cleaned,
      pesanError: 'Nomor telepon mengandung karakter tidak valid',
    };
  }

  // Pengecekan panjang digit standar internasional E.164 (9-15 digit)
  if (cleaned.length < 9 || cleaned.length > 15) {
    return {
      valid: false,
      nomor: cleaned,
      pesanError: `Panjang nomor telepon tidak valid (${cleaned.length} digit, wajib 9-15 digit)`,
    };
  }

  // Nomor seluler WhatsApp Indonesia wajib diawali 628
  if (!cleaned.startsWith('628')) {
    return {
      valid: false,
      nomor: cleaned,
      pesanError: 'Nomor telepon bukan nomor seluler WhatsApp yang valid (wajib diawali 08 atau +628)',
    };
  }

  return {
    valid: true,
    nomor: cleaned,
  };
}

/**
 * Membuat draf pesan WhatsApp resmi mengatasnamakan CV Sinar Abadi Niaga.
 */
export function buatPesanWhatsApp(
  jenis: 'menjelang' | 'hari_ini' | 'terlambat',
  params: TemplatWaParams
): string {
  const fakturLines = params.fakturList
    .map(
      (f) =>
        `- ${f.nomor}: ${formatRupiah(f.total)} (Jatuh tempo: ${f.jatuhTempo})`
    )
    .join('\n');

  if (jenis === 'menjelang') {
    return (
      `Halo *${params.namaToko}*,\n\n` +
      `Kami dari *CV Sinar Abadi Niaga* ingin menginformasikan tagihan pesanan Anda yang akan jatuh tempo:\n` +
      `${fakturLines}\n\n` +
      `*Total tagihan: ${formatRupiah(params.totalTertagih)}*\n\n` +
      `Mohon kesediaannya untuk mempersiapkan pembayaran tepat waktu. Terima kasih.`
    );
  }

  if (jenis === 'hari_ini') {
    return (
      `Halo *${params.namaToko}*,\n\n` +
      `Kami dari *CV Sinar Abadi Niaga* ingin menginformasikan bahwa tagihan pesanan Anda jatuh tempo *HARI INI*:\n` +
      `${fakturLines}\n\n` +
      `*Total tagihan: ${formatRupiah(params.totalTertagih)}*\n\n` +
      `Mohon kesediaannya untuk melakukan pembayaran hari ini. Terima kasih.`
    );
  }

  // jenis === 'terlambat'
  return (
    `Halo *${params.namaToko}*,\n\n` +
    `Kami dari *CV Sinar Abadi Niaga* ingin mengonfirmasikan pembayaran tagihan pesanan Anda yang telah *melewati jatuh tempo*:\n` +
    `${fakturLines}\n\n` +
    `*Total tagihan menunggak: ${formatRupiah(params.totalTertagih)}*\n\n` +
    `Mohon bantuannya untuk segera melakukan penyelesaian pembayaran. Terima kasih.`
  );
}

/**
 * Menghasilkan tautan siap kirim WhatsApp Web / Mobile.
 */
export function buatUrlWhatsApp(nomor: string, teks: string): string {
  return `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`;
}

/**
 * Menghitung ringkasan KPI tagihan.
 */
export function hitungRingkasanTagihan(items: TagihanItem[]): RingkasanPenagihan {
  let totalTertagih = 0;
  let totalOverdue = 0;
  let jumlahHariIni = 0;
  let jumlahSegera = 0;
  let jumlahOverdue = 0;

  for (const item of items) {
    totalTertagih += item.total;

    if (item.klasifikasi.startsWith('overdue')) {
      totalOverdue += item.total;
      jumlahOverdue += 1;
    } else if (item.klasifikasi === 'hari_ini') {
      jumlahHariIni += 1;
    } else if (item.klasifikasi === 'segera') {
      jumlahSegera += 1;
    }
  }

  return {
    totalTertagih,
    totalOverdue,
    jumlahHariIni,
    jumlahSegera,
    jumlahOverdue,
    totalFaktur: items.length,
  };
}
