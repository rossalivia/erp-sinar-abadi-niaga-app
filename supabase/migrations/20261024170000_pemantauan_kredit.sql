-- ============================================================
-- Migrasi: Fitur Pemantauan dan Rekomendasi Kredit (PRD 11.2)
-- File: 20261024170000_pemantauan_kredit.sql
-- Sesuai: Keputusan C1 s.d. C13, BR-15 s.d. BR-18
-- ============================================================

-- 1. INDEKS PENDUKUNG KUERI PERFORMA TINGGI (C12)
CREATE INDEX IF NOT EXISTS idx_pesanan_jual_kredit_calc
  ON public.pesanan_jual (pelanggan_id, status, dikirim_pada, dilunasi_pada, jatuh_tempo);

CREATE INDEX IF NOT EXISTS idx_audit_log_pelanggan_limit
  ON public.audit_log (data_id, dibuat_pada DESC)
  WHERE nama_tabel = 'pelanggan' AND aksi = 'ubah_batas_kredit';


-- 2. FUNGSI PARAMETER TERPUSAT: fn_parameter_kredit()
CREATE OR REPLACE FUNCTION public.fn_parameter_kredit()
RETURNS TABLE (
  min_faktur_lunas integer,
  min_lama_pelanggan_hari integer,
  min_hari_jendela integer,
  max_hari_jendela integer,
  bobot_tepat_waktu numeric,
  bobot_keterlambatan numeric,
  hari_toleransi_terlambat numeric,
  bobot_kondisi_sekarang numeric,
  skor_overdue_nol numeric,
  skor_overdue_1_7 numeric,
  skor_overdue_8_30 numeric,
  skor_overdue_gt_30 numeric,
  bobot_kedalaman numeric,
  ambang_kelas_a integer,
  ambang_kelas_b integer,
  ambang_kelas_c integer,
  faktor_kelas_a numeric,
  faktor_kelas_b numeric,
  faktor_kelas_c numeric,
  faktor_kelas_d numeric,
  hari_jeda_eksposur integer,
  faktor_cap_faktur_terbesar numeric,
  faktor_cap_kenaikan_limit numeric,
  kelipatan_pembulatan numeric,
  ambang_penurunan_persen numeric,
  hari_perlu_tinjau integer,
  hari_terlambat_tinjau integer,
  ambang_peringatan_limit numeric,
  faktor_peringatan_kebiasaan numeric,
  min_pesanan_kebiasaan integer
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    3::integer,         -- min_faktur_lunas (C5)
    28::integer,        -- min_lama_pelanggan_hari (C5)
    28::integer,        -- min_hari_jendela (C4)
    90::integer,        -- max_hari_jendela (C4)
    50::numeric,        -- bobot_tepat_waktu (C6)
    20::numeric,        -- bobot_keterlambatan (C6)
    14::numeric,        -- hari_toleransi_terlambat (C6)
    20::numeric,        -- bobot_kondisi_sekarang (C6)
    20::numeric,        -- skor_overdue_nol (C6)
    10::numeric,        -- skor_overdue_1_7 (C6)
    5::numeric,         -- skor_overdue_8_30 (C6)
    0::numeric,         -- skor_overdue_gt_30 (C6)
    10::numeric,        -- bobot_kedalaman (C6)
    85::integer,        -- ambang_kelas_a (C6)
    70::integer,        -- ambang_kelas_b (C6)
    50::integer,        -- ambang_kelas_c (C6)
    1.50::numeric,      -- faktor_kelas_a (C7)
    1.25::numeric,      -- faktor_kelas_b (C7)
    1.00::numeric,      -- faktor_kelas_c (C7)
    0.00::numeric,      -- faktor_kelas_d (C7)
    3::integer,         -- hari_jeda_eksposur (C7)
    3.0::numeric,       -- faktor_cap_faktur_terbesar (C7)
    1.5::numeric,       -- faktor_cap_kenaikan_limit (C7)
    100000::numeric,    -- kelipatan_pembulatan (C7)
    0.50::numeric,      -- ambang_penurunan_persen (C7)
    90::integer,        -- hari_perlu_tinjau (C10)
    180::integer,       -- hari_terlambat_tinjau (C10)
    0.80::numeric,      -- ambang_peringatan_limit (C9)
    3.0::numeric,       -- faktor_peringatan_kebiasaan (C9)
    3::integer;         -- min_pesanan_kebiasaan (C9)
$$;


-- 3. FUNGSI EVALUASI KREDIT PELANGGAN: fn_analisis_kredit_pelanggan(p_pelanggan_id uuid)
CREATE OR REPLACE FUNCTION public.fn_analisis_kredit_pelanggan(p_pelanggan_id uuid)
RETURNS TABLE (
  pelanggan_id              uuid,
  data_cukup                boolean,
  alasan_data_kurang        text,
  faktur_lunas              integer,
  tepat_waktu               integer,
  persen_tepat_waktu        numeric(5,2),
  rata_hari_terlambat       numeric(5,2),
  faktur_overdue_sekarang   integer,
  hari_overdue_terlama      integer,
  lama_pelanggan_hari       integer,
  faktur_lunas_terbesar     numeric(14,0),
  rata_nilai_pesanan        numeric(14,0),
  rata_belanja_per_30_hari  numeric(14,0),
  piutang_berjalan          numeric(14,0),
  pemakaian_limit_persen    numeric(5,2),
  skor_tepat_waktu          numeric(5,2),
  skor_keterlambatan        numeric(5,2),
  skor_kondisi_sekarang     numeric(5,2),
  skor_kedalaman            numeric(5,2),
  skor_total                integer,
  kelas                     text,
  kebutuhan_limit           numeric(14,0),
  rekomendasi_limit         numeric(14,0),
  selisih_limit             numeric(14,0),
  pembatas_mengikat         text,
  status_rekomendasi        text,
  hari_sejak_tinjau_limit   integer,
  status_tinjau             text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_p                     record;
  v_today                 date;
  v_tgl_kirim_pertama     date;
  v_lunas                 record;
  v_aktif                 record;
  v_hari_jendela          integer;
  v_total_belanja_jendela numeric;
  v_terakhir_tinjau       timestamptz;
  v_faktor_kelas          numeric;
  v_hari_eksposur         integer;
  v_kebutuhan             numeric;
  v_cap_faktur            numeric;
  v_cap_kenaikan          numeric;
  v_rekomendasi_mentah    numeric;
BEGIN
  -- 1. Otorisasi Ketat: Hanya Manajer yang boleh mengakses analisis kredit lengkap
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  -- 2. Ambil Profil Pelanggan
  SELECT p.id, p.kode, p.nama_toko, p.batas_kredit, p.termin_hari, p.aktif, p.dibuat_pada
  INTO v_p
  FROM public.pelanggan p
  WHERE p.id = p_pelanggan_id;

  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'E0002: Pelanggan tidak ditemukan';
  END IF;

  pelanggan_id := v_p.id;
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- 3. Hitung Lama Menjadi Pelanggan (sejak pengiriman pertama berstatus dikirim/lunas)
  SELECT MIN((pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date)
  INTO v_tgl_kirim_pertama
  FROM public.pesanan_jual pj
  WHERE pj.pelanggan_id = p_pelanggan_id
    AND pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL;

  lama_pelanggan_hari := COALESCE(v_today - v_tgl_kirim_pertama, 0);

  -- 4. Agregasi Faktur Lunas
  SELECT
    COUNT(*)::integer AS count_lunas,
    COUNT(CASE WHEN (pj.dilunasi_pada AT TIME ZONE 'Asia/Jakarta')::date <= pj.jatuh_tempo THEN 1 END)::integer AS count_tepat,
    COALESCE(AVG(GREATEST(0, (pj.dilunasi_pada AT TIME ZONE 'Asia/Jakarta')::date - pj.jatuh_tempo)), 0)::numeric AS avg_telat,
    COALESCE(MAX(pj.total), 0)::numeric AS max_faktur,
    COALESCE(AVG(pj.total), 0)::numeric AS avg_faktur
  INTO v_lunas
  FROM public.pesanan_jual pj
  WHERE pj.pelanggan_id = p_pelanggan_id
    AND pj.status = 'lunas';

  faktur_lunas := v_lunas.count_lunas;
  tepat_waktu := v_lunas.count_tepat;
  persen_tepat_waktu := CASE WHEN faktur_lunas > 0 THEN ROUND((tepat_waktu::numeric / faktur_lunas::numeric) * 100, 2) ELSE 0.00 END;
  rata_hari_terlambat := ROUND(v_lunas.avg_telat, 2);
  faktur_lunas_terbesar := ROUND(v_lunas.max_faktur);
  rata_nilai_pesanan := ROUND(v_lunas.avg_faktur);

  -- 5. Agregasi Faktur Aktif & Overdue
  SELECT
    COALESCE(SUM(pj.total), 0)::numeric AS sum_aktif,
    COUNT(CASE WHEN pj.jatuh_tempo < v_today THEN 1 END)::integer AS count_overdue,
    COALESCE(MAX(CASE WHEN pj.jatuh_tempo < v_today THEN (v_today - pj.jatuh_tempo) ELSE 0 END), 0)::integer AS max_overdue
  INTO v_aktif
  FROM public.pesanan_jual pj
  WHERE pj.pelanggan_id = p_pelanggan_id
    AND pj.status = 'dikirim';

  piutang_berjalan := ROUND(v_aktif.sum_aktif);
  faktur_overdue_sekarang := v_aktif.count_overdue;
  hari_overdue_terlama := v_aktif.max_overdue;
  pemakaian_limit_persen := CASE WHEN v_p.batas_kredit > 0 THEN ROUND((piutang_berjalan / v_p.batas_kredit) * 100, 2) ELSE 0.00 END;

  -- 6. Jendela Belanja Berkala (28 s.d. 90 hari)
  v_hari_jendela := GREATEST(28, LEAST(90, lama_pelanggan_hari));

  SELECT COALESCE(SUM(pj.total), 0)::numeric
  INTO v_total_belanja_jendela
  FROM public.pesanan_jual pj
  WHERE pj.pelanggan_id = p_pelanggan_id
    AND pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date >= (v_today - v_hari_jendela);

  rata_belanja_per_30_hari := ROUND((v_total_belanja_jendela / v_hari_jendela::numeric) * 30.0);

  -- 7. Status Tinjau Limit (C10)
  SELECT MAX(al.dibuat_pada)
  INTO v_terakhir_tinjau
  FROM public.audit_log al
  WHERE al.nama_tabel = 'pelanggan'
    AND al.data_id = p_pelanggan_id
    AND al.aksi = 'ubah_batas_kredit';

  IF v_terakhir_tinjau IS NULL THEN
    v_terakhir_tinjau := v_p.dibuat_pada;
  END IF;

  hari_sejak_tinjau_limit := (v_today - (v_terakhir_tinjau AT TIME ZONE 'Asia/Jakarta')::date);

  IF NOT v_p.aktif OR v_p.batas_kredit = 0 THEN
    status_tinjau := 'normal';
  ELSIF hari_sejak_tinjau_limit >= 180 THEN
    status_tinjau := 'terlambat';
  ELSIF hari_sejak_tinjau_limit >= 90 THEN
    status_tinjau := 'perlu_tinjau';
  ELSE
    status_tinjau := 'normal';
  END IF;

  -- 8. Evaluasi Kelayakan Data (BR-15 / C5)
  data_cukup := (faktur_lunas >= 3 AND lama_pelanggan_hari >= 28);

  IF NOT data_cukup THEN
    IF faktur_lunas < 3 AND lama_pelanggan_hari < 28 THEN
      alasan_data_kurang := 'Minimal 3 faktur lunas dan 28 hari riwayat belanja';
    ELSIF faktur_lunas < 3 THEN
      alasan_data_kurang := 'Minimal 3 faktur lunas tercapai';
    ELSE
      alasan_data_kurang := 'Minimal 28 hari riwayat belanja sejak kirim pertama';
    END IF;

    kelas := 'Data belum cukup';
    skor_tepat_waktu := NULL;
    skor_keterlambatan := NULL;
    skor_kondisi_sekarang := NULL;
    skor_kedalaman := NULL;
    skor_total := NULL;
    kebutuhan_limit := NULL;
    rekomendasi_limit := NULL;
    selisih_limit := NULL;
    pembatas_mengikat := NULL;
    status_rekomendasi := NULL;

    RETURN NEXT;
    RETURN;
  END IF;

  -- 9. Kalkulasi 4 Pilar Skor (BR-16 / C6)
  alasan_data_kurang := NULL;

  -- Pilar 1: Ketepatan Bayar (Bobot 50)
  skor_tepat_waktu := ROUND((tepat_waktu::numeric / faktur_lunas::numeric) * 50.0, 2);

  -- Pilar 2: Deviasi Keterlambatan (Bobot 20)
  skor_keterlambatan := ROUND(20.0 * (1.0 - LEAST(rata_hari_terlambat, 14.0) / 14.0), 2);

  -- Pilar 3: Kondisi Tagihan Saat Ini (Bobot 20)
  IF hari_overdue_terlama = 0 THEN
    skor_kondisi_sekarang := 20.00;
  ELSIF hari_overdue_terlama <= 7 THEN
    skor_kondisi_sekarang := 10.00;
  ELSIF hari_overdue_terlama <= 30 THEN
    skor_kondisi_sekarang := 5.00;
  ELSE
    skor_kondisi_sekarang := 0.00;
  END IF;

  -- Pilar 4: Kedalaman Riwayat Transaksi (Bobot 10)
  skor_kedalaman := ROUND(10.0 * LEAST(faktur_lunas, 10)::numeric / 10.0, 2);

  -- Skor Total (0–100)
  skor_total := ROUND(skor_tepat_waktu + skor_keterlambatan + skor_kondisi_sekarang + skor_kedalaman);

  -- 10. Penentuan Kelas & Override Risiko (BR-16)
  IF hari_overdue_terlama > 30 THEN
    kelas := 'D'; -- Override mutlak keterlambatan parah
  ELSIF skor_total >= 85 THEN
    kelas := 'A';
  ELSIF skor_total >= 70 THEN
    kelas := 'B';
  ELSIF skor_total >= 50 THEN
    kelas := 'C';
  ELSE
    kelas := 'D';
  END IF;

  -- 11. Perhitungan Rekomendasi Limit & Evaluasi Pembatas (BR-17 / C7)
  v_hari_eksposur := v_p.termin_hari + 3;

  v_faktor_kelas := CASE 
    WHEN kelas = 'A' THEN 1.50
    WHEN kelas = 'B' THEN 1.25
    WHEN kelas = 'C' THEN 1.00
    ELSE 0.00
  END;

  v_kebutuhan := (rata_belanja_per_30_hari / 30.0) * v_hari_eksposur * v_faktor_kelas;
  kebutuhan_limit := ROUND(v_kebutuhan);

  v_cap_faktur := 3.0 * faktur_lunas_terbesar;
  v_cap_kenaikan := CASE WHEN v_p.batas_kredit > 0 THEN 1.5 * v_p.batas_kredit ELSE NULL END;

  IF kelas = 'D' THEN
    -- Kelas D: tidak ada rekomendasi kenaikan limit
    status_rekomendasi := 'Tinjau penurunan';
    pembatas_mengikat := 'Kebijakan Kelas D (Tidak Ada Kenaikan)';
    rekomendasi_limit := v_p.batas_kredit;
    selisih_limit := 0;
  ELSE
    -- Cari pembatas mengikat terendah
    v_rekomendasi_mentah := v_kebutuhan;
    pembatas_mengikat := 'Kebutuhan Riwayat Belanja';

    IF v_cap_faktur < v_rekomendasi_mentah THEN
      v_rekomendasi_mentah := v_cap_faktur;
      pembatas_mengikat := '3x Faktur Lunas Terbesar';
    END IF;

    IF v_cap_kenaikan IS NOT NULL AND v_cap_kenaikan < v_rekomendasi_mentah THEN
      v_rekomendasi_mentah := v_cap_kenaikan;
      pembatas_mengikat := '1,5x Limit Sekarang';
    END IF;

    -- Pembulatan ke bawah ke kelipatan Rp100.000 (C7 / TC-204)
    rekomendasi_limit := FLOOR(v_rekomendasi_mentah / 100000.0) * 100000;
    selisih_limit := rekomendasi_limit - v_p.batas_kredit;

    IF rekomendasi_limit > v_p.batas_kredit THEN
      status_rekomendasi := 'Naikkan';
    ELSIF v_p.batas_kredit > 0 AND rekomendasi_limit < (v_p.batas_kredit * 0.50) THEN
      status_rekomendasi := 'Tinjau penurunan';
    ELSE
      status_rekomendasi := 'Pertahankan';
    END IF;
  END IF;

  RETURN NEXT;
END;
$$;


-- 4. FUNGSI DAFTAR PEMANTAUAN KREDIT: fn_daftar_pemantauan_kredit()
CREATE OR REPLACE FUNCTION public.fn_daftar_pemantauan_kredit()
RETURNS TABLE (
  pelanggan_id              uuid,
  kode                      text,
  nama_toko                 text,
  batas_kredit              numeric(14,0),
  piutang_berjalan          numeric(14,0),
  pemakaian_limit_persen    numeric(5,2),
  hari_overdue_terlama      integer,
  faktur_overdue_sekarang   integer,
  kelas                     text,
  skor_total                integer,
  rekomendasi_limit         numeric(14,0),
  selisih_limit             numeric(14,0),
  pembatas_mengikat         text,
  status_rekomendasi        text,
  hari_sejak_tinjau_limit   integer,
  status_tinjau             text,
  data_cukup                boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Otorisasi: Khusus Manajer
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.batas_kredit,
    ak.piutang_berjalan,
    ak.pemakaian_limit_persen,
    ak.hari_overdue_terlama,
    ak.faktur_overdue_sekarang,
    ak.kelas,
    ak.skor_total,
    ak.rekomendasi_limit,
    ak.selisih_limit,
    ak.pembatas_mengikat,
    ak.status_rekomendasi,
    ak.hari_sejak_tinjau_limit,
    ak.status_tinjau,
    ak.data_cukup
  FROM public.pelanggan p
  CROSS JOIN LATERAL public.fn_analisis_kredit_pelanggan(p.id) ak
  WHERE p.aktif = true
  ORDER BY
    CASE 
      WHEN ak.status_tinjau = 'terlambat' THEN 1 
      WHEN ak.status_tinjau = 'perlu_tinjau' THEN 2 
      ELSE 3 
    END,
    ak.hari_overdue_terlama DESC,
    p.nama_toko ASC;
END;
$$;


-- 5. FUNGSI SIMULASI LIMIT KREDIT: fn_simulasi_limit_kredit()
CREATE OR REPLACE FUNCTION public.fn_simulasi_limit_kredit(
  p_pelanggan_id     uuid,
  p_limit_hipotetik  numeric
)
RETURNS TABLE (
  limit_sekarang              numeric(14,0),
  limit_hipotetik             numeric(14,0),
  piutang_berjalan            numeric(14,0),
  pemakaian_persen_sekarang   numeric(5,2),
  pemakaian_persen_hipotetik  numeric(5,2),
  kebutuhan_rekomendasi       numeric(14,0),
  rekomendasi_resmi           numeric(14,0),
  selisih_terhadap_rekomendasi numeric(14,0),
  total_limit_semua_sebelum   numeric(14,0),
  total_limit_semua_sesudah   numeric(14,0)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_p           record;
  v_ak          record;
  v_total_lama  numeric;
BEGIN
  -- 1. Otorisasi: Khusus Manajer
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  SELECT p.id, p.batas_kredit INTO v_p
  FROM public.pelanggan p
  WHERE p.id = p_pelanggan_id;

  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'E0002: Pelanggan tidak ditemukan';
  END IF;

  SELECT * INTO v_ak FROM public.fn_analisis_kredit_pelanggan(p_pelanggan_id);

  SELECT COALESCE(SUM(batas_kredit), 0) INTO v_total_lama
  FROM public.pelanggan
  WHERE aktif = true;

  limit_sekarang := v_p.batas_kredit;
  limit_hipotetik := ROUND(COALESCE(p_limit_hipotetik, 0));
  piutang_berjalan := v_ak.piutang_berjalan;

  pemakaian_persen_sekarang := CASE 
    WHEN limit_sekarang > 0 THEN ROUND((piutang_berjalan / limit_sekarang) * 100, 2)
    ELSE 0.00
  END;

  pemakaian_persen_hipotetik := CASE 
    WHEN limit_hipotetik > 0 THEN ROUND((piutang_berjalan / limit_hipotetik) * 100, 2)
    ELSE 0.00
  END;

  kebutuhan_rekomendasi := v_ak.kebutuhan_limit;
  rekomendasi_resmi := v_ak.rekomendasi_limit;
  selisih_terhadap_rekomendasi := limit_hipotetik - COALESCE(rekomendasi_resmi, 0);

  total_limit_semua_sebelum := v_total_lama;
  total_limit_semua_sesudah := v_total_lama - limit_sekarang + limit_hipotetik;

  RETURN NEXT;
END;
$$;


-- 6. FUNGSI PERINGATAN EDITOR PESANAN: fn_peringatan_editor_pesanan()
CREATE OR REPLACE FUNCTION public.fn_peringatan_editor_pesanan(
  p_pelanggan_id   uuid,
  p_total_estimasi numeric
)
RETURNS TABLE (
  jenis  text,
  level  text,
  pesan  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran      text;
  v_kr         record;
  v_sisa       numeric;
  v_count_so   integer;
  v_avg_so     numeric;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  -- 1. Evaluasi Mendekati Limit (> 80% sisa kredit)
  SELECT * INTO v_kr FROM public.fn_hitung_kredit_pelanggan(p_pelanggan_id);

  IF v_kr.batas_kredit > 0 THEN
    v_sisa := v_kr.sisa_kredit;
    IF v_sisa > 0 AND p_total_estimasi > (0.80 * v_sisa) THEN
      jenis := 'mendekati_limit';
      level := 'warning';
      pesan := 'Perhatian: Nilai pesanan ini mendekati sisa batas kredit pelanggan.';
      RETURN NEXT;
    END IF;
  END IF;

  -- 2. Evaluasi Di Luar Kebiasaan Belanja (> 3x rata-rata riwayat pesanan selesai/dikirim)
  SELECT 
    COUNT(*)::integer,
    COALESCE(AVG(total), 0)::numeric
  INTO v_count_so, v_avg_so
  FROM public.pesanan_jual
  WHERE pelanggan_id = p_pelanggan_id
    AND status IN ('dikirim', 'lunas');

  IF v_count_so >= 3 AND v_avg_so > 0 AND p_total_estimasi > (3.0 * v_avg_so) THEN
    jenis := 'kebiasaan_belanja';
    level := 'info';
    pesan := 'Informasi: Nilai pesanan ini jauh lebih besar dari rata-rata riwayat belanja pelanggan.';
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;


-- 7. PEMBARUAN rpc_get_tugas_harian() DENGAN COUNTER TINJAU LIMIT KREDIT (C10)
CREATE OR REPLACE FUNCTION public.rpc_get_tugas_harian()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_uid uuid;
  v_today date;
  v_res jsonb;
BEGIN
  v_peran := public.fn_peran();
  v_uid := auth.uid();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  IF v_uid IS NULL OR v_peran IS NULL THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF v_peran = 'penjualan' THEN
    SELECT jsonb_build_object(
      'peran', 'penjualan',
      'draf_saya', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE dibuat_oleh = v_uid AND status = 'draf'
      ), 0),
      'menunggu_kirim_saya', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE dibuat_oleh = v_uid AND status = 'dikonfirmasi'
      ), 0),
      'persetujuan_harga_menunggu_saya', COALESCE((
        SELECT count(*)::int FROM public.persetujuan_harga
        WHERE diajukan_oleh = v_uid AND status = 'menunggu'
      ), 0),
      'tagihan_tempo_hari_ini_saya', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE dibuat_oleh = v_uid AND klasifikasi = 'hari_ini'
      ), 0),
      'tagihan_overdue_saya', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE dibuat_oleh = v_uid AND klasifikasi LIKE 'overdue%'
      ), 0)
    ) INTO v_res;

  ELSIF v_peran = 'gudang' THEN
    SELECT jsonb_build_object(
      'peran', 'gudang',
      'pesanan_siap_kirim', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE status = 'dikonfirmasi'
      ), 0),
      'umur_pesanan_tertua_hari', GREATEST(COALESCE((
        SELECT max(v_today - (dikonfirmasi_pada AT TIME ZONE 'Asia/Jakarta')::date)::int
        FROM public.pesanan_jual
        WHERE status = 'dikonfirmasi' AND dikonfirmasi_pada IS NOT NULL
      ), 0), 0),
      'po_menunggu_penerimaan', COALESCE((
        SELECT count(*)::int FROM public.pembelian
        WHERE status = 'disetujui'
      ), 0),
      'stok_menipis', COALESCE((
        SELECT count(*)::int FROM public.v_barang
        WHERE stok_menipis = true
      ), 0),
      'opname_draf', COALESCE((
        SELECT count(*)::int FROM public.opname_stok
        WHERE status = 'draf'
      ), 0)
    ) INTO v_res;

  ELSIF v_peran = 'manajer' THEN
    SELECT jsonb_build_object(
      'peran', 'manajer',
      'persetujuan_harga_menunggu', COALESCE((
        SELECT count(*)::int FROM public.persetujuan_harga
        WHERE status = 'menunggu'
      ), 0),
      'po_menunggu_persetujuan', COALESCE((
        SELECT count(*)::int FROM public.pembelian
        WHERE status = 'diajukan'
      ), 0),
      'opname_menunggu_persetujuan', COALESCE((
        SELECT count(*)::int FROM public.opname_stok
        WHERE status = 'diajukan'
      ), 0),
      'tagihan_overdue', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE klasifikasi LIKE 'overdue%'
      ), 0),
      'tagihan_tempo_hari_ini', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE klasifikasi = 'hari_ini'
      ), 0),
      'stok_menipis', COALESCE((
        SELECT count(*)::int FROM public.v_barang
        WHERE stok_menipis = true
      ), 0),
      'tinjau_limit_kredit', COALESCE((
        SELECT count(*)::int
        FROM public.pelanggan p
        WHERE p.aktif = true
          AND p.batas_kredit > 0
          AND (v_today - (COALESCE((
            SELECT MAX(al.dibuat_pada)
            FROM public.audit_log al
            WHERE al.nama_tabel = 'pelanggan'
              AND al.data_id = p.id
              AND al.aksi = 'ubah_batas_kredit'
          ), p.dibuat_pada) AT TIME ZONE 'Asia/Jakarta')::date) >= 90
      ), 0)
    ) INTO v_res;
  ELSE
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  RETURN v_res;
END;
$$;


-- 8. PENEGAKAN HAK AKSES DAN KEAMANAN FUNGSI (C1, C8, C9)
REVOKE ALL ON FUNCTION public.fn_parameter_kredit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_parameter_kredit() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_analisis_kredit_pelanggan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_analisis_kredit_pelanggan(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_daftar_pemantauan_kredit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_daftar_pemantauan_kredit() TO authenticated;

REVOKE ALL ON FUNCTION public.fn_simulasi_limit_kredit(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_simulasi_limit_kredit(uuid, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_peringatan_editor_pesanan(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_peringatan_editor_pesanan(uuid, numeric) TO authenticated;
