-- ============================================================
-- Migrasi 7: Fungsi Bisnis Supabase (RPC)
-- Seluruh logika bisnis BR-01 s.d. BR-12
-- Bahasa: plpgsql, SECURITY DEFINER, SET search_path = public
-- ============================================================

-- ============================================================
-- A. PESANAN JUAL
-- ============================================================

-- 1. rpc_simpan_draf_pesanan
-- Membuat atau memperbarui draf pesanan beserta baris itemnya
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items        jsonb,
  p_pesanan_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran          text;
  v_pesanan_id     uuid;
  v_nomor          text;
  v_pelanggan_aktif boolean;
  v_item_count     integer;
  v_total          numeric(14,0) := 0;
  v_item           jsonb;
  v_barang_id      uuid;
  v_jumlah         integer;
  v_diskon         numeric(5,2);
  v_harga_satuan   numeric(14,0);
  v_subtotal       numeric(14,0);
  v_barang_aktif   boolean;
  v_barang_ids     uuid[] := ARRAY[]::uuid[];
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 baris (BR-02)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Validasi pelanggan aktif
  SELECT aktif INTO v_pelanggan_aktif FROM public.pelanggan WHERE id = p_pelanggan_id;
  IF v_pelanggan_aktif IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Tangani draf baru vs draf eksisting
  IF p_pesanan_id IS NOT NULL THEN
    SELECT id, nomor, dibuat_oleh, status
    INTO v_pesanan_id, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id;

    IF v_pesanan_id IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi status harus draf (BR-02, E08)
    IF (SELECT status FROM public.pesanan_jual WHERE id = p_pesanan_id) <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    -- Staf Penjualan hanya boleh mengubah draf miliknya sendiri
    IF v_peran = 'penjualan' AND (SELECT dibuat_oleh FROM public.pesanan_jual WHERE id = p_pesanan_id) <> auth.uid() THEN
      RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
    END IF;

    -- Perbarui pelanggan jika berubah
    UPDATE public.pesanan_jual SET pelanggan_id = p_pelanggan_id WHERE id = p_pesanan_id;
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN (A8)
    v_nomor := format(
      'SO-%s-%s',
      to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
      lpad(nextval('public.seq_pesanan_jual')::text, 6, '0')
    );

    INSERT INTO public.pesanan_jual (
      nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_nomor, p_pelanggan_id, 'draf', 0, auth.uid(), now()
    )
    RETURNING id INTO v_pesanan_id;
  END IF;

  -- Hapus item lama terlebih dahulu untuk penggantian bersih
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id = v_pesanan_id;

  -- Iterasi & validasi item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_barang_id := (v_item->>'barang_id')::uuid;
    v_jumlah    := COALESCE((v_item->>'jumlah')::integer, 0);
    v_diskon    := COALESCE((v_item->>'diskon_persen')::numeric, 0);

    -- BR-02: jumlah >= 1
    IF v_jumlah < 1 THEN
      RAISE EXCEPTION 'Jumlah minimal 1' USING ERRCODE = 'E0004';
    END IF;

    -- BR-02: barang unik per pesanan
    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'Barang sudah ada di pesanan ini' USING ERRCODE = 'E0005';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    -- Cek keberadaan & keaktifan barang
    SELECT harga_jual, aktif INTO v_harga_satuan, v_barang_aktif
    FROM public.barang WHERE id = v_barang_id;

    IF v_harga_satuan IS NULL OR v_barang_aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- BR-03: Batas diskon per peran
    IF v_peran = 'penjualan' THEN
      IF v_diskon < 0 OR v_diskon > 10 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
      END IF;
    ELSE -- manajer
      IF v_diskon < 0 OR v_diskon > 25 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
      END IF;
    END IF;

    -- BR-03: Subtotal = ROUND(jumlah * harga_satuan * (100 - diskon) / 100)
    v_subtotal := round((v_jumlah::numeric * v_harga_satuan * (100 - v_diskon) / 100.0), 0);
    v_total := v_total + v_subtotal;

    INSERT INTO public.item_pesanan_jual (
      pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
    )
    VALUES (
      v_pesanan_id, v_barang_id, v_jumlah, v_harga_satuan, v_diskon, v_subtotal
    );
  END LOOP;

  -- Perbarui total pesanan
  UPDATE public.pesanan_jual
  SET total = v_total
  WHERE id = v_pesanan_id;

  RETURN jsonb_build_object(
    'id', v_pesanan_id,
    'nomor', v_nomor,
    'total', v_total
  );
END;
$$;

