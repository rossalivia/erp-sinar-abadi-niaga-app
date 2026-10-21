# Spesifikasi Fungsional: Modul Limit Kredit Dinamis & Blokir Otomatis (Credit & Overdue Control)

## 1. Tujuan & Fungsi Utama
Fitur ini dirancang untuk melindungi arus kas (cash flow) perusahaan dari risiko piutang macet (bad debt) dengan cara melakukan validasi otomatis terhadap status keuangan pelanggan sebelum transaksi penjualan dikonfirmasi.
Sistem akan secara proaktif menolak pembuatan atau konfirmasi pesanan jual jika pelanggan melanggar salah satu dari dua aturan utama:
1. Plafon Kredit Terlampaui: Total piutang berjalan ditambah pesanan baru melebihi batas kredit (batas_kredit) yang disetujui.
2. Faktur Lewat Jatuh Tempo (Overdue): Pelanggan memiliki tagihan yang melewati batas termin pembayaran (termin_hari) yang belum dilunasi, meskipun sisa plafon kreditnya masih ada.

## 2. Definisi Aturan Bisnis (Business Rules)
* Sisa Kredit (sisa_kredit): Dihitung secara real-time dengan rumus: Sisa Kredit = Batas Kredit - Piutang Berjalan (Di mana Piutang Berjalan adalah akumulasi total pesanan berstatus dikirim yang belum lunas).
* Status Jatuh Tempo (Overdue): Faktur berstatus dikirim yang tanggal hari ini (CURRENT_DATE) > jatuh_tempo.

## 3. Userflow (Alur Pengguna)
### A. Alur bagi Staf Penjualan (Sales) saat Membuat Pesanan
1. Pembuatan Draf: Staf Penjualan memilih pelanggan pada halaman /pesanan/baru dan memasukkan daftar barang serta jumlah pesanan.
2. Validasi Awal (Client-side / Zod): Sistem menampilkan informasi live kepada Penjualan berupa:
   * Plafon Batas Kredit Pelanggan.
   * Total Piutang Saat Ini.
   * Sisa Plafon Kredit yang tersedia.
   * Peringatan visual jika pelanggan memiliki faktur lewat jatuh tempo (Overdue Alert).
3. Pengajuan Konfirmasi (rpc_konfirmasi_pesanan):
   * Saat Penjualan menekan tombol "Konfirmasi Pesanan", database Supabase menjalankan pemeriksaan backend.
   * Skenario 1 (Gagal - Melebihi Plafon): Jika Total Pesanan > Sisa Kredit, database menolak transaksi dengan pesan: "E0006: Batas kredit pelanggan terlampaui".
   * Skenario 2 (Gagal - Ada Faktur Terlambat): Jika pelanggan memiliki minimal 1 faktur overdue, database menolak transaksi dengan pesan: "E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir".
   * Skenario 3 (Berhasil): Jika aman, pesanan berubah status menjadi dikonfirmasi dan stok berkurang.

### B. Alur Penanganan oleh Manajer (Manager Override)
Jika transaksi seorang pelanggan diblokir karena batas kredit atau faktur overdue, Staf Penjualan tidak dapat memaksakan transaksi tersebut kecuali melalui intervensi Manajer:
1. Peningkatan Batas Kredit: Manajer membuka detail pelanggan (/pelanggan/[id]) lalu menaikkan batas_kredit melalui fungsi rpc_set_batas_kredit (tercatat di log audit).
2. Pelunasan Tagihan Lewat Tempo: Manajer atau bagian keuangan mencatat pelunasan faktur lama yang menunggak melalui aksi rpc_catat_pelunasan sehingga status overdue hilang.
3. Setelah penyesuaian oleh Manajer tersebut, Staf Penjualan dapat kembali mengonfirmasi pesanan dengan sukses.
