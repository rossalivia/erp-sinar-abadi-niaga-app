-- ============================================================
-- MIGRASI: Fitur Persetujuan Harga di Bawah HPP (Price Approval Workflow)
-- File: supabase/migrations/20261022200000_persetujuan_harga.sql
-- Sesuai: BR-15 s.d. BR-20, Keputusan P1-P12 & Q1-Q5, docs/fitur-persetujuan-harga.md
-- ============================================================

-- 0. FUNGSI HELPER: fn_is_penjualan
CREATE OR REPLACE FUNCTION public.fn_is_penjualan()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (public.fn_peran() = 'penjualan');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_is_penjualan() TO authenticated;

-- 1. TABEL: public.persetujuan_harga
CREATE TABLE IF NOT EXISTS public.persetujuan_harga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_jual_id uuid NOT NULL REFERENCES public.pesanan_jual(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'menunggu' CHECK (
    status IN ('menunggu', 'disetujui', 'ditolak', 'terpakai', 'dibatalkan', 'kedaluwarsa')
  ),
  diajukan_oleh uuid NOT NULL REFERENCES public.profiles(id),
  diajukan_pada timestamp with time zone NOT NULL DEFAULT now(),
  catatan_pengaju text,
  keputusan_oleh uuid REFERENCES public.profiles(id),
  keputusan_pada timestamp with time zone,
  catatan_keputusan text,
  alasan_tolak text,
  snapshot_hash text NOT NULL,
  berlaku_sampai timestamp with time zone,
  dipakai_pada timestamp with time zone
);

-- Partial Unique Index: Maksimal 1 persetujuan aktif (menunggu / disetujui) per pesanan (P1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_persetujuan_aktif_per_pesanan
  ON public.persetujuan_harga (pesanan_jual_id)
  WHERE status IN ('menunggu', 'disetujui');

CREATE INDEX IF NOT EXISTS idx_persetujuan_status
  ON public.persetujuan_harga (status, diajukan_pada DESC);

CREATE INDEX IF NOT EXISTS idx_persetujuan_pesanan
  ON public.persetujuan_harga (pesanan_jual_id, status);

-- Enable RLS
ALTER TABLE public.persetujuan_harga ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS SELECT
DROP POLICY IF EXISTS persetujuan_select ON public.persetujuan_harga;
CREATE POLICY persetujuan_select ON public.persetujuan_harga
  FOR SELECT TO authenticated
  USING (
    public.fn_is_manajer()
    OR (public.fn_is_penjualan() AND diajukan_oleh = auth.uid())
  );

-- Hak akses kolom (snapshot_hash tidak diekspos langsung ke SELECT klien)
REVOKE ALL ON TABLE public.persetujuan_harga FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, pesanan_jual_id, status, diajukan_oleh, diajukan_pada,
  catatan_pengaju, keputusan_oleh, keputusan_pada, catatan_keputusan,
  alasan_tolak, berlaku_sampai, dipakai_pada
) ON public.persetujuan_harga TO authenticated;

