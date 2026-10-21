import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { isRouteAuthorized } from '@/lib/akses';
import type { Peran } from '@/types/auth';

function sanitizeNextUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return '/';
  }
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Lewati aset statis, API routes khusus, atau robots.txt
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Menggunakan getUser() sesuai aturan keamanan Supabase (bukan getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname === '/login' || pathname === '/masuk';

  // Jika belum login
  if (!user) {
    if (isAuthRoute) {
      return supabaseResponse;
    }
    const safeNext = sanitizeNextUrl(pathname + request.nextUrl.search);
    const redirectUrl = new URL('/login', request.url);
    if (safeNext !== '/') {
      redirectUrl.searchParams.set('next', safeNext);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Pengguna terautentikasi: ambil profil (peran, status aktif)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, peran, aktif')
    .eq('id', user.id)
    .single();

  // Akun nonaktif atau profil tidak ditemukan
  if (!profile || !profile.aktif) {
    await supabase.auth.signOut();
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('error', 'nonaktif');
    return NextResponse.redirect(redirectUrl);
  }

  // Jika sudah login dan mencoba membuka halaman login
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Halaman pengecualian setelah login
  if (pathname === '/tidak-berwenang') {
    return supabaseResponse;
  }

  // Periksa hak akses rute berdasarkan matriks peran
  const peran = profile.peran as Peran;
  if (!isRouteAuthorized(pathname, peran)) {
    return NextResponse.redirect(new URL('/tidak-berwenang', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
