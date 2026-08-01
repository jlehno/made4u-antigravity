'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Calendar,
  ListChecks,
  ClipboardCheck,
  LogOut,
  CalendarCheck,
  Users,
  Briefcase,
  UserCog,
  ShoppingCart,
  Warehouse,
  Timer,
  Search,
  NotebookPen,
  DownloadCloud,
} from 'lucide-react';
import { format, startOfWeek, parse } from 'date-fns';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';
import { Made4UFoodsLogo } from '@/components/logo';
import { useProduction } from '@/lib/store';

import { getDefaultPrivileges } from '@/lib/types';

const allNavItems = [
  { href: '/dashboard/search', label: 'Search App Data', icon: Search, key: 'searchAppData' as const },
  { href: '/dashboard/management-notes', label: 'Management Notes', icon: NotebookPen, key: 'managementNotes' as const },
  { href: '/dashboard/calendar', label: 'Adjust Production Calendar', icon: Calendar, key: 'adjustProductionCalendar' as const },
  { href: '/dashboard/view-calendar', label: 'View Production Calendar', icon: CalendarCheck, key: 'viewProductionCalendar' as const },
  { href: '/dashboard/tasks', label: 'Task Designator', icon: ListChecks, key: 'taskDesignator' as const },
  { href: '/dashboard/assigned', label: 'Assigned Tasks', icon: ClipboardCheck, key: 'assignedTasks' as const },
  { href: '/dashboard/manage-users', label: 'User Settings / Backup', icon: Users, key: 'manageUsers' as const },
  { href: '/dashboard/admin-staffing', label: 'Admin Staffing', icon: UserCog, key: 'adminStaffing' as const },
  { href: '/dashboard/staffing', label: 'Staffing', icon: Briefcase, key: 'employeeStaffing' as const },
  { href: '/dashboard/shopping-list', label: 'Facility Shopping List', icon: ShoppingCart, key: 'facilityShoppingList' as const },
  { href: '/dashboard/pallet-storage', label: 'Pallet Storage', icon: Warehouse, key: 'palletStorage' as const },
  { href: '/dashboard/process-times', label: 'Time for a Process', icon: Timer, key: 'timeForAProcess' as const },
];

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, userName, userId, users, logout } = useProduction();

  const currentUser = users.find(u => (userId && u.id === userId) || (userName && u.name === userName));
  const userPrivileges = {
    ...getDefaultPrivileges(userRole, userName),
    ...(currentUser?.privileges || {}),
  };

  const navItems = allNavItems.filter(item => !!userPrivileges[item.key]);

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
    router.push('/login');
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex flex-col gap-4 text-left">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Made4UFoodsLogo className="h-12 w-auto" />
              <span className="text-xl font-semibold text-sidebar-foreground">
                Made4U Flow
              </span>
            </Link>
            {userName && (
              <div className="text-sm text-sidebar-foreground/80 leading-tight">
                <p>Welcome back, {userName}.</p>
              </div>
            )}
          </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.href)}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="space-y-1">
        <SidebarSeparator />
        <SidebarMenuButton variant="outline" className="w-full justify-start gap-2" onClick={handleLogout} tooltip="Logout">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </>
  );
}
