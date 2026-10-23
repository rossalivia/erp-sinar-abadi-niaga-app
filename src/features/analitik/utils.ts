/**
 * Sanitasi cell CSV agar aman dari formula injection di spreadsheet (Excel/Calc)
 * sesuai standar keamanan OWASP CSV Injection.
 */
export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }

  let text = String(val);

  // Jika teks berpotensi menjadi formula spreadsheet, tambahkan prefix petik tunggal (')
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  // Escape tanda kutip ganda
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Pembuat string CSV dengan UTF-8 BOM untuk kompatibilitas penuh Microsoft Excel
 */
export function buildSafeCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
}

/**
 * Pemformat tanggal bisnis Asia/Jakarta sederhana
 */
export function formatTanggalWib(tgl: string | null | undefined): string {
  if (!tgl) return '-';
  try {
    const d = new Date(tgl);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '-';
  }
}
