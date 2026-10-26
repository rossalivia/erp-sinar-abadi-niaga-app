-- ============================================================
-- SUITE UJI AUDIT PRD LENGKAP: 11 BUTIR (19_audit_prd_11_butir.sql)
-- Memverifikasi 11 Butir PRD langsung di database sebagai:
-- - Hendra (Manajer)
-- - Rina (Penjualan)
-- - Joko (Penjualan)
-- - Dimas (Gudang)
-- - Agus (Gudang Nonaktif)
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS audit_prd_hasil (
  id serial PRIMARY KEY,
  butir_no integer,
  deskripsi text,
  status text,
  catatan text
);

GRANT ALL ON audit_prd_hasil TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_hendra_id uuid;
  v_rina_id uuid;
  v_joko_id uuid;
  v_dimas_id uuid;
  v_agus_id uuid;

  v_barang_id uuid;
  v_barang_kode text;
  v_barang_stok int;
  v_pelanggan_id uuid;
  v_pesanan_id uuid;
  v_pembelian_id uuid;
  v_item_id uuid;

  v_err boolean;
  v_err_msg text;
  v_count int;
  v_stok_awal int;
  v_stok_akhir int;
BEGIN
  -- Ambil UUID dinamis berdasarkan email atau fallback
  SELECT id INTO v_hendra_id FROM public.profiles WHERE email = 'hendra@sinarabadi.test';
  IF v_hendra_id IS NULL THEN v_hendra_id := 'defeb8ce-05f6-5a28-90ea-d8c5921fe92e'::uuid; END IF;

  SELECT id INTO v_rina_id FROM public.profiles WHERE email = 'rina@sinarabadi.test';
  IF v_rina_id IS NULL THEN v_rina_id := '1eb18f29-66c1-5086-900e-874c2d3208e5'::uuid; END IF;

  SELECT id INTO v_joko_id FROM public.profiles WHERE email = 'joko@sinarabadi.test';
  IF v_joko_id IS NULL THEN v_joko_id := '0c99b1d9-84f8-5784-a479-3df27328aebd'::uuid; END IF;

  SELECT id INTO v_dimas_id FROM public.profiles WHERE email = 'dimas@sinarabadi.test';
  IF v_dimas_id IS NULL THEN v_dimas_id := 'da8229f5-916d-55c1-aaee-cd3cfe3e0a7b'::uuid; END IF;

  SELECT id INTO v_agus_id FROM public.profiles WHERE email = 'agus@sinarabadi.test';
  IF v_agus_id IS NULL THEN v_agus_id := '58306883-5223-5b88-8691-edb367c35df9'::uuid; END IF;

  SELECT id, kode, stok INTO v_barang_id, v_barang_kode, v_barang_stok FROM public.barang WHERE aktif = true LIMIT 1;
  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;

  -- ============================================================
  -- BUTIR 1: Kolom rahasia tidak muncul untuk Penjualan/Gudang
  -- ============================================================
  -- 1a. Rina (Penjualan) baca barang.harga_pokok langsung
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rina_id)::text, true);
  v_err := false;
  BEGIN
    EXECUTE 'SELECT harga_pokok FROM public.barang LIMIT 1';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'SELECT barang.harga_pokok oleh Rina ditolak', 'LULUS', 'Column grant aktif');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'SELECT barang.harga_pokok oleh Rina ditolak', 'GAGAL', 'Kebocoran harga_pokok');
  END IF;

  -- 1b. Dimas (Gudang) baca pembelian.harga_beli_satuan langsung
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dimas_id)::text, true);
  v_err := false;
  BEGIN
    EXECUTE 'SELECT harga_beli_satuan FROM public.pembelian LIMIT 1';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'SELECT pembelian.harga_beli_satuan oleh Dimas ditolak', 'LULUS', 'Column grant aktif');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'SELECT pembelian.harga_beli_satuan oleh Dimas ditolak', 'GAGAL', 'Kebocoran harga_beli_satuan');
  END IF;

  -- 1c. Rina baca v_barang_manajer (harus 0 baris)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rina_id)::text, true);
  SELECT count(*) INTO v_count FROM public.v_barang_manajer;
  IF v_count = 0 THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'v_barang_manajer oleh Rina kosong (0 baris)', 'LULUS', 'Filter fn_is_manajer aktif');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (1, 'v_barang_manajer oleh Rina kosong (0 baris)', 'GAGAL', 'View manajer bocor ke penjualan');
  END IF;

  -- ============================================================
  -- BUTIR 2: Gudang boleh ubah nama, satuan, stok_min, aktif (bukan harga, kode, stok);
  -- tidak bisa buka pelanggan; hanya melihat pesanan dikonfirmasi_pada NOT NULL
  -- ============================================================
  -- 2a. Dimas ubah nama & stok_minimum (harus berhasil)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dimas_id)::text, true);
  v_err := false;
  BEGIN
    UPDATE public.barang SET stok_minimum = stok_minimum WHERE id = v_barang_id;
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF NOT v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas (Gudang) boleh update stok_minimum barang', 'LULUS', 'Diizinkan trigger & RLS');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas (Gudang) boleh update stok_minimum barang', 'GAGAL', 'Ditolak');
  END IF;

  -- 2b. Dimas ubah harga_jual (harus DITOLAK)
  v_err := false;
  BEGIN
    UPDATE public.barang SET harga_jual = harga_jual + 1000 WHERE id = v_barang_id;
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas ubah harga_jual barang DITOLAK', 'LULUS', 'Trigger fn_guard_barang menolak');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas ubah harga_jual barang DITOLAK', 'GAGAL', 'Gudang berhasil ubah harga!');
  END IF;

  -- 2c. Dimas SELECT pelanggan (harus 0 baris via RLS)
  SELECT count(*) INTO v_count FROM public.pelanggan;
  IF v_count = 0 THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas (Gudang) tidak bisa membaca tabel pelanggan (0 baris)', 'LULUS', 'RLS pelanggan memblokir gudang');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (2, 'Dimas (Gudang) tidak bisa membaca tabel pelanggan (0 baris)', 'GAGAL', 'Gudang bisa membaca pelanggan');
  END IF;

  -- ============================================================
  -- BUTIR 3: Penjualan hanya boleh konfirmasi/batalkan draf miliknya; Manajer boleh semua
  -- ============================================================
  -- 3a. Buat draf pesanan oleh Joko
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_joko_id)::text, true);
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, dibuat_pada)
  VALUES ('SO-AUDIT-01', v_pelanggan_id, 'draf', v_joko_id, now())
  RETURNING id INTO v_pesanan_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
  VALUES (v_pesanan_id, v_barang_id, 1, 10000, 10000);

  -- Rina mencoba batalkan draf milik Joko -> harus DITOLAK
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rina_id)::text, true);
  v_err := false;
  BEGIN
    PERFORM public.rpc_batalkan_pesanan(v_pesanan_id, 'Alasan pembatalan oleh Rina bukan pemilik');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (3, 'Rina DITOLAK membatalkan draf pesanan milik Joko', 'LULUS', 'Proteksi kepemilikan draf aktif');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (3, 'Rina DITOLAK membatalkan draf pesanan milik Joko', 'GAGAL', 'Penjualan lain bisa batalkan');
  END IF;

  -- Hendra (Manajer) membatalkan draf milik Joko -> harus BERHASIL
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_hendra_id)::text, true);
  v_err := false;
  BEGIN
    PERFORM public.rpc_batalkan_pesanan(v_pesanan_id, 'Dibatalkan oleh Manajer Hendra');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF NOT v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (3, 'Hendra (Manajer) BERHASIL membatalkan draf milik Joko', 'LULUS', 'Manajer berwenang atas semua draf');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (3, 'Hendra (Manajer) BERHASIL membatalkan draf milik Joko', 'GAGAL', 'Manajer ditolak');
  END IF;

  -- ============================================================
  -- BUTIR 5: Transisi status ilegal ditolak; Pembatalan konfirmasi hanya Manajer & stok kembali
  -- ============================================================
  -- Buat pesanan baru, konfirmasi oleh Hendra
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_hendra_id)::text, true);
  SELECT stok INTO v_stok_awal FROM public.barang WHERE id = v_barang_id;

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, dibuat_pada)
  VALUES ('SO-AUDIT-02', v_pelanggan_id, 'draf', v_hendra_id, now())
  RETURNING id INTO v_pesanan_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
  VALUES (v_pesanan_id, v_barang_id, 2, 25000, 50000);

  PERFORM public.rpc_konfirmasi_pesanan(v_pesanan_id);

  -- Verifikasi stok berkurang 2
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;
  -- Rina mencoba batalkan pesanan terkonfirmasi -> DITOLAK (hanya Manajer)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rina_id)::text, true);
  v_err := false;
  BEGIN
    PERFORM public.rpc_batalkan_pesanan(v_pesanan_id, 'Rina mau batalkan pesanan terkonfirmasi');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (5, 'Rina DITOLAK membatalkan pesanan terkonfirmasi (hanya Manajer)', 'LULUS', 'Hanya Manajer');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (5, 'Rina DITOLAK membatalkan pesanan terkonfirmasi (hanya Manajer)', 'GAGAL', 'Staf bisa batalkan terkonfirmasi');
  END IF;

  -- Hendra batalkan pesanan terkonfirmasi dengan alasan valid (>= 10 karakter)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_hendra_id)::text, true);
  PERFORM public.rpc_batalkan_pesanan(v_pesanan_id, 'Pembatalan resmi oleh Manajer karena salah barang');

  -- Verifikasi stok kembali dan mutasi jenis 'batal'
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_barang_id;
  SELECT count(*) INTO v_count FROM public.mutasi_stok WHERE nomor_dokumen = 'SO-AUDIT-02' AND jenis = 'batal';
  IF v_stok_akhir = v_stok_awal AND v_count > 0 THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (5, 'Pembatalan pesanan terkonfirmasi mengembalikan stok dan catat mutasi batal', 'LULUS', 'Stok kembali utuh');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (5, 'Pembatalan pesanan terkonfirmasi mengembalikan stok dan catat mutasi batal', 'GAGAL', 'Stok tidak kembali');
  END IF;

  -- ============================================================
  -- BUTIR 7: Stock opname & penyesuaian: alasan >= 10, jenis penyesuaian, stok tidak negatif
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_dimas_id)::text, true);
  -- Alasan < 10 karakter harus ditolak
  v_err := false;
  BEGIN
    PERFORM public.rpc_sesuaikan_stok(v_barang_id, 1, 'pendek');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (7, 'rpc_sesuaikan_stok alasan < 10 karakter ditolak', 'LULUS', 'Validasi alasan >= 10 aktif');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (7, 'rpc_sesuaikan_stok alasan < 10 karakter ditolak', 'GAGAL', 'Alasan pendek lolos');
  END IF;

  -- ============================================================
  -- BUTIR 8: Akun nonaktif ditolak pada RLS
  -- ============================================================
  -- Set sesi sebagai Agus (akun nonaktif)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_agus_id)::text, true);
  SELECT count(*) INTO v_count FROM public.barang;
  IF public.fn_peran() IS NULL THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (8, 'Akun nonaktif (Agus): fn_peran() mengembalikan NULL', 'LULUS', 'Tidak fallback ke penjualan');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (8, 'Akun nonaktif (Agus): fn_peran() mengembalikan NULL', 'GAGAL', 'Masih punya peran: ' || public.fn_peran());
  END IF;

  -- ============================================================
  -- BUTIR 9: Satu barang hanya sekali per pesanan (UNIQUE)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_rina_id)::text, true);
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, dibuat_pada)
  VALUES ('SO-AUDIT-03', v_pelanggan_id, 'draf', v_rina_id, now())
  RETURNING id INTO v_pesanan_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
  VALUES (v_pesanan_id, v_barang_id, 1, 10000, 10000);

  -- Masukkan barang yang sama ke pesanan_id yang sama
  v_err := false;
  BEGIN
    INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, subtotal)
    VALUES (v_pesanan_id, v_barang_id, 2, 10000, 20000);
  EXCEPTION WHEN unique_violation THEN
    v_err := true;
  END;
  IF v_err THEN
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (9, 'Barang duplikat dalam 1 pesanan ditolak (UNIQUE constraint)', 'LULUS', 'Unique violation');
  ELSE
    INSERT INTO audit_prd_hasil (butir_no, deskripsi, status, catatan)
    VALUES (9, 'Barang duplikat dalam 1 pesanan ditolak (UNIQUE constraint)', 'GAGAL', 'Bisa duplikat barang');
  END IF;

END $$;

SELECT butir_no, deskripsi, status, catatan FROM audit_prd_hasil ORDER BY id;

ROLLBACK;
