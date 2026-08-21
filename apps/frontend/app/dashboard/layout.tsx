'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { DashboardHeader } from '@/components/dashboard';
import { AmbientBackground } from '@/components/ambient-background';
import { useOrgStore } from '@/store/org-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loadUser } = useAuthStore();
  const { selectOrg, clearCurrentOrg } = useOrgStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    loadUser()
      .then(() => setChecking(false))
      .catch(() => {
        router.replace('/login');
      });
  }, [loadUser, router]);

  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/organizations\/([^/]+)(?:\/|$)/);
    if (match) {
      selectOrg(match[1]);
    } else {
      clearCurrentOrg();
    }
  }, [pathname, selectOrg, clearCurrentOrg]);

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--background)' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-orange)' }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen relative" style={{ background: 'var(--background)' }}>
      {/* Ambient background */}
      <AmbientBackground />

      {/* App grid: sidebar + main */}
      <div
        className="relative z-[1] flex w-full"
      >
        {/* Sidebar — glass panel, fixed width */}
        <DashboardSidebar />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto py-7 px-9">
          <DashboardHeader />
          {children}
        </main>
      </div>
    </div>
  );
}
