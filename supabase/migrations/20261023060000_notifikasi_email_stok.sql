-- ============================================================
-- Migrasi: Notifikasi Email Stok Menipis Harian (PRD 11.1)
-- Berkas: 20261023060000_notifikasi_email_stok.sql
-- Sesuai: docs/fitur-email-stok.md & Keputusan E1 s.d. E12
-- ============================================================

-- 1. TABEL LOG & IDEMPOTENSI NOTIFIKASI EMAIL
CREATE TABLE IF NOT EXISTS public.notifikasi_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis text NOT NULL CHECK (jenis IN ('stok_menipis', 'uji')),
  tanggal_bisnis date NOT NULL,
  status text NOT NULL CHECK (status IN ('diklaim', 'terkirim', 'dilewati', 'gagal')),
  jumlah_barang integer NOT NULL DEFAULT 0 CHECK (jumlah_barang >= 0),
  jumlah_penerima integer NOT NULL DEFAULT 0 CHECK (jumlah_penerima >= 0),
  galat_singkat text,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifikasi_email_log IS 'Riwayat dan kontrol idempotensi notifikasi email otomatis sistem.';

-- Indeks unik untuk idempotensi harian jenis 'stok_menipis'
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifikasi_stok_harian
  ON public.notifikasi_email_log (jenis, tanggal_bisnis)
  WHERE jenis = 'stok_menipis';

-- Indeks pengurutan riwayat
CREATE INDEX IF NOT EXISTS idx_notifikasi_log_dibuat
  ON public.notifikasi_email_log (dibuat_pada DESC);

-- RLS pada tabel log
ALTER TABLE public.notifikasi_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifikasi_email_log_select_manajer"
  ON public.notifikasi_email_log FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

GRANT SELECT ON public.notifikasi_email_log TO authenticated;
GRANT ALL ON public.notifikasi_email_log TO service_role;

