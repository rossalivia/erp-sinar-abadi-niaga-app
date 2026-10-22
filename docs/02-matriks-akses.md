# 02 — Matriks Akses

Rujukan: [00-spesifikasi.md](00-spesifikasi.md), keputusan di [04-asumsi-dan-celah.md](04-asumsi-dan-celah.md).

## Legenda

| Kode | Arti |
|---|---|
| **P** / **G** / **M** | Staf Penjualan / Staf Gudang / Manajer |
| ✅ | Diizinkan |
| ⚠️ | Diizinkan dengan batasan (lihat catatan) |
| ❌ | Ditolak |
| **RLS** | Row Level Security policy (memakai helper `peran_saya()`, yang mengembalikan NULL bila akun nonaktif) |
| **CG** | Column-level grant (`REVOKE`/`GRANT` per kolom ke role `authenticated`) |
| **TG** | Trigger guard `BEFORE INSERT/UPDATE` yang memeriksa peran dan kolom yang berubah |
| **RPC** | Fungsi `SECURITY DEFINER` dengan cek peran, status, dan aturan bisnis |
| **VW** | View: publik (`security_invoker = true`) atau manajer (`WHERE peran_saya() = 'manajer'`) |
| **CK** | CHECK / UNIQUE / FK constraint |
| **MW** | Middleware Next.js (route guard, hanya untuk UX; bukan pengaman utama) |

> [!IMPORTANT]
> Prinsip: **penegak utama selalu di database** (RLS/CG/TG/RPC/CK). MW dan penyembunyian tombol hanya untuk UX. Role `anon` tidak mendapat grant apa pun ke tabel, view, atau RPC aplikasi.

---

## A. Matriks Peran × Tabel

Kolom rahasia: `barang.harga_pokok`, `pembelian.harga_beli_satuan`, `item_pesanan_jual.hpp_satuan`. Ketiganya **dicabut seluruhnya** (SELECT/INSERT/UPDATE) dari `authenticated` lewat CG. Manajer membacanya hanya lewat `v_*_manajer` dan menulisnya hanya lewat RPC.

