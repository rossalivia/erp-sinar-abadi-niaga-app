# ============================================================
# 03_konkurensi.ps1: Uji Konkurensi & Balapan Transaksi ERP (PowerShell)
# ============================================================
# Skenario 1: Dua pesanan berebut stok sisa 1 (Tepat 1 berhasil, stok akhir 0, tidak minus)
# Skenario 2: Dua pesanan melampaui batas kredit jika digabung (Tepat 1 berhasil)
# Skenario 3: Dua pesanan dengan urutan item terbalik (Bebas deadlock karena ORDER BY id)
# Setiap skenario dijalankan minimal 20 iterasi berulang.
# ============================================================

$ErrorActionPreference = "Stop"

$PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }
$PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "erp_sinar_abadi" }
$env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "admin" }

$PSQL_CMD = "C:\Program Files\PostgreSQL\13\bin\psql.exe"
if (-not (Test-Path $PSQL_CMD)) {
    $found = Get-Command psql -ErrorAction SilentlyContinue
    if ($found) { $PSQL_CMD = $found.Source } else { throw "psql binary tidak ditemukan!" }
}

function Run-Psql {
    param([string]$Sql)
    & $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -q -X -t -A -c $Sql
}

Write-Host "============================================================"
Write-Host "MEMULAI PENGUJIAN KONKURENSI ERP CV SINAR ABADI NIAGA (PS1)"
Write-Host "Koneksi: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
Write-Host "============================================================"

$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$outA = Join-Path $tmpDir "out_a.txt"
$errA = Join-Path $tmpDir "err_a.txt"
$outB = Join-Path $tmpDir "out_b.txt"
$errB = Join-Path $tmpDir "err_b.txt"
$fileA = Join-Path $tmpDir "job_a.sql"
$fileB = Join-Path $tmpDir "job_b.sql"

