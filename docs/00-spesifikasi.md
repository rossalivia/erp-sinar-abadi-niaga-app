## I. INFORMASI UMUM & TECH STACK
1. Klien: CV Sinar Abadi Niaga (Distributor kebutuhan toko kelontong di Bekasi, melayani ~60 toko/minimarket dengan sistem pembayaran tempo).
2. Tech Stack Wajib:
   - Frontend & Backend: Next.js (App Router) dengan TypeScript.
   - Database & Auth: Supabase (Postgres, Auth, RLS, Database Functions/RPC, Column-Level Grants).
   - Deployment: Netlify (Aplikasi internal, wajib noindex, repo GitHub publik).
3. 3 Peran Pengguna (Role-Based Access Control):
   - Staf Penjualan (2 orang): Kelola pelanggan (batas kredit awal Rp0), buat draf pesanan jual (SO), beri diskon 0-10%, konfirmasi & batalkan draf miliknya sendiri, lihat stok & harga jual (TIDAK BISA lihat harga pokok, harga beli, atau margin).
   - Staf Gudang (1 orang Kepala Gudang + Pembelian): Ubah data barang selain harga, kelola pemasok, ajukan pembelian (PO), catat penerimaan barang, kirim pesanan, penyesuaian stok (TIDAK BISA lihat harga pokok, harga beli, atau margin).
   - Manajer (Pemilik): Akses penuh mencakup semua hal ditambah: melihat/mengisi harga beli & harga pokok (rahasia), menyetujui/menolak PO, mengubah batas kredit, mengubah peran akun, membatalkan pesanan terkonfirmasi (alasan >= 10 karakter), mencatat pelunasan, melihat laporan margin/omzet/piutang, serta membaca audit log.

## II. ATURAN BISNIS UTAMA (BUSINESS RULES - BR)
- BR-01: Kode barang unik, harga jual > 0, stok dan minimum berupa bilangan bulat >= 0. Perubahan stok HANYA lewat transaksi mutasi (konfirmasi, pembatalan, penerimaan, penyesuaian).
- BR-02: Pesanan jual berisi 1 s.d. 20 baris, jumlah >= 1, barang unik per pesanan, pelanggan & barang wajib aktif, ubah isi hanya saat status masih draf.
- BR-03: Harga satuan otomatis dari master barang. Subtotal baris = jumlah * harga_satuan * (100 - diskon) / 100, dibulatkan ke rupiah terdekat. Diskon staf penjualan 0-10%, manajer 0-25%.
- BR-04: Jika subtotal baris < HPP * jumlah, konfirmasi ditolak untuk Staf Penjualan dengan pesan persis: "Harga di bawah batas, minta persetujuan Manajer" tanpa membocorkan angka HPP. Manajer boleh mengonfirmasi.
- BR-05: Pelanggan punya batas kredit dan termin bayar (0, 7, 14, 30 hari). Piutang berjalan = total pesanan status dikonfirmasi atau dikirim. Konfirmasi ditolak jika piutang berjalan + pesanan baru > batas kredit, atau jika pelanggan punya pesanan dikirim yang sudah lewat jatuh tempo.
- BR-06 (Race Condition): Saat konfirmasi, stok dicek. Gunakan database transaction dengan penguncian baris (SELECT ... FOR UPDATE diurutkan berdasarkan id) agar tidak terjadi stok minus saat dua pesanan bersamaan diproses.
- BR-07: Alur status pesanan: draf -> dikonfirmasi -> dikirim (jatuh tempo otomatis terisi = tanggal kirim + termin) -> lunas / dibatalkan.
- BR-08: Pembatalan pesanan terkonfirmasi hanya oleh Manajer dengan alasan >= 10 karakter, stok dikembalikan.
- BR-09 & BR-10: Pengajuan PO oleh Gudang/Manajer (jumlah 1 - 10.000). Manajer menyetujui (isi harga beli > 0) atau menolak (alasan >= 10 karakter). Penerimaan barang sekali per PO, menambah stok, dan memperbarui harga_pokok master barang.
- BR-11 & BR-12: Kartu stok (mutasi_stok) mencatat setiap mutasi (masuk, keluar, batal, penyesuaian). Penyesuaian wajib alasan >= 10 karakter. Data rahasia dan audit log aksi sensitif dilindungi di level database.

## III. ARSITEKTUR DATABASE & KEAMANAN (9 TABEL INTI + AUTH.USERS)
1. profiles (id uuid PK -> auth.users, nama_lengkap, peran [penjualan|gudang|manajer], aktif, dibuat_pada)
2. pemasok (id uuid PK, kode, nama, telepon, alamat, aktif, dibuat_pada)
3. pelanggan (id uuid PK, kode, nama_toko, telepon, alamat, batas_kredit numeric(14,0), termin_hari int, aktif, dibuat_oleh FK, dibuat_pada)
4. barang (id uuid PK, kode, nama, satuan, harga_jual numeric(14,0), harga_pokok numeric(14,0) [RAHASIA], stok int, stok_minimum int, aktif, diperbarui_pada)
5. pembelian (id uuid PK, nomor, pemasok_id FK, barang_id FK, jumlah_dipesan int, jumlah_diterima int, harga_beli_satuan numeric(14,0) [RAHASIA], status, alasan_tolak, diajukan_oleh FK, diajukan_pada, diputuskan_oleh FK, diputuskan_pada, diterima_oleh FK, diterima_pada)
6. pesanan_jual (id uuid PK, nomor, pelanggan_id FK, status [draf|dikonfirmasi|dikirim|lunas|dibatalkan], total numeric(14,0), dibuat_oleh FK, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo date, dilunasi_pada, dibatalkan_pada, alasan_batal)
7. item_pesanan_jual (id uuid PK, pesanan_jual_id FK, barang_id FK, jumlah int, harga_satuan numeric(14,0), diskon_persen numeric(5,2), subtotal numeric(14,0), hpp_satuan numeric(14,0) [RAHASIA])
8. mutasi_stok (id bigint PK, barang_id FK, jenis [masuk|keluar|batal|penyesuaian], jumlah int, stok_sesudah int, nomor_dokumen text, alasan text, dibuat_oleh FK, dibuat_pada)
9. audit_log (id bigint PK, pelaku_id FK, aksi text, nama_tabel text, data_id uuid, nilai_lama jsonb, nilai_baru jsonb, dibuat_pada)

Pengamanan Data Rahasia: Kolom rahasia (harga_pokok, harga_beli_satuan, hpp_satuan) dicabut akses langsungnya (column-level grants) untuk role `authenticated`, dan hanya dibaca melalui view khusus Manajer (`v_*_manajer`) atau view publik tanpa kolom rahasia.
