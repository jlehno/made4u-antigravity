
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { SideNav } from '@/components/dashboard/SideNav';
import { Header } from '@/components/dashboard/Header';
import { useProduction } from '@/lib/store';
import { useIsClient } from '@/hooks/use-is-client';
import { Loader2 } from 'lucide-react';

// A map of roles to their default pages
const defaultRoutes: { [key: string]: string } = {
  'admin': '/dashboard/calendar',
  'bank': '/dashboard/view-calendar',
  'employee': '/dashboard/staffing',
  'miffy': '/dashboard/view-calendar',
};

// A map of roles to their allowed pages (prefixes)
const allowedRoutes: { [key: string]: string[] } = {
    'admin': ['/dashboard'],
    'bank': ['/dashboard/view-calendar'],
    'employee': ['/dashboard/staffing'],
    'miffy': ['/dashboard/view-calendar'],
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { userRole, isDataLoading } = useProduction();
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient) return;

    if (!userRole) {
      router.replace('/login');
      return;
    }

    const allowed = allowedRoutes[userRole] || [];
    const isAllowed = allowed.some(route => pathname.startsWith(route));

    if (!isAllowed) {
      const defaultRoute = defaultRoutes[userRole] || '/login';
      router.replace(defaultRoute);
    }
  }, [userRole, pathname, router, isClient]);

  if (!isClient || !userRole) {
    return null; 
  }
  
  if (isDataLoading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-lg font-medium">Loading Data...</p>
          </div>
        </div>
    );
  }

  const allowed = allowedRoutes[userRole] || [];
  const isAllowed = allowed.some(route => pathname.startsWith(route));
  if(!isAllowed) {
    return null;
  }

  return (
    <div id="root-container">
      <SidebarProvider>
        <Sidebar>
          <SideNav />
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
