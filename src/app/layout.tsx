import type { Metadata } from 'next';
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
      <body className="min-h-full flex flex-col font-sans text-slate-800 dark:text-slate-100 bg-[#f0f5fa] dark:bg-[#090e1a] selection:bg-indigo-500 selection:text-white overflow-x-hidden w-full max-w-full transition-colors duration-150">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
