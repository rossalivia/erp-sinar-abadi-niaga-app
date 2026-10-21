-- ============================================================
-- Migrasi 3: Trigger Guard & Audit Trigger
-- 1. Guard stok barang (BR-01, E22)
-- 2. Guard kolom per peran (barang, pelanggan, profiles)
-- 3. Guard append-only (mutasi_stok, audit_log)
-- 4. Trigger audit (harga_jual, batas_kredit, termin_hari, peran, status akun)
-- ============================================================

-- ============================================================
-- 1. Guard Barang (stok, harga, kode, delete)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_barang()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Operasi DELETE dilarang untuk peran aplikasi
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Bypass untuk superuser / seed saat tidak ada sesi JWT pengguna
  IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    NEW.diperbarui_pada := now();
    RETURN NEW;
  END IF;

  -- Kode tidak boleh diubah setelah dibuat
  IF OLD.kode <> NEW.kode THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Perubahan stok HANYA lewat flag sesi transaksi mutasi (BR-01, E22)
  IF OLD.stok IS DISTINCT FROM NEW.stok THEN
    IF COALESCE(current_setting('app.mutasi_stok', true), '') <> '1' THEN
      RAISE EXCEPTION 'Stok hanya dapat diubah melalui transaksi mutasi';
    END IF;
  END IF;

  -- Perubahan harga_jual atau harga_pokok hanya boleh oleh Manajer (E23)
  -- Catatan: harga_pokok dapat diperbarui secara tidak langsung oleh Gudang saat penerimaan pembelian (app.terima_pembelian = '1')
  IF (OLD.harga_jual IS DISTINCT FROM NEW.harga_jual) THEN
    IF NOT public.fn_is_manajer() THEN
      RAISE EXCEPTION 'Hanya Manajer yang dapat mengubah harga';
    END IF;
  END IF;

  IF (OLD.harga_pokok IS DISTINCT FROM NEW.harga_pokok) THEN
    IF NOT public.fn_is_manajer() AND COALESCE(current_setting('app.terima_pembelian', true), '') <> '1' THEN
      RAISE EXCEPTION 'Hanya Manajer yang dapat mengubah harga';
    END IF;
  END IF;

  NEW.diperbarui_pada := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_barang_guard ON public.barang;
CREATE TRIGGER trg_barang_guard
  BEFORE UPDATE OR DELETE ON public.barang
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_barang();

-- ============================================================
-- 2. Guard Pelanggan (batas_kredit, termin_hari, delete)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_pelanggan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Bypass untuk superuser / seed saat tidak ada sesi JWT pengguna
  IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Staf Penjualan membuat pelanggan: batas_kredit dipaksa 0 (A10), dibuat_oleh dipaksa auth.uid()
    IF NOT public.fn_is_manajer() THEN
      NEW.batas_kredit := 0;
      IF auth.uid() IS NOT NULL THEN
        NEW.dibuat_oleh := auth.uid();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Batas kredit & termin hari hanya boleh diubah oleh Manajer (E24, TC-18)
    IF (OLD.batas_kredit IS DISTINCT FROM NEW.batas_kredit) OR (OLD.termin_hari IS DISTINCT FROM NEW.termin_hari) THEN
      IF NOT public.fn_is_manajer() THEN
        RAISE EXCEPTION 'Hanya Manajer yang dapat mengubah batas kredit atau termin bayar';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pelanggan_guard ON public.pelanggan;
CREATE TRIGGER trg_pelanggan_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.pelanggan
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_pelanggan();

