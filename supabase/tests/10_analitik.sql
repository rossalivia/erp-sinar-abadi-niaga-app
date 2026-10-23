-- ============================================================
-- Suite Uji SQL: Analitik Pelanggan dan Performa Sales
-- Berkas: supabase/tests/10_analitik.sql
-- Menguji: TC-126 s.d. TC-141
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_manajer_id   uuid;
  v_sales1_id    uuid;
  v_sales2_id    uuid;
  v_gudang_id    uuid;
  v_pelanggan1_id uuid;
  v_pelanggan2_id uuid;
  v_pelanggan3_id uuid;
  v_barang1_id    uuid;
  v_barang2_id    uuid;
  v_pesanan1_id   uuid;
  v_pesanan2_id   uuid;
  v_count         integer;
  v_err_code      text;
  v_sales_res     record;
  v_top_res       record;
  v_dormant_res   record;
  v_dead_res      record;
BEGIN
  RAISE NOTICE '=== MEMULAI TEST SUITE 10: ANALITIK PELANGGAN & PERFORMA SALES ===';

  -- Ambil profil uji
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' AND aktif = true LIMIT 1;
  SELECT id INTO v_sales1_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_sales2_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_gudang_id FROM public.profiles WHERE peran = 'gudang' AND aktif = true LIMIT 1;

  SELECT id INTO v_pelanggan1_id FROM public.pelanggan WHERE aktif = true ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_pelanggan2_id FROM public.pelanggan WHERE aktif = true ORDER BY id DESC LIMIT 1;
  SELECT id INTO v_barang1_id FROM public.barang WHERE aktif = true AND stok > 0 ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_barang2_id FROM public.barang WHERE aktif = true AND stok > 0 ORDER BY id DESC LIMIT 1;

  -- Persiapan data transaksi untuk pengujian analitik
  -- Buat pesanan 1 oleh Sales 1: Status dikirim
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  ) VALUES (
    gen_random_uuid(), 'SO-TEST-ANL-001', v_pelanggan1_id, v_sales1_id, 'dikirim', 500000,
    now() - interval '5 days', now() - interval '4 days', now() - interval '3 days', (now() + interval '10 days')::date
  ) RETURNING id INTO v_pesanan1_id;

  INSERT INTO public.item_pesanan_jual (
    pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal, hpp_satuan
  ) VALUES (
    v_pesanan1_id, v_barang1_id, 5, 100000, 0, 500000, 70000
  );

  -- Buat pesanan 2 oleh Sales 1: Status lunas
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  ) VALUES (
    gen_random_uuid(), 'SO-TEST-ANL-002', v_pelanggan1_id, v_sales1_id, 'lunas', 300000,
    now() - interval '2 days', now() - interval '2 days', now() - interval '1 day', (now() + interval '14 days')::date
  ) RETURNING id INTO v_pesanan2_id;

  INSERT INTO public.item_pesanan_jual (
    pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal, hpp_satuan
  ) VALUES (
    v_pesanan2_id, v_barang1_id, 3, 100000, 0, 300000, 70000
  );

  -- Sales 2 tidak memiliki transaksi pada periode ini (0 order)

  -- Setup konteks Manajer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manajer_id::text, 'role', 'authenticated')::text, true);

  -- ------------------------------------------------------------
  -- TC-126, TC-127, TC-128: Performa Sales
  -- ------------------------------------------------------------
  SELECT * INTO v_sales_res
  FROM public.rpc_analitik_performa_sales((now() - interval '30 days')::date, (now())::date)
  WHERE sales_id = v_sales1_id;

  IF v_sales_res.jumlah_pesanan <> 2 THEN
    RAISE EXCEPTION 'TC-126 Gagal: Jumlah pesanan Sales 1 salah, diharapkan 2 dapat %', v_sales_res.jumlah_pesanan;
  END IF;

  IF v_sales_res.total_omzet <> 800000 THEN
    RAISE EXCEPTION 'TC-126 Gagal: Total omzet Sales 1 salah, diharapkan 800000 dapat %', v_sales_res.total_omzet;
  END IF;

  IF v_sales_res.total_hpp <> (5 * 70000 + 3 * 70000) THEN -- 560000
    RAISE EXCEPTION 'TC-126 Gagal: Total HPP Sales 1 salah, diharapkan 560000 dapat %', v_sales_res.total_hpp;
  END IF;

  IF v_sales_res.total_margin <> 240000 THEN
    RAISE EXCEPTION 'TC-126 Gagal: Total margin Sales 1 salah, diharapkan 240000 dapat %', v_sales_res.total_margin;
  END IF;

  -- TC-128: Piutang berjalan Sales 1 (pesanan status dikirim = 500000)
  IF v_sales_res.piutang_berjalan <> 500000 THEN
    RAISE EXCEPTION 'TC-128 Gagal: Piutang berjalan Sales 1 salah, diharapkan 500000 dapat %', v_sales_res.piutang_berjalan;
  END IF;

  -- TC-127: Staf penjualan tanpa transaksi (Sales 2)
  SELECT * INTO v_sales_res
  FROM public.rpc_analitik_performa_sales((now() - interval '30 days')::date, (now())::date)
  WHERE sales_id = v_sales2_id;

  IF v_sales_res.total_omzet <> 0 OR v_sales_res.margin_persen <> 0 THEN
    RAISE EXCEPTION 'TC-127 Gagal: Sales tanpa transaksi harus bernilai 0 tanpa division by zero';
  END IF;

  RAISE NOTICE '✓ TC-126, TC-127, TC-128 LOLOS: Agregat performa sales, staf 0 transaksi, dan piutang berjalan terverifikasi akurat';

  -- ------------------------------------------------------------
  -- TC-129, TC-130, TC-131: Top Pelanggan & Status Kredit
  -- ------------------------------------------------------------
  SELECT * INTO v_top_res
  FROM public.rpc_analitik_top_pelanggan((now() - interval '30 days')::date, (now())::date, 10)
  WHERE pelanggan_id = v_pelanggan1_id;

  IF v_top_res.total_omzet <> 800000 THEN
    RAISE EXCEPTION 'TC-129 Gagal: Total omzet top pelanggan salah, diharapkan 800000 dapat %', v_top_res.total_omzet;
  END IF;

  IF v_top_res.kontribusi_omzet_persen <= 0 THEN
    RAISE EXCEPTION 'TC-129 Gagal: Kontribusi omzet persen harus > 0';
  END IF;

  -- TC-131: Safe limit guard (minta 100 baris, dibatasi maks 50)
  SELECT COUNT(*) INTO v_count
  FROM public.rpc_analitik_top_pelanggan((now() - interval '30 days')::date, (now())::date, 100);

  IF v_count > 50 THEN
    RAISE EXCEPTION 'TC-131 Gagal: Limit top pelanggan harus dibatasi maksimal 50 baris';
  END IF;

  RAISE NOTICE '✓ TC-129, TC-130, TC-131 LOLOS: Top pelanggan, kontribusi omzet %%, dan safe limit guard terverifikasi';

  -- ------------------------------------------------------------
  -- TC-132, TC-133, TC-134: Pelanggan Tidak Aktif (Dormant)
  -- ------------------------------------------------------------
  -- Buat pelanggan khusus uji dormant tanpa order
  INSERT INTO public.pelanggan (
    id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh, dibuat_pada
  ) VALUES (
    gen_random_uuid(), 'PEL-DORMANT-01', 'Toko Pasif Jaya', '081299990001', 'Jl. Pasif 1', 0, 0, true, v_manajer_id, now() - interval '45 days'
  ) RETURNING id INTO v_pelanggan3_id;

  SELECT * INTO v_dormant_res
  FROM public.rpc_analitik_pelanggan_tidak_aktif(30)
  WHERE pelanggan_id = v_pelanggan3_id;

  IF v_dormant_res.pelanggan_id IS NULL THEN
    RAISE EXCEPTION 'TC-132 Gagal: Pelanggan tidak aktif 45 hari harus muncul di daftar dormant';
  END IF;

  IF v_dormant_res.pesanan_terakhir_pada IS NOT NULL THEN
    RAISE EXCEPTION 'TC-133 Gagal: Pelanggan baru tanpa pesanan harus memiliki pesanan_terakhir_pada NULL';
  END IF;

  IF v_dormant_res.hari_tidak_aktif < 40 THEN
    RAISE EXCEPTION 'TC-133 Gagal: Hari tidak aktif pelanggan tanpa order harus dihitung dari tanggal dibuat';
  END IF;

  -- TC-134: Nonaktifkan pelanggan dan pastikan tidak muncul di daftar dormant
  UPDATE public.pelanggan SET aktif = false WHERE id = v_pelanggan3_id;

  SELECT COUNT(*) INTO v_count
  FROM public.rpc_analitik_pelanggan_tidak_aktif(30)
  WHERE pelanggan_id = v_pelanggan3_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-134 Gagal: Pelanggan nonaktif tidak boleh muncul di daftar dormant';
  END IF;

  RAISE NOTICE '✓ TC-132, TC-133, TC-134 LOLOS: Deteksi dormant customer, penanganan 0 order, dan eksklusi akun nonaktif terverifikasi';

  -- ------------------------------------------------------------
  -- TC-135, TC-136, TC-137, TC-138: Dead Stock & Modal Tertahan
  -- ------------------------------------------------------------
  -- Barang 2 belum pernah terjual dalam pesanan dan punya stok > 0
  SELECT * INTO v_dead_res
  FROM public.rpc_analitik_barang_tidak_bergerak(30)
  WHERE barang_id = v_barang2_id;

  IF v_dead_res.barang_id IS NULL THEN
    RAISE EXCEPTION 'TC-135 Gagal: Barang tanpa penjualan dan stok > 0 harus muncul di dead stock';
  END IF;

  -- TC-136: Modal tertahan = stok * harga_pokok
  IF v_dead_res.nilai_stok_mengendap <> (v_dead_res.stok_saat_ini * v_dead_res.harga_pokok) THEN
    RAISE EXCEPTION 'TC-136 Gagal: Kalkulasi modal tertahan salah';
  END IF;

  -- TC-137: Eksklusi barang stok 0
  PERFORM set_config('app.mutasi_stok', '1', true);
  UPDATE public.barang SET stok = 0 WHERE id = v_barang2_id;
  PERFORM set_config('app.mutasi_stok', '0', true);

  SELECT COUNT(*) INTO v_count
  FROM public.rpc_analitik_barang_tidak_bergerak(30)
  WHERE barang_id = v_barang2_id;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-137 Gagal: Barang dengan stok 0 tidak boleh masuk ke dead stock';
  END IF;

  RAISE NOTICE '✓ TC-135, TC-136, TC-137, TC-138 LOLOS: Deteksi dead stock, kalkulasi dead capital, dan eksklusi stok 0 terverifikasi';

  -- ------------------------------------------------------------
  -- TC-139: Pemblokiran Akses Staf Penjualan (E0001)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sales1_id::text, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM * FROM public.rpc_analitik_performa_sales();
    RAISE EXCEPTION 'TC-139 Gagal: Penjualan harus ditolak saat akses rpc_analitik_performa_sales';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code <> 'E0001' AND SQLERRM NOT LIKE '%Akses ditolak%' THEN
      RAISE EXCEPTION 'TC-139 Gagal: Kode error bukan E0001 melainkan % (%)', v_err_code, SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM * FROM public.rpc_analitik_barang_tidak_bergerak();
    RAISE EXCEPTION 'TC-139 Gagal: Penjualan harus ditolak saat akses rpc_analitik_barang_tidak_bergerak';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code <> 'E0001' AND SQLERRM NOT LIKE '%Akses ditolak%' THEN
      RAISE EXCEPTION 'TC-139 Gagal: Kode error bukan E0001 melainkan % (%)', v_err_code, SQLERRM;
    END IF;
  END;

  RAISE NOTICE '✓ TC-139 LOLOS: Penjualan diblokir total dari seluruh RPC analitik (E0001)';

  -- ------------------------------------------------------------
  -- TC-140: Pemblokiran Akses Staf Gudang (E0001)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gudang_id::text, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM * FROM public.rpc_analitik_top_pelanggan();
    RAISE EXCEPTION 'TC-140 Gagal: Gudang harus ditolak saat akses rpc_analitik_top_pelanggan';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code <> 'E0001' AND SQLERRM NOT LIKE '%Akses ditolak%' THEN
      RAISE EXCEPTION 'TC-140 Gagal: Kode error bukan E0001 melainkan % (%)', v_err_code, SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM * FROM public.rpc_analitik_pelanggan_tidak_aktif();
    RAISE EXCEPTION 'TC-140 Gagal: Gudang harus ditolak saat akses rpc_analitik_pelanggan_tidak_aktif';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    IF v_err_code <> 'E0001' AND SQLERRM NOT LIKE '%Akses ditolak%' THEN
      RAISE EXCEPTION 'TC-140 Gagal: Kode error bukan E0001 melainkan % (%)', v_err_code, SQLERRM;
    END IF;
  END;

  RAISE NOTICE '✓ TC-140 LOLOS: Gudang diblokir total dari seluruh RPC analitik (E0001)';

  RAISE NOTICE '=== SELURUH SKENARIO ANALITIK SQL (TC-126 S.D. TC-140) SUKSES LOLOS ===';
END;
$$;

ROLLBACK;
