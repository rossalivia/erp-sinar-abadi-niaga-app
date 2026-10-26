# Fitur: Koreksi Pelunasan Khusus Manajer (PRD BR-07, BR-12)

**Status:** Selesai Diimplementasikan  
**Penulis:** Antigravity / Full-Stack Engineer  
**Tanggal:** 2026-10-26  
**Rujukan PRD:** PRD Bab 6.1 (Pesanan Penjualan), BR-07 (Pelunasan Pesanan), BR-12 (Audit Log), Bab 8 (Piutang & Pembayaran)  
**Kode Error Baru:** `E0078` (*Hanya Manajer yang berwenang mencatat pelunasan*)  

---

## 1. Latar Belakang & Aturan Bisnis

Berdasarkan tinjauan kepatuhan PRD CV Sinar Abadi Niaga:
1. **PRD BR-07 & BR-12 (Otoritas Mutlak Manajer):**
   - HANYA peran Manajer yang berwenang mencatat pelunasan faktur penjualan (`pesanan_jual`).
   - Staf Penjualan dan Staf Gudang dilarang mencatat pelunasan baik melalui antarmuka pengguna (UI) maupun pemanggilan RPC langsung.
2. **Validasi Alur Status:**
   - Pelunasan hanya sah dilakukan pada pesanan berstatus `dikirim` (barang fisik sudah dikirim dan faktur diterbitkan).
   - Upaya melunasi pesanan yang masih berstatus `draf` atau pesanan yang sudah `lunas` ditolak dengan kode error `E0015` (*Perpindahan status atau tindakan tidak diizinkan*).
3. **Pencatatan Finansial & Jejak Audit (BR-12):**
   - Kolom `pesanan_jual.dilunasi_pada` wajib diisi dengan timestamp saat pelunasan berhasil dicatat (`clock_timestamp()`).
   - Mutasi status wajib dicatat pada `audit_log` dengan aksi `'pelunasan'`, memuat `nilai_lama` (`{"status":"dikirim"}`) dan `nilai_baru` (`{"status":"lunas","dilunasi_pada":...}`).
4. **Auto-Close Tagihan Mayar (M9):**
   - Jika pesanan memiliki tagihan pembayaran daring (Mayar) yang masih aktif (`status = 'dibuat'`), pelunasan manual oleh Manajer secara otomatis menutup status tagihan menjadi `'ditutup'`.
5. **Ketiadaan Fitur / Kolom Denda (Sesuai PRD):**
   - Sistem piutang CV Sinar Abadi Niaga tidak mengenal bunga, denda, atau penalti keterlambatan tagihan. Seluruh piutang murni 100% nominal pesanan jual. Fitur "estimasi denda" tidak diimplementasikan.

---

## 2. Arsitektur & Implementasi Teknis

### 2.1 Lapisan Basis Data (PostgreSQL RPC & Grants)
- **Fungsi `public.rpc_catat_pelunasan(p_pesanan_id uuid)`:**
  - `SECURITY DEFINER` dengan `SET search_path = public, pg_temp`.
  - Pemeriksaan hak akses di baris pertama: `IF NOT public.fn_is_manajer() THEN RAISE EXCEPTION 'Hanya Manajer yang berwenang mencatat pelunasan' USING ERRCODE = 'E0078'; END IF;`.
  - Kunci baris dengan `SELECT * FROM public.pesanan_jual WHERE id = p_pesanan_id FOR UPDATE;`.
  - Validasi status `v_pesanan.status = 'dikirim'`. Jika tidak, melempar `E0015`.
  - Memperbarui `pesanan_jual` (`status = 'lunas'`, `dilunasi_pada = clock_timestamp()`).
  - Menutup tagihan Mayar terkait (`status = 'ditutup'`).
  - Menyisipkan entri ke `public.audit_log` dengan `aksi = 'pelunasan'`.
- **Pencabutan & Pembatasan Hak Eksekusi:**
  - `REVOKE ALL ON FUNCTION public.rpc_catat_pelunasan(uuid) FROM PUBLIC, anon;`
  - `GRANT EXECUTE ON FUNCTION public.rpc_catat_pelunasan(uuid) TO authenticated;`