try {
    # ------------------------------------------------------------
    # SKENARIO 1: Perebutan Stok Sisa 1
    # ------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------"
    Write-Host "SKENARIO 1: Perebutan Stok Sisa 1 (20 Iterasi)"
    Write-Host "Target: Tepat 1 SUKSES, Tepat 1 GAGAL (Stok tidak cukup), Stok akhir = 0"
    Write-Host "------------------------------------------------------------"

    $s1Pass = 0
    for ($i = 1; $i -le 20; $i++) {
        $setupSql = @"
DO `$do`$
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
  VALUES ('SO-K1-A-$i', v_pid, 'draf', 50000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bid, 1, 50000, 0, 50000);

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K1-B-$i', v_pid, 'draf', 50000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bid, 1, 50000, 0, 50000);
END `$do`$;
"@
        Run-Psql $setupSql | Out-Null

        $p1 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K1-A-$i';").Trim()
        $p2 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K1-B-$i';").Trim()

        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p1'), pg_sleep(0.03); COMMIT;" | Set-Content $fileA -Encoding UTF8
        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p2'); COMMIT;" | Set-Content $fileB -Encoding UTF8

        $jobA = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileA -RedirectStandardOutput $outA -RedirectStandardError $errA -PassThru
        $jobB = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileB -RedirectStandardOutput $outB -RedirectStandardError $errB -PassThru

        $jobA.WaitForExit()
        $jobB.WaitForExit()

        $textA = (Get-Content $outA, $errA -ErrorAction SilentlyContinue) -join "`n"
        $textB = (Get-Content $outB, $errB -ErrorAction SilentlyContinue) -join "`n"

        $failStok = if ($textA.Contains("Stok tidak cukup") -or $textB.Contains("Stok tidak cukup")) { 1 } else { 0 }
        $confirmedCount = [int](Run-Psql "SELECT count(*) FROM public.pesanan_jual WHERE nomor IN ('SO-K1-A-$i', 'SO-K1-B-$i') AND status = 'dikonfirmasi';").Trim()
        $finalStok = [int](Run-Psql "SELECT stok FROM public.barang WHERE kode = 'K-STOK-1';").Trim()

        if ($confirmedCount -eq 1 -and $failStok -eq 1 -and $finalStok -eq 0) {
            $s1Pass++
            Write-Host ("  [Iterasi {0:D2}/20] PASS (Tepat 1 Sukses, 1 Gagal E0014, Stok Akhir: 0)" -f $i)
        } else {
            Write-Host ("  [Iterasi {0:D2}/20] FAIL (Sukses: $confirmedCount, GagalStok: $failStok, Stok: $finalStok)" -f $i)
        }
    }
    Write-Host "Hasil Skenario 1: $s1Pass / 20 PASS"

    # ------------------------------------------------------------
    # SKENARIO 2: Balapan Batas Kredit Pelanggan
    # ------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------"
    Write-Host "SKENARIO 2: Balapan Batas Kredit Pelanggan (20 Iterasi)"
    Write-Host "Target: Masing-masing lolos (3jt <= 5jt), gabungan (6jt > 5jt) -> Tepat 1 SUKSES, 1 GAGAL E0012"
    Write-Host "------------------------------------------------------------"

    $s2Pass = 0
    for ($i = 1; $i -le 20; $i++) {
        $setupSql = @"
DO `$do`$
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
  VALUES ('SO-K2-A-$i', v_pid, 'draf', 3000000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bid, 30, 100000, 0, 3000000);

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K2-B-$i', v_pid, 'draf', 3000000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bid, 30, 100000, 0, 3000000);
END `$do`$;
"@
        Run-Psql $setupSql | Out-Null

        $p1 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K2-A-$i';").Trim()
        $p2 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K2-B-$i';").Trim()

        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p1'), pg_sleep(0.03); COMMIT;" | Set-Content $fileA -Encoding UTF8
        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p2'); COMMIT;" | Set-Content $fileB -Encoding UTF8

        $jobA = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileA -RedirectStandardOutput $outA -RedirectStandardError $errA -PassThru
        $jobB = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileB -RedirectStandardOutput $outB -RedirectStandardError $errB -PassThru

        $jobA.WaitForExit()
        $jobB.WaitForExit()

        $textA = (Get-Content $outA, $errA -ErrorAction SilentlyContinue) -join "`n"
        $textB = (Get-Content $outB, $errB -ErrorAction SilentlyContinue) -join "`n"

        $failKredit = if ($textA.Contains("Batas kredit pelanggan terlampaui") -or $textB.Contains("Batas kredit pelanggan terlampaui")) { 1 } else { 0 }
        $confirmedCount = [int](Run-Psql "SELECT count(*) FROM public.pesanan_jual WHERE nomor IN ('SO-K2-A-$i', 'SO-K2-B-$i') AND status = 'dikonfirmasi';").Trim()
        $confirmedSum = [long](Run-Psql "SELECT COALESCE(SUM(total), 0) FROM public.pesanan_jual pj JOIN public.pelanggan p ON p.id = pj.pelanggan_id WHERE p.kode = 'C-KONK-2' AND pj.status = 'dikonfirmasi';").Trim()

        if ($confirmedCount -eq 1 -and $failKredit -eq 1 -and $confirmedSum -eq 3000000) {
            $s2Pass++
            Write-Host ("  [Iterasi {0:D2}/20] PASS (Tepat 1 Sukses, 1 Gagal E0012, Total Piutang: Rp{1} <= 5jt)" -f $i, $confirmedSum)
        } else {
            Write-Host ("  [Iterasi {0:D2}/20] FAIL (Sukses: $confirmedCount, GagalKredit: $failKredit, Total: $confirmedSum)" -f $i)
        }
    }
    Write-Host "Hasil Skenario 2: $s2Pass / 20 PASS"

    # ------------------------------------------------------------
    # SKENARIO 3: Pencegahan Deadlock pada Urutan Item Berlawanan
    # ------------------------------------------------------------
    Write-Host "`n------------------------------------------------------------"
    Write-Host "SKENARIO 3: Pencegahan Deadlock (ORDER BY id FOR UPDATE) (20 Iterasi)"
    Write-Host "Target: Sesi A (Item X lalu Y) vs Sesi B (Item Y lalu X) -> Keduanya SUKSES, 0 Deadlock (40P01)"
    Write-Host "------------------------------------------------------------"

    $s3Pass = 0
    for ($i = 1; $i -le 20; $i++) {
        $setupSql = @"
DO `$do`$
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

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K3-A-$i', v_pid, 'draf', 20000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p1;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_bx, 1, 10000, 0, 10000);
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p1, v_by, 1, 10000, 0, 10000);

  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, total, dibuat_oleh)
  VALUES ('SO-K3-B-$i', v_pid, 'draf', 20000, '11111111-1111-1111-1111-111111111111')
  RETURNING id INTO v_p2;
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_by, 1, 10000, 0, 10000);
  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_p2, v_bx, 1, 10000, 0, 10000);
