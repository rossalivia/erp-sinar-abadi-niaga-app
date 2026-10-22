import { describe, it, expect } from 'vitest';
import {
  stripBOM,
  detectDelimiter,
  parseStrictInteger,
  parseBarangCsv,
  parsePelangganCsv,
  generateTemplateCsv,
} from '../utils';

describe('Modul Parser & Utilitas Impor CSV (Pure Functions)', () => {
  describe('stripBOM & detectDelimiter', () => {
    it('TC-103: Membersihkan UTF-8 BOM di awal berkas secara transparan', () => {
      const withBOM = '\uFEFFkode,nama,satuan';
      expect(stripBOM(withBOM)).toBe('kode,nama,satuan');
      expect(stripBOM('kode,nama,satuan')).toBe('kode,nama,satuan');
    });

    it('TC-102: Mendeteksi pemisah koma vs titik koma secara presisi', () => {
      expect(detectDelimiter('kode,nama,satuan,harga_jual')).toBe(',');
      expect(detectDelimiter('kode;nama;satuan;harga_jual')).toBe(';');
    });
  });

  describe('parseStrictInteger', () => {
    it('TC-96: Membersihkan pemisah ribuan titik atau koma murni', () => {
      expect(parseStrictInteger('15.000').value).toBe(15000);
      expect(parseStrictInteger('1,000,000').value).toBe(1000000);
      expect(parseStrictInteger('500').value).toBe(500);
      expect(parseStrictInteger('0').value).toBe(0);
      expect(parseStrictInteger('').value).toBeNull();
    });

    it('TC-95: Menolak angka pecahan desimal titik atau koma', () => {
      expect(parseStrictInteger('15000.50').error).toBeDefined();
      expect(parseStrictInteger('15000,50').error).toBeDefined();
      expect(parseStrictInteger('10.000,50').error).toBeDefined();
      expect(parseStrictInteger('10,000.50').error).toBeDefined();
      expect(parseStrictInteger('abc').error).toBeDefined();
    });
  });

  describe('parseBarangCsv', () => {
    it('TC-89 & TC-90: Mem-parsing baris CSV barang valid (lengkap atau tanpa HPP)', () => {
      const csv = [
        'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif',
        'BRG-T1,Gula Pasir 1kg,kg,15.000,12.000,10,50,true',
        'BRG-T2,Garam Halus 250g,bungkus,3000,,5,0,true',
      ].join('\n');

      const res = parseBarangCsv(csv);
      expect(res.valid).toBe(true);
      expect(res.totalBaris).toBe(2);
      expect(res.totalValid).toBe(2);
      expect(res.totalGalat).toBe(0);
      expect(res.data[0]).toEqual({
        kode: 'BRG-T1',
        nama: 'Gula Pasir 1kg',
        satuan: 'kg',
        harga_jual: 15000,
        harga_pokok: 12000,
        stok_minimum: 10,
        stok_awal: 50,
        aktif: true,
      });
      expect(res.data[1].harga_pokok).toBeNull();
      expect(res.data[1].stok_awal).toBe(0);
    });

    it('TC-102: Mem-parsing CSV dengan pemisah titik koma (;)', () => {
      const csv = [
        'kode;nama;satuan;harga_jual;harga_pokok;stok_minimum;stok_awal;aktif',
        'BRG-SEMI;Minyak Goreng 2L;pouch;32000;28000;5;20;true',
      ].join('\n');

      const res = parseBarangCsv(csv);
      expect(res.valid).toBe(true);
      expect(res.totalValid).toBe(1);
      expect(res.data[0].kode).toBe('BRG-SEMI');
      expect(res.data[0].harga_jual).toBe(32000);
    });

    it('TC-92: Menolak kode duplikat di dalam berkas CSV yang sama', () => {
      const csv = [
        'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif',
        'BRG-DUP,Barang Satu,pcs,5000,,0,0,true',
        'BRG-DUP,Barang Dua,pcs,6000,,0,0,true',
      ].join('\n');

      const res = parseBarangCsv(csv);
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0059')).toBe(true);
    });

    it('TC-93: Menolak kode yang sudah ada di database', () => {
      const existing = new Set(['BRG-01', 'BRG-A']);
      const csv = [
        'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif',
        'BRG-01,Tepung Terigu,kg,12000,,0,0,true',
      ].join('\n');

      const res = parseBarangCsv(csv, existing);
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0057')).toBe(true);
    });

    it('TC-94: Menolak harga jual <= 0', () => {
      const csv = [
        'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif',
        'BRG-NOL,Barang Gratis,pcs,0,,0,0,true',
      ].join('\n');

      const res = parseBarangCsv(csv);
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0028')).toBe(true);
    });

    it('TC-98: Menolak header yang tidak cocok atau kolom kurang', () => {
      const csv = 'kode,nama,harga_jual\nBRG-1,Nama,1000';
      const res = parseBarangCsv(csv);
      expect(res.valid).toBe(false);
      expect(res.galat[0].kodeError).toBe('E0053');
    });

    it('TC-99: Menolak berkas CSV kosong atau hanya header', () => {
      const emptyCsv = '';
      const headerOnly = 'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif';
      expect(parseBarangCsv(emptyCsv).galat[0].kodeError).toBe('E0054');
      expect(parseBarangCsv(headerOnly).galat[0].kodeError).toBe('E0054');
    });

    it('TC-100: Menolak berkas melebihi 1.000 baris data', () => {
      const header = 'kode,nama,satuan,harga_jual,harga_pokok,stok_minimum,stok_awal,aktif';
      const rows = [header];
      for (let i = 1; i <= 1001; i++) {
        rows.push(`BRG-${i},Barang ${i},pcs,1000,,0,0,true`);
      }
      const res = parseBarangCsv(rows.join('\n'));
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0055')).toBe(true);
    });
  });

  describe('parsePelangganCsv', () => {
    it('TC-91: Mem-parsing data pelanggan valid', () => {
      const csv = [
        'kode,nama_toko,telepon,alamat,termin_hari,batas_kredit',
        'PLG-V1,Toko Amanah,08123456789,Jl. Merdeka No. 1,14,5000000',
        'PLG-V2,Toko Makmur,,,0,0',
      ].join('\n');

      const res = parsePelangganCsv(csv);
      expect(res.valid).toBe(true);
      expect(res.totalValid).toBe(2);
      expect(res.data[0].termin_hari).toBe(14);
      expect(res.data[0].batas_kredit).toBe(5000000);
      expect(res.data[1].termin_hari).toBe(0);
      expect(res.data[1].telepon).toBeNull();
    });

    it('TC-97: Menolak nilai termin_hari selain 0, 7, 14, 30', () => {
      const csv = [
        'kode,nama_toko,telepon,alamat,termin_hari,batas_kredit',
        'PLG-BAD,Toko Salah Termin,08123456789,Jl. Merdeka,45,1000000',
      ].join('\n');

      const res = parsePelangganCsv(csv);
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0024')).toBe(true);
    });

    it('Menolak batas_kredit negatif', () => {
      const csv = [
        'kode,nama_toko,telepon,alamat,termin_hari,batas_kredit',
        'PLG-NEG,Toko Minus,08123456789,Jl. Merdeka,7,-500000',
      ].join('\n');

      const res = parsePelangganCsv(csv);
      expect(res.valid).toBe(false);
      expect(res.galat.some((g) => g.kodeError === 'E0024')).toBe(true);
    });
  });

  describe('TC-110: generateTemplateCsv', () => {
    it('Templat barang yang dihasilkan dapat diparsing kembali dengan sukses', () => {
      const template = generateTemplateCsv('barang');
      const res = parseBarangCsv(template);
      expect(res.valid).toBe(true);
      expect(res.totalValid).toBe(2);
    });

    it('Templat pelanggan yang dihasilkan dapat diparsing kembali dengan sukses', () => {
      const template = generateTemplateCsv('pelanggan');
      const res = parsePelangganCsv(template);
      expect(res.valid).toBe(true);
      expect(res.totalValid).toBe(2);
    });
  });
});
