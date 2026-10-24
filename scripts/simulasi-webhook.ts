/**
 * Skrip Simulasi Webhook Mayar (Sandbox / Development)
 *
 * Penggunaan:
 *   npx tsx scripts/simulasi-webhook.ts [opsi]
 *
 * Contoh:
 *   npx tsx scripts/simulasi-webhook.ts --invoice-id=inv_mock_123 --amount=1500000
 *   npx tsx scripts/simulasi-webhook.ts --invalid-token
 *   npx tsx scripts/simulasi-webhook.ts --event=payment.failed
 */

interface WebhookArgs {
  url?: string;
  token?: string;
  invoiceId?: string;
  paymentId?: string;
  amount?: number;
  event?: string;
  invalidToken?: boolean;
  malformedJson?: boolean;
}

function parseArgs(): WebhookArgs {
  const args = process.argv.slice(2);
  const result: WebhookArgs = {};

  for (const arg of args) {
    if (arg.startsWith('--url=')) result.url = arg.split('=')[1];
    else if (arg.startsWith('--token=')) result.token = arg.split('=')[1];
    else if (arg.startsWith('--invoice-id=')) result.invoiceId = arg.split('=')[1];
    else if (arg.startsWith('--payment-id=')) result.paymentId = arg.split('=')[1];
    else if (arg.startsWith('--amount=')) result.amount = Number(arg.split('=')[1]);
    else if (arg.startsWith('--event=')) result.event = arg.split('=')[1];
    else if (arg === '--invalid-token') result.invalidToken = true;
    else if (arg === '--malformed-json') result.malformedJson = true;
  }

  return result;
}

async function main() {
  const options = parseArgs();

  const baseUrl = options.url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const validToken = process.env.MAYAR_WEBHOOK_TOKEN || 'mayar_webhook_test_token_secret_12345';
  const token = options.invalidToken ? 'token_palsu_tidak_valid' : (options.token || validToken);

  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/webhooks/mayar/${token}`;
  console.log('--------------------------------------------------');
  console.log('Simulasi Webhook Mayar');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Token: ${options.invalidToken ? '[INVALID TOKEN]' : '[VALID TOKEN]'}`);
  console.log('--------------------------------------------------');

  let body: string;

  if (options.malformedJson) {
    body = '{ "event": "payment.received", "data": broken-json';
    console.log('Mengirim muatan JSON rusak...');
  } else {
    const payload = {
      event: options.event || 'payment.received',
      data: {
        id: options.paymentId || `pay_mock_${Date.now()}`,
        invoiceId: options.invoiceId || 'inv_mock_default',
        amount: options.amount ?? 1500000,
        status: 'PAID',
        paymentMethod: 'BCA Virtual Account',
        paidAt: new Date().toISOString(),
      },
    };
    body = JSON.stringify(payload, null, 2);
    console.log('Payload yang dikirim:');
    console.log(body);
  }

  try {
    const startTime = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    const duration = Date.now() - startTime;

    console.log('\nRespons:');
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${duration}ms)`);

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log('Body (JSON):', JSON.stringify(json, null, 2));
    } catch {
      console.log('Body (Text):', text);
    }
  } catch (err) {
    console.error('Gagal mengirim webhook:', err);
  }
}

main().catch(console.error);
