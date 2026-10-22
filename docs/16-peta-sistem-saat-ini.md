# 16 - Peta Sistem Saat Ini (Current State Architecture Map)

Dokumen ini disusun oleh Auditor Sistem Independen berdasarkan inspeksi mendalam terhadap seluruh kode sumber (src/), file migrasi database (supabase/migrations/), pengujian otomatis (src/**/__tests__/, tests/e2e/, supabase/tests/), dan konfigurasi sistem per 22 Oktober 2026.

---

## 0. Verifikasi Fakta Katalog Basis Data (Fact Verification)

Berdasarkan inspeksi langsung terhadap katalog sistem database PostgreSQL (`information_schema.tables`, `information_schema.columns`, dan seluruh file migrasi `supabase/migrations/`), diperoleh fakta otoritatif berikut:

| Entitas / Kolom yang Dipertanyakan | Status di Database | Fakta Lapangan & Arsitektur Sebenarnya | Koreksi Dokumen Lama |
|---|---|---|---|
| **Tabel `pembayaran_piutang`** | **TIDAK ADA** | Sistem tidak memiliki tabel `pembayaran_piutang`. Pelunasan transaksi piutang dicatat langsung pada entitas faktur `public.pesanan_jual` melalui fungsi otoritatif `rpc_catat_pelunasan(p_id)` yang mengubah status menjadi `lunas` (100% lunas penuh). Tidak ada pembayaran parsial (BR-07 / PRD §14). | Seluruh spekulasi dokumen lama mengenai tabel `pembayaran_piutang` dinyatakan tidak berlaku. |
| **Tabel `item_pembelian`** | **TIDAK ADA** | Sistem tidak memiliki tabel `item_pembelian`. Pengadaan barang (`public.pembelian`) menganut struktur dokumen tunggal *single-item* per PO (`barang_id`, `jumlah_dipesan`, `jumlah_diterima`, `harga_beli_satuan`). Tidak ada multi-barang per nomor PO (00-spesifikasi.md III.5). | Koreksi asumsi dokumen lama yang menganggap PO memiliki detail multi-item. |
| **Kolom `pelanggan.terkunci_kredit` & `alasan_kunci`** | **TIDAK ADA** | Tabel `public.pelanggan` tidak memiliki kolom flag `terkunci_kredit` maupun `alasan_kunci`. Status blokir transaksi dan evaluasi batas kredit dihitung secara *real-time* on-the-fly melalui fungsi `public.fn_hitung_kredit_pelanggan(p_pelanggan_id)` menggunakan zona waktu bisnis Asia/Jakarta. Tidak ada flag statis yang bisa diakali/disinkronkan. | Koreksi dokumen lama yang mengasumsikan adanya kolom flag boolean terkunci pada tabel pelanggan. |

---

## A. Peta Tabel Basis Data

Terdapat 11 tabel di dalam skema public (9 tabel inti + 2 tabel modul stock opname). Seluruh tabel mewajibkan token JWT authenticated dan mengaktifkan Row-Level Security (RLS). Role anon dan PUBLIC telah dicabut seluruh hak aksesnya (REVOKE ALL).

### 1. public.profiles
* Tujuan: Menyimpan data profil dan penentuan peran pengguna yang terikat 1:1 dengan auth.users.
* Kolom:
  * id (uuid, PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE)
  * nama_lengkap (text, NOT NULL)
  * peran (text, NOT NULL, DEFAULT 'penjualan', CHECK peran IN ('penjualan','gudang','manajer'))
  * aktif (boolean, NOT NULL, DEFAULT true)
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT: (id, nama_lengkap, peran, aktif, dibuat_pada) TO authenticated.
  * UPDATE: (nama_lengkap) TO authenticated. (Kolom peran dan aktif tidak di-grant UPDATE langsung; dijaga via trigger/RPC).
* Triggers:
  * trg_auth_users_new_user (AFTER INSERT ON auth.users): mengeksekusi fn_handle_new_user() untuk membuat profil default berstatus penjualan.
  * trg_profiles_guard (BEFORE UPDATE OR DELETE): memblokir DELETE; memblokir UPDATE pada peran atau aktif jika bukan Manajer; memblokir modifikasi jika menyisakan 0 Manajer aktif (E0026).
  * trg_audit_profiles (AFTER UPDATE): mencatat aksi ubah_peran dan ubah_status_akun ke audit_log.
* Kebijakan RLS:
  * profiles_select_authenticated: FOR SELECT TO authenticated USING (true).
  * profiles_update_own: FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid()).

---

### 2. public.pemasok
* Tujuan: Master data pemasok/supplier barang pengadaan gudang.
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * kode (text, NOT NULL, UNIQUE via index uq_pemasok_kode)
  * nama (text, NOT NULL)
  * telepon (text, nullable)
  * alamat (text, nullable)
  * aktif (boolean, NOT NULL, DEFAULT true)
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT, INSERT, UPDATE: seluruh kolom TO authenticated.
* Triggers:
  * trg_pemasok_normalize_kode: BEFORE INSERT OR UPDATE, mengubah kode menjadi upper(btrim(NEW.kode)).
  * trg_pemasok_guard: BEFORE DELETE, memblokir seluruh operasi DELETE aplikasi.
* Kebijakan RLS:
  * pemasok_select_gudang_manajer: FOR SELECT USING (fn_peran() IN ('gudang', 'manajer')).
  * pemasok_insert_gudang_manajer: FOR INSERT WITH CHECK (fn_peran() IN ('gudang', 'manajer')).
  * pemasok_update_gudang_manajer: FOR UPDATE USING/WITH CHECK (fn_peran() IN ('gudang', 'manajer')).
  * Catatan: Staf Penjualan tidak memiliki akses baca maupun tulis (0 baris).

---

### 3. public.pelanggan
* Tujuan: Master data pelanggan toko/minimarket beserta plafon kredit dan termin tempo.
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * kode (text, NOT NULL, UNIQUE via index uq_pelanggan_kode)
  * nama_toko (text, NOT NULL)
  * telepon (text, nullable)
  * alamat (text, nullable)
  * batas_kredit (numeric(14,0), NOT NULL, DEFAULT 0, CHECK batas_kredit >= 0)
  * termin_hari (integer, NOT NULL, DEFAULT 0, CHECK termin_hari IN (0, 7, 14, 30))
  * aktif (boolean, NOT NULL, DEFAULT true)
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT: seluruh kolom TO authenticated.
  * UPDATE: (kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif) TO authenticated.
