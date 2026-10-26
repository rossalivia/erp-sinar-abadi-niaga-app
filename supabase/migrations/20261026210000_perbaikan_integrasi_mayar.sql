-- ============================================================
-- Migrasi: Perbaikan Integrasi Mayar (PRD 11.3)
-- Timestamp: 20261026210000
-- ============================================================

-- 1. Fungsi Cek Idempotensi Webhook Event Selesai
CREATE OR REPLACE FUNCTION public.rpc_sistem_cek_webhook_event_selesai(
  p_kunci_unik text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mayar_webhook_event
    WHERE kunci_unik = p_kunci_unik
      AND hasil IN ('diproses', 'diabaikan')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sistem_cek_webhook_event_selesai(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_cek_webhook_event_selesai(text) TO service_role;

-- 2. Fungsi Transaksional Pelunasan Otomatis dari Mayar
CREATE OR REPLACE FUNCTION public.rpc_sistem_lunaskan_dari_mayar(
  p_tagihan_id uuid,
  p_referensi_transaksi text,
  p_jumlah_terverifikasi numeric,
  p_kunci_unik text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tagihan record;
  v_pesanan record;
  v_anomali text := NULL;
  v_round_verified numeric;
  v_round_tagihan numeric;
  v_round_pesanan numeric;
BEGIN
  -- Ambil data tagihan awal
  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id;

  IF v_tagihan.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'tidak_ditemukan',
      'message', 'Tagihan Mayar tidak ditemukan di basis data'
    );
  END IF;

  -- URUTAN PENGUNCIAN BARIS ANTI-DEADLOCK (AGENTS.md 8.1):
  -- 1. Kunci pesanan_jual terlebih dahulu
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = v_tagihan.pesanan_jual_id
  FOR UPDATE;

  -- 2. Kunci tagihan_mayar kedua
  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id
  FOR UPDATE;

  -- Pembulatan ke bilangan bulat Rupiah (sesuai spesifikasi)
  v_round_verified := round(COALESCE(p_jumlah_terverifikasi, 0));
  v_round_tagihan  := round(COALESCE(v_tagihan.jumlah, 0));
  v_round_pesanan  := round(COALESCE(v_pesanan.total, 0));

  -- Validasi Syarat Pelunasan Otomatis
  IF v_pesanan.status = 'lunas' THEN
    v_anomali := 'Pesanan sudah berstatus lunas (potensi pembayaran ganda)';
  ELSIF v_pesanan.status <> 'dikirim' THEN
    v_anomali := 'Status pesanan bukan dikirim (status saat ini: ' || v_pesanan.status || ')';
  ELSIF v_tagihan.status <> 'dibuat' AND v_tagihan.status <> 'kedaluwarsa' THEN
    v_anomali := 'Status tagihan bukan dibuat atau kedaluwarsa (status saat ini: ' || v_tagihan.status || ')';
  ELSIF v_round_verified <> v_round_tagihan OR v_round_verified <> v_round_pesanan THEN
    v_anomali := 'Nominal terverifikasi (' || v_round_verified || ') tidak sesuai dengan tagihan (' || v_round_tagihan || ') atau total pesanan (' || v_round_pesanan || ')';
  END IF;

  -- JIKA ADA ANOMALI:
  IF v_anomali IS NOT NULL THEN
    -- Update tagihan menjadi perlu_tinjau
    UPDATE public.tagihan_mayar
    SET status = 'perlu_tinjau',
        catatan_tinjau = v_anomali,
        mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
        diperbarui_pada = now()
    WHERE id = p_tagihan_id;

    -- Catat audit log anomali
    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      NULL,
      'anomali_pembayaran_mayar',
      'tagihan_mayar',
      p_tagihan_id,
      jsonb_build_object('status', v_tagihan.status),
      jsonb_build_object(
        'status', 'perlu_tinjau',
        'anomali', v_anomali,
        'referensi', p_referensi_transaksi,
        'jumlah_diterima', v_round_verified
      )
    );

    -- Tandai event selesai/diabaikan jika ada kunci unik agar tidak berulang
    IF p_kunci_unik IS NOT NULL THEN
      INSERT INTO public.mayar_webhook_event (
        kunci_unik, jenis_event, referensi_id, hasil, status_mayar, jumlah_tercatat, dibuat_pada
      )
      VALUES (
        p_kunci_unik, 'payment.received', v_tagihan.mayar_invoice_id, 'diabaikan', 'perlu_tinjau', v_round_verified, now()
      )
      ON CONFLICT (kunci_unik) DO UPDATE SET
        hasil = 'diabaikan',
        status_mayar = 'perlu_tinjau';
    END IF;

    -- Pesanan TIDAK diubah
    RETURN jsonb_build_object(
      'success', false,
      'status', 'perlu_tinjau',
      'message', v_anomali
    );
  END IF;

  -- JIKA SUKSES (LUNAS):
  -- 1. Update pesanan_jual
  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = now()
  WHERE id = v_pesanan.id;

  -- 2. Update tagihan_mayar
  UPDATE public.tagihan_mayar
  SET status = 'dibayar',
      dibayar_pada = now(),
      mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
      diperbarui_pada = now()
  WHERE id = p_tagihan_id;

  -- 3. Catat audit_log dengan aksi 'pelunasan' (pelaku NULL = Sistem Mayar)
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    NULL,
    'pelunasan',
    'pesanan_jual',
    v_pesanan.id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object(
      'status', 'lunas',
      'metode', 'mayar',
      'keterangan', 'Pelunasan via Mayar',
      'tagihan_id', p_tagihan_id,
      'referensi', p_referensi_transaksi,
      'jumlah', v_round_verified
    )
  );

  -- 4. Tandai kunci webhook event sebagai diproses dalam transaksi yang sama
  IF p_kunci_unik IS NOT NULL THEN
    INSERT INTO public.mayar_webhook_event (
      kunci_unik, jenis_event, referensi_id, hasil, status_mayar, jumlah_tercatat, dibuat_pada
    )
    VALUES (
      p_kunci_unik, 'payment.received', v_tagihan.mayar_invoice_id, 'diproses', 'paid', v_round_verified, now()
    )
    ON CONFLICT (kunci_unik) DO UPDATE SET
      hasil = 'diproses',
      status_mayar = 'paid';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'lunas',
    'message', 'Pesanan berhasil dilunasi via Mayar'
  );
END;
$$;

-- Cabut hak akses dari publik dan authenticated, berikan HANYA ke service_role
REVOKE ALL ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric, text) TO service_role;
