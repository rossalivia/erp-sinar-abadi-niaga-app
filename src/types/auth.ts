export type Peran = 'penjualan' | 'gudang' | 'manajer';

export interface UserProfile {
  id: string;
  nama_lengkap: string;
  peran: Peran;
  aktif: boolean;
  dibuat_pada: string;
}
