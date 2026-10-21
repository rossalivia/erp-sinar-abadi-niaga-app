export interface AuditLogItem {
  id: number;
  pelaku_id: string;
  pelaku_nama?: string;
  pelaku_email?: string;
  pelaku_peran?: string;
  aksi: string;
  nama_tabel: string;
  data_id: string | null;
  nilai_lama: Record<string, unknown> | null;
  nilai_baru: Record<string, unknown> | null;
  dibuat_pada: string;
}

export interface AuditLogFilterParams {
  aksi?: string;
  tabel?: string;
  pelaku?: string;
  dari?: string;
  sampai?: string;
  page?: string;
}