| Tabel | Operasi | P | G | M | Kolom baca/tulis & catatan | Lapisan penegak |
|---|---|---|---|---|---|---|
| **profiles** | SELECT | ✅ | ✅ | ✅ | `id, nama_lengkap, peran, aktif, dibuat_pada` (untuk menampilkan nama pelaku) | RLS, CG |
| | INSERT | ❌ | ❌ | ❌ | Hanya oleh trigger `handle_new_user` dari `auth.users` (peran default `penjualan`) | CG (tanpa grant INSERT), trigger |
| | UPDATE | ⚠️ | ⚠️ | ⚠️ | P/G/M: hanya `nama_lengkap` baris sendiri. `peran`, `aktif` hanya via RPC `ubah_peran` / `ubah_status_akun` (M) | RLS (`id = auth.uid()`), TG, RPC |
| | DELETE | ❌ | ❌ | ❌ | Nonaktifkan, jangan hapus | CG |
| **pemasok** | SELECT | ❌ | ✅ | ✅ | Semua kolom | RLS |
| | INSERT | ❌ | ✅ | ✅ | Semua kolom kecuali `id, dibuat_pada` | RLS, CK (kode unik) |
| | UPDATE | ❌ | ✅ | ✅ | `kode, nama, telepon, alamat, aktif` | RLS |
| | DELETE | ❌ | ❌ | ❌ | Pakai `aktif = false` | CG |
| **pelanggan** | SELECT | ✅ | ⚠️ | ✅ | P/M semua kolom. G baca saja (untuk info kirim) | RLS |
| | INSERT | ⚠️ | ❌ | ✅ | P: `batas_kredit` dipaksa 0. `dibuat_oleh` dipaksa `auth.uid()` | RLS, TG, CK (`termin_hari IN (0,7,14,30)`, `batas_kredit >= 0`) |
| | UPDATE | ⚠️ | ❌ | ✅ | P: `kode, nama_toko, telepon, alamat, aktif`; **tidak** `batas_kredit` dan **tidak** `termin_hari`. M: semua; perubahan `batas_kredit` & `termin_hari` diaudit | RLS, TG (blok `batas_kredit` & `termin_hari` untuk non-M), trigger audit |
| | DELETE | ❌ | ❌ | ❌ | — | CG |
| **barang** | SELECT | ⚠️ | ⚠️ | ⚠️ | Semua peran: semua kolom **kecuali `harga_pokok`**. M membaca `harga_pokok` via `v_barang_manajer` | CG, VW |
| | INSERT | ❌ | ❌ | ⚠️ | M via RPC `buat_barang` (bisa mengisi `harga_pokok` awal). Stok awal 0 | RLS, RPC, CK |
| | UPDATE | ❌ | ⚠️ | ⚠️ | G: `nama, satuan, stok_minimum, aktif`. M: + `harga_jual` (diaudit). **Tidak ada** yang boleh UPDATE `stok` atau `kode` langsung. `harga_pokok` via penerimaan PO atau RPC `ubah_harga_pokok` (M, diaudit) | RLS, CG, TG (`fn_guard_kolom_barang`), trigger audit |
| | DELETE | ❌ | ❌ | ❌ | — | CG |
| **pembelian** | SELECT | ❌ | ⚠️ | ⚠️ | G/M: semua kolom **kecuali `harga_beli_satuan`**. M membacanya via `v_pembelian_manajer` | RLS, CG, VW |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | Hanya via RPC `ajukan_pembelian`, `putuskan_pembelian`, `terima_pembelian` | CG (tanpa grant tulis), RPC |
| | DELETE | ❌ | ❌ | ❌ | — | CG |
| **pesanan_jual** | SELECT | ⚠️ | ⚠️ | ✅ | P: `dibuat_oleh = auth.uid()`. G: `status <> 'draf'`. M: semua | RLS |
| | INSERT/UPDATE | ❌ | ❌ | ❌ | Hanya via RPC (`buat_pesanan`, `konfirmasi_pesanan`, `kirim_pesanan`, `lunasi_pesanan`, `batalkan_pesanan`) | CG, RPC |
| | DELETE | ❌ | ❌ | ❌ | Draf dibatalkan, tidak dihapus | CG |
| **item_pesanan_jual** | SELECT | ⚠️ | ⚠️ | ⚠️ | Mengikuti visibilitas `pesanan_jual` induk. Semua kolom **kecuali `hpp_satuan`**. M via `v_item_pesanan_manajer` | RLS (EXISTS ke induk), CG, VW |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | Via RPC `simpan_item_pesanan` / `hapus_item_pesanan` (hanya saat draf) | CG, RPC |
| **mutasi_stok** | SELECT | ✅ | ✅ | ✅ | Semua kolom (tidak ada nilai rahasia) | RLS |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | Hanya ditulis RPC mutasi. Append-only | CG, RPC |
| **audit_log** | SELECT | ❌ | ❌ | ✅ | Semua kolom | RLS |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | Ditulis oleh RPC/trigger `SECURITY DEFINER`. Append-only | CG |
| **persetujuan_harga** | SELECT | ⚠️ | ❌ | ✅ | P: baris diajukan_oleh = auth.uid(); M: semua; G: 0 baris. snapshot_hash disembunyikan dari non-superuser | RLS, CG |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | Hanya via RPC `rpc_ajukan_persetujuan_harga`, `rpc_putuskan_persetujuan_harga`, `rpc_batalkan_pengajuan_harga` | CG, RPC |
| **catatan_penagihan** | SELECT | ⚠️ | ❌ | ✅ | P: catatan pada pelanggan yang memiliki tagihan miliknya atau dibuat sendiri. G: 0 baris. M: semua | RLS |
| | INSERT/UPDATE/DELETE | ❌ | ❌ | ❌ | Append-only. UPDATE/DELETE ditolak trigger `trg_catatan_penagihan_guard` (E0051). Penulisan via `rpc_catat_penagihan` | TG, CG, RPC |

### View

| View | Mode | P | G | M | Isi |
|---|---|---|---|---|---|
| `v_barang` | `security_invoker = true` | ✅ | ✅ | ✅ | Barang tanpa `harga_pokok` + flag `stok_menipis` |
| `v_barang_manajer` | owner (definer) + `WHERE peran_saya()='manajer'` | 0 baris | 0 baris | ✅ | + `harga_pokok`, peringatan `harga_pokok IS NULL` |
| `v_pembelian` | `security_invoker = true` | 0 baris (RLS) | ✅ | ✅ | Tanpa `harga_beli_satuan` |
| `v_pembelian_manajer` | owner + filter peran | 0 baris | 0 baris | ✅ | + `harga_beli_satuan`, total |
| `v_item_pesanan_manajer` | owner + filter peran | 0 baris | 0 baris | ✅ | + `hpp_satuan`, margin baris |
| `v_piutang_pelanggan` | owner + filter peran (P, M) | ✅ | 0 baris | ✅ | Agregat per pelanggan: piutang berjalan, ada tagihan lewat jatuh tempo (tanpa detail pesanan milik staf lain) |
| `v_tagihan` | `security_invoker = true` / filter peran | ⚠️ (miliknya) | 0 baris | ✅ (semua) | Faktur terkirim belum lunas, selisih hari, 6 klasifikasi umur, janji bayar aktif terakhir. Tanpa kolom rahasia |
| `v_persetujuan_harga` | `security_invoker = true` | ⚠️ | 0 baris | ✅ | Tanpa snapshot_hash, evaluasi status 24 jam via CASE |
| `v_persetujuan_harga_manajer` | owner + `WHERE fn_is_manajer()` | 0 baris | 0 baris | ✅ | Lengkap dengan HPP satuan, margin satuan, dan margin total per item |
| `v_laporan_*` / RPC laporan | owner/definer + filter peran | ❌ | ❌ | ✅ | Omzet, HPP, margin mingguan dan per barang, umur piutang |

