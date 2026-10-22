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
  v_nomor_opname text;
  v_alasan_mutasi text;
  v_so jsonb;
  v_so_id uuid;
  v_plg_id uuid;
  v_kredit_rec record;
  v_today date;
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

  -- ------------------------------------------------------------
  -- TC-49: Validasi Keterangan Selisih 9 vs 10 Karakter (E0037)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;

  -- Coba buat opname dengan selisih dan keterangan hanya 9 karakter -> Ditolak E0037
  BEGIN
    PERFORM public.rpc_buat_opname_stok(
      'Audit Keterangan 9 Karakter',
      jsonb_build_array(
        jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 2, 'keterangan', '123456789')
      ),
      false
    );
    RAISE EXCEPTION 'TC-49 GAGAL: Keterangan selisih 9 karakter harusnya ditolak E0037';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0037%', 'TC-49 GAGAL: Pesan error harus E0037, dapat: ' || SQLERRM;
    RAISE NOTICE '✓ TC-49.1 LOLOS: Pembuatan opname selisih dengan keterangan 9 karakter ditolak E0037';
  END;

  -- Buat draf dengan keterangan 10 karakter -> Berhasil
  v_opname_id := public.rpc_buat_opname_stok(
    'Audit Keterangan 10 Karakter',
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 2, 'keterangan', '1234567890')
    ),
    false
  );
  ASSERT v_opname_id IS NOT NULL, 'TC-49 GAGAL: Draf 10 karakter gagal dibuat';

  -- Coba ubah draf dengan keterangan di bawah 10 karakter setelah trim -> Ditolak E0037
  BEGIN
    PERFORM public.rpc_ubah_draf_opname(
      v_opname_id,
      'Ubah Draf Pendek',
      jsonb_build_array(
        jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 2, 'keterangan', '   pendek  ')
      )
    );
    RAISE EXCEPTION 'TC-49 GAGAL: Ubah draf keterangan < 10 karakter harusnya ditolak';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0037%', 'TC-49 GAGAL: Ubah draf harus tolak E0037';
    RAISE NOTICE '✓ TC-49.2 LOLOS: Ubah draf dengan keterangan setelah trim < 10 karakter ditolak E0037';
  END;

  -- Ubah draf dengan keterangan valid (>= 10 karakter)
  PERFORM public.rpc_ubah_draf_opname(
    v_opname_id,
    'Ubah Draf Valid',
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 2, 'keterangan', 'Kelebihan 2 pcs saat hitung')
    )
  );
  RAISE NOTICE '✓ TC-49 LOLOS: Aturan keterangan selisih min 10 karakter (E0037) terverifikasi';

  -- ------------------------------------------------------------
  -- TC-50: Format Alasan mutasi_stok "Stock opname <nomor>: <keterangan>"
  -- ------------------------------------------------------------
  PERFORM public.rpc_ajukan_opname_stok(v_opname_id);
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_setujui_opname_stok(v_opname_id);

  SELECT nomor INTO v_nomor_opname FROM public.opname_stok WHERE id = v_opname_id;
  SELECT alasan INTO v_alasan_mutasi FROM public.mutasi_stok
  WHERE nomor_dokumen = v_nomor_opname AND barang_id = v_barang_id
  ORDER BY dibuat_pada DESC LIMIT 1;

  ASSERT v_alasan_mutasi = 'Stock opname ' || v_nomor_opname || ': Kelebihan 2 pcs saat hitung',
    'TC-50 GAGAL: Format alasan mutasi_stok salah: ' || COALESCE(v_alasan_mutasi, 'NULL');
  RAISE NOTICE '✓ TC-50 LOLOS: Format alasan mutasi_stok sesuai BR-11 ("Stock opname <nomor>: <keterangan>")';

  -- ------------------------------------------------------------
  -- TC-51: Pengaman K4: Persetujuan Ditolak Saat Stok Berubah di Tengah Sesi (E0038)
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;

  -- Buat sesi opname saat stok_sistem = v_stok_akhir
  v_opname_id := public.rpc_buat_opname_stok(
    'Audit K4 Stok Berubah',
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 5, 'keterangan', 'Fisik bertambah lima pcs')
    ),
    true -- langsung diajukan
  );

  -- Simulasikan penjualan terjadi di tengah jalan sebelum persetujuan manajer
  -- Ambil pelanggan aktif
  SELECT id INTO v_plg_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_penjualan_id::text, true);
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_barang_id, 1, 0);
  PERFORM public.rpc_konfirmasi_pesanan(v_so_id); -- Mengurangi stok barang sebanyak 1

  -- Manajer mencoba menyetujui sesi opname -> WAJIB DITOLAK E0038 karena stok sekarang != stok_sistem sesi
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  BEGIN
    PERFORM public.rpc_setujui_opname_stok(v_opname_id);
    RAISE EXCEPTION 'TC-51 GAGAL: Persetujuan harusnya ditolak karena stok berubah';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0038%', 'TC-51 GAGAL: Pesan error harus E0038, dapat: ' || SQLERRM;
    ASSERT SQLERRM LIKE '%Batalkan sesi lalu hitung ulang%', 'TC-51 GAGAL: Pesan harus memuat petunjuk batalkan sesi, dapat: ' || SQLERRM;
    RAISE NOTICE '✓ TC-51 LOLOS: Persetujuan ditolak saat stok berubah di tengah sesi (E0038)';
  END;

  -- ------------------------------------------------------------
  -- TC-52: Persetujuan Sukses Bila Stok Tidak Berubah
  -- ------------------------------------------------------------
  -- Batalkan sesi yang tertolak tadi
  PERFORM public.rpc_batalkan_opname_stok(v_opname_id, 'Pembatalan karena stok berubah di tengah sesi');

  -- Buat sesi baru dengan stok_sistem mutakhir
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;
  v_opname_id := public.rpc_buat_opname_stok(
    'Audit K4 Stok Stabil',
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'stok_fisik', v_stok_akhir + 3, 'keterangan', 'Fisik valid selisih tiga pcs')
    ),
    true -- langsung diajukan
  );

  -- Manajer menyetujui tanpa perubahan stok di antaranya -> Sukses
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_setujui_opname_stok(v_opname_id);
  ASSERT (SELECT status FROM public.opname_stok WHERE id = v_opname_id) = 'disetujui', 'TC-52 GAGAL: Sesi harus disetujui';
  ASSERT (SELECT stok FROM public.barang WHERE id = v_barang_id) = v_stok_akhir + 3, 'TC-52 GAGAL: Stok akhir tidak sesuai';
  RAISE NOTICE '✓ TC-52 LOLOS: Persetujuan sukses bila stok tidak berubah sejak sesi dibuat';

  -- ------------------------------------------------------------
  -- TC-53: Persetujuan Ganda Tetap Ditolak (E0034)
  -- ------------------------------------------------------------
  BEGIN
    PERFORM public.rpc_setujui_opname_stok(v_opname_id);
    RAISE EXCEPTION 'TC-53 GAGAL: Persetujuan ganda harusnya ditolak E0034';
  EXCEPTION WHEN OTHERS THEN
    ASSERT SQLERRM LIKE '%E0034%', 'TC-53 GAGAL: Error harus E0034, dapat: ' || SQLERRM;
    RAISE NOTICE '✓ TC-53 LOLOS: Persetujuan ganda pada sesi yang telah disetujui ditolak (E0034)';
  END;

  -- ------------------------------------------------------------
  -- TC-54: Tanggal Bisnis fn_hitung_kredit_pelanggan (now() AT TIME ZONE 'Asia/Jakarta')
  -- ------------------------------------------------------------
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  -- Buat pesanan terkirim jatuh tempo HARI INI
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'f1111111-0000-0000-0000-000000000054', 'SO-TC54-HARI-INI', v_plg_id, 'dikirim', 10000,
    v_penjualan_id, now(), now(), v_today
  );

  SELECT * INTO v_kredit_rec FROM public.fn_hitung_kredit_pelanggan(v_plg_id);
  ASSERT v_kredit_rec.punya_overdue = false, 'TC-54 GAGAL: Jatuh tempo hari ini tidak boleh dianggap overdue';

  -- Ubah tanggal jatuh tempo menjadi KEMARIN
  UPDATE public.pesanan_jual SET jatuh_tempo = v_today - 1 WHERE id = 'f1111111-0000-0000-0000-000000000054';

  SELECT * INTO v_kredit_rec FROM public.fn_hitung_kredit_pelanggan(v_plg_id);
  ASSERT v_kredit_rec.punya_overdue = true, 'TC-54 GAGAL: Jatuh tempo kemarin wajib dianggap overdue';
  RAISE NOTICE '✓ TC-54 LOLOS: Tanggal bisnis Asia/Jakarta (hari ini aman, kemarin overdue) terverifikasi';

  -- Bersihkan data uji TC-54
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id = 'f1111111-0000-0000-0000-000000000054';
  DELETE FROM public.pesanan_jual WHERE id = 'f1111111-0000-0000-0000-000000000054';

  RAISE NOTICE '=== SELURUH TEST CASES TC-41 S.D. TC-54 LOLOS SEMPURNA ===';
END $$;
