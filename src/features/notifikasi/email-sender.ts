export interface SendEmailParams {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface EmailSender {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

/**
 * Implementasi pengirim email resmi menggunakan Resend API.
 */
export class ResendEmailSender implements EmailSender {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('RESEND_API_KEY wajib dikonfigurasi');
    }
    this.apiKey = apiKey;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (params.idempotencyKey) {
      headers['Idempotency-Key'] = params.idempotencyKey;
    }

    const payload = {
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(`Gagal mengirim email via Resend: ${errorMsg}`);
    }

    return {
      id: data?.id || 'resend_ok',
      success: true,
    };
  }
}

/**
 * Implementasi pengirim email tiruan (mock) untuk pengujian unit & integrasi.
 */
export class MockEmailSender implements EmailSender {
  public sentEmails: SendEmailParams[] = [];
  public shouldFail = false;
  public failureMessage = 'Simulasi kegagalan koneksi SMTP Resend';

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }

    this.sentEmails.push({ ...params });

    return {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      success: true,
    };
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}