* Triggers:
  * trg_pelanggan_normalize_kode: BEFORE INSERT OR UPDATE, normalisasi upper(btrim(kode)).
  * trg_pelanggan_guard: BEFORE INSERT (memaksa batas_kredit = 0 jika dibuat Staf Penjualan); BEFORE UPDATE (hanya Manajer yang boleh mengubah batas_kredit dan termin_hari, melempar E0024); BEFORE DELETE (memblokir DELETE).
  * trg_audit_pelanggan: AFTER UPDATE, mencatat ubah_batas_kredit dan ubah_termin_pelanggan ke audit_log.
* Kebijakan RLS:
  * pelanggan_select_all_roles: FOR SELECT USING (fn_peran() IN ('penjualan', 'gudang', 'manajer')).
  * pelanggan_insert_penjualan_manajer: FOR INSERT WITH CHECK (fn_peran() IN ('penjualan', 'manajer')).
  * pelanggan_update_penjualan_manajer: FOR UPDATE USING/WITH CHECK (fn_peran() IN ('penjualan', 'manajer')).
  * Catatan: Gudang hanya memiliki izin SELECT (read-only untuk keperluan pengiriman).

---

### 4. public.barang
* Tujuan: Master barang komoditas dan saldo stok fisik berjalan.
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * kode (text, NOT NULL, UNIQUE via index uq_barang_kode)
  * nama (text, NOT NULL)
  * satuan (text, NOT NULL)
  * harga_jual (numeric(14,0), NOT NULL, CHECK harga_jual > 0)
  * harga_pokok (numeric(14,0), nullable) [RAHASIA MANAJER]
  * stok (integer, NOT NULL, DEFAULT 0, CHECK stok >= 0)
  * stok_minimum (integer, NOT NULL, DEFAULT 0, CHECK stok_minimum >= 0)
  * aktif (boolean, NOT NULL, DEFAULT true)
  * diperbarui_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: harga_pokok.
* Hak Akses Kolom (Grants):
  * SELECT: (id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada) TO authenticated. (harga_pokok TIDAK DI-GRANT).
  * UPDATE: (nama, satuan, harga_jual, stok_minimum, aktif, diperbarui_pada) TO authenticated. (kode, stok, dan harga_pokok TIDAK DI-GRANT UPDATE).
* Triggers:
  * trg_barang_normalize_kode: BEFORE INSERT OR UPDATE, normalisasi upper(btrim(kode)).
  * trg_barang_guard: BEFORE UPDATE (perubahan stok wajib app.mutasi_stok = '1'; perubahan harga_jual hanya Manajer; perubahan harga_pokok hanya Manajer atau via app.terima_pembelian = '1'); BEFORE DELETE (memblokir DELETE).
  * trg_audit_barang: AFTER UPDATE, mencatat ubah_harga_jual ke audit_log.
* Kebijakan RLS:
  * barang_select_all_roles: FOR SELECT USING (fn_peran() IN ('penjualan', 'gudang', 'manajer')).
  * barang_update_gudang_manajer: FOR UPDATE USING/WITH CHECK (fn_peran() IN ('gudang', 'manajer')).
  * Catatan: Staf Penjualan tidak memiliki izin UPDATE ke tabel barang.

---

### 5. public.pembelian (Purchase Order)
* Tujuan: Dokumen transaksi pengadaan barang dari pemasok ke gudang.
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * nomor (text, NOT NULL, UNIQUE, format PO-YYYY-NNNNNN)
  * pemasok_id (uuid, NOT NULL, REFERENCES public.pemasok(id))
  * barang_id (uuid, NOT NULL, REFERENCES public.barang(id))
  * jumlah_dipesan (integer, NOT NULL, CHECK jumlah_dipesan BETWEEN 1 AND 10000)
  * jumlah_diterima (integer, NOT NULL, DEFAULT 0, CHECK jumlah_diterima >= 0 AND jumlah_diterima <= jumlah_dipesan)
  * harga_beli_satuan (numeric(14,0), nullable) [RAHASIA MANAJER]
  * status (text, NOT NULL, DEFAULT 'diajukan', CHECK status IN ('diajukan','disetujui','ditolak','diterima'))
  * alasan_tolak (text, nullable)
  * diajukan_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * diajukan_pada (timestamptz, NOT NULL, DEFAULT now())
  * diputuskan_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * diputuskan_pada (timestamptz, nullable)
  * diterima_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * diterima_pada (timestamptz, nullable)
* Kolom Rahasia: harga_beli_satuan.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom non-rahasia TO authenticated. (harga_beli_satuan TIDAK DI-GRANT).
  * INSERT & UPDATE: TIDAK DI-GRANT ke authenticated (seluruh mutasi wajib via RPC database).
* Kebijakan RLS:
  * pembelian_select_gudang_manajer: FOR SELECT USING (fn_peran() IN ('gudang', 'manajer')). Penjualan menerima 0 baris.

---

### 6. public.pesanan_jual (Sales Order Header)
* Tujuan: Header pesanan penjualan barang kepada pelanggan.
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * nomor (text, NOT NULL, UNIQUE, format SO-YYYY-NNNNNN)
  * pelanggan_id (uuid, NOT NULL, REFERENCES public.pelanggan(id))
  * status (text, NOT NULL, DEFAULT 'draf', CHECK status IN ('draf','dikonfirmasi','dikirim','lunas','dibatalkan'))
  * total (numeric(14,0), NOT NULL, DEFAULT 0)
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
  * dikonfirmasi_pada (timestamptz, nullable)
  * dikirim_pada (timestamptz, nullable)
  * jatuh_tempo (date, nullable)
  * dilunasi_pada (timestamptz, nullable)
  * dibatalkan_pada (timestamptz, nullable)
  * alasan_batal (text, nullable)
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT & UPDATE: TIDAK DI-GRANT ke authenticated (hanya lewat RPC).
* Kebijakan RLS:
  * pesanan_jual_select: FOR SELECT USING:
    * Manajer: melihat semua baris (fn_peran() = 'manajer').
    * Penjualan: hanya draf/pesanan miliknya sendiri (fn_peran() = 'penjualan' AND dibuat_oleh = auth.uid()).
    * Gudang: hanya pesanan yang sudah berstatus operasional (fn_peran() = 'gudang' AND status <> 'draf').

---

