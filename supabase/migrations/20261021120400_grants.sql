-- ============================================================
-- Migrasi 5: Column-Level Grants & Revokes
-- 1. Cabut semua hak akses default dari anon dan authenticated pada 9 tabel
-- 2. Grant SELECT hanya pada kolom non-rahasia
-- 3. Batasi hak tulis transaksi (hanya lewat RPC di Tahap 3)
-- 4. Hak akses view dan sequence
-- ============================================================

-- ============================================================
-- 1. REVOKE ALL dari anon, authenticated, dan PUBLIC
-- ============================================================
REVOKE ALL ON TABLE public.profiles          FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.pemasok           FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.pelanggan         FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.barang            FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.pembelian         FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.pesanan_jual      FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.item_pesanan_jual FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.mutasi_stok       FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.audit_log         FROM anon, authenticated, PUBLIC;

-- ============================================================
-- 2. GRANT SELECT per kolom ke role authenticated
-- ============================================================

-- profiles: tanpa batasan rahasia
GRANT SELECT (id, nama_lengkap, peran, aktif, dibuat_pada)
  ON public.profiles TO authenticated;
GRANT UPDATE (nama_lengkap)
  ON public.profiles TO authenticated;

-- pemasok: master data
GRANT SELECT (id, kode, nama, telepon, alamat, aktif, dibuat_pada)
  ON public.pemasok TO authenticated;
GRANT INSERT (id, kode, nama, telepon, alamat, aktif, dibuat_pada)
  ON public.pemasok TO authenticated;
GRANT UPDATE (kode, nama, telepon, alamat, aktif)
  ON public.pemasok TO authenticated;

-- pelanggan: master data
GRANT SELECT (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh, dibuat_pada)
  ON public.pelanggan TO authenticated;
GRANT INSERT (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh, dibuat_pada)
  ON public.pelanggan TO authenticated;
GRANT UPDATE (kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif)
  ON public.pelanggan TO authenticated;

-- barang: kolom harga_pokok RAHASIA (TIDAK di-grant)
-- kolom stok & kode TIDAK di-grant UPDATE (hanya mutasi)
GRANT SELECT (id, kode, nama, satuan, harga_jual, stok, stok_minimum, aktif, diperbarui_pada)
  ON public.barang TO authenticated;
GRANT UPDATE (nama, satuan, harga_jual, stok_minimum, aktif, diperbarui_pada)
  ON public.barang TO authenticated;

-- pembelian: kolom harga_beli_satuan RAHASIA (TIDAK di-grant)
-- Tidak ada hak INSERT/UPDATE langsung (semua via RPC Tahap 3)
GRANT SELECT (id, nomor, pemasok_id, barang_id, jumlah_dipesan, jumlah_diterima, status, alasan_tolak, diajukan_oleh, diajukan_pada, diputuskan_oleh, diputuskan_pada, diterima_oleh, diterima_pada)
  ON public.pembelian TO authenticated;

-- pesanan_jual: tidak ada kolom rahasia, transaksi hanya via RPC
GRANT SELECT (id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo, dilunasi_pada, dibatalkan_pada, alasan_batal)
  ON public.pesanan_jual TO authenticated;

-- item_pesanan_jual: kolom hpp_satuan RAHASIA (TIDAK di-grant)
GRANT SELECT (id, pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  ON public.item_pesanan_jual TO authenticated;

-- mutasi_stok: append-only, hanya dibaca
GRANT SELECT (id, barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada)
  ON public.mutasi_stok TO authenticated;

-- audit_log: append-only, dibaca manajer via RLS
GRANT SELECT (id, pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada)
  ON public.audit_log TO authenticated;

-- ============================================================
-- 3. GRANT pada Views
-- ============================================================
REVOKE ALL ON public.v_barang                   FROM anon, PUBLIC;
REVOKE ALL ON public.v_pembelian                FROM anon, PUBLIC;
REVOKE ALL ON public.v_item_pesanan_jual        FROM anon, PUBLIC;
REVOKE ALL ON public.v_pelanggan_piutang        FROM anon, PUBLIC;
REVOKE ALL ON public.v_piutang_pelanggan        FROM anon, PUBLIC;
REVOKE ALL ON public.v_barang_manajer           FROM anon, PUBLIC;
REVOKE ALL ON public.v_pembelian_manajer        FROM anon, PUBLIC;
REVOKE ALL ON public.v_item_pesanan_jual_manajer FROM anon, PUBLIC;
REVOKE ALL ON public.v_item_pesanan_manajer     FROM anon, PUBLIC;

GRANT SELECT ON public.v_barang                   TO authenticated;
GRANT SELECT ON public.v_pembelian                TO authenticated;
GRANT SELECT ON public.v_item_pesanan_jual        TO authenticated;
GRANT SELECT ON public.v_pelanggan_piutang        TO authenticated;
GRANT SELECT ON public.v_piutang_pelanggan        TO authenticated;
GRANT SELECT ON public.v_barang_manajer           TO authenticated;
GRANT SELECT ON public.v_pembelian_manajer        TO authenticated;
GRANT SELECT ON public.v_item_pesanan_jual_manajer TO authenticated;
GRANT SELECT ON public.v_item_pesanan_manajer     TO authenticated;

-- ============================================================
-- 4. GRANT pada Sequences
-- ============================================================
GRANT USAGE, SELECT ON SEQUENCE public.seq_pesanan_jual TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_pembelian     TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_penyesuaian   TO authenticated;
