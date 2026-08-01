

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useProduction } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarIcon, Download, Upload, Copy, Trash2, BellRing, Check, FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, eachDayOfInterval, parse, isValid } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import type { AvailabilitySlot, User } from '@/lib/types';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

function excelDateToJSDate(serial: number) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    const fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    const seconds = total_seconds % 60;
    total_seconds -= seconds;

    const hours = Math.floor(total_seconds / (60 * 60));
    const minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}


export function AdminStaffingClient() {
  const { staffingDate, setStaffingDate, users, setEmployeeAvailability, confirmEmployeeAvailabilitySlot, setConfirmedHoursForDay, availability, confirmedHours, notifiedAdminIds, setNotifiedAdminIds, notificationDelayHours, setNotificationDelayHours } = useProduction();

  const selectedDate = staffingDate || new Date();
  const setSelectedDate = setStaffingDate;

  const adminUsers = useMemo(() => {
    return users.filter(u => u.role === 'admin');
  }, [users]);

  const week = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
    const end = addDays(start, 6);
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Staffing Management</CardTitle>
            <CardDescription>
              View staff availability and confirm hours for the selected week.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-0 border-t mt-2">
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-lg space-y-3 mt-4">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-600" />
              <h4 className="font-semibold text-sm">Staffing Notification Settings</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Select admin users below who should receive top-right Notification Bell alerts when an employee enters or modifies their weekly availability. (If none are selected, all admin users receive notifications).
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Label className="text-xs font-semibold">Notify Admin Users:</Label>
              <div className="flex flex-wrap gap-2">
                {adminUsers.map(admin => {
                  const isSelected = notifiedAdminIds.includes(admin.id);
                  return (
                    <Button
                      key={admin.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "text-xs h-7",
                        isSelected && "bg-amber-600 hover:bg-amber-700 text-white"
                      )}
                      onClick={() => {
                        const newIds = isSelected
                          ? notifiedAdminIds.filter(id => id !== admin.id)
                          : [...notifiedAdminIds, admin.id];
                        setNotifiedAdminIds(newIds);
                      }}
                    >
                      {isSelected && <Check className="mr-1 h-3 w-3" />}
                      {admin.name} ({(admin as any).email || admin.role})
                    </Button>
                  );
                })}
                {adminUsers.length > 0 && notifiedAdminIds.length === 0 && (
                  <Badge variant="outline" className="text-[11px] text-amber-700 dark:text-amber-300 border-amber-300">
                    All Admins (Default)
                  </Badge>
                )}
                {adminUsers.length === 0 && (
                  <span className="text-xs text-muted-foreground">No admin users found.</span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
              <Label htmlFor="notification-delay" className="text-xs font-semibold">
                Time Delay for Notification After Staff Send Availability:
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="notification-delay"
                  type="number"
                  min={0}
                  step={0.5}
                  value={notificationDelayHours !== undefined ? notificationDelayHours : 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      setNotificationDelayHours(val);
                    }
                  }}
                  className="w-28 h-9 text-sm font-bold text-center bg-zinc-900 text-zinc-100 border-zinc-700 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">Hours (0 = Immediate)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <StaffingTable 
        week={week} 
        users={users} 
        availability={availability}
        setEmployeeAvailability={setEmployeeAvailability}
        confirmEmployeeAvailabilitySlot={confirmEmployeeAvailabilitySlot}
        confirmedHours={confirmedHours}
        setConfirmedHoursForDay={setConfirmedHoursForDay}
      />
    </div>
  );
}

