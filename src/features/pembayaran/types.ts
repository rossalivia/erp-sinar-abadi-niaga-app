export type StatusTagihanMayar =
  | 'dibuat'
  | 'dibayar'
  | 'kedaluwarsa'
  | 'ditutup'
  | 'perlu_tinjau';

export type HasilWebhookMayar =
  | 'diproses'
  | 'diabaikan'
  | 'ditolak'
  | 'tidak_dikenal'
  | 'gagal_verifikasi';

export interface TagihanMayarRow {
  id: string;
  pesanan_jual_id: string;
  nomor_pesanan?: string;
  kode_pelanggan?: string;
  nama_toko?: string;
  mayar_invoice_id: string;
  mayar_transaction_id: string | null;
  tautan: string;
  jumlah: number;
  status: StatusTagihanMayar;
  status_efektif?: StatusTagihanMayar;
  email_penerima: string;
  berlaku_sampai: string;
  dibuat_pada: string;
  dibayar_pada: string | null;
  catatan_tinjau: string | null;
  pembuat_nama?: string;
}

export interface MayarInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface CreateInvoiceParams {
  name: string;
  email: string;
  mobile: string;
  redirectUrl: string;
  description: string;
  expiredAt: string; // ISO 8601 UTC
  items: MayarInvoiceItem[];
  extraData: {
    noCustomer: string;
    idProd: string;
  };
}

export interface CreateInvoiceResponse {
  id: string; // mayar_invoice_id
  transactionId?: string;
  link: string; // Tautan pembayaran Mayar
  expiredAt: string;
  amount: number;
}

export interface GetInvoiceResponse {
  id: string;
  status: 'paid' | 'unpaid' | 'closed';
  amount: number;
  transactionId?: string;
  paidAt?: string;
}

export interface MayarClient {
  createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse>;
  getInvoice(invoiceId: string): Promise<GetInvoiceResponse>;
  closeInvoice(invoiceId: string): Promise<boolean>;
}

export interface BuatTagihanInput {
  pesananId: string;
  email: string;
  masaBerlakuHari: number;
}

export interface ServiceResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errorCode?: string;
}
