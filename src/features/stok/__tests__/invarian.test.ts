import { describe, it, expect } from 'vitest';

interface MutasiMock {
  id: number;
  barang_id: string;
  jenis: 'masuk' | 'keluar' | 'batal' | 'penyesuaian';
  jumlah: number;
  stok_sesudah: number;
}

/**
 * Memverifikasi invarian bisnis:
 * 1. Setiap baris mutasi: stok_sebelum + jumlah_mutasi = stok_sesudah
 * 2. Baris mutasi terakhir (terbaru) stok_sesudah harus tepat sama dengan stok master barang
 * 3. Total mutasi saldo awal + akumulasi seluruh delta = stok master barang
 */
function verifikasiInvarianStok(
  stokMaster: number,
  mutasiListChronological: MutasiMock[]
): { valid: boolean; selisih: number; pesan?: string } {
  if (mutasiListChronological.length === 0) {
    return { valid: stokMaster === 0, selisih: stokMaster };
  }

  let runningStok = 0;
  for (let i = 0; i < mutasiListChronological.length; i++) {
    const m = mutasiListChronological[i];
    if (m.jenis === 'penyesuaian' && i === 0 && m.jumlah === m.stok_sesudah) {
      // Kasus saldo awal: delta = stok_sesudah
      runningStok = m.stok_sesudah;
    } else {
      runningStok += m.jumlah;
    }

    if (runningStok !== m.stok_sesudah) {
      return {
        valid: false,
        selisih: runningStok - m.stok_sesudah,
        pesan: `Inkonsistensi pada mutasi ID ${m.id}: running=${runningStok}, stok_sesudah=${m.stok_sesudah}`,
      };
    }
  }

  const mutasiTerakhir = mutasiListChronological[mutasiListChronological.length - 1];
  const konsistenMaster = mutasiTerakhir.stok_sesudah === stokMaster;

  return {
    valid: konsistenMaster,
    selisih: stokMaster - mutasiTerakhir.stok_sesudah,
    pesan: konsistenMaster
      ? undefined
      : `Stok master (${stokMaster}) berbeda dengan stok_sesudah baris terakhir (${mutasiTerakhir.stok_sesudah})`,
  };
}

describe('Invarian Kartu Mutasi Stok (BR-11)', () => {
  it('memvalidasi invarian beruntun: saldo awal -> keluar SO -> masuk PO -> batal -> penyesuaian opname', () => {
    const barangId = '55555555-5555-4555-8555-555555555555';

    // Rangkaian transaksi simulasi
    const riwayat: MutasiMock[] = [
      { id: 1, barang_id: barangId, jenis: 'penyesuaian', jumlah: 100, stok_sesudah: 100 }, // Saldo awal
      { id: 2, barang_id: barangId, jenis: 'keluar', jumlah: -15, stok_sesudah: 85 },        // Pesanan jual SO-001
      { id: 3, barang_id: barangId, jenis: 'masuk', jumlah: 50, stok_sesudah: 135 },         // Penerimaan PO-001
      { id: 4, barang_id: barangId, jenis: 'batal', jumlah: 5, stok_sesudah: 140 },          // Pembatalan SO (stok kembali)
      { id: 5, barang_id: barangId, jenis: 'penyesuaian', jumlah: -10, stok_sesudah: 130 },  // Opname fisik 130
    ];

    const stokMaster = 130;
    const hasil = verifikasiInvarianStok(stokMaster, riwayat);

    expect(hasil.valid).toBe(true);
    expect(hasil.selisih).toBe(0);
  });

  it('mendeteksi jika stok master tidak konsisten dengan baris mutasi terakhir', () => {
    const barangId = '55555555-5555-4555-8555-555555555555';
    const riwayat: MutasiMock[] = [
      { id: 1, barang_id: barangId, jenis: 'penyesuaian', jumlah: 100, stok_sesudah: 100 },
      { id: 2, barang_id: barangId, jenis: 'keluar', jumlah: -20, stok_sesudah: 80 },
    ];

    // Master menyatakan 85 padahal mutasi terakhir 80
    const stokMaster = 85;
    const hasil = verifikasiInvarianStok(stokMaster, riwayat);

    expect(hasil.valid).toBe(false);
    expect(hasil.selisih).toBe(5);
  });
});