---

## B. Matriks Peran × Aksi Bisnis

| Aksi | P | G | M | Syarat utama | Lapisan penegak |
|---|---|---|---|---|---|
| Lihat stok & harga jual | ✅ | ✅ | ✅ | — | CG, VW |
| Lihat harga pokok / harga beli / margin | ❌ | ❌ | ✅ | — | CG, VW (filter peran), RPC laporan |
| Tambah barang baru | ❌ | ❌ | ✅ | `harga_jual > 0`, kode unik | RPC `buat_barang`, CK |
| Ubah nama/satuan/stok_minimum/aktif barang | ❌ | ✅ | ✅ | — | RLS, TG |
| Ubah harga jual | ❌ | ❌ | ✅ | `> 0`, diaudit | TG, CK, trigger audit |
| Kelola pelanggan | ✅ | ❌ | ✅ | P: batas kredit dipaksa Rp0 | RLS, TG |
| Ubah batas kredit | ❌ | ❌ | ✅ | `>= 0`, diaudit | TG / RPC `ubah_batas_kredit`, trigger audit |
| Ubah termin bayar lanjutan | ❌ | ❌ | ✅ | `IN (0,7,14,30)`, diaudit | TG / trigger audit |
| Ubah harga pokok manual | ❌ | ❌ | ✅ | `>= 0`, diaudit | RPC `ubah_harga_pokok`, trigger audit |
| Kelola pemasok | ❌ | ✅ | ✅ | — | RLS |
| Buat draf pesanan & ubah baris | ✅ | ❌ | ✅ | BR-02, BR-03; P hanya draf miliknya | RPC, RLS |
| Diskon 0–10% | ✅ | — | ✅ | — | RPC `simpan_item_pesanan` |
| Diskon >10% s.d. 25% | ❌ | — | ✅ | >25% ditolak untuk semua | RPC, CK (`diskon_persen BETWEEN 0 AND 25`) |
| Konfirmasi draf | ⚠️ milik sendiri | ❌ | ✅ semua | BR-04 s.d. BR-06; kunci pelanggan + barang (tanpa bypass batas kredit untuk M) | RPC `konfirmasi_pesanan` |
| Konfirmasi dengan harga di bawah HPP | ❌ | ❌ | ✅ | Pesan persis BR-04 untuk P jika tanpa persetujuan efektif | RPC `konfirmasi_pesanan` |
| Ajukan persetujuan harga | ⚠️ milik sendiri | ❌ | ❌ | Draf miliknya, minimal ada satu baris di bawah HPP | RPC `rpc_ajukan_persetujuan_harga`, audit |
| Setujui / tolak persetujuan harga | ❌ | ❌ | ✅ | Tolak wajib alasan ≥ 10 char; setuju berlaku 24 jam | RPC `rpc_putuskan_persetujuan_harga`, audit |
| Batalkan pengajuan persetujuan | ⚠️ milik sendiri | ❌ | ❌ | Hanya status menunggu | RPC `rpc_batalkan_pengajuan_harga`, audit |
| Konfirmasi dengan persetujuan efektif | ⚠️ milik sendiri | ❌ | ✅ | Snapshot hash cocok, status disetujui, belum kedaluwarsa | RPC `konfirmasi_pesanan` |
| Batalkan draf | ⚠️ milik sendiri | ❌ | ✅ | — | RPC `batalkan_pesanan` |
| Batalkan pesanan dikonfirmasi | ❌ | ❌ | ✅ | Alasan ≥ 10 karakter, stok kembali, diaudit | RPC, audit |
| Batalkan pesanan dikirim/lunas | ❌ | ❌ | ❌ | — | RPC (validasi transisi) |
| Kirim pesanan (dikonfirmasi → dikirim) | ❌ | ✅ | ✅ | Jatuh tempo otomatis | RPC `kirim_pesanan` |
| Catat pelunasan (dikirim → lunas) | ❌ | ❌ | ✅ | Diaudit | RPC `lunasi_pesanan`, audit |
| Ajukan PO | ❌ | ✅ | ✅ | Jumlah 1–10.000, pemasok & barang aktif | RPC `ajukan_pembelian`, CK |
| Setujui PO | ❌ | ❌ | ✅ | `harga_beli_satuan > 0`, diaudit | RPC `putuskan_pembelian`, audit |
| Tolak PO | ❌ | ❌ | ✅ | Alasan ≥ 10 karakter, diaudit | RPC, audit |
| Terima barang | ❌ | ✅ | ✅ | Status disetujui, sekali, 1 ≤ jumlah ≤ dipesan; stok naik, harga_pokok diperbarui | RPC `terima_pembelian` (FOR UPDATE pada PO & barang) |
| Penyesuaian stok | ❌ | ✅ | ✅ | Alasan ≥ 10 karakter, hasil ≥ 0, diaudit | RPC `sesuaikan_stok`, audit |
| Lihat kartu stok | ✅ | ✅ | ✅ | — | RLS |
| Catat interaksi penagihan / janji bayar | ⚠️ (pelanggan berfaktur miliknya) | ❌ | ✅ | Penulisan append-only, isi 3-500 char, janji bayar wajib tanggal >= hari ini | RPC `rpc_catat_penagihan` (E0046-E0051) |
| Kirim pengingat WhatsApp & catat log | ⚠️ | ❌ | ✅ | Tautan wa.me murni, nomor seluler 9-15 digit, rekam jejak otomatis | Frontend util & RPC `rpc_catat_penagihan` |
| Cetak kartu piutang pelanggan | ⚠️ | ❌ | ✅ | Tampilan tanpa kolom rahasia, print-ready (@media print) | RLS, VW `v_tagihan` |
| Ubah peran / status akun | ❌ | ❌ | ✅ | Minimal satu Manajer aktif tersisa; diaudit | RPC `ubah_peran`, TG, audit |
| Baca audit log | ❌ | ❌ | ✅ | — | RLS |
| Lihat laporan omzet/margin/piutang | ❌ | ❌ | ✅ | — | VW/RPC laporan (filter peran), MW |
| Ekspor CSV laporan | ❌ | ❌ | ✅ | — | RPC laporan, MW |