-- Alias untuk kemudahan pemanggilan
CREATE OR REPLACE FUNCTION public.rpc_buat_pesanan(p_pelanggan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nomor text;
  v_id    uuid;
  v_aktif boolean;
BEGIN
  IF public.fn_peran() NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT aktif INTO v_aktif FROM public.pelanggan WHERE id = p_pelanggan_id;
  IF v_aktif IS NULL OR v_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  v_nomor := format(
    'SO-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_pesanan_jual')::text, 6, '0')
  );

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada)
  VALUES (v_nomor, p_pelanggan_id, 'draf', 0, auth.uid(), now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'nomor', v_nomor, 'total', 0);
END;
$$;

-- Alias simpan_item_pesanan (menambah/memperbarui satu item dalam draf)
CREATE OR REPLACE FUNCTION public.rpc_simpan_item_pesanan(
  p_pesanan_id  uuid,
  p_barang_id   uuid,
  p_jumlah      integer,
  p_diskon      numeric(5,2) DEFAULT 0,
  p_harga_satuan numeric DEFAULT NULL -- parameter diabaikan per BR-03 / TC-12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_status       text;
  v_pemilik      uuid;
  v_harga_satuan numeric(14,0);
  v_barang_aktif boolean;
  v_subtotal     numeric(14,0);
  v_total        numeric(14,0);
  v_item_count   integer;
  v_exists       boolean;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT status, dibuat_oleh INTO v_status, v_pemilik
  FROM public.pesanan_jual WHERE id = p_pesanan_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_status <> 'draf' THEN
    RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
  END IF;

  IF v_peran = 'penjualan' AND v_pemilik <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_jumlah < 1 THEN
    RAISE EXCEPTION 'Jumlah minimal 1' USING ERRCODE = 'E0004';
  END IF;

  SELECT harga_jual, aktif INTO v_harga_satuan, v_barang_aktif
  FROM public.barang WHERE id = p_barang_id;

  IF v_harga_satuan IS NULL OR v_barang_aktif = false THEN
    RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
  END IF;

  IF v_peran = 'penjualan' THEN
    IF p_diskon < 0 OR p_diskon > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;
  ELSE
    IF p_diskon < 0 OR p_diskon > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.item_pesanan_jual WHERE pesanan_jual_id = p_pesanan_id AND barang_id = p_barang_id)
  INTO v_exists;

  IF NOT v_exists THEN
    SELECT count(*) INTO v_item_count FROM public.item_pesanan_jual WHERE pesanan_jual_id = p_pesanan_id;
    IF v_item_count >= 20 THEN
      RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
    END IF;
  ELSE
    RAISE EXCEPTION 'Barang sudah ada di pesanan ini' USING ERRCODE = 'E0005';
  END IF;

  v_subtotal := round((p_jumlah::numeric * v_harga_satuan * (100 - p_diskon) / 100.0), 0);

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (p_pesanan_id, p_barang_id, p_jumlah, v_harga_satuan, p_diskon, v_subtotal);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_total FROM public.item_pesanan_jual WHERE pesanan_jual_id = p_pesanan_id;
  UPDATE public.pesanan_jual SET total = v_total WHERE id = p_pesanan_id;

  RETURN jsonb_build_object('subtotal', v_subtotal, 'total', v_total);
END;
$$;

