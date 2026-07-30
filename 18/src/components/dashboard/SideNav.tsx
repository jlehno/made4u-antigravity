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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Made4UFoodsLogo } from '@/components/logo';
import { useProduction } from '@/lib/store';

const adminNavItems = [
  { href: '/dashboard/search', label: 'Search App Data', icon: Search },
  { href: '/dashboard/calendar', label: 'Adjust Production Calendar', icon: Calendar },
  { href: '/dashboard/view-calendar', label: 'View Production Calendar', icon: CalendarCheck },
  { href: '/dashboard/tasks', label: 'Task Designator', icon: ListChecks },
  { href: '/dashboard/assigned', label: 'Assigned Tasks', icon: ClipboardCheck },
  { href: '/dashboard/manage-users', label: 'Manage Users', icon: Users },
  { href: '/dashboard/admin-staffing', label: 'Admin Staffing', icon: UserCog },
  { href: '/dashboard/shopping-list', label: 'Facility Shopping List', icon: ShoppingCart },
  { href: '/dashboard/pallet-storage', label: 'Pallet Storage', icon: Warehouse },
  { href: '/dashboard/process-times', label: 'Time for a Process', icon: Timer },
];

const bankNavItems = [
  { href: '/dashboard/view-calendar', label: 'View Production Calendar', icon: CalendarCheck },
];

const employeeNavItems = [
  { href: '/dashboard/staffing', label: 'Staffing', icon: Briefcase },
];

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { userRole, userName, logout } = useProduction();

  const getNavItems = () => {
    switch (userRole) {
      case 'admin': return adminNavItems;
      case 'bank': return bankNavItems;
      case 'miffy': return bankNavItems;
      case 'employee': return employeeNavItems;
      default: return [];
    }
  }

  const navItems = getNavItems();

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
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenuButton variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout} tooltip="Logout">
          <LogOut />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </>
  );
}
