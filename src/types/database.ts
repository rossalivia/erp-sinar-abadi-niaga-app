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
          pelaku_id: string | null
        }
        Insert: {
          aksi: string
          data_id?: string | null
          dibuat_pada?: string
          id?: never
          nama_tabel: string
          nilai_baru?: Json | null
          nilai_lama?: Json | null
          pelaku_id?: string | null
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
      impor_data: {
        Row: {
          id: string
          nomor: string
          jenis: string
          nama_berkas: string
          jumlah_baris: number
          jumlah_dibuat: number
          status: string
          ringkasan: Json
          dibuat_oleh: string
          dibuat_pada: string
        }
        Insert: {
          id?: string
          nomor: string
          jenis: string
          nama_berkas: string
          jumlah_baris: number
          jumlah_dibuat: number
          status: string
          ringkasan?: Json
          dibuat_oleh: string
          dibuat_pada?: string
        }
        Update: {
          id?: string
          nomor?: string
          jenis?: string
          nama_berkas?: string
          jumlah_baris?: number
          jumlah_dibuat?: number
          status?: string
          ringkasan?: Json
          dibuat_oleh?: string
          dibuat_pada?: string
        }
        Relationships: [
          {
            foreignKeyName: "impor_data_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
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
      persetujuan_harga: {
        Row: {
          id: string
          pesanan_jual_id: string
          status: string
          diajukan_oleh: string
          diajukan_pada: string
          catatan_pengaju: string | null
          keputusan_oleh: string | null
          keputusan_pada: string | null
          catatan_keputusan: string | null
          alasan_tolak: string | null
          snapshot_hash: string
          berlaku_sampai: string | null
          dipakai_pada: string | null
        }
        Insert: {
          id?: string
          pesanan_jual_id: string
          status?: string
          diajukan_oleh: string
          diajukan_pada?: string
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          snapshot_hash: string
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
        }
        Update: {
          id?: string
          pesanan_jual_id?: string
          status?: string
          diajukan_oleh?: string
          diajukan_pada?: string
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          snapshot_hash?: string
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persetujuan_harga_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persetujuan_harga_diajukan_oleh_fkey"
            columns: ["diajukan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persetujuan_harga_keputusan_oleh_fkey"
            columns: ["keputusan_oleh"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tagihan_mayar: {
        Row: {
          berlaku_hingga: string
          dibayar_pada: string | null
          dibuat_pada: string
          diperbarui_pada: string
          id: string
          link_pembayaran: string
          mayar_invoice_id: string
          pesanan_jual_id: string
          status: 'dibuat' | 'dibayar' | 'ditutup' | 'perlu_tinjau'
          total: number
        }
        Insert: {
          berlaku_hingga: string
          dibayar_pada?: string | null
          dibuat_pada?: string
          diperbarui_pada?: string
          id?: string
          link_pembayaran: string
          mayar_invoice_id: string
          pesanan_jual_id: string
          status?: 'dibuat' | 'dibayar' | 'ditutup' | 'perlu_tinjau'
          total: number
        }
        Update: {
          berlaku_hingga?: string
          dibayar_pada?: string | null
          dibuat_pada?: string
          diperbarui_pada?: string
          id?: string
          link_pembayaran?: string
          mayar_invoice_id?: string
          pesanan_jual_id?: string
          status?: 'dibuat' | 'dibayar' | 'ditutup' | 'perlu_tinjau'
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "tagihan_mayar_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          }
        ]
      }
      mayar_webhook_event: {
        Row: {
          catatan: string | null
          diterima_pada: string
          event_id: string
          event_type: string
          hasil_proses: 'sukses' | 'diabaikan' | 'perlu_tinjau' | 'gagal'
          id: string
          mayar_invoice_id: string | null
          mayar_payment_id: string | null
          nominal: number | null
          status_pembayaran: string | null
        }
        Insert: {
          catatan?: string | null
          diterima_pada?: string
          event_id: string
          event_type: string
          hasil_proses: 'sukses' | 'diabaikan' | 'perlu_tinjau' | 'gagal'
          id?: string
          mayar_invoice_id?: string | null
          mayar_payment_id?: string | null
          nominal?: number | null
          status_pembayaran?: string | null
        }
        Update: {
          catatan?: string | null
          diterima_pada?: string
          event_id?: string
          event_type?: string
          hasil_proses?: 'sukses' | 'diabaikan' | 'perlu_tinjau' | 'gagal'
          id?: string
          mayar_invoice_id?: string | null
          mayar_payment_id?: string | null
          nominal?: number | null
          status_pembayaran?: string | null
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
          piutang_terkonfirmasi: number | null
          piutang_terkirim: number | null
          sisa_kredit: number | null
          jumlah_faktur_overdue: number | null
          hari_terlambat_terlama: number | null
          punya_overdue: boolean | null
          boleh_transaksi: boolean | null
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
      v_pelanggan_kredit: {
        Row: {
          id: string | null
          kode: string | null
          nama_toko: string | null
          telepon: string | null
          alamat: string | null
          termin_hari: number | null
          aktif: boolean | null
          batas_kredit: number | null
          piutang_terkonfirmasi: number | null
          piutang_terkirim: number | null
          piutang_berjalan: number | null
          sisa_kredit: number | null
          jumlah_faktur_overdue: number | null
          hari_terlambat_terlama: number | null
          punya_overdue: boolean | null
          boleh_transaksi: boolean | null
        }
        Insert: {
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          telepon?: string | null
          alamat?: string | null
          termin_hari?: number | null
          aktif?: boolean | null
          batas_kredit?: number | null
        }
        Update: {
          id?: string | null
          kode?: string | null
          nama_toko?: string | null
          telepon?: string | null
          alamat?: string | null
          termin_hari?: number | null
          aktif?: boolean | null
          batas_kredit?: number | null
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
      v_persetujuan_harga: {
        Row: {
          id: string | null
          pesanan_jual_id: string | null
          nomor_pesanan: string | null
          total_pesanan: number | null
          pelanggan_id: string | null
          nama_pelanggan: string | null
          status: string | null
          diajukan_oleh: string | null
          nama_pengaju: string | null
          diajukan_pada: string | null
          catatan_pengaju: string | null
          keputusan_oleh: string | null
          nama_pemutus: string | null
          keputusan_pada: string | null
          catatan_keputusan: string | null
          alasan_tolak: string | null
          berlaku_sampai: string | null
          dipakai_pada: string | null
        }
        Insert: {
          id?: string | null
          pesanan_jual_id?: string | null
          nomor_pesanan?: string | null
          total_pesanan?: number | null
          pelanggan_id?: string | null
          nama_pelanggan?: string | null
          status?: string | null
          diajukan_oleh?: string | null
          nama_pengaju?: string | null
          diajukan_pada?: string | null
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          nama_pemutus?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
        }
        Update: {
          id?: string | null
          pesanan_jual_id?: string | null
          nomor_pesanan?: string | null
          total_pesanan?: number | null
          pelanggan_id?: string | null
          nama_pelanggan?: string | null
          status?: string | null
          diajukan_oleh?: string | null
          nama_pengaju?: string | null
          diajukan_pada?: string | null
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          nama_pemutus?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persetujuan_harga_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          }
        ]
      }
      v_persetujuan_harga_manajer: {
        Row: {
          persetujuan_id: string | null
          pesanan_jual_id: string | null
          nomor_pesanan: string | null
          total_pesanan: number | null
          pelanggan_id: string | null
          nama_pelanggan: string | null
          status: string | null
          diajukan_oleh: string | null
          nama_pengaju: string | null
          diajukan_pada: string | null
          catatan_pengaju: string | null
          keputusan_oleh: string | null
          nama_pemutus: string | null
          keputusan_pada: string | null
          catatan_keputusan: string | null
          alasan_tolak: string | null
          snapshot_hash: string | null
          berlaku_sampai: string | null
          dipakai_pada: string | null
          item_id: string | null
          barang_id: string | null
          kode_barang: string | null
          nama_barang: string | null
          jumlah: number | null
          harga_satuan: number | null
          diskon_persen: number | null
          subtotal: number | null
          hpp_satuan: number | null
          margin_satuan: number | null
          margin_total: number | null
        }
        Insert: {
          persetujuan_id?: string | null
          pesanan_jual_id?: string | null
          nomor_pesanan?: string | null
          total_pesanan?: number | null
          pelanggan_id?: string | null
          nama_pelanggan?: string | null
          status?: string | null
          diajukan_oleh?: string | null
          nama_pengaju?: string | null
          diajukan_pada?: string | null
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          nama_pemutus?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          snapshot_hash?: string | null
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
          item_id?: string | null
          barang_id?: string | null
          kode_barang?: string | null
          nama_barang?: string | null
          jumlah?: number | null
          harga_satuan?: number | null
          diskon_persen?: number | null
          subtotal?: number | null
          hpp_satuan?: number | null
          margin_satuan?: number | null
          margin_total?: number | null
        }
        Update: {
          persetujuan_id?: string | null
          pesanan_jual_id?: string | null
          nomor_pesanan?: string | null
          total_pesanan?: number | null
          pelanggan_id?: string | null
          nama_pelanggan?: string | null
          status?: string | null
          diajukan_oleh?: string | null
          nama_pengaju?: string | null
          diajukan_pada?: string | null
          catatan_pengaju?: string | null
          keputusan_oleh?: string | null
          nama_pemutus?: string | null
          keputusan_pada?: string | null
          catatan_keputusan?: string | null
          alasan_tolak?: string | null
          snapshot_hash?: string | null
          berlaku_sampai?: string | null
          dipakai_pada?: string | null
          item_id?: string | null
          barang_id?: string | null
          kode_barang?: string | null
          nama_barang?: string | null
          jumlah?: number | null
          harga_satuan?: number | null
          diskon_persen?: number | null
          subtotal?: number | null
          hpp_satuan?: number | null
          margin_satuan?: number | null
          margin_total?: number | null
        }
        Relationships: []
      }
      catatan_penagihan: {
        Row: {
          id: string
          pelanggan_id: string
          pesanan_jual_id: string | null
          jenis: string
          isi: string
          janji_bayar_tanggal: string | null
          dibuat_oleh: string
          dibuat_pada: string
        }
        Insert: {
          id?: string
          pelanggan_id: string
          pesanan_jual_id?: string | null
          jenis: string
          isi: string
          janji_bayar_tanggal?: string | null
          dibuat_oleh?: string
          dibuat_pada?: string
        }
        Update: {
          id?: string
          pelanggan_id?: string
          pesanan_jual_id?: string | null
          jenis?: string
          isi?: string
          janji_bayar_tanggal?: string | null
          dibuat_oleh?: string
          dibuat_pada?: string
        }
        Relationships: [
          {
            foreignKeyName: "catatan_penagihan_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "pelanggan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catatan_penagihan_pesanan_jual_id_fkey"
            columns: ["pesanan_jual_id"]
            isOneToOne: false
            referencedRelation: "pesanan_jual"
            referencedColumns: ["id"]
          }
        ]
      }
      v_tagihan: {
        Row: {
          pesanan_id: string
          nomor_pesanan: string
          pelanggan_id: string
          kode_pelanggan: string
          nama_toko: string
          telepon: string | null
          alamat: string | null
          termin_hari: number
          batas_kredit: number
          total: number
          dibuat_oleh: string
          nama_sales: string
          dibuat_pada: string
          dikirim_pada: string | null
          jatuh_tempo: string
          hari_terlambat: number
          hari_menuju: number
          klasifikasi: string
          janji_bayar_tanggal: string | null
          janji_catatan: string | null
          status_janji: string
        }
        Insert: {
          pesanan_id?: string
          nomor_pesanan?: string
          pelanggan_id?: string
          kode_pelanggan?: string
          nama_toko?: string
          telepon?: string | null
          alamat?: string | null
          termin_hari?: number
          batas_kredit?: number
          total?: number
          dibuat_oleh?: string
          nama_sales?: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          jatuh_tempo?: string
          hari_terlambat?: number
          hari_menuju?: number
          klasifikasi?: string
          janji_bayar_tanggal?: string | null
          janji_catatan?: string | null
          status_janji?: string
        }
        Update: {
          pesanan_id?: string
          nomor_pesanan?: string
          pelanggan_id?: string
          kode_pelanggan?: string
          nama_toko?: string
          telepon?: string | null
          alamat?: string | null
          termin_hari?: number
          batas_kredit?: number
          total?: number
          dibuat_oleh?: string
          nama_sales?: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          jatuh_tempo?: string
          hari_terlambat?: number
          hari_menuju?: number
          klasifikasi?: string
          janji_bayar_tanggal?: string | null
          janji_catatan?: string | null
          status_janji?: string
        }
        Relationships: []
      }
      v_surat_jalan: {
        Row: {
          catatan: string | null
          dibuat_oleh: string
          dibuat_pada: string
          dikirim_pada: string | null
          id: string
          nomor: string
          pelanggan_alamat: string | null
          pelanggan_id: string
          pelanggan_kode: string
          pelanggan_nama: string
          pelanggan_telepon: string | null
          pembuat_nama: string
          status: string
        }
        Insert: {
          catatan?: string | null
          dibuat_oleh: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          id?: string
          nomor: string
          pelanggan_alamat?: string | null
          pelanggan_id: string
          pelanggan_kode: string
          pelanggan_nama: string
          pelanggan_telepon?: string | null
          pembuat_nama: string
          status: string
        }
        Update: {
          catatan?: string | null
          dibuat_oleh?: string
          dibuat_pada?: string
          dikirim_pada?: string | null
          id?: string
          nomor?: string
          pelanggan_alamat?: string | null
          pelanggan_id?: string
          pelanggan_kode?: string
          pelanggan_nama?: string
          pelanggan_telepon?: string | null
          pembuat_nama?: string
          status?: string
        }
        Relationships: []
      }
      v_surat_jalan_item: {
        Row: {
          barang_id: string
          id: string
          jumlah: number
          kode_barang: string
          nama_barang: string
          pesanan_jual_id: string
          satuan: string
        }
        Insert: {
          barang_id: string
          id?: string
          jumlah: number
          kode_barang: string
          nama_barang: string
          pesanan_jual_id: string
          satuan: string
        }
        Update: {
          barang_id?: string
          id?: string
          jumlah?: number
          kode_barang?: string
          nama_barang?: string
          pesanan_jual_id?: string
          satuan?: string
        }
        Relationships: []
      }
      notifikasi_email_log: {
        Row: {
          dibuat_pada: string
          diperbarui_pada: string
          galat_singkat: string | null
          id: string
          jenis: string
          jumlah_barang: number
          jumlah_penerima: number
          status: string
          tanggal_bisnis: string
        }
        Insert: {
          dibuat_pada?: string
          diperbarui_pada?: string
          galat_singkat?: string | null
          id?: string
          jenis: string
          jumlah_barang?: number
          jumlah_penerima?: number
          status: string
          tanggal_bisnis: string
        }
        Update: {
          dibuat_pada?: string
          diperbarui_pada?: string
          galat_singkat?: string | null
          id?: string
          jenis?: string
          jumlah_barang?: number
          jumlah_penerima?: number
          status?: string
          tanggal_bisnis?: string
        }
        Relationships: []
      }
    }
    Functions: {
      rpc_sistem_daftar_stok_menipis: {
        Args: Record<string, never>
        Returns: {
          kode: string
          nama: string
          satuan: string
          stok: number
          stok_minimum: number
          selisih: number
        }[]
      }
      rpc_sistem_penerima_notifikasi_stok: {
        Args: Record<string, never>
        Returns: {
          email: string
          nama_lengkap: string
          peran: string
        }[]
      }
      rpc_sistem_klaim_notifikasi: {
        Args: {
          p_jenis: string
          p_tanggal_bisnis: string
        }
        Returns: {
          boleh_kirim: boolean
          log_id: string
          pesan: string
        }[]
      }
      rpc_sistem_selesaikan_notifikasi: {
        Args: {
          p_galat?: string | null
          p_jumlah_barang: number
          p_jumlah_penerima: number
          p_log_id: string
          p_status: string
        }
        Returns: boolean
      }
      rpc_riwayat_notifikasi_manajer: {
        Args: Record<string, never>
        Returns: {
          dibuat_pada: string
          diperbarui_pada: string
          galat_singkat: string | null
          id: string
          jenis: string
          jumlah_barang: number
          jumlah_penerima: number
          status: string
          tanggal_bisnis: string
        }[]
      }
      rpc_impor_barang: {
        Args: {
          p_nama_berkas: string
          p_items: Json
        }
        Returns: Json
      }
      rpc_impor_pelanggan: {
        Args: {
          p_nama_berkas: string
          p_items: Json
        }
        Returns: Json
      }
      rpc_catat_penagihan: {
        Args: {
          p_pelanggan_id: string
          p_pesanan_jual_id?: string | null
          p_jenis?: string
          p_isi?: string
          p_janji_bayar_tanggal?: string | null
        }
        Returns: Json
      }
      rpc_baca_catatan_penagihan: {
        Args: {
          p_pelanggan_id: string
          p_pesanan_jual_id?: string | null
        }
        Returns: {
          id: string
          pelanggan_id: string
          pesanan_jual_id: string | null
          nomor_pesanan: string | null
          jenis: string
          isi: string
          janji_bayar_tanggal: string | null
          status_janji: string
          dibuat_oleh: string
          nama_pembuat: string
          dibuat_pada: string
        }[]
      }
      fn_is_manajer: { Args: never; Returns: boolean }
      fn_peran: { Args: never; Returns: string }
      peran_saya: { Args: never; Returns: string }
      rpc_ajukan_pembelian: {
        Args: { p_barang_id: string; p_jumlah: number; p_pemasok_id: string }
        Returns: Json
      }
      rpc_ajukan_persetujuan_harga: {
        Args: {
          p_pesanan_id: string
          p_catatan?: string | null
        }
        Returns: Json
      }
      rpc_ambil_daftar_picking: {
        Args: { p_pesanan_ids: string[] }
        Returns: Json
      }
      rpc_analitik_performa_sales: {
        Args: {
          p_dari?: string | null
          p_sampai?: string | null
        }
        Returns: {
          sales_id: string
          nama_sales: string
          email: string
          aktif: boolean
          jumlah_pesanan: number
          pesanan_dikirim: number
          pesanan_lunas: number
          total_omzet: number
          total_hpp: number
          total_margin: number
          margin_persen: number
          piutang_berjalan: number
          jumlah_draf: number
        }[]
      }
      rpc_analitik_top_pelanggan: {
        Args: {
          p_dari?: string | null
          p_sampai?: string | null
          p_limit?: number | null
        }
        Returns: {
          pelanggan_id: string
          kode: string
          nama_toko: string
          telepon: string
          jumlah_pesanan: number
          total_omzet: number
          total_hpp: number
          total_margin: number
          margin_persen: number
          kontribusi_omzet_persen: number
          batas_kredit: number
          sisa_kredit: number
          status_kredit: string
        }[]
      }
      rpc_analitik_pelanggan_tidak_aktif: {
        Args: {
          p_ambang_hari?: number | null
        }
        Returns: {
          pelanggan_id: string
          kode: string
          nama_toko: string
          telepon: string
          alamat: string
          terdaftar_pada: string
          pesanan_terakhir_pada: string | null
          nomor_pesanan_terakhir: string | null
          hari_tidak_aktif: number
          total_pesanan_historis: number
          total_omzet_historis: number
          piutang_berjalan: number
        }[]
      }
      rpc_analitik_barang_tidak_bergerak: {
        Args: {
          p_ambang_hari?: number | null
        }
        Returns: {
          barang_id: string
          kode: string
          nama: string
          satuan: string
          stok_saat_ini: number
          stok_minimum: number
          harga_pokok: number
          harga_jual: number
          nilai_stok_mengendap: number
          penjualan_terakhir_pada: string | null
          nomor_pesanan_terakhir: string | null
          hari_mengendap: number
        }[]
      }
      rpc_batalkan_pengajuan_harga: {
        Args: {
          p_id: string
        }
        Returns: undefined
      }
      rpc_putuskan_persetujuan_harga: {
        Args: {
          p_id: string
          p_setuju: boolean
          p_catatan?: string | null
          p_alasan_tolak?: string | null
        }
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
      fn_hitung_kredit_pelanggan: {
        Args: { p_pelanggan_id: string }
        Returns: {
          batas_kredit: number
          piutang_terkonfirmasi: number
          piutang_terkirim: number
          piutang_berjalan: number
          sisa_kredit: number
          jumlah_faktur_overdue: number
          hari_terlambat_terlama: number
          punya_overdue: boolean
          boleh_transaksi: boolean
        }[]
      }
      rpc_get_kredit_pelanggan: {
        Args: { p_pelanggan_id: string }
        Returns: Json
      }
      rpc_get_faktur_overdue_pelanggan: {
        Args: { p_pelanggan_id: string }
        Returns: {
          id: string
          nomor: string
          dikirim_pada: string | null
          jatuh_tempo: string
          total: number
          hari_terlambat: number
        }[]
      }
      rpc_get_tugas_harian: {
        Args: never
        Returns: Json
      }
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
