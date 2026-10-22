-- Migration: 20261022210000_penagihan_piutang.sql
-- Fitur: Penagihan Piutang, Klasifikasi Umur Tagihan, Kartu Piutang, Pengingat WA, dan Catatan Penagihan Append-Only

-- 1. TABEL: catatan_penagihan (Append-Only)
CREATE TABLE IF NOT EXISTS public.catatan_penagihan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelanggan_id uuid NOT NULL REFERENCES public.pelanggan(id) ON DELETE RESTRICT,
  pesanan_jual_id uuid NULL REFERENCES public.pesanan_jual(id) ON DELETE SET NULL,
  jenis text NOT NULL CHECK (jenis IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan')),
  isi text NOT NULL,
  janji_bayar_tanggal date NULL,
  dibuat_oleh uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_catatan_penagihan_isi_length CHECK (length(btrim(isi)) BETWEEN 3 AND 500),
  CONSTRAINT ck_catatan_penagihan_janji_bayar CHECK (
    (jenis = 'janji_bayar' AND janji_bayar_tanggal IS NOT NULL) OR
    (jenis <> 'janji_bayar' AND janji_bayar_tanggal IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_pelanggan ON public.catatan_penagihan(pelanggan_id, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_pesanan ON public.catatan_penagihan(pesanan_jual_id, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_janji ON public.catatan_penagihan(janji_bayar_tanggal) WHERE jenis = 'janji_bayar';

-- 2. TRIGGER GUARD: Mencegah UPDATE dan DELETE (Append-Only)
CREATE OR REPLACE FUNCTION public.fn_guard_catatan_penagihan()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catatan penagihan bersifat permanen dan tidak dapat diubah atau dihapus'
    USING ERRCODE = 'E0051';
END;
$$;

DROP TRIGGER IF EXISTS trg_catatan_penagihan_guard ON public.catatan_penagihan;
CREATE TRIGGER trg_catatan_penagihan_guard
  BEFORE UPDATE OR DELETE ON public.catatan_penagihan
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_catatan_penagihan();

-- 3. FUNGSI KLASIFIKASI UMUR TAGIHAN
CREATE OR REPLACE FUNCTION public.fn_klasifikasi_tagihan(
  p_jatuh_tempo date,
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_jatuh_tempo < p_today THEN
      CASE
        WHEN (p_today - p_jatuh_tempo) BETWEEN 1 AND 7 THEN 'overdue_1_7'
        WHEN (p_today - p_jatuh_tempo) BETWEEN 8 AND 30 THEN 'overdue_8_30'
        ELSE 'overdue_lebih_30'
      END
    WHEN p_jatuh_tempo = p_today THEN 'hari_ini'
    WHEN p_jatuh_tempo <= (p_today + 3) THEN 'segera'
    ELSE 'belum_jatuh_tempo'
  END;
$$;

-- 4. VIEW: v_tagihan (security invoker = true)
CREATE OR REPLACE VIEW public.v_tagihan AS
WITH latest_janji_pesanan AS (
  SELECT DISTINCT ON (pesanan_jual_id)
    id AS janji_id,
    pelanggan_id,
    pesanan_jual_id,
    janji_bayar_tanggal,
    isi AS janji_catatan,
    dibuat_pada AS janji_dibuat_pada
  FROM public.catatan_penagihan
  WHERE jenis = 'janji_bayar' AND pesanan_jual_id IS NOT NULL
  ORDER BY pesanan_jual_id, dibuat_pada DESC
),
latest_janji_pelanggan AS (
  SELECT DISTINCT ON (pelanggan_id)
    id AS janji_id,
    pelanggan_id,
    janji_bayar_tanggal,
    isi AS janji_catatan,
    dibuat_pada AS janji_dibuat_pada
  FROM public.catatan_penagihan
  WHERE jenis = 'janji_bayar' AND pesanan_jual_id IS NULL
  ORDER BY pelanggan_id, dibuat_pada DESC
)
SELECT
  pj.id AS pesanan_id,
  pj.nomor AS nomor_pesanan,
  pj.pelanggan_id,
  plg.kode AS kode_pelanggan,
  plg.nama_toko,
  plg.telepon,
  plg.alamat,
  plg.termin_hari,
  plg.batas_kredit,
  pj.total,
  pj.dibuat_oleh,
  prof.nama_lengkap AS nama_sales,
  pj.dibuat_pada,
  pj.dikirim_pada,
  pj.jatuh_tempo,
  -- Perhitungan selisih hari berbasis tanggal bisnis Asia/Jakarta
  CASE
    WHEN pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN ((now() AT TIME ZONE 'Asia/Jakarta')::date - pj.jatuh_tempo)::integer
    ELSE 0
  END AS hari_terlambat,
  CASE
    WHEN pj.jatuh_tempo >= (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN (pj.jatuh_tempo - (now() AT TIME ZONE 'Asia/Jakarta')::date)::integer
    ELSE 0
  END AS hari_menuju,
  -- Klasifikasi umur
  public.fn_klasifikasi_tagihan(pj.jatuh_tempo, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS klasifikasi,
  -- Janji bayar aktif terkait
  COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) AS janji_bayar_tanggal,
  COALESCE(ljp.janji_catatan, ljplg.janji_catatan) AS janji_catatan,
  CASE
    WHEN COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) IS NOT NULL
         AND COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN 'terlewat'
    WHEN COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) IS NOT NULL
      THEN 'aktif'
    ELSE 'tidak_ada'
  END AS status_janji
FROM public.pesanan_jual pj
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = pj.dibuat_oleh
LEFT JOIN latest_janji_pesanan ljp ON ljp.pesanan_jual_id = pj.id
LEFT JOIN latest_janji_pelanggan ljplg ON ljplg.pelanggan_id = pj.pelanggan_id
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- Set security_invoker pada Postgres 15+ jika didukung
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_tagihan SET (security_invoker = true);
  END IF;
END $$;

-- Hak akses view v_tagihan
REVOKE ALL ON public.v_tagihan FROM anon, PUBLIC;
GRANT SELECT ON public.v_tagihan TO authenticated;

-- 5. RLS & GRANTS: catatan_penagihan
ALTER TABLE public.catatan_penagihan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catatan_penagihan_select" ON public.catatan_penagihan;
CREATE POLICY "catatan_penagihan_select"
  ON public.catatan_penagihan FOR SELECT
  TO authenticated
  USING (
    public.fn_is_manajer()
    OR (
      public.fn_peran() = 'penjualan'
      AND (
        dibuat_oleh = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.pesanan_jual pj
          WHERE pj.pelanggan_id = catatan_penagihan.pelanggan_id
            AND pj.status = 'dikirim'
            AND pj.dibuat_oleh = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "catatan_penagihan_modify_block" ON public.catatan_penagihan;
CREATE POLICY "catatan_penagihan_modify_block"
  ON public.catatan_penagihan FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.catatan_penagihan FROM anon, PUBLIC;
GRANT SELECT ON public.catatan_penagihan TO authenticated;

-- 6. RPC: rpc_catat_penagihan
CREATE OR REPLACE FUNCTION public.rpc_catat_penagihan(
  p_pelanggan_id uuid,
  p_pesanan_jual_id uuid DEFAULT NULL,
  p_jenis text DEFAULT 'catatan',
  p_isi text DEFAULT '',
  p_janji_bayar_tanggal date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_user_id uuid;
  v_today date;
  v_catatan_id uuid;
  v_created_at timestamptz;
  v_pj_pelanggan_id uuid;
  v_pj_status text;
  v_pj_dibuat_oleh uuid;
BEGIN
  v_user_id := auth.uid();
  v_peran := public.fn_peran();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- 1. Cek peran pemanggil
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Staf Penjualan dan Manajer yang dapat mencatat penagihan'
      USING ERRCODE = 'E0001';
  END IF;

  -- 2. Cek pelanggan
  IF NOT EXISTS (SELECT 1 FROM public.pelanggan WHERE id = p_pelanggan_id) THEN
    RAISE EXCEPTION 'Pelanggan tidak ditemukan'
      USING ERRCODE = 'E0002';
  END IF;

  -- 3. Otorisasi Penjualan
  IF v_peran = 'penjualan' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pesanan_jual
      WHERE pelanggan_id = p_pelanggan_id
        AND status = 'dikirim'
        AND dibuat_oleh = v_user_id
    ) THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  -- 4. Validasi Faktur jika diisi
  IF p_pesanan_jual_id IS NOT NULL THEN
    SELECT pelanggan_id, status, dibuat_oleh
    INTO v_pj_pelanggan_id, v_pj_status, v_pj_dibuat_oleh
    FROM public.pesanan_jual
    WHERE id = p_pesanan_jual_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Faktur tidak valid untuk penagihan pelanggan ini'
        USING ERRCODE = 'E0052';
    END IF;

    IF v_pj_pelanggan_id <> p_pelanggan_id OR v_pj_status <> 'dikirim' THEN
      RAISE EXCEPTION 'Faktur tidak valid untuk penagihan pelanggan ini'
        USING ERRCODE = 'E0052';
    END IF;

    IF v_peran = 'penjualan' AND v_pj_dibuat_oleh <> v_user_id THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  -- 5. Validasi Jenis
  IF p_jenis NOT IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan') THEN
    RAISE EXCEPTION 'Jenis catatan penagihan tidak valid'
      USING ERRCODE = 'E0002';
  END IF;

  -- 6. Validasi Isi
  IF length(btrim(p_isi)) < 3 OR length(btrim(p_isi)) > 500 THEN
    RAISE EXCEPTION 'Catatan penagihan minimal 3 karakter dan maksimal 500 karakter'
      USING ERRCODE = 'E0047';
  END IF;

  -- 7. Validasi Janji Bayar
  IF p_jenis = 'janji_bayar' THEN
    IF p_janji_bayar_tanggal IS NULL THEN
      RAISE EXCEPTION 'Tanggal janji bayar wajib diisi untuk jenis penagihan janji bayar'
        USING ERRCODE = 'E0048';
    END IF;
    IF p_janji_bayar_tanggal < v_today THEN
      RAISE EXCEPTION 'Tanggal janji bayar tidak boleh di masa lalu'
        USING ERRCODE = 'E0049';
    END IF;
  ELSE
    p_janji_bayar_tanggal := NULL;
  END IF;

  -- 8. Insert catatan
  INSERT INTO public.catatan_penagihan (
    pelanggan_id,
    pesanan_jual_id,
    jenis,
    isi,
    janji_bayar_tanggal,
    dibuat_oleh
  ) VALUES (
    p_pelanggan_id,
    p_pesanan_jual_id,
    p_jenis,
    btrim(p_isi),
    p_janji_bayar_tanggal,
    v_user_id
  )
  RETURNING id, dibuat_pada INTO v_catatan_id, v_created_at;

  RETURN jsonb_build_object(
    'id', v_catatan_id,
    'pelanggan_id', p_pelanggan_id,
    'pesanan_jual_id', p_pesanan_jual_id,
    'jenis', p_jenis,
    'dibuat_pada', v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_catat_penagihan FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_catat_penagihan TO authenticated;

-- 7. RPC: rpc_baca_catatan_penagihan
CREATE OR REPLACE FUNCTION public.rpc_baca_catatan_penagihan(
  p_pelanggan_id uuid,
  p_pesanan_jual_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pelanggan_id uuid,
  pesanan_jual_id uuid,
  nomor_pesanan text,
  jenis text,
  isi text,
  janji_bayar_tanggal date,
  status_janji text,
  dibuat_oleh uuid,
  nama_pembuat text,
  dibuat_pada timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_user_id uuid;
  v_today date;
BEGIN
  v_user_id := auth.uid();
  v_peran := public.fn_peran();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_peran = 'penjualan' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pesanan_jual
      WHERE pelanggan_id = p_pelanggan_id
        AND status = 'dikirim'
        AND dibuat_oleh = v_user_id
    ) THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.pelanggan_id,
    cp.pesanan_jual_id,
    pj.nomor AS nomor_pesanan,
    cp.jenis,
    cp.isi,
    cp.janji_bayar_tanggal,
    CASE
      WHEN cp.janji_bayar_tanggal IS NOT NULL AND cp.janji_bayar_tanggal < v_today THEN 'terlewat'
      WHEN cp.janji_bayar_tanggal IS NOT NULL THEN 'aktif'
      ELSE 'tidak_ada'
    END AS status_janji,
    cp.dibuat_oleh,
    prof.nama_lengkap AS nama_pembuat,
    cp.dibuat_pada
  FROM public.catatan_penagihan cp
  LEFT JOIN public.pesanan_jual pj ON pj.id = cp.pesanan_jual_id
  JOIN public.profiles prof ON prof.id = cp.dibuat_oleh
  WHERE cp.pelanggan_id = p_pelanggan_id
    AND (p_pesanan_jual_id IS NULL OR cp.pesanan_jual_id = p_pesanan_jual_id)
  ORDER BY cp.dibuat_pada DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_baca_catatan_penagihan FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_baca_catatan_penagihan TO authenticated;
