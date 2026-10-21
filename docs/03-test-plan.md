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

## 4. Daftar Test Case & Hasil Verifikasi Rilis

| ID | BR/Requirement | Peran | Lapisan Uji | Status | Tgl Eksekusi | Bukti Pengujian | Catatan Verifikasi |
|---|---|---|---|---|---|---|---|
| **TC-01** | Auth: wajib masuk, sign-up mati, noindex | Anonim | UI + SQL | **Lulus** | 2026-10-21 | `tests/e2e/01-auth-noindex.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`src/middleware.ts` | Redirect `/` ke `/login` via middleware; header `X-Robots-Tag: noindex, nofollow` terpasang; `public/robots.txt` Disallow `/`. |
| **TC-02** | Auth: akun nonaktif | PX | UI + SQL | **Lulus** | 2026-10-21 | `tests/e2e/01-auth-noindex.spec.ts`<br>`supabase/tests/02_keamanan.sql` | Akun nonaktif ditolak masuk, menampilkan pesan E30 (`Akun Anda tidak aktif. Hubungi Manajer.`), sesi dibersihkan. |
| **TC-03** | BR-12: kolom rahasia via column grant | P1 | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`supabase/migrations/20261021120400_grants.sql` | `harga_pokok` pada barang & `hpp_satuan` pada item pesanan tidak di-grant ke authenticated. Query `select *` gagal; UI & network payload bersih dari nilai rahasia. |
| **TC-04** | BR-12: view manajer & laporan | P1, G, M | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql` | View manajer (`v_barang_manajer`, dll) menghasilkan 0 baris untuk non-manajer via RLS. RPC laporan mingguan ditolak E01 untuk Penjualan/Gudang. Route `/laporan` diarahkan ke `/tidak-berwenang`. |
| **TC-05** | BR-12: data pembelian | G, P1 | SQL + UI | **Lulus** | 2026-10-21 | `tests/e2e/02-keamanan-data-rahasia.spec.ts`<br>`supabase/tests/02_keamanan.sql` | Staf Penjualan diblokir dari `/pembelian`. Staf Gudang dapat melihat daftar PO namun `harga_beli_satuan` tidak di-grant (tidak ada kolom harga beli di UI maupun payload Gudang). |
| **TC-06** | RBAC: eskalasi peran | P1, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql`<br>`src/features/akun/actions.ts` | Penjualan tidak dapat UPDATE `peran` di `profiles` (trigger mencegah dan menghasilkan E25). RPC `ubah_peran` hanya dapat dipanggil Manajer. Manajer terakhir dicegah mengubah perannya sendiri (E26). |
| **TC-07** | BR-01: kode unik, harga, stok_minimum | M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/barang/__tests__/schemas.test.ts` | Kode barang case-insensitive unik (E27), harga jual > 0 (E28), stok minimum bilangan bulat >= 0 (E29). |
| **TC-08** | BR-01: stok hanya via mutasi | M, G | SQL | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/migrations/20261021120200_trigger_guard.sql` | Direct UPDATE ke kolom `barang.stok` diblokir (kolom tidak di-grant UPDATE, dan dijaga trigger cadangan E22). |
| **TC-09** | BR-01: hak ubah barang per peran, stok menipis | G, P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/barang/actions.ts` | Gudang dapat mengubah atribut non-harga (`nama`, `satuan`, `stok_minimum`, `aktif`), namun ditolak saat mengubah `harga_jual` (E23). Penjualan ditolak UPDATE barang via RLS. Status stok menipis aktif saat `stok <= stok_minimum`. |
| **TC-10** | BR-02: 1–20 baris | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/__tests__/utils.test.ts` | Pembuatan pesanan menghasilkan nomor `SO-YYYY-NNNNNN`. Konfirmasi pesanan dengan 0 baris atau > 20 baris ditolak dengan E03. |
| **TC-11** | BR-02: jumlah, duplikat, status aktif | P1, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Item pesanan dengan jumlah 0 ditolak (E04), barang duplikat dalam satu draf ditolak (E05), barang nonaktif ditolak (E06), pelanggan nonaktif ditolak (E07). |
| **TC-12** | BR-03: harga otomatis & pembulatan; BR-02 ubah hanya draf | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/__tests__/utils.test.ts` | Harga satuan diambil dari `barang.harga_jual` (input manual diabaikan). Subtotal dihitung dengan pembulatan rupiah `ROUND()`. Pesanan berstatus bukan draf ditolak saat diedit (E08). |
| **TC-13** | BR-03: batas diskon per peran | P1, M | SQL + Unit + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Diskon staf Penjualan dibatasi 0% s.d. 10% (E09). Diskon Manajer dibatasi 0% s.d. 25% (E10). UI menampilkan batasan input dinamis sesuai peran pengguna aktif. |
| **TC-14** | BR-04: Penjualan ditolak di bawah HPP | P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Jika harga efektif item pesanan < HPP barang, konfirmasi oleh Penjualan ditolak E11 (`Harga di bawah batas, minta persetujuan Manajer`). Error message tidak membocorkan angka nominal HPP. |
| **TC-15** | BR-04: Manajer boleh konfirmasi; snapshot HPP | M | SQL | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql` | Manajer dapat mengonfirmasi pesanan di bawah HPP. HPP satuan dibekukan (snapshot) pada saat konfirmasi ke tabel `item_pesanan_jual.hpp_satuan`. |
| **TC-16** | BR-05: batas kredit (+ konkurensi) | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`supabase/tests/03_konkurensi.sh` | Konfirmasi pesanan yang menyebabkan total piutang melebihi `batas_kredit` ditolak E12. Pengujian konkurensi paralel (20 iterasi) berhasil mengunci pelanggan (`FOR UPDATE`) tanpa ada piutang melebihi batas kredit. |
| **TC-17** | BR-05: tagihan lewat jatuh tempo | P1 | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Pelanggan yang memiliki pesanan berstatus dikirim dan telah melewati tanggal `jatuh_tempo` ditolak konfirmasi pesanan barunya dengan E13. |
| **TC-18** | BR-05: batas kredit awal Rp0, termin & kredit hanya Manajer | P1, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/pelanggan/__tests__/schemas.test.ts` | Pelanggan baru yang dibuat oleh Staf Penjualan otomatis memiliki `batas_kredit = 0` dan `termin_hari = 14`. Upaya non-Manajer mengubah batas kredit/termin ditolak E24. Perubahan oleh Manajer dicatat di `audit_log`. |
| **TC-19** | BR-06: race condition stok | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_konkurensi.sh` (Skenario 1) | Dua transaksi konfirmasi paralel memperebutkan stok 1 unit barang: 1 transaksi berhasil mengurangi stok menjadi 0, transaksi kedua gagal bersih dengan pesan E14 (`Stok tidak cukup untuk barang {kode}`). Stok tidak pernah negatif. |
| **TC-20** | BR-06: atomik multi-baris & tanpa deadlock | P1, P2 | SQL + Shell | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`supabase/tests/03_konkurensi.sh` (Skenario 3) | Transaksi multi-baris dieksekusi atomik. Penguncian baris barang selalu diurutkan berdasarkan `barang_id ASC`, sehingga transaksi multi-baris paralel bebas dari deadlock (`SQLSTATE 40P01`). |
| **TC-21** | BR-07: kirim & lunas | G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Staf Gudang mengeksekusi RPC `kirim_pesanan` (mengisi `dikirim_pada` dan menghitung `jatuh_tempo`). Manajer mengeksekusi RPC `lunasi_pesanan` (mengisi `dilunasi_pada` dan mencatat `audit_log`). |
| **TC-22** | BR-07: transisi ilegal & kepemilikan | P1, P2, G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Transisi status yang tidak sesuai state machine ditolak E15. Staf Penjualan tidak dapat memanipulasi draf staf lain (E02 via RLS). Tombol aksi di UI hanya tampil sesuai status dan peran aktif. |
| **TC-23** | BR-08: batal pesanan dikonfirmasi | P1, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pesanan/actions.ts` | Hanya Manajer yang dapat membatalkan pesanan dikonfirmasi. Wajib menyertakan alasan minimal 10 karakter (E16). Stok barang otomatis dipulihkan (+qty) dengan jenis mutasi `batal`, tercatat di `audit_log`. |
| **TC-24** | BR-09: ajukan PO | P1, G | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Hanya Staf Gudang yang dapat mengajukan PO pembelian. Jumlah pembelian divalidasi antara 1 s.d. 10.000 (E17). Menghasilkan nomor `PO-YYYY-NNNNNN`. |
| **TC-25** | BR-09: setujui / tolak PO | G, M | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/__tests__/schemas.test.ts` | Hanya Manajer yang dapat menyetujui atau menolak PO. Penyetujuan wajib mengisi harga beli > 0 (E18). Penolakan wajib mengisi alasan minimal 10 karakter (E16). Seluruh keputusan dicatat di `audit_log`. |
| **TC-26** | BR-10: penerimaan barang | G, M | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/03_rpc.sql`<br>`src/features/pembelian/actions.ts` | Penerimaan barang hanya dapat dilakukan pada PO disetujui (E19). Jumlah diterima 1 s.d. jumlah dipesan (E20). Stok bertambah, mutasi `masuk` tercatat, dan `barang.harga_pokok` diperbarui ke harga beli PO terbaru. |
| **TC-27** | BR-11: penyesuaian & rekonsiliasi kartu stok | P1, G | SQL + Unit + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`src/features/stok/__tests__/invarian.test.ts`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Penyesuaian stok fisik oleh Staf Gudang wajib mengisi alasan minimal 10 karakter (E16). Stok hasil penyesuaian tidak boleh negatif (E21). Selisih mutasi dicatat bernomor `ADJ-YYYY-NNNNNN`. Invarian kartu stok terpenuhi: `SUM(mutasi_stok.jumlah) = barang.stok`. |
| **TC-28** | BR-12: audit log | M, P1, G | SQL + UI | **Lulus** | 2026-10-21 | `supabase/tests/02_keamanan.sql`<br>`supabase/tests/03_rpc.sql`<br>`tests/e2e/03-alur-transaksi.spec.ts` | Seluruh 7 mutasi penting (`ubah_harga_jual`, `ubah_batas_kredit`, `ubah_termin_pelanggan`, `ubah_peran`, `setujui_pembelian`, `tolak_pembelian`, `batalkan_pesanan`, `sesuaikan_stok`, `lunasi_pesanan`) mencatat baris audit log dengan nilai lama dan nilai baru. Hanya Manajer yang memiliki hak SELECT ke `audit_log`. INSERT/UPDATE/DELETE langsung ditolak. |

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
| BR-13 | TC-29, TC-30, TC-34, TC-36 | TC-16, TC-37, TC-39 |
| BR-14 | TC-31, TC-32, TC-33, TC-35 | TC-17, TC-37, TC-40 |

