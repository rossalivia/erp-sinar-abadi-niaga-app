-- ============================================================
-- SEED DATA DUMMY LENGKAP & REALISTIS
-- CV Sinar Abadi Niaga
-- ============================================================
-- Script ini mengisi data operasional lengkap ke semua modul:
-- 1. Master Pemasok (4 supplier)
-- 2. Master Pelanggan (6 toko: variasi limit kredit & termin)
-- 3. Master Barang (15 sembako, termasuk status stok aman & menipis)
-- 4. Mutasi Stok (Saldo awal 15 barang)
-- 5. Pembelian PO (Status: diajukan, disetujui, diterima, ditolak)
-- 6. Pesanan Jual SO (Status: draf, dikonfirmasi, dikirim/overdue, lunas, dibatalkan)
-- 7. Item Pesanan Jual (Rincian per pesanan)
-- 8. Audit Log (Riwayat aktivitas operasional)
-- ============================================================

DO $$
DECLARE
  -- Ambil ID pengguna aktif di sistem
  v_user_id uuid;
  v_manajer_id uuid;
  v_gudang_id uuid;
  v_penjualan_id uuid;

  -- ID Pemasok
  v_pms1 uuid := 'a1111111-0000-0000-0000-000000000001';
  v_pms2 uuid := 'a1111111-0000-0000-0000-000000000002';
  v_pms3 uuid := 'a1111111-0000-0000-0000-000000000003';
  v_pms4 uuid := 'a1111111-0000-0000-0000-000000000004';

  -- ID Pelanggan
  v_plg1 uuid := 'b1111111-0000-0000-0000-000000000001';
  v_plg2 uuid := 'b1111111-0000-0000-0000-000000000002';
  v_plg3 uuid := 'b1111111-0000-0000-0000-000000000003';
  v_plg4 uuid := 'b1111111-0000-0000-0000-000000000004';
  v_plg5 uuid := 'b1111111-0000-0000-0000-000000000005';
  v_plg6 uuid := 'b1111111-0000-0000-0000-000000000006';

  -- ID Barang
  v_brg01 uuid := 'c1111111-0000-0000-0000-000000000001';
  v_brg02 uuid := 'c1111111-0000-0000-0000-000000000002';
  v_brg03 uuid := 'c1111111-0000-0000-0000-000000000003';
  v_brg04 uuid := 'c1111111-0000-0000-0000-000000000004';
  v_brg05 uuid := 'c1111111-0000-0000-0000-000000000005';
  v_brg06 uuid := 'c1111111-0000-0000-0000-000000000006';
  v_brg07 uuid := 'c1111111-0000-0000-0000-000000000007';
  v_brg08 uuid := 'c1111111-0000-0000-0000-000000000008';
  v_brg09 uuid := 'c1111111-0000-0000-0000-000000000009';
  v_brg10 uuid := 'c1111111-0000-0000-0000-000000000010';
  v_brg11 uuid := 'c1111111-0000-0000-0000-000000000011';
  v_brg12 uuid := 'c1111111-0000-0000-0000-000000000012';
  v_brg13 uuid := 'c1111111-0000-0000-0000-000000000013';
  v_brg14 uuid := 'c1111111-0000-0000-0000-000000000014';
  v_brg15 uuid := 'c1111111-0000-0000-0000-000000000015';

  -- ID Pesanan Jual
  v_so1 uuid := 'd1111111-0000-0000-0000-000000000001';
  v_so2 uuid := 'd1111111-0000-0000-0000-000000000002';
  v_so3 uuid := 'd1111111-0000-0000-0000-000000000003';
  v_so4 uuid := 'd1111111-0000-0000-0000-000000000004';
  v_so5 uuid := 'd1111111-0000-0000-0000-000000000005';