function StaffingTable({ week, users, availability, setEmployeeAvailability, confirmEmployeeAvailabilitySlot, confirmedHours, setConfirmedHoursForDay }: {
  week: Date[];
  users: User[];
  availability: any;
  setEmployeeAvailability: (employeeId: string, date: string, slots: { start: string, end: string }[]) => void;
  confirmEmployeeAvailabilitySlot: (employeeId: string, date: string, slot: AvailabilitySlot) => void;
  confirmedHours: any;
  setConfirmedHoursForDay: (employeeId: string, date: string, hours: string[]) => void;
}) {
    const { toast } = useToast();
    const { users: allUsers, clearAvailabilityData, clearConfirmedHoursData, hrNotes } = useProduction();
    const availabilityImportRef = React.useRef<HTMLInputElement>(null);
    const confirmedHoursImportRef = React.useRef<HTMLInputElement>(null);
    const [localHours, setLocalHours] = useState<Record<string, Record<string, string>>>({}); // { [empId]: { [dateKey]: "8am-5pm, 6pm-7pm" } }
    
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [removeType, setRemoveType] = useState<'availability' | 'confirmed' | null>(null);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');

    const handleOpenRemoveDialog = (type: 'availability' | 'confirmed') => {
        setRemoveType(type);
        setPinInput('');
        setPinError('');
        setIsRemoveDialogOpen(true);
    };

    const handleConfirmRemove = async () => {
        if (pinInput !== '310101') {
            setPinError('Incorrect Admin PIN.');
            return;
        }

        try {
            if (removeType === 'availability') {
                await clearAvailabilityData();
                toast({ title: "Success", description: "All availability data has been removed." });
            } else if (removeType === 'confirmed') {
                await clearConfirmedHoursData();
                toast({ title: "Success", description: "All confirmed hours data has been removed." });
            }
            setIsRemoveDialogOpen(false);
        } catch (error: any) {
            console.error("Error clearing data:", error);
            toast({ variant: 'destructive', title: "Error", description: error.message || "Failed to remove data." });
        }
    };

    const rowColors = ['bg-zinc-900/80 dark:bg-zinc-900/90 text-zinc-100 border-l-4 border-l-zinc-600', 'bg-emerald-950/70 dark:bg-emerald-950/80 text-emerald-100 border-l-4 border-l-emerald-600'];

    useEffect(() => {
        const newLocalHours: Record<string, Record<string, string>> = {};
        users.filter(u => u.role === 'employee').forEach(emp => {
            newLocalHours[emp.id] = {};
            week.forEach(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const hours = confirmedHours[dateKey]?.[emp.id] || [];
                newLocalHours[emp.id][dateKey] = hours.join(', ');
            });
        });
        setLocalHours(newLocalHours);
    }, [confirmedHours, week, users]);

    const handleConfirmClick = (employeeId: string, date: string, slot: AvailabilitySlot) => {
        confirmEmployeeAvailabilitySlot(employeeId, date, slot);
        toast({ title: `Slot ${slot.confirmed ? 'Unconfirmed' : 'Confirmed'}!`, description: `Availability for ${format(parse(date, 'yyyy-MM-dd', new Date()), 'PPP')} has been updated.` });
    };

    const handleHoursChange = (employeeId: string, dateKey: string, value: string) => {
        setLocalHours(prev => ({
            ...prev,
            [employeeId]: {
                ...(prev[employeeId] || {}),
                [dateKey]: value
            }
        }));
    };

    const handleHoursSubmit = (employeeId: string, dateKey: string) => {
        const hoursString = localHours[employeeId]?.[dateKey] || '';
        const hoursArray = hoursString.split(',').map(s => s.trim()).filter(Boolean);
        setConfirmedHoursForDay(employeeId, dateKey, hoursArray);
        toast({ title: "Hours Updated", description: `Confirmed hours for ${format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'PPP')} have been saved.`});
    };

    const handleCopyAllAvailable = (employeeId: string) => {
      week.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayAvailability = availability[dateKey]?.[employeeId] || [];
        if (dayAvailability.length > 0) {
          const hoursArray = dayAvailability.map((slot: any) => `${slot.start}-${slot.end}`);
          setConfirmedHoursForDay(employeeId, dateKey, hoursArray);
        }
      });
      toast({ title: "Hours Copied", description: `All available hours for the week have been set as confirmed.` });
    };

    const handleAvailabilityImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1}) as any[][];
                
                if (jsonData.length < 2) throw new Error("CSV must have a header row and at least one data row.");

                const headers = jsonData[0].map(h => String(h).toLowerCase());
                const nameIndex = headers.indexOf('employee name');
                const dateIndex = headers.indexOf('date');
                const availabilityIndex = headers.indexOf('availability');

                if (nameIndex === -1 || dateIndex === -1 || availabilityIndex === -1) {
                     throw new Error("CSV must contain 'Employee Name', 'Date', and 'Availability' columns.");
                }
                
                const employeeMap = new Map<string, string>();
                allUsers.forEach(u => employeeMap.set(u.name.toLowerCase(), u.id));

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const employeeName = String(row[nameIndex]);
                    const dateValue = row[dateIndex];
                    const availabilityString = String(row[availabilityIndex]);

                    const employeeId = employeeMap.get(employeeName.toLowerCase());

                    if (employeeId && dateValue && availabilityString) {
                        let date: Date;
                        if (typeof dateValue === 'number') {
                            date = excelDateToJSDate(dateValue);
                        } else {
                            date = new Date(dateValue);
                        }

                        if (isValid(date)) {
                             const dateKey = format(date, 'yyyy-MM-dd');
                             const slots = availabilityString.split(',').map(s => {
                                const [start, end] = s.split('-').map(t => t.trim());
                                return { start, end };
                            }).filter(s => s.start && s.end);
                            setEmployeeAvailability(employeeId, dateKey, slots);
                        }
                    }
                }
                toast({ title: "Import Successful", description: "Staff availability has been updated." });
            } catch (error: any) {
                console.error("Import error:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (availabilityImportRef.current) availabilityImportRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleConfirmedHoursImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1}) as any[][];
                
                if (jsonData.length < 2) throw new Error("CSV must have a header row and at least one data row.");

                const headers = jsonData[0].map(h => String(h).toLowerCase());
                const nameIndex = headers.indexOf('employee name');
                const dateIndex = headers.indexOf('date');
                const hoursIndex = headers.indexOf('hours');
                
                if (nameIndex === -1 || dateIndex === -1 || hoursIndex === -1) {
                     throw new Error("CSV must contain 'Employee Name', 'Date', and 'Hours' columns.");
                }
                
                const employeeMap = new Map<string, string>();
                allUsers.forEach(u => employeeMap.set(u.name.toLowerCase(), u.id));

                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const employeeName = String(row[nameIndex]);
                    const dateValue = row[dateIndex];
                    const hoursString = String(row[hoursIndex]);

                    const employeeId = employeeMap.get(employeeName.toLowerCase());

                    if (employeeId && dateValue) {
                        let date: Date;
                        if (typeof dateValue === 'number') {
                            date = excelDateToJSDate(dateValue);
                        } else {
                            date = new Date(dateValue);
                        }
                        
                        if (isValid(date)) {
                             const dateKey = format(date, 'yyyy-MM-dd');
                             const hoursArray = hoursString ? hoursString.split(',').map(s => s.trim()).filter(Boolean) : [];
                             setConfirmedHoursForDay(employeeId, dateKey, hoursArray);
                        }
                    }
                }

                toast({ title: "Import Successful", description: "Confirmed employee hours have been updated." });

            } catch (error: any) {
                console.error("Import error:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (confirmedHoursImportRef.current) confirmedHoursImportRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const exportAvailabilityToCSV = () => {
        const dataForExport: any[] = [['Employee Name', 'Date', 'Availability']];
        const allDates = Object.keys(availability).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        allDates.forEach(dateKey => {
            const dayData = availability[dateKey];
            Object.keys(dayData).forEach(employeeId => {
                const employee = users.find(u => u.id === employeeId);
                if(employee) {
                    const availabilityString = dayData[employeeId].map((s: any) => `${s.start}-${s.end}${s.confirmed ? ' (C)' : ''}`).join(', ');
                    dataForExport.push([employee.name, format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'P'), availabilityString]);
                }
            })
        });

        if (dataForExport.length <= 1) {
            toast({ variant: 'destructive', title: 'No Data to Export', description: 'There is no availability data to export.' });
            return;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Staff Availability');
        XLSX.writeFile(workbook, `StaffAvailability_All_Time.xlsx`);
    };
    
    const exportConfirmedHoursToCSV = () => {
        const dataForExport: any[] = [['Employee Name', 'Date', 'Hours']];
        const allDates = Object.keys(confirmedHours).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        allDates.forEach(dateKey => {
            const dayData = confirmedHours[dateKey];
            Object.keys(dayData).forEach(employeeId => {
                const employee = users.find(u => u.id === employeeId);
                if (employee) {
                    const hoursString = dayData[employeeId].join(', ');
                    dataForExport.push([employee.name, format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'P'), hoursString]);
                }
            })
        });
        
        if (dataForExport.length <= 1) {
            toast({ variant: 'destructive', title: 'No Data to Export', description: 'There is no confirmed hours data to export.' });
            return;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(dataForExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmed Hours');
        XLSX.writeFile(workbook, `ConfirmedHours_All_Time.xlsx`);
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'firstName' | 'lastName' | 'mostRecentAvailability' | 'stillNeedConfirmed'>('firstName');

    const filteredEmployees = useMemo(() => {
        let list = users.filter(u => u.role === 'employee');

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(u => u.name.toLowerCase().includes(q));
        }

        return [...list].sort((a, b) => {
            if (sortBy === 'firstName') {
                return a.name.localeCompare(b.name);
            }
            if (sortBy === 'lastName') {
                const aLast = a.name.trim().split(' ').slice(-1)[0] || '';
                const bLast = b.name.trim().split(' ').slice(-1)[0] || '';
                return aLast.localeCompare(bLast);
            }
            if (sortBy === 'mostRecentAvailability') {
                const getLatestAvailTime = (empId: string) => {
                    let latest = 0;
                    Object.entries(availability || {}).forEach(([dateKey, dayAvail]: [string, any]) => {
                        if (dayAvail?.[empId] && dayAvail[empId].length > 0) {
                            const t = new Date(dateKey).getTime();
                            if (t > latest) latest = t;
                        }
                    });
                    return latest;
                };
                return getLatestAvailTime(b.id) - getLatestAvailTime(a.id);
            }
            if (sortBy === 'stillNeedConfirmed') {
                const getUnconfirmedScore = (empId: string) => {
                    let score = 0;
                    week.forEach(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const hasAvail = (availability[dateKey]?.[empId] || []).length > 0;
                        const hasConfirmed = (confirmedHours[dateKey]?.[empId] || []).length > 0;
                        if (hasAvail && !hasConfirmed) score += 1;
                    });
                    return score;
                };
                return getUnconfirmedScore(b.id) - getUnconfirmedScore(a.id);
            }
            return 0;
        });
    }, [users, searchQuery, sortBy, availability, confirmedHours, week]);

    return (
        <Card>
            <CardHeader className="space-y-3">
                <CardTitle>Staff Availability & Confirmed Hours</CardTitle>
                <CardDescription>Review availability, input confirmed hours, and import/export data.</CardDescription>

                <div className="pt-2 border-t border-zinc-800/60 mt-1 space-y-2.5">
                    {/* Note directly above Sort By & Search Bar */}
                    <div>
                        <Badge variant="secondary" className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium">
                            Click available times to confirm them
                        </Badge>
                    </div>

                    {/* Search Bar & Sort By Menu Immediately Next to Each Other */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px] max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employee name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-100"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Sort By:</Label>
                            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                                <SelectTrigger className="w-[220px] h-9 text-xs bg-zinc-900 border-zinc-700 text-zinc-100">
                                    <SelectValue placeholder="Sort employees..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="firstName">First Name (A-Z)</SelectItem>
                                    <SelectItem value="lastName">Last Name (A-Z)</SelectItem>
                                    <SelectItem value="mostRecentAvailability">Most Recent Availability Entered</SelectItem>
                                    <SelectItem value="stillNeedConfirmed">Still Need Confirmed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="overflow-auto">
                <Table className="min-w-max">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] sticky left-0 bg-card z-10">Employee ({filteredEmployees.length})</TableHead>
                            {week.map(day => (
                                <TableHead key={day.toISOString()} className="text-center min-w-[180px]">{format(day, 'EEE, MMM d')}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEmployees.map((employee, index) => {
                            const colorClass = rowColors[index % rowColors.length];
                            return (
                            <React.Fragment key={employee.id}>
                                <TableRow 
                                  className={cn(colorClass)}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = ''}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                    <TableCell className={cn("font-medium align-top pt-5 sticky left-0 z-10", colorClass)}>
                                        {employee.name}
                                        <p className="text-xs text-muted-foreground font-normal">Available</p>
                                    </TableCell>
                                    {week.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const dayAvailability = availability[dateKey]?.[employee.id] || [];
                                        return (
                                            <TableCell key={`${day.toISOString()}-avail`} className="text-center space-y-1 align-top pt-5">
                                                {dayAvailability.length > 0 ? (
                                                    dayAvailability.map((slot: any, index: number) => (
                                                        <Button
                                                            key={index}
                                                            variant={slot.confirmed ? 'default' : 'outline'}
                                                            size="sm"
                                                            className={cn("text-xs h-auto py-1", slot.confirmed && "bg-green-600 hover:bg-green-700")}
                                                            onClick={() => handleConfirmClick(employee.id, dateKey, slot)}
                                                        >
                                                            {slot.start} - {slot.end}
                                                        </Button>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                                <TableRow 
                                  className={cn(colorClass, "border-b-2 border-background dark:border-background/20")}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = ''}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                     <TableCell className={cn("font-medium align-top pb-5 sticky left-0 z-10", colorClass)}>
                                         <p className="text-xs text-muted-foreground font-normal">Confirmed</p>
                                         <Button variant="outline" size="sm" className="h-6 mt-1" onClick={() => handleCopyAllAvailable(employee.id)}>
                                            <Copy className="mr-1 h-3 w-3" />
                                            Copy All Available
                                         </Button>
                                     </TableCell>
                                     {week.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        return (
                                            <TableCell key={`${day.toISOString()}-confirm`} className="text-center align-top pb-5">
                                                <Input
                                                    type="text"
                                                    placeholder="e.g., 8am-5pm"
                                                    value={localHours[employee.id]?.[dateKey] || ''}
                                                    onChange={(e) => handleHoursChange(employee.id, dateKey, e.target.value)}
                                                    onBlur={() => handleHoursSubmit(employee.id, dateKey)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleHoursSubmit(employee.id, dateKey)}
                                                />
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                                <TableRow 
                                  className={cn(colorClass, "border-b-2 border-background dark:border-background/20")}
                                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = ''}
                                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
                                >
                                     <TableCell className={cn("font-medium align-top pb-4 sticky left-0 z-10", colorClass)}>
                                         <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold flex items-center gap-1 mt-1">
                                           <FileText className="h-3.5 w-3.5 text-amber-600" /> Notes for HR
                                         </p>
                                     </TableCell>
                                     {week.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const note = hrNotes[dateKey]?.[employee.id] || '';
                                        return (
                                            <TableCell key={`${day.toISOString()}-hrnote`} className="text-center align-top pb-4 text-xs">
                                                {note ? (
                                                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-md p-2 text-[11px] text-amber-950 dark:text-amber-200 text-left whitespace-pre-wrap font-medium shadow-xs">
                                                    {note}
                                                  </div>
                                                ) : (
                                                  <span className="text-muted-foreground text-xs opacity-40">-</span>
                                                )}
                                            </TableCell>
                                        );
                                     })}
                                </TableRow>
                            </React.Fragment>
                        )})}
                    </TableBody>
                </Table>
            </CardContent>
             <CardContent className="pt-4 flex flex-wrap gap-6 justify-between items-start">
                <div className="min-w-[280px]">
                    <h4 className="font-semibold text-sm mb-1">Availability Data</h4>
                    <div className="flex flex-wrap gap-2">
                        <input type="file" ref={availabilityImportRef} onChange={handleAvailabilityImport} accept=".csv,.xlsx" className="hidden" id="availability-import" />
                        <Button asChild variant="outline" size="sm">
                            <Label htmlFor="availability-import" className="cursor-pointer flex items-center">
                                <Upload className="mr-2 h-4 w-4" /> Import
                            </Label>
                        </Button>
                        <Button onClick={exportAvailabilityToCSV} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
                        <Button onClick={() => handleOpenRemoveDialog('availability')} variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Availability Data
                        </Button>
                    </div>
                </div>
                 <div className="min-w-[280px]">
                    <h4 className="font-semibold text-sm mb-1">Confirmed Hours Data</h4>
                    <div className="flex flex-wrap gap-2">
                        <input type="file" ref={confirmedHoursImportRef} onChange={handleConfirmedHoursImport} accept=".csv,.xlsx" className="hidden" id="confirmed-hours-import" />
                         <Button asChild variant="outline" size="sm">
                            <Label htmlFor="confirmed-hours-import" className="cursor-pointer flex items-center">
                                <Upload className="mr-2 h-4 w-4" /> Import
                            </Label>
                        </Button>
                        <Button onClick={exportConfirmedHoursToCSV} size="sm" variant="outline"><Download className="mr-2 h-4 w-4" /> Export</Button>
                        <Button onClick={() => handleOpenRemoveDialog('confirmed')} variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Confirmed Hours
                        </Button>
                    </div>
                </div>
            </CardContent>

            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Remove {removeType === 'availability' ? 'Availability' : 'Confirmed Hours'} Data
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground pt-1">
                            Warning: This action will permanently delete all {removeType === 'availability' ? 'availability' : 'confirmed hours'} data across the entire application. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="admin-pin" className="text-sm font-medium text-foreground">
                                Enter Joshua Lehn's Admin PIN to authorize:
                            </Label>
                            <Input
                                id="admin-pin"
                                type="password"
                                placeholder="6-digit Admin PIN"
                                value={pinInput}
                                onChange={(e) => {
                                    setPinInput(e.target.value);
                                    setPinError('');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleConfirmRemove();
                                    }
                                }}
                                className="w-full"
                                autoFocus
                            />
                            {pinError && <p id="pin-error-msg" className="text-xs text-red-500 font-medium">{pinError}</p>}
                        </div>
                    </div>
                    <DialogFooter className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleConfirmRemove}>Remove Data</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

