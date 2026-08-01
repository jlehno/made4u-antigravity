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
  { href: '/dashboard/manage-users', label: 'Manage Users', icon: Users, key: 'manageUsers' as const },
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
  const { userRole, userName, userId, users, logout, products, schedule, prepSteps, shoppingList, registeredShoppingItems, palletStorage, processTimes, managementNotes, machinery, tasks, taskGroups, calendarNotes, confirmedHours } = useProduction();

  const currentUser = users.find(u => (userId && u.id === userId) || (userName && u.name === userName));
  const userPrivileges = currentUser?.privileges || getDefaultPrivileges(userRole, userName);

  const navItems = allNavItems.filter(item => !!userPrivileges[item.key]);

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
    router.push('/login');
  };

  const handleBackupAllData = async () => {
    try {
      const escapeCsv = (str: any) => {
        if (str === null || str === undefined) return '';
        const stringified = String(str);
        if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
          return `"${stringified.replace(/"/g, '""')}"`;
        }
        return stringified;
      };

      const zip = new JSZip();

      // 1. Products.csv
      const productLines = ['name,coPacker,coPackerColor,allergens,targetDepositWeight,targetFinishedWeight,batchSizeLbs,yieldPerBatch,batchesPricedFor1BayDay,ftesPricedFor1BayDay'];
      (products || []).forEach(p => {
        productLines.push([
          escapeCsv(p.name),
          escapeCsv(p.coPacker),
          escapeCsv(p.coPackerColor),
          escapeCsv(p.allergens),
          escapeCsv(p.targetDepositWeight),
          escapeCsv(p.targetFinishedWeight),
          escapeCsv(p.batchSizeLbs),
          escapeCsv(p.yieldPerBatch),
          escapeCsv(p.batchesPricedFor1BayDay),
          escapeCsv(p.ftesPricedFor1BayDay),
        ].join(','));
      });
      zip.file('Products.csv', productLines.join('\r\n'));

      // 2. ProductionSchedule.csv
      const scheduleLines = ['date,bay,productName,batches,calendarNote,ScheduledFTEs excluding Lehn family,totalFTEs,timeLeftBuilding'];

      const calculateHours = (startStr: string, endStr: string) => {
        const parseTime = (t: string) => {
          const match = t.trim().match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
          if (!match) return 0;
          let hrs = parseInt(match[1], 10);
          const mins = parseInt(match[2] || '0', 10);
          const period = match[3]?.toLowerCase();
          if (period === 'pm' && hrs < 12) hrs += 12;
          if (period === 'am' && hrs === 12) hrs = 0;
          return hrs + mins / 60;
        };
        const hStart = parseTime(startStr);
        const hEnd = parseTime(endStr);
        return hEnd > hStart ? (hEnd - hStart) : 0;
      };

      Object.entries(schedule || {}).forEach(([dateKey, dayProd]) => {
        if (!dayProd) return;

        const noteObj = (calendarNotes || {})[dateKey] || {};
        const dayNote = noteObj.note || '';
        const dayTimeLeft = noteObj.timeLeftBuilding || '';

        // Calculate Scheduled FTEs excluding Lehn Family from confirmedHours
        let totalNonLehnHours = 0;
        try {
          const dayConfirmedHours = (confirmedHours || {})[dateKey] || {};
          const workingUserIds = Object.keys(dayConfirmedHours).filter(id => (dayConfirmedHours[id] || []).length > 0);
          const nonLehnUsers = (users || []).filter(u => workingUserIds.includes(u.id) && !u.name.toLowerCase().includes('lehn'));

          nonLehnUsers.forEach(u => {
            const ranges = dayConfirmedHours[u.id] || [];
            ranges.forEach(range => {
              const [start, end] = range.split('-');
              if (start && end) {
                totalNonLehnHours += calculateHours(start, end);
              }
            });
          });
        } catch (e) {
          console.error("FTE calc error:", e);
        }

        const scheduledFTEsExcludingLehnStr = totalNonLehnHours > 0 ? (totalNonLehnHours / 8.5).toFixed(2) : '0';

        // Calculate Total FTEs Required from product batch requirements
        let dayTotalRequiredFTEs = 0;
        Object.values(dayProd).flat().forEach(item => {
          const prod = (products || []).find(p => p.id === item.productId);
          if (prod) {
            const batchesPriced = parseFloat(prod.batchesPricedFor1BayDay || '0');
            const ftesPriced = parseFloat(prod.ftesPricedFor1BayDay || '0');
            const batchesToday = parseFloat(item.batches || '0');
            if (batchesPriced > 0) {
              dayTotalRequiredFTEs += (batchesToday / batchesPriced) * ftesPriced;
            }
          }
        });
        const totalFTEsStr = dayTotalRequiredFTEs > 0 ? dayTotalRequiredFTEs.toFixed(2) : '0';

        Object.entries(dayProd).forEach(([bay, items]) => {
          (items || []).forEach(item => {
            const prod = (products || []).find(p => p.id === item.productId);
            scheduleLines.push([
              escapeCsv(dateKey),
              escapeCsv(bay),
              escapeCsv(prod?.name || item.productId),
              escapeCsv(item.batches),
              escapeCsv(dayNote),
              escapeCsv(scheduledFTEsExcludingLehnStr),
              escapeCsv(totalFTEsStr),
              escapeCsv(dayTimeLeft),
            ].join(','));
          });
        });
      });
      zip.file('ProductionSchedule.csv', scheduleLines.join('\r\n'));

      // 3. PrepSteps.csv
      const prepLines = ['name,daysInAdvance,products'];
      (prepSteps || []).forEach(step => {
        const prodNames = (step.productIds || []).map(id => products.find(p => p.id === id)?.name || id).join(';');
        prepLines.push([
          escapeCsv(step.name),
          escapeCsv(step.daysInAdvance),
          escapeCsv(prodNames),
        ].join(','));
      });
      zip.file('PrepSteps.csv', prepLines.join('\r\n'));

      // 4. StaffUsers.csv
      const userLines = ['name,role,pin'];
      (users || []).forEach(u => {
        userLines.push([
          escapeCsv(u.name),
          escapeCsv(u.role),
          escapeCsv(u.pin),
        ].join(','));
      });
      zip.file('StaffUsers.csv', userLines.join('\r\n'));

      // 5. ShoppingList.csv
      const shopLines = ['name,category,supplier,quantity,needDeliveredBy,ordered,expectedDeliveryDate'];
      (shoppingList || []).forEach(s => {
        shopLines.push([
          escapeCsv(s.name),
          escapeCsv(s.category),
          escapeCsv(s.supplier),
          escapeCsv(s.quantity),
          escapeCsv(s.needDeliveredBy),
          escapeCsv(s.ordered),
          escapeCsv(s.expectedDeliveryDate),
        ].join(','));
      });
      zip.file('ShoppingList.csv', shopLines.join('\r\n'));

      // 6. RegisteredShoppingItems.csv
      const regLines = ['name,category,supplier,leadTime'];
      (registeredShoppingItems || []).forEach((r: any) => {
        regLines.push([
          escapeCsv(r.name),
          escapeCsv(r.category),
          escapeCsv(r.supplier),
          escapeCsv(r.leadTime),
        ].join(','));
      });
      zip.file('RegisteredShoppingItems.csv', regLines.join('\r\n'));

      // 7. PalletStorage.csv
      const palletLines = ['clientId,weekKey,dryPallets,tallDryPallets,frozenPallets,tallFrozenPallets,rebuilds'];
      (palletStorage || []).forEach(p => {
        palletLines.push([
          escapeCsv(p.clientId),
          escapeCsv(p.weekKey),
          escapeCsv(p.dryPallets),
          escapeCsv(p.tallDryPallets),
          escapeCsv(p.frozenPallets),
          escapeCsv(p.tallFrozenPallets),
          escapeCsv(p.rebuilds),
        ].join(','));
      });
      zip.file('PalletStorage.csv', palletLines.join('\r\n'));

      // 8. ProcessTimes.csv
      const processLines = ['clientId,processName,minEmployees,minRate'];
      (processTimes || []).forEach(pt => {
        processLines.push([
          escapeCsv(pt.clientId),
          escapeCsv(pt.processName),
          escapeCsv(pt.minEmployees),
          escapeCsv(pt.minRate),
        ].join(','));
      });
      zip.file('ProcessTimes.csv', processLines.join('\r\n'));

      // 9. ManagementNotes.csv
      const mgtLines = ['subject,date,authorName,body'];
      (managementNotes || []).forEach(m => {
        mgtLines.push([
          escapeCsv(m.subject),
          escapeCsv(m.date),
          escapeCsv(m.authorName),
          escapeCsv(m.body),
        ].join(','));
      });
      zip.file('ManagementNotes.csv', mgtLines.join('\r\n'));

      // 10. Machinery.csv
      const macLines = ['name,quantity'];
      (machinery || []).forEach(m => {
        macLines.push([
          escapeCsv(m.name),
          escapeCsv(m.quantity),
        ].join(','));
      });
      zip.file('Machinery.csv', macLines.join('\r\n'));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Made4U_Full_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup Downloaded",
        description: "Downloaded ZIP archive containing CSV backups for all categories.",
      });
    } catch (err: any) {
      console.error("Backup failed:", err);
      toast({
        variant: "destructive",
        title: "Backup Failed",
        description: err.message || "Failed to generate backup zip file.",
      });
    }
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
        {!!userPrivileges.backupAllData && (
          <SidebarMenuButton
            variant="outline"
            className="w-full justify-start gap-2 bg-emerald-950/30 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50"
            onClick={handleBackupAllData}
            tooltip="Backup All Data"
          >
            <DownloadCloud className="h-4 w-4" />
            <span>Backup All Data</span>
          </SidebarMenuButton>
        )}

        <SidebarMenuButton variant="outline" className="w-full justify-start gap-2" onClick={handleLogout} tooltip="Logout">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </>
  );
}