### 7. public.item_pesanan_jual (Sales Order Details)
* Tujuan: Baris rincian barang per pesanan penjualan (1 s.d. 20 baris per pesanan).
* Kolom:
  * id (uuid, PRIMARY KEY, DEFAULT gen_random_uuid())
  * pesanan_jual_id (uuid, NOT NULL, REFERENCES public.pesanan_jual(id) ON DELETE CASCADE)
  * barang_id (uuid, NOT NULL, REFERENCES public.barang(id))
  * jumlah (integer, NOT NULL, CHECK jumlah >= 1)
  * harga_satuan (numeric(14,0), NOT NULL)
  * diskon_persen (numeric(5,2), NOT NULL, DEFAULT 0, CHECK diskon_persen >= 0 AND diskon_persen <= 25)
  * subtotal (numeric(14,0), NOT NULL, CHECK subtotal >= 0)
  * hpp_satuan (numeric(14,0), nullable) [RAHASIA MANAJER - SNAPSHOT KONFIRMASI]
* Indeks Unik: uq_item_pesanan_jual_barang (pesanan_jual_id, barang_id) - menjamin 1 barang hanya muncul 1 kali per pesanan.
* Kolom Rahasia: hpp_satuan.
* Hak Akses Kolom (Grants):
  * SELECT: (id, pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal) TO authenticated. (hpp_satuan TIDAK DI-GRANT).
* Kebijakan RLS:
  * item_pesanan_jual_select: FOR SELECT USING mewarisi visibilitas induk pesanan_jual.

---

### 8. public.mutasi_stok (Kartu Stok / Inventory Ledger)
* Tujuan: Catatan historis mutasi persediaan fisik (Append-Only, invarian kartu stok).
* Kolom:
  * id (bigint, PRIMARY KEY GENERATED ALWAYS AS IDENTITY)
  * barang_id (uuid, NOT NULL, REFERENCES public.barang(id))
  * jenis (text, NOT NULL, CHECK jenis IN ('masuk','keluar','batal','penyesuaian'))
  * jumlah (integer, NOT NULL, bertanda: positif masuk/batal, negatif keluar, +/- penyesuaian)
  * stok_sesudah (integer, NOT NULL)
  * nomor_dokumen (text, nullable)
  * alasan (text, nullable)
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT (hanya diisi oleh internal RPC transaksi).
* Triggers:
  * trg_mutasi_stok_append_only: BEFORE UPDATE OR DELETE, memblokir modifikasi atau penghapusan catatan stok.
* Kebijakan RLS:
  * mutasi_stok_select_all_roles: FOR SELECT USING (fn_peran() IN ('penjualan', 'gudang', 'manajer')).

---

### 9. public.audit_log (System Audit Trail)
* Tujuan: Jejak audit mutasi master data dan aksi transaksi sensitif (Append-Only).
* Kolom:
  * id (bigint, PRIMARY KEY GENERATED ALWAYS AS IDENTITY)
  * pelaku_id (uuid, NOT NULL, REFERENCES public.profiles(id))
  * aksi (text, NOT NULL)
  * nama_tabel (text, NOT NULL)
  * data_id (uuid, nullable)
  * nilai_lama (jsonb, nullable)
  * nilai_baru (jsonb, nullable)
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Kolom Rahasia: Seluruh tabel bersifat rahasia Manajer.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
* Triggers:
  * trg_audit_log_append_only: BEFORE UPDATE OR DELETE, memblokir pengubahan atau penghapusan log audit.
* Kebijakan RLS:
  * audit_log_select_manajer_only: FOR SELECT USING (fn_is_manajer() = true). Non-manajer menerima 0 baris.

---

### 10. public.opname_stok (Header Stock Opname Gudang)
* Tujuan: Header dokumen audit fisik berkala di rak gudang.
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * nomor (text, NOT NULL, UNIQUE, format OPN-YYYY-XXXX)
  * status (text, NOT NULL, DEFAULT 'draf', CHECK status IN ('draf', 'diajukan', 'disetujui', 'dibatalkan'))
  * catatan (text, nullable)
  * total_item (integer, NOT NULL, DEFAULT 0, CHECK total_item >= 0)
  * total_selisih_unit (integer, NOT NULL, DEFAULT 0)
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
  * diajukan_pada (timestamptz, nullable)
  * disetujui_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * disetujui_pada (timestamptz, nullable)
  * dibatalkan_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * dibatalkan_pada (timestamptz, nullable)
  * alasan_batal (text, nullable)
* Kolom Rahasia: Tidak ada.
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT langsung (seluruh mutasi via RPC).
* Kebijakan RLS:
  * opname_stok_select_policy: FOR SELECT USING (fn_peran() IN ('gudang', 'manajer')). Penjualan 0 baris.
  * opname_stok_modify_policy: FOR ALL USING (false) WITH CHECK (false).

---

### 11. public.item_opname_stok (Detail Item Stock Opname)
* Tujuan: Rincian fisik barang per sesi opname, mencakup stok sistem saat pencatatan dan stok fisik riil hasil hitung.
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * opname_stok_id (uuid, NOT NULL, REFERENCES public.opname_stok(id) ON DELETE CASCADE)
  * barang_id (uuid, NOT NULL, REFERENCES public.barang(id))
  * stok_sistem (integer, NOT NULL, CHECK stok_sistem >= 0)
  * stok_fisik (integer, NOT NULL, CHECK stok_fisik >= 0)
  * selisih (integer, GENERATED ALWAYS AS (stok_fisik - stok_sistem) STORED)
  * keterangan (text, nullable)
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Indeks Unik: uq_item_opname_barang (opname_stok_id, barang_id).
* Kolom Rahasia: Tidak ada (kolom HPP dihitung hanya di view manajer).
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT langsung.
* Kebijakan RLS:
  * item_opname_stok_select_policy: FOR SELECT USING (fn_peran() IN ('gudang', 'manajer')).
  * item_opname_stok_modify_policy: FOR ALL USING (false) WITH CHECK (false).

---

## B. Peta View Basis Data

