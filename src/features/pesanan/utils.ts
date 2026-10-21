/**
 * Utilitas perhitungan matematika Pesanan Jual sesuai BR-03
 * Formula: round((jumlah * harga_satuan * (100 - diskon) / 100.0), 0)
 * Pembulatan: Half-away-from-zero (sesuai fungsi ROUND() PostgreSQL)
 */

export function hitungSubtotal(
  jumlah: number,
  hargaSatuan: number,
  diskonPersen: number = 0
): number {
  if (!jumlah || jumlah < 1 || !hargaSatuan || hargaSatuan <= 0) {
    return 0;
  }

  const diskon = Math.max(0, Number(diskonPersen) || 0);
  const nominalBersih = (Number(jumlah) * Number(hargaSatuan) * (100 - diskon)) / 100;

  // Tangani floating point precision sebelum pembulatan ke bilangan bulat terdekat
  // toFixed(6) menjamin precision aman dari binary floating error (misal 5547.499999999999)
  const presisi = Number(nominalBersih.toFixed(6));
  return Math.round(presisi);
}

export function hitungTotalPesanan(
  items: Array<{ jumlah: number; harga_satuan: number; diskon_persen?: number }>
): number {
  return items.reduce((total, item) => {
    return total + hitungSubtotal(item.jumlah, item.harga_satuan, item.diskon_persen ?? 0);
  }, 0);
}
