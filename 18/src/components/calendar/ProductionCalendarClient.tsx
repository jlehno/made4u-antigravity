

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { addDays, format, addMonths, subMonths, parse, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isValid, setHours, setMinutes, setSeconds, subDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { useProduction } from '@/lib/store';
import { BAYS, BAY_COLORS } from '@/lib/types';
import type { Bay, ProductionItem, Product, Machine, ProductionSchedule, DayProduction, CalendarNote, PrepStep, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ChevronLeft, ChevronRight, Plus, X, Edit, Trash2, Upload, FileText, Check, Search, DownloadCloud, PlusCircle, Calendar as CalendarIcon, Clock, Download, GripVertical, ChevronsUpDown, Notebook, StickyNote, Package, RotateCcw, RotateCw } from 'lucide-react';
import { cn, isColorLight } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Textarea } from '../ui/textarea';
import * as XLSX from 'xlsx';
import { Switch } from '../ui/switch';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';

type DraggableItemData = {
    bay: Bay;
    item: ProductionItem;
    product: Product;
    dateKey: string;
};

// Function to parse time like "8:00am" or "5pm" into a Date object
function parseTime(timeStr: string): Date | null {
  if (!timeStr) return null;
  
  // Normalize the time string
  const normalizedTimeStr = timeStr.toLowerCase().replace(/\s/g, '');
  
  const match = normalizedTimeStr.match(/(\d{1,2})(:(\d{2}))?(am|pm)/i);
  if (!match) return null;

  let [_, hoursStr, , minutesStr, period] = match;
  let hours = parseInt(hoursStr, 10);
  let minutes = minutesStr ? parseInt(minutesStr, 10) : 0;

  if (period === 'pm' && hours !== 12) {
    hours += 12;
  }
  if (period === 'am' && hours === 12) {
    hours = 0; // Midnight case
  }
  
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}


// Function to calculate hours between two time strings
function calculateHours(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const startTime = parseTime(startStr);
  const endTime = parseTime(endStr);
  
  if (!startTime || !endTime) return 0;
  
  let diff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (diff < 0) diff += 24; // Handle overnight shifts if necessary

  return diff;
}


const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MIN_COL_WIDTH = 150;

function ResizableHandle({ onResize, onResizeEnd }: { onResize: (delta: number) => void, onResizeEnd: (finalWidth: number) => void }) {
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);


    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.clientX);
        const colElement = (e.target as HTMLElement).closest('th');
        setStartWidth(colElement?.offsetWidth || 0);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        onResize(startWidth + deltaX);
    }, [isDragging, startX, startWidth, onResize]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (isDragging) {
            const deltaX = e.clientX - startX;
            onResizeEnd(startWidth + deltaX);
            setIsDragging(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }, [isDragging, startX, startWidth, onResizeEnd]);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    return (
        <div
            onMouseDown={handleMouseDown}
            className={cn(
                'absolute top-0 right-0 h-full w-2 cursor-col-resize z-10',
                isDragging ? 'bg-primary/20' : 'hover:bg-primary/10'
            )}
        />
    );
}

function MiniLiveProductionCalendar({
  schedule,
  products,
  selectedDates,
  onSelectDates,
  onConfirmDuplication,
  confirmButtonText = "Confirm Duplication",
  previewItemsCount = 1,
  selectedItemKeys = [],
  onClose,
}: {
  schedule: ProductionSchedule;
  products: Product[];
  selectedDates: Date[];
  onSelectDates: (dates: Date[]) => void;
  onConfirmDuplication: (dates: Date[]) => void;
  confirmButtonText?: string;
  previewItemsCount?: number;
  selectedItemKeys?: string[];
  onClose?: () => void;
}) {
  const [miniMonth, setMiniMonth] = useState<Date>(new Date());
  
  const miniMonthDays = useMemo(() => 
    eachDayOfInterval({ start: startOfMonth(miniMonth), end: endOfMonth(miniMonth) }), 
    [miniMonth]
  );
  
  const startingDayIndex = (getDay(startOfMonth(miniMonth)) + 6) % 7;

  // Multi-day selection offset calculation
  const relativeOffsets = useMemo(() => {
    if (!selectedItemKeys || selectedItemKeys.length === 0) return [0];
    const sortedDates = Array.from(new Set(selectedItemKeys.map(k => k.split('|')[0]))).sort();
    const minDate = parseISO(sortedDates[0]);
    return Array.from(new Set(selectedItemKeys.map(k => {
      const dateKey = k.split('|')[0];
      return differenceInCalendarDays(parseISO(dateKey), minDate);
    })));
  }, [selectedItemKeys]);

  // Landing date keys based on first selected date
  const landingDateKeys = useMemo(() => {
    if (!selectedDates || selectedDates.length === 0) return [];
    const targetStart = selectedDates[0];
    return relativeOffsets.map(offset => format(addDays(targetStart, offset), 'yyyy-MM-dd'));
  }, [selectedDates, relativeOffsets]);

  const isDateSelected = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    return selectedDates.some(d => format(d, 'yyyy-MM-dd') === key);
  };

  const isDateLandingTarget = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    return landingDateKeys.includes(key);
  };

  const isMultiDayPattern = relativeOffsets.length > 1;

  const toggleDateSelection = (day: Date) => {
    if (isMultiDayPattern) {
      onSelectDates([day]);
    } else {
      if (isDateSelected(day)) {
        onSelectDates(selectedDates.filter(d => format(d, 'yyyy-MM-dd') !== format(day, 'yyyy-MM-dd')));
      } else {
        onSelectDates([...selectedDates, day]);
      }
    }
  };

  return (
    <div className="w-[360px] sm:w-[460px] p-3.5 space-y-3 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl shadow-2xl relative">
      {/* Header with centered month arrows and single top-right exit X button */}
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800 relative">
        <div className="flex items-center justify-center gap-2 mx-auto">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-zinc-100 bg-zinc-900 border-zinc-700" onClick={() => setMiniMonth(subMonths(miniMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-bold text-sm text-zinc-100 min-w-[120px] text-center">{format(miniMonth, 'MMMM yyyy')}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-zinc-100 bg-zinc-900 border-zinc-700" onClick={() => setMiniMonth(addMonths(miniMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white absolute right-0 top-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-400">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startingDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="h-16 rounded-md border border-transparent bg-zinc-900/20" />
        ))}

        {miniMonthDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const daySchedule = schedule[dateKey] || {};
          
          const dayItems: { bay: Bay; item: ProductionItem; product: Product }[] = [];
          for (const bay of BAYS) {
            const items = (daySchedule[bay] || []).map((item: ProductionItem) => {
              const product = products.find(p => p.id === item.productId);
              return product ? { bay: bay as Bay, item, product } : null;
            }).filter((i: any): i is { bay: Bay; item: ProductionItem; product: Product } => !!i);
            dayItems.push(...items);
          }

          const selected = isDateSelected(day);
          const isLanding = isDateLandingTarget(day);
          const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => toggleDateSelection(day)}
              className={cn(
                "h-16 p-1 rounded-md border text-left flex flex-col justify-between transition-all relative overflow-hidden",
                selected
                  ? "border-emerald-400 bg-emerald-950/80 ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-950 font-bold"
                  : isLanding
                  ? "border-amber-400 bg-amber-950/70 ring-2 ring-amber-400 font-bold text-amber-200"
                  : isToday
                  ? "border-emerald-500/70 bg-emerald-950/40"
                  : dayItems.length > 0
                  ? "border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/80"
                  : "border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900/50"
              )}
            >
              <div className="flex justify-between items-center w-full">
                <span className={cn("text-[11px] font-semibold", (selected || isLanding) ? "text-amber-200 font-bold" : "text-zinc-200")}>
                  {format(day, 'd')}
                </span>
                {(selected || isLanding) && (
                  <Check className="h-3 w-3 text-amber-400 shrink-0" />
                )}
              </div>

              {/* Saved Data Entries: Client Name, Abbrev Product, Batches, & Bay Color */}
              <div className="space-y-0.5 overflow-hidden w-full">
                {dayItems.length > 0 ? (
                  dayItems.slice(0, 2).map(({ bay, item, product }) => (
                    <div
                      key={item.id}
                      className={cn(
                        "text-[8px] leading-tight px-1 py-0.5 rounded flex items-center justify-between gap-0.5 font-medium truncate",
                        BAY_COLORS[bay].base,
                        BAY_COLORS[bay].text
                      )}
                    >
                      <span className="truncate">{product.coPacker}: {product.name}</span>
                      <span className="shrink-0 font-bold opacity-90">{item.batches}b</span>
                    </div>
                  ))
                ) : (
                  <span className="text-[8px] text-emerald-400/80 font-medium block text-center py-0.5">Open</span>
                )}

                {isLanding && (
                  <div className="text-[8px] font-bold text-amber-200 bg-amber-900/90 px-0.5 rounded border border-amber-500/60 truncate text-center">
                    Copy Landing
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>
            {selectedDates.length > 0
              ? `Starts ${format(selectedDates[0], 'MMM d')} (spans ${landingDateKeys.length} day[s])`
              : "Pick target start date"}
          </span>
          <span className="flex items-center gap-1 text-amber-300 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Landing Target
          </span>
        </div>
        <Button
          size="sm"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          disabled={selectedDates.length === 0}
          onClick={() => onConfirmDuplication(selectedDates)}
        >
          {confirmButtonText} ({previewItemsCount} items across {landingDateKeys.length || 1} day[s])
        </Button>
      </div>
    </div>
  );
}