-- 2. rpc_batalkan_draf (Penjualan miliknya sendiri / Manajer)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_draf(p_pesanan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran  text;
  v_status text;
  v_pemilik uuid;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT status, dibuat_oleh INTO v_status, v_pemilik
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pemilik <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.pesanan_jual
  SET status = 'dibatalkan',
      dibatalkan_pada = now()
  WHERE id = p_pesanan_id;
END;
$$;

-- 3. rpc_konfirmasi_pesanan (Fungsi paling kritis)
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran            text;
  v_pesanan          record;
  v_pelanggan        record;
  v_item_count       integer;
  v_item             record;
  v_barang           record;
  v_piutang_berjalan numeric(14,0);
  v_stok_sesudah     integer;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- 3a. Validasi hak akses & status pesanan
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pesanan.dibuat_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- Validasi jumlah baris 1 s.d. 20 (BR-02, E03)
  SELECT count(*) INTO v_item_count
  FROM public.item_pesanan_jual
  WHERE pesanan_jual_id = p_pesanan_id;

  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- 3b. Kunci baris pelanggan (FOR UPDATE)
  SELECT * INTO v_pelanggan
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id
  FOR UPDATE;

  IF v_pelanggan.id IS NULL OR v_pelanggan.aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- 3c. Kunci baris barang secara konsisten urut ID untuk hindari deadlock (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Validasi keaktifan setiap barang & diskon pengonfirmasi
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok, b.aktif
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- Validasi diskon Staf Penjualan (B7)
    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    -- 3e. BR-04: Harga di bawah HPP (NULL dianggap 0 per A5)
    IF v_peran = 'penjualan' THEN
      IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
        RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
      END IF;
    END IF;
  END LOOP;

  -- 3f. BR-05: Tagihan lewat tempo & Batas kredit
  IF EXISTS (
    SELECT 1
    FROM public.pesanan_jual
    WHERE pelanggan_id = v_pesanan.pelanggan_id
      AND status = 'dikirim'
      AND jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
  ) THEN
    RAISE EXCEPTION 'Pelanggan memiliki tagihan lewat jatuh tempo' USING ERRCODE = 'E0013';
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_piutang_berjalan
  FROM public.pesanan_jual
  WHERE pelanggan_id = v_pesanan.pelanggan_id
    AND status IN ('dikonfirmasi', 'dikirim');

  IF (v_piutang_berjalan + v_pesanan.total) > v_pelanggan.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui' USING ERRCODE = 'E0012';
  END IF;

  -- 3d. Cek kecukupan stok per baris
  FOR v_item IN
    SELECT ip.*, b.kode, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok tidak cukup untuk barang %', v_item.kode USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- 3g. Eksekusi pengurangan stok, mutasi kartu stok, dan snapshot HPP
  PERFORM set_config('app.mutasi_stok', '1', true);

  FOR v_item IN
    SELECT ip.*, b.kode, b.harga_pokok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    -- Kurangi stok master
    UPDATE public.barang
    SET stok = stok - v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    -- Tulis kartu stok (delta bertanda negatif, B14)
    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id, 'keluar', -v_item.jumlah, v_stok_sesudah, v_pesanan.nomor,
      'Konfirmasi pesanan jual ' || v_pesanan.nomor, auth.uid(), now()
    );

    -- Snapshot HPP satuan (A7)
    UPDATE public.item_pesanan_jual
    SET hpp_satuan = COALESCE(v_item.harga_pokok, 0)
    WHERE id = v_item.id;
  END LOOP;

  -- Perbarui status pesanan menjadi dikonfirmasi
  UPDATE public.pesanan_jual
  SET status = 'dikonfirmasi',
      dikonfirmasi_pada = now()
  WHERE id = p_pesanan_id;

  -- Catat audit log konfirmasi pesanan
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'konfirmasi_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'dikonfirmasi', 'total', v_pesanan.total)
  );

  RETURN jsonb_build_object(
    'id', p_pesanan_id,
    'nomor', v_pesanan.nomor,
    'status', 'dikonfirmasi'
  );
END;
$$;

-- 4. rpc_kirim_pesanan (Gudang / Manajer)
CREATE OR REPLACE FUNCTION public.rpc_kirim_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_pesanan      record;
  v_termin       integer;
  v_dikirim_pada timestamptz;
  v_jatuh_tempo  date;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'dikonfirmasi' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  SELECT termin_hari INTO v_termin
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id;

  v_dikirim_pada := now();
  v_jatuh_tempo  := ((v_dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date + COALESCE(v_termin, 0));

  UPDATE public.pesanan_jual
  SET status = 'dikirim',
      dikirim_pada = v_dikirim_pada,
      jatuh_tempo = v_jatuh_tempo
  WHERE id = p_pesanan_id;

  RETURN jsonb_build_object(
    'id', p_pesanan_id,
    'status', 'dikirim',
    'dikirim_pada', v_dikirim_pada,
    'jatuh_tempo', v_jatuh_tempo
  );
END;
$$;

-- 5. rpc_catat_pelunasan (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_catat_pelunasan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pesanan record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'dikirim' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = now()
  WHERE id = p_pesanan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'lunasi_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object('status', 'lunas')
  );

  RETURN jsonb_build_object('id', p_pesanan_id, 'status', 'lunas');
END;
$$;

-- Alias rpc_lunasi_pesanan
CREATE OR REPLACE FUNCTION public.rpc_lunasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_catat_pelunasan(p_pesanan_id);
$$;

-- 6. rpc_batalkan_pesanan_terkonfirmasi (Manajer, alasan >= 10 karakter)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_pesanan_terkonfirmasi(
  p_pesanan_id uuid,
  p_alasan     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pesanan      record;
  v_item         record;
  v_stok_sesudah integer;
  v_alasan_clean text;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_alasan_clean := btrim(COALESCE(p_alasan, ''));
  IF length(v_alasan_clean) < 10 THEN
    RAISE EXCEPTION 'Alasan minimal 10 karakter' USING ERRCODE = 'E0016';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  -- Hanya status dikonfirmasi yang bisa dibatalkan (dikirim/lunas ditolak per TC-22)
  IF v_pesanan.status <> 'dikonfirmasi' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- Kunci barang urut id
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id FROM public.item_pesanan_jual ip WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Kembalikan stok dan catat mutasi 'batal'
  PERFORM set_config('app.mutasi_stok', '1', true);

  FOR v_item IN
    SELECT ip.*
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY ip.barang_id
  LOOP
    UPDATE public.barang
    SET stok = stok + v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id, 'batal', v_item.jumlah, v_stok_sesudah, v_pesanan.nomor,
      v_alasan_clean, auth.uid(), now()
    );
  END LOOP;

  UPDATE public.pesanan_jual
  SET status = 'dibatalkan',
      dibatalkan_pada = now(),
      alasan_batal = v_alasan_clean
  WHERE id = p_pesanan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'batalkan_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'dikonfirmasi'),
    jsonb_build_object('status', 'dibatalkan', 'alasan', v_alasan_clean)
  );

  RETURN jsonb_build_object('id', p_pesanan_id, 'status', 'dibatalkan');
