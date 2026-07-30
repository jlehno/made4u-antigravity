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
import { Loader2 } from 'lucide-react';
import { useIsClient } from '@/hooks/use-is-client';

// A map of roles to their default pages
const defaultRoutes: { [key: string]: string } = {
  'admin': '/dashboard/calendar',
  'bank': '/dashboard/view-calendar',
  'employee': '/dashboard/staffing',
  'miffy': '/dashboard/view-calendar',
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { userRole, isDataLoading } = useProduction();
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient || isDataLoading) return;

    // If not logged in, redirect to login page.
    if (!userRole) {
      router.replace('/login');
      return;
    }
    
    // If the user is on the base dashboard page, redirect them to their specific default page.
    if (pathname === '/dashboard') {
        const defaultRoute = defaultRoutes[userRole] || '/login';
        router.replace(defaultRoute);
        return;
    }

  }, [userRole, pathname, router, isClient, isDataLoading]);
  
  if (!isClient || isDataLoading) {
    return (
       <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if(!userRole) {
      return null;
  }

  // Special case for root dashboard redirect
  if (pathname === '/dashboard') {
      return (
         <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
  }

  return (
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
  );
}
