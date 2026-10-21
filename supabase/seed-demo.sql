-- ============================================================
-- SEED DATA DEMO / PRODUKSI AWAL
-- CV Sinar Abadi Niaga
-- ============================================================
-- Catatan Keamanan:
-- File ini HANYA mengisi data katalog bisnis awal (pemasok, pelanggan, barang,
-- dan saldo awal mutasi stok). File ini TIDAK memuat akun pengguna (auth.users)
-- maupun kata sandi. Pengguna dibuat secara resmi melalui dasbor Supabase Auth.
-- ============================================================

-- Pastikan transaksi atomik
BEGIN;

-- 1. PEMASOK (Master Pemasok Terpercaya)
INSERT INTO public.pemasok (id, kode, nama, telepon, alamat, aktif)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'PMS-001', 'PT Sumber Pangan Makmur',     '021-8899001', 'Kawasan Industri Jababeka Tahap II, Cikarang', true),
  ('a1111111-0000-0000-0000-000000000002', 'PMS-002', 'CV Berkah Distributor Jaya',     '021-8899002', 'Jl. Raya Narogong KM 7, Rawalumbu, Bekasi',      true),
  ('a1111111-0000-0000-0000-000000000003', 'PMS-003', 'PT Sentosa Niaga Utama',        '021-8899003', 'Jl. Boulevard Raya Blok Q No. 12, Kelapa Gading',  true),
  ('a1111111-0000-0000-0000-000000000004', 'PMS-004', 'UD Mandiri Perkasa Logistik',   '021-8899004', 'Pergudangan Marunda Center Blok D/8, Cilincing',   true)
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  telepon = EXCLUDED.telepon,
  alamat = EXCLUDED.alamat,
  aktif = EXCLUDED.aktif;

-- 2. PELANGGAN (Master Pelanggan Retail & Grosir)
INSERT INTO public.pelanggan (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif)
VALUES
  ('b1111111-0000-0000-0000-000000000001', 'PLG-001', 'Toko Berkah Mandiri',     '081234567891', 'Pasar Baru Bekasi Blok A/1-3',               15000000, 14, true),
  ('b1111111-0000-0000-0000-000000000002', 'PLG-002', 'Minimarket Sejahtera',     '081234567892', 'Jl. Patriot No. 45, Kranji, Bekasi Barat',   10000000,  7, true),
  ('b1111111-0000-0000-0000-000000000003', 'PLG-003', 'Toko Murah Meriah Grosir', '081234567893', 'Jl. R.E. Martadinata No. 88, Cikarang Kota',  25000000, 30, true),
  ('b1111111-0000-0000-0000-000000000004', 'PLG-004', 'Toko Sari Rasa Mart',      '081234567894', 'Jl. Ir. H. Juanda No. 112, Bekasi Timur',    5000000,  7, true),
  ('b1111111-0000-0000-0000-000000000005', 'PLG-005', 'Agen Sembako Makmur Jaya', '081234567895', 'Jl. Raya Tambun No. 24, Tambun Selatan',     20000000, 21, true),
  ('b1111111-0000-0000-0000-000000000006', 'PLG-006', 'Toko Barokah Jaya (Tunai)', '081234567896', 'Pasar Kranji Blok B No. 9',                      0,  0, true)
ON CONFLICT (kode) DO UPDATE SET
  nama_toko = EXCLUDED.nama_toko,
  telepon = EXCLUDED.telepon,
  alamat = EXCLUDED.alamat,
  batas_kredit = EXCLUDED.batas_kredit,
  termin_hari = EXCLUDED.termin_hari,
  aktif = EXCLUDED.aktif;

-- 3. BARANG (Katalog Sembako & Kebutuhan Rumah Tangga)
INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
VALUES
  ('c1111111-0000-0000-0000-000000000001', 'BRG-01', 'Beras Premium Ramos 5kg',        'karung',   72000,  63000, 120, 20, true),
  ('c1111111-0000-0000-0000-000000000002', 'BRG-02', 'Minyak Goreng Sawit 2L',         'pouch',    34000,  29500,  85, 25, true),
  ('c1111111-0000-0000-0000-000000000003', 'BRG-03', 'Gula Pasir Kristal Putih 1kg',   'kg',       17500,  15000, 150, 30, true),
  ('c1111111-0000-0000-0000-000000000004', 'BRG-04', 'Tepung Terigu Serbaguna 1kg',    'kg',       12500,  10500,  90, 20, true),
  ('c1111111-0000-0000-0000-000000000005', 'BRG-05', 'Mie Instan Rasa Ayam Bawang Dus', 'dus',     112000,  98000,  40, 15, true),
  ('c1111111-0000-0000-0000-000000000006', 'BRG-06', 'Mie Instan Goreng Spesial Dus',   'dus',     115000, 100000,  55, 15, true),
  ('c1111111-0000-0000-0000-000000000007', 'BRG-07', 'Susu Kental Manis Putih 370g',   'kaleng',   13500,  11500, 110, 20, true),
  ('c1111111-0000-0000-0000-000000000008', 'BRG-08', 'Kecap Manis Botol 600ml',        'botol',    22500,  19000,  45, 15, true),
  ('c1111111-0000-0000-0000-000000000009', 'BRG-09', 'Saus Sambal Ekstra Pedas 335ml',  'botol',    15500,  13000,  12, 15, true), -- menipis
  ('c1111111-0000-0000-0000-000000000010', 'BRG-10', 'Kopi Bubuk Arabika Blend 250g',   'bungkus',  28000,  23000,  60, 10, true),
  ('c1111111-0000-0000-0000-000000000011', 'BRG-11', 'Teh Celup Melati Kotak Isi 25',  'kotak',     7500,   6000,  80, 20, true),
  ('c1111111-0000-0000-0000-000000000012', 'BRG-12', 'Deterjen Bubuk Konsentrat 800g',  'bungkus',  21000,  17500,  35, 15, true),
  ('c1111111-0000-0000-0000-000000000013', 'BRG-13', 'Sabun Mandi Batang Dus Isi 72',  'dus',      88000,  74000,  18, 10, true),
  ('c1111111-0000-0000-0000-000000000014', 'BRG-14', 'Pasta Gigi Perlindungan 150g',    'tube',     16000,  13200,   8, 10, true), -- menipis
  ('c1111111-0000-0000-0000-000000000015', 'BRG-15', 'Minyak Kayu Putih 120ml',        'botol',    45000,  38000,  25, 10, true)
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  satuan = EXCLUDED.satuan,
  harga_jual = EXCLUDED.harga_jual,
  harga_pokok = EXCLUDED.harga_pokok,
  stok_minimum = EXCLUDED.stok_minimum,
  aktif = EXCLUDED.aktif;

-- 4. KARTU STOK AWAL (Invarian: SUM mutasi = barang.stok)
-- Catatan: Hanya dimasukkan jika belum ada catatan mutasi stok untuk barang terkait
INSERT INTO public.mutasi_stok (barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan)
SELECT
  b.id,
  'penyesuaian',
  b.stok,
  b.stok,
  'SALDO-AWAL-DEMO',
  'Pencatatan saldo fisik awal katalog demo'
FROM public.barang b
WHERE b.stok > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.mutasi_stok m WHERE m.barang_id = b.id
  );

COMMIT;