| Nama View | Definisi Singkat | Security Option | Peran yang Dapat Membaca | Kolom Sensitif / Rahasia |
|---|---|---|---|---|
| v_barang | Menampilkan katalog barang aktif/nonaktif dan indikator stok_menipis | security_invoker = true | Penjualan, Gudang, Manajer | Tidak ada (harga pokok diabaikan) |
| v_pembelian | Daftar PO pembelian pengadaan gudang tanpa harga beli satuan | security_invoker = true | Gudang, Manajer (Penjualan 0 baris via RLS) | Tidak ada (harga beli satuan diabaikan) |
| v_item_pesanan_jual | Daftar item pesanan jual tanpa nilai snapshot HPP | security_invoker = true | Penjualan (milik sendiri), Gudang (non-draf), Manajer | Tidak ada (hpp_satuan diabaikan) |
| v_pelanggan_piutang (alias v_piutang_pelanggan) | Agregat piutang berjalan, breakdown terkonfirmasi vs terkirim, dan status faktur overdue | security_invoker = true | Penjualan, Manajer (Gudang via view) | Tidak ada |
| v_pelanggan_kredit | View status kredit dinamis per pelanggan via fn_hitung_kredit_pelanggan | security_invoker = true | Penjualan, Manajer | Tidak ada |
| v_barang_manajer | Katalog barang lengkap disertai harga_pokok dan flag harga_pokok_belum_diisi | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | harga_pokok |
| v_pembelian_manajer | Daftar PO pembelian lengkap dengan harga_beli_satuan dan total_estimasi_beli | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | harga_beli_satuan |
| v_item_pesanan_jual_manajer (alias v_item_pesanan_manajer) | Rincian baris pesanan jual lengkap dengan hpp_satuan dan nominal margin laba | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | hpp_satuan, margin |
| v_opname_stok_manajer | Header opname dilengkapi agregasi nilai finansial selisih HPP (estimasi_nilai_selisih) | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | estimasi_nilai_selisih (dihitung dari harga_pokok) |

---

## C. Peta Fungsi Basis Data (RPC / Stored Procedures)

| Nama RPC | Parameter Input | Peran yang Diizinkan | Tabel yang Dimodifikasi | Row Locking (FOR UPDATE) | Mutasi Stok? | Audit Log? |
|---|---|---|---|---|---|---|
| rpc_buat_pesanan | p_pelanggan_id uuid | Penjualan, Manajer | pesanan_jual | Tidak | Tidak | Tidak |
| rpc_simpan_draf_pesanan | p_pelanggan_id uuid, p_items jsonb, p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual, item_pesanan_jual | Ya (pesanan_jual) | Tidak | Tidak |
| rpc_simpan_item_pesanan | p_pesanan_id uuid, p_barang_id uuid, p_jumlah int, p_diskon numeric | Penjualan, Manajer | pesanan_jual, item_pesanan_jual | Ya (pesanan_jual) | Tidak | Tidak |
| rpc_batalkan_draf | p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual | Ya (pesanan_jual) | Tidak | Ya (batalkan_draf_pesanan) |
| rpc_konfirmasi_pesanan | p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual, barang, mutasi_stok, item_pesanan_jual, audit_log | Ya (pesanan_jual, pelanggan, barang ORDER BY id) | Ya (jenis 'keluar') | Ya (konfirmasi_pesanan) |
| rpc_kirim_pesanan | p_pesanan_id uuid | Gudang, Manajer | pesanan_jual | Ya (pesanan_jual, pelanggan) | Tidak | Ya (kirim_pesanan) |
| rpc_catat_pelunasan (alias rpc_lunasi_pesanan) | p_pesanan_id uuid | Manajer Saja | pesanan_jual, audit_log | Ya (pesanan_jual) | Tidak | Ya (lunasi_pesanan) |
| rpc_batalkan_pesanan_terkonfirmasi (alias rpc_batalkan_pesanan) | p_pesanan_id uuid, p_alasan text | Manajer Saja | pesanan_jual, barang, mutasi_stok, audit_log | Ya (pesanan_jual, barang ORDER BY id) | Ya (jenis 'batal') | Ya (batalkan_pesanan_terkonfirmasi) |
| rpc_ajukan_pembelian | p_pemasok_id uuid, p_barang_id uuid, p_jumlah int | Gudang, Manajer | pembelian, audit_log | Tidak | Tidak | Ya (ajukan_pembelian) |
| rpc_setujui_pembelian | p_pembelian_id uuid, p_harga_beli numeric | Manajer Saja | pembelian, audit_log | Ya (pembelian) | Tidak | Ya (setujui_pembelian) |
| rpc_tolak_pembelian | p_pembelian_id uuid, p_alasan text | Manajer Saja | pembelian, audit_log | Ya (pembelian) | Tidak | Ya (tolak_pembelian) |
| rpc_putuskan_pembelian | p_pembelian_id uuid, p_setuju bool, p_harga_beli numeric, p_alasan text | Manajer Saja | Wrapper rpc_setujui_pembelian / rpc_tolak_pembelian | Ya | Tidak | Ya |
| rpc_terima_pembelian | p_pembelian_id uuid, p_jumlah_diterima int | Gudang, Manajer | pembelian, barang, mutasi_stok, audit_log | Ya (pembelian, barang) | Ya (jenis 'masuk') | Ya (terima_pembelian) |
| rpc_penyesuaian_stok (alias rpc_sesuaikan_stok) | p_barang_id uuid, p_stok_fisik int, p_alasan text | Gudang, Manajer | barang, mutasi_stok, audit_log | Ya (barang) | Ya (jenis 'penyesuaian') | Ya (penyesuaian_stok) |
| rpc_buat_opname_stok | p_catatan text, p_items jsonb, p_langsung_ajukan bool | Gudang, Manajer | opname_stok, item_opname_stok, audit_log | Ya (barang SHARE) | Tidak | Ya (buat_draf_stock_opname / ajukan_...) |
| rpc_ubah_draf_opname | p_id uuid, p_catatan text, p_items jsonb | Gudang, Manajer | opname_stok, item_opname_stok, audit_log | Ya (opname_stok, barang SHARE) | Tidak | Ya (ubah_draf_stock_opname) |
| rpc_ajukan_opname_stok | p_id uuid | Gudang, Manajer | opname_stok, audit_log | Ya (opname_stok) | Tidak | Ya (ajukan_stock_opname) |
| rpc_setujui_opname_stok | p_id uuid | Manajer Saja | opname_stok, barang, mutasi_stok, audit_log | Ya (opname_stok, barang ORDER BY id) | Ya (jenis 'penyesuaian') | Ya (setujui_stock_opname) |
| rpc_batalkan_opname_stok | p_id uuid, p_alasan text | Gudang (draf sendiri), Manajer | opname_stok, audit_log | Ya (opname_stok) | Tidak | Ya (batalkan_stock_opname) |
| rpc_buat_barang | p_kode text, p_nama text, p_satuan text, p_harga_jual numeric, p_stok_minimum int | Manajer Saja | barang, audit_log | Tidak | Tidak | Ya (buat_barang) |
| rpc_set_harga_jual (alias rpc_ubah_harga_jual) | p_barang_id uuid, p_harga_jual numeric | Manajer Saja | barang | Ya (barang) | Tidak | Ya (via trigger trg_audit_barang) |
| rpc_set_harga_pokok (alias rpc_ubah_harga_pokok) | p_barang_id uuid, p_harga_pokok numeric | Manajer Saja | barang, audit_log | Ya (barang) | Tidak | Ya (ubah_harga_pokok) |
| rpc_buat_pelanggan | p_kode, p_nama_toko, p_telepon, p_alamat, p_termin_hari, p_batas_kredit | Penjualan, Manajer | pelanggan, audit_log | Tidak | Tidak | Ya (buat_pelanggan) |
| rpc_set_batas_kredit (alias rpc_ubah_batas_kredit) | p_pelanggan_id uuid, p_batas numeric | Manajer Saja | pelanggan | Ya (pelanggan) | Tidak | Ya (via trigger trg_audit_pelanggan) |
| rpc_set_termin | p_pelanggan_id uuid, p_termin int | Manajer Saja | pelanggan | Ya (pelanggan) | Tidak | Ya (via trigger trg_audit_pelanggan) |
| rpc_set_peran (alias rpc_ubah_peran) | p_profile_id uuid, p_peran text | Manajer Saja | profiles | Ya (profiles) | Tidak | Ya (via trigger trg_audit_profiles) |
| rpc_get_kredit_pelanggan | p_pelanggan_id uuid | Penjualan, Gudang, Manajer | Read-only | Tidak | Tidak | Tidak |
| rpc_get_faktur_overdue_pelanggan | p_pelanggan_id uuid | Penjualan, Gudang, Manajer | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_margin_mingguan | - | Manajer Saja | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_ringkasan | p_start_date timestamptz, p_end_date timestamptz | Manajer Saja | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_top_barang | p_limit int, p_start_date timestamptz, p_end_date timestamptz | Manajer Saja | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_top_pelanggan | p_limit int, p_start_date timestamptz, p_end_date timestamptz | Manajer Saja | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_aging_piutang | - | Manajer Saja | Read-only | Tidak | Tidak | Tidak |
| rpc_laporan_piutang_pesanan | p_pelanggan_id uuid, p_hanya_overdue bool | Manajer Saja | Read-only | Tidak | Tidak | Tidak |

