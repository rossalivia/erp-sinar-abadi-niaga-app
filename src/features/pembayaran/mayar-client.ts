import type {
  MayarClient,
  CreateInvoiceParams,
  CreateInvoiceResponse,
  GetInvoiceResponse,
} from './types';

/**
 * Implementasi Nyata MayarClient via HTTP Request ke Mayar API Sandbox (M6).
 */
export class HttpMayarClient implements MayarClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || process.env.MAYAR_BASE_URL || 'https://api.mayar.club/hl/v1').replace(/\/+$/, '');
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Batas 8 detik (M6)

    try {
      const res = await fetch(`${this.baseUrl}/invoice/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.data?.id) {
        const errorText = json?.messages || json?.message || `HTTP ${res.status}`;
        throw new Error(`Gagal membuat tagihan di Mayar: ${errorText}`);
      }

      const totalAmount =
        params.items?.reduce((sum, it) => sum + it.rate * it.quantity, 0) ||
        (params as unknown as { amount?: number }).amount ||
        0;

      return {
        id: json.data.id,
        transactionId: json.data.transactionId || json.data.id,
        link: json.data.link || `https://pay.mayar.club/p/${json.data.id}`,
        expiredAt: json.data.expiredAt || params.expiredAt,
        amount: json.data.amount || totalAmount,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Koneksi ke gateway pembayaran Mayar timeout (melebihi 8 detik)');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/invoice/${invoiceId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.data) {
        const errorText = json?.messages || json?.message || `HTTP ${res.status}`;
        throw new Error(`Gagal membaca status tagihan dari Mayar: ${errorText}`);
      }

      return {
        id: json.data.id || invoiceId,
        status: json.data.status || 'unpaid',
        amount: Number(json.data.amount) || 0,
        transactionId: json.data.transactionId,
        paidAt: json.data.paidAt,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Koneksi ke gateway pembayaran Mayar timeout (melebihi 8 detik)');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async closeInvoice(invoiceId: string): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/invoice/close/${invoiceId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      return res.ok;
    } catch {
      // Best-effort close: abaikan error penutupan eksternal
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Implementasi Tiruan (Mock) untuk Pengujian dan Simulasi Mandiri (M6).
 * Beroperasi saat MAYAR_API_KEY belum dikonfigurasi.
 */
export class MockMayarClient implements MayarClient {
  public simulatedStatus: 'paid' | 'unpaid' | 'closed' = 'unpaid';
  public simulatedAmount?: number;
  public shouldFailNetwork = false;
  public invoices: Map<string, CreateInvoiceResponse & { status: 'paid' | 'unpaid' | 'closed' }> = new Map();

  async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse> {
    if (this.shouldFailNetwork) {
      throw new Error('Koneksi ke gateway pembayaran Mayar timeout (simulasi mock)');
    }

    const totalAmount =
      params.items?.reduce((sum, it) => sum + it.rate * it.quantity, 0) ||
      (params as unknown as { amount?: number }).amount ||
      0;
    const mockId = `inv_sim_${Math.random().toString(36).substring(2, 10)}`;
    const mockTrxId = `trx_sim_${Math.random().toString(36).substring(2, 10)}`;

    const response: CreateInvoiceResponse = {
      id: mockId,
      transactionId: mockTrxId,
      link: `https://pay.mayar.club/p/${mockId}`,
      expiredAt: params.expiredAt,
      amount: totalAmount,
    };

    this.invoices.set(mockId, {
      ...response,
      status: this.simulatedStatus,
    });

    return response;
  }

  async getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
    if (this.shouldFailNetwork) {
      throw new Error('Koneksi ke gateway pembayaran Mayar timeout (simulasi mock)');
    }

    const stored = this.invoices.get(invoiceId);
    const amount = this.simulatedAmount ?? stored?.amount ?? 100000;
    const status = stored ? stored.status : this.simulatedStatus;

    return {
      id: invoiceId,
      status,
      amount,
      transactionId: stored?.transactionId || `trx_${invoiceId}`,
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
    };
  }

  async closeInvoice(invoiceId: string): Promise<boolean> {
    const stored = this.invoices.get(invoiceId);
    if (stored) {
      stored.status = 'closed';
    }
    return true;
  }
}

// Instance singleton mock global untuk lingkungan simulasi lokal
const globalMockMayarClient = new MockMayarClient();

/**
 * Factory pengambil instance MayarClient.
 * Jika MAYAR_API_KEY tersedia, gunakan HttpMayarClient.
 * Jika tidak, gunakan MockMayarClient agar aplikasi tetap berfungsi dalam mode simulasi.
 */
export function getMayarClient(customClient?: MayarClient): MayarClient {
  if (customClient) {
    return customClient;
  }

  const apiKey = process.env.MAYAR_API_KEY;
  if (apiKey && apiKey.trim() !== '' && !apiKey.includes('placeholder')) {
    return new HttpMayarClient(apiKey);
  }

  return globalMockMayarClient;
}
