-- ============================================================
-- MIGRASI: Perketat Aturan Diskon dan Penegasan BR-04 Persetujuan Harga
-- Berkas: supabase/migrations/20261026220000_perketat_diskon_dan_br04.sql
-- Sesuai:
-- 1. rpc_konfirmasi_pesanan oleh Staf Penjualan SELALU ditolak jika subtotal < hpp * jumlah
--    dengan pesan persis "Harga di bawah batas, minta persetujuan Manajer" (E0011).
--    Staf tidak boleh mengonfirmasi pesanan meskipun tiketnya disetujui. Konfirmasi dilakukan oleh Manajer.
-- 2. Diskon: database MENOLAK keras (bukan clamp) diskon > 10% untuk Staf Penjualan (E0009)
--    dan diskon > 25% untuk semua peran (E0010).
-- 3. Konfirmasi oleh Staf Penjualan ditolak jika ada baris diskon > 10% (mencegah draf diedit Manajer
--    lalu dikonfirmasi staf).
-- 4. zero-leakage: respons dan view tiket untuk staf tidak memuat hpp/margin.
-- ============================================================

-- 1. PEMBARUAN: rpc_simpan_draf_pesanan (Penolakan Keras Batas Diskon Tanpa Clamp)
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items jsonb,
  p_pesanan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran         text;
  v_pesanan_id    uuid;
  v_nomor         text;
  v_item_count    integer;
  v_item          jsonb;
  v_barang_id     uuid;
  v_barang_ids    uuid[] := '{}';
  v_jumlah        integer;
  v_diskon        numeric;
  v_harga_satuan  numeric;
  v_barang_aktif  boolean;
  v_subtotal      numeric;
  v_total         numeric := 0;
  v_pelanggan_ada boolean;
  v_pelanggan_aktif boolean;
  v_pesanan_status text;
  v_pesanan_pembuat uuid;
BEGIN
  -- Periksa peran pemanggil: hanya staf penjualan dan manajer
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi pelanggan ada & aktif (BR-01, E07)
  SELECT true, aktif INTO v_pelanggan_ada, v_pelanggan_aktif
  FROM public.pelanggan WHERE id = p_pelanggan_id;

  IF v_pelanggan_ada IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 (BR-02, E03)
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Update draf eksisting vs Insert draf baru
  IF p_pesanan_id IS NOT NULL THEN
    -- P9 Urutan Kunci 1: pesanan_jual FOR UPDATE
    SELECT status, dibuat_oleh, nomor INTO v_pesanan_status, v_pesanan_pembuat, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

    IF v_pesanan_status IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi wewenang edit
    IF v_peran = 'penjualan' AND v_pesanan_pembuat <> auth.uid() THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    IF v_pesanan_status <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    v_pesanan_id := p_pesanan_id;

    UPDATE public.pesanan_jual
    SET pelanggan_id = p_pelanggan_id
    WHERE id = v_pesanan_id;

    -- Jika draf diubah, batalkan pengajuan persetujuan harga yang sedang aktif
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = v_pesanan_id
      AND status IN ('menunggu', 'disetujui');
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN
    v_nomor := format(
      'SO-%s-%s',
      to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
      lpad(nextval('public.seq_pesanan_jual')::text, 6, '0')
    );

    INSERT INTO public.pesanan_jual (
      nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_nomor, p_pelanggan_id, 'draf', 0, auth.uid(), now()
    )
    RETURNING id INTO v_pesanan_id;
  END IF;

  -- Hapus item lama terlebih dahulu untuk penggantian bersih
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id = v_pesanan_id;

  -- Iterasi & validasi item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_barang_id := (v_item->>'barang_id')::uuid;
    v_jumlah    := COALESCE((v_item->>'jumlah')::integer, 0);
    v_diskon    := COALESCE((v_item->>'diskon_persen')::numeric, 0);

    -- BR-02: jumlah >= 1
    IF v_jumlah < 1 THEN
      RAISE EXCEPTION 'Jumlah minimal 1' USING ERRCODE = 'E0004';
    END IF;

    -- BR-02: barang unik per pesanan
    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'Barang sudah ada di pesanan ini' USING ERRCODE = 'E0005';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    -- Cek keberadaan & keaktifan barang
    SELECT harga_jual, aktif INTO v_harga_satuan, v_barang_aktif
    FROM public.barang WHERE id = v_barang_id;

    IF v_harga_satuan IS NULL OR v_barang_aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- BR-03: Batas diskon per peran (DITOLAK KERAS TANPA CLAMP DIAM-DIAM)
    IF v_peran = 'penjualan' THEN
      IF v_diskon < 0 OR v_diskon > 10 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
      END IF;
    ELSE -- manajer
      IF v_diskon < 0 OR v_diskon > 25 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
      END IF;
    END IF;

    -- BR-03: Subtotal = ROUND(jumlah * harga_satuan * (100 - diskon) / 100)
    v_subtotal := round(v_jumlah * v_harga_satuan * (100.0 - v_diskon) / 100.0);
    v_total    := v_total + v_subtotal;

    INSERT INTO public.item_pesanan_jual (
      pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
    )
    VALUES (
      v_pesanan_id, v_barang_id, v_jumlah, v_harga_satuan, v_diskon, v_subtotal
    );
  END LOOP;

  -- Perbarui total pesanan
  UPDATE public.pesanan_jual SET total = v_total WHERE id = v_pesanan_id;

  RETURN jsonb_build_object(
    'id',    v_pesanan_id,
    'nomor', v_nomor,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) TO authenticated;

