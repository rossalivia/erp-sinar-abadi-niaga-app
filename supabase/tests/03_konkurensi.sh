#!/usr/bin/env bash
# ============================================================
# 03_konkurensi.sh: Uji Konkurensi & Balapan Transaksi ERP
# ============================================================
# Skenario 1: Dua pesanan berebut stok sisa 1 (Tepat 1 berhasil, stok akhir 0, tidak minus)
# Skenario 2: Dua pesanan melampaui batas kredit jika digabung (Tepat 1 berhasil)
# Skenario 3: Dua pesanan dengan urutan item terbalik (Bebas deadlock karena ORDER BY id)
# Setiap skenario dijalankan minimal 20 iterasi berulang.
# ============================================================

set -e

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-erp_sinar_abadi}"
export PGPASSWORD="${PGPASSWORD:-admin}"

if command -v psql >/dev/null 2>&1; then
  PSQL_CMD="psql"
elif [ -f "/c/Program Files/PostgreSQL/13/bin/psql.exe" ]; then
  PSQL_CMD="/c/Program Files/PostgreSQL/13/bin/psql.exe"
elif [ -f "C:/Program Files/PostgreSQL/13/bin/psql.exe" ]; then
  PSQL_CMD="C:/Program Files/PostgreSQL/13/bin/psql.exe"
else
  echo "Error: psql binary tidak ditemukan!" >&2
  exit 1
fi

run_psql() {
  "$PSQL_CMD" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q -X -t -A "$@"
}

echo "============================================================"
echo "MEMULAI PENGUJIAN KONKURENSI ERP CV SINAR ABADI NIAGA"
echo "Koneksi: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
echo "============================================================"

run_psql -c "SELECT 1;" >/dev/null

TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'erp_konk')
OUT_A="$TMP_DIR/out_a.txt"
OUT_B="$TMP_DIR/out_b.txt"

cleanup() {
  run_psql -c "
    DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
      SELECT id FROM public.pesanan_jual WHERE nomor LIKE 'SO-K%'
    );
    DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'SO-K%';
    DELETE FROM public.pesanan_jual WHERE nomor LIKE 'SO-K%';
    DELETE FROM public.barang WHERE kode IN ('K-STOK-1', 'K-KREDIT-1', 'K-DEAD-X', 'K-DEAD-Y');
    DELETE FROM public.pelanggan WHERE kode IN ('C-KONK-1', 'C-KONK-2', 'C-KONK-3');
  " >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# ============================================================
# SKENARIO 1: Dua Pesanan Berebut Stok Sisa 1
# ============================================================
echo ""
echo "------------------------------------------------------------"
echo "SKENARIO 1: Perebutan Stok Sisa 1 (20 Iterasi)"
echo "Target: Tepat 1 SUKSES, Tepat 1 GAGAL (Stok tidak cukup), Stok akhir = 0"
echo "------------------------------------------------------------"