---

## 7. Test Case Tambahan: Modul Limit Kredit Dinamis & Blokir Otomatis (TC-29 s.d. TC-40)

| ID | Fokus Uji | Aktor | Media | Status | Tanggal Uji | Bukti Uji | Ringkasan Verifikasi & Hasil |
|---|---|---|---|---|---|---|---|
| **TC-29** | BR-13: Nilai pesanan = sisa kredit persis (D7) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Pesanan baru bernilai tepat sama dengan sisa plafon kredit pelanggan berhasil dikonfirmasi tanpa error. |
| **TC-30** | BR-13: Nilai pesanan melampaui sisa plafon kredit (D7) | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql`<br>`src/features/pelanggan/__tests__/kredit.test.ts` | Konfirmasi pesanan yang membuat total piutang melebihi batas kredit ditolak bersih dengan pesan `E0006: Batas kredit pelanggan terlampaui`. |
| **TC-31** | BR-14: Ada faktur overdue sisa kredit cukup (D4) | P1 | SQL + Unit | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql`<br>`src/features/pelanggan/__tests__/kredit.test.ts` | Meskipun sisa limit kredit masih tersedia, konfirmasi pesanan ditolak dengan pesan `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir`. |
| **TC-32** | BR-14: Prioritas D4 (Overdue & Overlimit sekaligus) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Saat kedua kondisi pelanggaran terpenuhi sekaligus, sistem konsisten mengevaluasi dan memunculkan error overdue `E0007` terlebih dahulu. |
| **TC-33** | BR-14: Batas tanggal jatuh tempo hari ini (D2) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Pesanan berstatus `dikirim` dengan `jatuh_tempo = (now() AT TIME ZONE 'Asia/Jakarta')::date` belum dianggap lewat jatuh tempo; pesanan baru dapat dikonfirmasi. |
| **TC-34** | BR-13: Dikonfirmasi belum dikirim masuk piutang (D1) | P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Pesanan berstatus `dikonfirmasi` mengurangi sisa plafon kredit namun tidak memicu blokir overdue. |
| **TC-35** | BR-14: Pelunasan faktur overdue membuka blokir (Alur B2) | M, P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Manajer melunasi faktur menunggak via `rpc_catat_pelunasan`, status pelanggan kembali `boleh_transaksi = true` dan pesanan berikutnya sukses. |
| **TC-36** | BR-13: Penaikan limit kredit membuka blokir overlimit (Alur B1) | M, P1 | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Manajer menaikkan batas kredit via `rpc_set_batas_kredit`, pesanan yang sebelumnya melebihi limit langsung dapat dikonfirmasi. |
| **TC-37** | BR-13/14: Non-bypassable untuk Manajer (D5) | M | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | Manajer yang mencoba langsung mengonfirmasi pesanan pelanggan bermasalah kredit tetap diblokir oleh `rpc_konfirmasi_pesanan`. Override hanya legal melalui B1/B2. |
| **TC-38** | Kerahasiaan data view & RPC baru (Zero Leakage) | P1, G | SQL | **Lulus** | 2026-10-21 | `supabase/tests/04_kredit_overdue.sql` | View `v_pelanggan_kredit` dan RPC `rpc_get_faktur_overdue_pelanggan` bebas dari kolom rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`). |
| **TC-39** | UI Pesanan Editor: Panel Dinamis & Alert Live | P1 | UI / E2E | **Lulus** | 2026-10-21 | `tests/e2e/04-kredit-overdue.spec.ts` | Form editor pesanan menampilkan 4 kartu ringkasan kredit, estimasi sisa plafon live, banner alert saat overlimit/overdue, dan tombol draf tetap aktif (D3). |
| **TC-40** | UI Detail Pelanggan: Rincian Piutang & Tabel Overdue | P1, M | UI / E2E | **Lulus** | 2026-10-21 | `tests/e2e/04-kredit-overdue.spec.ts` | Halaman `/pelanggan/[id]` merender rincian terkonfirmasi vs terkirim, serta Tabel Faktur Overdue lengkap dengan tombol pelunasan khusus Manajer. |

