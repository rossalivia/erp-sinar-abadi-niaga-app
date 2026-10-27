import type { Metadata } from 'next';
import Script from 'next/script';
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme/theme-provider';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ERP CV Sinar Abadi Niaga — Distributor Kebutuhan Toko Kelontong',
  description: 'Sistem Informasi Manajemen CV Sinar Abadi Niaga — Distributor Kebutuhan Toko Kelontong di Bekasi & Jakarta Timur',
  robots: {
    index: false,
    follow: false,
  },
};

const themeScript = `
  (function() {
    try {
      var key = 'erp_sinar_abadi_theme';
      var theme = localStorage.getItem(key);
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark) || (theme === 'system' && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden w-full max-w-full`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col font-sans text-slate-800 dark:text-slate-100 bg-[#f4f7fb] dark:bg-[#090e1a] selection:bg-indigo-500 selection:text-white overflow-x-hidden w-full max-w-full transition-colors duration-150">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
