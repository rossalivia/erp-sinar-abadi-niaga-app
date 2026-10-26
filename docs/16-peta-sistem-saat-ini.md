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

Terdapat 14 tabel di dalam skema public (9 tabel inti + 2 modul stock opname + 1 modul persetujuan harga + 1 modul penagihan + 1 modul impor CSV). Seluruh tabel mewajibkan token JWT authenticated dan mengaktifkan Row-Level Security (RLS). Role anon dan PUBLIC telah dicabut seluruh hak aksesnya (REVOKE ALL).

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
  * status (text, NOT NULL, DEFAULT 'diajukan', CHECK status IN ('diajukan','disetujui','ditolak','diterima','dibatalkan'))
  * alasan_tolak (text, nullable)
  * diajukan_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * diajukan_pada (timestamptz, NOT NULL, DEFAULT now())
  * diputuskan_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * diputuskan_pada (timestamptz, nullable)
  * diterima_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * diterima_pada (timestamptz, nullable)
  * dibatalkan_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * dibatalkan_pada (timestamptz, nullable)
  * alasan_batal (text, nullable)
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

### 12. public.persetujuan_harga (Dispensasi Harga di Bawah HPP)
* Tujuan: Menyimpan pengajuan permohonan dispensasi harga jual khusus di bawah HPP beserta keputusan Manajer dan hash snapshot pesanan.
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * pesanan_jual_id (uuid, NOT NULL, REFERENCES public.pesanan_jual(id) ON DELETE CASCADE)
  * status (text, NOT NULL, DEFAULT 'menunggu', CHECK status IN ('menunggu', 'disetujui', 'ditolak', 'terpakai', 'dibatalkan', 'kedaluwarsa'))
  * diajukan_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * diajukan_pada (timestamptz, NOT NULL, DEFAULT now())
  * catatan_pengaju (text, nullable)
  * keputusan_oleh (uuid, nullable, REFERENCES public.profiles(id))
  * keputusan_pada (timestamptz, nullable)
  * catatan_keputusan (text, nullable)
  * alasan_tolak (text, nullable)
  * snapshot_hash (text, NOT NULL)
  * berlaku_sampai (timestamptz, nullable)
  * dipakai_pada (timestamptz, nullable)
* Indeks Unik Parsial:
  * uq_persetujuan_aktif_per_pesanan: UNIQUE (pesanan_jual_id) WHERE status IN ('menunggu', 'disetujui').
* Kolom Rahasia: snapshot_hash tidak di-grant ke authenticated (akses internal RPC SECURITY DEFINER).
* Hak Akses Kolom (Grants):
  * SELECT: (id, pesanan_jual_id, status, diajukan_oleh, diajukan_pada, catatan_pengaju, keputusan_oleh, keputusan_pada, catatan_keputusan, alasan_tolak, berlaku_sampai, dipakai_pada) TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT (seluruh mutasi via RPC).
* Kebijakan RLS:
  * persetujuan_harga_select_policy: FOR SELECT USING (fn_is_manajer() OR diajukan_oleh = auth.uid()). Gudang menerima 0 baris.
  * persetujuan_harga_modify_policy: FOR ALL USING (false) WITH CHECK (false).

