-- ============================================================
-- Migrasi: Perbaikan Celah Audit PRD
-- File: supabase/migrations/20261026230000_audit_perbaikan_prd.sql
-- Sesuai: PRD Butir 2 (Visibilitas Gudang) & Butir 8 (Penolakan Akun Nonaktif di RLS)
-- ============================================================

-- 1. Perbaiki fn_peran(): akun nonaktif (aktif = false) atau id tidak valid
-- mengembalikan NULL, BUKAN fallback ke 'penjualan'.
CREATE OR REPLACE FUNCTION public.fn_peran()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
BEGIN
  SELECT peran INTO v_peran
  FROM public.profiles
  WHERE id = auth.uid() AND aktif = true;
  
  -- Mengembalikan NULL jika pengguna tidak ditemukan atau aktif = false
  RETURN v_peran;
END;
$$;

-- 2. Perbarui policy pesanan_jual_select untuk peran Gudang:
-- Sesuai Butir 2: Gudang hanya melihat pesanan dengan dikonfirmasi_pada IS NOT NULL
DROP POLICY IF EXISTS "pesanan_jual_select" ON public.pesanan_jual;
CREATE POLICY "pesanan_jual_select"
  ON public.pesanan_jual FOR SELECT
  TO authenticated
  USING (
    public.fn_peran() = 'manajer'
    OR (public.fn_peran() = 'penjualan' AND dibuat_oleh = auth.uid())
    OR (public.fn_peran() = 'gudang' AND dikonfirmasi_pada IS NOT NULL)
  );
