# Spesifikasi Implementasi: Pemantauan dan Rekomendasi Kredit

**Dokumen Referensi:** PRD CV Sinar Abadi Niaga (Bab 6, 7, 9, 14), `docs/00-spesifikasi.md` (BR-05, BR-12), `docs/02-matriks-akses.md`, `docs/03-test-plan.md`, `docs/04-asumsi-dan-celah.md`, `docs/05-skema.md`, `docs/16-peta-sistem-saat-ini.md`, `docs/fitur-kredit-overdue.md`.  
**Peran Penyusun:** Tech Lead  
**Status Dokumen:** Siap Ditinjau (Fase Spesifikasi — Belum Mengubah Kode/SQL)  
**Tujuan Fitur:** Memberikan visibilitas terukur, skor perilaku, indikasi kelayakan kredit, rekomendasi limit, simulasi, dan peringatan dini di editor pesanan berbasis riwayat transaksi riil secara *read-only* tanpa mengubah aturan bisnis `BR-05`.

---

## 1. Audit Kondisi Saat Ini & Analisis Kesenjangan (Gap Analysis)

Berdasarkan hasil audit langsung terhadap basis data dan modul yang aktif di repositori saat ini:

| No | Kebutuhan Fitur (C1–C13) | Status Saat Ini | Lokasi di Repositori | Kesenjangan / Rencana Solusi |
|---|---|---|---|---|
| 1 | **Fungsi Sumber Kebenaran Piutang Berjalan** | Sudah Ada | `supabase/migrations/20261021140000_kredit_overdue.sql` (`fn_hitung_kredit_pelanggan`) | Fungsi ini menghitung `piutang_berjalan` = terkonfirmasi + terkirim dan mendeteksi faktur overdue. **Wajib dipakai ulang tanpa duplikasi logika** (C4). |
| 2 | **Pencatatan Perubahan Batas Kredit di `audit_log`** | Sudah Ada | `supabase/migrations/20261021120200_trigger_guard.sql` (`fn_audit_pelanggan`) | Perubahan limit otomatis dicatat dengan `nama_tabel = 'pelanggan'`, `aksi = 'ubah_batas_kredit'`, dan timestamp `dibuat_pada`. Kueri `MAX(dibuat_pada)` dari log ini digunakan untuk menghitung `hari_sejak_tinjau_limit`. Bila belum pernah diubah, fallback ke `pelanggan.dibuat_pada`. |
| 3 | **Format Penyimpanan Tanggal Pelunasan** | Sudah Ada | `supabase/migrations/20261021120100_skema_inti.sql` (`pesanan_jual.dilunasi_pada`) | Kolom `dilunasi_pada` bertipe `timestamptz`, sedangkan `jatuh_tempo` bertipe `date`. **Solusi Kepatuhan (C3):** Komparasi wajib dikonversi eksplisit ke zona bisnis `(dilunasi_pada AT TIME ZONE 'Asia/Jakarta')::date` terhadap `jatuh_tempo`. |
| 4 | **Data Contoh Pelanggan di Basis Data** | Sudah Ada | `supabase/seed.sql` (5 pelanggan awal: PLG-1 s.d. PLG-5) | Pada kondisi seed awal, ke-5 pelanggan memiliki 0 riwayat pesanan selesai. **Sesuai C5:** 0 dari 5 pelanggan awal memenuhi syarat data cukup ($\ge 3$ lunas dan $\ge 28$ hari). Sistem aman mengevaluasi status sebagai `"Data belum cukup"` tanpa pembagian dengan nol. |
| 5 | **Jalur Tulis Batas Kredit oleh Manajer** | Sudah Ada | `supabase/migrations/20261021120600_rpc.sql` (`rpc_set_batas_kredit`) | Prosedur tersimpan ini sudah ada sejak T1, memvalidasi wewenang `fn_is_manajer()`, dan memicu trigger audit. **Tombol "Terapkan rekomendasi" wajib memakai prosedur ini tanpa membuat RPC mutasi baru** (C11). |
| 6 | **Ekstensibilitas Pusat Tugas Harian** | Sudah Ada | `supabase/migrations/20261023033000_pusat_tugas_picking.sql` & `src/features/pusat-tugas/` | Modul Pusat Tugas mendukung agregasi single-call per peran. Blok Manajer dapat diperluas dengan field `tinjau_limit_kredit` dan widget kartu baru menuju `/kredit?filter=perlu_tinjau` (C10). |
| 7 | **Fungsi Analisis Skor & Rekomendasi Kredit** | **Belum Ada** | *Baru* | Perlu migrasi baru untuk membuat fungsi STABLE: `fn_parameter_kredit()`, `fn_analisis_kredit_pelanggan()`, `fn_daftar_pemantauan_kredit()`, `fn_simulasi_limit_kredit()`, dan `fn_peringatan_editor_pesanan()` (C1, C4..C12). |
| 8 | **Halaman UI Pemantauan & Panel Penilaian** | **Belum Ada** | *Baru* | Perlu membuat halaman baru `/kredit` (khusus Manajer) dan menambahkan panel "Penilaian Kredit" di `/pelanggan/[id]` (khusus Manajer) (C11). |
| 9 | **Peringatan Ringan di Editor Pesanan** | Sebagian Ada | `src/features/pesanan/components/pesanan-editor.tsx` | Editor pesanan sudah menampilkan sisa kredit & overdue, namun belum memiliki banner non-blocking "Mendekati batas kredit (>80%)" dan "Lebih besar dari kebiasaan (>3x rata-rata)" dengan debounce 500ms (C9). |

---

## 2. Pernyataan Batasan PRD (Apa yang TIDAK Dilakukan)

Sesuai instruksi mutlak **BATAS PRD**, fitur ini berstatus **Read-Only Advisory** (Hanya Baca dan Memberi Saran). Berikut adalah daftar eksplisit hal-hal yang **TIDAK DILAKUKAN**:

