'use client';

import * as React from 'react';
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DropzoneCsvProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

export function DropzoneCsv({
  onFileSelect,
  selectedFile,
  onClear,
  disabled = false,
}: DropzoneCsvProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (selectedFile) {
    const sizeKb = (selectedFile.size / 1024).toFixed(1);
    return (
      <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-md">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">{sizeKb} KB • Berkas CSV siap divalidasi</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={disabled}
          className="h-8 text-slate-500 hover:text-red-700"
        >
          <X className="h-4 w-4 mr-1" />
          Ganti Berkas
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-center',
        isDragOver
          ? 'border-slate-800 bg-slate-100/70'
          : 'border-slate-300 hover:border-slate-400 bg-slate-50/50',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <div className="p-3 bg-white border border-slate-200 rounded-full shadow-xs mb-3 text-slate-600">
        <UploadCloud className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-slate-800">
        Klik untuk memilih berkas atau seret berkas CSV ke sini
      </p>
      <p className="text-xs text-slate-500 mt-1">
        Hanya menerima berkas .csv (Maksimal 1 MB / 1.000 baris data)
      </p>
    </div>
  );
}
