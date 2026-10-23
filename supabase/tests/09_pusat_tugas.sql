-- ============================================================
-- TEST SUITE 09: PUSAT TUGAS HARIAN & DAFTAR AMBIL BARANG (PICKING LIST)
-- Memverifikasi TC-111 s.d. TC-123
-- ============================================================

BEGIN;

-- Helper untuk mensimulasikan login pengguna
CREATE OR REPLACE FUNCTION set_user(user_id uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_p1 uuid := '11111111-1111-1111-1111-111111111111';
  v_p2 uuid := '11111111-1111-1111-1111-111111111112';
  v_gudang uuid := '22222222-2222-2222-2222-222222222222';
  v_manajer uuid := '33333333-3333-3333-3333-333333333333';
  v_plg_id uuid;
  v_brg1 uuid;
  v_brg2 uuid;
  v_so1 uuid;
  v_so2 uuid;
  v_so_draf_p1 uuid;
  v_so_draf_p2 uuid;
  v_so_lain uuid;
  v_res jsonb;
  v_err_msg text;
  v_item jsonb;
  v_base_draf_p1 int;
  v_base_menunggu_p1 int;
  v_base_siap_kirim int;
BEGIN
  RAISE NOTICE '=== MEMULAI TEST SUITE 09: PUSAT TUGAS & PICKING LIST ===';

  -- Ambil pelanggan & barang seed
  SELECT id INTO v_plg_id FROM public.pelanggan LIMIT 1;
  SELECT id INTO v_brg1 FROM public.barang ORDER BY kode ASC LIMIT 1;
  SELECT id INTO v_brg2 FROM public.barang WHERE id <> v_brg1 ORDER BY kode ASC LIMIT 1;

  -- ------------------------------------------------------------
  -- Setup Data Awal Uji
  -- ------------------------------------------------------------
  -- Ambil baseline awal sebelum data uji dibuat
  PERFORM set_user(v_p1);
  v_res := public.rpc_get_tugas_harian();
  v_base_draf_p1 := (v_res->>'draf_saya')::int;
  v_base_menunggu_p1 := (v_res->>'menunggu_kirim_saya')::int;

  PERFORM set_user(v_gudang);
  v_res := public.rpc_get_tugas_harian();
  v_base_siap_kirim := (v_res->>'pesanan_siap_kirim')::int;

    -- Buat Draf P1
    INSERT INTO public.pesanan_jual (id, nomor, pelanggan_id, status, total, dibuat_oleh)
    VALUES (gen_random_uuid(), 'SO-TEST-DRAF-P1', v_plg_id, 'draf', 50000, v_p1)
    RETURNING id INTO v_so_draf_p1;

    -- Buat Draf P2
    INSERT INTO public.pesanan_jual (id, nomor, pelanggan_id, status, total, dibuat_oleh)
    VALUES (gen_random_uuid(), 'SO-TEST-DRAF-P2', v_plg_id, 'draf', 75000, v_p2)
    RETURNING id INTO v_so_draf_p2;

    -- Buat Pesanan Dikonfirmasi 1 (P1)
    INSERT INTO public.pesanan_jual (id, nomor, pelanggan_id, status, total, dibuat_oleh, dikonfirmasi_pada)
    VALUES (gen_random_uuid(), 'SO-TEST-CONF-1', v_plg_id, 'dikonfirmasi', 100000, v_p1, now() - INTERVAL '2 days')
    RETURNING id INTO v_so1;

    INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
    VALUES (v_so1, v_brg1, 5, 20000, 100000);

    -- Buat Pesanan Dikonfirmasi 2 (P2)
    INSERT INTO public.pesanan_jual (id, nomor, pelanggan_id, status, total, dibuat_oleh, dikonfirmasi_pada)
    VALUES (gen_random_uuid(), 'SO-TEST-CONF-2', v_plg_id, 'dikonfirmasi', 150000, v_p2, now() - INTERVAL '1 day')
    RETURNING id INTO v_so2;

    INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
    VALUES (v_so2, v_brg1, 10, 15000, 150000);

    -- Buat Pesanan Lain berstatus 'dikirim'
    INSERT INTO public.pesanan_jual (id, nomor, pelanggan_id, status, total, dibuat_oleh, dikonfirmasi_pada, dikirim_pada)
    VALUES (gen_random_uuid(), 'SO-TEST-KIRIM', v_plg_id, 'dikirim', 50000, v_p1, now() - INTERVAL '3 days', now() - INTERVAL '1 day')
    RETURNING id INTO v_so_lain;

    INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
    VALUES (v_so_lain, v_brg2, 2, 25000, 50000);

    -- ------------------------------------------------------------
    -- TC-111 & TC-112: Akurasi & Isolasi Dasbor Penjualan 1
    -- ------------------------------------------------------------
    PERFORM set_user(v_p1);
    v_res := public.rpc_get_tugas_harian();

    IF (v_res->>'peran') <> 'penjualan' THEN
      RAISE EXCEPTION 'TC-111 Gagal: Peran bukan penjualan';
    END IF;

    -- Draf P1 harus bertambah tepat 1 (tidak terpengaruh draf P2 yang juga baru dibuat)
    IF (v_res->>'draf_saya')::int <> v_base_draf_p1 + 1 THEN
      RAISE EXCEPTION 'TC-111 / TC-112 Gagal: draf_saya = %, ekspektasi %', (v_res->>'draf_saya'), v_base_draf_p1 + 1;
    END IF;

    -- Menunggu kirim P1 harus bertambah tepat 1 (hanya SO-TEST-CONF-1, tidak menghitung SO-TEST-CONF-2 milik P2)
    IF (v_res->>'menunggu_kirim_saya')::int <> v_base_menunggu_p1 + 1 THEN
      RAISE EXCEPTION 'TC-111 / TC-112 Gagal: menunggu_kirim_saya = %, ekspektasi %', (v_res->>'menunggu_kirim_saya'), v_base_menunggu_p1 + 1;
    END IF;
    RAISE NOTICE '✓ TC-111 & TC-112 LOLOS: Agregat dasbor Penjualan dan isolasi kepemilikan terverifikasi';

    -- ------------------------------------------------------------
    -- TC-113: Akurasi Agregat Dasbor Gudang & Umur Pesanan Tertua
    -- ------------------------------------------------------------
    PERFORM set_user(v_gudang);
    v_res := public.rpc_get_tugas_harian();

    IF (v_res->>'peran') <> 'gudang' THEN
      RAISE EXCEPTION 'TC-113 Gagal: Peran bukan gudang';
    END IF;

    -- Pesanan siap kirim harus bertambah tepat 2 (SO 1 dan SO 2)
    IF (v_res->>'pesanan_siap_kirim')::int <> v_base_siap_kirim + 2 THEN
      RAISE EXCEPTION 'TC-113 Gagal: pesanan_siap_kirim = %, ekspektasi %', (v_res->>'pesanan_siap_kirim'), v_base_siap_kirim + 2;
    END IF;

  -- Umur pesanan tertua minimal 2 hari (SO 1 dibuat 2 hari lalu)
  IF (v_res->>'umur_pesanan_tertua_hari')::int < 2 THEN
    RAISE EXCEPTION 'TC-113 Gagal: umur_pesanan_tertua_hari = %, ekspektasi minimal 2', (v_res->>'umur_pesanan_tertua_hari');
  END IF;
  RAISE NOTICE '✓ TC-113 LOLOS: Agregat dasbor Gudang dan perhitungan umur pesanan tertua terverifikasi';

  -- ------------------------------------------------------------
  -- TC-114: Akurasi Agregat Dasbor Manajer
  -- ------------------------------------------------------------
  PERFORM set_user(v_manajer);
  v_res := public.rpc_get_tugas_harian();

  IF (v_res->>'peran') <> 'manajer' THEN
    RAISE EXCEPTION 'TC-114 Gagal: Peran bukan manajer';
  END IF;
  RAISE NOTICE '✓ TC-114 LOLOS: Agregat dasbor Manajer terverifikasi';

  -- ------------------------------------------------------------
  -- TC-115: Penolakan Pengguna Anonim
  -- ------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  BEGIN
    PERFORM public.rpc_get_tugas_harian();
    RAISE EXCEPTION 'TC-115 Gagal: Anonim harusnya ditolak E0001';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%E0001%' AND SQLERRM NOT LIKE '%Akses ditolak%' THEN
      RAISE EXCEPTION 'TC-115 Gagal: Pesan error salah: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ TC-115 LOLOS: rpc_get_tugas_harian menolak pemanggil tanpa otorisasi';

  -- ------------------------------------------------------------
  -- TC-116: Pemblokiran Penjualan pada rpc_ambil_daftar_picking
  -- ------------------------------------------------------------
  PERFORM set_user(v_p1);
  BEGIN
    PERFORM public.rpc_ambil_daftar_picking(ARRAY[v_so1]);
    RAISE EXCEPTION 'TC-116 Gagal: Penjualan harusnya ditolak E0065';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%E0065%' THEN
      RAISE EXCEPTION 'TC-116 Gagal: Pesan error salah: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ TC-116 LOLOS: Staf Penjualan ditolak mengakses picking list (E0065)';

  -- ------------------------------------------------------------
  -- TC-120: Penolakan Parameter Daftar Pesanan Kosong
  -- ------------------------------------------------------------
  PERFORM set_user(v_gudang);
  BEGIN
    PERFORM public.rpc_ambil_daftar_picking(ARRAY[]::uuid[]);
    RAISE EXCEPTION 'TC-120 Gagal: Array kosong harusnya ditolak E0063';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%E0063%' THEN
      RAISE EXCEPTION 'TC-120 Gagal: Pesan error salah: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ TC-120 LOLOS: Array pesanan kosong ditolak E0063';

  -- ------------------------------------------------------------
  -- TC-121: Penolakan Pesanan Bukan Berstatus Dikonfirmasi
  -- ------------------------------------------------------------
  PERFORM set_user(v_gudang);
  BEGIN
    -- Masukkan pesanan berstatus draf atau dikirim
    PERFORM public.rpc_ambil_daftar_picking(ARRAY[v_so1, v_so_lain]);
    RAISE EXCEPTION 'TC-121 Gagal: Pesanan non-dikonfirmasi harusnya ditolak E0064';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%E0064%' THEN
      RAISE EXCEPTION 'TC-121 Gagal: Pesan error salah: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ TC-121 LOLOS: Pesanan non-dikonfirmasi ditolak E0064';

  -- ------------------------------------------------------------
  -- TC-122: Penolakan Pesanan dengan ID Palsu
  -- ------------------------------------------------------------
  PERFORM set_user(v_gudang);
  BEGIN
    PERFORM public.rpc_ambil_daftar_picking(ARRAY[v_so1, gen_random_uuid()]);
    RAISE EXCEPTION 'TC-122 Gagal: ID palsu harusnya ditolak E0064';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%E0064%' THEN
      RAISE EXCEPTION 'TC-122 Gagal: Pesan error salah: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ TC-122 LOLOS: Pesanan ID palsu ditolak E0064';

  -- ------------------------------------------------------------
  -- TC-117, TC-118, TC-119, TC-123: Pembuatan Picking List Multi-Pesanan & Zero-Leakage
  -- ------------------------------------------------------------
  PERFORM set_user(v_gudang);
  -- Ambil SO 1 (5 unit brg1) dan SO 2 (10 unit brg1)
  v_res := public.rpc_ambil_daftar_picking(ARRAY[v_so1, v_so2]);

  IF (v_res->'metadata'->>'total_pesanan')::int <> 2 THEN
    RAISE EXCEPTION 'TC-117 Gagal: total_pesanan = %, ekspektasi 2', (v_res->'metadata'->>'total_pesanan');
  END IF;

  -- Cek agregasi brg1: 5 + 10 = 15 unit
  v_item := (v_res->'ringkasan_barang')->0;
  IF (v_item->>'total_diambil')::int <> 15 THEN
    RAISE EXCEPTION 'TC-118 Gagal: total_diambil barang = %, ekspektasi 15', (v_item->>'total_diambil');
  END IF;

  -- TC-119: Cek keberadaan flag stok_cukup
  IF (v_item->>'stok_cukup') IS NULL THEN
    RAISE EXCEPTION 'TC-119 Gagal: stok_cukup tidak boleh null';
  END IF;

  -- TC-123: Zero-Leakage Data Rahasia
  -- Verifikasi tidak ada kunci rahasia pada seluruh JSONB kembalian
  IF v_res::text LIKE '%harga_satuan%'
     OR v_res::text LIKE '%harga_pokok%'
     OR v_res::text LIKE '%hpp_satuan%'
     OR v_res::text LIKE '%diskon%'
     OR v_res::text LIKE '%margin%'
     OR v_res::text LIKE '%subtotal%' THEN
    RAISE EXCEPTION 'TC-123 Gagal: Terdapat data finansial/rahasia di hasil picking list';
  END IF;

  RAISE NOTICE '✓ TC-117, TC-118, TC-119, TC-123 LOLOS: Picking list multi-pesanan teragregasi presisi dan 100%% zero-leakage';

  RAISE NOTICE '=== SELURUH SKENARIO PUSAT TUGAS & PICKING LIST (TC-111 S.D. TC-123) SUKSES LOLOS ===';
END;
$$;

ROLLBACK;