---

## D. Peta Rute, Halaman, dan Server Actions

| Rute URL | Komponen Halaman | Peran yang Berhak (akses.ts & Middleware) | Server Actions yang Digunakan |
|---|---|---|---|
| /login | src/app/login/page.tsx | Publik (Anonim) | Auth Supabase (signInWithPassword, signOut) |
| /tidak-berwenang | src/app/tidak-berwenang/page.tsx | Semua Akun Login | None (Informasional 403) |
| / (Dashboard) | src/app/(dashboard)/page.tsx | Penjualan, Gudang, Manajer | Direct Supabase SSR View Queries |
| /barang | src/app/(dashboard)/barang/page.tsx | Penjualan, Gudang, Manajer | ubahStatusBarangAction |
| /barang/baru | src/app/(dashboard)/barang/baru/page.tsx | Manajer Saja | buatBarangAction |
| /barang/[id] | src/app/(dashboard)/barang/[id]/page.tsx | Penjualan, Gudang, Manajer | updateBarangAction, ubahHargaAction |
| /pelanggan | src/app/(dashboard)/pelanggan/page.tsx | Penjualan, Manajer | ubahStatusPelangganAction |
| /pelanggan/baru | src/app/(dashboard)/pelanggan/baru/page.tsx | Penjualan, Manajer | buatPelangganAction |
| /pelanggan/[id] | src/app/(dashboard)/pelanggan/[id]/page.tsx | Penjualan, Manajer | updatePelangganAction, catatPelunasanAction |
| /pesanan | src/app/(dashboard)/pesanan/page.tsx | Penjualan, Gudang, Manajer | batalkanPesananAction |
| /pesanan/baru | src/app/(dashboard)/pesanan/baru/page.tsx | Penjualan, Manajer | simpanPesananAction, konfirmasiPesananAction |
| /pesanan/[id] | src/app/(dashboard)/pesanan/[id]/page.tsx | Penjualan, Gudang, Manajer | konfirmasiPesananAction, kirimPesananAction, catatPelunasanAction, batalkanPesananAction |
| /pesanan/[id]/cetak | src/app/(dashboard)/pesanan/[id]/cetak/page.tsx | Penjualan, Gudang, Manajer | Read-only (Print Layout) |
| /pesanan/[id]/ubah | src/app/(dashboard)/pesanan/[id]/ubah/page.tsx | Penjualan, Manajer | simpanPesananAction, konfirmasiPesananAction |
| /pembelian | src/app/(dashboard)/pembelian/page.tsx | Gudang, Manajer | putuskanPembelianAction, terimaPembelianAction |
| /pembelian/baru | src/app/(dashboard)/pembelian/baru/page.tsx | Gudang, Manajer | ajukanPembelianAction |
| /pembelian/[id] | src/app/(dashboard)/pembelian/[id]/page.tsx | Gudang, Manajer | putuskanPembelianAction, terimaPembelianAction |
| /pemasok | src/app/(dashboard)/pemasok/page.tsx | Gudang, Manajer | ubahStatusPemasokAction |
| /pemasok/baru | src/app/(dashboard)/pemasok/baru/page.tsx | Gudang, Manajer | buatPemasokAction |
| /pemasok/[id] | src/app/(dashboard)/pemasok/[id]/page.tsx | Gudang, Manajer | updatePemasokAction |
| /stok (Kartu Stok) | src/app/(dashboard)/stok/page.tsx | Penjualan, Gudang, Manajer | sesuaikanStokAction |
| /stok/[barangId] | src/app/(dashboard)/stok/[barangId]/page.tsx | Penjualan, Gudang, Manajer | sesuaikanStokAction |
| /stok/opname | src/app/(dashboard)/stok/opname/page.tsx | Gudang, Manajer | Direct Supabase SSR queries |
| /stok/opname/baru | src/app/(dashboard)/stok/opname/baru/page.tsx | Gudang, Manajer | buatOpnameStokAction |
| /stok/opname/[id] | src/app/(dashboard)/stok/opname/[id]/page.tsx | Gudang, Manajer | ajukanOpnameStokAction, setujuiOpnameStokAction, batalkanOpnameStokAction |
| /stok/opname/[id]/ubah | src/app/(dashboard)/stok/opname/[id]/ubah/page.tsx | Gudang, Manajer | ubahDrafOpnameAction |
| /laporan | src/app/(dashboard)/laporan/page.tsx | Manajer Saja | Direct RPC SSR queries |
| /laporan/piutang | src/app/(dashboard)/laporan/piutang/page.tsx | Manajer Saja | Direct RPC SSR queries |
| /akun (Pengaturan Akun) | src/app/(dashboard)/akun/page.tsx | Manajer Saja | ubahPeranAction, ubahStatusAkunAction |
| /pengaturan/akun | src/app/(dashboard)/pengaturan/akun/page.tsx | Manajer Saja | Alias/Redirect ke /akun |
| /audit | src/app/(dashboard)/audit/page.tsx | Manajer Saja | Direct Supabase SSR audit queries |
| /pengaturan/audit-log | src/app/(dashboard)/pengaturan/audit-log/page.tsx | Manajer Saja | Alias/Redirect ke /audit |
| /profil | src/app/(dashboard)/profil/page.tsx | Penjualan, Gudang, Manajer | Direct user session data |

