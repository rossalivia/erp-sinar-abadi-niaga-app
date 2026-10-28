-- ============================================================
-- MIGRASI: Izinkan Simpan Draf Diskon > 10% untuk Pengajuan Persetujuan Manajer
-- Berkas: supabase/migrations/20261028091000_izinkan_draf_diskon_pengajuan.sql
-- Sesuai:
-- 1. rpc_simpan_draf_pesanan mengizinkan Staf Penjualan menyimpan draf dengan
--    diskon hingga 25% (batas mutlak sistem) khusus untuk pengajuan persetujuan ke Manajer.
-- 2. rpc_ajukan_persetujuan_harga mengizinkan pengajuan jika ada item di bawah HPP ATAU diskon > 10%.
-- 3. rpc_konfirmasi_pesanan tetap menolak keras konfirmasi langsung oleh Staf Penjualan
--    bila terdapat diskon > 10% (E0009) atau harga di bawah HPP (E0011).
-- ============================================================

-- 1. PEMBARUAN: rpc_simpan_draf_pesanan
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items jsonb,
  p_pesanan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran         text;
  v_pesanan_id    uuid;
  v_nomor         text;
  v_item_count    integer;
  v_item          jsonb;
  v_barang_id     uuid;
  v_barang_ids    uuid[] := '{}';
  v_jumlah        integer;
  v_diskon        numeric;
  v_harga_satuan  numeric;
  v_barang_aktif  boolean;
  v_subtotal      numeric;
  v_total         numeric := 0;
  v_pelanggan_ada boolean;
  v_pelanggan_aktif boolean;
  v_pesanan_status text;
  v_pesanan_pembuat uuid;
BEGIN
  -- Periksa peran pemanggil: hanya staf penjualan dan manajer
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi pelanggan ada & aktif (BR-01, E07)
  SELECT true, aktif INTO v_pelanggan_ada, v_pelanggan_aktif
  FROM public.pelanggan WHERE id = p_pelanggan_id;

  IF v_pelanggan_ada IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 (BR-02, E03)
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Update draf eksisting vs Insert draf baru
  IF p_pesanan_id IS NOT NULL THEN
    SELECT status, dibuat_oleh, nomor INTO v_pesanan_status, v_pesanan_pembuat, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

    IF v_pesanan_status IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi wewenang edit
    IF v_peran = 'penjualan' AND v_pesanan_pembuat <> auth.uid() THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    IF v_pesanan_status <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    v_pesanan_id := p_pesanan_id;

    UPDATE public.pesanan_jual
    SET pelanggan_id = p_pelanggan_id
    WHERE id = v_pesanan_id;

    -- Jika draf diubah, batalkan pengajuan persetujuan harga yang sedang aktif
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = v_pesanan_id
      AND status IN ('menunggu', 'disetujui');
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN
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

    -- Batas diskon mutlak saat simpan draf adalah 0% sampai 25% untuk semua peran.
    -- Staf Penjualan diizinkan menyimpan draf diskon > 10% khusus agar dapat diajukan ke Manajer.
    -- Konfirmasi langsung oleh Staf Penjualan tetap ditolak keras jika ada baris diskon > 10%.
    IF v_diskon < 0 OR v_diskon > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;

    -- BR-03: Subtotal = ROUND(jumlah * harga_satuan * (100 - diskon) / 100)
    v_subtotal := round(v_jumlah * v_harga_satuan * (100.0 - v_diskon) / 100.0);
    v_total    := v_total + v_subtotal;

    INSERT INTO public.item_pesanan_jual (
      pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
    )
    VALUES (
      v_pesanan_id, v_barang_id, v_jumlah, v_harga_satuan, v_diskon, v_subtotal
    );
  END LOOP;

  -- Perbarui total pesanan
  UPDATE public.pesanan_jual SET total = v_total WHERE id = v_pesanan_id;

  RETURN jsonb_build_object(
    'id',    v_pesanan_id,
    'nomor', v_nomor,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) TO authenticated;

-- 2. PEMBARUAN: rpc_ajukan_persetujuan_harga
-- Izinkan pengajuan persetujuan jika ada harga di bawah HPP ATAU ada diskon > 10%
CREATE OR REPLACE FUNCTION public.rpc_ajukan_persetujuan_harga(
  p_pesanan_id uuid,
  p_catatan text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
  v_perlu_persetujuan boolean;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT public.fn_is_penjualan() THEN
    RAISE EXCEPTION 'Hanya Staf Penjualan yang dapat mengajukan persetujuan harga' USING ERRCODE = 'E0039';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL OR v_pesanan.dibuat_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'draf' THEN
    RAISE EXCEPTION 'Pengajuan hanya dapat dilakukan pada pesanan berstatus draf' USING ERRCODE = 'E0040';
  END IF;

  -- Periksa dan tandai kedaluwarsa jika sebelumnya ada yang disetujui tapi lewat 24 jam
  UPDATE public.persetujuan_harga
  SET status = 'kedaluwarsa'
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'disetujui'
    AND (now() AT TIME ZONE 'Asia/Jakarta') >= berlaku_sampai;

  IF EXISTS (
    SELECT 1 FROM public.persetujuan_harga
    WHERE pesanan_jual_id = p_pesanan_id
      AND status IN ('menunggu', 'disetujui')
  ) THEN
    RAISE EXCEPTION 'Pesanan sudah memiliki pengajuan persetujuan yang aktif' USING ERRCODE = 'E0041';
  END IF;

  -- Memerlukan persetujuan jika: ada subtotal < (HPP * jumlah) ATAU ada item dengan diskon > 10%
  SELECT EXISTS (
    SELECT 1
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
      AND (
        ip.subtotal < (COALESCE(b.harga_pokok, 0) * ip.jumlah)
        OR ip.diskon_persen > 10
      )
  ) INTO v_perlu_persetujuan;

  IF NOT v_perlu_persetujuan THEN
    RAISE EXCEPTION 'Tidak ada harga yang memerlukan persetujuan' USING ERRCODE = 'E0042';
  END IF;

  v_hash := public.fn_hitung_hash_pesanan(p_pesanan_id);

  INSERT INTO public.persetujuan_harga (
    pesanan_jual_id, status, diajukan_oleh, diajukan_pada, catatan_pengaju, snapshot_hash
  )
  VALUES (
    p_pesanan_id, 'menunggu', auth.uid(), now(), btrim(p_catatan), v_hash
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_baru
  )
  VALUES (
    auth.uid(),
    'ajukan_persetujuan_harga',
    'persetujuan_harga',
    v_id,
    jsonb_build_object('pesanan_jual_id', p_pesanan_id, 'status', 'menunggu')
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'status', 'menunggu'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ajukan_persetujuan_harga(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ajukan_persetujuan_harga(uuid, text) TO authenticated;