END;
$$;

-- Alias rpc_batalkan_pesanan (menangani draf atau terkonfirmasi sesuai status)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_pesanan(
  p_pesanan_id uuid,
  p_alasan     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.pesanan_jual WHERE id = p_pesanan_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_status = 'draf' THEN
    PERFORM public.rpc_batalkan_draf(p_pesanan_id);
    RETURN jsonb_build_object('id', p_pesanan_id, 'status', 'dibatalkan');
  ELSE
    RETURN public.rpc_batalkan_pesanan_terkonfirmasi(p_pesanan_id, p_alasan);
  END IF;
END;
$$;


-- ============================================================
-- B. PEMBELIAN (PO) & STOK
-- ============================================================

-- 7. rpc_ajukan_pembelian (Gudang / Manajer)
CREATE OR REPLACE FUNCTION public.rpc_ajukan_pembelian(
  p_pemasok_id uuid,
  p_barang_id  uuid,
  p_jumlah     integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_nomor        text;
  v_id           uuid;
  v_pemasok_aktif boolean;
  v_barang_aktif  boolean;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- BR-09: Jumlah 1 s.d. 10.000
  IF p_jumlah < 1 OR p_jumlah > 10000 THEN
    RAISE EXCEPTION 'Jumlah pembelian harus 1 sampai 10.000' USING ERRCODE = 'E0017';
  END IF;

  SELECT aktif INTO v_pemasok_aktif FROM public.pemasok WHERE id = p_pemasok_id;
  IF v_pemasok_aktif IS NULL OR v_pemasok_aktif = false THEN
    RAISE EXCEPTION 'Pemasok tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  SELECT aktif INTO v_barang_aktif FROM public.barang WHERE id = p_barang_id;
  IF v_barang_aktif IS NULL OR v_barang_aktif = false THEN
    RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
  END IF;

  v_nomor := format(
    'PO-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_pembelian')::text, 6, '0')
  );

  INSERT INTO public.pembelian (
    nomor, pemasok_id, barang_id, jumlah_dipesan, status,
    diajukan_oleh, diajukan_pada
  )
  VALUES (
    v_nomor, p_pemasok_id, p_barang_id, p_jumlah, 'diajukan',
    auth.uid(), now()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'nomor', v_nomor, 'status', 'diajukan');
END;
$$;