---

## C. Matriks Peran × Menu/Halaman UI

| Rute | Halaman | P | G | M | Catatan tampilan | Lapisan penegak |
|---|---|---|---|---|---|---|
| `/masuk` | Masuk | publik | publik | publik | Tidak ada tautan daftar | Supabase Auth (sign-up dimatikan) |
| `/dashboard` | Dashboard | ✅ | ✅ | ✅ | P: pesanan saya per status, widget penagihan. G: siap kirim, stok menipis, PO. M: omzet, margin, piutang, widget penagihan | MW, RLS, VW |
| `/barang` | Barang & Stok | ✅ (baca) | ✅ (ubah non-harga, penyesuaian) | ✅ (+ tambah, harga, kolom harga pokok, ubah HPP manual) | Kolom harga pokok hanya dirender untuk M dari `v_barang_manajer` | RLS, CG, TG, VW |
| `/barang/[id]/kartu-stok` | Kartu Stok | ✅ | ✅ | ✅ | — | RLS |
| `/pelanggan` | Pelanggan | ✅ | ❌ | ✅ | P tentukan termin_hari saat buat baru; saat edit/update, batas kredit & termin_hari read-only untuk P | MW, RLS, TG |
| `/pelanggan/[id]` | Detail Pelanggan | ✅ | ❌ | ✅ | Dilengkapi tombol aksi pintas ke Kartu Piutang | MW, RLS |
| `/pelanggan/[id]/piutang` | Kartu Piutang Pelanggan | ⚠️ (miliknya) | ❌ | ✅ | Siap cetak (@media print), rekap umur piutang, tanpa kolom rahasia | MW, RLS, VW |
| `/pesanan` | Daftar Pesanan Jual | ✅ (miliknya) | ✅ (non-draf) | ✅ (semua) | Filter status, pelanggan, tanggal | RLS |
| `/pesanan/[id]` | Detail Pesanan | ✅ | ✅ | ✅ | Tombol sesuai peran & status; panel HPP/margin hanya M | RLS, RPC, VW |
| `/penagihan` | Penagihan & Monitoring Tagihan | ⚠️ (miliknya) | ❌ | ✅ (semua) | 4 KPI cards, filter tab klasifikasi umur, tombol WA, catat penagihan, pelunasan (M) | MW, RLS, VW |
| `/pembelian` | Pembelian & Pemasok | ❌ | ✅ | ✅ | Kolom harga beli hanya M; tab Pemasok | MW, RLS, CG, VW |
| `/laporan` | Laporan | ❌ | ❌ | ✅ | Grafik mingguan, margin per barang, umur piutang, CSV | MW, VW/RPC filter peran |
| `/pengaturan/akun` | Akun & Peran | ❌ | ❌ | ✅ | — | MW, RPC |
| `/pengaturan/audit-log` | Audit Log | ❌ | ❌ | ✅ | Filter aksi & tanggal | MW, RLS |