---

## E. Analisis Kode Error (E0001 s.d. E0036)

| Kode | Pesan di Katalog (src/lib/errors.ts) | Fungsi Database / Komponen yang Melempar | Status Penggunaan & Temuan |
|---|---|---|---|
| E0001 | Akses ditolak | Seluruh RPC, RLS Policy, Trigger Guard | Aktif Digunakan. Standar penolakan otorisasi. |
| E0002 | Data tidak ditemukan | Seluruh RPC transaksi (pesanan, pembelian, opname) | Aktif Digunakan. |
| E0003 | Pesanan harus berisi 1 sampai 20 baris | rpc_simpan_draf_pesanan, rpc_konfirmasi_pesanan | Aktif Digunakan (BR-02). |
| E0004 | Jumlah minimal 1 | rpc_simpan_draf_pesanan, rpc_simpan_item_pesanan | Aktif Digunakan (BR-02). |
| E0005 | Barang sudah ada di pesanan ini | rpc_simpan_draf_pesanan, rpc_simpan_item_pesanan | Aktif Digunakan (BR-02). |
| E0006 | Barang tidak aktif atau tidak ditemukan | rpc_simpan_draf_pesanan, rpc_konfirmasi_pesanan, rpc_ajukan_pembelian, rpc_setujui_opname_stok | TABRAKAN KODE: Di 20261021140000_kredit_overdue.sql, pesan 'E0006: Batas kredit pelanggan terlampaui' memakai string prefix E0006: padahal ERRCODE-nya E0012. |
| E0007 | Pelanggan atau pemasok tidak aktif | rpc_simpan_draf_pesanan, rpc_konfirmasi_pesanan, rpc_ajukan_pembelian | TABRAKAN KODE: Di 20261021140000_kredit_overdue.sql, pesan 'E0007: Pelanggan memiliki faktur lewat jatuh tempo...' memakai prefix E0007: padahal ERRCODE-nya E0013. |
| E0008 | Pesanan hanya bisa diubah saat berstatus draf | rpc_simpan_draf_pesanan, rpc_simpan_item_pesanan | Aktif Digunakan (BR-02). |
| E0009 | Diskon harus 0% sampai 10% | rpc_simpan_draf_pesanan, rpc_konfirmasi_pesanan | Aktif Digunakan (BR-03, Penjualan). |
| E0010 | Diskon harus 0% sampai 25% | rpc_simpan_draf_pesanan, rpc_simpan_item_pesanan | Aktif Digunakan (BR-03, Manajer). |
| E0011 | Harga di bawah batas, minta persetujuan Manajer | rpc_konfirmasi_pesanan | Aktif Digunakan (BR-04). Wajib verbatim tanpa bocor nominal HPP. |
| E0012 | Batas kredit pelanggan terlampaui | rpc_konfirmasi_pesanan | Aktif Digunakan (BR-05 / BR-13). |
| E0013 | Pelanggan memiliki tagihan lewat jatuh tempo | rpc_konfirmasi_pesanan | Aktif Digunakan (BR-05 / BR-14). |
| E0014 | Stok barang tidak mencukupi untuk memenuhi pesanan | rpc_konfirmasi_pesanan | Aktif Digunakan (BR-06). Mengembalikan kode barang bersangkutan. |
| E0015 | Perpindahan status atau tindakan tidak diizinkan | Seluruh RPC transaksi status | Aktif Digunakan (BR-07, BR-09, State Machine). |
| E0016 | Alasan minimal 10 karakter | rpc_batalkan_pesanan_terkonfirmasi, rpc_tolak_pembelian, rpc_penyesuaian_stok, rpc_batalkan_opname_stok | Aktif Digunakan (BR-08, BR-09, BR-11). |
| E0017 | Jumlah pembelian harus 1 sampai 10.000 | rpc_ajukan_pembelian | Aktif Digunakan (BR-09). |
| E0018 | Harga beli harus lebih dari 0 | rpc_setujui_pembelian | Aktif Digunakan (BR-09). |
| E0019 | Pembelian tidak dalam status disetujui | rpc_terima_pembelian | Aktif Digunakan (BR-10). |
| E0020 | Jumlah diterima harus 1 sampai jumlah dipesan | rpc_terima_pembelian | Aktif Digunakan (BR-10). |
| E0021 | Stok hasil penyesuaian tidak boleh negatif | rpc_penyesuaian_stok | Aktif Digunakan (BR-11). |
| E0022 | Stok hanya dapat diubah melalui transaksi mutasi | Trigger trg_barang_guard | Aktif Digunakan (BR-01, dilempar tanpa ERRCODE eksplisit). |
| E0023 | Hanya Manajer yang dapat mengubah harga | Trigger trg_barang_guard | Aktif Digunakan (BR-01, dilempar tanpa ERRCODE eksplisit). |
| E0024 | Termin hari harus 0, 7, 14, atau 30 | rpc_set_batas_kredit, rpc_set_termin, rpc_buat_pelanggan, trigger trg_pelanggan_guard | OVERLOADED: Digunakan untuk 3 pesan berbeda: batas kredit >= 0, hak Manajer ubah termin/kredit, dan validasi termin hari. |
| E0025 | Peran tidak valid | rpc_set_peran, trigger trg_profiles_guard | Aktif Digunakan. |
| E0026 | Minimal harus ada satu Manajer aktif | rpc_set_peran, trigger trg_profiles_guard | Aktif Digunakan (B20). |
| E0027 | Kode barang sudah digunakan | rpc_buat_barang | Aktif Digunakan (BR-01). |
| E0028 | Harga jual harus lebih dari 0 | rpc_set_harga_pokok, rpc_set_harga_jual, rpc_buat_barang | OVERLOADED: Digunakan untuk validasi harga_jual > 0 sekaligus harga_pokok >= 0. |
| E0029 | Stok minimum harus bilangan bulat >= 0 | rpc_buat_barang | Aktif Digunakan (BR-01). |
| E0030 | Akun Anda tidak aktif. Hubungi Manajer. | Frontend Auth / UI Login | Khusus UI. Tidak pernah dilempar oleh database RPC. |
| E0031 | Sesi opname harus berisi minimal 1 item barang | rpc_buat_opname_stok, rpc_ubah_draf_opname, rpc_ajukan_opname_stok | Aktif Digunakan (Modul Opname). |
| E0032 | Sesi opname hanya dapat diubah saat berstatus draf | rpc_ubah_draf_opname, rpc_ajukan_opname_stok | Aktif Digunakan (Modul Opname). |
| E0033 | Stok fisik riil tidak boleh bernilai negatif | rpc_buat_opname_stok, rpc_ubah_draf_opname | Aktif Digunakan (Modul Opname). |
| E0034 | Sesi opname hanya dapat disetujui atau ditolak pada status diajukan | rpc_setujui_opname_stok | Aktif Digunakan (Modul Opname). |
| E0035 | Barang sudah ada di sesi opname ini | rpc_buat_opname_stok, rpc_ubah_draf_opname | Aktif Digunakan (Modul Opname). |
| E0036 | Hanya Manajer yang berwenang menyetujui stock opname | rpc_setujui_opname_stok | Aktif Digunakan (Modul Opname). |

