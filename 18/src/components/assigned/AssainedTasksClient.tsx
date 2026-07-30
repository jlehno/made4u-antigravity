'use client';
import { usePathname } from 'next/navigation';
import {
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Calendar,
  ClipboardCheck,
  Lightbulb,
  ListChecks,
  CalendarCheck,
  FileText,
  Calendar as CalendarIcon,
  Play,
  Pause,
  ChevronDown,
} from 'lucide-react';
import { useProduction } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import type { ScrollSpeed } from '@/lib/types';

const pageConfig: { [key: string]: { title: string; icon: React.ElementType } } = {
  '/dashboard/calendar': { title: 'Adjust Production Calendar', icon: Calendar },
  '/dashboard/view-calendar': { title: 'View Production Calendar', icon: CalendarCheck },
  '/dashboard/tasks': { title: 'Task Designator', icon: ListChecks },
  '/dashboard/assigned': { title: 'Assigned Tasks', icon: ClipboardCheck },
  '/dashboard/insights': { title: 'AI Production Insights', icon: Lightbulb },
  '/dashboard/sop-documents': { title: 'SOP Documents', icon: FileText },
};

function AssignedTasksControls() {
    const { 
        assignedTasksDate, 
        setAssignedTasksDate, 
        assignedTasksIsScrolling, 
        setAssignedTasksIsScrolling,
        assignedTasksScrollSpeed,
        setAssignedTasksScrollSpeed
    } = useProduction();

    return (
        <div className="flex items-center gap-2 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !assignedTasksDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {assignedTasksDate ? format(assignedTasksDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={assignedTasksDate}
                  onSelect={(date) => setAssignedTasksDate(date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => setAssignedTasksDate(new Date())}>Today</Button>
            <div className="flex items-center rounded-md border">
              <Button variant="ghost" className="rounded-r-none border-r" onClick={() => setAssignedTasksIsScrolling(true)} disabled={assignedTasksIsScrolling}>
                <Play className="mr-2 h-4 w-4" />
                Play
              </Button>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="rounded-none capitalize">
                          {assignedTasksScrollSpeed}
                          <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuRadioGroup value={assignedTasksScrollSpeed} onValueChange={(value) => setAssignedTasksScrollSpeed(value as ScrollSpeed)}>
                          <DropdownMenuRadioItem value="slow">Slow</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="normal">Normal</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="fast">Fast</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="faster">Faster</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="very fast">Very Fast</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" className="rounded-l-none border-l" onClick={() => setAssignedTasksIsScrolling(false)} disabled={!assignedTasksIsScrolling}>
                <Pause className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </div>
        </div>
    )
}

export function Header() {
  const pathname = usePathname();
  const { title, icon: Icon } = pageConfig[pathname] ?? { title: 'Dashboard', icon: null };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-6 w-6 text-primary" />}
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
      </div>
      {pathname === '/dashboard/assigned' && <AssignedTasksControls />}
    </header>
  );
}