1. **TIDAK mengubah aturan `BR-05`**: Plafon kredit dan blokir overdue tetap berlaku mutlak saat konfirmasi pesanan (`rpc_konfirmasi_pesanan`).
2. **TIDAK mengubah definisi fungsi transaksi yang sudah ada**: Hash definisi `rpc_konfirmasi_pesanan`, `rpc_set_batas_kredit`, dan `rpc_catat_pelunasan` tetap identik dan tidak tersentuh.
3. **TIDAK mengubah nilai piutang, status, total, atau stok**: Seluruh fungsi fitur ini berjenis `STABLE` / kueri murni.
4. **TIDAK mengubah limit secara otomatis**: Limit kredit pelanggan **tidak pernah** naik atau turun secara otomatis oleh sistem. Limit hanya berubah jika Manajer secara sadar mengklik tombol dan mengonfirmasi pemanggilan `rpc_set_batas_kredit`.
5. **TIDAK membuat tabel baru untuk menyimpan skor**: Semua metrik, skor, dan kelas dihitung secara dinamis (*on-the-fly*) saat dibaca. Tidak ada tabel `skor_kredit` atau sejenisnya.
6. **TIDAK menambah peran baru**: Tetap hanya 3 peran korporat (Penjualan, Gudang, Manajer).
7. **TIDAK menambahkan bunga, denda, cicilan, pembayaran sebagian, jaminan, diskon pelunasan cepat, atau retur barang**: Seluruh transaksi pesanan tetap 100% penuh per faktur.
8. **TIDAK menyentuh atau menyebut data finansial rahasia**: Tidak ada ketergantungan maupun eksposur terhadap kolom `harga_pokok`, `hpp_satuan`, `harga_beli_satuan`, atau `margin` di fungsi, view, aksi, maupun respons API.

---

## 3. Aturan Bisnis Baru (BR-15 s.d. BR-18)

Penomoran melanjutkan aturan bisnis baseline `BR-01` s.d. `BR-14`:

* **BR-15 (Kecukupan Data Riwayat Kredit)**:  
  Penilaian skor kredit (0–100) dan rekomendasi limit hanya dihitung apabila pelanggan memiliki minimal **3 faktur berstatus lunas** DAN rentang waktu sejak pesanan dikirim pertama kali minimal **28 hari kalender**. Pelanggan yang belum memenuhi kriteria ini dikelompokkan ke dalam kelas `"Data belum cukup"`, skor bernilai `NULL`, dan rekomendasi limit tidak diterbitkan (hanya menampilkan data riwayat yang ada dan catatan netral).
* **BR-16 (Klasifikasi Skor Perilaku & Override Risiko)**:  
  Skor perilaku (skala 0–100) dihitung dari 4 pilar: Ketepatan Pembayaran (bobot 50%), Deviasi Keterlambatan (bobot 20%), Kondisi Tagihan Saat Ini (bobot 20%), dan Kedalaman Riwayat Transaksi (bobot 10%). Rentang kelas: **A** ($\ge 85$), **B** ($70–84$), **C** ($50–69$), **D** ($< 50$).  
  *Aturan Khusus Override:* Pelanggan yang saat ini memiliki minimal 1 faktur berstatus dikirim yang telah melewati jatuh tempo lebih dari 30 hari kalender (`hari_overdue_terlama > 30`) **wajib langsung diturunkan ke Kelas D** secara otomatis tanpa memandang total skor komponen lainnya.
* **BR-17 (Kalkulasi Rekomendasi Batas Kredit & Pembatas Maksimal)**:  
  Rekomendasi batas kredit dihitung dari proyeksi kebutuhan belanja: `kebutuhan = (rata_belanja_30_hari / 30) * hari_eksposur * faktor_kelas` dengan `hari_eksposur = termin_hari + 3`. Rekomendasi dibatasi oleh dua pembatas (*cap*): (a) maksimal **3x nilai faktur lunas terbesar**, dan (b) jika limit saat ini $> 0$, maksimal **1,5x limit saat ini**. Hasil akhir dibulatkan ke bawah ke kelipatan **Rp100.000**. Pelanggan Kelas D tidak diberikan rekomendasi kenaikan limit dan ditandai status `"Tinjau penurunan"`.
* **BR-18 (Peringatan Dini Non-Blocking di Editor Pesanan)**:  
  Saat Staf Penjualan atau Manajer menyusun pesanan, sistem memberikan indikasi peringatan dini:
  1. *Mendekati Batas Kredit:* Tampil jika estimasi total pesanan $> 80\%$ dari sisa limit kredit yang tersedia.
  2. *Di Luar Kebiasaan:* Tampil jika pelanggan memiliki minimal 3 pesanan selesai dan estimasi total pesanan $> 3\times$ rata-rata nilai riwayat pesanan pelanggan.  
  Peringatan ini bersifat informatif, **tidak memblokir** penyimpanan draf maupun tombol konfirmasi pesanan, dan tidak menampilkan data rahasia pesanan milik sales lain.

---

## 4. Tabel Parameter & Rumus Lengkap

Seluruh konstanta perhitungan dikumpulkan di satu fungsi database sumber kebenaran (`public.fn_parameter_kredit()`):

