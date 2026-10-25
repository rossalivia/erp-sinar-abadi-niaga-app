'use client';

import * as React from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Truck,
  AlertCircle,
  PackageCheck,
  Clock,
} from 'lucide-react';
import type { Peran } from '@/types/auth';

interface EventItem {
  id: string;
  type: 'kirim' | 'tempo' | 'po';
  title: string;
  time: string;
}

// Mock scheduled operational events per date (day of current month)
const MOCK_EVENTS: Record<number, EventItem[]> = {
  3: [
    { id: '1', type: 'kirim', title: 'Kirim 45 sak Beras ke Toko Barokah', time: '09:00' },
  ],
  8: [
    { id: '2', type: 'po', title: 'Terima PO Semen 100 Sak (PT Sinar Mas)', time: '14:00' },
  ],
  12: [
    { id: '3', type: 'tempo', title: 'Jatuh Tempo Faktur Toko Subur Makmur', time: '17:00' },
  ],
  15: [
    { id: '4', type: 'kirim', title: 'Armada 1: Rute Rawalumbu (5 Toko)', time: '08:30' },
    { id: '5', type: 'tempo', title: 'Jatuh Tempo Toko Rezeki Baru', time: '16:00' },
  ],
  20: [
    { id: '6', type: 'kirim', title: 'Pengiriman Minyak Goreng 80 Karton', time: '10:00' },
    { id: '7', type: 'po', title: 'Penerimaan Tepung Terigu Segitiga', time: '13:30' },
  ],
  25: [
    { id: '8', type: 'kirim', title: '3 Jadwal Pengiriman Armada Siang', time: '11:00' },
    { id: '9', type: 'tempo', title: '2 Faktur Jatuh Tempo Hari Ini', time: '17:00' },
  ],
  28: [
    { id: '10', type: 'tempo', title: 'Jatuh Tempo Faktur Toko Maju Jaya', time: '15:00' },
  ],
};

const NAMA_HARI = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const emptySubscribe = () => () => {};

export interface DashboardCalendarCardProps {
  peran?: Peran;
}

export function DashboardCalendarCard({ peran = 'penjualan' }: DashboardCalendarCardProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState<number>(() => new Date().getDate());

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Hitung jumlah hari dalam bulan ini
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Hitung hari pertama dalam bulan (0=Min, 1=Sen, ... 6=Sab)
  // Ubah ke format Senin = 0, Minggu = 6 (ISO)
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  // Hari dalam bulan sebelumnya
  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const handleResetToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now.getDate());
  };

  const isCurrentMonthToday =
    today.getFullYear() === year && today.getMonth() === month;

  // Filter events by role:
  // - Gudang: sees 'kirim' and 'po', hides 'tempo' (keuangan)
  // - Penjualan: sees 'kirim' and 'tempo', hides 'po' (pergudangan)
  // - Manajer: sees all
  const filterEventsForRole = React.useCallback(
    (events: EventItem[] = []) => {
      if (peran === 'gudang') {
        return events.filter((e) => e.type !== 'tempo');
      }
      if (peran === 'penjualan') {
        return events.filter((e) => e.type !== 'po');
      }
      return events;
    },
    [peran]
  );

  // Selected date events
  const rawEvents = MOCK_EVENTS[selectedDay] || [];
  const activeEvents = filterEventsForRole(rawEvents);

  return (
    <div className="rounded-2xl border border-[#d6e4f5] bg-white p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
      {/* Calendar Header: Month, Year, Navigation */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <CalendarIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#0c1a30] uppercase tracking-wider font-mono">
                {peran === 'gudang'
                  ? 'Jadwal Logistik Gudang'
                  : peran === 'penjualan'
                  ? 'Agenda Penjualan & Tagihan'
                  : 'Kalender Operasional'}
              </h3>
              <p className="text-[11px] font-semibold text-slate-700">
                {NAMA_BULAN[month]} {year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetToday}
              className="px-2 py-0.5 text-[10px] font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors mr-1 cursor-pointer"
              title="Kembali ke Hari Ini"
            >
              Hari Ini
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {NAMA_HARI.map((hari, idx) => (
            <div
              key={hari}
              className={`text-[10px] font-bold py-1 ${
                idx >= 5 ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              {hari}
            </div>
          ))}
        </div>

        {/* Calendar Day Matrix Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Previous Month Faded Days */}
          {Array.from({ length: firstDay }).map((_, idx) => {
            const dayNum = prevMonthDays - firstDay + idx + 1;
            return (
              <div
                key={`prev-${idx}`}
                className="h-8 flex items-center justify-center text-[11px] text-slate-300 font-normal"
              >
                {dayNum}
              </div>
            );
          })}

          {/* Current Month Days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const isToday =
              isClient && isCurrentMonthToday && today.getDate() === dayNum;
            const isSelected = selectedDay === dayNum;
            const dayEvents = filterEventsForRole(MOCK_EVENTS[dayNum] || []);
            const hasEvents = dayEvents.length > 0;

            return (
              <button
                key={`cur-${dayNum}`}
                type="button"
                onClick={() => setSelectedDay(dayNum)}
                className={`relative h-8 w-full rounded-lg flex flex-col items-center justify-center text-[11px] transition-all cursor-pointer ${
                  isToday
                    ? 'bg-[#0c1b3a] text-white font-bold shadow-xs'
                    : isSelected
                    ? 'bg-blue-100 text-blue-900 font-bold ring-1 ring-blue-400'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{dayNum}</span>

                {/* Event Indicator Dots */}
                {hasEvents && (
                  <span className="flex items-center gap-0.5 mt-0.5 leading-none">
                    {dayEvents.some((e) => e.type === 'kirim') && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isToday ? 'bg-emerald-300' : 'bg-emerald-500'
                        }`}
                        title="Pengiriman"
                      />
                    )}
                    {dayEvents.some((e) => e.type === 'tempo') && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isToday ? 'bg-amber-300' : 'bg-amber-500'
                        }`}
                        title="Jatuh Tempo"
                      />
                    )}
                    {dayEvents.some((e) => e.type === 'po') && (
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isToday ? 'bg-sky-300' : 'bg-sky-500'
                        }`}
                        title="PO Penerimaan"
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Agenda Details */}
      <div className="mt-3.5 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#0c1a30] flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            Agenda: {selectedDay} {NAMA_BULAN[month]}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {activeEvents.length} kegiatan
          </span>
        </div>

        {activeEvents.length > 0 ? (
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {activeEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]"
              >
                {ev.type === 'kirim' && (
                  <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {ev.type === 'tempo' && (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                )}
                {ev.type === 'po' && (
                  <PackageCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{ev.title}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{ev.time} WIB</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic py-1 text-center">
            Tidak ada agenda khusus pada tanggal ini.
          </p>
        )}
      </div>
    </div>
  );
}
