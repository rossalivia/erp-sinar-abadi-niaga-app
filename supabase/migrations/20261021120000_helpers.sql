-- ============================================================
-- Migrasi 1: Helper Functions & Role Safeguards
-- fn_peran()      → mengembalikan peran pengguna aktif (NULL jika nonaktif/anonim)
-- peran_saya()    → alias untuk fn_peran()
-- fn_is_manajer() → shortcut boolean (true jika manajer)
-- ============================================================

-- Pastikan skema auth dan role dasar tersedia (mendukung local Supabase Docker maupun direct Postgres)
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

-- Mock / helper auth.uid() jika belum tersedia di lingkungan pengujian
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb)->>'sub'
    ),
    ''
  )::uuid;
$$;

-- fn_peran: SECURITY DEFINER, STABLE, SET search_path = public
-- Membaca profiles untuk auth.uid() dan hanya mengembalikan peran bila aktif = true
CREATE OR REPLACE FUNCTION public.fn_peran()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran text;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE 'SELECT p.peran FROM public.profiles p WHERE p.id = auth.uid() AND p.aktif = true'
  INTO v_peran;
  RETURN v_peran;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_peran() IS
  'Mengembalikan peran pengguna aktif saat ini. NULL jika anonim, nonaktif, atau tidak ditemukan.';

-- Alias peran_saya() untuk kompatibilitas matriks akses
CREATE OR REPLACE FUNCTION public.peran_saya()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_peran();
$$;

COMMENT ON FUNCTION public.peran_saya() IS
  'Alias untuk fn_peran().';

-- fn_is_manajer: shortcut boolean
CREATE OR REPLACE FUNCTION public.fn_is_manajer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_peran() = 'manajer';
$$;

COMMENT ON FUNCTION public.fn_is_manajer() IS
  'Shortcut: true hanya jika pengguna aktif berperan manajer.';

-- Hak akses fungsi
REVOKE ALL ON FUNCTION public.fn_peran() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_peran() TO authenticated;

REVOKE ALL ON FUNCTION public.peran_saya() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peran_saya() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_is_manajer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_is_manajer() TO authenticated;
