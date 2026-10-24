"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { CountUpNumber } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { toneEfektif } from "../utils";
import type { ToneTugas, WidgetTugas } from "../types";
import type { Peran } from "@/types/auth";

const ACCENT_BORDER: Record<ToneTugas, string> = {
  neutral: "border-slate-200/90 hover:border-slate-300",
  info: "border-blue-200/90 hover:border-blue-300",
  warning: "border-amber-300/90 hover:border-amber-400 bg-linear-to-b from-amber-50/40 to-white",
  danger: "border-red-300/90 hover:border-red-400 bg-linear-to-b from-red-50/40 to-white",
};

const PILL_COLOR: Record<ToneTugas, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-100/80 text-blue-800",
  warning: "bg-amber-100/90 text-amber-900 font-semibold",
  danger: "bg-red-100/90 text-red-900 font-semibold",
};

const TEXT_COLOR: Record<ToneTugas, string> = {
  neutral: "text-slate-900",
  info: "text-blue-900",
  warning: "text-amber-900",
  danger: "text-red-700",
};

interface TugasHariIniProps {
  widgets: WidgetTugas[];
  peran: Peran;
}

export function TugasHariIniHeader({
  peran,
  denganAksi = true,
}: {
  peran: Peran;
  denganAksi?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Prioritas Kerja Hari Ini
          </h2>
          <p className="text-xs text-slate-500">
            Antrean operasional dan transaksi yang memerlukan tindakan segera
          </p>
        </div>
      </div>

      {denganAksi && peran !== "penjualan" && (
        <Button
          asChild
          size="sm"
          className="h-8 gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-98"
        >
          <Link href="/gudang/picking">
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Buka Daftar Ambil (Picking)</span>
          </Link>
        </Button>
      )}
    </div>
  );
}

export function TugasHariIni({ widgets, peran }: TugasHariIniProps) {
  const [showClearTasks, setShowClearTasks] = useState(false);

  // Pisahkan tugas mendesak (nilai > 0) dan tugas beres (nilai === 0)
  const urgentTasks = widgets.filter((w) => w.nilai > 0);
  const clearTasks = widgets.filter((w) => w.nilai === 0);

  return (
    <section className="space-y-3.5" aria-label="Tugas Hari Ini">
      <TugasHariIniHeader peran={peran} />

      {/* Jika ada antrean mendesak */}
      {urgentTasks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {urgentTasks.map((widget) => {
            const tone = toneEfektif(widget.tone, widget.nilai);

            return (
              <Link
                key={widget.key}
                href={widget.href}
                className={cn(
                  "group relative surface-raised rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between border",
                  ACCENT_BORDER[tone]
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-md",
                        PILL_COLOR[tone]
                      )}
                    >
                      {widget.indikator}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors inline-flex items-center gap-0.5">
                      Tindakan
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <h3 className="mt-2.5 text-xs font-bold text-slate-800 line-clamp-1">
                    {widget.judul}
                  </h3>

                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-2xl font-extrabold tracking-tight tabular-nums",
                        TEXT_COLOR[tone]
                      )}
                    >
                      <CountUpNumber value={widget.nilai} />
                    </span>
                    {widget.satuan && (
                      <span className="text-xs font-medium text-slate-500">
                        {widget.satuan}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                    {widget.keterangan}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Status Semua Beres */
        <div className="surface-raised rounded-xl p-6 text-center flex flex-col items-center justify-center border border-emerald-200/80 bg-linear-to-b from-emerald-50/30 to-white">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Luar Biasa! Semua Antrean Beres
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Tidak ada pesanan tertahan, approval tertunda, atau tagihan mendesak
            yang membutuhkan tindakan saat ini.
          </p>
        </div>
      )}

      {/* Collapsible Bar untuk Tugas Bernilai 0 (Menghilangkan kekosongan grid) */}
      {clearTasks.length > 0 && urgentTasks.length > 0 && (
        <div className="surface-inset rounded-lg p-2.5">
          <button
            type="button"
            onClick={() => setShowClearTasks((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-900 transition-colors px-1"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium text-slate-700">
                {clearTasks.length} Antrean Dalam Kondisi Terkendali (0 tertunda)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>{showClearTasks ? "Sembunyikan" : "Lihat rincian"}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-200",
                  showClearTasks && "rotate-180"
                )}
              />
            </div>
          </button>

          <AnimatePresence>
            {showClearTasks && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-2.5 mt-2 border-t border-slate-200/60"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {clearTasks.map((task) => (
                    <Link
                      key={task.key}
                      href={task.href}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-white/70 hover:bg-white text-xs border border-slate-200/50 transition-colors"
                    >
                      <span className="text-slate-600 truncate text-[11px]">
                        {task.judul}
                      </span>
                      <span className="text-emerald-700 font-mono text-[10px] font-bold shrink-0 ml-1.5">
                        0 Beres
                      </span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