| Parameter | Nama Teknis | Nilai Default | Keterangan & Rujukan Keputusan |
|---|---|---|---|
| Ambang Minimal Faktur Lunas | `min_faktur_lunas` | `3` | Syarat data cukup (C5) |
| Ambang Minimal Hari Menjadi Pelanggan | `min_lama_pelanggan_hari` | `28` | Dihitung sejak tanggal kirim pertama (C5) |
| Batas Bawah Jendela Belanja | `min_hari_jendela` | `28` | Batas bawah pembagi rata-rata belanja (C4) |
| Batas Atas Jendela Belanja | `max_hari_jendela` | `90` | Jendela evaluasi belanja berkala (C4) |
| Bobot Pilar Ketepatan Bayar | `bobot_tepat_waktu` | `50` | $50 \times \text{persen\_tepat\_waktu}$ (C6) |
| Bobot Pilar Keterlambatan | `bobot_keterlambatan` | `20` | $20 \times (1 - \min(\text{rata\_hari}, 14) / 14)$ (C6) |
| Hari Toleransi Maksimal Keterlambatan | `hari_toleransi_terlambat` | `14` | Keterlambatan $\ge 14$ hari bernilai skor 0 (C6) |
| Bobot Pilar Kondisi Saat Ini | `bobot_kondisi_sekarang` | `20` | Evaluasi faktur overdue aktif (C6) |
| - Skor Overdue 0 hari | `skor_overdue_nol` | `20` | Tidak ada tagihan tertunggak |
| - Skor Overdue 1–7 hari | `skor_overdue_1_7` | `10` | Keterlambatan ringan |
| - Skor Overdue 8–30 hari | `skor_overdue_8_30` | `5` | Keterlambatan sedang |
| - Skor Overdue > 30 hari | `skor_overdue_gt_30` | `0` | Keterlambatan berat (memaksa Kelas D) |
| Bobot Pilar Kedalaman Riwayat | `bobot_kedalaman` | `10` | $10 \times \min(\text{faktur\_lunas}, 10) / 10$ (C6) |
| Ambang Batas Skor Kelas A | `ambang_kelas_a` | `85` | Skor $\ge 85 \rightarrow$ Kelas A (C6) |
| Ambang Batas Skor Kelas B | `ambang_kelas_b` | `70` | Skor $70–84 \rightarrow$ Kelas B (C6) |
| Ambang Batas Skor Kelas C | `ambang_kelas_c` | `50` | Skor $50–69 \rightarrow$ Kelas C (C6) |
| Pengali Kebutuhan Kelas A | `faktor_kelas_a` | `1.50` | Kebutuhan $\times 1,5$ (C7) |
| Pengali Kebutuhan Kelas B | `faktor_kelas_b` | `1.25` | Kebutuhan $\times 1,25$ (C7) |
| Pengali Kebutuhan Kelas C | `faktor_kelas_c` | `1.00` | Kebutuhan $\times 1,0$ (C7) |
| Pengali Kebutuhan Kelas D | `faktor_kelas_d` | `0.00` | Tidak ada kenaikan limit (C7) |
| Jeda Hari Eksposur Kredit | `hari_jeda_eksposur` | `3` | Tambahan hari perputaran tagihan (C7) |
| Pengali Batas Faktur Terbesar | `faktor_cap_faktur_terbesar` | `3.0` | Maksimal $3\times$ faktur lunas terbesar (C7) |
| Pengali Batas Kenaikan Limit | `faktor_cap_kenaikan_limit` | `1.5` | Maksimal $1,5\times$ limit saat ini (C7) |
| Kelipatan Pembulatan Rekomendasi | `kelipatan_pembulatan` | `100000` | Dibulatkan ke bawah ke Rp100.000 (C7) |
| Ambang Status Tinjau Penurunan | `ambang_penurunan_persen` | `0.50` | Rekomendasi $< 50\%$ limit sekarang $\rightarrow$ Tinjau penurunan (C7) |
| Ambang Hari Perlu Tinjau Limit | `hari_perlu_tinjau` | `90` | $\ge 90$ hari sejak tinjau terakhir $\rightarrow$ Perlu ditinjau (C10) |
| Ambang Hari Terlambat Tinjau Limit | `hari_terlambat_tinjau` | `180` | $\ge 180$ hari sejak tinjau terakhir $\rightarrow$ Terlambat ditinjau (C10) |
| Ambang Peringatan Editor Limit | `ambang_peringatan_limit` | `0.80` | Pesanan $> 80\%$ sisa kredit (C9) |
| Pengali Peringatan Kebiasaan | `faktor_peringatan_kebiasaan` | `3.0` | Pesanan $> 3\times$ rata-rata pesanan (C9) |
| Minimal Pesanan Peringatan Kebiasaan | `min_pesanan_kebiasaan` | `3` | Syarat riwayat pesanan dikirim/lunas (C9) |

---

## 5. Contoh Hitung Tangan Tiga Skenario Sintetis

### Skenario 1: Pelanggan "Toko Permata Baru" (Data Belum Cukup)
- **Data Masukan:**
  - Tanggal dibuat: 1 Oktober 2026, Tanggal bisnis: 24 Oktober 2026.
  - Tanggal kirim pesanan pertama: 10 Oktober 2026 ($\text{lama\_hari} = 14\text{ hari}$).
  - Riwayat pesanan: 2 faktur lunas (Rp500.000 dan Rp700.000, keduanya tepat waktu).
  - Limit saat ini: Rp1.000.000, Termin: 14 hari.
- **Pemeriksaan Syarat Data Cukup (C5):**
  - $\text{faktur\_lunas} = 2$ ($< 3$, **Tidak Memenuhi**).
  - $\text{lama\_pelanggan\_hari} = 14$ ($< 28$, **Tidak Memenuhi**).
- **Hasil Evaluasi:**
  - `status_data`: `"Data belum cukup"`
  - `skor_perilaku`: `NULL`
  - `kelas`: `"Data belum cukup"`
  - `rekomendasi_limit`: `NULL`
  - `status_rekomendasi`: `NULL`
  - `pembatas_mengikat`: `NULL`
  - *Keterangan UI:* "Belum cukup riwayat transaksi untuk memberikan rekomendasi kredit (minimal 3 faktur lunas dan 28 hari riwayat belanja)."

---

### Skenario 2: Pelanggan "Minimarket Bintang Terang" (Kelas B, Rekomendasi Naik)
- **Data Masukan:**
  - Tanggal kirim pertama: 15 Juli 2026 ($\text{lama\_pelanggan\_hari} = 101\text{ hari} \ge 28$).
  - Riwayat faktur lunas: 6 faktur.
    - 4 faktur dibayar tepat waktu (selisih hari $\le 0$).
    - 2 faktur dibayar terlambat masing-masing 3 hari ($+3$ hari dan $+3$ hari).
  - Status tagihan saat ini: 0 faktur overdue ($\text{hari\_overdue\_terlama} = 0$).
  - Batas kredit saat ini: Rp2.000.000.
  - Termin pembayaran: 14 hari.
  - Faktur lunas terbesar: Rp2.500.000.
  - Total belanja dalam jendela 90 hari terakhir: Rp12.000.000.
- **Langkah 1: Perhitungan Metrik Dasar:**
  - $\text{persen\_tepat\_waktu} = 4 / 6 = 66,67\% = 0,6667$.
  - $\text{rata\_hari\_terlambat} = (0 + 0 + 0 + 0 + 3 + 3) / 6 = 6 / 6 = 1,00\text{ hari}$.
  - $\text{hari\_jendela} = \min(90, 101) = 90\text{ hari}$.
  - $\text{rata\_belanja\_per\_30\_hari} = (12.000.000 / 90) \times 30 = Rp4.000.000$.
- **Langkah 2: Perhitungan Skor Perilaku (0–100):**
  - Pilar 1 (Ketepatan Bayar): $0,6667 \times 50 = 33,33$.
  - Pilar 2 (Keterlambatan): $20 \times (1 - \min(1, 14) / 14) = 20 \times (1 - 0,0714) = 18,57$.
  - Pilar 3 (Kondisi Saat Ini): Overdue 0 hari $\rightarrow 20,00$.
  - Pilar 4 (Kedalaman Riwayat): $10 \times \min(6, 10) / 10 = 6,00$.
  - **Skor Total:** $\text{ROUND}(33,33 + 18,57 + 20,00 + 6,00) = \text{ROUND}(77,90) = \mathbf{78}$.
  - **Penentuan Kelas:** Skor $78 \rightarrow$ Berada di rentang $70–84 \rightarrow$ **Kelas B**.
