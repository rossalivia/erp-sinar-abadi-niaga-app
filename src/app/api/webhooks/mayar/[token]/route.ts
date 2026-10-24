import { NextRequest, NextResponse } from 'next/server';
import { prosesWebhookMayarService } from '@/features/pembayaran/service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { token } = await context.params;

  // Baca raw text untuk validasi ukuran dan JSON parsing aman di service
  const bodyText = await request.text();

  const hasil = await prosesWebhookMayarService(token, bodyText);

  return NextResponse.json(
    {
      ok: hasil.status === 200,
      pesan: hasil.message,
      status: hasil.status,
    },
    { status: hasil.status }
  );
}

export async function GET(): Promise<NextResponse> {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export async function PUT(): Promise<NextResponse> {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
