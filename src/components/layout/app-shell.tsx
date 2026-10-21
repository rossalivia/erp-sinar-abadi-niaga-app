'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import type { UserProfile } from '@/types/auth';

interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        peran={user.peran}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col md:pl-56 min-w-0">
        {/* Top Header */}
        <Header
          user={user}
          onOpenMobileSidebar={() => setIsMobileMenuOpen(true)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