- **Langkah 3: Perhitungan Rekomendasi Limit:**
  - $\text{hari\_eksposur} = \text{termin\_hari} + 3 = 14 + 3 = 17\text{ hari}$.
  - $\text{kebutuhan} = (\text{rata\_belanja\_per\_30\_hari} / 30) \times \text{hari\_eksposur} \times \text{faktor\_kelas\_B}$  
    $\text{kebutuhan} = (4.000.000 / 30) \times 17 \times 1,25 = 133.333,33 \times 21,25 = \mathbf{Rp2.833.333,33}$.
  - Evaluasi Pembatas (*Caps*):
    - Pembatas A ($3\times$ faktur terbesar): $3 \times 2.500.000 = Rp7.500.000$.
    - Pembatas B ($1,5\times$ limit sekarang): $1,5 \times 2.000.000 = Rp3.000.000$.
    - Nilai terkecil: $\min(2.833.333,33; 7.500.000; 3.000.000) = Rp2.833.333,33$.
    - *Pembatas Mengikat:* **Kebutuhan Riwayat Belanja**.
  - Pembulatan ke bawah kelipatan Rp100.000:
    $\text{rekomendasi\_limit} = \text{FLOOR}(2.833.333,33 / 100.000) \times 100.000 = \mathbf{Rp2.800.000}$.
  - Selisih terhadap limit saat ini: $2.800.000 - 2.000.000 = \mathbf{+Rp800.000}$.
  - Status Rekomendasi: **Naikkan** (Rekomendasi $> 2.000.000$).

---

### Skenario 3: Pelanggan "Toko Subur Sejati" (Kelas D, Rekomendasi Tinjau Penurunan)
- **Data Masukan:**
  - Tanggal kirim pertama: 1 Februari 2026 ($\text{lama\_pelanggan\_hari} = 265\text{ hari} \ge 28$).
  - Riwayat faktur lunas: 5 faktur (semua telat rata-rata 10 hari).
  - Status tagihan saat ini: Memiliki 1 faktur aktif yang jatuh tempo 35 hari yang lalu ($\text{hari\_overdue\_terlama} = 35\text{ hari} > 30$).
  - Batas kredit saat ini: Rp5.000.000.
  - Termin: 7 hari.
  - Faktur lunas terbesar: Rp3.000.000.
  - Total belanja 90 hari terakhir: Rp6.000.000 $\rightarrow \text{rata\_belanja\_30\_hari} = Rp2.000.000$.
- **Langkah 1: Evaluasi Override Risiko & Kelas:**
  - Karena $\text{hari\_overdue\_terlama} = 35 > 30$, aturan **BR-16** langsung menetapkan **Kelas D** secara paksa tanpa mempedulikan skor pilar lainnya.
  - (Skor indikator tetap dihitung: Misal Skor Total = 42).
- **Langkah 2: Perhitungan Rekomendasi Limit:**
  - Untuk Kelas D, $\text{faktor\_kelas\_D} = 0,00$ dan berlaku aturan C7: **Tidak ada kenaikan**.
  - Rekomendasi limit tidak boleh melebihi limit saat ini: $\text{rekomendasi\_mentah} = Rp5.000.000$ (atau jika dihitung berbasis penurunan, maksimal tidak melebihi limit saat ini).
  - *Pembatas Mengikat:* **Kebijakan Kelas D (Tidak Ada Kenaikan)**.
  - Status Rekomendasi: **Tinjau penurunan**.
  - Selisih terhadap limit saat ini: **Rp0** (atau penurunan bila disesuaikan).
  - *Keterangan UI:* "Pelanggan memiliki tunggakan melebihi 30 hari. Sistem menyarankan meninjau penurunan batas kredit."

---

## 6. Rancangan Fungsi Database (Postgres RPC & Security)

Seluruh fungsi baru dibuat melalui file migrasi baru (mis. `supabase/migrations/20261024170000_pemantauan_kredit.sql`), bersifat `STABLE`, tidak mengunci baris, dan tidak melakukan operasi penulisan apa pun.

### 6.1 `public.fn_parameter_kredit()`
* **Sifat:** `STABLE`, `SECURITY INVOKER`, `LANGUAGE sql`.
* **Tujuan:** Mengembalikan seluruh konstanta parameter kredit dalam satu baris (memudahkan konfigurasi terpusat dan pemeliharaan migrasi).
* **Hak Akses:** `GRANT EXECUTE ON FUNCTION public.fn_parameter_kredit() TO authenticated;`.

### 6.2 `public.fn_analisis_kredit_pelanggan(p_pelanggan_id uuid)`
* **Sifat:** `STABLE`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
* **Otorisasi:** Memeriksa `IF NOT public.fn_is_manajer() THEN RAISE EXCEPTION 'E0001: Akses ditolak'; END IF;` di baris pertama.
* **Tujuan:** Menghitung metrik lengkap, skor perilaku, rincian komponen pilar, kelas, rekomendasi limit, pembatas mengikat, dan status tinjau untuk satu pelanggan spesifik (digunakan oleh panel `/pelanggan/[id]`).
* **Struktur Output:**
  ```sql
  RETURNS TABLE (
    pelanggan_id              uuid,
    data_cukup                boolean,
    alasan_data_kurang        text,
    faktur_lunas              integer,
    tepat_waktu               integer,
    persen_tepat_waktu        numeric(5,2),
    rata_hari_terlambat       numeric(5,2),
    faktur_overdue_sekarang   integer,
    hari_overdue_terlama      integer,
    lama_pelanggan_hari       integer,
    faktur_lunas_terbesar     numeric(14,0),
    rata_nilai_pesanan        numeric(14,0),
    rata_belanja_per_30_hari  numeric(14,0),
    piutang_berjalan          numeric(14,0),
    pemakaian_limit_persen    numeric(5,2),
    skor_tepat_waktu          numeric(5,2),
    skor_keterlambatan        numeric(5,2),
    skor_kondisi_sekarang     numeric(5,2),
    skor_kedalaman            numeric(5,2),
    skor_total                integer,
    kelas                     text, -- 'A', 'B', 'C', 'D', atau 'Data belum cukup'
    kebutuhan_limit           numeric(14,0),
    rekomendasi_limit         numeric(14,0),
    selisih_limit             numeric(14,0),
    pembatas_mengikat         text,
    status_rekomendasi        text, -- 'Naikkan', 'Pertahankan', 'Tinjau penurunan'
    hari_sejak_tinjau_limit   integer,
    status_tinjau             text  -- 'normal', 'perlu_tinjau', 'terlambat'
  )
  ```

