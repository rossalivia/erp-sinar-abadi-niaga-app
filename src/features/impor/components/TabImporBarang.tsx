'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropzoneCsv } from './DropzoneCsv';
import { RingkasanValidasi } from './RingkasanValidasi';
import { TabelGalat } from './TabelGalat';
import { TabelPratinjauBarang } from './TabelPratinjauBarang';
import { BarangImportRow, ValidationResult } from '../types';
import { validasiBarangCsvAction, eksekusiImporBarangAction } from '../actions';

export function TabImporBarang() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [validationResult, setValidationResult] =
    React.useState<ValidationResult<BarangImportRow> | null>(null);
  const [importSuccess, setImportSuccess] = React.useState<{
    nomor: string;
    jumlahDibuat: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setValidationResult(null);
    setImportSuccess(null);
    setErrorMessage(null);
    setIsValidating(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await validasiBarangCsvAction(formData);

      if (!res.sukses) {
        setErrorMessage(res.pesan || 'Gagal memvalidasi berkas CSV');
      } else if (res.hasil) {
        setValidationResult(res.hasil);
      }
    } catch {
      setErrorMessage('Terjadi kesalahan jaringan saat memvalidasi berkas');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportSuccess(null);
    setErrorMessage(null);
  };

  const handleEksekusiImpor = async () => {
    if (!selectedFile || !validationResult || validationResult.totalGalat > 0) return;
    setIsImporting(true);
    setErrorMessage(null);

    try {
      const res = await eksekusiImporBarangAction(selectedFile.name, validationResult.data);
      if (!res.sukses) {
        setErrorMessage(res.pesan || 'Gagal mengeksekusi impor data');
      } else if (res.nomor && res.jumlahDibuat !== undefined) {
        setImportSuccess({
          nomor: res.nomor,
          jumlahDibuat: res.jumlahDibuat,
        });
      }
    } catch {
      setErrorMessage('Terjadi kesalahan koneksi saat mengeksekusi impor');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Kartu Panduan & Unduh Templat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-lg">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Format & Templat CSV Barang</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Kolom: <span className="font-mono text-slate-700 font-medium">kode, nama, satuan, harga_jual, harga_pokok, stok_minimum, stok_awal, aktif</span>
          </p>
        </div>
        <a
          href="/api/impor/templat?jenis=barang"
          download="templat_impor_barang.csv"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors w-fit shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Unduh Templat CSV</span>
        </a>
      </div>

      {/* Banner Sukses */}
      {importSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Impor Data Barang Berhasil!</h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Sebanyak <span className="font-bold">{importSuccess.jumlahDibuat} barang baru</span> berhasil dimasukkan ke sistem dengan nomor dokumen referensi <span className="font-mono font-bold">{importSuccess.nomor}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href="/barang"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors"
            >
              <span>Lihat Daftar Barang</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 text-xs bg-white text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Impor Berkas Lain
            </Button>
          </div>
        </div>
      )}

      {/* Form Dropzone */}
      {!importSuccess && (
        <div className="space-y-4">
          <DropzoneCsv
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={handleClear}
            disabled={isValidating || isImporting}
          />

          {isValidating && (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-slate-700" />
              <span>Sedang memvalidasi struktur dan duplikasi berkas CSV...</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {validationResult && !isValidating && (
            <div className="space-y-4">
              <RingkasanValidasi
                totalBaris={validationResult.totalBaris}
                totalValid={validationResult.totalValid}
                totalGalat={validationResult.totalGalat}
              />

              {validationResult.totalGalat > 0 ? (
                <TabelGalat galat={validationResult.galat} />
              ) : (
                <TabelPratinjauBarang data={validationResult.data} />
              )}

              {/* Tombol Eksekusi Impor */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={isImporting}
                  className="text-xs h-9"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleEksekusiImpor}
                  disabled={validationResult.totalGalat > 0 || isImporting || validationResult.totalValid === 0}
                  className="text-xs h-9 bg-slate-900 text-white hover:bg-slate-800"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Memproses Transaksi...
                    </>
                  ) : (
                    `Impor Sekarang (${validationResult.totalValid} Barang)`
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