---

## F. Inventaris Pengujian Sistem

| ID Test Case | File Pengujian | Lapisan / Jenis Uji | Status Otomasi | Keterangan Cakupan |
|---|---|---|---|---|
| TC-01 | supabase/tests/02_keamanan.sql, tests/e2e/01-auth-noindex.spec.ts | SQL + Playwright E2E | Otomatis | Penolakan role anonim, header noindex, redirect login |
| TC-02 | supabase/tests/02_keamanan.sql, tests/e2e/01-auth-noindex.spec.ts | SQL + Playwright E2E | Otomatis | Penolakan akun nonaktif, pesan E0030 |
| TC-03 | supabase/tests/02_keamanan.sql, tests/e2e/02-keamanan-data-rahasia.spec.ts | SQL + Playwright E2E | Otomatis | Column grant: harga_pokok & hpp_satuan tidak bisa di-select |
| TC-04 | supabase/tests/02_keamanan.sql, tests/e2e/02-keamanan-data-rahasia.spec.ts | SQL + Playwright E2E | Otomatis | View manajer menghasilkan 0 baris untuk non-manajer |
| TC-05 | supabase/tests/02_keamanan.sql, tests/e2e/02-keamanan-data-rahasia.spec.ts | SQL + Playwright E2E | Otomatis | Pembelian: harga beli tidak bocor ke Gudang |
| TC-06 | supabase/tests/02_keamanan.sql, src/features/akun/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Eskalasi peran ditolak, minimal 1 manajer aktif |
| TC-07 | supabase/tests/03_rpc.sql, src/features/barang/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Kode barang unik, harga > 0, stok minimum >= 0 |
| TC-08 | supabase/tests/02_keamanan.sql | SQL | Otomatis | Update stok langsung tanpa flag mutasi ditolak (E0022) |
| TC-09 | supabase/tests/02_keamanan.sql | SQL | Otomatis | Gudang ubah non-harga boleh; ubah harga ditolak (E0023) |
| TC-10 | supabase/tests/03_rpc.sql, src/features/pesanan/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Batas 1 s.d. 20 baris pesanan jual (E0003) |
| TC-11 | supabase/tests/03_rpc.sql, src/features/pesanan/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Jumlah >= 1, duplikat barang ditolak, cek keaktifan |
| TC-12 | supabase/tests/03_rpc.sql, src/features/pesanan/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Harga master otomatis, pembulatan round rupiah, ubah hanya draf |
| TC-13 | supabase/tests/03_rpc.sql, tests/e2e/03-alur-transaksi.spec.ts | SQL + Playwright E2E | Otomatis | Batas diskon Penjualan 0-10% (E0009), Manajer 0-25% (E0010) |
| TC-14 | supabase/tests/03_rpc.sql | SQL | Otomatis | Konfirmasi Penjualan di bawah HPP ditolak (E0011 verbatim) |
| TC-15 | supabase/tests/03_rpc.sql | SQL | Otomatis | Manajer boleh konfirmasi di bawah HPP; snapshot hpp_satuan |
| TC-16 | supabase/tests/03_rpc.sql, supabase/tests/03_konkurensi.ps1 | SQL + PowerShell Konkurensi | Otomatis | Batas kredit & locking pelanggan FOR UPDATE saat konfirmasi paralel |
| TC-17 | supabase/tests/03_rpc.sql | SQL | Otomatis | Pelanggan ada pesanan terkirim lewat jatuh tempo ditolak (E0013) |
| TC-18 | supabase/tests/02_keamanan.sql, src/features/pelanggan/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Batas kredit awal Rp0, ubah batas/termin hanya Manajer |
| TC-19 | supabase/tests/03_konkurensi.ps1 (Skenario 1) | PowerShell Konkurensi | Otomatis | Race condition stok: 2 sesi konfirmasi paralel memperebutkan stok sisa 1 |
| TC-20 | supabase/tests/03_konkurensi.ps1 (Skenario 3) | PowerShell Konkurensi | Otomatis | Penguncian multi-barang urut barang_id ASC, bebas deadlock |
| TC-21 | supabase/tests/03_rpc.sql | SQL | Otomatis | Alur kirim pesanan (Gudang) & pelunasan penuh (Manajer) |
| TC-22 | supabase/tests/03_rpc.sql | SQL | Otomatis | Transisi status pesanan ilegal ditolak (E0015) |
| TC-23 | supabase/tests/03_rpc.sql | SQL | Otomatis | Pembatalan pesanan dikonfirmasi oleh Manajer, alasan >= 10 char, stok kembali |
| TC-24 | supabase/tests/03_rpc.sql, src/features/pembelian/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Pengajuan PO oleh Gudang, jumlah 1 s.d. 10.000 |
| TC-25 | supabase/tests/03_rpc.sql, src/features/pembelian/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Manajer setujui PO (harga beli > 0) / tolak PO (alasan >= 10 char) |
| TC-26 | supabase/tests/03_rpc.sql | SQL | Otomatis | Penerimaan PO gudang: stok bertambah, kartu stok 'masuk', update harga_pokok |
| TC-27 | supabase/tests/02_keamanan.sql, src/features/stok/__tests__/invarian.test.ts | SQL + Vitest | Otomatis | Penyesuaian stok manual: alasan >= 10 char, invarian kartu stok |
| TC-28 | supabase/tests/02_keamanan.sql, supabase/tests/03_rpc.sql | SQL | Otomatis | Seluruh 7 mutasi penting tercatat di audit_log, hanya Manajer bisa baca |
| TC-29 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Nilai pesanan tepat sama dengan sisa plafon kredit berhasil |
| TC-30 | supabase/tests/04_kredit_overdue.sql, src/features/pelanggan/__tests__/kredit.test.ts | SQL + Vitest | Otomatis | Nilai pesanan melampaui sisa kredit ditolak (E0012) |
| TC-31 | supabase/tests/04_kredit_overdue.sql, src/features/pelanggan/__tests__/kredit.test.ts | SQL + Vitest | Otomatis | Ada faktur overdue sisa kredit cukup ditolak (E0013) |
| TC-32 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Prioritas D4: Overdue & Overlimit sekaligus, error overdue muncul duluan |
| TC-33 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Batas jatuh tempo hari ini belum dianggap overdue |
| TC-34 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Dikonfirmasi belum kirim memakan limit kredit, tidak memicu overdue |
| TC-35 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Pelunasan faktur overdue oleh Manajer membuka blokir transaksi |
| TC-36 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Penaikan limit kredit oleh Manajer membuka blokir overlimit |
| TC-37 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Non-bypassable: Manajer pun diblokir jika pesanan overlimit/overdue |
| TC-38 | supabase/tests/04_kredit_overdue.sql | SQL | Otomatis | Zero leakage: view v_pelanggan_kredit bebas kolom rahasia |
| TC-39 | tests/e2e/04-kredit-overdue.spec.ts | Playwright E2E | Otomatis | Live panel kredit di form pesanan, banner alert dinamis |
| TC-40 | tests/e2e/04-kredit-overdue.spec.ts | Playwright E2E | Otomatis | Tabel faktur overdue di detail pelanggan, tombol pelunasan Manajer |
| TC-41 | supabase/tests/05_stock_opname.sql, src/features/stock-opname/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Pembuatan draf stock opname oleh Gudang |
| TC-42 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Akses Staf Penjualan ditolak membuat stock opname (E0001) |
| TC-43 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Pengubahan dan pengajuan draf opname oleh Gudang |
| TC-44 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Persetujuan resmi opname fisik oleh Manajer & eksekusi mutasi |
| TC-45 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Non-manajer ditolak menyetujui stock opname (E0036) |
| TC-46 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Pembatalan draf oleh pembuat & pembatalan diajukan oleh Manajer (E0016) |
| TC-47 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Isolasi data finansial opname: view v_opname_stok_manajer |
| TC-48 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Persetujuan ganda ditolak pada status bukan diajukan (E0034) |