S1_PASS=0
for i in $(seq 1 20); do
  SETUP_SQL=$(cat <<SQL
DO \$\$
DECLARE
  v_bid uuid;
  v_pid uuid;
  v_p1  uuid;
  v_p2  uuid;
BEGIN
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
    SELECT id FROM public.pesanan_jual WHERE nomor LIKE 'SO-K1-%'
  );
  DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'SO-K1-%';
  DELETE FROM public.pesanan_jual WHERE nomor LIKE 'SO-K1-%';
  DELETE FROM public.barang WHERE kode = 'K-STOK-1';
  DELETE FROM public.pelanggan WHERE kode = 'C-KONK-1';

  PERFORM set_config('app.mutasi_stok', '1', true);
  INSERT INTO public.barang (kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
  VALUES ('K-STOK-1', 'Item Rebutan Stok', 'PCS', 50000, 20000, 1, 0, true)
  RETURNING id INTO v_bid;

  INSERT INTO public.pelanggan (kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh)
  VALUES ('C-KONK-1', 'Pelanggan Rebutan', '0811', 'Jl. Test', 10000000, 30, true, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_pid;

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K1-A-' || '$i', v_pid, 'draf', 50000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bid, 1, 50000, 0, 50000);

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K1-B-' || '$i', v_pid, 'draf', 50000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bid, 1, 50000, 0, 50000);
END \$\$;
SQL
)
  run_psql -c "$SETUP_SQL"

  P1=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K1-A-$i';")
  P2=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K1-B-$i';")

  # Jalankan Sesi A dengan pg_sleep 0.03 dalam query yang sama
  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P1'), pg_sleep(0.03);
  COMMIT;
  " > "$OUT_A" 2>&1 &
  PID_A=$!

  # Jalankan Sesi B paralel
  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P2');
  COMMIT;
  " > "$OUT_B" 2>&1 &
  PID_B=$!

  wait $PID_A || true
  wait $PID_B || true

  FAIL_STOK=0
  if grep -q "Stok tidak cukup" "$OUT_A" || grep -q "Stok tidak cukup" "$OUT_B"; then
    FAIL_STOK=1
  fi

  CONFIRMED_COUNT=$(run_psql -c "
    SELECT count(*) FROM public.pesanan_jual
    WHERE nomor IN ('SO-K1-A-$i', 'SO-K1-B-$i') AND status = 'dikonfirmasi';
  ")
  FINAL_STOK=$(run_psql -c "SELECT stok FROM public.barang WHERE kode = 'K-STOK-1';")

  if [ "$CONFIRMED_COUNT" -eq 1 ] && [ "$FAIL_STOK" -eq 1 ] && [ "$FINAL_STOK" -eq 0 ]; then
    S1_PASS=$((S1_PASS + 1))
    echo "  [Iterasi $(printf "%02d" $i)/20] PASS (Tepat 1 Sukses, 1 Gagal E0014, Stok Akhir: 0)"
  else
    echo "  [Iterasi $(printf "%02d" $i)/20] FAIL (Sukses: $CONFIRMED_COUNT, GagalStok: $FAIL_STOK, Stok: $FINAL_STOK)"
    cat "$OUT_A"
    cat "$OUT_B"
  fi
done

echo "Hasil Skenario 1: $S1_PASS / 20 PASS"

# ============================================================
# SKENARIO 2: Dua Pesanan Bersaing Batas Kredit Pelanggan
# ============================================================
echo ""
echo "------------------------------------------------------------"
echo "SKENARIO 2: Balapan Batas Kredit Pelanggan (20 Iterasi)"
echo "Target: Masing-masing lolos (3jt <= 5jt), gabungan (6jt > 5jt) -> Tepat 1 SUKSES, 1 GAGAL E0012"
echo "------------------------------------------------------------"

S2_PASS=0
for i in $(seq 1 20); do
  SETUP_SQL=$(cat <<SQL
DO \$\$
DECLARE
  v_bid uuid;
  v_pid uuid;
  v_p1  uuid;
  v_p2  uuid;
BEGIN
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
    SELECT id FROM public.pesanan_jual WHERE nomor LIKE 'SO-K2-%'
  );
  DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'SO-K2-%';
  DELETE FROM public.pesanan_jual WHERE nomor LIKE 'SO-K2-%';
  DELETE FROM public.barang WHERE kode = 'K-KREDIT-1';
  DELETE FROM public.pelanggan WHERE kode = 'C-KONK-2';

  PERFORM set_config('app.mutasi_stok', '1', true);
  INSERT INTO public.barang (kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
  VALUES ('K-KREDIT-1', 'Item Cukup Stok', 'PCS', 100000, 50000, 1000, 0, true)
  RETURNING id INTO v_bid;

  INSERT INTO public.pelanggan (kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh)
  VALUES ('C-KONK-2', 'Pelanggan Kredit Ketat', '0812', 'Jl. Test', 5000000, 30, true, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_pid;

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K2-A-' || '$i', v_pid, 'draf', 3000000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bid, 30, 100000, 0, 3000000);

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K2-B-' || '$i', v_pid, 'draf', 3000000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bid, 30, 100000, 0, 3000000);
END \$\$;
SQL
)
  run_psql -c "$SETUP_SQL"

  P1=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K2-A-$i';")
  P2=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K2-B-$i';")

  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P1'), pg_sleep(0.03);
  COMMIT;
  " > "$OUT_A" 2>&1 &
  PID_A=$!

  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P2');
  COMMIT;
  " > "$OUT_B" 2>&1 &
  PID_B=$!

  wait $PID_A || true
  wait $PID_B || true

  FAIL_KREDIT=0
  if grep -q "Batas kredit pelanggan terlampaui" "$OUT_A" || grep -q "Batas kredit pelanggan terlampaui" "$OUT_B"; then
    FAIL_KREDIT=1
  fi

  CONFIRMED_COUNT=$(run_psql -c "
    SELECT count(*) FROM public.pesanan_jual
    WHERE nomor IN ('SO-K2-A-$i', 'SO-K2-B-$i') AND status = 'dikonfirmasi';
  ")
  CONFIRMED_SUM=$(run_psql -c "
    SELECT COALESCE(SUM(total), 0)
    FROM public.pesanan_jual pj
    JOIN public.pelanggan p ON p.id = pj.pelanggan_id
    WHERE p.kode = 'C-KONK-2' AND pj.status = 'dikonfirmasi';
  ")

  if [ "$CONFIRMED_COUNT" -eq 1 ] && [ "$FAIL_KREDIT" -eq 1 ] && [ "$CONFIRMED_SUM" -eq 3000000 ]; then
    S2_PASS=$((S2_PASS + 1))
    echo "  [Iterasi $(printf "%02d" $i)/20] PASS (Tepat 1 Sukses, 1 Gagal E0012, Total Piutang: Rp$CONFIRMED_SUM <= 5jt)"
  else
    echo "  [Iterasi $(printf "%02d" $i)/20] FAIL (Sukses: $CONFIRMED_COUNT, GagalKredit: $FAIL_KREDIT, Total: $CONFIRMED_SUM)"
    cat "$OUT_A"
    cat "$OUT_B"
  fi
done

echo "Hasil Skenario 2: $S2_PASS / 20 PASS"

# ============================================================
# SKENARIO 3: Pencegahan Deadlock pada Urutan Item Berlawanan
# ============================================================
echo ""
echo "------------------------------------------------------------"
echo "SKENARIO 3: Pencegahan Deadlock (ORDER BY id FOR UPDATE) (20 Iterasi)"
echo "Target: Sesi A (Item X lalu Y) vs Sesi B (Item Y lalu X) -> Keduanya SUKSES, 0 Deadlock (40P01)"
echo "------------------------------------------------------------"

S3_PASS=0
for i in $(seq 1 20); do
  SETUP_SQL=$(cat <<SQL
DO \$\$
DECLARE
  v_bx  uuid;
  v_by  uuid;
  v_pid uuid;
  v_p1  uuid;
  v_p2  uuid;
BEGIN
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
    SELECT id FROM public.pesanan_jual WHERE nomor LIKE 'SO-K3-%'
  );
  DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'SO-K3-%';
  DELETE FROM public.pesanan_jual WHERE nomor LIKE 'SO-K3-%';
  DELETE FROM public.barang WHERE kode IN ('K-DEAD-X', 'K-DEAD-Y');
  DELETE FROM public.pelanggan WHERE kode = 'C-KONK-3';

  PERFORM set_config('app.mutasi_stok', '1', true);
  INSERT INTO public.barang (kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
  VALUES ('K-DEAD-X', 'Item Deadlock X', 'PCS', 10000, 5000, 100, 0, true)
  RETURNING id INTO v_bx;

  INSERT INTO public.barang (kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
  VALUES ('K-DEAD-Y', 'Item Deadlock Y', 'PCS', 10000, 5000, 100, 0, true)
  RETURNING id INTO v_by;

  INSERT INTO public.pelanggan (kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh)
  VALUES ('C-KONK-3', 'Pelanggan Deadlock Test', '0813', 'Jl. Test', 10000000, 30, true, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_pid;

  -- Pesanan 1 urutan: X lalu Y
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K3-A-' || '$i', v_pid, 'draf', 20000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bx, 1, 10000, 0, 10000);
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_by, 1, 10000, 0, 10000);

  -- Pesanan 2 urutan terbalik: Y lalu X
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K3-B-' || '$i', v_pid, 'draf', 20000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_by, 1, 10000, 0, 10000);
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bx, 1, 10000, 0, 10000);
END \$\$;
SQL
)
  run_psql -c "$SETUP_SQL"

  P1=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K3-A-$i';")
  P2=$(run_psql -c "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K3-B-$i';")

  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P1'), pg_sleep(0.03);
  COMMIT;
  " > "$OUT_A" 2>&1 &
  PID_A=$!

  run_psql -c "
  BEGIN;
  SET LOCAL \"request.jwt.claims\" = '{\"sub\":\"11111111-1111-1111-1111-111111111111\"}';
  SELECT public.rpc_konfirmasi_pesanan('$P2');
  COMMIT;
  " > "$OUT_B" 2>&1 &
  PID_B=$!

  wait $PID_A || true
  wait $PID_B || true

  DEADLOCK_DETECTED=0
  if grep -qi "deadlock detected" "$OUT_A" || grep -qi "deadlock detected" "$OUT_B"; then
    DEADLOCK_DETECTED=1
  fi

  CONFIRMED_COUNT=$(run_psql -c "
    SELECT count(*) FROM public.pesanan_jual
    WHERE nomor IN ('SO-K3-A-$i', 'SO-K3-B-$i') AND status = 'dikonfirmasi';
  ")

  if [ "$DEADLOCK_DETECTED" -eq 0 ] && [ "$CONFIRMED_COUNT" -eq 2 ]; then
    S3_PASS=$((S3_PASS + 1))
    echo "  [Iterasi $(printf "%02d" $i)/20] PASS (Keduanya Sukses Dikonfirmasi, 0 Deadlock)"
  else
    echo "  [Iterasi $(printf "%02d" $i)/20] FAIL (Deadlock: $DEADLOCK_DETECTED, Terkonfirmasi: $CONFIRMED_COUNT)"
    cat "$OUT_A"
    cat "$OUT_B"
  fi
done

echo "Hasil Skenario 3: $S3_PASS / 20 PASS"

echo ""
echo "============================================================"
echo "RINGKASAN AKHIR UJI KONKURENSI:"
echo "  Skenario 1 (Perebutan Stok):     $S1_PASS / 20 PASS"
echo "  Skenario 2 (Batas Kredit Ketat): $S2_PASS / 20 PASS"
echo "  Skenario 3 (Bebas Deadlock):     $S3_PASS / 20 PASS"
echo "TOTAL: $((S1_PASS + S2_PASS + S3_PASS)) / 60 PASS"
echo "============================================================"

if [ "$((S1_PASS + S2_PASS + S3_PASS))" -eq 60 ]; then
  exit 0
else
  exit 1
fi