-- 2. PEMBARUAN: rpc_konfirmasi_pesanan (Penegasan BR-04 & Wewenang Manajer)
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran                 text;
  v_pesanan               record;
  v_persetujuan           record;
  v_pelanggan             record;
  v_item_count            integer;
  v_item                  record;
  v_stok_sesudah          integer;
  v_kredit                record;
  v_ada_bawah_hpp         boolean := false;
  v_current_hash          text;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- P9 Urutan Kunci 1: pesanan_jual FOR UPDATE
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pesanan.dibuat_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- P9 Urutan Kunci 2: persetujuan_harga FOR UPDATE (jika ada yang aktif)
  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE pesanan_jual_id = p_pesanan_id
    AND status IN ('menunggu', 'disetujui')
  ORDER BY diajukan_pada DESC
  LIMIT 1
  FOR UPDATE;

  -- Validasi jumlah baris 1 s.d. 20 (BR-02, E03)
  SELECT count(*) INTO v_item_count
  FROM public.item_pesanan_jual
  WHERE pesanan_jual_id = p_pesanan_id;

  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- P9 Urutan Kunci 3: pelanggan FOR UPDATE
  SELECT * INTO v_pelanggan
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id
  FOR UPDATE;

  IF v_pelanggan.id IS NULL OR v_pelanggan.aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- P9 Urutan Kunci 4: barang FOR UPDATE ORDER BY id (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Validasi keaktifan setiap barang, diskon, dan deteksi baris di bawah HPP
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok, b.aktif
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- Validasi diskon Staf Penjualan (mencegah draf yang diedit Manajer dikonfirmasi staf)
    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    -- Validasi diskon maksimal semua peran (25%)
    IF v_item.diskon_persen > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;

    -- Deteksi baris di bawah HPP (COALESCE NULL = 0 per A5)
    IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
      v_ada_bawah_hpp := true;
    END IF;
  END LOOP;

  -- PENEGASAN MUTLAK BR-04 UNTUK STAF PENJUALAN:
  -- Staf Penjualan SELALU DITOLAK bila ada baris di bawah HPP dengan pesan persis
  -- "Harga di bawah batas, minta persetujuan Manajer" (E0011).
  -- Tiket persetujuan hanya permintaan ke Manajer; setelah disetujui, yang mengonfirmasi tetap Manajer.
  -- Staf tidak boleh mengonfirmasi pesanan yang tiketnya disetujui.
  IF v_peran = 'penjualan' AND v_ada_bawah_hpp THEN
    RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
  END IF;

  -- Hitung kredit dan overdue pelanggan
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- Prioritas Overdue diperiksa terlebih dahulu (E0013)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- Plafon Kredit diperiksa berikutnya (E0012)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui'
      USING ERRCODE = 'E0012';
  END IF;

  -- Validasi kecukupan stok seluruh item (BR-02, E14)
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok barang tidak mencukupi untuk memenuhi pesanan'
        USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- Eksekusi pengurangan stok, mutasi stok, dan HPP snapshot
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    UPDATE public.barang
    SET stok = stok - v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id,
      'pesanan',
      -v_item.jumlah,
      v_stok_sesudah,
      v_pesanan.nomor,
      auth.uid(),
      now()
    );

    UPDATE public.item_pesanan_jual
    SET hpp_satuan = v_item.harga_pokok
    WHERE id = v_item.id;
  END LOOP;

  -- Jika dikonfirmasi oleh Manajer dan memiliki tiket persetujuan aktif, tandai terpakai
  IF v_persetujuan.id IS NOT NULL THEN
    UPDATE public.persetujuan_harga
    SET status = 'terpakai',
        dipakai_pada = now()
    WHERE id = v_persetujuan.id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'pakai_persetujuan_harga',
      'persetujuan_harga',
      v_persetujuan.id,
      jsonb_build_object('status', v_persetujuan.status),
      jsonb_build_object('status', 'terpakai', 'pesanan_jual_id', p_pesanan_id)
    );
  END IF;

  -- Update status pesanan ke dikonfirmasi
  UPDATE public.pesanan_jual
  SET status = 'dikonfirmasi',
      dikonfirmasi_pada = now()
  WHERE id = p_pesanan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'konfirmasi',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'dikonfirmasi', 'total', v_pesanan.total)
  );

  RETURN jsonb_build_object(
    'id',    p_pesanan_id,
    'nomor', v_pesanan.nomor,
    'status', 'dikonfirmasi',
    'total', v_pesanan.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) TO authenticated;
