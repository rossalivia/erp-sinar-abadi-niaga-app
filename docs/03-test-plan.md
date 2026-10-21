# 03 — Test Plan (28 Test Case)

Rujukan: [00-spesifikasi.md](00-spesifikasi.md), [02-matriks-akses.md](02-matriks-akses.md), [04-asumsi-dan-celah.md](04-asumsi-dan-celah.md).

## 1. Ketentuan Umum
- Setiap TC dijalankan pada database hasil `supabase db reset` + **seed uji** (fixture di bawah), kecuali disebut lain.
- **Lapisan SQL**: dijalankan via `psql`/SQL editor dengan `set role authenticated` + `set request.jwt.claims` sesuai akun, atau via REST/RPC dengan JWT akun uji. **Lapisan UI**: dijalankan di browser terhadap aplikasi Next.js.
- Hasil yang diharapkan berupa pesan error ditulis **persis** (lihat katalog §3). Pesan dikembalikan oleh `RAISE EXCEPTION` di RPC/trigger.
- Tanggal "hari ini" = `(now() AT TIME ZONE 'Asia/Jakarta')::date`.

## 2. Fixture Data Uji

| Kode | Data |
|---|---|
| **P1**, **P2** | `penjualan1@sinarabadi.test`, `penjualan2@sinarabadi.test`, peran penjualan, aktif |
| **G** | `gudang@sinarabadi.test`, peran gudang, aktif |
| **M** | `manajer@sinarabadi.test`, peran manajer, aktif (satu-satunya Manajer) |
| **PX** | `nonaktif@sinarabadi.test`, peran penjualan, `aktif = false` |
| **BRG-A** | harga_jual 10.000, harga_pokok 8.000, stok 100, stok_minimum 10, aktif |
| **BRG-B** | harga_jual 15.000, harga_pokok 14.000, stok 1, stok_minimum 5, aktif |
| **BRG-C** | harga_jual 5.000, harga_pokok 4.000, stok 20, **nonaktif** |
| **BRG-D** | harga_jual 3.333, harga_pokok **NULL**, stok 50, aktif |
| **BRG-T01..T21** | 21 barang aktif, harga_jual 1.000, harga_pokok 500, stok 100 (untuk uji batas baris) |
| **PLG-1** | batas_kredit 1.000.000, termin 14, tanpa pesanan berjalan |
| **PLG-2** | batas_kredit 500.000, termin 7, piutang berjalan 450.000 (1 pesanan dikonfirmasi) |
| **PLG-3** | batas_kredit 5.000.000, termin 7, punya 1 pesanan **dikirim** dengan jatuh_tempo = kemarin |
| **PLG-4** | **nonaktif** |
| **PLG-5** | batas_kredit 5.000.000, termin 30, tanpa pesanan berjalan |
| **PMS-1** | pemasok aktif |
| Saldo awal | Setiap stok awal tercatat sebagai `mutasi_stok` jenis `penyesuaian` bernomor `SALDO-AWAL` |

## 3. Katalog Pesan Error

| Kode | Pesan persis |
|---|---|
| E01 | `Akses ditolak` |
| E02 | `Pesanan tidak ditemukan` |
| E03 | `Pesanan harus berisi 1 sampai 20 baris` |
| E04 | `Jumlah minimal 1` |
| E05 | `Barang sudah ada di pesanan ini` |
| E06 | `Barang tidak aktif` |
| E07 | `Pelanggan tidak aktif` |
| E08 | `Pesanan hanya bisa diubah saat berstatus draf` |
| E09 | `Diskon harus 0% sampai 10%` |
| E10 | `Diskon harus 0% sampai 25%` |
| E11 | `Harga di bawah batas, minta persetujuan Manajer` |
| E12 | `Batas kredit pelanggan terlampaui` |
| E13 | `Pelanggan memiliki tagihan lewat jatuh tempo` |
| E14 | `Stok tidak cukup untuk barang {kode}` |
| E15 | `Perpindahan status tidak diizinkan` |
| E16 | `Alasan minimal 10 karakter` |
| E17 | `Jumlah pembelian harus 1 sampai 10.000` |
| E18 | `Harga beli harus lebih dari 0` |
| E19 | `Pembelian tidak dalam status disetujui` |
| E20 | `Jumlah diterima harus 1 sampai jumlah dipesan` |
| E21 | `Stok hasil penyesuaian tidak boleh negatif` |
| E22 | `Stok hanya dapat diubah melalui transaksi mutasi` |
| E23 | `Hanya Manajer yang dapat mengubah harga` |
| E24 | `Hanya Manajer yang dapat mengubah batas kredit atau termin bayar` |
| E25 | `Hanya Manajer yang dapat mengubah peran atau status akun` |
| E26 | `Minimal harus ada satu Manajer aktif` |
| E27 | `Kode barang sudah digunakan` |
| E28 | `Harga jual harus lebih dari 0` |
| E29 | `Stok minimum harus bilangan bulat >= 0` |
| E30 | `Akun Anda tidak aktif. Hubungi Manajer.` (UI) |
| PG | `permission denied for table {tabel}` (Postgres native, SQLSTATE 42501) |