-- ============================================================
-- 2. RPC SISTEM: DAFTAR BARANG STOK MENIPIS (E1, E5)
-- Hanya barang aktif dengan stok <= stok_minimum (tanpa kolom harga/uang)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_daftar_stok_menipis()
RETURNS TABLE (
  kode text,
  nama text,
  satuan text,
  stok integer,
  stok_minimum integer,
  selisih integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.kode,
    b.nama,
    b.satuan,
    b.stok,
    b.stok_minimum,
    (b.stok_minimum - b.stok)::integer AS selisih
  FROM public.barang b
  WHERE b.aktif = true
    AND b.stok <= b.stok_minimum
  ORDER BY (b.stok_minimum - b.stok) DESC, b.kode ASC;
END;
$$;

-- ============================================================
-- 3. RPC SISTEM: DAFTAR PENERIMA NOTIFIKASI STOK (E2, E5)
-- Mengambil email dari auth.users untuk akun aktif Manajer & Gudang
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_penerima_notifikasi_stok()
RETURNS TABLE (
  email text,
  nama_lengkap text,
  peran text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::text,
    COALESCE(p.nama_lengkap, u.email::text) AS nama_lengkap,
    p.peran
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.aktif = true
    AND p.peran IN ('manajer', 'gudang')
    AND u.email IS NOT NULL
    AND u.email <> ''
  ORDER BY p.peran ASC, p.nama_lengkap ASC;
END;
$$;

-- ============================================================
-- 4. RPC SISTEM: KLAIM NOTIFIKASI (E6)
-- Idempotensi tanggal bisnis & kontrol retry gagal / rate limit uji
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_klaim_notifikasi(
  p_jenis text,
  p_tanggal_bisnis date
)
RETURNS TABLE (
  boleh_kirim boolean,
  log_id uuid,
  pesan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_status text;
  v_new_id uuid;
  v_last_uji timestamptz;
BEGIN
  IF p_jenis NOT IN ('stok_menipis', 'uji') THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Jenis notifikasi tidak valid';
    RETURN;
  END IF;

  -- Alur jenis 'stok_menipis' (Idempoten per hari)
  IF p_jenis = 'stok_menipis' THEN
    SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.notifikasi_email_log
    WHERE jenis = 'stok_menipis' AND tanggal_bisnis = p_tanggal_bisnis
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
      -- Jika sebelumnya gagal, izinkan pengulangan (retry)
      IF v_existing_status = 'gagal' THEN
        UPDATE public.notifikasi_email_log
        SET status = 'diklaim',
            galat_singkat = NULL,
            diperbarui_pada = now()
        WHERE id = v_existing_id;

        RETURN QUERY SELECT true, v_existing_id, 'Klaim ulang setelah gagal diizinkan'::text;
        RETURN;
      ELSE
        RETURN QUERY SELECT false, v_existing_id, 'Notifikasi hari ini sudah pernah diproses'::text;
        RETURN;
      END IF;
    END IF;

    -- Belum pernah ada, buat log baru
    INSERT INTO public.notifikasi_email_log (
      jenis, tanggal_bisnis, status, dibuat_pada, diperbarui_pada
    )
    VALUES (
      'stok_menipis', p_tanggal_bisnis, 'diklaim', now(), now()
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT true, v_new_id, 'Klaim berhasil'::text;
    RETURN;
  END IF;

  -- Alur jenis 'uji' (Rate limit 1 menit)
  IF p_jenis = 'uji' THEN
    SELECT COALESCE(MAX(dibuat_pada), '1970-01-01'::timestamptz) INTO v_last_uji
    FROM public.notifikasi_email_log
    WHERE jenis = 'uji';

    IF (now() - v_last_uji) < INTERVAL '1 minute' THEN
      RETURN QUERY SELECT false, NULL::uuid, 'Uji kirim dibatasi maksimal 1 kali per menit'::text;
      RETURN;
    END IF;

    INSERT INTO public.notifikasi_email_log (
      jenis, tanggal_bisnis, status, dibuat_pada, diperbarui_pada
    )
    VALUES (
      'uji', p_tanggal_bisnis, 'diklaim', now(), now()
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT true, v_new_id, 'Klaim uji berhasil'::text;
    RETURN;
  END IF;
END;
$$;

-- ============================================================
-- 5. RPC SISTEM: SELESAIKAN NOTIFIKASI (E6)
-- Memperbarui status akhir log notifikasi
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_selesaikan_notifikasi(
  p_log_id uuid,
  p_status text,
  p_jumlah_barang integer,
  p_jumlah_penerima integer,
  p_galat text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('terkirim', 'dilewati', 'gagal') THEN
    RAISE EXCEPTION 'Status tidak valid' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.notifikasi_email_log
  SET status = p_status,
      jumlah_barang = p_jumlah_barang,
      jumlah_penerima = p_jumlah_penerima,
      galat_singkat = p_galat,
      diperbarui_pada = now()
  WHERE id = p_log_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 6. RPC BACA: RIWAYAT NOTIFIKASI KHUSUS MANAJER (E10)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_riwayat_notifikasi_manajer()
RETURNS TABLE (
  id uuid,
  jenis text,
  tanggal_bisnis date,
  status text,
  jumlah_barang integer,
  jumlah_penerima integer,
  galat_singkat text,
  dibuat_pada timestamptz,
  diperbarui_pada timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.jenis,
    l.tanggal_bisnis,
    l.status,
    l.jumlah_barang,
    l.jumlah_penerima,
    l.galat_singkat,
    l.dibuat_pada,
    l.diperbarui_pada
  FROM public.notifikasi_email_log l
  ORDER BY l.dibuat_pada DESC
  LIMIT 50;
END;
$$;

-- ============================================================
-- 7. PENEGAKAN HAK AKSES (GRANT & REVOKE) (E5)
-- rpc_sistem_* HANYA boleh dipanggil oleh role service_role
-- ============================================================
REVOKE ALL ON FUNCTION public.rpc_sistem_daftar_stok_menipis() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_daftar_stok_menipis() TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_penerima_notifikasi_stok() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_penerima_notifikasi_stok() TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_klaim_notifikasi(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_klaim_notifikasi(text, date) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_selesaikan_notifikasi(uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_selesaikan_notifikasi(uuid, text, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_riwayat_notifikasi_manajer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_riwayat_notifikasi_manajer() TO authenticated;