END `$do`$;
"@
        Run-Psql $setupSql | Out-Null

        $p1 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K3-A-$i';").Trim()
        $p2 = (Run-Psql "SELECT id FROM public.pesanan_jual WHERE nomor = 'SO-K3-B-$i';").Trim()

        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p1'), pg_sleep(0.03); COMMIT;" | Set-Content $fileA -Encoding UTF8
        "BEGIN; SET LOCAL request.jwt.claims = '{""sub"":""11111111-1111-1111-1111-111111111111""}'; SELECT public.rpc_konfirmasi_pesanan('$p2'); COMMIT;" | Set-Content $fileB -Encoding UTF8

        $jobA = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileA -RedirectStandardOutput $outA -RedirectStandardError $errA -PassThru
        $jobB = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-q", "-X", "-t", "-A", "-f", $fileB -RedirectStandardOutput $outB -RedirectStandardError $errB -PassThru

        $jobA.WaitForExit()
        $jobB.WaitForExit()

        $textA = (Get-Content $outA, $errA -ErrorAction SilentlyContinue) -join "`n"
        $textB = (Get-Content $outB, $errB -ErrorAction SilentlyContinue) -join "`n"

        $deadlock = if ($textA.Contains("deadlock detected") -or $textB.Contains("deadlock detected")) { 1 } else { 0 }
        $confirmedCount = [int](Run-Psql "SELECT count(*) FROM public.pesanan_jual WHERE nomor IN ('SO-K3-A-$i', 'SO-K3-B-$i') AND status = 'dikonfirmasi';").Trim()

        if ($deadlock -eq 0 -and $confirmedCount -eq 2) {
            $s3Pass++
            Write-Host ("  [Iterasi {0:D2}/20] PASS (Keduanya Sukses Dikonfirmasi, 0 Deadlock)" -f $i)
        } else {
            Write-Host ("  [Iterasi {0:D2}/20] FAIL (Deadlock: $deadlock, Terkonfirmasi: $confirmedCount)" -f $i)
        }
    }
    Write-Host "Hasil Skenario 3: $s3Pass / 20 PASS"

    Write-Host "`n============================================================"
    Write-Host "RINGKASAN AKHIR UJI KONKURENSI:"
    Write-Host "  Skenario 1 (Perebutan Stok):     $s1Pass / 20 PASS"
    Write-Host "  Skenario 2 (Batas Kredit Ketat): $s2Pass / 20 PASS"
    Write-Host "  Skenario 3 (Bebas Deadlock):     $s3Pass / 20 PASS"
    Write-Host ("TOTAL: {0} / 60 PASS" -f ($s1Pass + $s2Pass + $s3Pass))
    Write-Host "============================================================"
} finally {
    Run-Psql "
      DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
        SELECT id FROM public.pesanan_jual WHERE nomor LIKE 'SO-K%'
      );
      DELETE FROM public.mutasi_stok WHERE nomor_dokumen LIKE 'SO-K%';
      DELETE FROM public.pesanan_jual WHERE nomor LIKE 'SO-K%';
      DELETE FROM public.barang WHERE kode IN ('K-STOK-1', 'K-KREDIT-1', 'K-DEAD-X', 'K-DEAD-Y');
      DELETE FROM public.pelanggan WHERE kode IN ('C-KONK-1', 'C-KONK-2', 'C-KONK-3');
    " | Out-Null
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
