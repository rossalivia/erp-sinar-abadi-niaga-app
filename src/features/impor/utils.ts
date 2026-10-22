import {
  BarangImportRow,
  PelangganImportRow,
  RowError,
  ValidationResult,
} from './types';

/**
 * Menghapus UTF-8 Byte Order Mark (\uFEFF) dari awal string jika ada.
 */
export function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Mendeteksi pemisah CSV (, atau ;) berdasarkan frekuensi kemunculan pada baris header.
 */
export function detectDelimiter(headerLine: string): ',' | ';' {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parser CSV mematuhi RFC 4180 dengan penanganan quotes dan multi-line cell.
 */
export function parseCsvToRows(csvText: string, delimiter: string = ','): string[][] {
  const cleanText = stripBOM(csvText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // lewati escaped quote
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        // Abaikan baris kosong murni
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Tambahkan cell dan row terakhir jika ada
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validasi dan normalisasi angka integer tanpa pecahan desimal.
 * Mendukung pembersih pemisah ribuan (. atau ,) jika polanya tepat ribuan.
 * Menolak tegas angka pecahan desimal (misal 10000.5 atau 10000,5).
 */
export function parseStrictInteger(raw: string | undefined): { value: number | null; error?: string } {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return { value: null };
  }

  const str = raw.trim();

  // Tolak tanda minus di luar angka atau karakter aneh
  if (!/^[-+]?[\d.,]+$/.test(str)) {
    return { value: null, error: 'Nilai harus berupa bilangan bulat tanpa pecahan desimal' };
  }

  // Deteksi desimal dengan koma atau titik pecahan:
  // Kasus 1: Mengandung desimal dengan 1-2 digit atau >=4 digit di ujung (misal 10000.5, 10000,50, 100.5555)
  if (/\d+[.,]\d{1,2}$/.test(str) || /\d+[.,]\d{4,}$/.test(str)) {
    return { value: null, error: 'Nilai harus berupa bilangan bulat tanpa pecahan desimal' };
  }

  // Kasus 2: Kombinasi titik dan koma (misal 10.000,50 atau 10,000.50)
  if (str.includes('.') && str.includes(',')) {
    return { value: null, error: 'Nilai harus berupa bilangan bulat tanpa pecahan desimal' };
  }

  // Normalisasi pemisah ribuan murni (misal 10.000 atau 1.000.000 atau 10,000)
  let cleanStr = str;
  if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(str)) {
    cleanStr = str.replace(/\./g, '');
  } else if (/^[-+]?\d{1,3}(,\d{3})+$/.test(str)) {
    cleanStr = str.replace(/,/g, '');
  }

  // Pastikan sekarang hanya digit
  if (!/^[-+]?\d+$/.test(cleanStr)) {
    return { value: null, error: 'Nilai harus berupa bilangan bulat tanpa pecahan desimal' };
  }

  const num = Number(cleanStr);
  if (!Number.isSafeInteger(num)) {
    return { value: null, error: 'Nilai angka di luar batas yang diperbolehkan' };
  }

  return { value: num };
}

/**
 * Normalisasi boolean (true/false/1/0/ya/tidak/benar/salah).
 */
export function parseBoolean(raw: string | undefined, defaultValue: boolean = true): boolean {
  if (!raw || raw.trim() === '') return defaultValue;
  const val = raw.trim().toLowerCase();
  if (val === 'true' || val === '1' || val === 'ya' || val === 'benar') return true;
  if (val === 'false' || val === '0' || val === 'tidak' || val === 'salah') return false;
  return defaultValue;
}

/**
 * Header resmi untuk templat CSV Barang
 */
export const HEADER_BARANG = [
  'kode',
  'nama',
  'satuan',
  'harga_jual',
  'harga_pokok',
  'stok_minimum',
  'stok_awal',
  'aktif',
];

/**
 * Header resmi untuk templat CSV Pelanggan
 */
export const HEADER_PELANGGAN = [
  'kode',
  'nama_toko',
  'telepon',
  'alamat',
  'termin_hari',
  'batas_kredit',
];

/**
 * Parsing dan Validasi CSV Barang (Dry-Run)
 */
export function parseBarangCsv(
  csvContent: string,
  existingCodes: Set<string> = new Set()
): ValidationResult<BarangImportRow> {
  const galat: RowError[] = [];
  const validData: BarangImportRow[] = [];

  const firstLine = csvContent.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsvToRows(csvContent, delimiter);

  if (rows.length === 0) {
    galat.push({
      baris: 1,
      kolom: 'file',
      kodeError: 'E0054',
      pesan: 'Berkas CSV kosong, tidak ada data untuk diimpor',
    });
    return { valid: false, totalBaris: 0, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  // 1. Validasi Header (Baris 1)
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const headerMatch =
    header.length === HEADER_BARANG.length &&
    HEADER_BARANG.every((col, idx) => header[idx] === col);

  if (!headerMatch) {
    galat.push({
      baris: 1,
      kolom: 'header',
      kodeError: 'E0053',
      pesan: `Header berkas CSV tidak sesuai dengan templat resmi. Header yang diharapkan: ${HEADER_BARANG.join(
        delimiter
      )}`,
    });
    return { valid: false, totalBaris: rows.length - 1, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  const dataRows = rows.slice(1);
  const totalBaris = dataRows.length;

  if (totalBaris === 0) {
    galat.push({
      baris: 1,
      kolom: 'file',
      kodeError: 'E0054',
      pesan: 'Berkas CSV kosong, tidak ada data untuk diimpor',
    });
    return { valid: false, totalBaris: 0, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  if (totalBaris > 1000) {
    galat.push({
      baris: 1001,
      kolom: 'file',
      kodeError: 'E0055',
      pesan: 'Berkas CSV melebihi batas maksimal 1.000 baris data',
    });
    return { valid: false, totalBaris, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  const seenCodes = new Set<string>();

  dataRows.forEach((row, index) => {
    const barisNo = index + 2; // Baris 1 adalah header
    let rowHasError = false;

    const rawKode = row[0] || '';
    const rawNama = row[1] || '';
    const rawSatuan = row[2] || '';
    const rawHargaJual = row[3] || '';
    const rawHargaPokok = row[4] || '';
    const rawStokMin = row[5] || '';
    const rawStokAwal = row[6] || '';
    const rawAktif = row[7] || '';

    // Validasi Kode
    const cleanKode = rawKode.trim().toUpperCase();
    if (!cleanKode) {
      galat.push({
        baris: barisNo,
        kolom: 'kode',
        kodeError: 'E0002',
        pesan: `Baris ${barisNo}: Kolom 'kode' wajib diisi`,
      });
      rowHasError = true;
    } else {
      if (seenCodes.has(cleanKode)) {
        galat.push({
          baris: barisNo,
          kolom: 'kode',
          kodeError: 'E0059',
          pesan: `Baris ${barisNo}: Kode '${cleanKode}' duplikat di dalam berkas CSV ini`,
        });
        rowHasError = true;
      } else {
        seenCodes.add(cleanKode);
      }

      if (existingCodes.has(cleanKode)) {
        galat.push({
          baris: barisNo,
          kolom: 'kode',
          kodeError: 'E0057',
          pesan: `Baris ${barisNo}: Kode '${cleanKode}' sudah terdaftar di sistem`,
        });
        rowHasError = true;
      }
    }

    // Validasi Nama
    const cleanNama = rawNama.trim();
    if (!cleanNama) {
      galat.push({
        baris: barisNo,
        kolom: 'nama',
        kodeError: 'E0002',
        pesan: `Baris ${barisNo}: Kolom 'nama' wajib diisi`,
      });
      rowHasError = true;
    }

    // Validasi Satuan
    const cleanSatuan = rawSatuan.trim();
    if (!cleanSatuan) {
      galat.push({
        baris: barisNo,
        kolom: 'satuan',
        kodeError: 'E0002',
        pesan: `Baris ${barisNo}: Kolom 'satuan' wajib diisi`,
      });
      rowHasError = true;
    }

    // Validasi Harga Jual
    const parsedHargaJual = parseStrictInteger(rawHargaJual);
    if (parsedHargaJual.error || parsedHargaJual.value === null) {
      galat.push({
        baris: barisNo,
        kolom: 'harga_jual',
        kodeError: 'E0058',
        pesan: `Baris ${barisNo}: Kolom 'harga_jual' harus berupa bilangan bulat tanpa pecahan desimal`,
      });
      rowHasError = true;
    } else if (parsedHargaJual.value <= 0) {
      galat.push({
        baris: barisNo,
        kolom: 'harga_jual',
        kodeError: 'E0028',
        pesan: `Baris ${barisNo}: Harga jual harus lebih dari 0`,
      });
      rowHasError = true;
    }

    // Validasi Harga Pokok (Opsional)
    let hargaPokokValue: number | null = null;
    if (rawHargaPokok.trim() !== '') {
      const parsedHpp = parseStrictInteger(rawHargaPokok);
      if (parsedHpp.error || parsedHpp.value === null) {
        galat.push({
          baris: barisNo,
          kolom: 'harga_pokok',
          kodeError: 'E0058',
          pesan: `Baris ${barisNo}: Kolom 'harga_pokok' harus berupa bilangan bulat tanpa pecahan desimal`,
        });
        rowHasError = true;
      } else if (parsedHpp.value < 0) {
        galat.push({
          baris: barisNo,
          kolom: 'harga_pokok',
          kodeError: 'E0028',
          pesan: `Baris ${barisNo}: Harga pokok harus >= 0`,
        });
        rowHasError = true;
      } else {
        hargaPokokValue = parsedHpp.value;
      }
    }

    // Validasi Stok Minimum
    let stokMinValue = 0;
    if (rawStokMin.trim() !== '') {
      const parsedMin = parseStrictInteger(rawStokMin);
      if (parsedMin.error || parsedMin.value === null) {
        galat.push({
          baris: barisNo,
          kolom: 'stok_minimum',
          kodeError: 'E0058',
          pesan: `Baris ${barisNo}: Kolom 'stok_minimum' harus berupa bilangan bulat tanpa pecahan desimal`,
        });
        rowHasError = true;
      } else if (parsedMin.value < 0) {
        galat.push({
          baris: barisNo,
          kolom: 'stok_minimum',
          kodeError: 'E0029',
          pesan: `Baris ${barisNo}: Stok minimum harus bilangan bulat >= 0`,
        });
        rowHasError = true;
      } else {
        stokMinValue = parsedMin.value;
      }
    }

    // Validasi Stok Awal
    let stokAwalValue = 0;
    if (rawStokAwal.trim() !== '') {
      const parsedAwal = parseStrictInteger(rawStokAwal);
      if (parsedAwal.error || parsedAwal.value === null) {
        galat.push({
          baris: barisNo,
          kolom: 'stok_awal',
          kodeError: 'E0058',
          pesan: `Baris ${barisNo}: Kolom 'stok_awal' harus berupa bilangan bulat tanpa pecahan desimal`,
        });
        rowHasError = true;
      } else if (parsedAwal.value < 0) {
        galat.push({
          baris: barisNo,
          kolom: 'stok_awal',
          kodeError: 'E0029',
          pesan: `Baris ${barisNo}: Stok awal harus bilangan bulat >= 0`,
        });
        rowHasError = true;
      } else {
        stokAwalValue = parsedAwal.value;
      }
    }

    const aktifValue = parseBoolean(rawAktif, true);

    if (!rowHasError) {
      validData.push({
        kode: cleanKode,
        nama: cleanNama,
        satuan: cleanSatuan,
        harga_jual: parsedHargaJual.value!,
        harga_pokok: hargaPokokValue,
        stok_minimum: stokMinValue,
        stok_awal: stokAwalValue,
        aktif: aktifValue,
      });
    }
  });

  return {
    valid: galat.length === 0,
    totalBaris,
    totalValid: validData.length,
    totalGalat: galat.length,
    galat,
    data: validData,
  };
}

/**
 * Parsing dan Validasi CSV Pelanggan (Dry-Run)
 */
export function parsePelangganCsv(
  csvContent: string,
  existingCodes: Set<string> = new Set()
): ValidationResult<PelangganImportRow> {
  const galat: RowError[] = [];
  const validData: PelangganImportRow[] = [];

  const firstLine = csvContent.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsvToRows(csvContent, delimiter);

  if (rows.length === 0) {
    galat.push({
      baris: 1,
      kolom: 'file',
      kodeError: 'E0054',
      pesan: 'Berkas CSV kosong, tidak ada data untuk diimpor',
    });
    return { valid: false, totalBaris: 0, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  // 1. Validasi Header (Baris 1)
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const headerMatch =
    header.length === HEADER_PELANGGAN.length &&
    HEADER_PELANGGAN.every((col, idx) => header[idx] === col);

  if (!headerMatch) {
    galat.push({
      baris: 1,
      kolom: 'header',
      kodeError: 'E0053',
      pesan: `Header berkas CSV tidak sesuai dengan templat resmi. Header yang diharapkan: ${HEADER_PELANGGAN.join(
        delimiter
      )}`,
    });
    return { valid: false, totalBaris: rows.length - 1, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  const dataRows = rows.slice(1);
  const totalBaris = dataRows.length;

  if (totalBaris === 0) {
    galat.push({
      baris: 1,
      kolom: 'file',
      kodeError: 'E0054',
      pesan: 'Berkas CSV kosong, tidak ada data untuk diimpor',
    });
    return { valid: false, totalBaris: 0, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  if (totalBaris > 1000) {
    galat.push({
      baris: 1001,
      kolom: 'file',
      kodeError: 'E0055',
      pesan: 'Berkas CSV melebihi batas maksimal 1.000 baris data',
    });
    return { valid: false, totalBaris, totalValid: 0, totalGalat: 1, galat, data: [] };
  }

  const seenCodes = new Set<string>();

  dataRows.forEach((row, index) => {
    const barisNo = index + 2;
    let rowHasError = false;

    const rawKode = row[0] || '';
    const rawNamaToko = row[1] || '';
    const rawTelepon = row[2] || '';
    const rawAlamat = row[3] || '';
    const rawTermin = row[4] || '';
    const rawBatasKredit = row[5] || '';

    // Validasi Kode
    const cleanKode = rawKode.trim().toUpperCase();
    if (!cleanKode) {
      galat.push({
        baris: barisNo,
        kolom: 'kode',
        kodeError: 'E0002',
        pesan: `Baris ${barisNo}: Kolom 'kode' wajib diisi`,
      });
      rowHasError = true;
    } else {
      if (seenCodes.has(cleanKode)) {
        galat.push({
          baris: barisNo,
          kolom: 'kode',
          kodeError: 'E0059',
          pesan: `Baris ${barisNo}: Kode '${cleanKode}' duplikat di dalam berkas CSV ini`,
        });
        rowHasError = true;
      } else {
        seenCodes.add(cleanKode);
      }

      if (existingCodes.has(cleanKode)) {
        galat.push({
          baris: barisNo,
          kolom: 'kode',
          kodeError: 'E0057',
          pesan: `Baris ${barisNo}: Kode '${cleanKode}' sudah terdaftar di sistem`,
        });
        rowHasError = true;
      }
    }

    // Validasi Nama Toko
    const cleanNamaToko = rawNamaToko.trim();
    if (!cleanNamaToko) {
      galat.push({
        baris: barisNo,
        kolom: 'nama_toko',
        kodeError: 'E0002',
        pesan: `Baris ${barisNo}: Kolom 'nama_toko' wajib diisi`,
      });
      rowHasError = true;
    }

    // Validasi Termin Hari
    let terminValue = 0;
    if (rawTermin.trim() !== '') {
      const parsedTermin = parseStrictInteger(rawTermin);
      if (parsedTermin.error || parsedTermin.value === null) {
        galat.push({
          baris: barisNo,
          kolom: 'termin_hari',
          kodeError: 'E0058',
          pesan: `Baris ${barisNo}: Kolom 'termin_hari' harus berupa bilangan bulat tanpa pecahan desimal`,
        });
        rowHasError = true;
      } else if (![0, 7, 14, 30].includes(parsedTermin.value)) {
        galat.push({
          baris: barisNo,
          kolom: 'termin_hari',
          kodeError: 'E0024',
          pesan: `Baris ${barisNo}: Termin hari harus 0, 7, 14, atau 30`,
        });
        rowHasError = true;
      } else {
        terminValue = parsedTermin.value;
      }
    }

    // Validasi Batas Kredit
    let batasKreditValue = 0;
    if (rawBatasKredit.trim() !== '') {
      const parsedKredit = parseStrictInteger(rawBatasKredit);
      if (parsedKredit.error || parsedKredit.value === null) {
        galat.push({
          baris: barisNo,
          kolom: 'batas_kredit',
          kodeError: 'E0058',
          pesan: `Baris ${barisNo}: Kolom 'batas_kredit' harus berupa bilangan bulat tanpa pecahan desimal`,
        });
        rowHasError = true;
      } else if (parsedKredit.value < 0) {
        galat.push({
          baris: barisNo,
          kolom: 'batas_kredit',
          kodeError: 'E0024',
          pesan: `Baris ${barisNo}: Batas kredit harus >= 0`,
        });
        rowHasError = true;
      } else {
        batasKreditValue = parsedKredit.value;
      }
    }

    if (!rowHasError) {
      validData.push({
        kode: cleanKode,
        nama_toko: cleanNamaToko,
        telepon: rawTelepon.trim() || null,
        alamat: rawAlamat.trim() || null,
        termin_hari: terminValue,
        batas_kredit: batasKreditValue,
        aktif: true,
      });
    }
  });

  return {
    valid: galat.length === 0,
    totalBaris,
    totalValid: validData.length,
    totalGalat: galat.length,
    galat,
    data: validData,
  };
}

/**
 * Pembuat string CSV templat resmi
 */
export function generateTemplateCsv(jenis: 'barang' | 'pelanggan'): string {
  if (jenis === 'barang') {
    return [
      HEADER_BARANG.join(','),
      'BRG-CONTOH-01,Beras Pandan Wangi 5kg,karung,75000,65000,10,50,true',
      'BRG-CONTOH-02,Minyak Goreng Botol 1L,botol,17000,,5,0,true',
    ].join('\r\n');
  }

  return [
    HEADER_PELANGGAN.join(','),
    'PLG-CONTOH-01,Toko Berkah Mandiri,081234567890,Pasar Kranji Blok B/12,14,5000000',
    'PLG-CONTOH-02,Warung Sejahtera,081398765432,Jl. Patriot Raya No. 45,7,2000000',
  ].join('\r\n');
}