> [!NOTE]
> Jika P/G membuka `/laporan` atau `/pengaturan/*` lewat URL, MW mengarahkan ke `/dashboard`. Bila MW dilewati (memanggil REST/RPC langsung), database tetap mengembalikan 0 baris atau error `Akses ditolak`.

---

## D. Ringkasan Lapisan Penegak untuk Sel Kritis

| Sel kritis | Penegak utama | Penegak cadangan | Diuji di |
|---|---|---|---|
| P/G membaca `harga_pokok`, `harga_beli_satuan`, `hpp_satuan` | CG (permission denied) | VW manajer filter peran, UI tidak merender | TC-03, TC-04, TC-05 |
| Eskalasi peran sendiri | TG pada `profiles` + RPC `ubah_peran` cek M | RLS update baris sendiri | TC-06 |
| UPDATE langsung `barang.stok` | CG (kolom `stok` & `kode` tidak di-grant UPDATE ke `authenticated`; RPC mutasi berjalan sebagai owner) | TG (E22) bila grant berubah | TC-08 |
| G mengubah harga / P mengubah batas kredit atau termin | TG | — | TC-09, TC-18 |
| Diskon >10% oleh P | RPC | CK 0–25 | TC-13 |
| Konfirmasi di bawah HPP oleh P | RPC (pesan generik) | — | TC-14 |
| Kredit & jatuh tempo | RPC (+ kunci baris pelanggan) | — | TC-16, TC-17 |
| Kredit dinamis & overdue control (D1-D9) | RPC `rpc_konfirmasi_pesanan` via `fn_hitung_kredit_pelanggan` (Urutan D4: Overdue dulu, baru plafon) | Non-bypassable semua peran termasuk Manajer (D5) | TC-29 s.d. TC-40 |
| Stok minus saat bersamaan | RPC (`FOR UPDATE` urut id) | CK `stok >= 0` | TC-19, TC-20 |
| Transisi status ilegal | RPC | CK nilai status | TC-22 |
| Audit log hanya dibaca M | RLS | CG (tanpa grant tulis) | TC-28 |

---

## E. Modul Limit Kredit Dinamis & Blokir Otomatis (Credit & Overdue Control)

| Objek / Fitur | P | G | M | Aturan & Lapisan Penegak |
|---|---|---|---|---|
| View `v_pelanggan_kredit` | ✅ | ✅ | ✅ | `security_invoker = true`, tanpa kolom rahasia (aman untuk semua peran) |
| RPC `rpc_get_kredit_pelanggan` | ✅ | ✅ | ✅ | RPC pembaca status kalkulasi kredit & kelayakan transaksi |
| RPC `rpc_get_faktur_overdue_pelanggan` | ✅ | ✅ | ✅ | RPC pembaca daftar faktur overdue untuk halaman detail pelanggan (bebas HPP) |
| Simpan Draf saat Overdue / Overlimit | ✅ | ❌ | ✅ | **D3:** Tidak diblokir di UI/draf; draf tetap dapat disimpan |
| Konfirmasi Pesanan saat Overdue | ❌ | ❌ | ❌ | **D4 & D5:** Diblokir untuk SEMUA peran via `rpc_konfirmasi_pesanan` (`E0007`) |
| Konfirmasi Pesanan melebihi Plafon | ❌ | ❌ | ❌ | **D4 & D5:** Diblokir untuk SEMUA peran via `rpc_konfirmasi_pesanan` (`E0006`) |
| Override Blokir Overdue | ❌ | ❌ | ✅ | **D5:** Hanya melalui pelunasan faktur menunggak (`rpc_catat_pelunasan`) |
| Override Plafon Kredit | ❌ | ❌ | ✅ | **D5:** Hanya melalui penaikan limit kredit pelanggan (`rpc_set_batas_kredit`) |