### 13. public.catatan_penagihan (Riwayat & Log Interaksi Penagihan)
* Tujuan: Mencatat riwayat penagihan piutang dan komitmen janji bayar pelanggan (append-only).
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * pelanggan_id (uuid, NOT NULL, REFERENCES public.pelanggan(id) ON DELETE RESTRICT)
  * pesanan_jual_id (uuid, nullable, REFERENCES public.pesanan_jual(id) ON DELETE SET NULL)
  * jenis (text, NOT NULL, CHECK jenis IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan'))
  * isi (text, NOT NULL, CHECK length(btrim(isi)) BETWEEN 3 AND 500)
  * janji_bayar_tanggal (date, nullable, wajib diisi jika jenis = 'janji_bayar')
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Triggers:
  * trg_catatan_penagihan_guard: BEFORE UPDATE OR DELETE, memblokir seluruh operasi modifikasi/penghapusan (append-only, E0051).
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT langsung (penulisan via RPC `rpc_catat_penagihan`).
* Kebijakan RLS:
  * catatan_penagihan_select: FOR SELECT USING: Manajer melihat semua, Penjualan melihat catatan buatannya sendiri atau pelanggan yang memiliki faktur aktif buatannya. Gudang 0 baris.
  * catatan_penagihan_modify_block: FOR ALL USING (false) WITH CHECK (false).

---

### 14. public.impor_data (Riwayat & Metadata Eksekusi Impor CSV)
* Tujuan: Mencatat metadata riwayat keberhasilan eksekusi impor data awal barang dan pelanggan (Append-Only, isolasi data rahasia tanpa menyimpan baris mentah).
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * nomor (text, NOT NULL, UNIQUE, format IMP-YYYY-XXXX via sequence seq_impor_data)
  * jenis (text, NOT NULL, CHECK jenis IN ('barang', 'pelanggan'))
  * nama_file (text, NOT NULL)
  * total_baris (integer, NOT NULL, CHECK total_baris >= 1)
  * baris_berhasil (integer, NOT NULL, CHECK baris_berhasil >= 1)
  * dibuat_oleh (uuid, NOT NULL, REFERENCES public.profiles(id))
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
* Triggers:
  * trg_impor_data_guard: BEFORE UPDATE OR DELETE, memblokir seluruh operasi modifikasi/penghapusan (append-only, E0059).
* Hak Akses Kolom (Grants):
  * SELECT: seluruh kolom TO authenticated.
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT langsung (penulisan hanya melalui RPC otoritatif).
* Kebijakan RLS:
  * impor_data_select_manajer: FOR SELECT USING (fn_is_manajer() = true). Penjualan dan Gudang menerima 0 baris.
  * impor_data_modify_block: FOR ALL USING (false) WITH CHECK (false).

---

### 15. public.tagihan_mayar (Invoice Gateway Mayar)
* Tujuan: Menyimpan rekam jejak invoice pembayaran digital Mayar sandbox/live per pesanan jual berstatus dikirim (M1..M5).
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * pesanan_jual_id (uuid, NOT NULL, REFERENCES public.pesanan_jual(id) ON DELETE RESTRICT)
  * mayar_invoice_id (text, NOT NULL)
  * link_pembayaran (text, NOT NULL)
  * total (numeric(14,0), NOT NULL, CHECK total > 0)
  * status (status_tagihan_mayar, NOT NULL, DEFAULT 'dibuat')
  * berlaku_hingga (timestamptz, NOT NULL)
  * dibayar_pada (timestamptz, nullable)
  * dibuat_pada (timestamptz, NOT NULL, DEFAULT now())
  * diperbarui_pada (timestamptz, NOT NULL, DEFAULT now())
* Indeks Unik: `uq_tagihan_mayar_pesanan_aktif` UNIQUE (pesanan_jual_id) WHERE status = 'dibuat' (menjamin maksimal 1 tagihan aktif per pesanan).
* Hak Akses Kolom (Grants):
  * SELECT: TO authenticated (dibatasi RLS khusus Manajer).
  * INSERT, UPDATE, DELETE: TIDAK DI-GRANT langsung (seluruh mutasi lewat RPC).
* Kebijakan RLS:
  * tagihan_mayar_select_manajer: FOR SELECT USING (fn_is_manajer() = true). Penjualan dan Gudang 0 baris.
  * tagihan_mayar_block_modify: FOR ALL USING (false) WITH CHECK (false).

---

### 16. public.mayar_webhook_event (Log Idempotensi Webhook)
* Tujuan: Mencegah replay attack dan eksekusi ganda webhook pembayaran Mayar secara aman tanpa menyimpan muatan data pribadi pelanggan (M3, M7, M8).
* Kolom:
  * id (uuid, PRIMARY KEY DEFAULT gen_random_uuid())
  * event_id (text, NOT NULL, UNIQUE)
  * event_type (text, NOT NULL)
  * mayar_invoice_id (text, nullable)
  * mayar_payment_id (text, nullable)
  * status_pembayaran (text, nullable)
  * nominal (numeric(14,0), nullable)
  * hasil_proses (hasil_webhook_mayar, NOT NULL)
  * catatan (text, nullable)
  * diterima_pada (timestamptz, NOT NULL, DEFAULT now())
* Hak Akses:
  * Dicabut seluruhnya dari PUBLIC, anon, authenticated.
  * HANYA dapat diakses oleh fungsi `rpc_sistem_*` berhak `service_role`.

---

## B. Peta View Basis Data

| Nama View | Definisi Singkat | Security Option | Peran yang Dapat Membaca | Kolom Sensitif / Rahasia |
|---|---|---|---|---|
| v_barang | Menampilkan katalog barang aktif/nonaktif dan indikator stok_menipis | security_invoker = true | Penjualan, Gudang, Manajer | Tidak ada (harga pokok diabaikan) |
| v_pembelian | Daftar PO pembelian pengadaan gudang tanpa harga beli satuan | security_invoker = true | Gudang, Manajer (Penjualan 0 baris via RLS) | Tidak ada (harga beli satuan diabaikan) |
| v_item_pesanan_jual | Daftar item pesanan jual tanpa nilai snapshot HPP | security_invoker = true | Penjualan (milik sendiri), Gudang (non-draf), Manajer | Tidak ada (hpp_satuan diabaikan) |
| v_pelanggan_piutang (alias v_piutang_pelanggan) | Agregat piutang berjalan, breakdown terkonfirmasi vs terkirim, dan status faktur overdue | security_invoker = true | Penjualan, Manajer (Gudang via view) | Tidak ada |
| v_pelanggan_kredit | View status kredit dinamis per pelanggan via fn_hitung_kredit_pelanggan | security_invoker = true | Penjualan, Manajer | Tidak ada |
| v_tagihan | Daftar seluruh faktur terkirim belum lunas, 6 klasifikasi umur tagihan, selisih hari, dan janji bayar aktif terakhir | security_invoker = true / filter peran | Penjualan (faktur miliknya), Manajer (seluruh faktur). Gudang 0 baris | Tidak ada kolom finansial rahasia |
| v_barang_manajer | Katalog barang lengkap disertai harga_pokok dan flag harga_pokok_belum_diisi | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | harga_pokok |
| v_pembelian_manajer | Daftar PO pembelian lengkap dengan harga_beli_satuan dan total_estimasi_beli | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | harga_beli_satuan |
| v_item_pesanan_jual_manajer (alias v_item_pesanan_manajer) | Rincian baris pesanan jual lengkap dengan hpp_satuan dan nominal margin laba | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | hpp_satuan, margin |
| v_opname_stok_manajer | Header opname dilengkapi agregasi nilai finansial selisih HPP (estimasi_nilai_selisih) | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | estimasi_nilai_selisih (dihitung dari harga_pokok) |
| v_persetujuan_harga | Daftar pengajuan persetujuan harga publik dengan nomor pesanan, nama pelanggan, dan status 24 jam lazy | security_invoker = true | Penjualan (milik sendiri via RLS), Manajer (Gudang 0 baris) | Tidak ada (snapshot_hash tidak disertakan) |
| v_persetujuan_harga_manajer | Antrean & riwayat persetujuan lengkap dengan item pesanan, HPP satuan, dan margin laba per item | Owner Rights (Definer) + security_barrier = true + WHERE fn_is_manajer() = true | Hanya Manajer (Peran lain menerima 0 baris) | hpp_satuan, margin_satuan, margin_total |

---

## C. Peta Fungsi Basis Data (RPC / Stored Procedures)

| Nama RPC | Parameter Input | Peran yang Diizinkan | Tabel yang Dimodifikasi | Row Locking (FOR UPDATE) | Mutasi Stok? | Audit Log? |
|---|---|---|---|---|---|---|
| rpc_buat_pesanan | p_pelanggan_id uuid | Penjualan, Manajer | pesanan_jual | Tidak | Tidak | Tidak |
| rpc_simpan_draf_pesanan | p_pelanggan_id uuid, p_items jsonb, p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual, item_pesanan_jual, persetujuan_harga | Ya (pesanan_jual) | Tidak | Ya (jika anulir persetujuan) |
| rpc_simpan_item_pesanan | p_pesanan_id uuid, p_barang_id uuid, p_jumlah int, p_diskon numeric | Penjualan, Manajer | pesanan_jual, item_pesanan_jual | Ya (pesanan_jual) | Tidak | Tidak |
| rpc_batalkan_draf | p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual, persetujuan_harga | Ya (pesanan_jual) | Tidak | Ya (batalkan_draf_pesanan & batalkan_persetujuan) |
| rpc_konfirmasi_pesanan | p_pesanan_id uuid | Penjualan, Manajer | pesanan_jual, barang, mutasi_stok, item_pesanan_jual, persetujuan_harga, audit_log | Ya (pesanan_jual -> persetujuan_harga -> pelanggan -> barang ORDER BY id) | Ya (jenis 'keluar') | Ya (konfirmasi_pesanan & pakai_persetujuan_harga) |
| rpc_kirim_pesanan | p_pesanan_id uuid | Gudang, Manajer | pesanan_jual | Ya (pesanan_jual, pelanggan) | Tidak | Ya (kirim_pesanan) |
| rpc_catat_pelunasan (alias rpc_lunasi_pesanan) | p_pesanan_id uuid | Manajer Saja (Non-M ditolak E0078) | pesanan_jual, tagihan_mayar, audit_log | Ya (pesanan_jual) | Tidak | Ya (pelunasan) |
| rpc_batalkan_pesanan_terkonfirmasi (alias rpc_batalkan_pesanan) | p_pesanan_id uuid, p_alasan text | Manajer Saja | pesanan_jual, barang, mutasi_stok, audit_log | Ya (pesanan_jual, barang ORDER BY id) | Ya (jenis 'batal') | Ya (batalkan_pesanan_terkonfirmasi) |
| rpc_ajukan_persetujuan_harga | p_pesanan_id uuid, p_catatan text | Penjualan Saja | persetujuan_harga, audit_log | Ya (pesanan_jual) | Tidak | Ya (ajukan_persetujuan_harga) |
| rpc_putuskan_persetujuan_harga | p_id uuid, p_setuju boolean, p_catatan text, p_alasan_tolak text | Manajer Saja | persetujuan_harga, audit_log | Ya (persetujuan_harga) | Tidak | Ya (setujui/tolak_persetujuan_harga) |
| rpc_batalkan_pengajuan_harga | p_id uuid | Penjualan (pemilik) | persetujuan_harga, audit_log | Ya (persetujuan_harga) | Tidak | Ya (batalkan_pengajuan_harga) |
| rpc_catat_penagihan | p_pelanggan_id uuid, p_pesanan_jual_id uuid, p_jenis text, p_isi text, p_janji_bayar_tanggal date | Penjualan, Manajer | catatan_penagihan | Tidak | Tidak | Tidak (tabel sudah append-only) |
| rpc_baca_catatan_penagihan | p_pelanggan_id uuid, p_pesanan_jual_id uuid | Penjualan, Manajer | Read-only | Tidak | Tidak | Tidak |
| rpc_ajukan_pembelian | p_pemasok_id uuid, p_barang_id uuid, p_jumlah int | Gudang, Manajer | pembelian, audit_log | Tidak | Tidak | Ya (ajukan_pembelian) |
| rpc_setujui_pembelian | p_pembelian_id uuid, p_harga_beli numeric | Manajer Saja | pembelian, audit_log | Ya (pembelian) | Tidak | Ya (setujui_pembelian) |
| rpc_tolak_pembelian | p_pembelian_id uuid, p_alasan text | Manajer Saja | pembelian, audit_log | Ya (pembelian) | Tidak | Ya (tolak_pembelian) |
| rpc_putuskan_pembelian | p_pembelian_id uuid, p_setuju bool, p_harga_beli numeric, p_alasan text | Manajer Saja | Wrapper rpc_setujui_pembelian / rpc_tolak_pembelian | Ya | Tidak | Ya |
| rpc_terima_pembelian | p_pembelian_id uuid, p_jumlah_diterima int | Gudang, Manajer | pembelian, barang, mutasi_stok, audit_log | Ya (pembelian, barang) | Ya (jenis 'masuk') | Ya (terima_pembelian) |
| rpc_batalkan_pembelian | p_pembelian_id uuid, p_alasan text | Pengaju PO (status diajukan), Manajer (status disetujui) | pembelian, audit_log | Ya (pembelian FOR UPDATE) | Tidak | Ya (batalkan_pembelian) |
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
| rpc_impor_barang | p_items jsonb, p_nama_file text | Manajer Saja | barang, mutasi_stok, impor_data, audit_log | Ya (barang) | Ya (saldo awal 'penyesuaian') | Ya (impor_barang ringkas) |
| rpc_impor_pelanggan | p_items jsonb, p_nama_file text | Manajer Saja | pelanggan, impor_data, audit_log | Ya (pelanggan) | Tidak | Ya (impor_pelanggan ringkas) |

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
| /pembelian | src/app/(dashboard)/pembelian/page.tsx | Gudang, Manajer | putuskanPembelianAction, terimaPembelianAction, batalkanPembelianAction |
| /pembelian/baru | src/app/(dashboard)/pembelian/baru/page.tsx | Gudang, Manajer | ajukanPembelianAction |
| /pembelian/[id] | src/app/(dashboard)/pembelian/[id]/page.tsx | Gudang, Manajer | putuskanPembelianAction, terimaPembelianAction, batalkanPembelianAction |
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
| /impor | src/app/(dashboard)/impor/page.tsx | Manajer Saja | validasiCsvAction, eksekusiImporBarangAction, eksekusiImporPelangganAction |
| /impor/riwayat | src/app/(dashboard)/impor/riwayat/page.tsx | Manajer Saja | Direct Supabase SSR queries (impor_data) |
| /api/impor/templat | src/app/api/impor/templat/route.ts | Manajer Saja | Route Handler unduh templat CSV (barang/pelanggan) |

---

## E. Analisis Kode Error (E0001 s.d. E0062)

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
| E0037 | Keterangan selisih stok opname minimal 10 karakter | rpc_buat_opname_stok, rpc_ubah_draf_opname | Aktif Digunakan (Modul Opname, Resolusi Temuan K3). |
| E0038 | Stok barang telah berubah sejak sesi opname dibuat, silakan muat ulang data | rpc_setujui_opname_stok | Aktif Digunakan (Modul Opname, Anti-Drift K4). |
| E0039 | Permohonan persetujuan harga hanya dapat diajukan oleh Staf Penjualan | rpc_ajukan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0040 | Pesanan tidak memerlukan persetujuan harga atau sudah disetujui | rpc_ajukan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0041 | Sudah ada pengajuan persetujuan harga yang aktif untuk pesanan ini | rpc_ajukan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0042 | Hanya Manajer yang berwenang memutuskan persetujuan harga | rpc_putuskan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0043 | Persetujuan harga sudah diputuskan sebelumnya atau kedaluwarsa | rpc_putuskan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0044 | Alasan penolakan persetujuan harga minimal 10 karakter | rpc_putuskan_persetujuan_harga | Aktif Digunakan (Modul Persetujuan Harga). |
| E0045 | Isi pesanan telah berubah sejak persetujuan harga diajukan | rpc_konfirmasi_pesanan | Aktif Digunakan (Modul Persetujuan Harga). |
| E0046 | Jenis catatan penagihan tidak valid | rpc_catat_penagihan, trg_catatan_penagihan_guard | Aktif Digunakan (Modul Penagihan). |
| E0047 | Isi catatan penagihan harus antara 3 sampai 500 karakter | rpc_catat_penagihan, trg_catatan_penagihan_guard | Aktif Digunakan (Modul Penagihan). |
| E0048 | Tanggal janji bayar wajib diisi untuk jenis janji bayar | rpc_catat_penagihan | Aktif Digunakan (Modul Penagihan). |
| E0049 | Tanggal janji bayar tidak boleh tanggal lampau | rpc_catat_penagihan | Aktif Digunakan (Modul Penagihan, Asia/Jakarta). |
| E0050 | Faktur tidak ditemukan atau bukan milik pelanggan ini | rpc_catat_penagihan | Aktif Digunakan (Modul Penagihan). |
| E0051 | Catatan penagihan tidak dapat diubah atau dihapus | trg_catatan_penagihan_guard | Aktif Digunakan (Modul Penagihan, Append-Only). |
| E0052 | Hanya Staf Penjualan dan Manajer yang berwenang mencatat penagihan | rpc_catat_penagihan | Aktif Digunakan (Modul Penagihan). |
| E0053 | Kolom wajib CSV tidak lengkap atau urutan salah | utils.ts, rpc_impor_barang, rpc_impor_pelanggan | Aktif Digunakan (Modul Impor CSV, Validasi Header). |
| E0054 | Format baris CSV tidak valid atau kolom tidak cocok | utils.ts, actions.ts | Aktif Digunakan (Modul Impor CSV, RFC 4180 Parsing). |
| E0055 | Jumlah baris CSV melebihi batas maksimum 1.000 baris | utils.ts, rpc_impor_barang, rpc_impor_pelanggan | Aktif Digunakan (Modul Impor CSV). |
| E0056 | Terdapat duplikasi kode di dalam berkas CSV | utils.ts, rpc_impor_barang, rpc_impor_pelanggan | Aktif Digunakan (Modul Impor CSV). |
| E0057 | Kode sudah terdaftar di sistem | utils.ts, rpc_impor_barang, rpc_impor_pelanggan | Aktif Digunakan (Modul Impor CSV, Insert-Only). |
| E0058 | Nilai angka tidak valid atau mengandung desimal | utils.ts, rpc_impor_barang, rpc_impor_pelanggan | Aktif Digunakan (Modul Impor CSV, Strict Integer). |
| E0059 | Data impor bersifat permanen dan tidak dapat diubah atau dihapus | trg_impor_data_guard | Aktif Digunakan (Modul Impor CSV, Append-Only). |
| E0060 | Hanya Manajer yang berwenang melakukan impor data CSV | rpc_impor_barang, rpc_impor_pelanggan, actions.ts | Aktif Digunakan (Modul Impor CSV, Otorisasi RBAC). |
| E0061 | Format berkas tidak didukung, hanya berkas CSV yang diperbolehkan | DropzoneCsv.tsx, actions.ts, utils.ts | Aktif Digunakan (Modul Impor CSV). |
| E0062 | Ukuran berkas melebihi batas maksimum 1 MB | DropzoneCsv.tsx, actions.ts | Aktif Digunakan (Modul Impor CSV). |
| E0063 | Pilih minimal satu pesanan untuk membuat daftar ambil barang | rpc_buat_picking_list | Aktif Digunakan (Modul Picking List). |
| E0064 | Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi | rpc_buat_picking_list | Aktif Digunakan (Modul Picking List). |
| E0065 | Hanya Staf Gudang dan Manajer yang berwenang mengakses daftar ambil barang | rpc_buat_picking_list | Aktif Digunakan (Modul Picking List). |
| E0066 | Tagihan Mayar hanya dapat dibuat untuk pesanan berstatus dikirim | rpc_buat_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0067 | Pesanan sudah memiliki tagihan Mayar aktif | rpc_buat_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0068 | Total pesanan harus lebih besar dari 0 untuk membuat tagihan | rpc_buat_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0069 | Email pelanggan wajib diisi dengan format valid | actions.ts, rpc_buat_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0070 | Masa berlaku tagihan harus antara 1 sampai 30 hari | rpc_buat_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0071 | Tagihan Mayar tidak ditemukan atau bukan berstatus aktif | rpc_tutup_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0072 | Jumlah tagihan tidak sesuai dengan total pesanan | rpc_sistem_lunaskan_dari_mayar | Aktif Digunakan (Modul Mayar). |
| E0073 | Hanya Manajer yang berwenang mengelola tagihan Mayar | rpc_buat_tagihan_mayar, rpc_tutup_tagihan_mayar | Aktif Digunakan (Modul Mayar). |
| E0074 | Hanya pengaju yang berwenang membatalkan pengajuan pembelian | rpc_batalkan_pembelian | Aktif Digunakan (Fitur Pembatalan PO, PRD Bab 6.2). |
| E0075 | Hanya Manajer yang berwenang membatalkan pembelian yang disetujui | rpc_batalkan_pembelian | Aktif Digunakan (Fitur Pembatalan PO, PRD Bab 6.2). |
| E0076 | Pembelian dengan status ini tidak dapat dibatalkan | rpc_batalkan_pembelian | Aktif Digunakan (Fitur Pembatalan PO, PRD Bab 6.2). |
| E0077 | Pembelian yang sudah diterima barangnya tidak dapat dibatalkan | rpc_batalkan_pembelian | Aktif Digunakan (Fitur Pembatalan PO, PRD Bab 6.2). |
| E0078 | Hanya Manajer yang berwenang mencatat pelunasan | rpc_catat_pelunasan, catatPelunasanAction | Aktif Digunakan (Koreksi Pelunasan Manajer, PRD BR-07, BR-12). |

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
| TC-49 | supabase/tests/05_stock_opname.sql, src/features/stock-opname/__tests__/schemas.test.ts | SQL + Vitest | Otomatis | Validasi keterangan selisih opname minimal 10 karakter (E0037) |
| TC-50 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Format alasan mutasi kartu stok: Stock opname <nomor>: <keterangan> |
| TC-51 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Pengaman anti-drift: perubahan stok fisik membatalkan persetujuan opname (E0038) |
| TC-52 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Persetujuan opname sukses bila saldo stok stabil |
| TC-53 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Validasi tanggal operasional bisnis opname berbasis Asia/Jakarta |
| TC-54 | supabase/tests/05_stock_opname.sql | SQL | Otomatis | Siklus lengkap inventarisasi rak gudang fisik hingga posting mutasi |
| TC-55 | supabase/tests/06_persetujuan_harga.sql, src/features/pesanan/__tests__/persetujuan.test.ts | SQL + Vitest | Otomatis | Pengajuan persetujuan harga draf di bawah HPP oleh Staf Penjualan |
| TC-56 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan pengajuan persetujuan harga oleh non-penjualan (E0039) |
| TC-57 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan pengajuan persetujuan harga pada pesanan non-draf (E0040) |
| TC-58 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan pengajuan ganda untuk draf yang sama (E0041) |
| TC-59 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan pengajuan jika semua harga di atas HPP (E0042) |
| TC-60 | supabase/tests/06_persetujuan_harga.sql, src/features/pesanan/__tests__/persetujuan.test.ts | SQL + Vitest | Otomatis | Alasan penolakan Manajer minimal 10 karakter (E0044) |
| TC-61 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Persetujuan dispensasi harga oleh Manajer & masa berlaku 24 jam |
| TC-62 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Konfirmasi pesanan dengan persetujuan harga efektif berhasil memotong stok |
| TC-63 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan konfirmasi saat dispensasi harga telah kedaluwarsa 24 jam (BR-04 verbatim) |
| TC-64 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Deteksi manipulasi isi item draf (drift hash) membatalkan persetujuan |
| TC-65 | supabase/tests/06_persetujuan_harga.sql, src/features/pesanan/__tests__/persetujuan.test.ts | SQL + Vitest | Otomatis | Pembatalan pengajuan dispensasi harga oleh staf pembuat |
| TC-66 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Penolakan pembatalan pengajuan oleh pihak lain / non-menunggu (E0001/E0045) |
| TC-67 | supabase/tests/06_konkurensi_persetujuan.ps1 | PowerShell Konkurensi | Otomatis | 10 iterasi konkurensi paralel konfirmasi vs persetujuan bebas deadlock |
| TC-68 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Zero leakage: penolakan akses Penjualan & Gudang ke v_persetujuan_harga_manajer |
| TC-69 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Invalidasi otomatis persetujuan harga saat draf pesanan diperbarui |
| TC-70 | supabase/tests/06_persetujuan_harga.sql | SQL | Otomatis | Pembatalan otomatis persetujuan harga saat draf pesanan dibatalkan |
| TC-71 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: batas tepat 'hari_ini' (Asia/Jakarta) |
| TC-72 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: kategori 'segera' (1-3 hari ke depan) |
| TC-73 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: kategori 'belum_jatuh_tempo' (>3 hari ke depan) |
| TC-74 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: keterlambatan 'overdue_1_7' |
| TC-75 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: keterlambatan 'overdue_8_30' |
| TC-76 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Klasifikasi umur tagihan: keterlambatan 'overdue_lebih_30' |
| TC-77 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Isolasi visibilitas Penjualan pada daftar v_tagihan (RLS) |
| TC-78 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Pemblokiran total akses Staf Gudang pada modul penagihan (E0001) |
| TC-79 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Hak baca penuh Manajer pada seluruh faktur terkirim belum lunas |
| TC-80 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Sifat append-only tabel catatan_penagihan dilindungi trigger guard (E0051) |
| TC-81 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Validasi panjang isi catatan penagihan 3 s.d. 500 karakter (E0047) |
| TC-82 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Validasi tanggal janji bayar wajib dan larangan tanggal lampau (E0048/E0049) |
| TC-83 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Penentuan dinamis janji bayar terlewat pada tagihan belum lunas |
| TC-84 | src/features/penagihan/__tests__/utils.test.ts | Vitest | Otomatis | Normalisasi nomor telepon standar internasional Indonesia (628...) |
| TC-85 | src/features/penagihan/__tests__/utils.test.ts | Vitest | Otomatis | Penolakan nomor telepon rumah/pendek/rusak untuk link WhatsApp |
| TC-86 | src/features/penagihan/__tests__/utils.test.ts | Vitest | Otomatis | Komposisi pesan penagihan formal dan encoding URL wa.me aman |
| TC-87 | src/features/penagihan/actions.ts | Integrasi | Otomatis | Auto-recording riwayat interaksi pengingat_wa ke database |
| TC-88 | supabase/tests/07_penagihan_piutang.sql | SQL | Otomatis | Pelunasan faktur oleh Manajer menghapus seketika dari v_tagihan |
| TC-89 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Impor CSV barang valid (stok 0, tanpa HPP) dengan nomor IMP-YYYY-XXXX |
| TC-90 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Impor CSV barang dengan stok awal & HPP (mutasi saldo awal resmi & invarian terpenuhi) |
| TC-91 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Impor CSV pelanggan valid (batas kredit & termin tempo 0, 7, 14, 30 hari) |
| TC-92 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Deteksi kode duplikat internal berkas CSV membatalkan transaksi (E0056) |
| TC-93 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Penolakan kode yang sudah terdaftar di sistem database (E0057, insert-only) |
| TC-94 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Penolakan harga_jual nol atau negatif (E0028) |
| TC-95 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Penolakan format angka pecahan/desimal pada kuantitas & rupiah (E0058) |
| TC-96 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Normalisasi pemisah ribuan titik/koma ke integer murni |
| TC-97 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Penolakan nilai termin hari selain 0, 7, 14, 30 (E0024) |
| TC-98 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Penolakan struktur kolom header salah atau tidak lengkap (E0053) |
| TC-99 | supabase/tests/08_impor_csv.sql, src/features/impor/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Penolakan berkas CSV kosong atau hanya baris header (E0054) |
| TC-100 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Penolakan berkas melebihi batas 1.000 baris data (E0055) |
| TC-101 | src/features/impor/actions.ts | Server Action | Otomatis | Penolakan berkas melebihi ukuran 1 MB (E0062) |
| TC-102 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Auto-detect pemisah koma (,) vs titik koma (;) standar RFC 4180 |
| TC-103 | src/features/impor/__tests__/utils.test.ts | Vitest | Otomatis | Pembersihan transparan karakter UTF-8 BOM (\uFEFF) |
| TC-104 | src/features/impor/actions.ts | Server Action | Otomatis | Penolakan berkas biner non-CSV (.xlsx / .xls) (E0061) |
| TC-105 | supabase/tests/08_impor_csv.sql | SQL | Otomatis | Atomisitas transaksi (all-or-nothing rollback saat ditemukan 1 galat) |
| TC-106 | supabase/tests/08_impor_csv.sql | SQL | Otomatis | Validasi ulang lapisan RPC database otoritatif menolak bypass client |
| TC-107 | supabase/tests/08_impor_csv.sql, src/lib/akses.ts | SQL + Route Guard | Otomatis | Pemblokiran total akses Staf Penjualan & Gudang ke fitur impor (E0001/403) |
| TC-108 | supabase/tests/08_impor_csv.sql | SQL | Otomatis | Zero-leakage data finansial rahasia pada impor_data dan audit_log |
| TC-109 | supabase/migrations/20261023023000_impor_csv.sql | SQL / Constraint | Otomatis | Ketahanan balapan dua berkas konkuren berkat constraint unik database |
| TC-110 | src/features/impor/__tests__/utils.test.ts | End-to-End | Otomatis | Verifikasi siklus templat siap pakai dapat diunduh dan diimpor 100% |
| TC-111 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Akurasi agregat widget dasbor tugas harian Penjualan (5 metrik) |
| TC-112 | supabase/tests/09_pusat_tugas.sql | SQL | Otomatis | Isolasi kepemilikan data Penjualan di dasbor (RLS filter auth.uid()) |
| TC-113 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Akurasi agregat widget dasbor Gudang & kalkulasi umur pesanan tertua |
| TC-114 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Akurasi agregat widget dasbor Manajer (6 metrik terpadu) |
| TC-115 | supabase/tests/09_pusat_tugas.sql | SQL Direct Call | Otomatis | Performa single-call rpc_get_tugas_harian (<50ms) & penolakan anon |
| TC-116 | supabase/tests/09_pusat_tugas.sql, src/lib/akses.ts | SQL + Route Guard | Otomatis | Pemblokiran total Staf Penjualan pada rute picking list (403/E0065) |
| TC-117 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/actions.ts | SQL + UI | Otomatis | Pembuatan picking list untuk 1 pesanan valid berstruktur JSONB |
| TC-118 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Agregasi multi-pesanan (penggabungan kuantitas barang sama, kode ASC) |
| TC-119 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/__tests__/utils.test.ts | SQL + Vitest | Otomatis | Deteksi indikator ketersediaan stok fisik (stok_cukup = false jika defisit) |
| TC-120 | supabase/tests/09_pusat_tugas.sql | SQL | Otomatis | Penolakan array daftar pesanan kosong atau NULL (E0063) |
| TC-121 | supabase/tests/09_pusat_tugas.sql | SQL | Otomatis | Penolakan pesanan bukan berstatus dikonfirmasi (E0064) |
| TC-122 | supabase/tests/09_pusat_tugas.sql | SQL | Otomatis | Penolakan pesanan dengan ID palsu atau tidak dikenal (E0064) |
| TC-123 | supabase/tests/09_pusat_tugas.sql, src/features/pusat-tugas/types.ts | SQL + DOM | Otomatis | Zero-leakage data finansial rahasia pada respons JSON & UI picking |
| TC-124 | src/features/pusat-tugas/components/picking-workspace.tsx | UI Inspection | Otomatis | Kelengkapan cetak resmi kop, waktu WIB, petugas, ceklis (@media print) |
| TC-125 | src/features/pusat-tugas/components/tugas-hari-ini.tsx | UI Inspection | Otomatis | Netralitas angka 0 (slate-400) dan penanganan empty state |
| TC-126 | supabase/tests/10_analitik.sql | SQL | Otomatis | Akurasi agregat performa sales (omzet, HPP, margin kotor, pesanan selesai) |
| TC-127 | supabase/tests/10_analitik.sql | SQL | Otomatis | Penanganan staf penjualan dengan 0 transaksi (omzet 0, margin % = 0) |
| TC-128 | supabase/tests/10_analitik.sql | SQL | Otomatis | Akurasi perhitungan piutang berjalan per staf penjualan |
| TC-129 | supabase/tests/10_analitik.sql | SQL | Otomatis | Akurasi kontribusi omzet top pelanggan terhadap total periode perusahaan |
| TC-130 | supabase/tests/10_analitik.sql | SQL | Otomatis | Penentuan status kelayakan kredit dinamis (overdue / overlimit / lancar) |
| TC-131 | supabase/tests/10_analitik.sql | SQL | Otomatis | Pembatasan kuota baris top pelanggan (safe limit guard maks 50) |
| TC-132 | supabase/tests/10_analitik.sql | SQL | Otomatis | Deteksi pelanggan tidak aktif (dormant customer) >= ambang hari |
| TC-133 | supabase/tests/10_analitik.sql | SQL | Otomatis | Penanganan pelanggan baru tanpa order (pesanan_terakhir NULL, hitung hari dibuat) |
| TC-134 | supabase/tests/10_analitik.sql | SQL | Otomatis | Eksklusi pelanggan berstatus nonaktif (aktif = false) dari daftar dormant |
| TC-135 | supabase/tests/10_analitik.sql | SQL | Otomatis | Deteksi barang tidak bergerak (dead stock) dengan stok fisik > 0 |
| TC-136 | supabase/tests/10_analitik.sql | SQL | Otomatis | Kalkulasi modal tertahan (dead capital = stok * harga_pokok) |
| TC-137 | supabase/tests/10_analitik.sql | SQL | Otomatis | Eksklusi barang dengan stok fisik nol dari analitik dead stock |
| TC-138 | supabase/tests/10_analitik.sql | SQL | Otomatis | Penanganan barang baru belum pernah terjual (hitung hari dari mutasi masuk) |
| TC-139 | supabase/tests/10_analitik.sql | SQL | Otomatis | Pemblokiran total akses Staf Penjualan pada seluruh RPC analitik (E0001) |
| TC-140 | supabase/tests/10_analitik.sql | SQL | Otomatis | Pemblokiran total akses Staf Gudang pada seluruh RPC analitik (E0001) |
| TC-141 | supabase/migrations/20261023043000_analitik.sql | SQL | Otomatis | Pemblokiran pengguna anonim / non-authenticated (REVOKE ALL) |
| TC-142 | src/lib/akses.ts | Route Guard | Otomatis | Proteksi route guard halaman /analitik (HTTP 403 untuk non-Manajer) |
| TC-143 | src/app/api/analitik/csv/route.ts | Server Route | Otomatis | Proteksi endpoint ekspor CSV analitik (HTTP 403 untuk non-Manajer) |
| TC-144 | src/features/analitik/types.ts | DOM / Network | Otomatis | Zero-leakage data rahasia HPP, margin, dan modal tertahan pada non-Manajer |
| TC-145 | src/features/analitik/__tests__/utils.test.ts | Vitest | Otomatis | Integritas ekspor CSV UTF-8 BOM dan pencegahan spreadsheet formula injection |
| TC-146 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Akses surat jalan pesanan dikirim oleh Staf Gudang |
| TC-147 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Akses surat jalan pesanan dikirim oleh Manajer |
| TC-148 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Akses surat jalan pesanan dikirim oleh Sales pemilik pesanan |
| TC-149 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Penolakan akses surat jalan pesanan dikirim oleh Sales non-pemilik |
| TC-150 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Penolakan surat jalan untuk pesanan berstatus draf (pesan netral) |
| TC-151 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Penolakan surat jalan untuk pesanan berstatus dikonfirmasi |
| TC-152 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Penolakan surat jalan untuk pesanan berstatus lunas dan dibatalkan |
| TC-153 | supabase/tests/11_surat_jalan.sql, src/features/pesanan/__tests__/surat-jalan.test.ts | SQL + Vitest | Otomatis | Verifikasi katalog kolom view v_surat_jalan 100% bebas dari data uang |
| TC-154 | src/app/(dashboard)/pesanan/[id]/surat-jalan/page.tsx | UI Inspection | Otomatis | Kelengkapan cetak A4 kop CV Sinar Abadi Niaga, tgl WIB, 3 kotak TTD |
| TC-155 | src/features/pesanan/components/pesanan-actions.tsx | UI + Vitest | Otomatis | Tombol Cetak Surat Jalan hanya muncul pada pesanan berstatus dikirim |
| TC-156 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Kriteria inklusif stok menipis (stok = minimum disertakan) |
| TC-157 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Eksklusi barang dengan stok di atas minimum (stok > minimum) |
| TC-158 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Eksklusi barang berstatus nonaktif dari daftar stok menipis |
| TC-159 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Kriteria stok 0 dan minimum 0 disertakan (0 <= 0) |
| TC-160 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Penerima notifikasi hanya akun Manajer dan Gudang aktif (Penjualan dieksklusi) |
| TC-161 | src/features/notifikasi/service.ts | Vitest / Service | Otomatis | Daftar barang kosong tidak mengirim email dan status dicatat dilewati |
| TC-162 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Idempotensi harian: klaim kedua pada hari yang sama ditolak (boleh_kirim = false) |
| TC-163 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Retry pada status pengiriman gagal diizinkan untuk mengulang |
| TC-164 | src/features/notifikasi/__tests__/email-stok.test.ts | Route Handler | Otomatis | Otentikasi token cron: tanpa Bearer token atau token salah ditolak HTTP 401 |
| TC-165 | src/features/notifikasi/__tests__/email-stok.test.ts | Route Handler | Otomatis | Penolakan metode GET pada route cron (HTTP 405 Method Not Allowed) |
| TC-166 | src/features/notifikasi/__tests__/email-stok.test.ts | Vitest | Otomatis | Mode sandbox mengirim 1 email ke EMAIL_SANDBOX_TO dengan banner MODE UJI |
| TC-167 | src/features/notifikasi/__tests__/email-stok.test.ts | Vitest | Otomatis | Mode live mengirim email terpisah per penerima dengan Idempotency-Key |
| TC-168 | src/features/notifikasi/__tests__/email-stok.test.ts | Vitest | Otomatis | Sanitasi HTML XSS escaping dan pemotongan baris pada batas 100 barang |
| TC-169 | src/features/notifikasi/__tests__/email-stok.test.ts | Vitest | Otomatis | Zero-leakage data finansial rahasia pada seluruh payload email |
| TC-170 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Hak akses database rpc_sistem_* dicabut dari authenticated/anon (service_role only) |
| TC-171 | supabase/tests/12_notifikasi_email.sql, src/lib/akses.ts | SQL + Route Guard | Otomatis | Otorisasi rpc_riwayat_notifikasi_manajer & rute /notifikasi khusus Manajer |
| TC-172 | supabase/tests/12_notifikasi_email.sql | SQL | Otomatis | Rate limiting tombol uji kirim dibatasi 1 kali per menit |
| TC-173 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Pembuatan tagihan sukses via MockMayarClient & HttpMayarClient |
| TC-174 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Penolakan tagihan pada pesanan berstatus selain dikirim (E0067) |
| TC-175 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Idempotensi tagihan aktif (hanya 1 tagihan aktif per pesanan) |
| TC-176 | src/features/pembayaran/actions.ts | Action | Otomatis | Validasi email pelanggan dan normalisasi nomor telepon 628xxx |
| TC-177 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Penutupan tagihan aktif oleh Manajer (status ditutup) |
| TC-178 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Penutupan otomatis tagihan Mayar aktif saat pelunasan manual |
| TC-179 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Verifikasi token webhook constant-time (timingSafeEqual) |
| TC-180 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Penolakan webhook token tidak cocok menghasilkan 404 |
| TC-181 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Penolakan metode selain POST pada webhook (HTTP 405) |
| TC-182 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Penolakan payload webhook melebihi 100 KB (HTTP 413) |
| TC-183 | src/features/pembayaran/__tests__/mayar.test.ts | Vitest | Otomatis | Penolakan format JSON rusak pada webhook (HTTP 400) |
| TC-184 | src/features/pembayaran/__tests__/mayar.test.ts, supabase/tests/13_tautan_bayar_mayar.sql | Vitest + SQL | Otomatis | Verifikasi 2 arah: payment.received memicu GET /invoice ke API Mayar |
| TC-185 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Idempotensi webhook event (event_id sama tidak diproses ulang) |
| TC-186 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Penanganan anomali nominal dialihkan ke status perlu_tinjau |
| TC-187 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Pelunasan otomatis via rpc_sistem_lunaskan_dari_mayar |
| TC-188 | src/app/pembayaran/selesai/page.tsx | Build | Otomatis | Halaman pembayaran selesai statis, noindex, dan bebas sesi DB |
| TC-189 | src/middleware.ts | Middleware | Otomatis | Middleware meloloskan /pembayaran/selesai tanpa sesi auth |
| TC-190 | Select-String .next\static | PowerShell | Otomatis | Zero-leakage data finansial rahasia pada seluruh modul pembayaran |
| TC-191 | src/lib/akses.ts | Route Guard | Otomatis | Otorisasi UI: Hanya Manajer yang dapat mengakses rute /pembayaran |
| TC-192 | supabase/tests/13_tautan_bayar_mayar.sql | SQL | Otomatis | Hak akses database: rpc_sistem_* dicabut dari anon dan authenticated |
| TC-193 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Ambang batas data cukup: < 3 pesanan berstatus data_kurang |
| TC-194 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Ambang batas data cukup: rentang < 60 hari berstatus data_kurang |
| TC-195 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Ketepatan bayar batas WIB: pelunasan hari tempo 23:59:59 dihitung 0 hari |
| TC-196 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Skenario 2 hitung tangan: 4 pilar dihitung presisi, skor 100 |
| TC-197 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Batas skor kelas: rentang skor ke kelas risiko A-E |
| TC-198 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Skenario 3 override kelas: overdue > 30 hari memicu penalti kelas E |
| TC-199 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Formula rekomendasi limit: batas atas, median, bawah konsisten |
| TC-200 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Pembulatan ke bawah kelipatan Rp100.000 pada nominal rekomendasi |
| TC-201 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Cap rekomendasi limit 3x faktur terbesar 12 bulan terakhir |
| TC-202 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Cap kenaikan limit 1.5x limit saat ini (bila limit berjalan > 0) |
| TC-203 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Plafon berjalan Rp0 tidak dibatasi 1.5x (mengikuti cap 3x omzet) |
| TC-204 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Rekomendasi limit kelas E selalu bernilai Rp0 |
| TC-205 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Eksekusi fungsi fn_simulasi_limit_kredit mengembalikan sisa & utilisasi baru |
| TC-206 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Aksi terapkan rekomendasi memanggil rpc_set_batas_kredit & tercatat di audit log |
| TC-207 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Hak akses database: fungsi khusus Manajer menolak Penjualan & Gudang (E0001) |
| TC-208 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Advisory warning editor pesanan: status terlambat_tinjau |
| TC-209 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Advisory warning editor pesanan: kelas risiko D atau E |
| TC-210 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Advisory warning bersifat non-blocking terhadap draf & konfirmasi |
| TC-211 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Perhitungan status tinjau limit kredit (>= 90 hari = perlu_tinjau) |
| TC-212 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Pelanggan baru 0 pesanan menghasilkan data_kurang tanpa pembagian nol |
| TC-213 | supabase/tests/14_pemantauan_kredit.sql | SQL | Otomatis | Eksekusi fn_daftar_pemantauan_kredit menghasilkan data pemantauan utuh |
| TC-214 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Pengaju membatalkan PO diajukan berhasil mengubah status ke dibatalkan |
| TC-215 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Bukan pengaju (staf gudang lain) membatalkan PO diajukan ditolak (E0074) |
| TC-216 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Manajer bukan pengaju membatalkan PO diajukan ditolak (E0074, harus tolak PO) |
| TC-217 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Manajer membatalkan PO disetujui (belum diterima) berhasil |
| TC-218 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Gudang membatalkan PO disetujui ditolak (E0075) |
| TC-219 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Membatalkan PO yang sudah berstatus diterima ditolak (E0076) |
| TC-220 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Membatalkan PO yang sudah ditolak atau dibatalkan ditolak (E0076) |
| TC-221 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Penerimaan barang pada PO yang dibatalkan ditolak (E0019) |
| TC-222 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Pembatalan PO terbukti tidak mengubah stok maupun harga_pokok |
| TC-223 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Audit log mencatat nilai_lama dan nilai_baru pembatalan PO secara lengkap |
| TC-224 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Zero-leakage: harga_beli_satuan tidak muncul di view/respons Gudang |
| TC-225 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Penghitung PO aktif dasbor & restock mengecualikan PO dibatalkan |
| TC-226 | supabase/tests/15_pembatalan_pembelian.sql | SQL | Otomatis | Pemanggilan rpc_batalkan_pembelian langsung oleh Penjualan ditolak (E0001) |
| TC-227 | src/features/pembelian/__tests__/schemas.test.ts | Vitest | Otomatis | Validasi schema batalkanPembelianSchema (alasan opsional) |
| TC-228 | supabase/tests/15_konkurensi_pembatalan.ps1 | PowerShell Konkurensi | Otomatis | Konkurensi penerimaan vs pembatalan PO bersamaan: 1 pemenang, 0 deadlock |
| TC-229 | supabase/tests/16_koreksi_pelunasan.sql | SQL | Otomatis | Staf Penjualan (Rina) memanggil rpc_catat_pelunasan langsung ditolak (E0078) |
| TC-230 | supabase/tests/16_koreksi_pelunasan.sql | SQL | Otomatis | Manajer (Hendra) mencatat pelunasan pesanan dikirim berhasil, isi dilunasi_pada, audit_log pelunasan |
| TC-231 | supabase/tests/16_koreksi_pelunasan.sql | SQL | Otomatis | Manajer melunasi pesanan draf ditolak (E0015) |
| TC-232 | supabase/tests/16_koreksi_pelunasan.sql | SQL | Otomatis | Pelunasan ulang pesanan yang sudah berstatus lunas ditolak (E0015) |
| TC-233 | src/features/pesanan/__tests__/pelunasan-ui.test.ts | Vitest + SQL | Otomatis | Tombol Catat Lunas tersembunyi bagi Penjualan di UI, tombol WA tetap aktif, sistem bebas denda |
| TC-234 | supabase/tests/17_laporan_prd_bab_9.sql | SQL + Vitest | Otomatis | RPC rpc_laporan_bottom_barang mengembalikan 5 barang margin terendah pada pesanan dikirim/lunas |
| TC-235 | supabase/tests/17_laporan_prd_bab_9.sql | SQL + Vitest | Otomatis | RPC rpc_laporan_aging_piutang mengembalikan tepat 3 kelompok: belum tempo, lewat 1-30, lewat >30 |
| TC-236 | supabase/tests/17_laporan_prd_bab_9.sql | SQL + Vitest | Otomatis | Invarian total aging == piutang berjalan (pesanan dikonfirmasi + dikirim) terbukti konsisten |
| TC-237 | supabase/tests/17_laporan_prd_bab_9.sql | SQL + Vitest | Otomatis | Dashboard Manajer default ke Bulan Berjalan (WIB), omzet pesanan dikirim & lunas menurut dikirim_pada |
| TC-238 | supabase/tests/17_laporan_prd_bab_9.sql | SQL + Vitest | Otomatis | Zero-leakage data finansial rahasia (HPP/margin) di dashboard dan laporan non-Manajer |

---

## G. Analisis Penyimpangan Terhadap docs/00-spesifikasi.md

| No | Komponen / Perilaku | Spesifikasi Awal (00-spesifikasi.md) | Implementasi Aktual Saat Ini | Tercatat di docs/04? | Penjelasan Rasional & Dampak Teknis |
|---|---|---|---|---|---|
| 1 | Nama tabel pesanan | pesanan_jual, item_pesanan_jual | pesanan_jual, item_pesanan_jual | Ya | Sesuai spesifikasi. |
| 2 | Tabel Modul Stock Opname | Belum ada (hanya penyesuaian manual di BR-11) | Ditambahkan tabel opname_stok dan item_opname_stok | Belum tercatat di docs/04 (Tercatat di docs/fitur-stock-opname.md) | Penambahan modul sesi audit fisik terstruktur dengan alur persetujuan Manajer. |
| 3 | Batas Kredit Pelanggan Baru | Batas kredit awal Rp0 | batas_kredit = 0 dipaksa oleh trigger saat dibuat non-Manajer | Ya (A10) | Mencegah Staf Penjualan memberikan kredit tanpa otorisasi Manajer. |
| 4 | Status Purchase Order (PO) | 4 status: diajukan, disetujui, ditolak, diterima | 5 status: diajukan, disetujui, ditolak, diterima, dibatalkan | Ya (A4, B1) | Ditambahkan status `dibatalkan` sesuai mandat PRD BR-09 & Bab 6.2 (pengaju batalkan diajukan, Manajer batalkan disetujui). |
| 5 | Pelunasan Piutang | Pelunasan pesanan (BR-07) | rpc_catat_pelunasan melunasi penuh 100% per faktur; HANYA peran Manajer yang berwenang mencatat pelunasan (PRD BR-07, BR-12). Tidak ada denda/bunga/biaya keterlambatan; tidak ada tabel pembayaran_piutang terpisah | Ya (B25, K5) | Pelunasan sebagian dan penagihan denda dinyatakan di luar lingkup sistem (PRD §14, BR-07, BR-12). |
| 6 | Bypass Kredit Manajer | Spesifikasi mengecualikan Manajer pada BR-04 | Manajer TIDAK BISA membypass limit kredit atau overdue di konfirmasi pesanan | Ya (B30, D5) | Untuk tata kelola risiko kredit, Manajer wajib menaikkan limit atau melunasi faktur terlebih dahulu (tercatat di audit log). |
| 7 | Koreksi harga_pokok Manual | Spesifikasi menyatakan HPP diupdate via PO (BR-10) | Manajer diizinkan memanggil rpc_ubah_harga_pokok | Ya (B31) | Diperlukan untuk mengisi HPP saldo awal sebelum PO pertama diterbitkan. |
| 8 | Struktur PO Multi-Barang | PO memiliki kolom barang_id dan jumlah_dipesan per baris PO | PO adalah single-item per dokumen (1 PO = 1 barang) | Ya | Mengikuti persis skema pembelian pada 00-spesifikasi.md poin III.5. Tidak ada tabel item_pembelian. |
| 9 | Dashboard & Laporan Manajer PRD Bab 9 | Metrik default mingguan di dokumen awal | Dashboard Manajer default ke Bulan Berjalan (WIB), grafik omzet & margin 8 minggu, aging piutang 3 bucket (total = piutang berjalan), bottom 5 margin produk, daftar PO diajukan di dashboard | Ya (PRD Bab 9) | Penyesuaian metrik manajerial strategis sesuai mandat PRD Bab 9. |

