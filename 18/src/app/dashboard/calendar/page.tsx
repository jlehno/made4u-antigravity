

import { AdminStaffingClient } from '@/components/staffing/AdminStaffingClient';
import { ProductionCalendarClient } from '@/components/calendar/ProductionCalendarClient';

export default function AdminStaffingPage() {
  return (
    <div className="space-y-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
       <ProductionCalendarClient />
    </div>
  );
}