Urutan validasi `konfirmasi_pesanan`: (1) akses/kepemilikan → E01/E02, (2) status draf → E15, (3) jumlah baris → E03, (4) pelanggan & barang aktif → E07/E06, (5) diskon sesuai peran pengonfirmasi → E09, (6) BR-04 → E11, (7) jatuh tempo → E13, (8) batas kredit → E12, (9) stok → E14.

## 4. Daftar Test Case

| ID | BR/Requirement | Peran | Prasyarat data | Langkah | Hasil diharapkan | Lapisan uji | Status |
|---|---|---|---|---|---|---|---|
| **TC-01** | Auth: wajib masuk, sign-up mati, noindex | Anonim | Tidak ada sesi | 1. Buka `/dashboard`.<br>2. `GET /rest/v1/barang?select=id` dengan anon key saja.<br>3. Panggil `auth.signUp` dengan email baru.<br>4. `curl -I` halaman `/masuk`. | 1. Diarahkan ke `/masuk`, tanpa tautan daftar.<br>2. Error PG (`permission denied for table barang`).<br>3. Ditolak: `Signups not allowed for this instance`.<br>4. Header `X-Robots-Tag: noindex` dan meta `robots` berisi `noindex`. | UI + SQL | Lulus (SQL: `02_keamanan.sql` TC-01a/b; UI: Tahap 4) |
| **TC-02** | Auth: akun nonaktif | PX | PX `aktif = false` | 1. Masuk sebagai PX lewat `/masuk`.<br>2. Dengan JWT PX yang masih berlaku: `select id from pelanggan`.<br>3. `rpc buat_pesanan(PLG-1)`. | 1. Ditolak, tampil E30, sesi dihapus.<br>2. 0 baris.<br>3. E01 `Akses ditolak`. | UI + SQL | Lulus (SQL: `02_keamanan.sql` TC-02 & `03_rpc.sql`; UI: Tahap 4) |
| **TC-03** | BR-12: kolom rahasia via column grant | P1 | Fixture | 1. `select harga_pokok from barang`.<br>2. `select * from barang`.<br>3. `select hpp_satuan from item_pesanan_jual`.<br>4. `select id, kode, harga_jual, stok from barang`.<br>5. Buka `/barang`, periksa payload jaringan. | 1–3. Error PG (`permission denied for table barang` / `item_pesanan_jual`).<br>4. Baris tampil tanpa kolom rahasia.<br>5. Payload tidak memuat key `harga_pokok`/`hpp_satuan`, dan kolom harga pokok tidak dirender. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-03a/b/c; UI: Tahap 4) |
| **TC-04** | BR-12: view manajer & laporan | P1, G, M | Fixture + 1 pesanan dikonfirmasi | 1. Sebagai P1 & G: `select * from v_barang_manajer`, `v_item_pesanan_manajer`, `v_pembelian_manajer`.<br>2. Sebagai P1: `rpc laporan_mingguan()`.<br>3. Sebagai M: ulangi langkah 1. | 1. 0 baris untuk setiap view.<br>2. E01 `Akses ditolak`.<br>3. Baris tampil lengkap dengan `harga_pokok`, `hpp_satuan`, `harga_beli_satuan`. | SQL | Lulus (SQL: `02_keamanan.sql` TC-04a-e & `03_rpc.sql` TC-04f/g) |
| **TC-05** | BR-12: data pembelian | G, P1 | 1 PO disetujui (harga beli 9.500) | 1. G: `select harga_beli_satuan from pembelian`.<br>2. G: `select id, nomor, status, jumlah_dipesan from pembelian`.<br>3. P1: `select id from pembelian`.<br>4. P1 buka `/pembelian`.<br>5. G buka `/pembelian`, periksa payload. | 1. Error PG `permission denied for table pembelian`.<br>2. Baris tampil.<br>3. 0 baris.<br>4. Diarahkan ke `/dashboard`.<br>5. Payload tanpa `harga_beli_satuan`, dan angka 9500 tidak muncul. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-03b, TC-04b; UI: Tahap 4) |
| **TC-06** | RBAC: eskalasi peran | P1, M | M satu-satunya Manajer | 1. P1: `update profiles set peran='manajer' where id = auth.uid()`.<br>2. P1: `rpc ubah_peran(P2, 'manajer')`.<br>3. P1 buka `/pengaturan/akun`.<br>4. M: `rpc ubah_peran(P2, 'gudang')`.<br>5. M: `rpc ubah_peran(M, 'penjualan')`. | 1. E25 `Hanya Manajer yang dapat mengubah peran atau status akun`.<br>2. E01.<br>3. Diarahkan ke `/dashboard`.<br>4. Sukses; audit_log `ubah_peran` dengan nilai_lama `{"peran":"penjualan"}` dan nilai_baru `{"peran":"gudang"}`.<br>5. E26 `Minimal harus ada satu Manajer aktif`. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-06 & `03_rpc.sql`; UI: Tahap 4) |
| **TC-07** | BR-01: kode unik, harga, stok_minimum | M | BRG-A ada | 1. `rpc buat_barang(kode='BRG-A', …)`.<br>2. `buat_barang(kode='BRG-X', harga_jual=0)`.<br>3. `buat_barang(kode='BRG-X', harga_jual=1000, stok_minimum=-1)`.<br>4. `buat_barang(kode='BRG-X', harga_jual=1000, stok_minimum=5)`. | 1. E27 `Kode barang sudah digunakan` (juga untuk `brg-a`, tidak peka huruf besar/kecil).<br>2. E28 `Harga jual harus lebih dari 0`.<br>3. E29 `Stok minimum harus bilangan bulat >= 0`.<br>4. Sukses, stok = 0, tanpa mutasi. | SQL | Lulus (SQL: `03_rpc.sql` TC-07a/b/c/d) |
| **TC-08** | BR-01: stok hanya via mutasi | M, G | BRG-A stok 100 | 1. M: `update barang set stok = 999 where kode='BRG-A'`.<br>2. G: idem.<br>3. M: `PATCH /rest/v1/barang?kode=eq.BRG-A` body `{"stok":999}`. | 1–3. Error PG `permission denied for table barang` (kolom `stok` tidak di-grant UPDATE). Bila grant terbuka, trigger cadangan memberi E22 `Stok hanya dapat diubah melalui transaksi mutasi`. Stok tetap 100 dan tidak ada mutasi baru. | SQL | Lulus (SQL: `02_keamanan.sql` TC-08) |
| **TC-09** | BR-01: hak ubah barang per peran, stok menipis | G, P1 | BRG-A | 1. G: ubah `nama, satuan, stok_minimum=100, aktif` BRG-A.<br>2. Cek `v_barang.stok_menipis` BRG-A.<br>3. G: `update barang set harga_jual=12000`.<br>4. G: `rpc buat_barang(...)`.<br>5. P1: `update barang set nama='X'`. | 1. Sukses.<br>2. `true` (stok 100 ≤ minimum 100), label "Stok menipis" tampil di UI.<br>3. E23 `Hanya Manajer yang dapat mengubah harga`.<br>4. E01.<br>5. 0 baris terpengaruh (RLS), data tidak berubah. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-09a/b; UI: Tahap 4) |
| **TC-10** | BR-02: 1–20 baris | P1 | PLG-1, BRG-T01..T21 | 1. `rpc buat_pesanan(PLG-1)`.<br>2. `konfirmasi_pesanan` tanpa baris.<br>3. Tambah 20 baris (T01..T20).<br>4. Tambah baris ke-21 (T21). | 1. Draf dengan nomor format `SO-2026-NNNNNN`.<br>2. E03 `Pesanan harus berisi 1 sampai 20 baris`.<br>3. Sukses, 20 baris.<br>4. E03, baris tetap 20. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-10; UI: Tahap 4) |
| **TC-11** | BR-02: jumlah, duplikat, status aktif | P1, M | PLG-1, PLG-4, BRG-A, BRG-C | 1. Draf PLG-1: simpan BRG-A jumlah 0.<br>2. Simpan BRG-A jumlah 2, lalu BRG-A lagi.<br>3. Simpan BRG-C.<br>4. `buat_pesanan(PLG-4)`.<br>5. M menonaktifkan PLG-1, lalu P1 konfirmasi draf langkah 2. | 1. E04 `Jumlah minimal 1`.<br>2. E05 `Barang sudah ada di pesanan ini`.<br>3. E06 `Barang tidak aktif`.<br>4. E07 `Pelanggan tidak aktif`.<br>5. E07, status tetap draf. | SQL | Lulus (SQL: `03_rpc.sql` TC-11a/b/c/d) |
| **TC-12** | BR-03: harga otomatis & pembulatan; BR-02 ubah hanya draf | P1 | PLG-1, BRG-D (3.333) | 1. Simpan BRG-D jumlah 3 diskon 7,5 (kirim juga `harga_satuan=1` di body RPC/REST).<br>2. Cek baris & total.<br>3. Konfirmasi.<br>4. Simpan/ubah baris lagi. | 1. Parameter harga diabaikan/ditolak.<br>2. `harga_satuan = 3333`, `subtotal = 9249` (9.999 × 92,5% = 9.249,075, dibulatkan), `total = 9249`.<br>3. Status dikonfirmasi.<br>4. E08 `Pesanan hanya bisa diubah saat berstatus draf`. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-12a/b; UI: Tahap 4) |
| **TC-13** | BR-03: batas diskon per peran | P1, M | Draf PLG-1, BRG-A | 1. P1 diskon 10.<br>2. P1 diskon 10,01 dan 11.<br>3. P1 diskon -1.<br>4. M diskon 25.<br>5. M diskon 25,01 dan 26. | 1. Sukses, subtotal 9.000 untuk jumlah 1.<br>2. E09 `Diskon harus 0% sampai 10%`.<br>3. E09.<br>4. Sukses.<br>5. E10 `Diskon harus 0% sampai 25%`. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-13a/b; UI: Tahap 4) |
| **TC-14** | BR-04: P ditolak di bawah HPP | P1 | Draf PLG-1: BRG-B jumlah 1 diskon 10 (subtotal 13.500 < HPP 14.000) | 1. P1 `konfirmasi_pesanan`.<br>2. Periksa teks error lengkap (termasuk `detail`/`hint`) & respons UI.<br>3. Cek stok BRG-B & status. | 1. E11 `Harga di bawah batas, minta persetujuan Manajer`.<br>2. Tidak memuat angka `14000`/`14.000`/selisih, dan `detail`/`hint` kosong.<br>3. Stok tetap 1, status draf, tidak ada mutasi. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-14; UI: Tahap 4) |
| **TC-15** | BR-04: M boleh konfirmasi; snapshot HPP | M | Draf sama dengan TC-14 | 1. M `konfirmasi_pesanan` draf P1.<br>2. M `select hpp_satuan from v_item_pesanan_manajer`.<br>3. Terima PO baru BRG-B dengan harga beli 16.000, lalu cek ulang langkah 2. | 1. Sukses, status dikonfirmasi, stok BRG-B 0, mutasi `keluar` −1.<br>2. `hpp_satuan = 14000`.<br>3. Tetap 14000 (snapshot tidak berubah). | SQL | Lulus (SQL: `03_rpc.sql` TC-15) |
| **TC-16** | BR-05: batas kredit (+ konkurensi) | P1, P2 | PLG-2 (batas 500.000, piutang 450.000) | 1. Draf PLG-2: BRG-A ×6 (60.000), konfirmasi.<br>2. Ubah ke ×5 (50.000), konfirmasi.<br>3. Reset. Dua draf PLG-2 masing-masing 40.000 (P1 & P2), konfirmasi bersamaan dari 2 sesi. | 1. E12 `Batas kredit pelanggan terlampaui`.<br>2. Sukses (500.000 = batas, diizinkan).<br>3. Satu sukses, satu E12. Piutang akhir 490.000 ≤ 500.000. | SQL | Lulus (SQL: `03_rpc.sql` TC-16 & `03_konkurensi.sh` Skenario 2 20/20 PASS) |
| **TC-17** | BR-05: tagihan lewat jatuh tempo | P1 | PLG-3 (dikirim, jatuh_tempo kemarin) | 1. Draf PLG-3 BRG-A ×1, konfirmasi.<br>2. Ubah jatuh_tempo pesanan lama (via seed) = hari ini, konfirmasi lagi. | 1. E13 `Pelanggan memiliki tagihan lewat jatuh tempo`.<br>2. Sukses (jatuh tempo hari ini belum lewat). | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-17; UI: Tahap 4) |
| **TC-18** | BR-05: batas kredit awal Rp0, termin & kredit hanya Manajer | P1, M | — | 1. P1 insert pelanggan baru dengan `batas_kredit = 2000000` dan `termin_hari = 14`.<br>2. P1 `update pelanggan set batas_kredit=100000`.<br>3. P1 `update pelanggan set termin_hari=30`.<br>4. P1 draf pelanggan baru BRG-A ×1, konfirmasi.<br>5. M ubah batas_kredit = 1.000.000 & termin_hari = 30, lalu P1 konfirmasi ulang. | 1. Tersimpan dengan `batas_kredit = 0` dan `termin_hari = 14`.<br>2–3. E24 `Hanya Manajer yang dapat mengubah batas kredit atau termin bayar`.<br>4. E12.<br>5. Sukses; audit_log mencatat `ubah_batas_kredit` (nilai_lama 0, nilai_baru 1000000) dan `ubah_termin_pelanggan` (nilai_lama 14, nilai_baru 30). | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-18a & `03_rpc.sql` TC-18a; UI: Tahap 4) |
| **TC-19** | BR-06: race condition stok | P1, P2 | BRG-B stok 1; draf X (P1, PLG-1) & Y (P2, PLG-5) masing-masing BRG-B ×1 diskon 0 | 1. Sesi A: `begin; select konfirmasi_pesanan(X);` (belum commit).<br>2. Sesi B: `select konfirmasi_pesanan(Y);`, harus menunggu.<br>3. Sesi A `commit`. | 2. Sesi B terblokir (lock).<br>3. A sukses. B gagal dengan E14 `Stok tidak cukup untuk barang BRG-B`. Stok akhir 0 (tidak minus), tepat 1 mutasi `keluar`, Y tetap draf. | SQL | Lulus (SQL & Konkurensi: `03_konkurensi.sh` Skenario 1 20/20 PASS) |
| **TC-20** | BR-06: atomik multi-baris & tanpa deadlock | P1, P2 | BRG-A 100, BRG-B 1 | 1. Draf: BRG-A ×5, BRG-B ×2, konfirmasi.<br>2. Dua draf berisi BRG-A & BRG-T01 dengan urutan input terbalik, konfirmasi bersamaan dari 2 sesi. | 1. E14 `Stok tidak cukup untuk barang BRG-B`. Stok BRG-A tetap 100, tidak ada mutasi, status draf.<br>2. Keduanya sukses, tidak ada error deadlock (SQLSTATE 40P01). | SQL | Lulus (SQL: `03_rpc.sql` & `03_konkurensi.sh` Skenario 3 20/20 PASS) |
| **TC-21** | BR-07: kirim & lunas | G, M | Pesanan dikonfirmasi PLG-1 (termin 14) | 1. G `kirim_pesanan`.<br>2. Cek kolom & stok.<br>3. M `lunasi_pesanan`. | 1. Status dikirim, `dikirim_pada` terisi.<br>2. `jatuh_tempo = (dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date + 14`. Stok tidak berubah, tidak ada mutasi baru.<br>3. Status lunas, `dilunasi_pada` terisi, audit_log `lunasi_pesanan`. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-21a/b; UI: Tahap 4) |
| **TC-22** | BR-07: transisi ilegal & kepemilikan | P1, P2, G, M | Draf D1 (P1), D2 (P2), pesanan dikonfirmasi K, dikirim S, lunas L | 1. M `kirim_pesanan(D1)`.<br>2. M `lunasi_pesanan(K)`.<br>3. P1 `kirim_pesanan(K)`.<br>4. G `lunasi_pesanan(S)`.<br>5. M `batalkan_pesanan(S, alasan valid)` dan `(L, …)`.<br>6. P1 `konfirmasi_pesanan(D2)`; G `kirim_pesanan(D1)`.<br>7. P1 `batalkan_pesanan(D1)`. | 1–2. E15 `Perpindahan status tidak diizinkan`.<br>3–4. E01 `Akses ditolak`.<br>5. E15.<br>6. E02 `Pesanan tidak ditemukan` (tidak terlihat via RLS).<br>7. Sukses, D1 dibatalkan tanpa alasan wajib, tanpa mutasi stok. Tombol yang tidak berlaku tidak tampil di UI. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-22 & RLS; UI: Tahap 4) |
| **TC-23** | BR-08: batal pesanan dikonfirmasi | P1, M | Pesanan K (P1): BRG-A ×5, stok BRG-A 95 | 1. P1 `batalkan_pesanan(K, 'Pelanggan batal pesan')`.<br>2. M alasan `'Batal aja'` (9 karakter) dan `'          '` (10 spasi).<br>3. M alasan `'Pelanggan batal pesan'`. | 1. E01.<br>2. E16 `Alasan minimal 10 karakter`.<br>3. Status dibatalkan, `alasan_batal` & `dibatalkan_pada` terisi, stok BRG-A 100, mutasi `batal` +5 `stok_sesudah` 100, audit_log `batalkan_pesanan` (nilai_lama status dikonfirmasi). | SQL | Lulus (SQL: `03_rpc.sql` TC-23a/b; UI: Tahap 4) |
| **TC-24** | BR-09: ajukan PO | P1, G | PMS-1, BRG-A | 1. P1 `ajukan_pembelian(PMS-1, BRG-A, 10)`.<br>2. G jumlah 0.<br>3. G jumlah 10001.<br>4. G jumlah 10000.<br>5. G jumlah 100. | 1. E01.<br>2–3. E17 `Jumlah pembelian harus 1 sampai 10.000`.<br>4–5. Sukses, status `diajukan`, nomor format `PO-2026-NNNNNN`, `diajukan_oleh = G`. | SQL + UI | Lulus (SQL: `03_rpc.sql` TC-24; UI: Tahap 4) |
| **TC-25** | BR-09: setujui / tolak PO | G, M | PO1, PO2 status diajukan | 1. G `putuskan_pembelian(PO1, setujui, 9500)`.<br>2. M setujui PO1 harga 0.<br>3. M tolak PO2 alasan `'mahal'`.<br>4. M setujui PO1 harga 9.500.<br>5. M tolak PO2 alasan `'Harga pemasok terlalu tinggi'`.<br>6. M setujui PO2 lagi. | 1. E01.<br>2. E18 `Harga beli harus lebih dari 0`.<br>3. E16.<br>4. Status disetujui, `diputuskan_oleh/pada` terisi, audit `setujui_pembelian`.<br>5. Status ditolak, `alasan_tolak` terisi, audit `tolak_pembelian`.<br>6. E15 `Perpindahan status tidak diizinkan`. | SQL | Lulus (SQL: `03_rpc.sql` TC-25a/b; UI: Tahap 4) |
| **TC-26** | BR-10: penerimaan barang | G, M | PO1 disetujui (BRG-A ×100, 9.500), PO3 diajukan, stok BRG-A 100, harga_pokok 8.000 | 1. G `terima_pembelian(PO3, 10)`.<br>2. G `terima_pembelian(PO1, 0)` dan `(PO1, 101)`.<br>3. G `terima_pembelian(PO1, 80)`.<br>4. M cek `v_barang_manajer` BRG-A.<br>5. G `terima_pembelian(PO1, 10)` lagi. | 1. E19 `Pembelian tidak dalam status disetujui`.<br>2. E20 `Jumlah diterima harus 1 sampai jumlah dipesan`.<br>3. Status diterima, `jumlah_diterima` 80, stok 180, mutasi `masuk` +80 `stok_sesudah` 180 dengan nomor PO1.<br>4. `harga_pokok = 9500`.<br>5. E19, stok tetap 180. | SQL | Lulus (SQL: `03_rpc.sql` TC-26a/b; UI: Tahap 4) |
| **TC-27** | BR-11: penyesuaian & rekonsiliasi kartu stok | P1, G | BRG-A stok 100 | 1. P1 `sesuaikan_stok(BRG-A, 95, 'Hitung fisik bulanan')`.<br>2. G alasan `'hitung'`.<br>3. G stok fisik −1.<br>4. G stok fisik 95 alasan `'Hitung fisik bulanan'`.<br>5. Jalankan query rekonsiliasi: Σ `mutasi_stok.jumlah` per barang dibandingkan `barang.stok`. | 1. E01.<br>2. E16.<br>3. E21 `Stok hasil penyesuaian tidak boleh negatif`.<br>4. Stok 95, mutasi `penyesuaian` −5 `stok_sesudah` 95 nomor `ADJ-2026-NNNNNN`, audit `sesuaikan_stok`. Kartu stok tampil di UI.<br>5. 0 baris selisih untuk semua barang. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-27a/b & `03_rpc.sql` TC-27a/b; UI: Tahap 4) |
| **TC-28** | BR-12: audit log | M, P1, G | Setelah aksi: ubah harga jual, ubah batas kredit, ubah peran, setujui & tolak PO, batal pesanan dikonfirmasi, penyesuaian, pelunasan | 1. M `select aksi, nilai_lama, nilai_baru from audit_log`.<br>2. P1 & G `select id from audit_log`.<br>3. P1 `insert into audit_log …`.<br>4. M `update audit_log …` / `delete from audit_log`. | 1. Ada ≥1 baris untuk setiap aksi: `ubah_harga_jual`, `ubah_batas_kredit`, `ubah_peran`, `setujui_pembelian`, `tolak_pembelian`, `batalkan_pesanan`, `sesuaikan_stok`, `lunasi_pesanan`, dengan `pelaku_id`, `nilai_lama`, `nilai_baru` terisi.<br>2. 0 baris.<br>3–4. Error PG `permission denied for table audit_log`. | SQL + UI | Lulus (SQL: `02_keamanan.sql` TC-28a/b & `03_rpc.sql` TC-28; UI: Tahap 4) |

