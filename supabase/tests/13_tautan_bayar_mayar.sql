-- ============================================================
-- Test Suite 13: Tautan Bayar Piutang lewat Mayar (PRD 11.3)
-- Menguji: Skema, Hak Akses, Idempotensi, Pelunasan Otomatis,
--          Penutupan Otomatis, dan Perlindungan Service-Role
-- ============================================================

BEGIN;

-- Setup Helper Variable & Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_manajer_id uuid;
  v_sales_id uuid;
  v_gudang_id uuid;
  v_pelanggan_id uuid;
  v_barang_id uuid;
  v_pesanan_id uuid;
  v_pesanan_2_id uuid;
  v_pesanan_batal_id uuid;
  v_tagihan_id uuid;
  v_tagihan_2_id uuid;
  v_res jsonb;
  v_siapkan record;
  v_boleh boolean;
BEGIN
  RAISE NOTICE '=== Memulai Test Suite 13: Tautan Bayar Mayar ===';

  -- 1. Ambil Profil Pengguna
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' AND aktif = true LIMIT 1;
  SELECT id INTO v_sales_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true LIMIT 1;
  SELECT id INTO v_gudang_id FROM public.profiles WHERE peran = 'gudang' AND aktif = true LIMIT 1;

  -- 2. Ambil Pelanggan & Barang
  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  SELECT id INTO v_barang_id FROM public.barang WHERE aktif = true AND stok >= 20 LIMIT 1;

  -- 3. Siapkan Pesanan Test 1 (Status: dikirim, total > 0)
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-MYR-01', v_pelanggan_id, v_sales_id, 'dikirim', 500000, now(), now(), now(), (now() + interval '7 days')::date
  )
  RETURNING id INTO v_pesanan_id;

  INSERT INTO public.item_pesanan_jual (
    pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
  )
  VALUES (
    v_pesanan_id, v_barang_id, 5, 100000, 0, 500000
  );

  -- Siapkan Pesanan Test 2 (Status: dikirim)
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-MYR-02', v_pelanggan_id, v_sales_id, 'dikirim', 250000, now(), now(), now(), (now() + interval '14 days')::date
  )
  RETURNING id INTO v_pesanan_2_id;

  -- Siapkan Pesanan Test 3 (Status: draf / batal)
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada
  )
  VALUES (
    'SO-TEST-MYR-03', v_pelanggan_id, v_sales_id, 'draf', 150000, now()
  )
  RETURNING id INTO v_pesanan_batal_id;

  -- ============================================================
  -- TC-173 & TC-192: Validasi Status Pesanan Bukan Dikirim
  -- ============================================================
  RAISE NOTICE '--- TC-192: Penolakan buat tagihan pada pesanan status draf ---';
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

  BEGIN
    PERFORM * FROM public.rpc_siapkan_tagihan_mayar(v_pesanan_batal_id);
    RAISE EXCEPTION 'FAIL: Seharusnya ditolak membuat tagihan untuk pesanan status draf';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0066' THEN
      RAISE NOTICE 'PASS: Pesanan draf ditolak dengan E0066';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0066, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- TC-186: Penolakan Akses Staf Penjualan & Gudang
  -- ============================================================
  RAISE NOTICE '--- TC-186: Penolakan hak akses Penjualan dan Gudang ---';
  PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

  BEGIN
    PERFORM * FROM public.rpc_siapkan_tagihan_mayar(v_pesanan_id);
    RAISE EXCEPTION 'FAIL: Penjualan seharusnya ditolak memanggil rpc_siapkan_tagihan_mayar';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0001' THEN
      RAISE NOTICE 'PASS: Penjualan ditolak dengan E0001';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0001, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);

  BEGIN
    PERFORM * FROM public.rpc_siapkan_tagihan_mayar(v_pesanan_id);
    RAISE EXCEPTION 'FAIL: Gudang seharusnya ditolak memanggil rpc_siapkan_tagihan_mayar';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0001' THEN
      RAISE NOTICE 'PASS: Gudang ditolak dengan E0001';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0001, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- Alur Pembuatan Tagihan Valid oleh Manajer (M5)
  -- ============================================================
  RAISE NOTICE '--- Manajer Menyiapkan dan Menyimpan Tagihan Mayar ---';
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

  SELECT * INTO v_siapkan FROM public.rpc_siapkan_tagihan_mayar(v_pesanan_id);
  ASSERT v_siapkan.pesanan_id = v_pesanan_id, 'FAIL: pesanan_id tidak cocok';
  ASSERT v_siapkan.total_tagihan = 500000, 'FAIL: total_tagihan tidak cocok';

  v_res := public.rpc_simpan_tagihan_mayar(
    v_pesanan_id,
    'inv_test_mayar_001',
    'trx_test_mayar_001',
    'https://pay.mayar.club/p/inv_test_mayar_001',
    500000,
    'customer@toko-test.com',
    now() + interval '7 days'
  );

  v_tagihan_id := (v_res->>'id')::uuid;
  ASSERT v_tagihan_id IS NOT NULL, 'FAIL: tagihan_id null';
  ASSERT (v_res->>'status') = 'dibuat', 'FAIL: status bukan dibuat';
  RAISE NOTICE 'PASS: Tagihan Mayar berhasil dibuat dengan ID %', v_tagihan_id;

  -- ============================================================
  -- TC-184: Constraint Unik Hanya 1 Tagihan Aktif per Pesanan
  -- ============================================================
  RAISE NOTICE '--- TC-184: Penolakan tagihan aktif ganda ---';
  BEGIN
    PERFORM * FROM public.rpc_siapkan_tagihan_mayar(v_pesanan_id);
    RAISE EXCEPTION 'FAIL: Seharusnya ditolak karena sudah memiliki tagihan aktif';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0067' THEN
      RAISE NOTICE 'PASS: Pembuatan tagihan ganda ditolak dengan E0067';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0067, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- TC-178: Uji Idempotensi Webhook Event
  -- ============================================================
  RAISE NOTICE '--- TC-178: Uji Idempotensi Webhook Event ---';
  -- Panggilan pertama: harus menghasilkan true
  v_boleh := public.rpc_sistem_rekam_webhook_event(
    'evt_payment_001_inv_001',
    'payment.received',
    'inv_test_mayar_001',
    'diproses',
    'paid',
    500000
  );
  ASSERT v_boleh = true, 'FAIL: Event pertama harus bernilai true';

  -- Panggilan kedua dengan kunci unik sama: harus menghasilkan false
  v_boleh := public.rpc_sistem_rekam_webhook_event(
    'evt_payment_001_inv_001',
    'payment.received',
    'inv_test_mayar_001',
    'diproses',
    'paid',
    500000
  );
  ASSERT v_boleh = false, 'FAIL: Event duplikat harus bernilai false';
  RAISE NOTICE 'PASS: Idempotensi webhook event terverifikasi';

  -- ============================================================
  -- TC-177: Anomali Nominal Berbeda -> Status perlu_tinjau
  -- ============================================================
  RAISE NOTICE '--- TC-177: Anomali nominal berbeda dialihkan ke perlu_tinjau ---';
  -- Buat tagihan untuk pesanan 2
  v_res := public.rpc_simpan_tagihan_mayar(
    v_pesanan_2_id,
    'inv_test_mayar_002',
    'trx_test_mayar_002',
    'https://pay.mayar.club/p/inv_test_mayar_002',
    250000,
    'customer2@toko-test.com',
    now() + interval '7 days'
  );
  v_tagihan_2_id := (v_res->>'id')::uuid;

  -- Pelunasan dengan nominal salah (misal hanya Rp200.000, bukan Rp250.000)
  v_res := public.rpc_sistem_lunaskan_dari_mayar(
    v_tagihan_2_id,
    'trx_anomali_nominal',
    200000
  );

  ASSERT (v_res->>'success') = 'false', 'FAIL: Seharusnya gagal karena beda nominal';
  ASSERT (v_res->>'status') = 'perlu_tinjau', 'FAIL: Status tagihan harus perlu_tinjau';

  -- Pastikan pesanan 2 MASIH berstatus dikirim (belum lunas)
  PERFORM 1 FROM public.pesanan_jual WHERE id = v_pesanan_2_id AND status = 'dikirim';
  ASSERT FOUND, 'FAIL: Pesanan 2 tidak boleh dilunasi jika nominal berbeda';
  RAISE NOTICE 'PASS: Anomali nominal sukses ditangani tanpa melunasi pesanan';

  -- ============================================================
  -- TC-175: Pelunasan Sukses dari Mayar (Happy Path)
  -- ============================================================
  RAISE NOTICE '--- TC-175: Pelunasan Sukses dari Mayar ---';
  v_res := public.rpc_sistem_lunaskan_dari_mayar(
    v_tagihan_id,
    'trx_settled_mayar_001',
    500000
  );

  ASSERT (v_res->>'success') = 'true', 'FAIL: Pelunasan valid harus sukses';
  ASSERT (v_res->>'status') = 'lunas', 'FAIL: Status pesanan harus lunas';

  -- Verifikasi status pesanan_jual menjadi lunas
  PERFORM 1 FROM public.pesanan_jual 
  WHERE id = v_pesanan_id AND status = 'lunas' AND dilunasi_pada IS NOT NULL;
  ASSERT FOUND, 'FAIL: Pesanan 1 harus berstatus lunas';

  -- Verifikasi status tagihan_mayar menjadi dibayar
  PERFORM 1 FROM public.tagihan_mayar 
  WHERE id = v_tagihan_id AND status = 'dibayar' AND dibayar_pada IS NOT NULL;
  ASSERT FOUND, 'FAIL: Tagihan 1 harus berstatus dibayar';

  -- Verifikasi audit_log tercatat dengan pelaku_id NULL (aksi sistem 'pelunasan')
  PERFORM 1 FROM public.audit_log
  WHERE nama_tabel = 'pesanan_jual'
    AND data_id = v_pesanan_id
    AND aksi = 'pelunasan'
    AND pelaku_id IS NULL
    AND nilai_baru->>'keterangan' = 'Pelunasan via Mayar';
  ASSERT FOUND, 'FAIL: Audit log sistem dengan pelaku NULL dan aksi pelunasan wajib tercatat';
  RAISE NOTICE 'PASS: Pelunasan Mayar sukses, pesanan lunas, audit tercatat';

  -- ============================================================
  -- TC-179: Pembayaran Tiba Saat Pesanan Sudah Lunas Manual
  -- ============================================================
  RAISE NOTICE '--- TC-179: Webhook tiba saat pesanan sudah lunas manual ---';
  -- Coba panggil pelunasan ulang pada pesanan yang sudah lunas
  v_res := public.rpc_sistem_lunaskan_dari_mayar(
    v_tagihan_id,
    'trx_double_payment_attempt',
    500000
  );

  ASSERT (v_res->>'success') = 'false', 'FAIL: Pembayaran ganda tidak boleh sukses';
  ASSERT (v_res->>'status') = 'perlu_tinjau', 'FAIL: Status harus ditandai perlu_tinjau';
  RAISE NOTICE 'PASS: Pembayaran ganda sukses dideteksi dan dialihkan ke perlu_tinjau';

  -- ============================================================
  -- TC-185: Pelunasan Manual Menutup Tagihan Mayar Aktif
  -- ============================================================
  RAISE NOTICE '--- TC-185: Pelunasan manual otomatis menutup tagihan Mayar ---';
  -- Buat pesanan baru & tagihan aktif baru
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, dibuat_oleh, status, total, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-MYR-04', v_pelanggan_id, v_sales_id, 'dikirim', 300000, now(), now(), now(), (now() + interval '7 days')::date
  )
  RETURNING id INTO v_pesanan_id;

  v_res := public.rpc_simpan_tagihan_mayar(
    v_pesanan_id,
    'inv_test_mayar_004',
    'trx_test_mayar_004',
    'https://pay.mayar.club/p/inv_test_mayar_004',
    300000,
    'customer4@toko-test.com',
    now() + interval '7 days'
  );
  v_tagihan_id := (v_res->>'id')::uuid;

  -- Manajer melakukan pelunasan manual via rpc_catat_pelunasan
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  v_res := public.rpc_catat_pelunasan(v_pesanan_id);
  ASSERT (v_res->>'status') = 'lunas', 'FAIL: Pelunasan manual harus lunas';

  -- Tagihan Mayar terkait harus otomatis berubah status menjadi 'ditutup'
  PERFORM 1 FROM public.tagihan_mayar
  WHERE id = v_tagihan_id AND status = 'ditutup';
  ASSERT FOUND, 'FAIL: Tagihan Mayar aktif harus ditutup otomatis saat pelunasan manual';
  RAISE NOTICE 'PASS: Tagihan Mayar aktif sukses tertutup otomatis saat pelunasan manual';

  -- ============================================================
  -- TC-193: Hak Akses RPC Sistem (HANYA service_role)
  -- ============================================================
  RAISE NOTICE '--- TC-193: Penolakan peran authenticated memanggil RPC sistem ---';
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.rpc_sistem_lunaskan_dari_mayar(v_tagihan_id, 'trx_forbidden', 500000);
    RAISE EXCEPTION 'FAIL: Role authenticated seharusnya ditolak memanggil rpc_sistem_lunaskan_dari_mayar';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Role authenticated ditolak memanggil rpc_sistem_lunaskan_dari_mayar (insufficient_privilege)';
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.rpc_sistem_cek_webhook_event_selesai('dummy_key');
    RAISE EXCEPTION 'FAIL: Role authenticated seharusnya ditolak memanggil rpc_sistem_cek_webhook_event_selesai';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Role authenticated ditolak memanggil rpc_sistem_cek_webhook_event_selesai (insufficient_privilege)';
  END;

  RAISE NOTICE '=== SEMUA UJI SQL SUITE 13 BERHASIL DILALUI ===';
END $$;

ROLLBACK;
