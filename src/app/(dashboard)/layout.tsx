import { redirect } from 'next/navigation';
import { getProfil } from '@/lib/profil';
import { AppShell } from '@/components/layout/app-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getProfil();

  if (!user) {
    redirect('/login');
  }

  if (!user.aktif) {
    redirect('/login?error=nonaktif');
  }

  return <AppShell user={user}>{children}</AppShell>;
}