## 5. Rekap Distribusi

| Kategori | TC | Jumlah |
|---|---|---|
| Auth, RBAC & kerahasiaan data | TC-01 – TC-06 | 6 |
| Data master (BR-01) | TC-07 – TC-09 | 3 |
| Pesanan & harga/diskon (BR-02, BR-03) | TC-10 – TC-13 | 4 |
| Harga di bawah HPP (BR-04) | TC-14 – TC-15 | 2 |
| Kredit & jatuh tempo (BR-05) | TC-16 – TC-18 | 3 |
| Race condition (BR-06) | TC-19 – TC-20 | 2 |
| Alur status & pembatalan (BR-07, BR-08) | TC-21 – TC-23 | 3 |
| PO & penerimaan (BR-09, BR-10) | TC-24 – TC-26 | 3 |
| Kartu stok & audit log (BR-11, BR-12) | TC-27 – TC-28 | 2 |
| **Total** | | **28** |

## 6. Keterlacakan BR → TC

| BR | TC utama | TC pendukung |
|---|---|---|
| BR-01 | TC-07, TC-08, TC-09 | TC-26, TC-27 (stok berubah hanya lewat mutasi) |
| BR-02 | TC-10, TC-11 | TC-12 (ubah hanya saat draf) |
| BR-03 | TC-12, TC-13 | — |
| BR-04 | TC-14, TC-15 | — |
| BR-05 | TC-16, TC-17, TC-18 | — |
| BR-06 | TC-19, TC-20 | TC-16 (kunci pelanggan) |
| BR-07 | TC-21, TC-22 | — |
| BR-08 | TC-23 | TC-22 (dikirim/lunas tidak bisa dibatalkan) |
| BR-09 | TC-24, TC-25 | — |
| BR-10 | TC-26 | TC-15 |
| BR-11 | TC-27 | TC-15, TC-20, TC-23, TC-26 (mutasi tercatat) |
| BR-12 | TC-03, TC-04, TC-05, TC-28 | TC-06, TC-18, TC-23, TC-25 (audit) |
