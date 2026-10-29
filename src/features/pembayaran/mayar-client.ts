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
  private timeoutMs: number;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey.replace(/^Bearer\s+/i, '').trim();
    let url = (baseUrl || process.env.MAYAR_BASE_URL || 'https://api.mayar.io/hl/v1').replace(/\/+$/, '');
    // Migrasi domain lama api.mayar.club yang sering mengalami rate-limit/timeout ke domain resmi api.mayar.io
    if (url.includes('api.mayar.club')) {
      url = url.replace('api.mayar.club', 'api.mayar.io');
    }
    this.baseUrl = url;
    this.timeoutMs = Number(process.env.MAYAR_TIMEOUT_MS) || 15000;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/invoice/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          redirect_url: params.redirect_url || params.redirectUrl,
          success_url: params.success_url || params.redirectUrl,
        }),
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
        link: json.data.link || `https://pay.mayar.io/p/${json.data.id}`,
        expiredAt: json.data.expiredAt || params.expiredAt,
        amount: json.data.amount || totalAmount,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Koneksi ke gateway pembayaran Mayar timeout (melebihi ${Math.round(this.timeoutMs / 1000)} detik)`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getInvoice(invoiceId: string): Promise<GetInvoiceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

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
        throw new Error(`Koneksi ke gateway pembayaran Mayar timeout (melebihi ${Math.round(this.timeoutMs / 1000)} detik)`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async closeInvoice(invoiceId: string): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

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

/**
 * Client Mayar nonaktif untuk implementasi fail-closed di lingkungan produksi
 * atau lingkungan tanpa konfigurasi kredensial resmi.
 */
export class DisabledMayarClient implements MayarClient {
  async createInvoice(): Promise<CreateInvoiceResponse> {
    throw new Error('Integrasi pembayaran Mayar belum dikonfigurasi (MAYAR_API_KEY tidak ditemukan)');
  }

  async getInvoice(): Promise<GetInvoiceResponse> {
    throw new Error('Integrasi pembayaran Mayar belum dikonfigurasi (MAYAR_API_KEY tidak ditemukan)');
  }

  async closeInvoice(): Promise<boolean> {
    return false;
  }
}

// Instance singleton mock global untuk lingkungan simulasi lokal
export const globalMockMayarClient = new MockMayarClient();

/**
 * Helper untuk memeriksa apakah integrasi Mayar aktif dan terkonfigurasi.
 */
export function isMayarConfigured(): boolean {
  const apiKey = process.env.MAYAR_API_KEY;
  const hasApiKey = Boolean(apiKey && apiKey.trim() !== '' && !apiKey.includes('placeholder'));
  if (hasApiKey) return true;

  // Mock hanya boleh aktif jika BUKAN produksi DAN MAYAR_MOCK === 'true'
  const isMockActive = process.env.NODE_ENV !== 'production' && process.env.MAYAR_MOCK === 'true';
  return isMockActive;
}

/**
 * Factory pengambil instance MayarClient.
 * 1. Jika customClient diberikan (misal saat testing), gunakan customClient.
 * 2. Jika MAYAR_API_KEY tersedia, gunakan HttpMayarClient.
 * 3. MockMayarClient HANYA aktif jika NODE_ENV != 'production' DAN MAYAR_MOCK === 'true'.
 * 4. Selain itu (termasuk di production tanpa API key): gagal tertutup (DisabledMayarClient).
 */
export function getMayarClient(customClient?: MayarClient): MayarClient {
  if (customClient) {
    return customClient;
  }

  // Jika mode mock diaktifkan di development/test, gunakan MockMayarClient untuk simulasi offline
  if (process.env.NODE_ENV !== 'production' && process.env.MAYAR_MOCK === 'true') {
    return globalMockMayarClient;
  }

  const apiKey = process.env.MAYAR_API_KEY;
  if (apiKey && apiKey.trim() !== '' && !apiKey.includes('placeholder')) {
    return new HttpMayarClient(apiKey);
  }

  return new DisabledMayarClient();
}
