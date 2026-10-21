export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          aksi: string
          data_id: string | null
          dibuat_pada: string
          id: number
          nama_tabel: string
          nilai_baru: Json | null
          nilai_lama: Json | null
          pelaku_id: string
        }
        Insert: {
          aksi: string
          data_id?: string | null
          dibuat_pada?: string
          id?: never
          nama_tabel: string
          nilai_baru?: Json | null
          nilai_lama?: Json | null
          pelaku_id: string
        }
        Update: {
          aksi?: string
          data_id?: string | null
          dibuat_pada?: string
          id?: never
          nama_tabel?: string
          nilai_baru?: Json | null
          nilai_lama?: Json | null
          pelaku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_pelaku_id_fkey"
            columns: ["pelaku_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barang: {
        Row: {
          aktif: boolean
          diperbarui_pada: string
          harga_jual: number
          harga_pokok: number | null
          id: string
          kode: string
          nama: string
          satuan: string
          stok: number
          stok_minimum: number
        }
        Insert: {
          aktif?: boolean
          diperbarui_pada?: string
          harga_jual: number
          harga_pokok?: number | null
          id?: string
          kode: string
          nama: string
          satuan: string
          stok?: number
          stok_minimum?: number
        }
        Update: {
          aktif?: boolean
          diperbarui_pada?: string
          harga_jual?: number
          harga_pokok?: number | null
          id?: string
          kode?: string
          nama?: string
          satuan?: string
          stok?: number
          stok_minimum?: number
        }
        Relationships: []
      }
      item_pesanan_jual: {
        Row: {
          barang_id: string
          diskon_persen: number
          harga_satuan: number
          hpp_satuan: number | null
          id: string
          jumlah: number
          pesanan_jual_id: string
          subtotal: number
        }
        Insert: {
          barang_id: string
          diskon_persen?: number
          harga_satuan: number
          hpp_satuan?: number | null
          id?: string
          jumlah: number
          pesanan_jual_id: string
          subtotal: number
        }
        Update: {
          barang_id?: string
          diskon_persen?: number
          harga_satuan?: number
          hpp_satuan?: number | null
          id?: string
          jumlah?: number
          pesanan_jual_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          },
        ]
      }
      mutasi_stok: {
        Row: {
          alasan: string | null
          barang_id: string
          dibuat_oleh: string
          dibuat_pada: string
          id: number
          jenis: string
          jumlah: number
          nomor_dokumen: string | null
          stok_sesudah: number
        }
        Insert: {
          alasan?: string | null
          barang_id: string
          dibuat_oleh: string
          dibuat_pada?: string
          id?: never
          jenis: string
          jumlah: number
          nomor_dokumen?: string | null
          stok_sesudah: number
        }
        Update: {
          alasan?: string | null
          barang_id?: string
          dibuat_oleh?: string
          dibuat_pada?: string
          id?: never
          jenis?: string
          jumlah?: number
          nomor_dokumen?: string | null
          stok_sesudah?: number
        }
        Relationships: [
          {
            foreignKeyName: "mutasi_stok_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutasi_stok_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutasi_stok_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutasi_stok_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pelanggan: {
        Row: {
          aktif: boolean
          alamat: string | null
          batas_kredit: number
          dibuat_oleh: string
          dibuat_pada: string
          id: string
          kode: string
          nama_toko: string
          telepon: string | null
          termin_hari: number
        }
        Insert: {
          aktif?: boolean
          alamat?: string | null
          batas_kredit?: number
          dibuat_oleh: string
          dibuat_pada?: string
          id?: string
          kode: string
          nama_toko: string
          telepon?: string | null
          termin_hari?: number
        }
        Update: {
          aktif?: boolean
          alamat?: string | null
          batas_kredit?: number
          dibuat_oleh?: string
          dibuat_pada?: string
          id?: string
          kode?: string
          nama_toko?: string
          telepon?: string | null
          termin_hari?: number
        }
        Relationships: [
          {
            foreignKeyName: "pelanggan_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pemasok: {
        Row: {
          aktif: boolean
          alamat: string | null
          dibuat_pada: string
          id: string
          kode: string
          nama: string
          telepon: string | null
        }
        Insert: {
          aktif?: boolean
          alamat?: string | null
          dibuat_pada?: string
          id?: string
          kode: string
          nama: string
          telepon?: string | null
        }
        Update: {
          aktif?: boolean
          alamat?: string | null
          dibuat_pada?: string
          id?: string
          kode?: string
          nama?: string
          telepon?: string | null
        }
        Relationships: []
      }
      pembelian: {
        Row: {
          alasan_tolak: string | null
          barang_id: string
          diajukan_oleh: string
          diajukan_pada: string
          diputuskan_oleh: string | null
          diputuskan_pada: string | null
          diterima_oleh: string | null
          diterima_pada: string | null
          harga_beli_satuan: number | null
          id: string
          jumlah_dipesan: number
          jumlah_diterima: number
          nomor: string
          pemasok_id: string
          status: string
        }
        Insert: {
          alasan_tolak?: string | null
          barang_id: string
          diajukan_oleh: string
          diajukan_pada?: string
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          harga_beli_satuan?: number | null
          id?: string
          jumlah_dipesan: number
          jumlah_diterima?: number
          nomor: string
          pemasok_id: string
          status?: string
        }
        Update: {
          alasan_tolak?: string | null
          barang_id?: string
          diajukan_oleh?: string
          diajukan_pada?: string
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          harga_beli_satuan?: number | null
          id?: string
          jumlah_dipesan?: number
          jumlah_diterima?: number
          nomor?: string
          pemasok_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diajukan_oleh_fkey"
            columns: ["diajukan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diputuskan_oleh_fkey"
            columns: ["diputuskan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diterima_oleh_fkey"
            columns: ["diterima_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_pemasok_id_fkey"
            columns: ["pemasok_id"]
            isOneToOne: false
            referencedRelation: "pemasok"
            referencedColumns: ["id"]
          },
        ]
      }
      pesanan_jual: {
        Row: {
          alasan_batal: string | null
          dibatalkan_pada: string | null
          dibuat_oleh: string
          dibuat_pada: string
          dikirim_pada: string | null
          dikonfirmasi_pada: string | null
          dilunasi_pada: string | null
          id: string
          jatuh_tempo: string | null
          nomor: string
          pelanggan_id: string
          status: string
          total: number
        }
        Insert: {
          alasan_batal?: string | null
          dibatalkan_pada?: string | null
          dibuat_oleh: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          dikonfirmasi_pada?: string | null
          dilunasi_pada?: string | null
          id?: string
          jatuh_tempo?: string | null
          nomor: string
          pelanggan_id: string
          status?: string
          total?: number
        }
        Update: {
          alasan_batal?: string | null
          dibatalkan_pada?: string | null
          dibuat_oleh?: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          dikonfirmasi_pada?: string | null
          dilunasi_pada?: string | null
          id?: string
          jatuh_tempo?: string | null
          nomor?: string
          pelanggan_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pesanan_jual_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesanan_jual_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "pelanggan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesanan_jual_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "v_pelanggan_piutang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesanan_jual_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "v_piutang_pelanggan"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aktif: boolean
          dibuat_pada: string
          id: string
          nama_lengkap: string
          peran: string
        }
        Insert: {
          aktif?: boolean
          dibuat_pada?: string
          id: string
          nama_lengkap: string
          peran?: string
        }
        Update: {
          aktif?: boolean
          dibuat_pada?: string
          id?: string
          nama_lengkap?: string
          peran?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_barang: {
        Row: {
          aktif: boolean | null
          diperbarui_pada: string | null
          harga_jual: number | null
          id: string | null
          kode: string | null
          nama: string | null
          satuan: string | null
          stok: number | null
          stok_menipis: boolean | null
          stok_minimum: number | null
        }
        Insert: {
          aktif?: boolean | null
          diperbarui_pada?: string | null
          harga_jual?: number | null
          id?: string | null
          kode?: string | null
          nama?: string | null
          satuan?: string | null
          stok?: number | null
          stok_menipis?: never
          stok_minimum?: number | null
        }
        Update: {
          aktif?: boolean | null
          diperbarui_pada?: string | null
          harga_jual?: number | null
          id?: string | null
          kode?: string | null
          nama?: string | null
          satuan?: string | null
          stok?: number | null
          stok_menipis?: never
          stok_minimum?: number | null
        }
        Relationships: []
      }
      v_barang_manajer: {
        Row: {
          aktif: boolean | null
          diperbarui_pada: string | null
          harga_jual: number | null
          harga_pokok: number | null
          harga_pokok_belum_diisi: boolean | null
          id: string | null
          kode: string | null
          nama: string | null
          satuan: string | null
          stok: number | null
          stok_menipis: boolean | null
          stok_minimum: number | null
        }
        Insert: {
          aktif?: boolean | null
          diperbarui_pada?: string | null
          harga_jual?: number | null
          harga_pokok?: number | null
          harga_pokok_belum_diisi?: never
          id?: string | null
          kode?: string | null
          nama?: string | null
          satuan?: string | null
          stok?: number | null
          stok_menipis?: never
          stok_minimum?: number | null
        }
        Update: {
          aktif?: boolean | null
          diperbarui_pada?: string | null
          harga_jual?: number | null
          harga_pokok?: number | null
          harga_pokok_belum_diisi?: never
          id?: string | null
          kode?: string | null
          nama?: string | null
          satuan?: string | null
          stok?: number | null
          stok_menipis?: never
          stok_minimum?: number | null
        }
        Relationships: []
      }
      v_item_pesanan_jual: {
        Row: {
          barang_id: string | null
          diskon_persen: number | null
          harga_satuan: number | null
          id: string | null
          jumlah: number | null
          pesanan_jual_id: string | null
          subtotal: number | null
        }
        Insert: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Update: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_pesanan_jual_manajer: {
        Row: {
          barang_id: string | null
          diskon_persen: number | null
          harga_satuan: number | null
          hpp_satuan: number | null
          id: string | null
          jumlah: number | null
          margin: number | null
          pesanan_jual_id: string | null
          subtotal: number | null
        }
        Insert: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          hpp_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          margin?: never
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Update: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          hpp_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          margin?: never
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          },
        ]
      }
      v_item_pesanan_manajer: {
        Row: {
          barang_id: string | null
          diskon_persen: number | null
          harga_satuan: number | null
          hpp_satuan: number | null
          id: string | null
          jumlah: number | null
          margin: number | null
          pesanan_jual_id: string | null
          subtotal: number | null
        }
        Insert: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          hpp_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          margin?: never
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Update: {
          barang_id?: string | null
          diskon_persen?: number | null
          harga_satuan?: number | null
          hpp_satuan?: number | null
          id?: string | null
          jumlah?: number | null
          margin?: never
          pesanan_jual_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_jual_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pelanggan_piutang: {
        Row: {
          ada_lewat_jatuh_tempo: boolean | null
          aktif: boolean | null
          alamat: string | null
          batas_kredit: number | null
          id: string | null
          kode: string | null
          nama_toko: string | null
          piutang_berjalan: number | null
          punya_pesanan_lewat_tempo: boolean | null
          telepon: string | null
          termin_hari: number | null
        }
        Insert: {
          ada_lewat_jatuh_tempo?: never
          aktif?: boolean | null
          alamat?: string | null
          batas_kredit?: number | null
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          piutang_berjalan?: never
          punya_pesanan_lewat_tempo?: never
          telepon?: string | null
          termin_hari?: number | null
        }
        Update: {
          ada_lewat_jatuh_tempo?: never
          aktif?: boolean | null
          alamat?: string | null
          batas_kredit?: number | null
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          piutang_berjalan?: never
          punya_pesanan_lewat_tempo?: never
          telepon?: string | null
          termin_hari?: number | null
        }
        Relationships: []
      }
      v_pembelian: {
        Row: {
          alasan_tolak: string | null
          barang_id: string | null
          diajukan_oleh: string | null
          diajukan_pada: string | null
          diputuskan_oleh: string | null
          diputuskan_pada: string | null
          diterima_oleh: string | null
          diterima_pada: string | null
          id: string | null
          jumlah_dipesan: number | null
          jumlah_diterima: number | null
          nomor: string | null
          pemasok_id: string | null
          status: string | null
        }
        Insert: {
          alasan_tolak?: string | null
          barang_id?: string | null
          diajukan_oleh?: string | null
          diajukan_pada?: string | null
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          id?: string | null
          jumlah_dipesan?: number | null
          jumlah_diterima?: number | null
          nomor?: string | null
          pemasok_id?: string | null
          status?: string | null
        }
        Update: {
          alasan_tolak?: string | null
          barang_id?: string | null
          diajukan_oleh?: string | null
          diajukan_pada?: string | null
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          id?: string | null
          jumlah_dipesan?: number | null
          jumlah_diterima?: number | null
          nomor?: string | null
          pemasok_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diajukan_oleh_fkey"
            columns: ["diajukan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diputuskan_oleh_fkey"
            columns: ["diputuskan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diterima_oleh_fkey"
            columns: ["diterima_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_pemasok_id_fkey"
            columns: ["pemasok_id"]
            isOneToOne: false
            referencedRelation: "pemasok"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pembelian_manajer: {
        Row: {
          alasan_tolak: string | null
          barang_id: string | null
          diajukan_oleh: string | null
          diajukan_pada: string | null
          diputuskan_oleh: string | null
          diputuskan_pada: string | null
          diterima_oleh: string | null
          diterima_pada: string | null
          harga_beli_satuan: number | null
          id: string | null
          jumlah_dipesan: number | null
          jumlah_diterima: number | null
          nomor: string | null
          pemasok_id: string | null
          status: string | null
          total_estimasi_beli: number | null
        }
        Insert: {
          alasan_tolak?: string | null
          barang_id?: string | null
          diajukan_oleh?: string | null
          diajukan_pada?: string | null
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          harga_beli_satuan?: number | null
          id?: string | null
          jumlah_dipesan?: number | null
          jumlah_diterima?: number | null
          nomor?: string | null
          pemasok_id?: string | null
          status?: string | null
          total_estimasi_beli?: never
        }
        Update: {
          alasan_tolak?: string | null
          barang_id?: string | null
          diajukan_oleh?: string | null
          diajukan_pada?: string | null
          diputuskan_oleh?: string | null
          diputuskan_pada?: string | null
          diterima_oleh?: string | null
          diterima_pada?: string | null
          harga_beli_satuan?: number | null
          id?: string | null
          jumlah_dipesan?: number | null
          jumlah_diterima?: number | null
          nomor?: string | null
          pemasok_id?: string | null
          status?: string | null
          total_estimasi_beli?: never
        }
        Relationships: [
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_barang_id_fkey"
            columns: ["barang_id"]
            isOneToOne: false
            referencedRelation: "v_barang_manajer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diajukan_oleh_fkey"
            columns: ["diajukan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diputuskan_oleh_fkey"
            columns: ["diputuskan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_diterima_oleh_fkey"
            columns: ["diterima_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembelian_pemasok_id_fkey"
            columns: ["pemasok_id"]
            isOneToOne: false
            referencedRelation: "pemasok"
            referencedColumns: ["id"]
          },
        ]
      }
      v_piutang_pelanggan: {
        Row: {
          ada_lewat_jatuh_tempo: boolean | null
          aktif: boolean | null
          alamat: string | null
          batas_kredit: number | null
          id: string | null
          kode: string | null
          nama_toko: string | null
          piutang_berjalan: number | null
          punya_pesanan_lewat_tempo: boolean | null
          telepon: string | null
          termin_hari: number | null
        }
        Insert: {
          ada_lewat_jatuh_tempo?: never
          aktif?: boolean | null
          alamat?: string | null
          batas_kredit?: number | null
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          piutang_berjalan?: never
          punya_pesanan_lewat_tempo?: never
          telepon?: string | null
          termin_hari?: number | null
        }
        Update: {
          ada_lewat_jatuh_tempo?: never
          aktif?: boolean | null
          alamat?: string | null
          batas_kredit?: number | null
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          piutang_berjalan?: never
          punya_pesanan_lewat_tempo?: never
          telepon?: string | null
          termin_hari?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_is_manajer: { Args: never; Returns: boolean }
      fn_peran: { Args: never; Returns: string }
      peran_saya: { Args: never; Returns: string }
      rpc_ajukan_pembelian: {
        Args: { p_barang_id: string; p_jumlah: number; p_pemasok_id: string }
        Returns: Json
      }
      rpc_batalkan_draf: { Args: { p_pesanan_id: string }; Returns: undefined }
      rpc_batalkan_pesanan: {
        Args: { p_alasan?: string; p_pesanan_id: string }
        Returns: Json
      }
      rpc_batalkan_pesanan_terkonfirmasi: {
        Args: { p_alasan: string; p_pesanan_id: string }
        Returns: Json
      }
      rpc_buat_barang: {
        Args: {
          p_harga_jual: number
          p_harga_pokok?: number
          p_kode: string
          p_nama: string
          p_satuan: string
          p_stok_minimum?: number
        }
        Returns: Json
      }
      rpc_buat_pelanggan: {
        Args: {
          p_alamat?: string
          p_batas_kredit?: number
          p_kode: string
          p_nama_toko: string
          p_telepon?: string
          p_termin_hari?: number
        }
        Returns: Json
      }
      rpc_buat_pesanan: { Args: { p_pelanggan_id: string }; Returns: Json }
      rpc_catat_pelunasan: { Args: { p_pesanan_id: string }; Returns: Json }
      rpc_kirim_pesanan: { Args: { p_pesanan_id: string }; Returns: Json }
      rpc_konfirmasi_pesanan: { Args: { p_pesanan_id: string }; Returns: Json }
      rpc_laporan_aging_piutang: {
        Args: never
        Returns: {
          belum_jatuh_tempo: number
          jumlah_pesanan_lewat_tempo: number
          lewat_1_7_hari: number
          lewat_8_30_hari: number
          lewat_gt_30_hari: number
          total_pesanan_dikirim: number
          total_piutang_dikirim: number
        }[]
      }
      rpc_laporan_margin_mingguan: {
        Args: { p_dari?: string; p_sampai?: string }
        Returns: {
          hpp: number
          margin: number
          margin_persen: number
          minggu: string
          omzet: number
        }[]
      }
      rpc_laporan_mingguan: {
        Args: { p_dari?: string; p_sampai?: string }
        Returns: {
          hpp: number
          margin: number
          margin_persen: number
          minggu: string
          omzet: number
        }[]
      }
      rpc_laporan_piutang: {
        Args: never
        Returns: {
          ada_lewat_jatuh_tempo: boolean
          batas_kredit: number
          kode: string
          nama_toko: string
          pelanggan_id: string
          piutang_belum_jatuh_tempo: number
          piutang_lewat_jatuh_tempo: number
          termin_hari: number
          total_piutang: number
        }[]
      }
      rpc_laporan_piutang_pesanan: {
        Args: { p_pelanggan_id?: string }
        Returns: {
          dikirim_pada: string
          hari_lewat: number
          jatuh_tempo: string
          kategori_aging: string
          nama_toko: string
          nomor: string
          pelanggan_id: string
          pesanan_id: string
          telepon: string
          total: number
        }[]
      }
      rpc_laporan_ringkasan: {
        Args: { p_dari?: string; p_sampai?: string }
        Returns: {
          jumlah_pesanan: number
          margin_persen: number
          pesanan_dikirim: number
          pesanan_lunas: number
          total_hpp: number
          total_margin: number
          total_omzet: number
        }[]
      }
      rpc_laporan_top_barang: {
        Args: { p_dari?: string; p_limit?: number; p_sampai?: string }
        Returns: {
          barang_id: string
          jumlah_terjual: number
          kode: string
          margin_persen: number
          nama: string
          satuan: string
          total_hpp: number
          total_margin: number
          total_omzet: number
        }[]
      }
      rpc_laporan_top_pelanggan: {
        Args: { p_dari?: string; p_limit?: number; p_sampai?: string }
        Returns: {
          jumlah_pesanan: number
          kode: string
          nama_toko: string
          pelanggan_id: string
          total_margin: number
          total_omzet: number
        }[]
      }
      rpc_lunasi_pesanan: { Args: { p_pesanan_id: string }; Returns: Json }
      rpc_penyesuaian_stok: {
        Args: { p_alasan: string; p_barang_id: string; p_stok_baru: number }
        Returns: Json
      }
      rpc_putuskan_pembelian: {
        Args: { p_nilai: string; p_pembelian_id: string; p_tindakan: string }
        Returns: Json
      }
      rpc_sesuaikan_stok: {
        Args: { p_alasan: string; p_barang_id: string; p_stok_baru: number }
        Returns: Json
      }
      rpc_set_batas_kredit: {
        Args: { p_batas: number; p_pelanggan_id: string }
        Returns: Json
      }
      rpc_set_harga_jual: {
        Args: { p_barang_id: string; p_nilai: number }
        Returns: Json
      }
      rpc_set_harga_pokok: {
        Args: { p_barang_id: string; p_nilai: number }
        Returns: Json
      }
      rpc_set_peran: {
        Args: { p_aktif?: boolean; p_peran: string; p_profile_id: string }
        Returns: Json
      }
      rpc_set_termin: {
        Args: { p_pelanggan_id: string; p_termin: number }
        Returns: Json
      }
      rpc_setujui_pembelian: {
        Args: { p_harga_beli_satuan: number; p_pembelian_id: string }
        Returns: Json
      }
      rpc_simpan_draf_pesanan: {
        Args: { p_items: Json; p_pelanggan_id: string; p_pesanan_id?: string }
        Returns: Json
      }
      rpc_simpan_item_pesanan: {
        Args: {
          p_barang_id: string
          p_diskon?: number
          p_harga_satuan?: number
          p_jumlah: number
          p_pesanan_id: string
        }
        Returns: Json
      }
      rpc_terima_pembelian: {
        Args: { p_jumlah_diterima: number; p_pembelian_id: string }
        Returns: Json
      }
      rpc_tolak_pembelian: {
        Args: { p_alasan: string; p_pembelian_id: string }
        Returns: Json
      }
      rpc_ubah_batas_kredit: {
        Args: { p_batas: number; p_pelanggan_id: string }
        Returns: Json
      }
      rpc_ubah_harga_jual: {
        Args: { p_barang_id: string; p_nilai: number }
        Returns: Json
      }
      rpc_ubah_harga_pokok: {
        Args: { p_barang_id: string; p_nilai: number }
        Returns: Json
      }
      rpc_ubah_peran: {
        Args: { p_peran: string; p_profile_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