### 6.3 `public.fn_daftar_pemantauan_kredit()`
* **Sifat:** `STABLE`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
* **Otorisasi:** `fn_is_manajer()` only.
* **Tujuan:** Menghasilkan dataset seluruh pelanggan aktif dalam **satu panggilan set-returning** efisien (memenuhi target performa $< 2$ detik untuk 60+ pelanggan tanpa query loop N+1, C12).
* **Struktur Output:** Menghasilkan tabel baris ringkas untuk DataTable `/kredit` (kode, nama_toko, batas_kredit, kelas, skor_total, pemakaian_limit_persen, piutang_berjalan, hari_overdue_terlama, rekomendasi_limit, status_rekomendasi, status_tinjau).

### 6.4 `public.fn_simulasi_limit_kredit(p_pelanggan_id uuid, p_limit_hipotetik numeric)`
* **Sifat:** `STABLE`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
* **Otorisasi:** `fn_is_manajer()` only.
* **Tujuan:** Melakukan simulasi dampak limit baru hipotetik tanpa menulis apa pun (C8).
* **Struktur Output:**
  `limit_sekarang`, `limit_hipotetik`, `piutang_berjalan`, `pemakaian_persen_sekarang`, `pemakaian_persen_hipotetik`, `kebutuhan_rekomendasi`, `rekomendasi_resmi`, `selisih_terhadap_rekomendasi`, `total_limit_semua_sebelum`, `total_limit_semua_sesudah`.

### 6.5 `public.fn_peringatan_editor_pesanan(p_pelanggan_id uuid, p_total_estimasi numeric)`
* **Sifat:** `STABLE`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
* **Otorisasi:** `fn_peran() IN ('penjualan', 'manajer')`.
* **Tujuan:** Mengembalikan pesan teks statis netral tanpa angka rahasia pesanan lain untuk peringatan editor pesanan (C9).
* **Struktur Output:**
  ```sql
  RETURNS TABLE (
    jenis   text, -- 'mendekati_limit' atau 'kebiasaan_belanja'
    level   text, -- 'warning' atau 'info'
    pesan   text
  )
  ```

### 6.6 Indeks Pendukung Kueri Performa Tinggi (C12)
Untuk memastikan kalkulasi agregat 60 pelanggan dengan 1.000+ pesanan selesai dalam $< 200\text{ ms}$, migrasi akan menambahkan indeks komposit:
```sql
CREATE INDEX IF NOT EXISTS idx_pesanan_jual_kredit_calc
  ON public.pesanan_jual (pelanggan_id, status, dikirim_pada, dilunasi_pada, jatuh_tempo);

CREATE INDEX IF NOT EXISTS idx_audit_log_pelanggan_limit
  ON public.audit_log (data_id, dibuat_pada DESC)
  WHERE nama_tabel = 'pelanggan' AND aksi = 'ubah_batas_kredit';
```

---

## 7. Desain Antarmuka Pengguna (UI & Sistem Desain)

Sesuai aturan **Bagian 6 AGENTS.md**, antarmuka menggunakan Tailwind CSS enterprise korporat yang bersih (palet Slate, tanpa dekorasi berlebihan):

### 7.1 Halaman Pemantauan Kredit (`/kredit`) — Menu Baru Khusus Manajer
* **Header Halaman:** `PageHeader` dengan judul *"Pemantauan Kredit Pelanggan"*, subjudul *"Ikhtisar kesehatan piutang, kelas perilaku bayar, dan rekomendasi limit kredit toko"*.
* **Ringkasan Kartu Eksekutif (4 Kartu Ringkas):**
  1. *Distribusi Kelas:* Badge jumlah pelanggan per kelas (A: Hijau, B: Biru, C: Kuning, D: Merah, Belum Cukup: Abu).
  2. *Total Plafon Limit:* Total akumulasi limit semua pelanggan aktif.
  3. *Total Piutang Berjalan:* Total piutang aktif saat ini & rasio utilisasi portofolio.
  4. *Perlu Ditinjau:* Jumlah pelanggan yang melewati batas 90 hari atau 180 hari sejak evaluasi limit terakhir.
* **Tabel Data (DataTable):**
  - Kolom: Toko & Kode, Batas Kredit, Utilisasi %, Piutang Berjalan, Overdue Terlama, Kelas & Skor, Rekomendasi Limit, Status Tinjau, Aksi (Tautan ke Detail Pelanggan).
  - Filter Bar: Tab Filter Kelas (Semua, A, B, C, D, Belum Cukup), Checkbox "Utilisasi > 80%", Checkbox "Perlu Ditinjau", Checkbox "Memiliki Overdue", Kotak Pencarian Nama Toko.

### 7.2 Panel "Penilaian Kredit" di `/pelanggan/[id]` — Khusus Manajer
* **Otorisasi Server Component:** Panel dibungkus pengecekan `if (profile.peran !== 'manajer') return null;`. Payload data skor dan rekomendasi **tidak pernah dikirim ke browser Penjualan atau Gudang**.
* **Visualisasi Kelas & Skor:**
  - Lencana besar di samping nama: Badge Kelas A (emerald-50/text-emerald-800), B (blue-50/text-blue-800), C (amber-50/text-amber-800), D (red-50/text-red-800), Data belum cukup (slate-100/text-slate-700).
  - Label Wajib: *"Indikasi berdasarkan riwayat transaksi, bukan keputusan."*
* **Rincian Skor Komponen (4 Bar Progress Tipis):**
  - Ketepatan Bayar: Skor / 50 (persen tepat waktu).
  - Deviasi Keterlambatan: Skor / 20 (rata-rata hari telat).
  - Kondisi Saat Ini: Skor / 20 (status overdue terkini).
  - Kedalaman Riwayat: Skor / 10 (jumlah faktur selesai).
* **Rekomendasi Limit:**
  - Menampilkan angka saran limit baru, selisih nominal terhadap limit lama, dan lencana pembatas mengikat (mis. *"Dibatasi 3x Faktur Terbesar"* atau *"Dibatasi Kebutuhan Belanja"*).
* **Simulasi Limit Interaktif:**
  - Input angka limit hipotetik $\rightarrow$ secara otomatis menghitung proyeksi utilisasi % dan dampak terhadap total limit portofolio.
* **Tombol "Terapkan Rekomendasi":**
  - Membuka modal `ConfirmDialog` standar yang menampilkan perbandingan limit lama vs limit baru yang akan disimpan.
  - Saat dikonfirmasi, Server Action memanggil prosedur resmi yang sudah ada: `rpc_set_batas_kredit(p_pelanggan_id, rekomendasi_limit)` tanpa membuat jalur tulis baru.