-- ============================================================
-- 3. Guard Profiles (peran, aktif, delete, B20 minimal 1 manajer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Bypass untuk superuser / seed saat tidak ada sesi JWT pengguna
  IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Perubahan peran atau aktif hanya boleh oleh Manajer (E25)
    IF (OLD.peran IS DISTINCT FROM NEW.peran) OR (OLD.aktif IS DISTINCT FROM NEW.aktif) THEN
      IF NOT public.fn_is_manajer() THEN
        RAISE EXCEPTION 'Hanya Manajer yang dapat mengubah peran atau status akun';
      END IF;

      -- B20: Minimal harus ada satu Manajer aktif tersisa (E26)
      IF OLD.peran = 'manajer' AND OLD.aktif = true AND (NEW.peran <> 'manajer' OR NEW.aktif = false) THEN
        IF (SELECT count(*) FROM public.profiles WHERE peran = 'manajer' AND aktif = true AND id <> OLD.id) = 0 THEN
          RAISE EXCEPTION 'Minimal harus ada satu Manajer aktif';
        END IF;
      END IF;
    END IF;

    -- Non-manajer hanya boleh mengubah baris miliknya sendiri
    IF NOT public.fn_is_manajer() AND OLD.id <> auth.uid() THEN
      RAISE EXCEPTION 'Akses ditolak';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard ON public.profiles;
CREATE TRIGGER trg_profiles_guard
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_profiles();

-- ============================================================
-- 4. Guard Pemasok (delete)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_pemasok()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pemasok_guard ON public.pemasok;
CREATE TRIGGER trg_pemasok_guard
  BEFORE DELETE ON public.pemasok
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_pemasok();

-- ============================================================
-- 5. Guard Append-Only (mutasi_stok & audit_log)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Akses ditolak';
END;
$$;

DROP TRIGGER IF EXISTS trg_mutasi_stok_append_only ON public.mutasi_stok;
CREATE TRIGGER trg_mutasi_stok_append_only
  BEFORE UPDATE OR DELETE ON public.mutasi_stok
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_append_only();

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON public.audit_log;
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_append_only();

-- ============================================================
-- 6. Trigger Audit untuk Aksi Sensitif (B19)
-- ============================================================

-- Audit: barang.harga_jual
CREATE OR REPLACE FUNCTION public.fn_audit_barang()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pelaku_id uuid;
BEGIN
  v_pelaku_id := auth.uid();
  IF v_pelaku_id IS NULL THEN
    RETURN NEW; -- Jangan catat jika superuser tanpa sesi user
  END IF;

  IF OLD.harga_jual IS DISTINCT FROM NEW.harga_jual THEN
    INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
    VALUES (
      v_pelaku_id,
      'ubah_harga_jual',
      'barang',
      NEW.id,
      jsonb_build_object('harga_jual', OLD.harga_jual),
      jsonb_build_object('harga_jual', NEW.harga_jual)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_barang ON public.barang;
CREATE TRIGGER trg_audit_barang
  AFTER UPDATE ON public.barang
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_barang();

-- Audit: pelanggan.batas_kredit & termin_hari
CREATE OR REPLACE FUNCTION public.fn_audit_pelanggan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pelaku_id uuid;
BEGIN
  v_pelaku_id := auth.uid();
  IF v_pelaku_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.batas_kredit IS DISTINCT FROM NEW.batas_kredit THEN
    INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
    VALUES (
      v_pelaku_id,
      'ubah_batas_kredit',
      'pelanggan',
      NEW.id,
      jsonb_build_object('batas_kredit', OLD.batas_kredit),
      jsonb_build_object('batas_kredit', NEW.batas_kredit)
    );
  END IF;

  IF OLD.termin_hari IS DISTINCT FROM NEW.termin_hari THEN
    INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
    VALUES (
      v_pelaku_id,
      'ubah_termin_pelanggan',
      'pelanggan',
      NEW.id,
      jsonb_build_object('termin_hari', OLD.termin_hari),
      jsonb_build_object('termin_hari', NEW.termin_hari)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pelanggan ON public.pelanggan;
CREATE TRIGGER trg_audit_pelanggan
  AFTER UPDATE ON public.pelanggan
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_pelanggan();

-- Audit: profiles.peran & aktif
CREATE OR REPLACE FUNCTION public.fn_audit_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pelaku_id uuid;
BEGIN
  v_pelaku_id := auth.uid();
  IF v_pelaku_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.peran IS DISTINCT FROM NEW.peran THEN
    INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
    VALUES (
      v_pelaku_id,
      'ubah_peran',
      'profiles',
      NEW.id,
      jsonb_build_object('peran', OLD.peran),
      jsonb_build_object('peran', NEW.peran)
    );
  END IF;

  IF OLD.aktif IS DISTINCT FROM NEW.aktif THEN
    INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
    VALUES (
      v_pelaku_id,
      'ubah_status_akun',
      'profiles',
      NEW.id,
      jsonb_build_object('aktif', OLD.aktif),
      jsonb_build_object('aktif', NEW.aktif)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_profiles();
