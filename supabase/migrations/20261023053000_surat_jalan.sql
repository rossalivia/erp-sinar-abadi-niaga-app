-- ============================================================
-- Migrasi: Cetak Surat Jalan (PRD 11.2)
-- Berkas: 20261023053000_surat_jalan.sql
-- Sesuai: docs/fitur-surat-jalan.md & S1 s.d. S6
-- Zero-Leakage: Tidak ada kolom harga, subtotal, diskon, total, HPP, margin, termin, jatuh tempo
-- ============================================================

-- 1. View Header: public.v_surat_jalan
-- Hanya untuk pesanan berstatus 'dikirim'
-- Hanya dapat diakses oleh Manajer, Gudang, atau Penjualan pemilik pesanan
CREATE OR REPLACE VIEW public.v_surat_jalan
AS
SELECT
  pj.id,
  pj.nomor,
  pj.status,
  pj.dibuat_oleh,
  pj.dibuat_pada,
  pj.dikirim_pada,
  NULL::text AS catatan,
  -- Data Pelanggan (HANYA kolom non-uang)
  p.id AS pelanggan_id,
  p.kode AS pelanggan_kode,
  p.nama_toko AS pelanggan_nama,
  p.telepon AS pelanggan_telepon,
  p.alamat AS pelanggan_alamat,
  -- Data Pembuat / Sales (HANYA nama)
  pr.nama_lengkap AS pembuat_nama
FROM public.pesanan_jual pj
JOIN public.pelanggan p ON p.id = pj.pelanggan_id
LEFT JOIN public.profiles pr ON pr.id = pj.dibuat_oleh
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- 2. View Items: public.v_surat_jalan_item
-- Hanya untuk item pada pesanan berstatus 'dikirim'
-- Hanya memuat kode, nama, satuan, dan kuantitas fisik
CREATE OR REPLACE VIEW public.v_surat_jalan_item
AS
SELECT
  ip.id,
  ip.pesanan_jual_id,
  ip.barang_id,
  b.kode AS kode_barang,
  b.nama AS nama_barang,
  b.satuan,
  ip.jumlah
FROM public.item_pesanan_jual ip
JOIN public.barang b ON b.id = ip.barang_id
JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- 3. Set security_invoker = true pada PostgreSQL 15+ jika didukung
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_surat_jalan SET (security_invoker = true);
    ALTER VIEW public.v_surat_jalan_item SET (security_invoker = true);
  END IF;
END $$;

-- 4. Hak Akses: Cabut dari anon & PUBLIC, berikan SELECT ke authenticated
REVOKE ALL ON public.v_surat_jalan FROM anon, PUBLIC;
GRANT SELECT ON public.v_surat_jalan TO authenticated;

REVOKE ALL ON public.v_surat_jalan_item FROM anon, PUBLIC;
GRANT SELECT ON public.v_surat_jalan_item TO authenticated;