### 2.2 Lapisan Aplikasi & Server Action
- **`src/features/pesanan/actions.ts` (`catatPelunasanAction`):**
  - Mengambil profil pengguna terautentikasi melalui `getProfil()`.
  - Melakukan validasi peran `profil.peran === 'manajer'`. Jika bukan manajer, mengembalikan pesan galat `E0078`.
  - Memanggil `rpc_catat_pelunasan` ke Supabase.
  - Memperbarui cache rute: `/pesanan`, `/pesanan/[id]`, `/pelanggan`, `/penagihan`.
- **Katalog Error `src/lib/errors.ts`:**
  - Mendaftarkan `E0078: 'Hanya Manajer yang berwenang mencatat pelunasan'`.

### 2.3 Lapisan Antarmuka Pengguna (UI)
- **Halaman Penagihan (`/penagihan` — `TabelTagihan.tsx`):**
  - Tombol "Lunas" / "Catat Lunas" dibungkus kondisi ketat `{peran === 'manajer' && ...}`. Staf Penjualan tidak melihat tombol ini.
  - Tombol WhatsApp tetap tersedia bagi Staf Penjualan untuk mengirimkan pengingat penagihan yang ramah.
- **Halaman Detail Pesanan (`/pesanan/[id]` — `pesanan-actions.tsx`):**
  - Tombol "Catat Pelunasan" hanya dirender bila `canMarkPaid` bernilai true (`status === 'dikirim' && isManajer`).
- **Halaman Detail Pelanggan (`/pelanggan/[id]` — `pelanggan-detail-view.tsx`):**
  - Kolom aksi tabel faktur overdue hanya merender tombol "Catat Lunas" bila `isManajer` bernilai true. Untuk Staf Penjualan, hanya ditampilkan tautan "Detail &rarr;".

---

## 3. Matriks Hak Akses

| Operasi | Staf Penjualan (P) | Staf Gudang (G) | Manajer (M) | Lapisan Penegak |
|---|---|---|---|---|
| Mencatat Pelunasan Pesanan (`rpc_catat_pelunasan`) | ❌ Ditolak (`E0078`) | ❌ Ditolak (`E0078`) | ✅ Diizinkan | RPC `fn_is_manajer()`, `catatPelunasanAction` |
| Melihat Tombol "Catat Lunas" di UI | ❌ Tersembunyi | ❌ Tersembunyi | ✅ Tampil | Komponen UI (`peran === 'manajer'`) |
| Mengirim Pengingat WhatsApp di `/penagihan` | ✅ Diizinkan | ❌ Tidak ada menu | ✅ Diizinkan | Komponen `DialogWhatsApp` & util nomor |
| Pengenaan Denda / Bunga Keterlambatan | ❌ Tidak Ada | ❌ Tidak Ada | ❌ Tidak Ada | Skema kalkulasi piutang murni 100% |

---

## 4. Rincian Pengujian (Test Cases)

| Kode TC | Deskripsi Pengujian | Aktor | Media | Status |
|---|---|---|---|---|
| **TC-229** | Penolakan eksekusi pelunasan langsung oleh Staf Penjualan (Rina) dengan `E0078` | Staf Penjualan | SQL | **Lulus** |
| **TC-230** | Manajer (Hendra) mencatat pelunasan pesanan berstatus `dikirim` -> berhasil lunas, `dilunasi_pada` terisi, `audit_log` aksi `'pelunasan'` | Manajer | SQL | **Lulus** |
| **TC-231** | Penolakan pelunasan pesanan berstatus `draf` (`draf -> lunas`) dengan `E0015` | Manajer | SQL | **Lulus** |
| **TC-232** | Penolakan pelunasan ulang pesanan yang sudah berstatus `lunas` dengan `E0015` | Manajer | SQL | **Lulus** |
| **TC-233** | Verifikasi tombol UI (Catat Lunas hanya Manajer, WhatsApp tetap aktif untuk Penjualan) & sistem bebas denda | Penjualan, Manajer | Vitest + SQL | **Lulus** |
