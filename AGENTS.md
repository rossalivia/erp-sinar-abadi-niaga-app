# AGENTS.md — Aturan Kerja Proyek ERP CV Sinar Abadi Niaga

Dokumen ini wajib dibaca dan dipatuhi oleh setiap agen/sesi kerja sebelum menyentuh repo.

## 1. Sebelum Mulai Bekerja
1. Baca [`docs/00-spesifikasi.md`](docs/00-spesifikasi.md). Ini sumber kebenaran utama dan **tidak boleh diubah**.
2. Baca dokumen `docs/` yang relevan dengan tahap yang sedang dikerjakan:
   - [`docs/01-rencana-kerja.md`](docs/01-rencana-kerja.md): tujuan, deliverable, dan Definition of Done per tahap.
   - [`docs/02-matriks-akses.md`](docs/02-matriks-akses.md): hak akses per peran beserta lapisan penegaknya.
   - [`docs/03-test-plan.md`](docs/03-test-plan.md): 28 test case yang wajib lolos.
   - [`docs/04-asumsi-dan-celah.md`](docs/04-asumsi-dan-celah.md): keputusan default untuk hal yang tidak dijelaskan spesifikasi.
3. `PRD_ERP.md` hanya rujukan tambahan. Jika PRD bertentangan dengan `00-spesifikasi.md`, ikuti spesifikasi dan keputusan di `04-asumsi-dan-celah.md`.
4. Kerjakan **satu tahap per sesi** (T1–T9). Jangan mengerjakan tahap berikutnya tanpa instruksi.

## 2. Arsitektur & Logika Bisnis
- **Semua logika bisnis berada di fungsi database (RPC Postgres)**, bukan di Next.js. Next.js hanya memanggil RPC atau membaca view/tabel, lalu menampilkan hasilnya.
- Validasi di klien hanya untuk kenyamanan UX. Validasi yang berlaku adalah yang ada di database (constraint, trigger, RPC, RLS).
- Perubahan stok **hanya** lewat RPC mutasi (konfirmasi, pembatalan, penerimaan, penyesuaian). UPDATE langsung ke `barang.stok` harus diblokir di database.
- Pesan error bisnis berasal dari `RAISE EXCEPTION` di RPC, dalam Bahasa Indonesia. UI menampilkannya apa adanya.

## 3. Kerahasiaan Data
- Nilai rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, dan turunannya seperti margin/HPP total) **tidak boleh muncul** di respons API, log, pesan error, atau kode/bundle klien untuk peran non-Manajer.
- Dengan column-level grants, **`SELECT *` pada tabel yang punya kolom rahasia akan gagal**. Selalu sebut kolom secara eksplisit atau pakai view (`v_barang`, `v_*_manajer`, dan sejenisnya).
- Jangan menulis `console.log` yang berisi objek baris dari view manajer.
- Komponen yang menampilkan data rahasia harus server component atau hanya di-render jika peran = manajer. Data rahasia tidak boleh dikirim ke klien non-Manajer meskipun disembunyikan dengan CSS.

## 4. Keamanan Repo (Repo GitHub Publik)
- **Dilarang meng-commit** `.env`, `.env.local`, service-role key, password, token, atau kredensial apa pun.
- Sediakan `.env.example` yang hanya berisi nama variabel, tanpa nilai rahasia.
- **Aplikasi tidak memakai service-role key sama sekali**, termasuk di server/route handler. Semua akses memakai anon key + sesi pengguna sehingga RLS selalu berlaku.
- Data seed tidak boleh berisi password asli. Gunakan password latihan yang terdokumentasi saja.

## 5. Konvensi
- Tabel dan kolom memakai **snake_case Bahasa Indonesia** (contoh: `pesanan_jual`, `batas_kredit`).
- Fungsi RPC memakai snake_case dengan kata kerja di depan (contoh: `konfirmasi_pesanan`, `terima_pembelian`).
- TypeScript dalam mode **strict**. Hindari `any`. Tipe database dihasilkan lewat `supabase gen types`.
- Seluruh teks UI dalam **Bahasa Indonesia**. Format uang `Rp1.250.000`, tanggal zona Asia/Jakarta.
- Semua halaman memakai `noindex` (meta robots dan header `X-Robots-Tag`).

## 6. Gaya UI Frontend
- Gunakan Tailwind CSS yang bersih, bergaya aplikasi **enterprise/ERP profesional** seperti sistem internal korporat.
- Karakter visual: clean, data-table yang padat, border minimalis, warna profesional yang kalem (abu/slate dengan satu aksen), **tanpa glassmorphism berlebihan, tanpa gradien mencolok**.
- Utamakan keterbacaan data, kerapian perataan tabel (angka rata kanan, header sticky), dan fungsionalitas murni.
- Status ditampilkan sebagai badge kecil dengan warna kalem dan konsisten.

## 7. Penutup Setiap Tahap
Setiap sesi/tahap **wajib diakhiri dengan ringkasan** yang memuat:
1. **Apa yang selesai**: daftar deliverable beserta tautan ke file.
2. **Bukti uji**: perintah yang dijalankan, hasil query/test, atau screenshot, serta TC mana yang sudah dijalankan.
3. **Hal yang belum**: sisa pekerjaan, risiko, dan pertanyaan terbuka.

Commit memakai format Conventional Commits (lihat `docs/01-rencana-kerja.md`).