---

## G. Analisis Penyimpangan Terhadap docs/00-spesifikasi.md

| No | Komponen / Perilaku | Spesifikasi Awal (00-spesifikasi.md) | Implementasi Aktual Saat Ini | Tercatat di docs/04? | Penjelasan Rasional & Dampak Teknis |
|---|---|---|---|---|---|
| 1 | Nama tabel pesanan | pesanan_jual, item_pesanan_jual | pesanan_jual, item_pesanan_jual | Ya | Sesuai spesifikasi. |
| 2 | Tabel Modul Stock Opname | Belum ada (hanya penyesuaian manual di BR-11) | Ditambahkan tabel opname_stok dan item_opname_stok | Belum tercatat di docs/04 (Tercatat di docs/fitur-stock-opname.md) | Penambahan modul sesi audit fisik terstruktur dengan alur persetujuan Manajer. |
| 3 | Batas Kredit Pelanggan Baru | Batas kredit awal Rp0 | batas_kredit = 0 dipaksa oleh trigger saat dibuat non-Manajer | Ya (A10) | Mencegah Staf Penjualan memberikan kredit tanpa otorisasi Manajer. |
| 4 | Status Purchase Order (PO) | 4 status: diajukan, disetujui, ditolak, diterima | 4 status (tidak ada status dibatalkan) | Ya (A4, B1) | Status ditolak oleh Manajer mewakili pembatalan pengajuan. |
| 5 | Pelunasan Piutang | Pelunasan pesanan (BR-07) | rpc_catat_pelunasan melunasi penuh 100% per faktur; tidak ada tabel pembayaran_piutang terpisah | Ya (B25) | Pelunasan sebagian dinyatakan di luar lingkup sistem (PRD §14). |
| 6 | Bypass Kredit Manajer | Spesifikasi mengecualikan Manajer pada BR-04 | Manajer TIDAK BISA membypass limit kredit atau overdue di konfirmasi pesanan | Ya (B30, D5) | Untuk tata kelola risiko kredit, Manajer wajib menaikkan limit atau melunasi faktur terlebih dahulu (tercatat di audit log). |
| 7 | Koreksi harga_pokok Manual | Spesifikasi menyatakan HPP diupdate via PO (BR-10) | Manajer diizinkan memanggil rpc_ubah_harga_pokok | Ya (B31) | Diperlukan untuk mengisi HPP saldo awal sebelum PO pertama diterbitkan. |
| 8 | Struktur PO Multi-Barang | PO memiliki kolom barang_id dan jumlah_dipesan per baris PO | PO adalah single-item per dokumen (1 PO = 1 barang) | Ya | Mengikuti persis skema pembelian pada 00-spesifikasi.md poin III.5. Tidak ada tabel item_pembelian. |