### 7.3 Banner Peringatan di Editor Pesanan (`/pesanan/baru` dan `/pesanan/[id]/ubah`)
* **Target Pengguna:** Staf Penjualan dan Manajer.
* **Perilaku:**
  - Menggunakan hook kustom `useCreditAdvisory(pelangganId, totalPesanan)` dengan **debounce 500 ms**.
  - Menampilkan banner callout tipis di atas tombol simpan:
    - Kuning (`border-amber-200 bg-amber-50 text-amber-900`): *"Perhatian: Nilai pesanan ini mendekati sisa batas kredit pelanggan."*
    - Biru (`border-blue-200 bg-blue-50 text-blue-900`): *"Informasi: Nilai pesanan ini jauh lebih besar dari rata-rata riwayat belanja pelanggan."*
  - **Sifat:** Sepenuhnya informatif (non-blocking). Tombol "Simpan Draf" dan "Konfirmasi Pesanan" tetap dapat diklik, dan validasi limit kredit resmi `BR-05` tetap dieksekusi oleh database saat konfirmasi ditekan.
  - **Kerahasiaan:** Staf Penjualan tidak menerima kelas, skor angka, maupun data pesanan milik sales lain.

### 7.4 Integrasi Pusat Tugas Manajer (C10)
* Pada widget dasbor Pusat Tugas Manajer, ditambahkan counter tugas baru:
  - Judul: *"Tinjau Batas Kredit"*
  - Nilai: Jumlah pelanggan dengan status `perlu_tinjau` atau `terlambat`.
  - Tautan: `/kredit?filter=perlu_tinjau`.

---

## 8. Matriks Akses & Keamanan Data (RBAC Matrix)

| Rute / Aksi / Objek | Penjualan | Gudang | Manajer | Lapisan Penegak |
|---|---|---|---|---|
| Menu Sidebar `/kredit` | ❌ (Tersembunyi) | ❌ (Tersembunyi) | ✅ (Tampil) | `src/lib/akses.ts` & `Sidebar.tsx` |
| Halaman `/kredit` | ❌ (403 / Redirect) | ❌ (403 / Redirect) | ✅ (Akses Penuh) | Next.js Middleware + Server Component Guard |
| Panel Penilaian Kredit di `/pelanggan/[id]` | ❌ (Tidak Dirender) | ❌ (Tidak Dirender) | ✅ (Render Lengkap) | Server Component (`isManajer` check) |
| Server Action Ambil Data Kredit | ❌ (Galat E0001) | ❌ (Galat E0001) | ✅ (Diizinkan) | Server Action (`getProfil().peran === 'manajer'`) |
| RPC `fn_analisis_kredit_pelanggan` | ❌ (E0001) | ❌ (E0001) | ✅ (Diizinkan) | Postgres SECURITY DEFINER + `fn_is_manajer()` |
| RPC `fn_daftar_pemantauan_kredit` | ❌ (E0001) | ❌ (E0001) | ✅ (Diizinkan) | Postgres SECURITY DEFINER + `fn_is_manajer()` |
| RPC `fn_simulasi_limit_kredit` | ❌ (E0001) | ❌ (E0001) | ✅ (Diizinkan) | Postgres SECURITY DEFINER + `fn_is_manajer()` |
| RPC `fn_peringatan_editor_pesanan` | ✅ (Teks Statis) | ❌ (E0001) | ✅ (Teks Statis) | Postgres SECURITY DEFINER + Check Peran |
| Aksi Terapkan Rekomendasi Limit | ❌ (E0001) | ❌ (E0001) | ✅ (Diizinkan) | RPC `rpc_set_batas_kredit` (Eksisting) |

---

## 9. Rencana Pengujian Lengkap (Test Cases Baru & Regresi)

Penomoran melanjutkan test plan repositori yang terakhir (TC-192):

### 9.1 Test Cases Baru (TC-193 s.d. TC-213)

