-- ============================================================
-- Seed Data untuk Lingkungan Pengembangan & Pengujian Lokal
-- CV Sinar Abadi Niaga
-- ============================================================

-- Bersihkan data lama jika ada (urutan FK terbalik)
TRUNCATE TABLE public.audit_log CASCADE;
TRUNCATE TABLE public.mutasi_stok CASCADE;
TRUNCATE TABLE public.item_pesanan_jual CASCADE;
TRUNCATE TABLE public.pesanan_jual CASCADE;
TRUNCATE TABLE public.pembelian CASCADE;
TRUNCATE TABLE public.barang CASCADE;
TRUNCATE TABLE public.pelanggan CASCADE;
TRUNCATE TABLE public.pemasok CASCADE;
DELETE FROM public.profiles;
DELETE FROM auth.users;

-- ============================================================
-- 1. Pengguna & Akun Uji (auth.users + profiles)
-- ============================================================
-- Catatan: Password dev ini hanya untuk lingkungan lokal/uji.
-- Hash berikut adalah format bcrypt standar dev lokal.

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'penjualan1@sinarabadi.test', '{"nama_lengkap":"Staf Penjualan 1"}'::jsonb),
  ('11111111-1111-1111-1111-111111111112', 'penjualan2@sinarabadi.test', '{"nama_lengkap":"Staf Penjualan 2"}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'gudang@sinarabadi.test',     '{"nama_lengkap":"Staf Gudang"}'::jsonb),
  ('33333333-3333-3333-3333-333333333333', 'manajer@sinarabadi.test',    '{"nama_lengkap":"Manajer Pak Hendra"}'::jsonb),
  ('44444444-4444-4444-4444-444444444444', 'nonaktif@sinarabadi.test',   '{"nama_lengkap":"Akun Nonaktif"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Perbarui profil sesuai peran masing-masing (trigger awalnya memberi peran 'penjualan')
UPDATE public.profiles
SET peran = 'penjualan', nama_lengkap = 'Staf Penjualan 1', aktif = true
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.profiles
SET peran = 'penjualan', nama_lengkap = 'Staf Penjualan 2', aktif = true
WHERE id = '11111111-1111-1111-1111-111111111112';

UPDATE public.profiles
SET peran = 'gudang', nama_lengkap = 'Staf Gudang', aktif = true
WHERE id = '22222222-2222-2222-2222-222222222222';

UPDATE public.profiles
SET peran = 'manajer', nama_lengkap = 'Manajer Pak Hendra', aktif = true
WHERE id = '33333333-3333-3333-3333-333333333333';

UPDATE public.profiles
SET peran = 'penjualan', nama_lengkap = 'Akun Nonaktif', aktif = false
WHERE id = '44444444-4444-4444-4444-444444444444';

-- ============================================================
-- 2. Pemasok (2 pemasok)
-- ============================================================
INSERT INTO public.pemasok (id, kode, nama, telepon, alamat, aktif)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'PMS-1', 'PT Sumber Pangan Makmur', '021-8899001', 'Jl. Industri No. 12, Cikarang, Bekasi', true),
  ('a1111111-0000-0000-0000-000000000002', 'PMS-2', 'CV Berkah Distributor Jaya', '021-8899002', 'Jl. Raya Narogong KM 7, Bekasi', true);

-- ============================================================
-- 3. Pelanggan (5 pelanggan)
-- ============================================================
INSERT INTO public.pelanggan (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh)
VALUES
  ('b1111111-0000-0000-0000-000000000001', 'PLG-1', 'Toko Berkah Mandiri', '081234567891', 'Pasar Baru Bekasi Blok A/1', 1000000, 14, true, '11111111-1111-1111-1111-111111111111'),
  ('b1111111-0000-0000-0000-000000000002', 'PLG-2', 'Minimarket Sejahtera', '081234567892', 'Jl. Patriot No. 45, Bekasi Barat', 500000, 7, true, '11111111-1111-1111-1111-111111111111'),
  ('b1111111-0000-0000-0000-000000000003', 'PLG-3', 'Toko Murah Meriah', '081234567893', 'Jl. Kartini No. 10, Rawalumbu', 5000000, 7, true, '11111111-1111-1111-1111-111111111111'),
  ('b1111111-0000-0000-0000-000000000004', 'PLG-4', 'Toko Sari Rasa', '081234567894', 'Jl. Ir. H. Juanda No. 88, Bekasi Timur', 0, 0, false, '11111111-1111-1111-1111-111111111111'),
  ('b1111111-0000-0000-0000-000000000005', 'PLG-5', 'Toko Makmur Abadi', '081234567895', 'Kranji No. 20, Bekasi', 5000000, 30, true, '11111111-1111-1111-1111-111111111111');

-- ============================================================
-- 4. Barang (15 barang, sebagian stok di bawah minimum)
-- ============================================================
INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
VALUES
  ('c1111111-0000-0000-0000-000000000001', 'BRG-A',  'Beras Premium 5kg',        'karung',  10000,  8000, 100, 10, true),
  ('c1111111-0000-0000-0000-000000000002', 'BRG-B',  'Minyak Goreng 2L',         'pouch',   15000, 14000,   1,  5, true), -- menipis (1 <= 5)
  ('c1111111-0000-0000-0000-000000000003', 'BRG-C',  'Gula Pasir 1kg',           'kg',       5000,  4000,  20, 10, false), -- nonaktif
  ('c1111111-0000-0000-0000-000000000004', 'BRG-D',  'Kopi Bubuk 250g',          'bungkus',  3333,  NULL,  50, 10, true), -- tanpa HPP
  ('c1111111-0000-0000-0000-000000000005', 'BRG-01', 'Tepung Terigu 1kg',        'kg',      12000,  9500,  50, 20, true),
  ('c1111111-0000-0000-0000-000000000006', 'BRG-02', 'Mie Instan Kuah Dus',      'dus',    110000, 95000,   3, 10, true), -- menipis (3 <= 10)
  ('c1111111-0000-0000-0000-000000000007', 'BRG-03', 'Susu Kental Manis Kaleng', 'kaleng',  13000, 10500,  80, 15, true),
  ('c1111111-0000-0000-0000-000000000008', 'BRG-04', 'Kecap Manis 600ml',        'botol',   22000, 18000,  30, 10, true),
  ('c1111111-0000-0000-0000-000000000009', 'BRG-05', 'Saus Sambal Botol',        'botol',   14000, 11000,   2, 10, true), -- menipis (2 <= 10)
  ('c1111111-0000-0000-0000-000000000010', 'BRG-06', 'Teh Celup Kotak',          'kotak',    8000,  6000,  40, 10, true),
  ('c1111111-0000-0000-0000-000000000011', 'BRG-07', 'Sabun Mandi Dus',          'dus',     75000, 60000,  25, 10, true),
  ('c1111111-0000-0000-0000-000000000012', 'BRG-08', 'Deterjen Bubuk 800g',      'bungkus', 19000, 15000,  45, 15, true),
  ('c1111111-0000-0000-0000-000000000013', 'BRG-09', 'Pasta Gigi 120g',          'tube',    15000, 12000,   4, 10, true), -- menipis (4 <= 10)
  ('c1111111-0000-0000-0000-000000000014', 'BRG-10', 'Sampo Renceng',            'renceng', 12000,  9000,  60, 20, true),
  ('c1111111-0000-0000-0000-000000000015', 'BRG-11', 'Minyak Kayu Putih 60ml',   'botol',   25000, 20000,  15, 10, true);

-- ============================================================
-- 5. Saldo Awal Kartu Stok (mutasi_stok) (B14, B15)
-- Invarian: SUM(mutasi_stok.jumlah) per barang = barang.stok
-- ============================================================
INSERT INTO public.mutasi_stok (barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh)
SELECT
  b.id,
  'penyesuaian',
  b.stok,
  b.stok,
  'SALDO-AWAL',
  'Saldo awal migrasi data',
  '33333333-3333-3333-3333-333333333333'::uuid
FROM public.barang b
WHERE b.stok > 0;