-- 2. FUNGSI HASH SNAPSHOT: fn_hitung_hash_pesanan(p_pesanan_id uuid)
CREATE OR REPLACE FUNCTION public.fn_hitung_hash_pesanan(p_pesanan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pelanggan_id uuid;
  v_items_str text;
BEGIN
  SELECT pelanggan_id INTO v_pelanggan_id
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id;

  IF v_pelanggan_id IS NULL THEN
    RETURN md5('empty');
  END IF;

  SELECT string_agg(
    ip.barang_id::text || ':' || ip.jumlah::text || ':' || ip.harga_satuan::text || ':' || ip.diskon_persen::text,
    ',' ORDER BY ip.barang_id
  ) INTO v_items_str
  FROM public.item_pesanan_jual ip
  WHERE ip.pesanan_jual_id = p_pesanan_id;

  RETURN md5(v_pelanggan_id::text || '|' || COALESCE(v_items_str, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_hitung_hash_pesanan(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_hitung_hash_pesanan(uuid) TO authenticated;

-- 3. FUNGSI STATUS EFEKTIF: fn_persetujuan_efektif(p_pesanan_id uuid)
CREATE OR REPLACE FUNCTION public.fn_persetujuan_efektif(p_pesanan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.persetujuan_harga
    WHERE pesanan_jual_id = p_pesanan_id
      AND status = 'disetujui'
      AND (now() AT TIME ZONE 'Asia/Jakarta') < berlaku_sampai
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_persetujuan_efektif(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_persetujuan_efektif(uuid) TO authenticated;

-- 4. VIEW PUBLIK: v_persetujuan_harga
CREATE OR REPLACE VIEW public.v_persetujuan_harga
AS
SELECT
  ph.id,
  ph.pesanan_jual_id,
  pj.nomor AS nomor_pesanan,
  pj.total AS total_pesanan,
  plg.nama_toko AS nama_pelanggan,
  CASE
    WHEN ph.status = 'disetujui' AND (now() AT TIME ZONE 'Asia/Jakarta') >= ph.berlaku_sampai THEN 'kedaluwarsa'
    ELSE ph.status
  END AS status,
  ph.diajukan_oleh,
  prof.nama_lengkap AS nama_pengaju,
  ph.diajukan_pada,
  ph.catatan_pengaju,
  ph.keputusan_oleh,
  prof_m.nama_lengkap AS nama_pemutus,
  ph.keputusan_pada,
  ph.catatan_keputusan,
  ph.alasan_tolak,
  ph.berlaku_sampai,
  ph.dipakai_pada
FROM public.persetujuan_harga ph
JOIN public.pesanan_jual pj ON pj.id = ph.pesanan_jual_id
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = ph.diajukan_oleh
LEFT JOIN public.profiles prof_m ON prof_m.id = ph.keputusan_oleh;

REVOKE ALL ON public.v_persetujuan_harga FROM anon, PUBLIC;
GRANT SELECT ON public.v_persetujuan_harga TO authenticated;

-- 5. VIEW MANAJER (OWNER RIGHTS): v_persetujuan_harga_manajer
CREATE OR REPLACE VIEW public.v_persetujuan_harga_manajer
AS
SELECT
  ph.id AS persetujuan_id,
  ph.pesanan_jual_id,
  pj.nomor AS nomor_pesanan,
  pj.total AS total_pesanan,
  plg.id AS pelanggan_id,
  plg.nama_toko AS nama_pelanggan,
  CASE
    WHEN ph.status = 'disetujui' AND (now() AT TIME ZONE 'Asia/Jakarta') >= ph.berlaku_sampai THEN 'kedaluwarsa'
    ELSE ph.status
  END AS status,
  ph.diajukan_oleh,
  prof.nama_lengkap AS nama_pengaju,
  ph.diajukan_pada,
  ph.catatan_pengaju,
  ph.keputusan_oleh,
  prof_m.nama_lengkap AS nama_pemutus,
  ph.keputusan_pada,
  ph.catatan_keputusan,
  ph.alasan_tolak,
  ph.snapshot_hash,
  ph.berlaku_sampai,
  ph.dipakai_pada,
  -- Item detail dengan data finansial rahasia (HPP & Margin)
  ip.id AS item_id,
  ip.barang_id,
  b.kode AS kode_barang,
  b.nama AS nama_barang,
  ip.jumlah,
  ip.harga_satuan,
  ip.diskon_persen,
  ip.subtotal,
  b.harga_pokok AS hpp_satuan,
  (ip.harga_satuan - (ip.harga_satuan * ip.diskon_persen / 100)) - COALESCE(b.harga_pokok, 0) AS margin_satuan,
  ip.subtotal - (COALESCE(b.harga_pokok, 0) * ip.jumlah) AS margin_total
FROM public.persetujuan_harga ph
JOIN public.pesanan_jual pj ON pj.id = ph.pesanan_jual_id
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = ph.diajukan_oleh
LEFT JOIN public.profiles prof_m ON prof_m.id = ph.keputusan_oleh
JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
JOIN public.barang b ON b.id = ip.barang_id
WHERE public.fn_is_manajer();

REVOKE ALL ON public.v_persetujuan_harga_manajer FROM anon, PUBLIC;
GRANT SELECT ON public.v_persetujuan_harga_manajer TO authenticated;

-- 6. RPC: rpc_ajukan_persetujuan_harga
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
  v_ada_bawah_hpp boolean;
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

  -- Cek apakah ada minimal satu baris di bawah HPP (COALESCE NULL = 0 per A5)
  SELECT EXISTS (
    SELECT 1
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
      AND ip.subtotal < (COALESCE(b.harga_pokok, 0) * ip.jumlah)
  ) INTO v_ada_bawah_hpp;

  IF NOT v_ada_bawah_hpp THEN
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

-- 7. RPC: rpc_putuskan_persetujuan_harga
CREATE OR REPLACE FUNCTION public.rpc_putuskan_persetujuan_harga(
  p_id uuid,
  p_setuju boolean,
  p_catatan text DEFAULT NULL,
  p_alasan_tolak text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_persetujuan record;
  v_berlaku_sampai timestamptz;
  v_status_baru text;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE id = p_id
  FOR UPDATE;

  IF v_persetujuan.id IS NULL THEN
    RAISE EXCEPTION 'Persetujuan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_persetujuan.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Persetujuan hanya dapat diputuskan saat berstatus menunggu' USING ERRCODE = 'E0043';
  END IF;

  IF p_setuju THEN
    v_status_baru := 'disetujui';
    v_berlaku_sampai := (now() AT TIME ZONE 'Asia/Jakarta') + interval '24 hour';

    UPDATE public.persetujuan_harga
    SET status = v_status_baru,
        keputusan_oleh = auth.uid(),
        keputusan_pada = now(),
        catatan_keputusan = btrim(p_catatan),
        berlaku_sampai = v_berlaku_sampai
    WHERE id = p_id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'setujui_persetujuan_harga',
      'persetujuan_harga',
      p_id,
      jsonb_build_object('status', 'menunggu'),
      jsonb_build_object('status', 'disetujui', 'berlaku_sampai', v_berlaku_sampai)
    );
  ELSE
    v_status_baru := 'ditolak';

    IF length(btrim(COALESCE(p_alasan_tolak, ''))) < 10 THEN
      RAISE EXCEPTION 'Alasan penolakan minimal 10 karakter' USING ERRCODE = 'E0044';
    END IF;

    UPDATE public.persetujuan_harga
    SET status = v_status_baru,
        keputusan_oleh = auth.uid(),
        keputusan_pada = now(),
        catatan_keputusan = btrim(p_catatan),
        alasan_tolak = btrim(p_alasan_tolak)
    WHERE id = p_id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'tolak_persetujuan_harga',
      'persetujuan_harga',
      p_id,
      jsonb_build_object('status', 'menunggu'),
      jsonb_build_object('status', 'ditolak', 'alasan_tolak', btrim(p_alasan_tolak))
    );
  END IF;

  RETURN jsonb_build_object(
    'id', p_id,
    'status', v_status_baru
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_putuskan_persetujuan_harga(uuid, boolean, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_putuskan_persetujuan_harga(uuid, boolean, text, text) TO authenticated;

-- 8. RPC: rpc_batalkan_pengajuan_harga
CREATE OR REPLACE FUNCTION public.rpc_batalkan_pengajuan_harga(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_persetujuan record;
BEGIN
  IF NOT public.fn_is_penjualan() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE id = p_id
  FOR UPDATE;

  IF v_persetujuan.id IS NULL THEN
    RAISE EXCEPTION 'Persetujuan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_persetujuan.diajukan_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_persetujuan.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Hanya pengajuan berstatus menunggu yang dapat dibatalkan' USING ERRCODE = 'E0045';
  END IF;

  UPDATE public.persetujuan_harga
  SET status = 'dibatalkan'
  WHERE id = p_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'batalkan_pengajuan_harga',
    'persetujuan_harga',
    p_id,
    jsonb_build_object('status', 'menunggu'),
    jsonb_build_object('status', 'dibatalkan')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_batalkan_pengajuan_harga(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_pengajuan_harga(uuid) TO authenticated;

-- 9. UPDATE RPC: rpc_simpan_draf_pesanan (Invalidasi Hash Draf)
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items        jsonb,
  p_pesanan_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_inval_count    integer;
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
    SELECT id, nomor
    INTO v_pesanan_id, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

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

    -- P2 & BR-18: Invalidasi persetujuan aktif bila draf diubah
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = p_pesanan_id
      AND status IN ('menunggu', 'disetujui');
    GET DIAGNOSTICS v_inval_count = ROW_COUNT;

    IF v_inval_count > 0 THEN
      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_edit_draf',
        'persetujuan_harga',
        p_pesanan_id,
        jsonb_build_object('alasan', 'draf_diubah', 'jumlah_inval', v_inval_count)
      );
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
    v_subtotal := round(v_jumlah * v_harga_satuan * (100 - v_diskon) / 100.0);
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

-- 10. UPDATE RPC: rpc_batalkan_draf (Menutup Pengajuan Aktif)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_draf(p_pesanan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran  text;
  v_status text;
  v_pemilik uuid;
  v_batal_count integer;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT status, dibuat_oleh INTO v_status, v_pemilik
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pemilik <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- P8: Batalkan persetujuan aktif otomatis
  UPDATE public.persetujuan_harga
  SET status = 'dibatalkan'
  WHERE pesanan_jual_id = p_pesanan_id
    AND status IN ('menunggu', 'disetujui');
  GET DIAGNOSTICS v_batal_count = ROW_COUNT;

  IF v_batal_count > 0 THEN
    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_baru
    )
    VALUES (
      auth.uid(),
      'persetujuan_dibatalkan_karena_draf_dibatalkan',
      'persetujuan_harga',
      p_pesanan_id,
      jsonb_build_object('pesanan_jual_id', p_pesanan_id, 'jumlah', v_batal_count)
    );
  END IF;

  UPDATE public.pesanan_jual
  SET status = 'dibatalkan',
      dibatalkan_pada = now()
  WHERE id = p_pesanan_id;
END;
$$;

-- 11. UPDATE RPC: rpc_konfirmasi_pesanan (Kunci P9 & Validasi Persetujuan)
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran                 text;
  v_pesanan               record;
  v_persetujuan           record;
  v_pelanggan             record;
  v_item_count            integer;
  v_item                  record;
  v_stok_sesudah          integer;
  v_kredit                record;
  v_ada_bawah_hpp         boolean := false;
  v_current_hash          text;
  v_persetujuan_id_pakai  uuid := NULL;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- P9 Urutan Kunci 1: pesanan_jual FOR UPDATE
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

  -- P9 Urutan Kunci 2: persetujuan_harga FOR UPDATE (jika ada yang aktif)
  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE pesanan_jual_id = p_pesanan_id
    AND status IN ('menunggu', 'disetujui')
  ORDER BY diajukan_pada DESC
  LIMIT 1
  FOR UPDATE;

  -- Validasi jumlah baris 1 s.d. 20 (BR-02, E03)
  SELECT count(*) INTO v_item_count
  FROM public.item_pesanan_jual
  WHERE pesanan_jual_id = p_pesanan_id;

  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- P9 Urutan Kunci 3: pelanggan FOR UPDATE
  SELECT * INTO v_pelanggan
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id
  FOR UPDATE;

  IF v_pelanggan.id IS NULL OR v_pelanggan.aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- P9 Urutan Kunci 4: barang FOR UPDATE ORDER BY id (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Validasi keaktifan setiap barang, diskon, dan deteksi baris di bawah HPP
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

    -- Deteksi baris di bawah HPP (COALESCE NULL = 0 per A5)
    IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
      v_ada_bawah_hpp := true;
    END IF;
  END LOOP;

  -- P6: Evaluasi BR-04 untuk Staf Penjualan
  IF v_peran = 'penjualan' AND v_ada_bawah_hpp THEN
    -- Periksa apakah ada persetujuan yang disetujui
    IF v_persetujuan.id IS NULL OR v_persetujuan.status <> 'disetujui' THEN
      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- P3 & BR-17: Cek masa berlaku 24 jam (lazy evaluation)
    IF (now() AT TIME ZONE 'Asia/Jakarta') >= v_persetujuan.berlaku_sampai THEN
      UPDATE public.persetujuan_harga
      SET status = 'kedaluwarsa'
      WHERE id = v_persetujuan.id;

      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_saat_konfirmasi',
        'persetujuan_harga',
        v_persetujuan.id,
        jsonb_build_object('alasan', 'lewat_24_jam')
      );

      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- P2 & BR-18: Cek snapshot_hash
    v_current_hash := public.fn_hitung_hash_pesanan(p_pesanan_id);
    IF v_current_hash <> v_persetujuan.snapshot_hash THEN
      UPDATE public.persetujuan_harga
      SET status = 'kedaluwarsa'
      WHERE id = v_persetujuan.id;

      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_saat_konfirmasi',
        'persetujuan_harga',
        v_persetujuan.id,
        jsonb_build_object('alasan', 'hash_mismatch')
      );

      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- Semua syarat persetujuan lolos! Tandai untuk dipakai
    v_persetujuan_id_pakai := v_persetujuan.id;
  END IF;

  -- 3f. BR-13 & BR-14: Hitung kredit dan overdue via fungsi tunggal (K2)
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- K2: Prioritas Overdue diperiksa terlebih dahulu (E0013)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- K2: Plafon Kredit diperiksa berikutnya (E0012)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui'
      USING ERRCODE = 'E0012';
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

  -- 3g. Eksekusi mutasi stok & snapshot HPP
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

  -- P3 & BR-17: Tandai persetujuan terpakai jika ada
  IF v_persetujuan_id_pakai IS NOT NULL THEN
    UPDATE public.persetujuan_harga
    SET status = 'terpakai',
        dipakai_pada = now()
    WHERE id = v_persetujuan_id_pakai;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_baru
    )
    VALUES (
      auth.uid(),
      'pakai_persetujuan_harga',
      'persetujuan_harga',
      v_persetujuan_id_pakai,
      jsonb_build_object('status', 'terpakai', 'pesanan_jual_id', p_pesanan_id)
    );
  END IF;

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