| ID | Fokus Uji | Aktor | Media | Kriteria Lolos (Definition of Done) |
|---|---|---|---|---|
| **TC-193** | Ambang batas data cukup: 2 vs 3 faktur lunas | M | SQL | Pelanggan dengan 2 faktur lunas menghasilkan `data_cukup = false`, kelas `"Data belum cukup"`, skor `NULL`. Begitu faktur ke-3 lunas, `data_cukup = true`. |
| **TC-194** | Ambang batas data cukup: 27 vs 28 hari riwayat | M | SQL | Pelanggan dengan 3 faktur lunas tetapi berumur 27 hari menghasilkan `"Data belum cukup"`. Pada hari ke-28 menghasilkan status data cukup. |
| **TC-195** | Ketepatan bayar di batas tanggal jatuh tempo (WIB vs UTC) | M | SQL | Pembayaran pada jam 23:59 WIB pada hari jatuh tempo dihitung tepat waktu (`tepat_waktu = true`); pembayaran jam 00:01 WIB keesokan harinya dihitung terlambat 1 hari. |
| **TC-196** | Akurasi skor perilaku & rincian komponen (Skenario 2) | M | Vitest + SQL | Hasil perhitungan skor total dan rincian 4 pilar persis dengan hitung tangan (Skor 78, Kelas B). |
| **TC-197** | Batas skor kelas A/B (85 vs 84) dan B/C (70 vs 69) | M | SQL | Skor 85 menghasilkan Kelas A; skor 84 menghasilkan Kelas B; skor 70 menghasilkan Kelas B; skor 69 menghasilkan Kelas C. |
| **TC-198** | Override overdue $> 30$ hari memaksa Kelas D (Skenario 3) | M | SQL | Pelanggan dengan total skor tinggi tetapi memiliki 1 faktur overdue 31 hari otomatis diklasifikasikan Kelas D. |
| **TC-199** | Rekomendasi limit sama dengan hitung tangan (Skenario 2 & 3) | M | Vitest + SQL | Nilai rekomendasi limit persis dengan hitung tangan (Rp2.800.000 untuk skenario 2). |
| **TC-200** | Pembatas mengikat: Kebutuhan Belanja | M | SQL | Kasus di mana kebutuhan belanja lebih kecil dari $3\times$ faktur terbesar dan $1,5\times$ limit saat ini menghasilkan pembatas `"Kebutuhan Riwayat Belanja"`. |
| **TC-201** | Pembatas mengikat: 3x Faktur Terbesar | M | SQL | Kasus di mana kebutuhan belanja melonjak tinggi tetapi tertahan oleh cap $3\times$ faktur terbesar menghasilkan pembatas `"3x Faktur Lunas Terbesar"`. |
| **TC-202** | Pembatas mengikat: 1,5x Limit Sekarang | M | SQL | Kasus di mana limit saat ini membatasi lonjakan menghasilkan pembatas `"1,5x Limit Sekarang"`. |
| **TC-203** | Pelanggan limit Rp0 tidak dibatasi kenaikan 1,5x | M | SQL | Pelanggan dengan limit saat ini Rp0 yang layak naik limit tidak tertahan oleh $1,5 \times 0$, melainkan dibatasi oleh $3\times$ faktur terbesar. |
| **TC-204** | Pembulatan ke bawah ke kelipatan Rp100.000 | M | SQL | Nilai rekomendasi mentah Rp2.899.000 dibulatkan menjadi Rp2.800.000 (tidak ada desimal atau nominal ganjil). |
| **TC-205** | Simulasi limit hipotetik akurat dan murni read-only | M | SQL | Pemanggilan `fn_simulasi_limit_kredit` mengembalikan angka proyeksi pemakaian tanpa memodifikasi tabel apa pun (audit log tidak bertambah). |
| **TC-206** | Tombol Terapkan memanggil `rpc_set_batas_kredit` & rekam audit | M | Integrasi | Menerapkan rekomendasi sukses memperbarui `pelanggan.batas_kredit` dan memicu catatan `audit_log` dengan `aksi = 'ubah_batas_kredit'`. |
| **TC-207** | Isolasi akses Penjualan dan Gudang pada seluruh artefak kredit | P, G | SQL + Route Guard | Penjualan dan Gudang ditolak di `/kredit` (403), ditolak memanggil RPC analisis kredit (`E0001`), dan payload RSC detail pelanggan tidak memuat field skor/rekomendasi. |
| **TC-208** | Peringatan editor pesanan: batas 80% sisa limit | P, M | Vitest + SQL | Estimasi pesanan $> 80\%$ sisa kredit memicu peringatan `"Total pesanan mendekati sisa batas kredit pelanggan"`. |
| **TC-209** | Peringatan editor pesanan: batas 3x rata-rata belanja | P, M | Vitest + SQL | Pesanan $> 3\times$ rata-rata memicu peringatan kebiasaan tanpa membocorkan angka rata-rata atau histori sales lain. |
| **TC-210** | Peringatan editor pesanan tidak memblokir konfirmasi pesanan | P | Integrasi UI | Tombol "Simpan Draf" dan "Konfirmasi" tetap aktif dan berfungsi saat peringatan muncul. |
| **TC-211** | Pengingat tinjau limit (90 hari dan 180 hari) | M | SQL | Pelanggan dengan hari sejak tinjau terakhir 89 hari berstatus `normal`; 90 hari berstatus `perlu_tinjau`; 180 hari berstatus `terlambat`. Pelanggan limit Rp0 atau nonaktif dikecualikan. |
| **TC-212** | Penanganan pelanggan baru (pembagian nol aman) | M | SQL | Pelanggan dengan 0 pesanan tidak menyebabkan error `division by zero` dan mengembalikan nilai aman. |
| **TC-213** | Target performa kueri agregat 60 pelanggan di bawah 2 detik | Sistem | SQL EXPLAIN | Kueri `fn_daftar_pemantauan_kredit()` dieksekusi dalam $< 200\text{ ms}$ pada dataset 60 pelanggan dan 1.000 pesanan. |

### 9.2 Regresi Test Cases Lama yang Wajib Dijalankan Ulang:
1. **TC-16 s.d. TC-18:** Batas kredit dan deteksi tagihan overdue saat konfirmasi pesanan (BR-05).
2. **TC-28:** Trigger audit `audit_log` saat batas kredit diubah.
3. **TC-29 s.d. TC-38:** Integritas fungsi `fn_hitung_kredit_pelanggan`.
4. **TC-71 s.d. TC-88:** Konsistensi modul penagihan piutang dan klasifikasi umur faktur.
5. **Verifikasi Hash RPC Eksisting:** Memastikan hash definisi `rpc_konfirmasi_pesanan`, `rpc_set_batas_kredit`, dan `rpc_catat_pelunasan` tidak mengalami modifikasi 1 karakter pun.

---

## 10. Analisis Risiko & Pertanyaan Terbuka

### 10.1 Analisis Risiko Teknis & Mitigasi
1. **Risiko Skor Heuristik Menyesatkan pada Riwayat Sedikit:**
   - *Risiko:* Pelanggan yang baru memiliki 3 faktur dengan nilai kecil dapat memperoleh skor 100 dan Kelas A semu, memicu saran limit yang terlalu besar.
   - *Mitigasi:* Diterapkan pembatas ganda: syarat minimal 28 hari kalender, pembatas maksimal $3\times$ faktur terbesar, pembatas maksimal $1,5\times$ limit saat ini, dan label disclaimer wajib di UI: *"Indikasi berdasarkan riwayat transaksi, bukan keputusan"*.
2. **Beban Komputasi Agregat pada Halaman Monitoring:**
   - *Risiko:* Menghitung metrik analitik on-the-fly untuk puluhan pelanggan sekaligus dapat membebani database jika menggunakan subquery berulang.
   - *Mitigasi:* Seluruh perhitungan dirancang dalam satu CTE agregat efisien dengan indeks pendukung komposit (`idx_pesanan_jual_kredit_calc`), menghasilkan waktu eksekusi $< 200\text{ ms}$.

### 10.2 Pertanyaan Terbuka untuk Pemilik Proyek (Tech Lead Recommendations)

Sesuai aturan kerja, opsi paling konservatif dipilih sebagai keputusan default:

| No | Isu / Pertanyaan Desain | Rekomendasi Konservatif Terpilih (Default) | Alternatif Terbuka |
|---|---|---|---|
| **P1** | **Ambang Syarat Data Cukup:** | **Minimal 3 faktur lunas DAN 28 hari.** Menjamin pelanggan telah melewati minimal 1 siklus perputaran tempo sebelum dinilai. | Memperlonggar menjadi minimal 2 faktur lunas atau 14 hari. |
| **P2** | **Bobot Override Keterlambatan Parah (>30 Hari):** | **Memaksa Kelas D secara mutlak.** Pelanggan yang menunggak lebih dari 1 bulan tidak layak mendapatkan rekomendasi kenaikan plafon apa pun. | Mengurangi skor sebesar 30 poin tanpa memaksa langsung ke Kelas D. |
| **P3** | **Sifat Rekomendasi di UI:** | **Hanya saran informatif dengan tombol konfirmasi manual.** Manajer tetap memegang keputusan penuh untuk menaikkan, mempertahankan, atau menurunkan limit toko. | Memberikan fitur persetujuan otomatis terjadwal (di luar lingkup PRD). |

---

## 11. Perkiraan Ukuran Pekerjaan (Effort Estimation)

