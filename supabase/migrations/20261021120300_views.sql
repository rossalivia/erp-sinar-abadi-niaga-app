-- ============================================================
-- Migrasi 4: Views (Publik & Manajer)
-- 1. View Publik (security_invoker = true pada PG15+, tanpa kolom rahasia)
--    - v_barang
--    - v_pembelian
--    - v_item_pesanan_jual
--    - v_pelanggan_piutang (dan alias v_piutang_pelanggan)
-- 2. View Manajer (owner rights, WAJIB cek fn_is_manajer())
--    - v_barang_manajer
--    - v_pembelian_manajer
--    - v_item_pesanan_jual_manajer (dan alias v_item_pesanan_manajer)
-- ============================================================

-- ============================================================
-- A. VIEW PUBLIK
-- ============================================================

-- 1. v_barang: tanpa harga_pokok + flag stok_menipis
CREATE OR REPLACE VIEW public.v_barang
AS
SELECT
  b.id,
  b.kode,
  b.nama,
  b.satuan,
  b.harga_jual,
  b.stok,
  b.stok_minimum,
  b.aktif,
  b.diperbarui_pada,
  (b.stok <= b.stok_minimum) AS stok_menipis
FROM public.barang b;

-- 2. v_pembelian: tanpa harga_beli_satuan
CREATE OR REPLACE VIEW public.v_pembelian
AS
SELECT
  p.id,
  p.nomor,
  p.pemasok_id,
  p.barang_id,
  p.jumlah_dipesan,
  p.jumlah_diterima,
  p.status,
  p.alasan_tolak,
  p.diajukan_oleh,
  p.diajukan_pada,
  p.diputuskan_oleh,
  p.diputuskan_pada,
  p.diterima_oleh,
  p.diterima_pada
FROM public.pembelian p;

-- 3. v_item_pesanan_jual: tanpa hpp_satuan
CREATE OR REPLACE VIEW public.v_item_pesanan_jual
AS
SELECT
  ip.id,
  ip.pesanan_jual_id,
  ip.barang_id,
  ip.jumlah,
  ip.harga_satuan,
  ip.diskon_persen,
  ip.subtotal
FROM public.item_pesanan_jual ip;

-- 4. v_pelanggan_piutang: agregat piutang & status lewat jatuh tempo (B5)
CREATE OR REPLACE VIEW public.v_pelanggan_piutang
AS
SELECT
  p.id,
  p.kode,
  p.nama_toko,
  p.telepon,
  p.alamat,
  p.batas_kredit,
  p.termin_hari,
  p.aktif,
  COALESCE(
    (SELECT SUM(pj.total)
     FROM public.pesanan_jual pj
     WHERE pj.pelanggan_id = p.id
       AND pj.status IN ('dikonfirmasi', 'dikirim')
    ), 0
  ) AS piutang_berjalan,
  EXISTS (
    SELECT 1
    FROM public.pesanan_jual pj
    WHERE pj.pelanggan_id = p.id
      AND pj.status = 'dikirim'
      AND pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
  ) AS punya_pesanan_lewat_tempo,
  EXISTS (
    SELECT 1
    FROM public.pesanan_jual pj
    WHERE pj.pelanggan_id = p.id
      AND pj.status = 'dikirim'
      AND pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
  ) AS ada_lewat_jatuh_tempo
FROM public.pelanggan p;

-- Alias v_piutang_pelanggan
CREATE OR REPLACE VIEW public.v_piutang_pelanggan
AS
SELECT * FROM public.v_pelanggan_piutang;

-- Pasang opsi security_invoker = true jika versi PostgreSQL mendukung (PG15+)
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_barang SET (security_invoker = true);
    ALTER VIEW public.v_pembelian SET (security_invoker = true);
    ALTER VIEW public.v_item_pesanan_jual SET (security_invoker = true);
    ALTER VIEW public.v_pelanggan_piutang SET (security_invoker = true);
    ALTER VIEW public.v_piutang_pelanggan SET (security_invoker = true);
  END IF;
END $$;

-- ============================================================
-- B. VIEW MANAJER (Owner rights + filter fn_is_manajer())
-- ============================================================

-- 1. v_barang_manajer: termasuk harga_pokok & peringatan belum diisi (A5)
CREATE OR REPLACE VIEW public.v_barang_manajer
AS
SELECT
  b.id,
  b.kode,
  b.nama,
  b.satuan,
  b.harga_jual,
  b.harga_pokok,
  b.stok,
  b.stok_minimum,
  b.aktif,
  b.diperbarui_pada,
  (b.stok <= b.stok_minimum) AS stok_menipis,
  (b.harga_pokok IS NULL)    AS harga_pokok_belum_diisi
FROM public.barang b
WHERE public.fn_is_manajer() = true;

-- 2. v_pembelian_manajer: termasuk harga_beli_satuan & total beli
CREATE OR REPLACE VIEW public.v_pembelian_manajer
AS
SELECT
  p.id,
  p.nomor,
  p.pemasok_id,
  p.barang_id,
  p.jumlah_dipesan,
  p.jumlah_diterima,
  p.harga_beli_satuan,
  p.status,
  p.alasan_tolak,
  p.diajukan_oleh,
  p.diajukan_pada,
  p.diputuskan_oleh,
  p.diputuskan_pada,
  p.diterima_oleh,
  p.diterima_pada,
  (p.jumlah_dipesan * COALESCE(p.harga_beli_satuan, 0)) AS total_estimasi_beli
FROM public.pembelian p
WHERE public.fn_is_manajer() = true;

-- 3. v_item_pesanan_jual_manajer: termasuk hpp_satuan & margin
CREATE OR REPLACE VIEW public.v_item_pesanan_jual_manajer
AS
SELECT
  ip.id,
  ip.pesanan_jual_id,
  ip.barang_id,
  ip.jumlah,
  ip.harga_satuan,
  ip.diskon_persen,
  ip.subtotal,
  ip.hpp_satuan,
  (ip.subtotal - (COALESCE(ip.hpp_satuan, 0) * ip.jumlah)) AS margin
FROM public.item_pesanan_jual ip
WHERE public.fn_is_manajer() = true;

-- Alias v_item_pesanan_manajer
CREATE OR REPLACE VIEW public.v_item_pesanan_manajer
AS
SELECT * FROM public.v_item_pesanan_jual_manajer;
