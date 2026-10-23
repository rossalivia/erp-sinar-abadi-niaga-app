import type { BarangStokMenipis } from './types';

/**
 * Sanitasi string untuk mencegah HTML injection pada klien email.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface EmailTemplateParams {
  items: BarangStokMenipis[];
  tanggalBisnis: string;
  isUji?: boolean;
  isSandbox?: boolean;
  targetRoleSummary?: string;
  appUrl: string;
}

export interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Menghasilkan subjek, HTML, dan Plain Text untuk notifikasi email stok menipis harian.
 * Mematuhi batasan maksimal 100 baris, HTML escaping ketat, dan zero-money guarantee.
 */
export function generateEmailStokMenipis({
  items,
  tanggalBisnis,
  isUji = false,
  isSandbox = false,
  targetRoleSummary = '1 Manajer, 1 Gudang',
  appUrl,
}: EmailTemplateParams): GeneratedEmail {
  const jumlahBarang = items.length;
  const prefix = isUji ? '[UJI] ' : '';
  const subject = `${prefix}[ERP Sinar Abadi] ${jumlahBarang} barang stok menipis (${tanggalBisnis})`;

  const MAX_DISPLAY = 100;
  const displayItems = items.slice(0, MAX_DISPLAY);
  const remainingCount = Math.max(0, jumlahBarang - MAX_DISPLAY);

  // 1. HTML Version
  const bannerHtml = isSandbox
    ? `
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px 16px; margin-bottom: 24px; border-radius: 6px; font-size: 13px; line-height: 1.5;">
        <strong>MODE UJI (SANDBOX):</strong> Email ini seharusnya dikirim ke: <strong>${escapeHtml(targetRoleSummary)}</strong>.
      </div>
    `
    : '';

  const tableRowsHtml = displayItems
    .map((item, idx) => {
      const defisit = item.stok_minimum - item.stok;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <td style="padding: 8px 12px; color: #64748b; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; color: #0f172a;">${escapeHtml(item.kode)}</td>
          <td style="padding: 8px 12px; color: #1e293b;">${escapeHtml(item.nama)}</td>
          <td style="padding: 8px 12px; color: #64748b;">${escapeHtml(item.satuan)}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #b91c1c;">${item.stok}</td>
          <td style="padding: 8px 12px; text-align: right; color: #334155;">${item.stok_minimum}</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #c2410c;">-${defisit}</td>
        </tr>
      `;
    })
    .join('');

  const remainingHtml =
    remainingCount > 0
      ? `
        <tr style="background-color: #f8fafc; font-size: 13px;">
          <td colspan="7" style="padding: 10px 12px; text-align: center; color: #475569; font-style: italic;">
            ... dan <strong>${remainingCount}</strong> barang lainnya dengan stok menipis.
          </td>
        </tr>
      `
      : '';

  const cleanAppUrl = appUrl.replace(/\/+$/, '');
  const linkStok = `${cleanAppUrl}/stok`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px;">
  <div style="max-width: 720px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    ${bannerHtml}

    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">CV Sinar Abadi Niaga</h2>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">Peringatan Stok Barang Menipis Harian — ${escapeHtml(tanggalBisnis)}</p>
    </div>

    <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-bottom: 16px;">
      Yth. Bapak/Ibu Manajer dan Tim Gudang,<br>
      Berikut ini adalah daftar <strong>${jumlahBarang}</strong> barang aktif yang stok fisiknya telah mencapai atau berada di bawah batas minimum (stok &le; stok minimum). Mohon lakukan pengecekan fisik dan perencanaan pengadaan pembelian.
    </p>

    <div style="overflow-x: auto; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 12px; text-transform: uppercase; color: #475569;">
            <th style="padding: 10px 12px; text-align: center;">No</th>
            <th style="padding: 10px 12px;">Kode</th>
            <th style="padding: 10px 12px;">Nama Barang</th>
            <th style="padding: 10px 12px;">Satuan</th>
            <th style="padding: 10px 12px; text-align: right;">Stok</th>
            <th style="padding: 10px 12px; text-align: right;">Min</th>
            <th style="padding: 10px 12px; text-align: right;">Selisih</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${remainingHtml}
        </tbody>
      </table>
    </div>

    <div style="margin-bottom: 28px; text-align: center;">
      <a href="${linkStok}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 6px;">
        Buka Modul Kartu Stok &rarr;
      </a>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5;">
      <p style="margin: 0;">Pesan ini dikirim secara otomatis oleh Sistem ERP CV Sinar Abadi Niaga setiap hari pukul 07.00 WIB.</p>
      <p style="margin: 4px 0 0 0;">Harap tidak membalas email ini secara langsung.</p>
    </div>

  </div>
</body>
</html>
  `.trim();

  // 2. Plain Text Version
  const bannerText = isSandbox
    ? `=== MODE UJI (SANDBOX) ===\nSeharusnya dikirim ke: ${targetRoleSummary}\n===========================\n\n`
    : '';

  const tableRowsText = displayItems
    .map(
      (item, idx) =>
        `${idx + 1}. [${item.kode}] ${item.nama} | Stok: ${item.stok} ${item.satuan} | Min: ${item.stok_minimum} | Defisit: ${item.stok_minimum - item.stok}`
    )
    .join('\n');

  const remainingText =
    remainingCount > 0
      ? `\n... dan ${remainingCount} barang lainnya dengan stok menipis.\n`
      : '';

  const text = `
${bannerText}CV SINAR ABADI NIAGA - PERINGATAN STOK MENIPIS (${tanggalBisnis})
Total Barang Menipis: ${jumlahBarang} barang

DAFTAR BARANG:
${tableRowsText}
${remainingText}

Lihat kartu stok selengkapnya di sistem:
${linkStok}

---
Email otomatis dari Sistem ERP CV Sinar Abadi Niaga (07.00 WIB).
  `.trim();

  return { subject, html, text };
}
