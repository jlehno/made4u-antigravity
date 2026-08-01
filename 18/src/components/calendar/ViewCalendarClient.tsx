

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { addMonths, subMonths, format, parse, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isValid, addDays } from 'date-fns';
import { useProduction } from '@/lib/store';
import { BAYS, BAY_COLORS, getDefaultPrivileges } from '@/lib/types';
import type { Bay, ProductionItem, Product, CalendarNote, PrepStep } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Search, X, Notebook, StickyNote, ChevronsUpDown, Package } from 'lucide-react';
import { cn, isColorLight } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '../ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

type SearchResult = {
    date: string;
    items: {
        bay: Bay;
        item: ProductionItem;
        product: Product;
    }[];
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MIN_COL_WIDTH = 150;

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

export function ViewCalendarClient() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { products, schedule, setCalendarColumnWidths, calendarNotes, settings, isDataLoading, userRole, userName, userId, users = [], prepSteps, confirmedHours = {} } = useProduction();

  const currentUser = users.find(u => (userId && u.id === userId) || (userName && u.name === userName));
  const userPrivileges = currentUser?.privileges || getDefaultPrivileges(userRole, userName);
  const isMiffyOnly = userPrivileges.clientAccess === 'miffy' || userRole === 'miffy';
  const showBayDaysTop = userPrivileges.viewCalendarBayDaysTop !== false && !isMiffyOnly;

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [monthInput, setMonthInput] = useState(format(currentMonth, 'M'));
  const [yearInput, setYearInput] = useState(format(currentMonth, 'yyyy'));
  const { toast } = useToast();
  const localColumnWidths = settings?.calendarColumnWidths || Array(7).fill(MIN_COL_WIDTH);

  const monthDays = useMemo(() => eachDayOfInterval({start: startOfMonth(currentMonth), end: endOfMonth(currentMonth)}), [currentMonth]);
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
                    if (isMiffyOnly && product.coPacker !== "Miffy's") return;
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
                    if (isMiffyOnly && product.coPacker !== "Miffy's") return;
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
  }, [currentMonth, schedule, products, confirmedHours, users, monthDays, isMiffyOnly]);
  
  useEffect(() => {
    setMonthInput(format(currentMonth, 'M'));
    setYearInput(format(currentMonth, 'yyyy'));
  }, [currentMonth]);

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

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const handleSearch = () => {
    if (!searchQuery.trim()) {
        setSearchResults([]);
        setHasSearched(false);
        return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    Object.entries(schedule).forEach(([date, daySchedule]) => {
        const foundItems: SearchResult['items'] = [];
        Object.entries(daySchedule).forEach(([bay, items]) => {
            items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    if(isMiffyOnly && product.coPacker !== "Miffy's") return;

                    const productName = product.name.toLowerCase();
                    const coPackerName = product.coPacker.toLowerCase();
                    if (productName.includes(lowerCaseQuery) || coPackerName.includes(lowerCaseQuery)) {
                        foundItems.push({ bay: bay as Bay, item, product });
                    }
                }
            });
        });
        if (foundItems.length > 0) {
            results.push({ date, items: foundItems });
        }
    });

    results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setSearchResults(results);
    setHasSearched(true);
  };
  
  const clearSearch = () => {
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
  }

  const parseDateAsLocal = (dateString: string) => {
    return parse(dateString, 'yyyy-MM-dd', new Date());
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
  
  const renderProductItem = (product: Product, item: ProductionItem, bay: Bay, showCoPacker: boolean) => {
    return (
      <div 
        className={cn(
          'p-1 rounded-sm font-medium text-xs w-full flex flex-col justify-start items-stretch', 
          BAY_COLORS[bay].base, 
          BAY_COLORS[bay].text
        )}
      >
        {showCoPacker && (
            <div className='flex items-center justify-start -m-px'>
                <span 
                    className={cn("truncate px-1 py-0.5 rounded-sm", isColorLight(product.coPackerColor) ? "text-black" : "text-white")}
                    style={{ backgroundColor: product.coPackerColor }}
                >
                    {product.coPacker}
                </span>
            </div>
        )}
        <div className="flex items-center gap-1.5 text-left px-1 truncate">
            <span>{item.batches}</span>
             -
            <span className="truncate">{product.name}</span>
        </div>
      </div>
    );
  };
  
   const calendarRows = useMemo(() => {
    if (isDataLoading || !settings) return [];
    const rows: JSX.Element[] = [];
    let cells: JSX.Element[] = [];
    for (let i = 0; i < startingDayIndex; i++) {
        cells.push(<TableCell key={`empty-${i}`} className="border-r-2 border-zinc-800" />);
    }
    monthDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const daySchedule = schedule[dateKey] || {};
        const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;
        const note = calendarNotes[dateKey]?.note;
        
        const bayItems: { [key in Bay]?: { item: ProductionItem, product: Product }[] } = {};
        for (const bay of BAYS) {
            const items = (daySchedule[bay] || []).map((item: ProductionItem) => {
                const product = products.find(p => p.id === item.productId);
                if(isMiffyOnly && product?.coPacker !== "Miffy's") return null;
                return product ? { bay, item, product } : null;
            }).filter((i): i is { bay: Bay; item: ProductionItem; product: Product } => !!i);

            if (items.length > 0) {
                 bayItems[bay] = items;
            }
        }
        
        const allItems = Object.values(bayItems).flat();

        const requiredPrepSteps = prepSteps.flatMap(step => {
            const productionDate = addDays(day, step.daysInAdvance);
            const productionDateKey = format(productionDate, 'yyyy-MM-dd');
            
            const productIdsOnProductionDay = schedule[productionDateKey]
                ? Object.values(schedule[productionDateKey]).flat().map((item: any) => item.productId)
                : [];

            if (productIdsOnProductionDay.length === 0) return [];
            
            const applicableProducts = products.filter(p => 
                productIdsOnProductionDay.includes(p.id) && step.productIds.includes(p.id)
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


        cells.push(
             <TableCell
                key={day.toString()}
                className={cn(
                    "relative p-2 align-top h-32 border-r-2 border-b-2 border-zinc-800",
                    "bg-zinc-950/90 dark:bg-zinc-950",
                    isToday ? "bg-emerald-950/80 dark:bg-emerald-950 border border-emerald-600 text-white" : ""
                )}
            >
                <Dialog>
                    <DialogTrigger asChild>
                       <div className="w-full h-full cursor-pointer">
                            <div className="flex justify-between items-center">
                                <div className={cn("text-sm font-medium", isToday ? "text-white font-bold" : "text-foreground")}>
                                    {format(day, 'd')}
                                </div>
                                {note && !isMiffyOnly && <Notebook className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="mt-1 space-y-0.5 text-xs text-left">
                                {note && !isMiffyOnly && (
                                     <div className="mb-1 p-1 rounded-sm bg-zinc-800 text-zinc-100 border border-zinc-700 text-xs font-medium flex items-start gap-1">
                                         <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                                         <p className="line-clamp-2">{note}</p>
                                     </div>
                                )}
                                {requiredPrepSteps.length > 0 && !isMiffyOnly && (
                                     <div className="p-1 rounded-sm bg-emerald-950 text-emerald-100 border border-emerald-800/60 text-xs font-medium flex items-start gap-1">
                                       <Package className="h-3 w-3 mt-0.5 shrink-0" />
                                         <div className="flex flex-col">
                                             {requiredPrepSteps.map((step, i) => (
                                                 <p key={i} className="line-clamp-2">{step.name} - {step.coPacker}</p>
                                             ))}
                                         </div>
                                     </div>
                                )}
                                {Object.entries(bayItems).map(([bay, items]) => {
                                    const coPackerGroups = items.reduce((acc, item) => {
                                        const coPacker = item.product?.coPacker;
                                        if (!coPacker) return acc;
                                        if (!acc[coPacker]) {
                                            acc[coPacker] = [];
                                        }
                                        acc[coPacker].push(item);
                                        return acc;
                                    }, {} as Record<string, typeof items>);

                                    return Object.entries(coPackerGroups).map(([coPacker, groupItems]) => 
                                        groupItems.map((scheduleItem, index) => {
                                            if (!scheduleItem.product) return null;
                                            return (
                                                <div key={scheduleItem.item.id}>
                                                    {renderProductItem(scheduleItem.product, scheduleItem.item, (scheduleItem as any).bay as Bay, index === 0)}
                                                </div>
                                            )
                                        })
                                    );
                                })}
                            </div>
                       </div>
                    </DialogTrigger>
                    <DayDetailDialogContent date={day} calendarNotes={calendarNotes} />
                </Dialog>
            </TableCell>
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
  }, [startingDayIndex, monthDays, products, schedule, localColumnWidths, calendarNotes, prepSteps, isDataLoading, settings, isMiffyOnly]);

  if (isDataLoading || !settings) {
      return <div>Loading...</div>
  }

  return (
    <div className="space-y-8">
      <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
        <CardHeader>
          <CardTitle>Search Schedule</CardTitle>
          <CardDescription>Search for products or co-packers to see their scheduled production dates.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex w-full max-w-sm items-center space-x-2">
                <Input 
                    type="text" 
                    placeholder="e.g., 'Product A' or 'CP-1'" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> Search</Button>
                {hasSearched && (
                    <Button variant="ghost" onClick={clearSearch}><X className="mr-2 h-4 w-4" />Clear</Button>
                )}
            </div>
            {hasSearched && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Search Results ({searchResults.length} {searchResults.length === 1 ? 'day' : 'days'})</h3>
                    {searchResults.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
                            {searchResults.map(result => (
                                <Dialog key={result.date}>
                                    <DialogTrigger asChild>
                                        <div className="p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                                            <h4 className="font-bold text-lg">{format(parseDateAsLocal(result.date), 'PPPP')}</h4>
                                            <div className='mt-2 space-y-2'>
                                            {result.items.map(({bay, item, product}) => (
                                                <div 
                                                    key={item.id} 
                                                    className="flex items-center gap-4 text-sm">
                                                    <Badge variant="secondary" className={cn(BAY_COLORS[bay].base, BAY_COLORS[bay].text)}>{bay}</Badge>
                                                    <p>{product.name}</p>
                                                </div>
                                            ))}
                                            </div>
                                        </div>
                                    </DialogTrigger>
                                    <DayDetailDialogContent date={parseDateAsLocal(result.date)} calendarNotes={calendarNotes} />
                                </Dialog>
                            ))}
                        </div>
                    ) : (
                        <p>No results found for "{searchQuery}".</p>
                    )}
                </div>
            )}
        </CardContent>
      </Card>
      
      <Card className="bg-zinc-950/90 dark:bg-zinc-950 border-zinc-800">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-bold w-48 text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {showBayDaysTop && (
                <div className="border p-2 rounded-lg bg-background shadow-sm text-center">
                  <p className="text-sm font-medium text-muted-foreground">Bay Days Produced This Month</p>
                  <p className="text-2xl font-bold">{totalMonthBayDays.toFixed(2)}</p>
                </div>
              )}

            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Month"
                value={monthInput}
                onChange={(e) => setMonthInput(e.target.value)}
                className="w-20"
                aria-label="Month"
              />
              <Input
                type="number"
                placeholder="Year"
                value={yearInput}
                onChange={(e) => setYearInput(e.target.value)}
                className="w-24"
                aria-label="Year"
              />
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
                            <TableHead key={day} className="py-2 text-center font-semibold text-sm bg-zinc-950 text-zinc-300 relative border-b-2 border-r-2 border-zinc-800">
                                {day}
                                {i < WEEK_DAYS.length - 1 && userRole === 'admin' && (
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
    </div>
  );
}

type SpecType = 'deposit' | 'finished' | 'batch';

function ProductSpecSelector({ item, product, onSpecChange, currentSpec, bay }: {
    item: ProductionItem;
    product: Product;
    onSpecChange: (spec: SpecType) => void;
    currentSpec: SpecType;
    bay: Bay;
}) {
    const specLabels: Record<SpecType, string> = {
        'deposit': 'Deposit Wt',
        'finished': 'Finished Wt',
        'batch': 'Batch Size'
    };

    const getSpecValue = (spec: SpecType) => {
        switch (spec) {
            case 'deposit': return product.targetDepositWeight || '-';
            case 'finished': return product.targetFinishedWeight || '-';
            case 'batch': return product.batchSizeLbs ? `${product.batchSizeLbs} lbs` : '-';
            default: return '-';
        }
    }
    
    const bayColor = BAY_COLORS[bay] || BAY_COLORS['Blue'];
    
    return (
        <div className="flex flex-col items-center gap-1 w-32">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="outline"
                        className={cn("h-8 text-xs text-white w-full", bayColor.base, `hover:${bayColor.base}`)}
                     >
                        {specLabels[currentSpec]}
                        <ChevronsUpDown className="ml-auto h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => onSpecChange('deposit')}>Deposit Wt</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onSpecChange('finished')}>Finished Wt</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onSpecChange('batch')}>Batch Size</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <span className="font-semibold text-sm h-auto min-h-6 text-center break-words w-full">{getSpecValue(currentSpec)}</span>
        </div>
    )
}

function DayDetailDialogContent({ date, calendarNotes }: { date: Date; calendarNotes: any; }) {
    const { schedule, products, userRole } = useProduction();
    const [specDisplay, setSpecDisplay] = useState<Record<string, SpecType>>({});
    const dateKey = format(date, 'yyyy-MM-dd');
    const note = calendarNotes[dateKey]?.note;

    const handleSpecChange = (itemId: string, spec: SpecType) => {
        setSpecDisplay(prev => ({ ...prev, [itemId]: spec }));
    }

    const renderProductItem = (product: Product, item: ProductionItem, bay: Bay) => {
        const totalYield = (parseFloat(item.batches) || 0) * (parseFloat(product.yieldPerBatch || '0') || 0);

        return (
            <div className="flex justify-between items-start gap-x-4">
                <div className="space-y-1 flex-grow">
                    <p className="text-sm flex items-center gap-2">
                        <span className="font-bold text-lg">{item.batches}</span>
                        <span 
                            className={cn('px-1.5 py-0.5 rounded-sm', isColorLight(product.coPackerColor) ? "text-black" : "text-white")}
                            style={{ backgroundColor: product.coPackerColor }}
                        >
                          {product.coPacker}
                        </span>
                        <span>- {product.name}</span>
                    </p>
                    <div className="text-xs font-normal opacity-80 ml-1 mt-2">
                         {product.allergens && <div><span className="font-semibold">Allergens:</span> {product.allergens}</div>}
                         {totalYield > 0 && <div><span className="font-semibold">Total Yield:</span> {totalYield.toLocaleString()}</div>}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    <ProductSpecSelector 
                        item={item}
                        product={product}
                        currentSpec={specDisplay[item.id] || 'deposit'}
                        onSpecChange={(spec) => handleSpecChange(item.id, spec)}
                        bay={bay}
                    />
                </div>
            </div>
        );
    };

    return (
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-background text-foreground">
            <DialogHeader>
                <DialogTitle className="text-3xl">{format(date, 'PPPP')}</DialogTitle>
                <DialogDescription className="text-foreground/80">
                    A complete overview of all production scheduled for this day. This is a read-only view.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start flex-grow overflow-auto p-1">
                {BAYS.map(bay => {
                    const baySchedule = schedule[dateKey]?.[bay] || [];
                    
                    const groupedByCoPacker = useMemo(() => {
                        return baySchedule.reduce((acc, item) => {
                            const product = products.find(p => p.id === item.productId);
                            if (!product) return acc;
                            if (userRole === 'miffy' && product.coPacker !== "Miffy's") return acc;
                    
                            const coPacker = product.coPacker || 'Unassigned';
                            if (!acc[coPacker]) {
                                acc[coPacker] = [];
                            }
                            acc[coPacker].push(item);
                            return acc;
                        }, {} as Record<string, ProductionItem[]>);
                    }, [baySchedule, products, userRole]);

                    const hasData = Object.keys(groupedByCoPacker).length > 0;

                    return (
                        <Card 
                            key={bay} 
                            className={cn(
                                "h-full",
                                hasData ? BAY_COLORS[bay].base : "bg-card",
                                hasData ? BAY_COLORS[bay].text : ""
                            )}
                          >
                            <CardHeader>
                                <CardTitle>{bay} Bay</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {hasData ? (
                                    Object.entries(groupedByCoPacker).map(([coPacker, items]) => (
                                        <div key={coPacker}>
                                            <div className="space-y-3">
                                            {items.map(item => {
                                                const product = products.find(p => p.id === item.productId);
                                                return product ? (
                                                    <div key={item.id}>
                                                      {renderProductItem(product, item, bay)}
                                                    </div>
                                                ) : null
                                            })}
                                            </div>
                                        </div>
                                    ))
                                ) : <p className={cn("text-sm", hasData ? 'text-white/80' : 'text-muted-foreground')}>No production scheduled.</p>}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
             {note && userRole !== 'miffy' && (
                <div className="flex-shrink-0 pt-4 border-t">
                    <h3 className="font-semibold text-lg mb-2">Notes for the Day</h3>
                    <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground whitespace-pre-wrap">
                        {note}
                    </div>
                </div>
            )}
        </DialogContent>
    );
}





    

