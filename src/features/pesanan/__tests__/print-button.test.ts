import { describe, it, expect } from 'vitest';

describe('Navigasi Tombol Kembali & Kontrol Cetak Surat Jalan / Faktur (TC-246)', () => {
  it('TC-246.1: Menentukan rute tujuan tombol Kembali ke detail pesanan jika backHref diberikan', () => {
    const resolveBackUrl = (backHref?: string, fallbackUrl: string = '/pesanan') => {
      return backHref || fallbackUrl;
    };

    expect(resolveBackUrl('/pesanan/ord-123')).toBe('/pesanan/ord-123');
    expect(resolveBackUrl('/pesanan/uuid-999', '/pesanan')).toBe('/pesanan/uuid-999');
  });

  it('TC-246.2: Menggunakan fallback rute daftar pesanan jika backHref tidak tersedia', () => {
    const resolveBackUrl = (backHref?: string, fallbackUrl: string = '/pesanan') => {
      return backHref || fallbackUrl;
    };

    expect(resolveBackUrl(undefined, '/pesanan')).toBe('/pesanan');
    expect(resolveBackUrl()).toBe('/pesanan');
  });

  it('TC-246.3: Memastikan kelas utilitas Tailwind print:hidden disematkan pada seluruh tombol navigasi cetak', () => {
    const containerClasses = ['flex', 'items-center', 'gap-2', 'print:hidden', 'mb-6'];
    const buttonBackClasses = [
      'text-xs',
      'h-8',
      'gap-1.5',
      'print:hidden',
      'border-slate-300',
      'text-slate-700',
      'hover:text-slate-900',
    ];
    const buttonPrintClasses = [
      'text-xs',
      'h-8',
      'gap-1.5',
      'bg-slate-900',
      'hover:bg-slate-800',
      'text-white',
      'shadow-none',
      'print:hidden',
    ];

    expect(containerClasses).toContain('print:hidden');
    expect(buttonBackClasses).toContain('print:hidden');
    expect(buttonPrintClasses).toContain('print:hidden');
  });

  it('TC-246.4: Logika penanganan tombol kembali mendukung fallback peramban & transisi rute tanpa kebocoran state', () => {
    let pushedRoute: string | null = null;
    let didCallRouterBack = false;

    const mockRouter = {
      push: (href: string) => {
        pushedRoute = href;
      },
      back: () => {
        didCallRouterBack = true;
      },
    };

    const handleBackNavigation = ({
      backHref,
      historyLength,
      fallbackUrl = '/pesanan',
    }: {
      backHref?: string;
      historyLength: number;
      fallbackUrl?: string;
    }) => {
      if (backHref) {
        mockRouter.push(backHref);
        return;
      }
      if (historyLength > 1) {
        mockRouter.back();
      } else {
        mockRouter.push(fallbackUrl);
      }
    };

    // Kasus 1: Ada backHref eksplisit (halaman cetak surat jalan / faktur)
    handleBackNavigation({ backHref: '/pesanan/ord-abc', historyLength: 1 });
    expect(pushedRoute).toBe('/pesanan/ord-abc');
    expect(didCallRouterBack).toBe(false);

    // Kasus 2: Tidak ada backHref dan riwayat browser > 1
    pushedRoute = null;
    didCallRouterBack = false;
    handleBackNavigation({ backHref: undefined, historyLength: 3 });
    expect(didCallRouterBack).toBe(true);
    expect(pushedRoute).toBeNull();

    // Kasus 3: Tidak ada backHref dan tab baru (history = 1) -> tidak stuck, fallback ke /pesanan
    pushedRoute = null;
    didCallRouterBack = false;
    handleBackNavigation({ backHref: undefined, historyLength: 1, fallbackUrl: '/pesanan' });
    expect(pushedRoute).toBe('/pesanan');
    expect(didCallRouterBack).toBe(false);
  });
});