-- 8. rpc_setujui_pembelian (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_setujui_pembelian(
  p_pembelian_id      uuid,
  p_harga_beli_satuan numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_harga_beli_satuan IS NULL OR p_harga_beli_satuan <= 0 THEN
    RAISE EXCEPTION 'Harga beli harus lebih dari 0' USING ERRCODE = 'E0018';
  END IF;

  SELECT * INTO v_po FROM public.pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_po.status <> 'diajukan' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.pembelian
  SET status = 'disetujui',
      harga_beli_satuan = p_harga_beli_satuan,
      diputuskan_oleh = auth.uid(),
      diputuskan_pada = now()
  WHERE id = p_pembelian_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'setujui_pembelian',
    'pembelian',
    p_pembelian_id,
    jsonb_build_object('status', 'diajukan'),
    jsonb_build_object('status', 'disetujui', 'harga_beli_satuan', p_harga_beli_satuan)
  );

  RETURN jsonb_build_object('id', p_pembelian_id, 'status', 'disetujui');
END;
$$;

-- 9. rpc_tolak_pembelian (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_tolak_pembelian(
  p_pembelian_id uuid,
  p_alasan       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po           record;
  v_alasan_clean text;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_alasan_clean := btrim(COALESCE(p_alasan, ''));
  IF length(v_alasan_clean) < 10 THEN
    RAISE EXCEPTION 'Alasan minimal 10 karakter' USING ERRCODE = 'E0016';
  END IF;

  SELECT * INTO v_po FROM public.pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_po.status <> 'diajukan' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.pembelian
  SET status = 'ditolak',
      alasan_tolak = v_alasan_clean,
      diputuskan_oleh = auth.uid(),
      diputuskan_pada = now()
  WHERE id = p_pembelian_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'tolak_pembelian',
    'pembelian',
    p_pembelian_id,
    jsonb_build_object('status', 'diajukan'),
    jsonb_build_object('status', 'ditolak', 'alasan', v_alasan_clean)
  );

  RETURN jsonb_build_object('id', p_pembelian_id, 'status', 'ditolak');
END;
$$;

-- Alias rpc_putuskan_pembelian
CREATE OR REPLACE FUNCTION public.rpc_putuskan_pembelian(
  p_pembelian_id uuid,
  p_tindakan     text, -- 'setujui' | 'tolak'
  p_nilai        text  -- harga_beli (jika setujui) atau alasan (jika tolak)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tindakan = 'setujui' THEN
    RETURN public.rpc_setujui_pembelian(p_pembelian_id, p_nilai::numeric);
  ELSIF p_tindakan = 'tolak' THEN
    RETURN public.rpc_tolak_pembelian(p_pembelian_id, p_nilai);
  ELSE
    RAISE EXCEPTION 'Tindakan tidak dikenal' USING ERRCODE = 'E0015';
  END IF;
END;
$$;

-- 10. rpc_terima_pembelian (Gudang / Manajer)
CREATE OR REPLACE FUNCTION public.rpc_terima_pembelian(
  p_pembelian_id   uuid,
  p_jumlah_diterima integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_po           record;
  v_stok_sesudah integer;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_po FROM public.pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_po.status <> 'disetujui' THEN
    RAISE EXCEPTION 'Pembelian tidak dalam status disetujui' USING ERRCODE = 'E0019';
  END IF;

  IF p_jumlah_diterima < 1 OR p_jumlah_diterima > v_po.jumlah_dipesan THEN
    RAISE EXCEPTION 'Jumlah diterima harus 1 sampai jumlah dipesan' USING ERRCODE = 'E0020';
  END IF;

  -- Kunci master barang
  PERFORM id FROM public.barang WHERE id = v_po.barang_id FOR UPDATE;

  PERFORM set_config('app.mutasi_stok', '1', true);
  PERFORM set_config('app.terima_pembelian', '1', true);

  -- Tambah stok dan perbarui harga_pokok master barang
  UPDATE public.barang
  SET stok = stok + p_jumlah_diterima,
      harga_pokok = v_po.harga_beli_satuan,
      diperbarui_pada = now()
  WHERE id = v_po.barang_id
  RETURNING stok INTO v_stok_sesudah;

  -- Tulis kartu stok (jenis masuk)
  INSERT INTO public.mutasi_stok (
    barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
  )
  VALUES (
    v_po.barang_id, 'masuk', p_jumlah_diterima, v_stok_sesudah, v_po.nomor,
    'Penerimaan PO ' || v_po.nomor, auth.uid(), now()
  );

  UPDATE public.pembelian
  SET status = 'diterima',
      jumlah_diterima = p_jumlah_diterima,
      diterima_oleh = auth.uid(),
      diterima_pada = now()
  WHERE id = p_pembelian_id;

  RETURN jsonb_build_object(
    'id', p_pembelian_id,
    'status', 'diterima',
    'jumlah_diterima', p_jumlah_diterima,
    'stok_sesudah', v_stok_sesudah
  );
END;
$$;

-- 11. rpc_penyesuaian_stok (Gudang / Manajer)
CREATE OR REPLACE FUNCTION public.rpc_penyesuaian_stok(
  p_barang_id uuid,
  p_stok_baru integer,
  p_alasan    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_barang       record;
  v_delta        integer;
  v_nomor_adj    text;
  v_alasan_clean text;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_stok_baru < 0 THEN
    RAISE EXCEPTION 'Stok hasil penyesuaian tidak boleh negatif' USING ERRCODE = 'E0021';
  END IF;

  v_alasan_clean := btrim(COALESCE(p_alasan, ''));
  IF length(v_alasan_clean) < 10 THEN
    RAISE EXCEPTION 'Alasan minimal 10 karakter' USING ERRCODE = 'E0016';
  END IF;

  SELECT * INTO v_barang FROM public.barang WHERE id = p_barang_id FOR UPDATE;
  IF v_barang.id IS NULL THEN
    RAISE EXCEPTION 'Barang tidak ditemukan' USING ERRCODE = 'E0006';
  END IF;

  v_delta := p_stok_baru - v_barang.stok;

  v_nomor_adj := format(
    'ADJ-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_penyesuaian')::text, 6, '0')
  );

  PERFORM set_config('app.mutasi_stok', '1', true);

  UPDATE public.barang
  SET stok = p_stok_baru,
      diperbarui_pada = now()
  WHERE id = p_barang_id;

  INSERT INTO public.mutasi_stok (
    barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
  )
  VALUES (
    p_barang_id, 'penyesuaian', v_delta, p_stok_baru, v_nomor_adj,
    v_alasan_clean, auth.uid(), now()
  );

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'sesuaikan_stok',
    'barang',
    p_barang_id,
    jsonb_build_object('stok', v_barang.stok),
    jsonb_build_object('stok', p_stok_baru, 'delta', v_delta, 'alasan', v_alasan_clean)
  );

  RETURN jsonb_build_object(
    'barang_id', p_barang_id,
    'stok_lama', v_barang.stok,
    'stok_baru', p_stok_baru,
    'delta', v_delta,
    'nomor_dokumen', v_nomor_adj
  );
END;
$$;

-- Alias rpc_sesuaikan_stok
CREATE OR REPLACE FUNCTION public.rpc_sesuaikan_stok(
  p_barang_id uuid,
  p_stok_baru integer,
  p_alasan    text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_penyesuaian_stok(p_barang_id, p_stok_baru, p_alasan);
$$;


-- ============================================================
-- C. ADMINISTRASI
-- ============================================================

-- 12a. rpc_set_batas_kredit (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_set_batas_kredit(
  p_pelanggan_id uuid,
  p_batas        numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_batas IS NULL OR p_batas < 0 THEN
    RAISE EXCEPTION 'Batas kredit harus >= 0' USING ERRCODE = 'E0024';
  END IF;

  UPDATE public.pelanggan
  SET batas_kredit = p_batas
  WHERE id = p_pelanggan_id;

  RETURN jsonb_build_object('id', p_pelanggan_id, 'batas_kredit', p_batas);
END;
$$;

-- Alias rpc_ubah_batas_kredit
CREATE OR REPLACE FUNCTION public.rpc_ubah_batas_kredit(p_pelanggan_id uuid, p_batas numeric)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_set_batas_kredit(p_pelanggan_id, p_batas);
$$;

-- 12b. rpc_set_termin (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_set_termin(
  p_pelanggan_id uuid,
  p_termin       integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_termin NOT IN (0, 7, 14, 30) THEN
    RAISE EXCEPTION 'Hanya Manajer yang dapat mengubah batas kredit atau termin bayar' USING ERRCODE = 'E0024';
  END IF;

  UPDATE public.pelanggan
  SET termin_hari = p_termin
  WHERE id = p_pelanggan_id;

  RETURN jsonb_build_object('id', p_pelanggan_id, 'termin_hari', p_termin);
END;
$$;

-- 12c. rpc_set_peran (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_set_peran(
  p_profile_id uuid,
  p_peran      text,
  p_aktif      boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lama record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_peran NOT IN ('penjualan', 'gudang', 'manajer') THEN
    RAISE EXCEPTION 'Peran tidak valid' USING ERRCODE = 'E0025';
  END IF;

  SELECT * INTO v_lama FROM public.profiles WHERE id = p_profile_id;
  IF v_lama.id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  -- B20: Minimal harus ada 1 manajer aktif tersisa
  IF v_lama.peran = 'manajer' AND v_lama.aktif = true AND (p_peran <> 'manajer' OR p_aktif = false) THEN
    IF (SELECT count(*) FROM public.profiles WHERE peran = 'manajer' AND aktif = true AND id <> p_profile_id) = 0 THEN
      RAISE EXCEPTION 'Minimal harus ada satu Manajer aktif' USING ERRCODE = 'E0026';
    END IF;
  END IF;

  UPDATE public.profiles
  SET peran = p_peran,
      aktif = p_aktif
  WHERE id = p_profile_id;

  RETURN jsonb_build_object('id', p_profile_id, 'peran', p_peran, 'aktif', p_aktif);
END;
$$;

-- Alias rpc_ubah_peran
CREATE OR REPLACE FUNCTION public.rpc_ubah_peran(p_profile_id uuid, p_peran text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_set_peran(p_profile_id, p_peran, true);
$$;

-- 12d. rpc_set_harga_pokok (Manajer, B31)
CREATE OR REPLACE FUNCTION public.rpc_set_harga_pokok(
  p_barang_id uuid,
  p_nilai     numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lama numeric(14,0);
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_nilai IS NOT NULL AND p_nilai < 0 THEN
    RAISE EXCEPTION 'Harga pokok harus >= 0' USING ERRCODE = 'E0028';
  END IF;

  SELECT harga_pokok INTO v_lama FROM public.barang WHERE id = p_barang_id;

  UPDATE public.barang
  SET harga_pokok = p_nilai,
      diperbarui_pada = now()
  WHERE id = p_barang_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'ubah_harga_pokok',
    'barang',
    p_barang_id,
    jsonb_build_object('harga_pokok', v_lama),
    jsonb_build_object('harga_pokok', p_nilai)
  );

  RETURN jsonb_build_object('id', p_barang_id, 'harga_pokok', p_nilai);
END;
$$;

-- Alias rpc_ubah_harga_pokok
CREATE OR REPLACE FUNCTION public.rpc_ubah_harga_pokok(p_barang_id uuid, p_nilai numeric)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_set_harga_pokok(p_barang_id, p_nilai);
$$;

-- 12e. rpc_set_harga_jual (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_set_harga_jual(
  p_barang_id uuid,
  p_nilai     numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_nilai IS NULL OR p_nilai <= 0 THEN
    RAISE EXCEPTION 'Harga jual harus lebih dari 0' USING ERRCODE = 'E0028';
  END IF;

  UPDATE public.barang
  SET harga_jual = p_nilai,
      diperbarui_pada = now()
  WHERE id = p_barang_id;

  RETURN jsonb_build_object('id', p_barang_id, 'harga_jual', p_nilai);
END;
$$;

-- Alias rpc_ubah_harga_jual
CREATE OR REPLACE FUNCTION public.rpc_ubah_harga_jual(p_barang_id uuid, p_nilai numeric)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.rpc_set_harga_jual(p_barang_id, p_nilai);
$$;

-- 12f. rpc_buat_barang (Manajer)
CREATE OR REPLACE FUNCTION public.rpc_buat_barang(
  p_kode         text,
  p_nama         text,
  p_satuan       text,
  p_harga_jual   numeric,
  p_stok_minimum integer DEFAULT 0,
  p_harga_pokok  numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kode_clean text;
  v_id         uuid;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_kode_clean := upper(btrim(COALESCE(p_kode, '')));

  IF EXISTS (SELECT 1 FROM public.barang WHERE kode = v_kode_clean) THEN
    RAISE EXCEPTION 'Kode barang sudah digunakan' USING ERRCODE = 'E0027';
  END IF;

  IF p_harga_jual IS NULL OR p_harga_jual <= 0 THEN
    RAISE EXCEPTION 'Harga jual harus lebih dari 0' USING ERRCODE = 'E0028';
  END IF;

  IF p_stok_minimum IS NULL OR p_stok_minimum < 0 THEN
    RAISE EXCEPTION 'Stok minimum harus bilangan bulat >= 0' USING ERRCODE = 'E0029';
  END IF;

  INSERT INTO public.barang (
    kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif
  )
  VALUES (
    v_kode_clean, btrim(p_nama), btrim(p_satuan), p_harga_jual, p_harga_pokok, 0, p_stok_minimum, true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'kode', v_kode_clean,
    'nama', btrim(p_nama),
    'harga_jual', p_harga_jual,
    'stok', 0,
    'stok_minimum', p_stok_minimum
  );
END;
$$;

-- 12g. rpc_buat_pelanggan (Penjualan / Manajer, batas_kredit awal 0)
CREATE OR REPLACE FUNCTION public.rpc_buat_pelanggan(
  p_kode        text,
  p_nama_toko   text,
  p_telepon     text DEFAULT NULL,
  p_alamat      text DEFAULT NULL,
  p_termin_hari integer DEFAULT 0,
  p_batas_kredit numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran        text;
  v_kode_clean   text;
  v_batas_kredit numeric(14,0);
  v_id           uuid;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_kode_clean := upper(btrim(COALESCE(p_kode, '')));

  IF p_termin_hari NOT IN (0, 7, 14, 30) THEN
    RAISE EXCEPTION 'Termin hari harus 0, 7, 14, atau 30' USING ERRCODE = 'E0024';
  END IF;

  -- Non-manajer dipaksa batas_kredit = 0 (A10, TC-18)
  IF v_peran <> 'manajer' THEN
    v_batas_kredit := 0;
  ELSE
    v_batas_kredit := COALESCE(p_batas_kredit, 0);
  END IF;

  INSERT INTO public.pelanggan (
    kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh
  )
  VALUES (
    v_kode_clean, btrim(p_nama_toko), p_telepon, p_alamat, v_batas_kredit, p_termin_hari, true, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'kode', v_kode_clean,
    'nama_toko', btrim(p_nama_toko),
    'batas_kredit', v_batas_kredit,
    'termin_hari', p_termin_hari
  );
END;
$$;


-- ============================================================
-- D. LAPORAN (Khusus Manajer)
-- ============================================================

-- 13a. rpc_laporan_margin_mingguan (A12, B27)
CREATE OR REPLACE FUNCTION public.rpc_laporan_margin_mingguan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  minggu        date,
  omzet         numeric,
  hpp           numeric,
  margin        numeric,
  margin_persen numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  RETURN QUERY
  WITH deret_minggu AS (
    SELECT date_trunc('week', d)::date AS awal_minggu
    FROM generate_series(
      date_trunc('week', v_dari),
      date_trunc('week', v_sampai),
      interval '1 week'
    ) d
  ),
  data_transaksi AS (
    SELECT
      date_trunc('week', pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS awal_minggu,
      SUM(pj.total) AS total_omzet,
      SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS total_hpp
    FROM public.pesanan_jual pj
    JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
    GROUP BY date_trunc('week', pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date
  )
  SELECT
    dm.awal_minggu AS minggu,
    COALESCE(dt.total_omzet, 0) AS omzet,
    COALESCE(dt.total_hpp, 0) AS hpp,
    (COALESCE(dt.total_omzet, 0) - COALESCE(dt.total_hpp, 0)) AS margin,
    CASE
      WHEN COALESCE(dt.total_omzet, 0) > 0 THEN
        round(((COALESCE(dt.total_omzet, 0) - COALESCE(dt.total_hpp, 0)) / dt.total_omzet * 100.0), 2)
      ELSE 0
    END AS margin_persen
  FROM deret_minggu dm
  LEFT JOIN data_transaksi dt ON dt.awal_minggu = dm.awal_minggu
  ORDER BY dm.awal_minggu ASC;
END;
$$;

-- Alias rpc_laporan_mingguan
CREATE OR REPLACE FUNCTION public.rpc_laporan_mingguan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  minggu        date,
  omzet         numeric,
  hpp           numeric,
  margin        numeric,
  margin_persen numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.rpc_laporan_margin_mingguan(p_dari, p_sampai);
$$;

-- 13b. rpc_laporan_piutang
CREATE OR REPLACE FUNCTION public.rpc_laporan_piutang()
RETURNS TABLE (
  pelanggan_id              uuid,
  kode                      text,
  nama_toko                 text,
  batas_kredit              numeric,
  termin_hari               integer,
  total_piutang             numeric,
  piutang_belum_jatuh_tempo numeric,
  piutang_lewat_jatuh_tempo numeric,
  ada_lewat_jatuh_tempo     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hari_ini date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.batas_kredit,
    p.termin_hari,
    COALESCE(SUM(pj.total), 0) AS total_piutang,
    COALESCE(SUM(CASE WHEN pj.status = 'dikonfirmasi' OR pj.jatuh_tempo >= v_hari_ini THEN pj.total ELSE 0 END), 0) AS piutang_belum_jatuh_tempo,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini THEN pj.total ELSE 0 END), 0) AS piutang_lewat_jatuh_tempo,
    EXISTS (
      SELECT 1 FROM public.pesanan_jual pj2
      WHERE pj2.pelanggan_id = p.id
        AND pj2.status = 'dikirim'
        AND pj2.jatuh_tempo < v_hari_ini
    ) AS ada_lewat_jatuh_tempo
  FROM public.pelanggan p
  LEFT JOIN public.pesanan_jual pj ON pj.pelanggan_id = p.id AND pj.status IN ('dikonfirmasi', 'dikirim')
  GROUP BY p.id, p.kode, p.nama_toko, p.batas_kredit, p.termin_hari
  ORDER BY total_piutang DESC, p.nama_toko ASC;
END;
$$;


-- ============================================================
-- E. HAK AKSES EKSEKUSI RPC
-- ============================================================
-- Cabut dari PUBLIC dan anon; hanya izinkan authenticated
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_peran() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peran_saya() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_manajer() TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buat_pesanan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_simpan_item_pesanan(uuid, uuid, integer, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_draf(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kirim_pesanan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_catat_pelunasan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lunasi_pesanan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_pesanan_terkonfirmasi(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_pesanan(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_ajukan_pembelian(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_setujui_pembelian(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_tolak_pembelian(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_putuskan_pembelian(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_terima_pembelian(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_penyesuaian_stok(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sesuaikan_stok(uuid, integer, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_set_batas_kredit(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_batas_kredit(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_termin(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_peran(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_peran(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_harga_pokok(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_harga_pokok(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_harga_jual(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_harga_jual(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buat_barang(text, text, text, numeric, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_buat_pelanggan(text, text, text, text, integer, numeric) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_laporan_margin_mingguan(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_mingguan(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_piutang() TO authenticated;
