import crypto from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { prosesNotifikasiStokHarian } from '@/features/notifikasi/service';

export const dynamic = 'force-dynamic';

const NOINDEX_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
};

/**
 * Route Handler Terlindungi untuk Eksekusi Cron Notifikasi Stok Menipis Harian.
 * Wajib otentikasi Bearer token dengan CRON_SECRET secara constant-time.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader.toLowerCase().startsWith('bearer ')) {
    return new NextResponse(null, {
      status: 401,
      headers: NOINDEX_HEADERS,
    });
  }

  const token = authHeader.slice(7).trim();
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(cronSecret);

  // Perbandingan constant-time untuk mencegah timing attack
  if (
    tokenBuffer.length !== secretBuffer.length ||
    !crypto.timingSafeEqual(tokenBuffer, secretBuffer)
  ) {
    return new NextResponse(null, {
      status: 401,
      headers: NOINDEX_HEADERS,
    });
  }

  try {
    const result = await prosesNotifikasiStokHarian({
      jenis: 'stok_menipis',
    });

    if (!result.success && result.status === 'gagal') {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          logId: result.logId,
        },
        {
          status: 500,
          headers: NOINDEX_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        status: result.status,
        jumlahBarang: result.jumlahBarang,
        jumlahPenerima: result.jumlahPenerima,
        logId: result.logId,
      },
      {
        status: 200,
        headers: NOINDEX_HEADERS,
      }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi galat sistem internal';
    return NextResponse.json(
      {
        success: false,
        message: errorMsg,
      },
      {
        status: 500,
        headers: NOINDEX_HEADERS,
      }
    );
  }
}

export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'POST',
      ...NOINDEX_HEADERS,
    },
  });
}
