-- ============================================================
-- Migrasi 6: Row-Level Security (RLS) pada 9 Tabel
-- Sesuai docs/02-matriks-akses.md
-- ============================================================

-- Aktifkan RLS pada seluruh tabel
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemasok           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelanggan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barang            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pembelian         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesanan_jual      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_pesanan_jual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutasi_stok       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1. profiles
-- SELECT: semua authenticated (untuk nama pelaku)
-- UPDATE: hanya baris sendiri (kolom peran & aktif dijaga trigger)
-- ============================================================
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. pemasok
-- Penjualan: tidak bisa baca/tulis
-- Gudang & Manajer: baca & tulis
-- ============================================================
CREATE POLICY "pemasok_select_gudang_manajer"
  ON public.pemasok FOR SELECT
  TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'));

CREATE POLICY "pemasok_insert_gudang_manajer"
  ON public.pemasok FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_peran() IN ('gudang', 'manajer'));

CREATE POLICY "pemasok_update_gudang_manajer"
  ON public.pemasok FOR UPDATE
  TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'))
  WITH CHECK (public.fn_peran() IN ('gudang', 'manajer'));

-- ============================================================
-- 3. pelanggan
-- SELECT: Penjualan, Gudang, Manajer
-- INSERT/UPDATE: Penjualan & Manajer (Gudang hanya baca)
-- ============================================================
CREATE POLICY "pelanggan_select_all_roles"
  ON public.pelanggan FOR SELECT
  TO authenticated
  USING (public.fn_peran() IN ('penjualan', 'gudang', 'manajer'));

CREATE POLICY "pelanggan_insert_penjualan_manajer"
  ON public.pelanggan FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_peran() IN ('penjualan', 'manajer'));

CREATE POLICY "pelanggan_update_penjualan_manajer"
  ON public.pelanggan FOR UPDATE
  TO authenticated
  USING (public.fn_peran() IN ('penjualan', 'manajer'))
  WITH CHECK (public.fn_peran() IN ('penjualan', 'manajer'));

-- ============================================================
-- 4. barang
-- SELECT: Penjualan, Gudang, Manajer
-- UPDATE: Gudang & Manajer (Penjualan ditolak via RLS)
-- ============================================================
CREATE POLICY "barang_select_all_roles"
  ON public.barang FOR SELECT
  TO authenticated
  USING (public.fn_peran() IN ('penjualan', 'gudang', 'manajer'));

CREATE POLICY "barang_update_gudang_manajer"
  ON public.barang FOR UPDATE
  TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'))
  WITH CHECK (public.fn_peran() IN ('gudang', 'manajer'));

-- ============================================================
-- 5. pembelian
-- SELECT: Gudang & Manajer (Penjualan 0 baris)
-- ============================================================
CREATE POLICY "pembelian_select_gudang_manajer"
  ON public.pembelian FOR SELECT
  TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'));

-- ============================================================
-- 6. pesanan_jual
-- Penjualan: hanya pesanan buatannya
-- Gudang: pesanan non-draf
-- Manajer: semua pesanan
-- ============================================================
CREATE POLICY "pesanan_jual_select"
  ON public.pesanan_jual FOR SELECT
  TO authenticated
  USING (
    public.fn_peran() = 'manajer'
    OR (public.fn_peran() = 'penjualan' AND dibuat_oleh = auth.uid())
    OR (public.fn_peran() = 'gudang' AND status <> 'draf')
  );

-- ============================================================
-- 7. item_pesanan_jual
-- Mengikuti visibilitas pesanan_jual induk
-- ============================================================
CREATE POLICY "item_pesanan_jual_select"
  ON public.item_pesanan_jual FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pesanan_jual pj
      WHERE pj.id = item_pesanan_jual.pesanan_jual_id
    )
  );

-- ============================================================
-- 8. mutasi_stok
-- SELECT: semua peran (tidak ada data rahasia)
-- ============================================================
CREATE POLICY "mutasi_stok_select_all_roles"
  ON public.mutasi_stok FOR SELECT
  TO authenticated
  USING (public.fn_peran() IN ('penjualan', 'gudang', 'manajer'));

-- ============================================================
-- 9. audit_log
-- SELECT: HANYA Manajer (Penjualan & Gudang 0 baris)
-- ============================================================
CREATE POLICY "audit_log_select_manajer_only"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer() = true);