export function ProductionCalendarClient() {
  const { products, schedule, setSchedule, updateSchedule, bulkUpdateSchedule, bulkReplaceSchedule, addOrUpdateProduct, deleteProduct, deleteAllProducts, machinery, addOrUpdateMachine, deleteMachine, mergeSchedule, clearSchedule, setCalendarColumnWidths, calendarNotes, setCalendarNote, settings, isDataLoading, prepSteps, addOrUpdatePrepStep, deletePrepStep, deleteAllPrepSteps, confirmedHours, users } = useProduction();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthInput, setMonthInput] = useState(format(currentMonth, 'M'));
  const [yearInput, setYearInput] = useState(format(currentMonth, 'yyyy'));
  const { toast } = useToast();
  const [activeDragItem, setActiveDragItem] = useState<DraggableItemData | null>(null);
  const localColumnWidths = settings?.calendarColumnWidths || Array(7).fill(MIN_COL_WIDTH);
  const [selectedCoPacker, setSelectedCoPacker] = useState<string>('');
  
  const coPackers = useMemo(() => Array.from(new Set(products.map(p => p.coPacker))), [products]);
  const monthDays = useMemo(() => eachDayOfInterval({start: startOfMonth(currentMonth), end: endOfMonth(currentMonth)}), [currentMonth]);
  
  const handleResize = (columnIndex: number, newWidth: number) => {
      const newWidths = [...localColumnWidths];
      newWidths[columnIndex] = Math.max(newWidth, MIN_COL_WIDTH / 2);
      setCalendarColumnWidths(newWidths);
  };

  const handleResizeEnd = (columnIndex: number, finalWidth: number) => {
      const finalWidths = [...localColumnWidths];
      finalWidths[columnIndex] = Math.max(finalWidth, MIN_COL_WIDTH / 2);
      setCalendarColumnWidths(finalWidths);
  };

  const handleAddItem = (date: Date, bay: Bay) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const newItem = { id: `item-${dateKey}-${bay}-${Date.now()}`, productId: '', batches: '1' };
    updateSchedule(dateKey, bay, [...(schedule[dateKey]?.[bay] || []), newItem]);
  };

  const handleUpdateItem = (date: Date, bay: Bay, itemId: string, updatedItem: Partial<ProductionItem>) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const baySchedule = schedule[dateKey]?.[bay];
    if (!baySchedule) return;
    const updatedItems = baySchedule.map(item => item.id === itemId ? { ...item, ...updatedItem } : item);
    updateSchedule(dateKey, bay, updatedItems);
  };
  
  const handleRemoveItem = (date: Date, bay: Bay, itemId: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const baySchedule = schedule[dateKey]?.[bay];
    if (!baySchedule) return;
    const filteredItems = baySchedule.filter(item => item.id !== itemId);
    updateSchedule(dateKey, bay, filteredItems);
  };

  const handleRemoveAll = (date: Date, bay: Bay) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    updateSchedule(dateKey, bay, []);
  };

  const handleChangeBay = (dateKey: string, oldBay: Bay, newBay: Bay, item: ProductionItem) => {
      updateSchedule(dateKey, newBay, [item], dateKey, oldBay);
  }
  
  const handleMoveItemToDate = (oldDateKey: string, newDate: Date, bay: Bay, item: ProductionItem) => {
      const newDateKey = format(newDate, 'yyyy-MM-dd');
      if (oldDateKey === newDateKey) return;
      updateSchedule(newDateKey, bay, [item], oldDateKey, bay);
  }
  
  const handleDuplicateItem = (item: ProductionItem, bay: Bay, dates: Date[]) => {
    dates.forEach(date => {
        const newDateKey = format(date, 'yyyy-MM-dd');
        const newItem = { ...item, id: `item-${newDateKey}-${bay}-${Date.now()}` };
        updateSchedule(newDateKey, bay, [newItem], undefined, undefined, true);
    });
    toast({
        title: "Duplication Successful",
        description: `Product duplicated to ${dates.length} new dates.`
    });
  };

  const handleGoToDate = () => {
    const month = parseInt(monthInput, 10);
    const year = parseInt(yearInput, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      toast({ variant: 'destructive', title: 'Invalid Month', description: 'Please enter a month between 1 and 12.' });
      return;
    }
    if (isNaN(year) || year < 1900 || year > 2100) {
      toast({ variant: 'destructive', title: 'Invalid Year', description: 'Please enter a year between 1900 and 2100.' });
      return;
    }
    
    const newDate = new Date(year, month - 1, 1);
    if (isValid(newDate)) {
      setCurrentMonth(newDate);
    } else {
       toast({ variant: 'destructive', title: 'Invalid Date', description: 'Could not create a valid date from your input.' });
    }
  };

  const startingDayIndex = useMemo(() => (getDay(startOfMonth(currentMonth)) + 6) % 7, [currentMonth]);

  const { totalMonthBayDays, monthlyAverages } = useMemo(() => {
    let totalBayDays = 0;
    let totalScheduledFTE = 0;
    let daysWithScheduledFTE = 0;
    let totalRequiredFTE = 0;
    let daysWithRequiredFTE = 0;
    
    monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySchedule = schedule[dateKey];
        
        // Bay Days Calculation
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                    const batchesToday = parseFloat(item.batches);
                    if (batchesPriced > 0) {
                        totalBayDays += (batchesToday / batchesPriced);
                    }
                }
            });
        }
        
        // Scheduled FTE Calculation
        const todaysHours = confirmedHours[dateKey];
        let dailyTotalHours = 0;
        if (todaysHours) {
          const workingUserIds = Object.keys(todaysHours).filter(userId => todaysHours[userId]?.length > 0);
          const workingUsers = users.filter(user => workingUserIds.includes(user.id) && !user.name.toLowerCase().includes('lehn'));
          
          workingUsers.forEach(user => {
            const hoursRanges = todaysHours[user.id] || [];
            dailyTotalHours += hoursRanges.reduce((acc, range) => {
              const [start, end] = range.split('-');
              return acc + calculateHours(start, end);
            }, 0);
          });
        }
        
        const dailyScheduledFTE = dailyTotalHours > 0 ? (dailyTotalHours / 8.5) : 0;
        if (dailyScheduledFTE > 0) {
            totalScheduledFTE += dailyScheduledFTE;
            daysWithScheduledFTE++;
        }
        
        // Required FTE Calculation
        let dailyRequiredFTE = 0;
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                    const ftesPriced = parseFloat(product.ftesPricedFor1BayDay || '0');
                    const batchesToday = parseFloat(item.batches);
                    if (batchesPriced > 0) {
                        dailyRequiredFTE += (batchesToday / batchesPriced) * ftesPriced;
                    }
                }
            });
        }
        if (dailyRequiredFTE > 0) {
            totalRequiredFTE += dailyRequiredFTE;
            daysWithRequiredFTE++;
        }
    });

    const averages = {
        avgScheduled: daysWithScheduledFTE > 0 ? totalScheduledFTE / daysWithScheduledFTE : 0,
        avgRequired: daysWithRequiredFTE > 0 ? totalRequiredFTE / daysWithRequiredFTE : 0,
    };
    
    return { totalMonthBayDays: totalBayDays, monthlyAverages: averages };
  }, [currentMonth, schedule, products, confirmedHours, users, monthDays]);

  const coPackersInMonth = useMemo(() => {
    const coPackerNames = new Set<string>();
    monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySchedule = schedule[dateKey];
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    coPackerNames.add(product.coPacker);
                }
            });
        }
    });
    return Array.from(coPackerNames).sort();
  }, [monthDays, schedule, products]);

  const selectedCoPackerTotalBayDays = useMemo(() => {
    if (!selectedCoPacker) return 0;
    let total = 0;
    monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySchedule = schedule[dateKey];
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product && product.coPacker === selectedCoPacker) {
                    const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                    const batchesToday = parseFloat(item.batches);
                    if (batchesPriced > 0) {
                        total += (batchesToday / batchesPriced);
                    }
                }
            });
        }
    });
    return total;
  }, [selectedCoPacker, monthDays, schedule, products]);


  // Select Mode State & Bulk Actions
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [isBulkDuplicateDialogOpen, setIsBulkDuplicateDialogOpen] = useState<boolean>(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState<boolean>(false);
  const [bulkDuplicateDates, setBulkDuplicateDates] = useState<Date[]>([]);
  const [scheduleHistory, setScheduleHistory] = useState<ProductionSchedule[]>([]);
  const [scheduleRedoHistory, setScheduleRedoHistory] = useState<ProductionSchedule[]>([]);

  const pushScheduleHistory = (currSchedule: ProductionSchedule) => {
    setScheduleHistory(prev => [...prev.slice(-10), JSON.parse(JSON.stringify(currSchedule))]);
    setScheduleRedoHistory([]);
  };

  const handleUndoSchedule = () => {
    if (scheduleHistory.length === 0) return;
    const previousState = scheduleHistory[scheduleHistory.length - 1];
    setScheduleHistory(prev => prev.slice(0, -1));
    setScheduleRedoHistory(prev => [...prev, JSON.parse(JSON.stringify(schedule))]);
    setSchedule(previousState);
    toast({
      title: "Action Undone",
      description: "Restored schedule to previous state.",
    });
  };

  const handleRedoSchedule = () => {
    if (scheduleRedoHistory.length === 0) return;
    const nextState = scheduleRedoHistory[scheduleRedoHistory.length - 1];
    setScheduleRedoHistory(prev => prev.slice(0, -1));
    setScheduleHistory(prev => [...prev, JSON.parse(JSON.stringify(schedule))]);
    setSchedule(nextState);
    toast({
      title: "Action Redone",
      description: "Reapplied schedule state.",
    });
  };

  const handleToggleSelectItem = (itemKey: string) => {
    setSelectedItemKeys(prev => 
      prev.includes(itemKey) ? prev.filter(k => k !== itemKey) : [...prev, itemKey]
    );
  };

  const handleConfirmBulkDuplicate = (targetDates: Date[]) => {
    if (targetDates.length === 0 || selectedItemKeys.length === 0) return;

    pushScheduleHistory(schedule);

    const sortedOrigDates = Array.from(new Set(selectedItemKeys.map(k => k.split('|')[0]))).sort();
    const minDateObj = parseISO(sortedOrigDates[0]);

    // Build map of landing updates: { [landingDateKey]: { [bay]: ProductionItem[] } }
    const landingUpdates: Record<string, Record<Bay, ProductionItem[]>> = {};

    const createEmptyBayRecord = (): Record<Bay, ProductionItem[]> => ({
      Blue: [],
      Green: [],
      Orange: [],
      Purple: [],
      Fulfillment: [],
      'Pre-Blending': [],
    });

    targetDates.forEach(targetStartDate => {
      selectedItemKeys.forEach(itemKey => {
        const [origDateKey, origBay, itemId] = itemKey.split('|');
        const origBayItems = schedule[origDateKey]?.[origBay as Bay] || [];
        const origItem = origBayItems.find(i => i.id === itemId);

        if (origItem) {
          const offsetDays = differenceInCalendarDays(parseISO(origDateKey), minDateObj);
          const landingDateObj = addDays(targetStartDate, offsetDays);
          const landingDateKey = format(landingDateObj, 'yyyy-MM-dd');
          const bay = origBay as Bay;

          if (!landingUpdates[landingDateKey]) {
            landingUpdates[landingDateKey] = createEmptyBayRecord();
          }

          const newItem: ProductionItem = {
            ...origItem,
            id: `item-${landingDateKey}-${bay}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
          };

          landingUpdates[landingDateKey][bay].push(newItem);
        }
      });
    });

    // Apply all grouped updates to schedule state and atomic Firestore batch
    const updated = { ...schedule };
    const bulkItemsToInsert: { dateKey: string; bay: Bay; items: ProductionItem[] }[] = [];

    Object.entries(landingUpdates).forEach(([dateKey, bayUpdates]) => {
      if (!updated[dateKey]) {
        updated[dateKey] = createEmptyBayRecord();
      } else {
        updated[dateKey] = { ...updated[dateKey] };
      }

      Object.entries(bayUpdates).forEach(([bayStr, newItems]) => {
        const bay = bayStr as Bay;
        if (newItems && newItems.length > 0) {
          const existingBayItems = updated[dateKey][bay] || [];
          updated[dateKey][bay] = [...existingBayItems, ...newItems];
          bulkItemsToInsert.push({ dateKey, bay, items: newItems });
        }
      });
    });

    setSchedule(updated);
    bulkUpdateSchedule(bulkItemsToInsert);

    toast({
      title: "Bulk Duplication Complete",
      description: `Duplicated ${selectedItemKeys.length} item(s) to schedule starting ${format(targetDates[0], 'MMM d, yyyy')}.`,
    });

    setIsBulkDuplicateDialogOpen(false);
    setBulkDuplicateDates([]);
    setSelectedItemKeys([]);
    setIsSelectMode(false);
  };

  const handleConfirmBulkDelete = () => {
    if (selectedItemKeys.length === 0) return;

    pushScheduleHistory(schedule);

    // Group item IDs to delete by dateKey and bay
    const toDelete: Record<string, Record<string, string[]>> = {};
    selectedItemKeys.forEach(itemKey => {
      const [dateKey, bay, itemId] = itemKey.split('|');
      if (!toDelete[dateKey]) toDelete[dateKey] = {};
      if (!toDelete[dateKey][bay]) toDelete[dateKey][bay] = [];
      toDelete[dateKey][bay].push(itemId);
    });

    // Compute updated schedule in memory for local state
    const updated = JSON.parse(JSON.stringify(schedule));
    const bulkSetUpdates: { dateKey: string; bay: Bay; items: ProductionItem[] }[] = [];

    Object.entries(toDelete).forEach(([dateKey, bayMap]) => {
      if (updated[dateKey]) {
        Object.entries(bayMap).forEach(([bayStr, itemIdsToDelete]) => {
          const bay = bayStr as Bay;
          const currentItems: ProductionItem[] = updated[dateKey][bay] || [];
          const remainingItems = currentItems.filter(item => !itemIdsToDelete.includes(item.id));
          updated[dateKey][bay] = remainingItems;
          bulkSetUpdates.push({ dateKey, bay, items: remainingItems });
        });
      }
    });

    // Update local state immediately
    setSchedule(updated);

    // Update Firestore atomically per dateKey
    bulkReplaceSchedule(bulkSetUpdates);

    toast({
      title: "Bulk Deletion Complete",
      description: `Deleted ${selectedItemKeys.length} selected item(s).`,
    });

    setIsBulkDeleteDialogOpen(false);
    setSelectedItemKeys([]);
    setIsSelectMode(false);
  };

  const calendarRows = useMemo(() => {
    if (isDataLoading) return [];
    const rows: React.ReactNode[] = [];
    let cells: React.ReactNode[] = [];
    for (let i = 0; i < startingDayIndex; i++) {
        cells.push(<TableCell key={`empty-${i}`} className="border-r-2 border-zinc-800" />);
    }
    monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        cells.push(
             <DroppableDayCell 
                key={day.toString()} 
                day={day} 
                dateKey={dateKey}
                products={products} 
                schedule={schedule}
                prepSteps={prepSteps}
                calendarNotes={calendarNotes}
                setCalendarNote={setCalendarNote}
                machinery={machinery}
                confirmedHours={confirmedHours}
                users={users}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onRemoveItem={handleRemoveItem}
                onRemoveAll={handleRemoveAll}
                coPackers={coPackers}
                onChangeBay={handleChangeBay}
                onMoveItemToDate={handleMoveItemToDate}
                onDuplicateItem={handleDuplicateItem}
                activeDragItem={activeDragItem}
                updateSchedule={updateSchedule}
                isSelectMode={isSelectMode}
                selectedItemKeys={selectedItemKeys}
                onToggleSelectItem={handleToggleSelectItem}
            />
        );
        if (cells.length === 7) {
            rows.push(<TableRow key={day.toString()}>{cells}</TableRow>);
            cells = [];
        }
    });
    if (cells.length > 0) {
        while (cells.length < 7) {
            cells.push(<TableCell key={`empty-end-${cells.length}`} className="border-r-2 border-zinc-800" />);
        }
        rows.push(<TableRow key="last-row">{cells}</TableRow>);
    }
    return rows;
  }, [startingDayIndex, monthDays, products, schedule, machinery, prepSteps, activeDragItem, localColumnWidths, coPackers, calendarNotes, confirmedHours, users, updateSchedule, isDataLoading, setCalendarNote, handleAddItem, handleUpdateItem, handleRemoveItem, handleRemoveAll, handleChangeBay, handleMoveItemToDate, handleDuplicateItem, isSelectMode, selectedItemKeys]);

  const handleDragStart = (event: any) => {
    setActiveDragItem(event.active.data.current ?? null);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over || !active.data.current) return;

    const activeData = active.data.current as DraggableItemData;
    const overDateKey = over.id as string;
    const { dateKey: oldDateKey, bay: oldBay, item: movedItem } = activeData;
    
    if (oldDateKey === overDateKey) return;
    
    // Optimistic update for instant UI feedback
    const newSchedule = { ...schedule };
    
    // Remove from old date
    if (newSchedule[oldDateKey] && newSchedule[oldDateKey][oldBay]) {
      newSchedule[oldDateKey][oldBay] = newSchedule[oldDateKey][oldBay].filter((item: any) => item.id !== movedItem.id);
      if (newSchedule[oldDateKey][oldBay].length === 0) {
        delete newSchedule[oldDateKey][oldBay];
        if (Object.keys(newSchedule[oldDateKey]).length === 0) {
          delete newSchedule[oldDateKey];
        }
      }
    }
    
    // Add to new date
    if (!newSchedule[overDateKey]) {
      newSchedule[overDateKey] = {};
    }
    if (!newSchedule[overDateKey][oldBay]) {
      newSchedule[overDateKey][oldBay] = [];
    }
    newSchedule[overDateKey][oldBay].push(movedItem);

    setSchedule(newSchedule);

    updateSchedule(overDateKey, oldBay, [movedItem], oldDateKey, oldBay);

    toast({
        title: "Schedule Updated",
        description: `${activeData.product.name} moved to ${format(parse(overDateKey, 'yyyy-MM-dd', new Date()), 'PPP')}.`
    });
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="space-y-8">

        <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
            <CardHeader>
                <CardTitle>Monthly Schedule Overview</CardTitle>
                <CardDescription>Drag and drop products to quickly reschedule them to a different day.</CardDescription>
                <div className="flex justify-between items-center flex-wrap gap-4 pt-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <h2 className="text-xl font-bold w-48 text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
                                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            {/* SELECT MODE BUTTON & ACTION BUTTONS RIGHT UNDER MONTH NAME */}
                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    variant={isSelectMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setIsSelectMode(!isSelectMode);
                                        if (isSelectMode) setSelectedItemKeys([]);
                                    }}
                                    className={cn("gap-1.5 h-8 text-xs", isSelectMode && "bg-primary text-primary-foreground font-bold")}
                                >
                                    <span>Select Mode</span>
                                </Button>

                                {isSelectMode && (
                                    <>
                                        <Dialog open={isBulkDuplicateDialogOpen} onOpenChange={setIsBulkDuplicateDialogOpen}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={selectedItemKeys.length === 0}
                                                    className="gap-1.5 h-8 text-xs bg-blue-950/40 text-blue-300 border-blue-800 hover:bg-blue-900/60"
                                                >
                                                    <span>Duplicate To ({selectedItemKeys.length})</span>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="w-auto p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
                                                <DialogTitle className="sr-only">Duplicate Schedule Items</DialogTitle>
                                                <MiniLiveProductionCalendar
                                                    schedule={schedule}
                                                    products={products}
                                                    selectedDates={bulkDuplicateDates}
                                                    onSelectDates={setBulkDuplicateDates}
                                                    onConfirmDuplication={handleConfirmBulkDuplicate}
                                                    confirmButtonText="Confirm Duplication"
                                                    previewItemsCount={selectedItemKeys.length}
                                                    selectedItemKeys={selectedItemKeys}
                                                    onClose={() => setIsBulkDuplicateDialogOpen(false)}
                                                />
                                            </DialogContent>
                                        </Dialog>

                                        {/* UNDO & REDO BUTTONS TO THE LEFT OF DELETE SELECTED */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={scheduleHistory.length === 0}
                                            onClick={handleUndoSchedule}
                                            className="gap-1.5 h-8 text-xs bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                            <span>Undo</span>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={scheduleRedoHistory.length === 0}
                                            onClick={handleRedoSchedule}
                                            className="gap-1.5 h-8 text-xs bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                                        >
                                            <RotateCw className="h-3.5 w-3.5" />
                                            <span>Redo</span>
                                        </Button>

                                        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    disabled={selectedItemKeys.length === 0}
                                                    className="gap-1.5 h-8 text-xs"
                                                >
                                                    <span>Delete Selected ({selectedItemKeys.length})</span>
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure you want delete all these selected items?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete {selectedItemKeys.length} selected item(s) from the calendar schedule.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>No</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleConfirmBulkDelete}>Yes</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="border p-2 rounded-lg bg-background shadow-sm text-center">
                            <p className="text-sm font-medium text-muted-foreground">Bay Days Produced This Month</p>
                            <p className="text-2xl font-bold">{totalMonthBayDays.toFixed(2)}</p>
                        </div>
                         <div className="border p-2 rounded-lg bg-background shadow-sm text-center">
                            <p className="text-sm font-medium text-muted-foreground">Average Scheduled FTEs (Excluding Lehn Family)</p>
                            <p className="text-2xl font-bold">{monthlyAverages.avgScheduled.toFixed(2)}</p>
                        </div>
                        <div className="border p-2 rounded-lg bg-background shadow-sm text-center">
                            <p className="text-sm font-medium text-muted-foreground">Average Required FTEs</p>
                            <p className="text-2xl font-bold">{monthlyAverages.avgRequired.toFixed(2)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Input type="number" placeholder="Month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} className="w-20" aria-label="Month" />
                        <Input type="number" placeholder="Year" value={yearInput} onChange={(e) => setYearInput(e.target.value)} className="w-24" aria-label="Year" />
                        <Button onClick={handleGoToDate} size="sm">Go</Button>
                         <Button onClick={() => setCurrentMonth(new Date())}>Today</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                 <Table className="border-collapse border-t-2 border-l-2 border-zinc-800 w-full table-fixed">
                     <colgroup>
                        {localColumnWidths.map((width, i) => (
                            <col key={i} style={{ width: `${width}px` }} />
                        ))}
                    </colgroup>
                    <TableHeader>
                        <TableRow>
                            {WEEK_DAYS.map((day, i) => (
                                <TableHead key={day} className="py-2 text-center font-semibold text-sm bg-zinc-950 text-zinc-300 relative border-r-2 border-b-2 border-zinc-800">
                                    {day}
                                    {i < WEEK_DAYS.length - 1 && (
                                        <ResizableHandle 
                                            onResize={(newWidth) => handleResize(i, newWidth)}
                                            onResizeEnd={(finalWidth) => handleResizeEnd(i, finalWidth)}
                                        />
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calendarRows}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
            <CardHeader>
                <CardTitle>Co-Packer Bay Days This Month</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <Select value={selectedCoPacker} onValueChange={setSelectedCoPacker}>
                    <SelectTrigger className="w-[400px]">
                        <SelectValue placeholder="Select a co-packer to see their monthly bay days..." />
                    </SelectTrigger>
                    <SelectContent>
                        {coPackersInMonth.map(cp => (
                            <SelectItem key={cp} value={cp}>
                                {cp}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedCoPacker && (
                    <div className="border p-2 rounded-lg bg-background shadow-sm text-center">
                        <p className="text-sm font-medium text-muted-foreground">Total Bay Days for {selectedCoPacker}</p>
                        <p className="text-2xl font-bold">{selectedCoPackerTotalBayDays.toFixed(2)}</p>
                    </div>
                )}
            </CardContent>
        </Card>

        <ImportExportCalendarData />

        <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Manage products, machinery, and other settings for scheduling.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" defaultValue="products">
                <ProductList items={products} machinery={machinery} onSave={addOrUpdateProduct} onDelete={deleteProduct} onDeleteAll={deleteAllProducts} />
                <MachineryList items={machinery} onSave={addOrUpdateMachine} onDelete={deleteMachine} />
                <PrepStepList 
                  prepSteps={prepSteps}
                  products={products}
                  onSave={addOrUpdatePrepStep}
                  onDelete={deletePrepStep}
                  onDeleteAll={deleteAllPrepSteps}
                />
            </Accordion>
          </CardContent>
        </Card>
      </div>
      <DragOverlay>
        {activeDragItem ? (
            <div 
                className={cn('p-1 rounded-sm font-medium text-xs shadow-lg flex items-center gap-1', BAY_COLORS[activeDragItem.bay].base, BAY_COLORS[activeDragItem.bay].text)}
            >
                {activeDragItem.item.batches} - {activeDragItem.product.coPacker} {activeDragItem.product.name}
            </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function ImportExportCalendarData() {
    const { schedule, products, mergeSchedule, clearSchedule, calendarNotes, confirmedHours, users } = useProduction();
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isClearAuthenticated, setIsClearAuthenticated] = useState(false);
    const [clearPassword, setClearPassword] = useState('');
    const [clearPasswordError, setClearPasswordError] = useState('');
    const importFileInputRef = React.useRef<HTMLInputElement>(null);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

    const handlePasswordSubmit = () => {
        if (password === '310101') {
            setIsAuthenticated(true);
            setPasswordError('');
        } else {
            setPasswordError('Incorrect password.');
        }
    };
    
    const handleFileImportClick = () => {
        if (isAuthenticated) {
            importFileInputRef.current?.click();
        }
    };

    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                const importedSchedule: ProductionSchedule = {};
                const importedNotes: Record<string, Partial<CalendarNote[string]>> = {};
                
                const productMap = new Map(products.map(p => [p.name.trim().toLowerCase(), p]));

                json.forEach((row) => {
                    const dateKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'date') || 'Date';
                    const bayKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'bay') || 'Bay';
                    const productKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'product') || 'Product';
                    const batchesKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'batches') || 'Batches';
                    const noteKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'note') || 'Note';
                    const timeLeftKeyInRow = Object.keys(row).find(k => k.toLowerCase() === 'time left building') || 'Time Left Building';

                    const dateValue = row[dateKeyInRow];
                    const Bay = row[bayKeyInRow];
                    const productName = row[productKeyInRow];
                    const Batches = row[batchesKeyInRow];
                    const Note = row[noteKeyInRow];
                    const timeLeft = row[timeLeftKeyInRow];
                    
                    let date: Date;
                    if (!dateValue) return;

                    if (dateValue instanceof Date) {
                        date = dateValue;
                    } else if (typeof dateValue === 'number') {
                        date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
                    } else if (typeof dateValue === 'string') {
                        date = new Date(dateValue);
                    } else {
                        return;
                    }
                    if (!isValid(date)) return;
                    const dateKey = format(date, 'yyyy-MM-dd');
                    
                    if (Note || timeLeft) {
                        if (!importedNotes[dateKey]) importedNotes[dateKey] = {};
                        if (Note) importedNotes[dateKey]!.note = String(Note);
                        if (timeLeft) importedNotes[dateKey]!.timeLeftBuilding = String(timeLeft);
                    }

                    if (!Bay || !productName || Batches === undefined) return;
                    
                    const product = productMap.get(String(productName).trim().toLowerCase());
                    if (!product) return;

                    // Case-insensitive, robust Bay name normalization (e.g., "blue" -> "Blue", "pre-blending" -> "Pre-Blending")
                    const normalizedBay = BAYS.find(b => {
                        const standard = b.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const input = String(Bay).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                        return standard === input;
                    });
                    if (!normalizedBay) return;

                    if (!importedSchedule[dateKey]) {
                        importedSchedule[dateKey] = {};
                    }
                    if (!importedSchedule[dateKey][normalizedBay]) {
                        importedSchedule[dateKey][normalizedBay] = [];
                    }

                    importedSchedule[dateKey][normalizedBay].push({
                        id: `item-${dateKey}-${normalizedBay}-${product.id}-${Math.random()}`,
                        productId: product.id,
                        batches: String(Batches),
                    });
                });
                
                mergeSchedule(importedSchedule, importedNotes);
                toast({ title: "Import Successful", description: "Calendar data has been imported and merged." });
                handleImportOpenChange(false);
            } catch (error) {
                console.error("Import error:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: "Could not parse the imported file. Please check the format." });
            } finally {
                if (importFileInputRef.current) importFileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportOpenChange = (open: boolean) => {
        setIsImportDialogOpen(open);
        if (!open) {
            setPassword('');
            setPasswordError('');
            setIsAuthenticated(false);
        }
    };
    
    const handleClearOpenChange = (open: boolean) => {
        setIsClearDialogOpen(open);
        if (!open) {
            setClearPassword('');
            setClearPasswordError('');
            setIsClearAuthenticated(false);
        }
    };
    
    const handleClearPasswordSubmit = () => {
        if (clearPassword === '310101') {
            setIsClearAuthenticated(true);
            clearSchedule();
            toast({ title: "Schedule Cleared", description: "All calendar data has been removed." });
            handleClearOpenChange(false);
        } else {
            setClearPasswordError('Incorrect password.');
        }
    };


    const exportData = useCallback(() => {
        const allDates = new Set([...Object.keys(schedule), ...Object.keys(calendarNotes)]);
        const sortedDates = Array.from(allDates).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        const dataToExport = sortedDates.flatMap(dateKey => {
            const daySchedule = schedule[dateKey] || {};
            const noteData = calendarNotes[dateKey] || {};
            const note = noteData.note || '';
            const timeLeft = noteData.timeLeftBuilding || '';
            
            // FTE Calculations
            const todaysHours = confirmedHours[dateKey];
            let totalHours = 0;
            if (todaysHours) {
              Object.values(todaysHours).forEach((ranges: string[]) => {
                ranges.forEach(range => {
                  const [start, end] = range.split('-');
                  totalHours += calculateHours(start, end);
                });
              });
            }
            const scheduledFTE = totalHours > 0 ? (totalHours / 8.5).toFixed(2) : '0.00';
            
            let totalFTERequired = 0;
            if(daySchedule) {
                Object.values(daySchedule).flat().forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                        const ftesPriced = parseFloat(product.ftesPricedFor1BayDay || '0');
                        const batchesToday = parseFloat(item.batches);
                        if (batchesPriced > 0) {
                            totalFTERequired += (batchesToday / batchesPriced) * ftesPriced;
                        }
                    }
                });
            }


            const scheduledItems = Object.entries(daySchedule).flatMap(([bay, items]) => 
                items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    return {
                        Date: format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'P'),
                        Bay: bay,
                        'Co-Packer': product?.coPacker || 'N/A',
                        Product: product?.name || 'N/A',
                        Batches: item.batches,
                        Note: '',
                        "Scheduled FTE Employees": '',
                        "Total FTEs required": '',
                        "Time Left Building": '',
                    };
                })
            );

            if (scheduledItems.length > 0) {
                 scheduledItems[0].Note = note;
                 scheduledItems[0]["Scheduled FTE Employees"] = scheduledFTE;
                 scheduledItems[0]["Total FTEs required"] = totalFTERequired.toFixed(2);
                 scheduledItems[0]["Time Left Building"] = timeLeft;
                 return scheduledItems;
            } else if (note || timeLeft || scheduledFTE !== '0.00' || totalFTERequired > 0) {
                 return [{
                    Date: format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'P'),
                    Bay: '', 'Co-Packer': '', Product: '', Batches: '', 
                    Note: note,
                    "Scheduled FTE Employees": scheduledFTE,
                    "Total FTEs required": totalFTERequired.toFixed(2),
                    "Time Left Building": timeLeft
                 }];
            }
            return [];
        });


        if (dataToExport.length === 0) {
            toast({ variant: 'destructive', title: 'No Data to Export', description: 'There is no schedule data to export.' });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: ['Date', 'Bay', 'Co-Packer', 'Product', 'Batches', 'Note', 'Scheduled FTE Employees', 'Total FTEs required', 'Time Left Building']});
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Production Schedule');
        
        const today = format(new Date(), 'yyyy-MM-dd');
        XLSX.writeFile(workbook, `Made4U Calendar Data as of ${today}.xlsx`);

        toast({ title: 'Export Successful', description: 'Calendar data has been downloaded.' });
    }, [schedule, products, calendarNotes, confirmedHours, users, toast]);

    return (
        <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
            <CardHeader>
                <CardTitle>Import/Export Calendar Data</CardTitle>
                <CardDescription>Download the current schedule or import a new one, which will merge with existing data.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
                 <Dialog open={isImportDialogOpen} onOpenChange={handleImportOpenChange}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Import from CSV
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Import New Schedule</DialogTitle>
                            <DialogDescription>
                               This action will merge with the current schedule. Existing data on imported days will be overwritten.
                            </DialogDescription>
                        </DialogHeader>
                        {!isAuthenticated ? (
                            <div className="space-y-4">
                               <p className="text-sm text-muted-foreground">Please enter the password to proceed.</p>
                                <Input 
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                />
                                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                                <Button onClick={handlePasswordSubmit}>Authenticate</Button>
                            </div>
                        ) : (
                             <div className="space-y-4">
                                <p className="text-sm text-green-600 font-medium">Authenticated. You can now import the file.</p>
                                <p className="text-sm text-muted-foreground">The CSV file must have columns: Date, Bay, Product, Batches, Note, etc.</p>
                                <input type="file" ref={importFileInputRef} onChange={handleImportFileChange} accept=".csv,.xlsx" className="hidden" />
                                <Button onClick={handleFileImportClick} className="w-full">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Select Import File
                                </Button>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
                <Button onClick={exportData}>
                    <DownloadCloud className="mr-2 h-4 w-4" />
                    Export Now
                </Button>
                <Dialog open={isClearDialogOpen} onOpenChange={handleClearOpenChange}>
                    <DialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove All
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Remove All Calendar Data</DialogTitle>
                            <DialogDescription>
                               This is a destructive action and cannot be undone. Please enter the admin PIN to confirm.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                           <p className="text-sm text-muted-foreground">Please enter the PIN to proceed.</p>
                            <Input 
                                type="password"
                                placeholder="PIN"
                                value={clearPassword}
                                onChange={(e) => setClearPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleClearPasswordSubmit()}
                            />
                            {clearPasswordError && <p className="text-sm text-destructive">{clearPasswordError}</p>}
                            <Button onClick={handleClearPasswordSubmit}>Confirm & Remove All</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function DraggableItem({ scheduleItem, dateKey, onChangeBay, onRemoveItem, onMoveItemToDate, onDuplicateItem, onUpdateItem, isDragging, showCoPacker, isSelectMode, isSelected, onToggleSelect, schedule = {}, products = [] }: { 
    scheduleItem: { bay: Bay; item: ProductionItem; product: Product }, 
    dateKey: string, 
    onChangeBay: (dateKey: string, oldBay: Bay, newBay: Bay, item: ProductionItem) => void,
    onRemoveItem: (date: Date, bay: Bay, itemId: string) => void,
    onMoveItemToDate: (oldDateKey: string, newDate: Date, bay: Bay, item: ProductionItem) => void;
    onDuplicateItem: (item: ProductionItem, bay: Bay, dates: Date[]) => void;
    onUpdateItem: (date: Date, bay: Bay, itemId: string, updatedItem: Partial<ProductionItem>) => void;
    isDragging: boolean;
    showCoPacker: boolean;
    isSelectMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    schedule?: ProductionSchedule;
    products?: Product[];
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: scheduleItem.item.id,
        data: { ...scheduleItem, dateKey }
    });
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const { toast } = useToast();

    const style: React.CSSProperties = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        visibility: isDragging ? 'hidden' : 'visible',
    } : {
        visibility: isDragging ? 'hidden' : 'visible',
    };
    
    const handleDuplicate = (dates: Date[]) => {
        if (dates && dates.length > 0) {
            onDuplicateItem(scheduleItem.item, scheduleItem.bay, dates);
            setIsCalendarOpen(false);
            setIsMenuOpen(false);
            setSelectedDates([]);
        } else {
            toast({
                variant: 'destructive',
                title: 'No dates selected',
                description: 'Please select at least one date to duplicate the product to.'
            });
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "flex items-center gap-1 rounded-sm relative group w-full",
                BAY_COLORS[scheduleItem.bay].base,
                BAY_COLORS[scheduleItem.bay].text,
                isSelected && "ring-2 ring-emerald-400 font-bold bg-emerald-950/40"
            )}
            onClick={isSelectMode ? (e) => { e.stopPropagation(); onToggleSelect?.(); } : undefined}
        >
            <button {...listeners} {...attributes} className="p-1 cursor-grab shrink-0">
                <GripVertical className="h-4 w-4" />
            </button>

            <div className="p-0.5 font-medium text-xs w-full flex flex-col justify-start items-stretch">
                {showCoPacker && (
                    <div className='flex items-center justify-between -m-px w-full pb-0.5'>
                        <span
                            className={cn("truncate px-1 py-0.5 rounded-sm text-[10px] font-bold", isColorLight(scheduleItem.product.coPackerColor) ? "text-black" : "text-white")}
                            style={{ backgroundColor: scheduleItem.product.coPackerColor }}
                        >
                            {scheduleItem.product.coPacker}
                        </span>
                        {isSelectMode && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onToggleSelect?.();
                                }}
                                className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 ml-1 transition-all cursor-pointer",
                                    isSelected 
                                      ? "bg-black border-black text-white" 
                                      : "bg-zinc-950 border-zinc-600 hover:border-black"
                                )}
                            >
                                {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                            </button>
                        )}
                    </div>
                )}

                {!showCoPacker && isSelectMode && (
                    <div className="flex justify-end w-full px-1 pt-0.5 pb-0.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleSelect?.();
                            }}
                            className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer",
                                isSelected 
                                  ? "bg-black border-black text-white" 
                                  : "bg-zinc-950 border-zinc-600 hover:border-black"
                            )}
                        >
                            {isSelected && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                        </button>
                    </div>
                )}

                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <div 
                            onDoubleClick={() => setIsMenuOpen(true)} 
                            className="flex items-center gap-1.5 text-left px-1 py-0.5 cursor-pointer hover:opacity-90"
                        >
                            <span>{scheduleItem.item.batches}</span>
                            -
                            <span className="truncate">{scheduleItem.product.name}</span>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onMouseLeave={() => isCalendarOpen && setIsMenuOpen(true)} onMouseUp={() => isCalendarOpen && setIsMenuOpen(true)}>
                        <div className="p-2 space-y-1">
                            <Label htmlFor="batches-input" className="text-xs font-medium">Batches</Label>
                            <Input
                                id="batches-input"
                                type="text"
                                value={scheduleItem.item.batches}
                                onChange={(e) => onUpdateItem(parse(dateKey, 'yyyy-MM-dd', new Date()), scheduleItem.bay, scheduleItem.item.id, { batches: e.target.value })}
                                className="h-8 w-full"
                            />
                        </div>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    "w-[240px] justify-start text-left font-normal mx-2 mt-2 mb-2",
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  <span>Duplicate to...</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 ml-2 border-0 bg-transparent shadow-none" align="start">
                                <MiniLiveProductionCalendar
                                    schedule={schedule}
                                    products={products}
                                    selectedDates={selectedDates}
                                    onSelectDates={setSelectedDates}
                                    onConfirmDuplication={handleDuplicate}
                                    previewItemsCount={1}
                                    onClose={() => setIsCalendarOpen(false)}
                                />
                            </PopoverContent>
                        </Popover>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Change Bay</DropdownMenuLabel>
                        <DropdownMenuRadioGroup 
                            value={scheduleItem.bay} 
                            onValueChange={(newBay) => onChangeBay(dateKey, scheduleItem.bay, newBay as Bay, scheduleItem.item)}
                        >
                            {BAYS.map(bay => (
                                <DropdownMenuRadioItem key={bay} value={bay}>{bay} Bay</DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => onRemoveItem(parse(dateKey, 'yyyy-MM-dd', new Date()), scheduleItem.bay, scheduleItem.item.id)}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function DroppableDayCell({ day, dateKey, products, schedule, prepSteps, calendarNotes, setCalendarNote, machinery, confirmedHours, users, coPackers, activeDragItem, onChangeBay, onRemoveItem, onMoveItemToDate, onDuplicateItem, onUpdateItem, updateSchedule, isSelectMode, selectedItemKeys = [], onToggleSelectItem, ...props }: { 
    day: Date;
    dateKey: string;
    products: Product[];
    schedule: any;
    prepSteps: PrepStep[];
    calendarNotes: any;
    setCalendarNote: (dateKey: string, note?: string, timeLeftBuilding?: string) => void;
    machinery: Machine[];
    confirmedHours: any;
    users: User[];
    onAddItem: (date: Date, bay: Bay) => void;
    onUpdateItem: (date: Date, bay: Bay, itemId: string, updatedItem: Partial<ProductionItem>) => void;
    onRemoveItem: (date: Date, bay: Bay, itemId: string) => void;
    onRemoveAll: (date: Date, bay: Bay) => void;
    onChangeBay: (dateKey: string, oldBay: Bay, newBay: Bay, item: ProductionItem) => void;
    onMoveItemToDate: (oldDateKey: string, newDate: Date, bay: Bay, item: ProductionItem) => void;
    onDuplicateItem: (item: ProductionItem, bay: Bay, dates: Date[]) => void;
    coPackers: string[];
    activeDragItem: DraggableItemData | null;
    updateSchedule: (dateKey: string, bay: Bay, items: ProductionItem[], oldDateKey?: string, oldBay?: Bay) => void;
    isSelectMode?: boolean;
    selectedItemKeys?: string[];
    onToggleSelectItem?: (itemKey: string) => void;
}) {
    const { isOver, setNodeRef } = useDroppable({
        id: dateKey,
    });
    const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;
    const daySchedule = schedule[dateKey] || {};
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogDate, setDialogDate] = useState(day);
    const note = calendarNotes[dateKey]?.note;

    const bayItems = useMemo(() => {
        const itemsByBay: { [key in Bay]?: { item: ProductionItem, product: Product }[] } = {};
        for (const bay of BAYS) {
            const items = (daySchedule[bay] || []).map((item: ProductionItem) => {
                const product = products.find(p => p.id === item.productId);
                return product ? { bay, item, product } : null;
            }).filter((i: any): i is { bay: Bay; item: ProductionItem; product: Product } => !!i);

            if (items.length > 0) {
                 itemsByBay[bay] = items;
            }
        }
        return itemsByBay;
    }, [daySchedule, products]);
    
    const dailyBayDays = useMemo(() => {
        let dayBayDays = 0;
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach((item: any) => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                    const batchesToday = parseFloat(item.batches);
                    if (batchesPriced > 0) {
                        dayBayDays += (batchesToday / batchesPriced);
                    }
                }
            });
        }
        return dayBayDays;
    }, [daySchedule, products]);


    const allItems = Object.values(bayItems).flat() as { bay: Bay; item: ProductionItem; product: Product }[];

    const requiredPrepSteps = useMemo(() => {
        return prepSteps.flatMap(step => {
            const productionDate = addDays(day, step.daysInAdvance || 0);
            const productionDateKey = format(productionDate, 'yyyy-MM-dd');

            const productIdsOnProductionDay = schedule[productionDateKey]
                ? Object.values(schedule[productionDateKey]).flat().map((item: any) => item.productId)
                : [];
            
            if (productIdsOnProductionDay.length === 0) return [];

            const applicableProducts = products.filter(p => 
                productIdsOnProductionDay.includes(p.id) && (step.productIds || []).includes(p.id)
            );

            if (applicableProducts.length > 0) {
                const coPackers = [...new Set(applicableProducts.map(p => p.coPacker))];
                return coPackers.map(coPacker => ({
                    name: `${step.name}`,
                    coPacker: coPacker,
                }));
            }
            return [];
        }).filter((item, index, self) => 
            index === self.findIndex((t) => t.name === item.name && t.coPacker === item.coPacker)
        );
    }, [day, prepSteps, schedule, products]);

    const conflictingMachines = useMemo(() => {
        const usage: { [machineId: string]: Set<Bay> } = {};
        
        allItems.forEach(({ bay, product }) => {
            if (!product) return;
            (product.machineryIds || []).forEach(machineId => {
                if (!usage[machineId]) {
                    usage[machineId] = new Set();
                }
                usage[machineId].add(bay);
            });
        });
        
        return Object.entries(usage).map(([machineId, bays]) => {
            const machineInfo = machinery.find(m => m.id === machineId);
            if (machineInfo && bays.size > machineInfo.quantity) {
                return machineInfo.name;
            }
            return null;
        }).filter((name): name is string => name !== null);
    }, [allItems, machinery]);
    
    return (
        <TableCell
            ref={setNodeRef}
            className={cn(
                "relative p-2 align-top h-32 border-r-2 border-b-2 border-zinc-800",
                "transition-colors duration-200",
                isOver ? "bg-accent" : "bg-zinc-950/90 dark:bg-zinc-950",
                isToday ? "bg-emerald-950/80 dark:bg-emerald-950 border border-emerald-600 text-white" : ""
            )}
        >
            <div className={cn("flex justify-between items-start")}>
                <div className={cn("text-sm font-medium", isToday ? "text-white font-bold" : "text-foreground")}>
                    {format(day, 'd')}
                </div>
                 <div className="flex items-center -mr-2 -mt-1">
                    {dailyBayDays > 0 && (
                        <Badge variant="secondary" className={cn("text-xs h-5 mr-1", isToday ? "bg-white/20 text-white border-none" : "bg-muted text-muted-foreground")}>
                           {dailyBayDays.toFixed(2)}
                        </Badge>
                    )}
                    <FteDialog dateKey={dateKey} daySchedule={daySchedule} products={products} confirmedHours={confirmedHours} users={users} calendarNotes={calendarNotes} setCalendarNote={setCalendarNote} isToday={isToday} />
                    <NoteDialog dateKey={dateKey} note={calendarNotes[dateKey]?.note} setCalendarNote={setCalendarNote} isToday={isToday} />
                    <DayScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} day={dialogDate} onDayChange={setDialogDate} schedule={schedule} updateSchedule={updateSchedule} products={products} coPackers={coPackers} onAddItem={props.onAddItem} onUpdateItem={onUpdateItem} onRemoveItem={onRemoveItem} onRemoveAll={props.onRemoveAll}>
                        <Button variant="ghost" size="icon" className={cn("h-6 w-6", isToday ? "text-white/80 hover:text-white" : "text-muted-foreground")}>
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </DayScheduleDialog>
                 </div>
            </div>
            {conflictingMachines.length > 0 && (
                <div className="text-destructive font-bold text-xs mt-1">
                    Alert: {conflictingMachines.join(', ')}
                </div>
            )}
            <div className="mt-1 text-xs text-left space-y-0.5">
                 {note && (
                    <div className="mb-1 p-1 rounded-sm bg-zinc-800 text-zinc-100 border border-zinc-700 text-xs font-medium flex items-start gap-1">
                        <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                        <p className="line-clamp-2">{note}</p>
                    </div>
                )}
                {requiredPrepSteps.length > 0 && (
                    <div className="p-1 rounded-sm bg-emerald-950 text-emerald-100 border border-emerald-800/60 text-xs font-medium flex items-start gap-1 mb-1">
                       <Package className="h-3 w-3 mt-0.5 shrink-0" />
                        <div className="flex flex-col">
                            {requiredPrepSteps.map((step, i) => (
                                <p key={i} className="line-clamp-2">{step.name}</p>
                            ))}
                        </div>
                    </div>
                 )}
                {Object.entries(bayItems).map(([bay, items]) => {
                    const coPackerGroups = items.reduce((acc, item) => {
                        const coPacker = item.product?.coPacker || 'Standard';
                        if (!acc[coPacker]) {
                            acc[coPacker] = [];
                        }
                        acc[coPacker].push(item);
                        return acc;
                    }, {} as Record<string, typeof items>);

                    return Object.entries(coPackerGroups).map(([coPacker, groupItems]) => 
                        groupItems.map((scheduleItem, index) => {
                            if (!scheduleItem.product) return null;
                            const itemKey = `${dateKey}|${bay}|${scheduleItem.item.id}`;
                            const isSelected = selectedItemKeys.includes(itemKey);
                            return (
                                <DraggableItem 
                                    key={scheduleItem.item.id} 
                                    scheduleItem={{ ...scheduleItem, bay: bay as Bay }} 
                                    dateKey={dateKey} 
                                    onChangeBay={onChangeBay} 
                                    onRemoveItem={onRemoveItem} 
                                    onMoveItemToDate={onMoveItemToDate} 
                                    onDuplicateItem={onDuplicateItem}
                                    onUpdateItem={onUpdateItem}
                                    isDragging={activeDragItem?.item.id === scheduleItem.item.id}
                                    showCoPacker={index === 0}
                                    isSelectMode={isSelectMode}
                                    isSelected={isSelected}
                                    onToggleSelect={() => onToggleSelectItem && onToggleSelectItem(itemKey)}
                                    schedule={schedule}
                                    products={products}
                                />
                            );
                        })
                    );
                })}
            </div>
        </TableCell>
    );
}

function DayScheduleDialog({ day, onDayChange, children, products, schedule, coPackers, updateSchedule, onAddItem, onUpdateItem, onRemoveItem, onRemoveAll, ...props }: {
    day: Date;
    onDayChange: (newDate: Date) => void;
    children: React.ReactNode;
    products: Product[];
    schedule: any;
    coPackers: string[];
    updateSchedule: (dateKey: string, bay: Bay, items: ProductionItem[], oldDateKey?: string, oldBay?: Bay) => void;
    onAddItem: (date: Date, bay: Bay) => void;
    onUpdateItem: (date: Date, bay: Bay, itemId: string, updatedItem: Partial<ProductionItem>) => void;
    onRemoveItem: (date: Date, bay: Bay, itemId: string) => void;
    onRemoveAll: (date: Date, bay: Bay) => void;
} & React.ComponentProps<typeof Dialog>) {
    const dateKey = format(day, 'yyyy-MM-dd');
    const [localSchedule, setLocalSchedule] = useState(schedule[dateKey] || {});

    useEffect(() => {
        setLocalSchedule(schedule[dateKey] || {});
    }, [schedule, dateKey]);

    const handlePrevDay = () => onDayChange(addDays(day, -1));
    const handleNextDay = () => onDayChange(addDays(day, 1));
    
    const handleDragEnd = (event: DragEndEvent, bay: Bay) => {
        const { active, over } = event;
        const bayItems = localSchedule[bay] || [];
        
        if (over && active.id !== over.id) {
            const oldIndex = bayItems.findIndex((item: ProductionItem) => item.id === active.id);
            const newIndex = bayItems.findIndex((item: ProductionItem) => item.id === over.id);

            if (oldIndex > -1 && newIndex > -1) {
                const newOrderedItems = arrayMove(bayItems as ProductionItem[], oldIndex, newIndex);
                handleLocalUpdate(bay, newOrderedItems);
            }
        }
    };
    
    const handleLocalUpdate = (bay: Bay, newItems: ProductionItem[]) => {
        const newLocal = {...localSchedule, [bay]: newItems};
        setLocalSchedule(newLocal);
        updateSchedule(dateKey, bay, newItems);
    };

    const handleLocalAddItem = (bay: Bay) => {
        const newItem = { id: `item-${dateKey}-${bay}-${Date.now()}`, productId: '', batches: '1' };
        const newItems = [...(localSchedule[bay] || []), newItem];
        handleLocalUpdate(bay, newItems);
    };

    const handleLocalUpdateItem = (bay: Bay, itemId: string, updatedItem: Partial<ProductionItem>) => {
        const newItems = (localSchedule[bay] || []).map((item: ProductionItem) => 
            item.id === itemId ? { ...item, ...updatedItem } : item
        );
        handleLocalUpdate(bay, newItems);
    };

    const handleLocalRemoveItem = (bay: Bay, itemId: string) => {
        const newItems = (localSchedule[bay] || []).filter((item: ProductionItem) => item.id !== itemId);
        handleLocalUpdate(bay, newItems);
    };

    const handleLocalRemoveAll = (bay: Bay) => {
        handleLocalUpdate(bay, []);
    };
    
    return (
        <Dialog {...props}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <div className="flex justify-center items-center relative px-12">
                        <Button variant="ghost" size="icon" onClick={handlePrevDay} className="absolute left-0"><ChevronLeft /></Button>
                        <div className="text-center">
                            <DialogTitle>Edit Schedule for {format(day, 'PPPP')}</DialogTitle>
                            <DialogDescription>
                                Make changes to the production schedule for this day.
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNextDay} className="absolute right-0"><ChevronRight /></Button>
                    </div>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
                    {BAYS.map(bay => {
                        const bayItems = localSchedule[bay] || [];
                        const hasData = bayItems.length > 0;
                        return (
                            <div key={bay} className={cn("border rounded-lg p-3 space-y-2", hasData ? `${BAY_COLORS[bay].base} ${BAY_COLORS[bay].text}` : 'bg-card')}>
                              <div className="flex justify-between items-center mb-1">
                                <div className='font-bold text-sm'>{bay} Bay</div>
                                {hasData && (
                                  <Button variant="ghost" size="sm" className={cn("h-6 px-1 text-xs", hasData ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-destructive/70 hover:text-destructive')} onClick={() => handleLocalRemoveAll(bay)}>
                                    Remove All
                                  </Button>
                                )}
                              </div>
                                <DndContext collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, bay)}>
                                  <SortableContext items={bayItems.map((i: ProductionItem) => i.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-1">
                                      {bayItems.map((item: ProductionItem) => (
                                          <SortableCalendarItem
                                              key={item.id}
                                              item={item}
                                              products={products}
                                              coPackers={coPackers}
                                              onUpdate={(updatedItem) => handleLocalUpdateItem(bay, item.id, updatedItem)}
                                              onRemove={() => handleLocalRemoveItem(bay, item.id)}
                                              hasData={hasData}
                                          />
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                                <Button variant="outline" size="sm" className={cn("w-full h-7 mt-1 text-xs", hasData ? 'bg-white/90 text-black hover:bg-white' : '')} onClick={() => handleLocalAddItem(bay)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function SortableCalendarItem(props: React.ComponentProps<typeof CalendarItem>) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.item.id });
    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <CalendarItem {...props} attributes={attributes} listeners={listeners} />
        </div>
    );
}


function CalendarItem({
    item,
    products,
    coPackers,
    onUpdate,
    onRemove,
    hasData,
    attributes,
    listeners
}: {
    item: ProductionItem,
    products: Product[],
    coPackers: string[],
    onUpdate: (updatedItem: Partial<ProductionItem>) => void,
    onRemove: () => void,
    hasData: boolean,
    attributes?: any,
    listeners?: any,
}) {
    const selectedProduct = products.find(p => p.id === item.productId);
    const [selectedCoPacker, setSelectedCoPacker] = useState(selectedProduct?.coPacker || '');
    const [open, setOpen] = useState(false);
    
    useEffect(() => {
        if (selectedProduct) {
            setSelectedCoPacker(selectedProduct.coPacker);
        }
    }, [selectedProduct]);

    const filteredProducts = useMemo(() => {
        if (!selectedCoPacker) return [];
        return products.filter(p => p.coPacker === selectedCoPacker);
    }, [selectedCoPacker, products]);

    const handleCoPackerChange = (coPacker: string) => {
        setSelectedCoPacker(coPacker);
        onUpdate({ productId: '' });
    };
    
    const handleProductChange = (productName: string) => {
        const product = filteredProducts.find(p => p.name === productName);
        if (product) {
            onUpdate({ productId: product.id });
        }
        setOpen(false);
    };
    
    const inputStyles = hasData 
        ? "bg-white/90 text-black placeholder:text-gray-500 border-transparent focus:bg-white"
        : "";

    return (
        <div className={cn("flex gap-1 items-center p-2 rounded-md", hasData ? 'bg-black/10' : 'bg-muted/50' )}>
            <button {...attributes} {...listeners} className="p-1 cursor-grab">
                <GripVertical className="h-5 w-5" />
            </button>
            <Select value={selectedCoPacker} onValueChange={handleCoPackerChange}>
                <SelectTrigger className={cn("h-8 text-xs flex-grow-[2] w-24", inputStyles)}>
                    <SelectValue placeholder="Co-Packer" />
                </SelectTrigger>
                <SelectContent>
                    {coPackers.map((cp) => (
                        <SelectItem key={cp} value={cp}>{cp}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

             <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("h-8 text-xs flex-grow-[3] w-32 justify-between", inputStyles)}
                        disabled={!selectedCoPacker}
                    >
                        {item.productId ? filteredProducts.find(p => p.id === item.productId)?.name : "Select product..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search product..." />
                        <CommandList>
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                                {filteredProducts.map((p) => (
                                    <CommandItem
                                        key={p.id}
                                        value={p.name}
                                        onSelect={(currentValue) => {
                                            handleProductChange(currentValue);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", item.productId === p.id ? "opacity-100" : "opacity-0")} />
                                        {p.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Input type="text" value={item.batches} onChange={(e) => onUpdate({ batches: e.target.value })} className={cn("h-8 w-14 text-xs", inputStyles)} />
            <Button variant="ghost" size="icon" className={cn("h-8 w-8", hasData ? 'text-white/70 hover:text-white' : 'text-destructive/70 hover:text-destructive')} onClick={onRemove}><X className="h-4 w-4" /></Button>
        </div>
    );
}

function FteDialog({ dateKey, daySchedule, products, confirmedHours, users, calendarNotes, setCalendarNote, isToday }: { dateKey: string, daySchedule: DayProduction, products: Product[], confirmedHours: any, users: User[], calendarNotes: any, setCalendarNote: (dateKey: string, note?: string, timeLeftBuilding?: string) => void, isToday: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [localTimeLeft, setLocalTimeLeft] = useState(calendarNotes[dateKey]?.timeLeftBuilding || '');

    useEffect(() => {
        if(isOpen) {
            const savedTime = calendarNotes[dateKey]?.timeLeftBuilding || '';
            setLocalTimeLeft(savedTime);
            setIsEditingTime(!savedTime);
        }
    }, [calendarNotes, dateKey, isOpen]);
    
    const { totalFTE, totalFTERequired, totalDayBayDays } = useMemo(() => {
        const todaysHours = confirmedHours[dateKey];
        let totalHours = 0;
        if (todaysHours) {
          const workingUserIds = Object.keys(todaysHours).filter(userId => todaysHours[userId]?.length > 0);
          const workingUsers = users.filter(user => workingUserIds.includes(user.id) && !user.name.toLowerCase().includes('lehn'));
          
          workingUsers.forEach(user => {
            const hoursRanges = todaysHours[user.id] || [];
            const userTotalHours = hoursRanges.reduce((acc: number, range: string) => {
              const [start, end] = range.split('-');
              if (!start || !end) return acc;
              return acc + calculateHours(start, end);
            }, 0);
            totalHours += userTotalHours;
          });
        }
        const scheduledFTE = totalHours > 0 ? (totalHours / 8.5) : 0;
        
        let requiredFTE = 0;
        let dayBayDays = 0;
        if (daySchedule) {
            Object.values(daySchedule).flat().forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const batchesPriced = parseFloat(product.batchesPricedFor1BayDay || '0');
                    const ftesPriced = parseFloat(product.ftesPricedFor1BayDay || '0');
                    const batchesToday = parseFloat(item.batches);
                    if (batchesPriced > 0) {
                        const bayDayFactor = batchesToday / batchesPriced;
                        requiredFTE += bayDayFactor * ftesPriced;
                        dayBayDays += bayDayFactor;
                    }
                }
            });
        }

        return { totalFTE: scheduledFTE, totalFTERequired: requiredFTE, totalDayBayDays: dayBayDays };
    }, [dateKey, confirmedHours, users, daySchedule, products]);

    const handleSave = () => {
        setCalendarNote(dateKey, calendarNotes[dateKey]?.note, localTimeLeft);
        setIsEditingTime(false);
        if (!localTimeLeft) {
            setIsOpen(false);
        }
    };
    
    const handleDeleteTime = () => {
        setLocalTimeLeft('');
        setCalendarNote(dateKey, calendarNotes[dateKey]?.note, '');
        setIsEditingTime(true);
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-6 w-6", isToday ? "text-white/80 hover:text-white" : "text-muted-foreground")}>
                    <Clock className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>FTE & Time for {format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'PPPP')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <p className="font-semibold">Scheduled FTE Employees-Excluding Lehn Family</p>
                        <p className="text-2xl">{totalFTE.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="font-semibold">Total FTEs Required</p>
                        <p className="text-2xl">{totalFTERequired.toFixed(2)}</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="time-left-building">Time Left Building</Label>
                        {isEditingTime ? (
                            <div className="flex items-center gap-2">
                                <Input 
                                    id="time-left-building"
                                    value={localTimeLeft}
                                    onChange={(e) => setLocalTimeLeft(e.target.value)}
                                    placeholder="e.g., 4:30 PM"
                                />
                                <Button onClick={handleSave}>Save</Button>
                                {calendarNotes[dateKey]?.timeLeftBuilding && (
                                    <Button variant="ghost" onClick={() => setIsEditingTime(false)}>Cancel</Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <p className="font-medium text-lg">{localTimeLeft}</p>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setIsEditingTime(true)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={handleDeleteTime}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="font-semibold"># Bay Days</p>
                        <p className="text-2xl">{totalDayBayDays.toFixed(2)}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NoteDialog({ dateKey, note, setCalendarNote, isToday }: { dateKey: string, note?: string, setCalendarNote: (dateKey: string, note?: string, timeLeftBuilding?: string) => void, isToday: boolean }) {
    const [localNote, setLocalNote] = useState(note || '');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setLocalNote(note || '');
    }, [note, isOpen]);

    const handleSave = () => {
        setCalendarNote(dateKey, localNote);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-6 w-6 relative", isToday ? "text-white/80 hover:text-white" : "text-muted-foreground")}>
                    <Notebook className="h-4 w-4" />
                    {note && <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-primary" />}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Note for {format(parse(dateKey, 'yyyy-MM-dd', new Date()), 'PPPP')}</DialogTitle>
                    <DialogDescription>Add or edit a note for this day. This note will be visible on the View Calendar page.</DialogDescription>
                </DialogHeader>
                <Textarea 
                    value={localNote}
                    onChange={(e) => setLocalNote(e.target.value)}
                    placeholder="Enter your note here..."
                    rows={6}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Note</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField.trim());
    return result;
}


function ProductList({ items, machinery, onSave, onDelete, onDeleteAll }: { items: Product[], machinery: Machine[], onSave: (item: Product, syncColor?: boolean) => void, onDelete: (id: string) => void, onDeleteAll: () => void }) {
    const [newItem, setNewItem] = useState<Omit<Product, 'id'>>({ name: '', coPacker: '', coPackerColor: '#a7f3d0', allergens: '', targetDepositWeight: '', targetFinishedWeight: '', batchSizeLbs: '', yieldPerBatch: '', machineryIds: [], batchesPricedFor1BayDay: '', ftesPricedFor1BayDay: '' });
    const [editingItem, setEditingItem] = useState<Product | null>(null);
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const sopFileInputRefs = React.useRef<{[key: string]: HTMLInputElement | null}>({});
    const [searchQuery, setSearchQuery] = useState('');

    const sortedItems = useMemo(() => {
        if (!searchQuery) {
            return items;
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        
        const matchingItems = items.filter(item => 
            item.name.toLowerCase().includes(lowercasedQuery) ||
            item.coPacker.toLowerCase().includes(lowercasedQuery)
        );
        const otherItems = items.filter(item => 
            !item.name.toLowerCase().includes(lowercasedQuery) &&
            !item.coPacker.toLowerCase().includes(lowercasedQuery)
        );

        return [...matchingItems, ...otherItems];
    }, [items, searchQuery]);

    const handleAddNew = () => {
        if (newItem.name.trim() === '') return;
        onSave({ ...newItem, id: `item-${Date.now()}` }, true);
        setNewItem({ name: '', coPacker: '', coPackerColor: '#a7f3d0', allergens: '', targetDepositWeight: '', targetFinishedWeight: '', batchSizeLbs: '', yieldPerBatch: '', machineryIds: [], batchesPricedFor1BayDay: '', ftesPricedFor1BayDay: '' });
    }

    const handleStartEdit = (item: Product) => {
        setEditingItem({ ...item });
    }

    const handleSaveEdit = () => {
        if (editingItem) {
            onSave(editingItem, true);
            setEditingItem(null);
        }
    }
    
    const handleCoPackerChange = (coPacker: string, itemStateSetter: any) => {
        const existingCoPacker = items.find(p => p.coPacker.toLowerCase() === coPacker.toLowerCase());
        itemStateSetter((prev: any) => ({
            ...prev,
            coPacker: coPacker,
            coPackerColor: existingCoPacker?.coPackerColor || prev.coPackerColor,
        }));
    }
    
    const handleMachinerySelect = (product: Product, machineId: string, itemStateSetter: any) => {
        const currentMachinery = product.machineryIds || [];
        const isSelected = currentMachinery.includes(machineId);
        const newMachinery = isSelected
            ? currentMachinery.filter(id => id !== machineId)
            : [...currentMachinery, machineId];
        itemStateSetter({...product, machineryIds: newMachinery });
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = parseCsvLine(lines[0]);
            
            const getIndex = (key: string) => headers.findIndex(h => h.toLowerCase().trim().includes(key));

            const nameIndex = getIndex('product name');
            const coPackerIndex = getIndex('co-packer');
            const allergensIndex = getIndex('allergens');
            const depositWeightIndex = getIndex('target deposit weight');
            const finishedWeightIndex = getIndex('target finished weight');
            const batchSizeIndex = getIndex('batch size (lb)');
            const yieldIndex = getIndex('yield per batch');
            const machineryIndex = getIndex('machinery');
            const sopIndex = getIndex('sop link');
            const colorIndex = getIndex('color code');
            const batchesPricedIndex = getIndex('# batches priced for 1 bay day');
            const ftesPricedIndex = getIndex('ftes priced for 1 bay day');


            const productsToSave = lines.slice(1).map(line => {
                const row = parseCsvLine(line);
                const name = row[nameIndex];
                const coPacker = row[coPackerIndex];

                if(coPacker && name) {
                    const productData: Partial<Product> = { 
                        name, 
                        coPacker, 
                        allergens: row[allergensIndex] || '',
                        targetDepositWeight: row[depositWeightIndex] || '',
                        targetFinishedWeight: row[finishedWeightIndex] || '',
                        batchSizeLbs: row[batchSizeIndex] || '',
                        yieldPerBatch: row[yieldIndex] || '',
                        coPackerColor: row[colorIndex] || '#a7f3d0',
                        batchesPricedFor1BayDay: row[batchesPricedIndex] || '',
                        ftesPricedFor1BayDay: row[ftesPricedIndex] || '',
                    };

                    const machineryNamesStr = row[machineryIndex] || '';
                    productData.machineryIds = machineryNamesStr
                        ? machineryNamesStr.split(',').map(name => name.trim()).map(machineName => {
                              const machine = machinery.find(m => m.name === machineName);
                              return machine ? machine.id : null;
                          }).filter((id): id is string => id !== null)
                        : [];

                    const sopFile = row[sopIndex] || '';
                    if (sopFile && sopFile.trim()) {
                        productData.sopFile = sopFile.trim();
                        productData.sopFileName = sopFile.substring(sopFile.lastIndexOf('/') + 1) || "SOP Document";
                    }

                    return { 
                        id: `item-${Date.now()}-${Math.random()}`, 
                        ...productData
                    };
                }
                return null;
            }).filter((p): p is Product => p !== null);

            if (productsToSave.length > 0) {
                productsToSave.forEach(p => onSave(p as Product, true));
                toast({
                    title: "Import Successful",
                    description: `${productsToSave.length} products have been added.`,
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: "Import Failed",
                    description: "Could not parse any products from the file. Please check the format.",
                });
            }
        };
        reader.readAsText(file);
        
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleSopFileChange = (event: React.ChangeEvent<HTMLInputElement>, item: Product) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUri = e.target?.result as string;
            onSave({ ...item, sopFile: dataUri, sopFileName: file.name });
             toast({
                title: "SOP Attached",
                description: `${file.name} has been attached to ${item.name}.`,
            });
        };
        reader.readAsDataURL(file);
    };

    const exportToCSV = useCallback(() => {
        if (items.length === 0) {
            toast({ variant: 'destructive', title: 'No Products to Export', description: 'There is no product data to export.' });
            return;
        }

        const dataToExport = items.map(product => {
            const machineryNames = (product.machineryIds || [])
                .map(id => machinery.find(m => m.id === id)?.name)
                .filter(Boolean)
                .join(', ');
            
            return {
                'Co-Packer': product.coPacker,
                'Product Name': product.name,
                'Allergens': product.allergens,
                'Target Deposit Weight': product.targetDepositWeight || '',
                'Target Finished Weight': product.targetFinishedWeight || '',
                'Batch Size (lb)': product.batchSizeLbs || '',
                'Yield Per Batch': product.yieldPerBatch || '',
                'Machinery': machineryNames,
                'SOP Link': product.sopFile ? (product.sopFileName || 'Attached') : '',
                'Color Code': product.coPackerColor,
                '# batches Priced for 1 Bay Day': product.batchesPricedFor1BayDay || '',
                'FTEs Priced for 1 Bay Day': product.ftesPricedFor1BayDay || '',
            };
        });
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        
        const today = format(new Date(), 'yyyy-MM-dd');
        XLSX.writeFile(workbook, `Made4U_Products_${today}.xlsx`);

        toast({ title: 'Export Successful', description: 'Product data has been downloaded.' });

    }, [items, machinery, toast]);

    const isEditing = (item: Product) => editingItem?.id === item.id;

    const renderProductFields = (item: Product, stateSetter: any) => (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-2 col-span-2">
            <div>
                <Label>Co-Packer</Label>
                <Input placeholder="Co-Packer" value={item.coPacker} onChange={e => handleCoPackerChange(e.target.value, stateSetter)} className="h-9"/>
            </div>
            <div>
                <Label>Co-Packer Color</Label>
                <Input type="color" value={item.coPackerColor} onChange={e => stateSetter({ ...item, coPackerColor: e.target.value })} className="h-9 w-16"/>
            </div>
        </div>
        <div className="col-span-2">
            <Label>Product Name</Label>
            <Input placeholder="Product Name" value={item.name} onChange={e => stateSetter({ ...item, name: e.target.value })} className="h-9"/>
        </div>
        <div className="col-span-2">
            <Label>Allergens</Label>
            <Input placeholder="Allergens" value={item.allergens} onChange={e => stateSetter({ ...item, allergens: e.target.value })} className="h-9"/>
        </div>
        <div>
            <Label>Target Deposit Weight</Label>
            <Input placeholder="e.g. 100g" value={item.targetDepositWeight || ''} onChange={e => stateSetter({ ...item, targetDepositWeight: e.target.value })} className="h-9"/>
        </div>
        <div>
            <Label>Target Finished Weight</Label>
            <Input placeholder="e.g. 95g" value={item.targetFinishedWeight || ''} onChange={e => stateSetter({ ...item, targetFinishedWeight: e.target.value })} className="h-9"/>
        </div>
        <div>
            <Label>Batch Size (lb)</Label>
            <Input placeholder="e.g. 50" value={item.batchSizeLbs || ''} onChange={e => stateSetter({ ...item, batchSizeLbs: e.target.value })} className="h-9"/>
        </div>
        <div>
            <Label>Yield Per Batch</Label>
            <Input placeholder="e.g. 200" value={item.yieldPerBatch || ''} onChange={e => stateSetter({ ...item, yieldPerBatch: e.target.value })} className="h-9"/>
        </div>
         <div>
            <Label># batches Priced for 1 Bay Day</Label>
            <Input placeholder="e.g. 10" value={item.batchesPricedFor1BayDay || ''} onChange={e => stateSetter({ ...item, batchesPricedFor1BayDay: e.target.value })} className="h-9"/>
        </div>
        <div>
            <Label>FTEs Priced for 1 Bay Day</Label>
            <Input placeholder="e.g. 2.5" value={item.ftesPricedFor1BayDay || ''} onChange={e => stateSetter({ ...item, ftesPricedFor1BayDay: e.target.value })} className="h-9"/>
        </div>
        <div className="col-span-2">
            <Label>Required Machinery</Label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-9">
                        Select Machinery... ({item.machineryIds?.length || 0} selected)
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Available Machinery</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {machinery.map(machine => (
                        <DropdownMenuCheckboxItem
                            key={machine.id}
                            checked={(item.machineryIds || []).includes(machine.id)}
                            onCheckedChange={() => handleMachinerySelect(item, machine.id, stateSetter)}
                            onSelect={(e) => e.preventDefault()}
                        >
                            {machine.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
    );

    return (
        <AccordionItem value="products">
            <AccordionTrigger className="text-lg">Products</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4">
                    <div className="px-1 py-2">
                         <Input 
                            placeholder="Search products by name or co-packer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        {sortedItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                                {isEditing(item) && editingItem ? (
                                    <div className="flex-grow space-y-2">
                                       {renderProductFields(editingItem, setEditingItem)}
                                    </div>
                                ) : (
                                    <div className="flex-grow grid grid-cols-[1.5fr_2fr_1fr_1fr_auto] gap-4 items-center">
                                      <div className="flex items-center gap-2">
                                        <Input type="color" value={item.coPackerColor} onChange={(e) => onSave({ ...item, coPackerColor: e.target.value }, true)} className="h-8 w-8 p-1" aria-label="Co-packer color" />
                                        <div>
                                            <p className="font-semibold text-muted-foreground text-xs">CO-PACKER</p>
                                            <p>{item.coPacker}</p>
                                        </div>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-muted-foreground text-xs">PRODUCT</p>
                                        <p>{item.name}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-muted-foreground text-xs">ALLERGENS</p>
                                        <p>{item.allergens || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-muted-foreground text-xs">SPECS</p>
                                        <p className="text-xs">
                                          {item.batchSizeLbs && `Batch: ${item.batchSizeLbs} lbs`}
                                          {item.yieldPerBatch && `, Yield: ${item.yieldPerBatch}`}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                            <p className="font-semibold text-muted-foreground text-xs">SOP</p>
                                            {item.sopFile ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <X className="h-5 w-5 text-destructive/70 mx-auto" />}
                                      </div>
                                    </div>
                                )}
                                <div className="flex flex-row gap-1 items-center">
                                    <input type="file" accept=".pdf,.doc,.docx,.txt" id={`sop-upload-${item.id}`} ref={el => { if (el) sopFileInputRefs.current[item.id] = el; }} onChange={(e) => handleSopFileChange(e, item)} className="hidden" />
                                    <Button size="icon" variant="ghost" onClick={() => sopFileInputRefs.current[item.id]?.click()} title="Upload SOP">
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                    {isEditing(item) ? (
                                        <>
                                          <Button size="icon" variant="ghost" onClick={handleSaveEdit}><Check className="h-4 w-4 text-green-600" /></Button>
                                          <Button size="icon" variant="ghost" onClick={() => setEditingItem(null)}><X className="h-4 w-4" /></Button>
                                        </>
                                    ) : (
                                        <Button size="icon" variant="ghost" onClick={() => handleStartEdit(item)}><Edit className="h-4 w-4"/></Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Add New Product</h4>
                        <div className="flex flex-col gap-2">
                            {renderProductFields(newItem as Product, setNewItem)}
                            <Button onClick={handleAddNew} className="mt-2 self-start">Add New</Button>
                        </div>
                    </div>
                    <div className="pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Import & Export</h4>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={items.length === 0}>Remove All</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete all
                                            products and remove them from any scheduled days.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDeleteAll}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        <p className="text-sm text-muted-foreground my-2">Upload a CSV file with product details.</p>
                         <div className="flex gap-2">
                             <Input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
                             <Button asChild variant="outline">
                               <Label htmlFor="csv-upload" className="cursor-pointer flex items-center">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload CSV File
                               </Label>
                            </Button>
                            <Button variant="outline" onClick={exportToCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                Export to CSV
                            </Button>
                        </div>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function MachineryList({ items, onSave, onDelete }: { items: Machine[], onSave: (item: Machine) => void, onDelete: (id: string) => void }) {
    const [newItemName, setNewItemName] = useState('');
    const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

    const handleAddNew = () => {
        const newItems = newItemName.split('\n').map(name => name.trim()).filter(name => name);
        if (newItems.length > 0) {
            newItems.forEach(name => {
                onSave({ id: `machine-${Date.now()}-${Math.random()}`, name, quantity: 1 });
            });
            setNewItemName('');
        }
    };
    
    const handleSaveEdit = () => {
        if (editingMachine) {
            onSave(editingMachine);
            setEditingMachine(null);
        }
    };

    const isEditing = (item: Machine) => editingMachine?.id === item.id;

    return (
        <AccordionItem value="machinery">
            <AccordionTrigger className="text-lg">Machinery Inventory</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
                                {isEditing(item) && editingMachine ? (
                                    <>
                                        <div className="flex-grow grid grid-cols-2 gap-2">
                                            <Input
                                                value={editingMachine.name}
                                                onChange={e => setEditingMachine({...editingMachine, name: e.target.value})}
                                                placeholder="Machine Name"
                                            />
                                            <Input
                                                type="number"
                                                value={editingMachine.quantity}
                                                onChange={e => setEditingMachine({...editingMachine, quantity: parseInt(e.target.value) || 0})}
                                                placeholder="Quantity"
                                                className="w-24"
                                            />
                                        </div>
                                        <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingMachine(null)}><X className="h-4 w-4" /></Button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-grow">
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
                                        </div>
                                        <Button size="icon" variant="ghost" onClick={() => setEditingMachine({...item})}><Edit className="h-4 w-4"/></Button>
                                        <Button size="icon" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(item.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                     <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Add New Machine(s)</h4>
                        <div className="flex flex-col gap-2">
                            <Textarea 
                                placeholder="Paste a list of machines. Each new line will be a new machine with a quantity of 1." 
                                value={newItemName} 
                                onChange={e => setNewItemName(e.target.value)} 
                                rows={4}
                            />
                            <Button onClick={handleAddNew} className="self-start">Add New</Button>
                        </div>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function PrepStepList({ prepSteps, products, onSave, onDelete, onDeleteAll }: {
    prepSteps: PrepStep[];
    products: Product[];
    onSave: (prepStep: PrepStep) => void;
    onDelete: (id: string) => void;
    onDeleteAll: () => void;
}) {
    const [editingStep, setEditingStep] = useState<PrepStep | null>(null);
    const [newStep, setNewStep] = useState<Omit<PrepStep, 'id'>>({ name: '', daysInAdvance: 1, productIds: [] });
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const sortedProducts = useMemo(() => [...products].sort((a, b) => {
        const nameA = `${a.coPacker} - ${a.name}`.toLowerCase();
        const nameB = `${b.coPacker} - ${b.name}`.toLowerCase();
        return nameA.localeCompare(nameB);
    }), [products]);

    const handleStartEdit = (step: PrepStep) => setEditingStep({ ...step });
    const handleCancelEdit = () => setEditingStep(null);

    const handleSave = (step: PrepStep) => {
        if (step.name.trim()) {
            onSave(step);
            setEditingStep(null);
        } else {
            toast({ variant: 'destructive', title: 'Name is required' });
        }
    };

    const handleAddNew = () => {
        if (newStep.name.trim()) {
            onSave({ ...newStep, id: `prep-${Date.now()}` });
            setNewStep({ name: '', daysInAdvance: 1, productIds: [] });
        } else {
            toast({ variant: 'destructive', title: 'Name is required' });
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                const prepStepMap = new Map<string, { daysInAdvance: number; products: { coPacker: string; name: string }[] }>();

                json.forEach(row => {
                    const prepStepName = row['Prep Step Name'];
                    const daysInAdvance = row['Days in Advance'];
                    const coPackerName = row['Co-Packer Name'];
                    const productName = row['Product Name'];

                    if (prepStepName && daysInAdvance != null && coPackerName && productName) {
                        if (!prepStepMap.has(prepStepName)) {
                            prepStepMap.set(prepStepName, { daysInAdvance: Number(daysInAdvance), products: [] });
                        }
                        prepStepMap.get(prepStepName)!.products.push({ coPacker: coPackerName, name: productName });
                    }
                });

                for (const [name, data] of prepStepMap.entries()) {
                    const productIds = data.products.map(p => {
                        const product = products.find(prod => prod.coPacker === p.coPacker && prod.name === p.name);
                        return product?.id;
                    }).filter((id): id is string => !!id);

                    const existingStep = prepSteps.find(ps => ps.name === name);
                    const stepToSave: PrepStep = {
                        id: existingStep?.id || `prep-${Date.now()}-${Math.random()}`,
                        name,
                        daysInAdvance: data.daysInAdvance,
                        productIds,
                    };
                    onSave(stepToSave);
                }
                toast({ title: "Import Successful", description: `${prepStepMap.size} prep steps imported.` });

            } catch (error) {
                console.error("Prep step import error:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: "Could not parse file." });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const exportToCSV = () => {
        const dataToExport: any[] = [];
        prepSteps.forEach(step => {
            step.productIds.forEach(productId => {
                const product = products.find(p => p.id === productId);
                if (product) {
                    dataToExport.push({
                        'Prep Step Name': step.name,
                        'Days in Advance': step.daysInAdvance,
                        'Co-Packer Name': product.coPacker,
                        'Product Name': product.name,
                    });
                }
            });
        });

        if(dataToExport.length === 0) {
            toast({variant: 'destructive', title: 'No data to export'});
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Prep Steps");
        XLSX.writeFile(workbook, `Made4U_PrepSteps_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast({ title: 'Export Successful' });
    };

    const renderStep = (step: PrepStep | Omit<PrepStep, 'id'>, isNew: boolean) => {
        const currentStep = isNew ? newStep : (editingStep || step);
        const setStep = isNew ? setNewStep : setEditingStep as React.Dispatch<React.SetStateAction<PrepStep>>;
        const selectedProducts = currentStep.productIds.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];

        return (
             <div className="p-3 rounded-md bg-muted/50 space-y-3">
                <div className="flex justify-between items-start">
                    <div className="flex-grow space-y-2">
                        <div className="grid grid-cols-[2fr_1fr] gap-4">
                            <div>
                                <Label>Prep Step Name</Label>
                                <Input
                                    placeholder="e.g., Defrost Butter"
                                    value={currentStep.name}
                                    onChange={(e) => setStep((prev: any) => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>Days in Advance</Label>
                                <Input
                                    type="number"
                                    value={currentStep.daysInAdvance}
                                    onChange={(e) => setStep((prev: any) => ({ ...prev, daysInAdvance: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Applicable Products</Label>
                             <MultiSelect
                                options={sortedProducts.map(p => ({ value: p.id, label: `${p.coPacker} - ${p.name}` }))}
                                selected={currentStep.productIds}
                                onChange={(selected) => setStep((prev: any) => ({ ...prev, productIds: selected }))}
                                placeholder="Select products..."
                            />
                        </div>
                    </div>
                    {isNew ? null : (
                        <div className="flex items-center ml-4">
                            <Button size="icon" variant="ghost" onClick={() => handleSave(editingStep!)}><Check className="h-4 w-4 text-green-600"/></Button>
                            <Button size="icon" variant="ghost" onClick={handleCancelEdit}><X className="h-4 w-4"/></Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <AccordionItem value="prep-steps">
            <AccordionTrigger className="text-lg">Preparation Steps</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        {prepSteps.map(step => (
                            <div key={step.id}>
                                {editingStep?.id === step.id ? (
                                    renderStep(step, false)
                                ) : (
                                    <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                                        <div className="flex-grow font-semibold">{step.name}</div>
                                        <div className="text-sm text-muted-foreground">{step.daysInAdvance} day(s) in advance</div>
                                        <div className="w-1/2 text-xs text-muted-foreground truncate">
                                            {step.productIds.map(id => products.find(p=>p.id === id)?.name).filter(Boolean).join(', ')}
                                        </div>
                                        <div>
                                            <Button size="icon" variant="ghost" onClick={() => handleStartEdit(step)}><Edit className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(step.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 border-t">
                        <h4 className="font-medium mb-2">Add New Prep Step</h4>
                        {renderStep(newStep as PrepStep, true)}
                        <Button onClick={handleAddNew} className="mt-3">Add New Step</Button>
                    </div>
                    <div className="pt-4 border-t">
                         <div className="flex justify-between items-center">
                            <h4 className="font-medium">Import & Export</h4>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={prepSteps.length === 0}>Remove All</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This action will permanently delete all preparation steps.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDeleteAll}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        <p className="text-sm text-muted-foreground my-2">Upload a CSV with columns: `Prep Step Name`, `Days in Advance`, `Co-Packer Name`, `Product Name`.</p>
                         <div className="flex gap-2">
                             <Input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" id="prepstep-csv-upload" />
                             <Button asChild variant="outline">
                               <Label htmlFor="prepstep-csv-upload" className="cursor-pointer flex items-center">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload CSV File
                               </Label>
                            </Button>
                            <Button variant="outline" onClick={exportToCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                Export to CSV
                            </Button>
                        </div>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

const MultiSelect = ({ options, selected, onChange, placeholder }: {
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
}) => {
    const [open, setOpen] = useState(false);
    const selectedValues = new Set(selected);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-auto min-h-9 font-normal"
                >
                    <div className="flex flex-wrap gap-1">
                        {selected.length > 0 ? (
                             selectedValues.size > 3 ? (
                                <Badge variant="secondary">{selectedValues.size} selected</Badge>
                             ) : (
                                options.filter(opt => selectedValues.has(opt.value)).map(opt => (
                                    <Badge key={opt.value} variant="secondary">{opt.label}</Badge>
                                ))
                             )
                        ) : (
                            <span className="text-muted-foreground">{placeholder || "Select..."}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        const newSelected = selected.includes(option.value)
                                            ? selected.filter(s => s !== option.value)
                                            : [...selected, option.value];
                                        onChange(newSelected);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

    