BEGIN
  -- Ambil ID profil pengguna yang ada
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' LIMIT 1;
  SELECT id INTO v_gudang_id FROM public.profiles WHERE peran = 'gudang' LIMIT 1;
  SELECT id INTO v_penjualan_id FROM public.profiles WHERE peran = 'penjualan' LIMIT 1;

  v_user_id := COALESCE(v_manajer_id, v_penjualan_id, (SELECT id FROM public.profiles LIMIT 1));
  IF v_manajer_id IS NULL THEN v_manajer_id := v_user_id; END IF;
  IF v_gudang_id IS NULL THEN v_gudang_id := v_user_id; END IF;
  IF v_penjualan_id IS NULL THEN v_penjualan_id := v_user_id; END IF;

  -- ============================================================
  -- 1. PEMASOK (4 Supplier)
  -- ============================================================
  INSERT INTO public.pemasok (id, kode, nama, telepon, alamat, aktif)
  VALUES
    (v_pms1, 'PMS-001', 'PT Sumber Pangan Makmur',   '021-8899001', 'Kawasan Industri Jababeka Tahap II, Cikarang', true),
    (v_pms2, 'PMS-002', 'CV Berkah Distributor Jaya',   '021-8899002', 'Jl. Raya Narogong KM 7, Rawalumbu, Bekasi',    true),
    (v_pms3, 'PMS-003', 'PT Sentosa Niaga Utama',      '021-8899003', 'Jl. Boulevard Raya Blok Q No. 12, Kelapa Gading', true),
    (v_pms4, 'PMS-004', 'UD Mandiri Perkasa Logistik', '021-8899004', 'Pergudangan Marunda Center Blok D/8, Cilincing', true)
  ON CONFLICT (kode) DO UPDATE SET
    nama = EXCLUDED.nama,
    telepon = EXCLUDED.telepon,
    alamat = EXCLUDED.alamat,
    aktif = EXCLUDED.aktif;

  -- ============================================================
  -- 2. PELANGGAN (6 Toko: variasi limit kredit & termin)
  -- ============================================================
  INSERT INTO public.pelanggan (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh)
  VALUES
    (v_plg1, 'PLG-001', 'Toko Berkah Mandiri',     '081234567891', 'Pasar Baru Bekasi Blok A/1-3',               15000000, 14, true, v_user_id),
    (v_plg2, 'PLG-002', 'Minimarket Sejahtera',     '081234567892', 'Jl. Patriot No. 45, Kranji, Bekasi Barat',   10000000,  7, true, v_user_id),
    (v_plg3, 'PLG-003', 'Toko Murah Meriah Grosir', '081234567893', 'Jl. R.E. Martadinata No. 88, Cikarang Kota',  25000000, 30, true, v_user_id),
    (v_plg4, 'PLG-004', 'Toko Sari Rasa Mart',      '081234567894', 'Jl. Ir. H. Juanda No. 112, Bekasi Timur',    5000000,  7, true, v_user_id),
    (v_plg5, 'PLG-005', 'Agen Sembako Makmur Jaya', '081234567895', 'Jl. Raya Tambun No. 24, Tambun Selatan',     20000000, 14, true, v_user_id),
    (v_plg6, 'PLG-006', 'Toko Barokah Jaya (Tunai)', '081234567896', 'Pasar Kranji Blok B No. 9',                      0,  0, true, v_user_id)
  ON CONFLICT (kode) DO UPDATE SET
    nama_toko = EXCLUDED.nama_toko,
    telepon = EXCLUDED.telepon,
    alamat = EXCLUDED.alamat,
    batas_kredit = EXCLUDED.batas_kredit,
    termin_hari = EXCLUDED.termin_hari,
    aktif = EXCLUDED.aktif;

  -- ============================================================
  -- 3. BARANG (15 Komoditas Sembako, ada stok menipis < minimum)
  -- ============================================================
  INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
  VALUES
    (v_brg01, 'BRG-01', 'Beras Premium Ramos 5kg',        'karung',   72000,  63000, 120, 20, true),
    (v_brg02, 'BRG-02', 'Minyak Goreng Sawit 2L',         'pouch',    34000,  29500,  85, 25, true),
    (v_brg03, 'BRG-03', 'Gula Pasir Kristal Putih 1kg',   'kg',       17500,  15000, 150, 30, true),
    (v_brg04, 'BRG-04', 'Tepung Terigu Serbaguna 1kg',    'kg',       12500,  10500,  90, 20, true),
    (v_brg05, 'BRG-05', 'Mie Instan Rasa Ayam Bawang Dus', 'dus',     112000,  98000,  40, 15, true),
    (v_brg06, 'BRG-06', 'Mie Instan Goreng Spesial Dus',   'dus',     115000, 100000,  55, 15, true),
    (v_brg07, 'BRG-07', 'Susu Kental Manis Putih 370g',   'kaleng',   13500,  11500, 110, 20, true),
    (v_brg08, 'BRG-08', 'Kecap Manis Botol 600ml',        'botol',    22500,  19000,  45, 15, true),
    (v_brg09, 'BRG-09', 'Saus Sambal Ekstra Pedas 335ml',  'botol',    15500,  13000,  12, 15, true), -- menipis (12 < 15)
    (v_brg10, 'BRG-10', 'Kopi Bubuk Arabika Blend 250g',   'bungkus',  28000,  23000,  60, 10, true),
    (v_brg11, 'BRG-11', 'Teh Celup Melati Kotak Isi 25',  'kotak',     7500,   6000,  80, 20, true),
    (v_brg12, 'BRG-12', 'Deterjen Bubuk Konsentrat 800g',  'bungkus',  21000,  17500,  35, 15, true),
    (v_brg13, 'BRG-13', 'Sabun Mandi Batang Dus Isi 72',  'dus',      88000,  74000,  18, 10, true),
    (v_brg14, 'BRG-14', 'Pasta Gigi Perlindungan 150g',    'tube',     16000,  13200,   8, 10, true), -- menipis (8 < 10)
    (v_brg15, 'BRG-15', 'Minyak Kayu Putih 120ml',        'botol',    45000,  38000,  25, 10, true)
  ON CONFLICT (kode) DO UPDATE SET
    nama = EXCLUDED.nama,
    satuan = EXCLUDED.satuan,
    harga_jual = EXCLUDED.harga_jual,
    harga_pokok = EXCLUDED.harga_pokok,
    stok_minimum = EXCLUDED.stok_minimum,
    aktif = EXCLUDED.aktif;

  -- ============================================================
  -- 4. KARTU STOK AWAL (mutasi_stok)
  -- ============================================================
  INSERT INTO public.mutasi_stok (barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh)
  SELECT
    b.id,
    'penyesuaian',
    b.stok,
    b.stok,
    'SALDO-AWAL-DEMO',
    'Pencatatan saldo fisik awal katalog demo',
    v_user_id
  FROM public.barang b
  WHERE b.stok > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.mutasi_stok m WHERE m.barang_id = b.id
    );

  -- ============================================================
  -- 5. PEMBELIAN / PO (Berbagai Status: Diterima, Disetujui, Diajukan, Ditolak)
  -- ============================================================
  INSERT INTO public.pembelian (
    nomor, pemasok_id, barang_id, jumlah_dipesan, jumlah_diterima, harga_beli_satuan,
    status, diajukan_oleh, diajukan_pada, diputuskan_oleh, diputuskan_pada, diterima_oleh, diterima_pada, alasan_tolak
  ) VALUES
    (
      'PO-2026-0001', v_pms1, v_brg01, 50, 50, 63000,
      'diterima', v_penjualan_id, now() - interval '5 days', v_manajer_id, now() - interval '4 days', v_gudang_id, now() - interval '3 days', NULL
    ),
    (
      'PO-2026-0002', v_pms2, v_brg02, 40, 0, 29500,
      'disetujui', v_penjualan_id, now() - interval '2 days', v_manajer_id, now() - interval '1 day', NULL, NULL, NULL
    ),
    (
      'PO-2026-0003', v_pms3, v_brg03, 100, 0, NULL,
      'diajukan', v_penjualan_id, now() - interval '4 hours', NULL, NULL, NULL, NULL, NULL
    ),
    (
      'PO-2026-0004', v_pms4, v_brg05, 30, 0, NULL,
      'ditolak', v_penjualan_id, now() - interval '1 day', v_manajer_id, now() - interval '12 hours', NULL, NULL, 'Stok gudang masih mencukupi untuk 2 minggu ke depan'
    )
  ON CONFLICT (nomor) DO NOTHING;

  -- ============================================================
  -- 6. PESANAN PENJUALAN / SO (Lengkap dengan Simulasi Overdue & Limit)
  -- ============================================================
  -- SO 1: Lunas (Toko Berkah Mandiri)
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada,
    dikonfirmasi_pada, dikirim_pada, dilunasi_pada, jatuh_tempo
  ) VALUES (
    v_so1, 'SO-2026-0001', v_plg1, 'lunas', 3600000, v_penjualan_id, now() - interval '20 days',
    now() - interval '19 days', now() - interval '18 days', now() - interval '5 days', (now() - interval '6 days')::date
  ) ON CONFLICT (nomor) DO NOTHING;

  -- SO 2: Dikirim & Jatuh Tempo Terlewat (OVERDUE! -> Minimarket Sejahtera)
  -- Termin 7 hari, dikirim 12 hari yang lalu => Overdue 5 hari!
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada,
    dikonfirmasi_pada, dikirim_pada, dilunasi_pada, jatuh_tempo
  ) VALUES (
    v_so2, 'SO-2026-0002', v_plg2, 'dikirim', 4500000, v_penjualan_id, now() - interval '13 days',
    now() - interval '12 days', now() - interval '12 days', NULL, (now() - interval '5 days')::date
  ) ON CONFLICT (nomor) DO NOTHING;

  -- SO 3: Dikonfirmasi / Piutang Berjalan (Toko Murah Meriah Grosir)
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada,
    dikonfirmasi_pada, dikirim_pada, dilunasi_pada, jatuh_tempo
  ) VALUES (
    v_so3, 'SO-2026-0003', v_plg3, 'dikonfirmasi', 8900000, v_penjualan_id, now() - interval '3 days',
    now() - interval '2 days', NULL, NULL, (now() + interval '28 days')::date
  ) ON CONFLICT (nomor) DO NOTHING;

  -- SO 4: Draf Baru (Agen Sembako Makmur Jaya)
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada,
    dikonfirmasi_pada, dikirim_pada, dilunasi_pada, jatuh_tempo
  ) VALUES (
    v_so4, 'SO-2026-0004', v_plg5, 'draf', 2880000, v_penjualan_id, now() - interval '2 hours',
    NULL, NULL, NULL, (now() + interval '14 days')::date
  ) ON CONFLICT (nomor) DO NOTHING;

  -- SO 5: Dibatalkan (Toko Barokah Jaya)
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada,
    dikonfirmasi_pada, dikirim_pada, dilunasi_pada, dibatalkan_pada, alasan_batal
  ) VALUES (
    v_so5, 'SO-2026-0005', v_plg6, 'dibatalkan', 1200000, v_penjualan_id, now() - interval '1 day',
    NULL, NULL, NULL, now() - interval '12 hours', 'Pembeli meminta penundaan pembelian karena renovasi toko'
  ) ON CONFLICT (nomor) DO NOTHING;

  -- ============================================================
  -- 7. ITEM PESANAN JUAL (Rincian Barang per Order)
  -- ============================================================
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal, hpp_satuan)
  VALUES
    (v_so1, v_brg01, 50, 72000, 0, 3600000, 63000),
    (v_so2, v_brg02, 100, 34000, 0, 3400000, 29500),
    (v_so2, v_brg05, 10, 112000, 1.79, 1100000, 98000),
    (v_so3, v_brg01, 100, 72000, 0, 7200000, 63000),
    (v_so3, v_brg03, 100, 17500, 2.86, 1700000, 15000),
    (v_so4, v_brg06, 20, 115000, 0, 2300000, 100000),
    (v_so4, v_brg07, 40, 13500, 0, 540000, 11500),
    (v_so4, v_brg11, 10, 7500, 10.0, 67500, 6000)
  ON CONFLICT (pesanan_jual_id, barang_id) DO NOTHING;

  -- ============================================================
  -- 8. AUDIT LOG (Riwayat Transaksi)
  -- ============================================================
  INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada)
  VALUES
    (v_user_id, 'tambah_pemasok', 'pemasok', v_pms1, NULL, jsonb_build_object('kode', 'PMS-001', 'nama', 'PT Sumber Pangan Makmur'), now() - interval '25 days'),
    (v_user_id, 'tambah_pelanggan', 'pelanggan', v_plg2, NULL, jsonb_build_object('kode', 'PLG-002', 'nama_toko', 'Minimarket Sejahtera', 'batas_kredit', 10000000), now() - interval '20 days'),
    (v_manajer_id, 'konfirmasi_pesanan', 'pesanan_jual', v_so3, jsonb_build_object('status', 'draf'), jsonb_build_object('status', 'dikonfirmasi', 'total', 8900000), now() - interval '2 days'),
    (v_gudang_id, 'kirim_pesanan', 'pesanan_jual', v_so2, jsonb_build_object('status', 'dikonfirmasi'), jsonb_build_object('status', 'dikirim'), now() - interval '12 days');

END $$;