| Komponen Deliverable | Estimasi Waktu |
|---|---|
| **Skema Database & Indeks:** Migrasi baru fungsi `fn_parameter_kredit`, `fn_analisis_kredit_pelanggan`, `fn_daftar_pemantauan_kredit`, `fn_simulasi_limit_kredit`, `fn_peringatan_editor_pesanan`, dan 2 indeks pendukung | 4–6 jam |
| **Server Actions & Utilitas Frontend:** Server Action pengambilan data pemantauan, simulasi limit, integrasi `rpc_set_batas_kredit` eksisting, dan validasi Zod | 3–4 jam |
| **Frontend Panel Penilaian Kredit:** Komponen di `/pelanggan/[id]` (lencana kelas, rincian pilar, simulasi limit, dialog konfirmasi) | 4–5 jam |
| **Frontend Halaman Monitoring:** Halaman `/kredit` (4 kartu ringkasan eksekutif, DataTable enterprise, tab filter kelas, utilisasi >80%, perlu tinjau) | 4–5 jam |
| **Editor Pesanan & Pusat Tugas:** Hook debounce 500ms banner peringatan non-blocking di `/pesanan/baru` dan counter di Pusat Tugas Manajer | 2–3 jam |
| **Test Suite:** SQL Test Suite 14 (`TC-193` s.d. `TC-213`), Vitest unit tests, dan verifikasi regresi penuh | 4–5 jam |
| **Total Estimasi Pengerjaan** | **21–28 jam (~3–4 hari kerja)** |

---

## 12. Hasil Implementasi

### 12.1 Ringkasan Deliverable
Fitur Pemantauan dan Rekomendasi Kredit (PRD 11.2 / C1–C13) telah diimplementasikan secara menyeluruh dengan prinsip **read-only & advisory**. Seluruh logika penilaian, pilar, skor, kelas risiko, dan rekomendasi limit berpusat di database (Single Source of Truth).

| Komponen | File / Modul Terkait | Deskripsi Implementasi |
|---|---|---|
| **Database Migration** | `supabase/migrations/20261024170000_pemantauan_kredit.sql` | Indeks komposit `idx_pesanan_jual_kredit_calc` dan `idx_audit_log_pelanggan_limit`. Fungsi database: `fn_parameter_kredit()`, `fn_analisis_kredit_pelanggan()`, `fn_daftar_pemantauan_kredit()`, `fn_simulasi_limit_kredit()`, `fn_peringatan_editor_pesanan()`. Pembaruan `rpc_get_tugas_harian()` untuk tugas `tinjau_limit_kredit`. |
| **Pending Cloud Migration** | `supabase/pending_features_cloud.sql` | Didaftarkan untuk deployment Supabase Cloud. |
| **SQL Test Suite 14** | `supabase/tests/14_pemantauan_kredit.sql` | 21 skenario pengujian (TC-193 s.d. TC-213) menggunakan data uji sintetis terisolasi. |
| **Frontend Modul Kredit** | `src/features/kredit/` | Tipe data (`types.ts`), server actions Manajer (`actions.ts`), hook debounce 500ms (`useCreditAdvisory.ts`), panel penilaian & simulasi (`PenilaianKreditPanel.tsx`), tabel pemantauan enterprise (`PemantauanKreditTable.tsx`), peringatan editor (`CreditAdvisoryAlert.tsx`), dan unit test vitest (`__tests__/kredit.test.ts`). |
| **Halaman Monitoring** | `src/app/(dashboard)/kredit/page.tsx` | Halaman Server Component khusus Manajer dengan 4 KPI cards eksekutif dan DataTable responsif. |
| **Detail Pelanggan** | `src/app/(dashboard)/pelanggan/[id]/page.tsx` | Integrasi `PenilaianKreditPanel` yang hanya dievaluasi dan dirender di server jika `isManajer = true`. |
| **Editor Pesanan** | `src/features/pesanan/components/pesanan-editor.tsx` | Integrasi advisory warning hook non-blocking. |
| **Pusat Tugas & Navigasi** | `src/features/pusat-tugas/`, `src/lib/akses.ts`, `src/components/layout/sidebar.tsx` | Penambahan counter tugas `tinjau_limit_kredit` dan item navigasi sidebar `/kredit` dengan ikon `ShieldCheck`. |
| **End-to-End Test** | `tests/e2e/05-pemantauan-kredit.spec.ts` | Pengujian RBAC rute `/kredit` dan verifikasi zero-leakage skor kredit pada RSC/respons Penjualan & Gudang. |

### 12.2 Bukti Uji Hash Fungsi Eksisting (Tidak Berubah)
Sesuai instruksi khusus fitur ini, 4 fungsi database eksisting dijaga ketat agar tidak dimodifikasi 1 karakter pun:

| Nama Fungsi | MD5 Sebelum Migrasi | MD5 Sesudah Migrasi | Status |
|---|---|---|---|
| `fn_hitung_kredit_pelanggan` | `0118a46324fcc8f5a0152d5dab115ce5` | `0118a46324fcc8f5a0152d5dab115ce5` | **IDENTIK (TIDAK BERUBAH)** |
| `rpc_catat_pelunasan` | `56a84baffe568d3a4b8afd15269707a1` | `56a84baffe568d3a4b8afd15269707a1` | **IDENTIK (TIDAK BERUBAH)** |
| `rpc_konfirmasi_pesanan` | `385cc79c8ef22cb59a25293063a9c93d` | `385cc79c8ef22cb59a25293063a9c93d` | **IDENTIK (TIDAK BERUBAH)** |
| `rpc_set_batas_kredit` | `6bf4e04f5dd1d776d9b8224571fab72f` | `6bf4e04f5dd1d776d9b8224571fab72f` | **IDENTIK (TIDAK BERUBAH)** |

### 12.3 Hasil Eksekusi Uji Regresi
- **SQL Test Suite 14 (`TC-193` s.d. `TC-213`)**: 21/21 LULUS (100%).
- **Seluruh SQL Test Suites (02 s.d. 14)**: LULUS TANPA GALAT.
- **TypeScript Strict (`npx tsc --noEmit`)**: 0 error.
- **ESLint (`npm run lint`)**: 0 error, 0 warning.
- **Vitest Unit/Integrasi (`npx vitest run`)**: 22 test files lulus, 167 tests lulus.
- **Next.js Production Build (`npm run build`)**: Lulus, 38 rute statis & dinamis ter-compile optimal.
- **Pemeriksaan Kerahasiaan Data (Zero Leakage)**: Skor kredit, kelas, dan rekomendasi tidak dikirim ke klien Penjualan atau Gudang (terisolasi di server khusus Manajer).

