
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useProduction } from '@/lib/store';
import { BAYS } from '@/lib/types';
import type { Bay, TaskAssignment, Employee, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EyeOff, Expand, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import useEmblaCarousel from 'embla-carousel-react'

// Helper function to determine if a color is light or dark
function isColorLight(hexColor: string) {
    const color = hexColor.charAt(0) === '#' ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16); // hexToR
    const g = parseInt(color.substring(2, 4), 16); // hexToG
    const b = parseInt(color.substring(4, 6), 16); // hexToB
    const uicolors = [r / 255, g / 255, b / 255];
    const c = uicolors.map((col) => {
        if (col <= 0.03928) {
            return col / 12.92;
        }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.179;
}


export function AssignedTasksClient() {
  const [hiddenBays, setHiddenBays] = useState<Set<Bay>>(new Set());
  const { assignedTasksDate, users } = useProduction();

  const toggleBayVisibility = (bay: Bay) => {
    setHiddenBays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bay)) {
        newSet.delete(bay);
      } else {
        newSet.add(bay);
      }
      return newSet;
    });
  };

  const showAllBays = () => {
    setHiddenBays(new Set());
  };
  
  if (!users || users.length === 0) {
      return (
          <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="ml-2">Loading staff data...</p>
          </div>
      )
  }

  const productionBays: Bay[] = BAYS.filter(b => b !== 'Fulfillment' && b !== 'Pre-Blending') as Bay[];
  const fulfillmentBay: Bay | undefined = BAYS.find(b => b === 'Fulfillment') as Bay | undefined;
  const preBlendingBay: Bay | undefined = BAYS.find(b => b === 'Pre-Blending') as Bay | undefined;


  const visibleProductionBays = productionBays.filter(bay => !hiddenBays.has(bay));
  const isFulfillmentVisible = fulfillmentBay ? !hiddenBays.has(fulfillmentBay) : false;
  const isPreBlendingVisible = preBlendingBay ? !hiddenBays.has(preBlendingBay) : false;
  
  const allVisibleBays = [...visibleProductionBays, ...(isFulfillmentVisible && fulfillmentBay ? [fulfillmentBay] : []), ...(isPreBlendingVisible && preBlendingBay ? [preBlendingBay] : [])];


  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
       {hiddenBays.size > 0 && (
        <div className="flex justify-end">
            <Button variant="secondary" onClick={showAllBays} className="ml-auto">
                Show All Bays ({allVisibleBays.length} visible)
            </Button>
        </div>
        )}
      
      <div className="flex-grow grid grid-cols-4 grid-rows-1 gap-6 items-stretch">
        {visibleProductionBays.map(bay => (
          <BayAssignedTasksCard 
            key={bay} 
            bay={bay} 
            date={assignedTasksDate} 
            onHide={() => toggleBayVisibility(bay)}
            className="h-full"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 flex-shrink-0 mt-6">
        {isFulfillmentVisible && fulfillmentBay && (
            <BayAssignedTasksCard 
                key={fulfillmentBay} 
                bay={fulfillmentBay} 
                date={assignedTasksDate} 
                onHide={() => toggleBayVisibility(fulfillmentBay)}
                className="min-h-[200px]"
            />
        )}
        {isPreBlendingVisible && preBlendingBay && (
            <BayAssignedTasksCard 
                key={preBlendingBay} 
                bay={preBlendingBay} 
                date={assignedTasksDate} 
                onHide={() => toggleBayVisibility(preBlendingBay)}
                className="min-h-[200px]"
            />
        )}
      </div>
    </div>
  );
}

function BayAssignedTasksCard({ bay, date, onHide, className }: { bay: Bay, date: Date, onHide: () => void, className?: string }) {
    const { schedule, assignments, products, tasks, users, assignedTasksIsScrolling, assignedTasksScrollSpeed, confirmedHours } = useProduction();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const cardScrollContainerRef = useRef<HTMLDivElement>(null);
    const dialogScrollContainerRef = useRef<HTMLDivElement>(null);
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

    const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dialogScrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const emblaIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const dateKey = format(date, 'yyyy-MM-dd');
    const daySchedule = schedule[dateKey]?.[bay] || [];
    const dayAssignments = (assignments[dateKey]?.[bay] || []).filter(a => !a.hidden);
    const hasData = daySchedule.length > 0 || dayAssignments.length > 0;
    
    const bayColorClasses: { [key in Bay]: string } = {
        Blue: 'bg-blue-400 text-white',
        Green: 'bg-green-400 text-white',
        Orange: 'bg-orange-400 text-white',
        Purple: 'bg-purple-400 text-white',
        Fulfillment: 'bg-yellow-300 text-black',
        'Pre-Blending': 'bg-teal-200 text-black',
    };
    
    const getScrollInterval = () => {
        switch(assignedTasksScrollSpeed) {
            case 'slow': return 70;
            case 'normal': return 50;
            case 'fast': return 30;
            case 'faster': return 15;
            case 'very fast': return 7;
            default: return 50;
        }
    }
    
    const getEmblaInterval = () => {
        switch(assignedTasksScrollSpeed) {
            case 'slow': return 6000;
            case 'normal': return 4000;
            case 'fast': return 2500;
            case 'faster': return 1500;
            case 'very fast': return 800;
            default: return 4000;
        }
    }
    
    const startScrolling = (ref: React.RefObject<HTMLDivElement>, intervalRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
        if (!ref.current) return;
        stopScrolling(intervalRef);

        const scrollContainer = ref.current;
        intervalRef.current = setInterval(() => {
            if (scrollContainer.scrollTop >= scrollContainer.scrollHeight / 2) {
                scrollContainer.scrollTop = 0;
            } else {
                scrollContainer.scrollTop += 1;
            }
        }, getScrollInterval());
    };

    const stopScrolling = (intervalRef: React.MutableRefObject<NodeJS.Timeout | null>) => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };
    
    const startEmblaScrolling = () => {
        stopEmblaScrolling();
        emblaIntervalRef.current = setInterval(() => {
            if (emblaApi) {
                emblaApi.scrollNext();
            }
        }, getEmblaInterval());
    };

    const stopEmblaScrolling = () => {
        if (emblaIntervalRef.current) {
            clearInterval(emblaIntervalRef.current);
            emblaIntervalRef.current = null;
        }
    };

    useEffect(() => {
        if (assignedTasksIsScrolling) {
            if (isFulfillmentBay || isPreBlendingBay) {
                startEmblaScrolling();
            } else {
                startScrolling(cardScrollContainerRef, scrollIntervalRef);
            }
        } else {
            if (isFulfillmentBay || isPreBlendingBay) {
                stopEmblaScrolling();
            } else {
                stopScrolling(scrollIntervalRef);
            }
        }
        return () => {
            stopScrolling(scrollIntervalRef);
            stopEmblaScrolling();
        };
    }, [assignedTasksIsScrolling, bay, emblaApi, assignedTasksScrollSpeed]);

    useEffect(() => {
      if(isDialogOpen) {
        startScrolling(dialogScrollContainerRef, dialogScrollIntervalRef)
      } else {
        stopScrolling(dialogScrollIntervalRef)
      }
      return () => stopScrolling(dialogScrollIntervalRef)
    }, [isDialogOpen])

    const visibleAssignments = dayAssignments.filter(a => !a.hidden);
    const isFulfillmentBay = bay === 'Fulfillment';
    const isPreBlendingBay = bay === 'Pre-Blending';

    const renderTask = (assignment: any, index: number, inDialog = false) => {
        const task = tasks.find(t => t.id === assignment.taskId);
        if (!task) return null;
        
        const taskContent = (
             <>
                <h4 className={cn("font-medium", inDialog && "text-lg mb-3")}>{task.name}</h4>
                <div className="flex flex-wrap gap-2 mt-2">
                    {assignment.employeeIds.length > 0 ? (
                        assignment.employeeIds.map((empId: string) => {
                            const employee = users.find(e => e.id === empId);
                            const employeeHours = confirmedHours[dateKey]?.[empId]?.join(', ');
                            return (
                                <Badge key={empId} variant={hasData ? 'secondary' : 'default'} className={cn(hasData ? 'bg-white/20 text-white' : '', inDialog && 'text-sm px-3 py-1')}>
                                    {employee?.name || 'Unknown'}
                                    {employeeHours && <span className="ml-2 opacity-80 text-xs">({employeeHours})</span>}
                                </Badge>
                            );
                        })
                    ) : (
                        <Badge variant="outline" className={cn(hasData ? 'bg-transparent border-white/50 text-white/90' : '', inDialog && 'text-sm px-3 py-1')}>No one assigned</Badge>
                    )}
                </div>
            </>
        );

        if ((isFulfillmentBay || isPreBlendingBay) && !inDialog) {
            return (
                <div className="embla__slide p-2" key={`${assignment.id}-${index}`}>
                    <div className="p-4 rounded-lg bg-black/20 h-full">
                        {taskContent}
                    </div>
                </div>
            )
        }
        
        const isLastTaskBeforeLoop = index === visibleAssignments.length - 1;
        
        return (
            <React.Fragment key={`${assignment.id}-${index}`}>
                <div className={cn("pb-2", inDialog && "mb-4")}>
                    {taskContent}
                </div>
                {isLastTaskBeforeLoop && (
                    <Separator className={cn("my-4", hasData ? 'bg-white/30' : '')} />
                )}
            </React.Fragment>
        )
    }

    const productionSection = (inDialog = false) => {
      const textSize = inDialog ? 'text-base' : 'text-sm';
      const batchSize = inDialog? 'text-lg' : '';

      return (
        <div className={cn("space-y-2", inDialog && "space-y-4")}>
            {daySchedule.length > 0 ? daySchedule.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return (
                    <div key={item.id} className={cn("p-2 rounded-md bg-muted text-muted-foreground", textSize)}>
                        Unknown Product
                    </div>
                );

                const textColor = isColorLight(product.coPackerColor) ? 'text-black' : 'text-white';
                return (
                    <div 
                      key={item.id} 
                      className={cn("p-2 rounded-md font-medium", textSize, textColor)}
                      style={{ backgroundColor: product.coPackerColor }}
                    >
                        {product.coPacker} - {product.name} - <span className={cn("font-bold", batchSize)}>{item.batches}</span>
                    </div>
                )
            }) : <p className={cn(textSize, hasData ? 'text-white/80' : 'text-muted-foreground')}>No production scheduled.</p>}
        </div>
      );
    }
    

    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Card 
            className={cn(
            "h-full flex flex-col",
            hasData ? bayColorClasses[bay] : "bg-card",
            className
        )}>
            <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    {(isFulfillmentBay || isPreBlendingBay) && <CardTitle>{bay} Bay</CardTitle>}
                  </div>
                  <div className="flex items-center -mt-2 -mr-2 ml-auto">
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn("h-8 w-8", hasData ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground')}
                        aria-label={`Present ${bay} Bay`}
                      >
                        <Expand className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={onHide} 
                      className={cn("h-8 w-8", hasData ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground')}
                      aria-label={`Hide ${bay} Bay`}
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                 <div className="pt-2">
                   {!(isFulfillmentBay || isPreBlendingBay) && productionSection()}
                 </div>
            </CardHeader>
            <CardContent className={cn("flex-grow overflow-hidden flex flex-col", (isFulfillmentBay || isPreBlendingBay) ? 'p-0 grid grid-cols-1' : 'space-y-4')}>
                {isFulfillmentBay || isPreBlendingBay ? (
                  <>
                    <div className="flex-grow overflow-hidden -mx-2" ref={emblaRef}>
                        <div className="embla__container h-full">
                            {visibleAssignments.length > 0 ? (
                                [...visibleAssignments, ...visibleAssignments].map((assignment, index) => renderTask(assignment, index))
                            ) : (
                                <div className="flex items-center justify-center h-full embla__slide">
                                    <p className={cn("text-sm", hasData ? 'text-white/80' : 'text-muted-foreground')}>No tasks assigned.</p>
                                </div>
                            )}
                        </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Separator className={cn(hasData ? 'bg-white/30' : '')} />
                    <div className="flex-grow flex flex-col h-full overflow-hidden">
                         <div ref={cardScrollContainerRef} className="flex-grow overflow-y-auto -m-2 p-2 space-y-3 h-72">
                             {visibleAssignments.length > 0 ? (
                                <>
                                    {[...visibleAssignments, ...visibleAssignments].map((assignment, index) => renderTask(assignment, index))}
                                </>
                            ) : (
                                <p className={cn("text-sm", hasData ? 'text-white/80' : 'text-muted-foreground')}>No tasks assigned for this day.</p>
                            )}
                        </div>
                    </div>
                  </>
                )}
            </CardContent>
        </Card>
        <DialogContent
            className={cn("max-w-full w-full h-full flex flex-col p-10", hasData ? bayColorClasses[bay] : "bg-card")}>
            <DialogHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <DialogTitle className="text-2xl font-bold">{bay} Bay</DialogTitle>
                      <DialogDescription className={cn("text-lg", hasData ? "text-white/80" : "text-muted-foreground")}>
                          Displaying tasks and production for {format(date, 'PPPP')}. This is a read-only presentation view.
                      </DialogDescription>
                  </div>
              </div>
            </DialogHeader>
            <div className="flex-grow grid grid-cols-2 gap-10 pt-4 overflow-hidden">
              <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b-2 pb-2 border-current">Production</h2>
                {productionSection(true)}
              </div>
              <div className="space-y-6 flex flex-col h-full overflow-hidden">
                <h2 className="text-xl font-semibold border-b-2 pb-2 border-current flex-shrink-0">Tasks & Assignments</h2>
                  <div ref={dialogScrollContainerRef} className="flex-grow overflow-y-auto space-y-4 pr-4 -mr-4">
                    {visibleAssignments.length > 0 ? (
                      <>
                        {[...visibleAssignments, ...visibleAssignments].map((assignment, index) => renderTask(assignment, index, true))}
                      </>
                  ) : (
                      <p className={cn("text-base", hasData ? 'text-white/80' : 'text-muted-foreground')}>No tasks assigned for this day.</p>
                  )}
                </div>
              </div>
            </div>
             <div className="flex-shrink-0 pt-4 mt-auto">
                <div className={cn("border p-4 rounded-lg text-sm max-w-md", hasData ? "bg-black/20 border-white/30" : "bg-muted")}>
                    Assigned Tasks are subject to change during Production. Thank you for being flexible!
                </div>
            </div>
        </DialogContent>
      </Dialog>
    );
}

    

    