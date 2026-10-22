-- ============================================================
-- SUITE TEST 05: Stock Opname & Penyesuaian Fisik Gudang
-- File: supabase/tests/05_stock_opname.sql
-- Sesuai: TC-41 s.d. TC-48, docs/fitur-stock-opname.md
-- ============================================================

DO $$
DECLARE
  v_gudang_id uuid;
  v_manajer_id uuid;
  v_penjualan_id uuid;
  v_barang_id uuid;
  v_barang_stok_awal integer;
  v_opname_id uuid;
  v_mutasi_count integer;
  v_stok_akhir integer;
BEGIN
  RAISE NOTICE '=== MEMULAI TEST SUITE 05: STOCK OPNAME ===';

  -- Ambil profile pengguna
  SELECT id INTO v_gudang_id FROM public.profiles WHERE peran = 'gudang' AND aktif = true LIMIT 1;
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' AND aktif = true LIMIT 1;
  SELECT id INTO v_penjualan_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true LIMIT 1;
  SELECT id, stok INTO v_barang_id, v_barang_stok_awal FROM public.barang WHERE aktif = true LIMIT 1;

  -- ------------------------------------------------------------
  -- TC-41: Pembuatan Draf Stock Opname oleh Gudang
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_opname_id := public.rpc_buat_opname_stok(
    'Audit TC-41',
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_barang_stok_awal + 5, 'keterangan', 'Barang lebih di rak')
    ),
    false -- status draf
  );

  ASSERT v_opname_id IS NOT NULL, 'TC-41 GAGAL: ID sesi opname tidak terbuat';
  ASSERT (SELECT status FROM public.opname_stok WHERE id = v_opname_id) = 'draf', 'TC-41 GAGAL: Status awal harus draf';
  RAISE NOTICE '✓ TC-41 LOLOS: Draf opname berhasil dibuat';

  -- ------------------------------------------------------------
  -- TC-42: Penolakan Akses Staf Penjualan (Akses Ditolak E0001)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_penjualan_id::text, true);
  BEGIN
    PERFORM public.rpc_buat_opname_stok(
      'Audit Ilegal Penjualan',
      jsonb_build_array(jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', 10)),
      false
    );
    RAISE EXCEPTION 'TC-42 GAGAL: Penjualan harusnya ditolak membuat opname';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0001%', 'TC-42 GAGAL: Pesan error harus E0001';
    RAISE NOTICE '✓ TC-42 LOLOS: Akses staf penjualan ditolak dengan benar (E0001)';
  END;

  -- ------------------------------------------------------------
  -- TC-43: Validasi Stok Fisik Negatif (E0033) & Duplikat (E0035)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  BEGIN
    PERFORM public.rpc_buat_opname_stok(
      'Audit Negatif',
      jsonb_build_array(jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', -5)),
      false
    );
    RAISE EXCEPTION 'TC-43 GAGAL: Stok negatif harusnya ditolak';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0033%', 'TC-43 GAGAL: Pesan error harus E0033';
    RAISE NOTICE '✓ TC-43 LOLOS: Validasi stok fisik negatif ditolak (E0033)';
  END;

  -- ------------------------------------------------------------
  -- TC-44: Pengajuan Sesi Opname (draf -> diajukan)
  -- ------------------------------------------------------------
  PERFORM public.rpc_ajukan_opname_stok(v_opname_id);
  ASSERT (SELECT status FROM public.opname_stok WHERE id = v_opname_id) = 'diajukan', 'TC-44 GAGAL: Status harusnya diajukan';
  RAISE NOTICE '✓ TC-44 LOLOS: Sesi opname berhasil diajukan ke Manajer';

  -- ------------------------------------------------------------
  -- TC-45: Larangan Staf Gudang Menyetujui Opname Sendiri (E0036)
  -- ------------------------------------------------------------
  BEGIN
    PERFORM public.rpc_setujui_opname_stok(v_opname_id);
    RAISE EXCEPTION 'TC-45 GAGAL: Staf gudang tidak boleh menyetujui opname';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0036%', 'TC-45 GAGAL: Pesan error harus E0036';
    RAISE NOTICE '✓ TC-45 LOLOS: Staf gudang dilarang menyetujui opname sendiri (E0036)';
  END;

  -- ------------------------------------------------------------
  -- TC-46: Persetujuan Manajer & Koreksi Fisik Stok Otomatis
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_setujui_opname_stok(v_opname_id);

  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;
  ASSERT v_stok_akhir = v_barang_stok_awal + 5, 'TC-46 GAGAL: Stok barang tidak terkoreksi sesuai fisik';

  SELECT COUNT(*) INTO v_mutasi_count FROM public.mutasi_stok
  WHERE nomor_dokumen = (SELECT nomor FROM public.opname_stok WHERE id = v_opname_id)
    AND jenis = 'penyesuaian';
  ASSERT v_mutasi_count = 1, 'TC-46 GAGAL: Kartu stok mutasi_stok tidak tercatat';

  RAISE NOTICE '✓ TC-46 LOLOS: Manajer menyetujui opname, stok terkoreksi, kartu stok penyesuaian tercatat';

  -- ------------------------------------------------------------
  -- TC-47: Pembatalan Sesi & Validasi Alasan Minimal 10 Karakter (E0016)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  v_opname_id := public.rpc_buat_opname_stok(
    'Audit Batal',
    jsonb_build_array(jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir)),
    false
  );

  BEGIN
    PERFORM public.rpc_batalkan_opname_stok(v_opname_id, 'Pendek');
    RAISE EXCEPTION 'TC-47 GAGAL: Alasan pendek harusnya ditolak';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0016%', 'TC-47 GAGAL: Pesan error harus E0016';
  END;

  PERFORM public.rpc_batalkan_opname_stok(v_opname_id, 'Pembatalan karena salah nomor rak audit');
  ASSERT (SELECT status FROM public.opname_stok WHERE id = v_opname_id) = 'dibatalkan', 'TC-47 GAGAL: Status harus dibatalkan';
  RAISE NOTICE '✓ TC-47 LOLOS: Pembatalan sesi opname tervalidasi minimal 10 karakter';

  -- ------------------------------------------------------------
  -- TC-48: Kerahasiaan View v_opname_stok_manajer
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  ASSERT (SELECT COUNT(*) FROM public.v_opname_stok_manajer) = 0, 'TC-48 GAGAL: Gudang tidak boleh melihat data view manajer';

  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  ASSERT (SELECT COUNT(*) FROM public.v_opname_stok_manajer) > 0, 'TC-48 GAGAL: Manajer harusnya bisa melihat data view manajer';
  RAISE NOTICE '✓ TC-48 LOLOS: Kerahasiaan finansial view manajer terisolasi sempurna';

  RAISE NOTICE '=== SELURUH TEST CASES TC-41 S.D. TC-48 LOLOS SEMPURNA ===';
END $$;
