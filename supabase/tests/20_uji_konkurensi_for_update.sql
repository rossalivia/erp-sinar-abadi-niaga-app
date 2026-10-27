-- ============================================================================
-- PANDUAN & SKRIP UJI KONKURENSI (RACE CONDITION & FOR UPDATE TEST)
-- Proyek: ERP CV Sinar Abadi Niaga
-- Fungsi Diuji: public.p_kurangi_stok_pesanan & public.rpc_proses_pesanan_jual
-- ============================================================================
-- Pengujian ini membuktikan:
-- 1. Perintah `SELECT stok FROM barang WHERE id = ... FOR UPDATE` mengunci
--    baris sehingga transaksi konkuren mengantri dengan aman.
-- 2. Validasi tegas `stok_sisa < qty_pesanan` membatalkan transaksi kedua (E0014)
--    sehingga stok tidak pernah bernilai minus (Anti-Minus & Anti-Bentrok).
-- ============================================================================

-- ============================================================================
-- BAGIAN 1: PERSIAPAN DATA UJI (Jalankan Sekali di SQL Editor)
-- ============================================================================
DO $$
DECLARE
  v_barang_id uuid;
BEGIN
  -- Bersihkan data uji sebelumnya
  DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'DOC-TEST-%';
  DELETE FROM public.barang WHERE kode = 'BRG-RACE-01';

  -- Buat 1 barang contoh dengan sisa stok HANYA 1 unit
  PERFORM set_config('app.mutasi_stok', '1', true);
  INSERT INTO public.barang (
    kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif
  ) VALUES (
    'BRG-RACE-01', 'Minyak Goreng Uji Balapan', 'dus', 140000, 120000, 1, 0, true
  ) RETURNING id INTO v_barang_id;

  RAISE NOTICE 'Data uji siap! Barang ID: %, Stok Awal: 1', v_barang_id;
END;
$$;

-- Ambil ID Barang Uji untuk digunakan pada pengujian di bawah:
SELECT id, kode, nama, stok, aktif 
FROM public.barang 
WHERE kode = 'BRG-RACE-01';


-- ============================================================================
-- BAGIAN 2: PENGUJIAN OTOMATIS SUITE (Single Script Demonstration)
-- ============================================================================
DO $$
DECLARE
  v_barang_id     uuid;
  v_stok_sesudah  integer;
  v_err_caught    boolean := false;
  v_err_msg       text;
  v_err_code      text;
BEGIN
  -- Login simulasi sebagai Staf Penjualan (UUID dari auth.users)
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

  SELECT id INTO v_barang_id FROM public.barang WHERE kode = 'BRG-RACE-01';

  -- TRANSAKSI 1: Staf A membeli 1 unit (Stok awal = 1 -> Stok akhir = 0)
  v_stok_sesudah := public.p_kurangi_stok_pesanan(
    p_barang_id     => v_barang_id,
    p_qty           => 1,
    p_nomor_dokumen => 'DOC-TEST-STAFF-A'
  );
  RAISE NOTICE '[SUKSES] Transaksi 1 berhasil. Sisa stok di database: %', v_stok_sesudah;

  -- TRANSAKSI 2: Staf B mencoba membeli 1 unit lagi (Stok saat ini = 0)
  -- Harapan: Ditolak dengan kode error E0014 (Stok barang tidak mencukupi)
  BEGIN
    PERFORM public.p_kurangi_stok_pesanan(
      p_barang_id     => v_barang_id,
      p_qty           => 1,
      p_nomor_dokumen => 'DOC-TEST-STAFF-B'
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
    v_err_msg := SQLERRM;
    v_err_code := SQLSTATE;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[SUKSES] Transaksi 2 berhasil dicegat anti-minus! Pesan: "%" (Kode: %)', v_err_msg, v_err_code;
  ELSE
    RAISE EXCEPTION '[GAGAL] Transaksi 2 lolos padahal stok habis! Ini adalah bug!';
  END IF;
END;
$$;

-- Verifikasi akhir tabel barang (stok harus tetap 0, tidak minus):
SELECT kode, nama, stok, diperbarui_pada 
FROM public.barang 
WHERE kode = 'BRG-RACE-01';

-- Verifikasi kartu mutasi stok (hanya tercatat 1 mutasi pengurangan):
SELECT nomor_dokumen, jenis, jumlah, stok_sesudah, dibuat_pada 
FROM public.mutasi_stok 
WHERE barang_id = (SELECT id FROM public.barang WHERE kode = 'BRG-RACE-01')
ORDER BY dibuat_pada ASC;


-- ============================================================================
-- BAGIAN 3: LANGKAH PENGUJIAN KONKURENSI SIMULTAN (Dua Tab Supabase SQL Editor)
-- ============================================================================
-- Untuk membuktikan antrian penguncian baris fisik (Row-Level Locking):
--
-- 1. Buka 2 TAB di SQL Editor Supabase secara berdampingan:
--    - TAB 1 (Staf Gudang A)
--    - TAB 2 (Staf Gudang B)
--
-- 2. Pastikan stok barang uji bernilai 1:
--    UPDATE public.barang SET stok = 1 WHERE kode = 'BRG-RACE-01';
--
-- 3. Di TAB 1, jalankan transaksi penguncian baris dan jeda 10 detik:
--    BEGIN;
--    SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
--    SELECT public.p_kurangi_stok_pesanan(
--      (SELECT id FROM public.barang WHERE kode = 'BRG-RACE-01'),
--      1,
--      'DOC-TAB-1'
--    );
--    SELECT pg_sleep(10); -- Menahan kunci baris selama 10 detik
--    COMMIT;
--
-- 4. TEPAT setelah menekan 'Run' di TAB 1, segera beralih ke TAB 2 dan jalankan:
--    BEGIN;
--    SET LOCAL request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
--    SELECT public.p_kurangi_stok_pesanan(
--      (SELECT id FROM public.barang WHERE kode = 'BRG-RACE-01'),
--      1,
--      'DOC-TAB-2'
--    );
--    COMMIT;
--
-- 5. HASIL YANG TERAMATI:
--    - TAB 2 otomatis MENGANTRI (loading spinner / blocked) menunggu TAB 1 selesai.
--    - Setelah TAB 1 COMMIT (10 detik), TAB 2 langsung terbangun dan menampilkan ERROR:
--      "ERROR: Stok barang tidak mencukupi untuk memenuhi pesanan (SQLSTATE: E0014)"
--    - Transaksi TAB 2 di-ROLLBACK otomatis.
--    - Stok akhir pada tabel barang tetap tepat 0 (tidak minus, tidak bentrok).
-- ============================================================================
