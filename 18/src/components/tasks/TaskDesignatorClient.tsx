

"use client";

import React, { useState, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { useProduction } from '@/lib/store';
import { BAYS, BAY_COLORS } from '@/lib/types';
import type { Bay, TaskAssignment, Employee, Task, ProductionItem, TaskGroup, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, PlusCircle, Trash2, EyeOff, Eye, X, GripVertical, Edit, Upload } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';

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
  if (diff < 0) diff += 24; // Handle overnight shifts if necessary, though unlikely for this app

  return diff;
}

export function TaskDesignatorClient() {
  const { 
    users,
    tasks, addOrUpdateTask, deleteTask, deleteAllTasks,
    taskGroups, addOrUpdateTaskGroup, deleteTaskGroup, deleteAllTaskGroups,
    confirmedHours
  } = useProduction();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  
  const employees = users.filter(u => u.role === 'employee');

  const { employeesWorkingToday, totalFTE } = useMemo(() => {
    const todaysHours = confirmedHours[dateKey];
    if (!todaysHours) return { employeesWorkingToday: [], totalFTE: 0 };
    
    const workingUserIds = Object.keys(todaysHours).filter(userId => todaysHours[userId]?.length > 0);
    const workingUsers = users.filter(user => workingUserIds.includes(user.id));

    let totalHours = 0;
    const employeesWithHours = workingUsers.map(user => {
      const hoursRanges = todaysHours[user.id] || [];
      const userTotalHours = hoursRanges.reduce((acc, range) => {
        const [start, end] = range.split('-');
        return acc + calculateHours(start, end);
      }, 0);
      totalHours += userTotalHours;

      return {
        name: user.name,
        hours: hoursRanges.join(', ')
      };
    });

    const fte = totalHours > 0 ? totalHours / 8.5 : 0;

    return { employeesWorkingToday: employeesWithHours, totalFTE: fte };
  }, [dateKey, confirmedHours, users]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Task Designation</CardTitle>
          <CardDescription>Select a day to assign tasks to employees for each production bay.</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => setSelectedDate(date || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees Working on {format(selectedDate, 'PPP')}</CardTitle>
        </CardHeader>
        <CardContent>
            {employeesWorkingToday.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                    {employeesWorkingToday.map(emp => (
                        <div key={emp.name} className="p-3 bg-muted rounded-lg">
                            <p className="font-semibold">{emp.name}</p>
                            <p className="text-sm text-muted-foreground">{emp.hours}</p>
                        </div>
                    ))}
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg max-w-sm">
                    <p className="font-bold text-blue-800 dark:text-blue-200">Scheduled FTE Employees: {totalFTE.toFixed(2)}</p>
                </div>
              </div>
            ) : (
                <p className="text-muted-foreground">No employees have confirmed hours for this day.</p>
            )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {BAYS.map(bay => (
          <BayTaskCard key={bay} bay={bay} date={selectedDate} />
        ))}
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Management</CardTitle>
          <CardDescription>Manage the lists of tasks, and pre-selected task groups.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full space-y-4">
            <EditableList title="Tasks" items={tasks} onSave={addOrUpdateTask} onDelete={deleteTask} onDeleteAll={deleteAllTasks} bulkAdd />
            <TaskGroupList 
              taskGroups={taskGroups} 
              tasks={tasks}
              onSave={addOrUpdateTaskGroup} 
              onDelete={deleteTaskGroup}
              onDeleteAll={deleteAllTaskGroups}
            />
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function BayTaskCard({ bay, date }: { bay: Bay, date: Date }) {
    const { schedule, assignments, updateAssignments, products, tasks, users, taskGroups } = useProduction();
    const employees = users.filter(u => u.role === 'employee');
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayAssignments = assignments[dateKey]?.[bay] || [];
    const daySchedule = schedule[dateKey]?.[bay] || [];
    
    const hiddenTasksCount = (dayAssignments || []).filter(a => a.hidden).length;
    const hasData = daySchedule.length > 0 || (dayAssignments && dayAssignments.length > 0);

    const handleToggleTask = (taskId: string, isChecked: boolean) => {
        let newAssignments: TaskAssignment[];
        if (isChecked) {
            const assignmentExists = (dayAssignments || []).some(a => a.taskId === taskId);
            if (!assignmentExists) {
                const newAssignment: TaskAssignment = {
                    id: `assign-${dateKey}-${bay}-${taskId}-${Date.now()}`,
                    taskId: taskId,
                    employeeIds: [],
                    hidden: false,
                };
                newAssignments = [...(dayAssignments || []), newAssignment];
            } else {
                 newAssignments = (dayAssignments || []);
            }
        } else {
            newAssignments = (dayAssignments || []).filter(a => a.taskId !== taskId);
        }
        updateAssignments(dateKey, bay, newAssignments);
    };

    const handleSelectAllTasks = () => {
        const currentAssignedTaskIds = new Set((dayAssignments || []).map(a => a.taskId));
        const newAssignmentsToAdd = tasks
            .filter(task => !currentAssignedTaskIds.has(task.id))
            .map(task => ({
                id: `assign-${dateKey}-${bay}-${task.id}-${Date.now()}`,
                taskId: task.id,
                employeeIds: [],
                hidden: false,
            }));

        const newAssignments = [...(dayAssignments || []), ...newAssignmentsToAdd];
        updateAssignments(dateKey, bay, newAssignments);
    };

    const handleSelectTaskGroup = (taskGroup: TaskGroup) => {
      const currentAssignedTaskIds = new Set((dayAssignments || []).map(a => a.taskId));
      const newAssignmentsToAdd = taskGroup.taskIds
          .filter(taskId => !currentAssignedTaskIds.has(taskId))
          .map(taskId => ({
              id: `assign-${dateKey}-${bay}-${taskId}-${Date.now()}`,
              taskId: taskId,
              employeeIds: [],
              hidden: false,
          }));
      
      const newAssignments = [...(dayAssignments || []), ...newAssignmentsToAdd];
      updateAssignments(dateKey, bay, newAssignments);
    };

    const handleRemoveAllTasks = () => {
        updateAssignments(dateKey, bay, []);
    };

    const handleUpdateAssignment = (updatedAssignment: TaskAssignment) => {
        const newAssignments = (dayAssignments || []).map(a => a.id === updatedAssignment.id ? updatedAssignment : a);
        updateAssignments(dateKey, bay, newAssignments);
    };

    const toggleVisibility = (assignmentId: string, hidden: boolean) => {
        const assignment = (dayAssignments || []).find(a => a.id === assignmentId);
        if (assignment) handleUpdateAssignment({ ...assignment, hidden });
    };

    const showAll = () => {
        const updated = (dayAssignments || []).map(a => ({...a, hidden: false}));
        updateAssignments(dateKey, bay, updated);
    }
  
    const hideAll = () => {
        const updated = (dayAssignments || []).map(a => ({...a, hidden: true}));
        updateAssignments(dateKey, bay, updated);
    }

    const handleEmployeeAssign = (assignment: TaskAssignment, employeeId: string, isChecked: boolean) => {
        let newEmployeeIds: string[];
        if (isChecked) {
            newEmployeeIds = [...assignment.employeeIds, employeeId];
        } else {
            newEmployeeIds = assignment.employeeIds.filter(id => id !== employeeId);
        }
        handleUpdateAssignment({ ...assignment, employeeIds: newEmployeeIds });
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = dayAssignments.findIndex(a => a.id === active.id);
        const newIndex = dayAssignments.findIndex(a => a.id === over.id);
        const newOrderedAssignments = arrayMove(dayAssignments, oldIndex, newIndex);
        updateAssignments(dateKey, bay, newOrderedAssignments);
      }
    };
    
    return (
        <Card 
            className={cn("flex flex-col", hasData ? BAY_COLORS[bay].base : "bg-card", hasData ? BAY_COLORS[bay].text : "")}>
            <CardHeader>
                <CardTitle className={cn("flex justify-between items-start")}>
                    <span>{bay} Bay</span>
                     <div className="text-right">
                        <Button variant="ghost" size="sm" onClick={hideAll} className={cn("h-7", hasData ? 'text-white/80 hover:text-white hover:bg-white/20' : '')}>Hide All</Button>
                        <Button variant="ghost" size="sm" onClick={showAll} className={cn("h-7", hasData ? 'text-white/80 hover:text-white hover:bg-white/20' : '')}>Show All</Button>
                        <Button variant="ghost" size="sm" onClick={handleRemoveAllTasks} className={cn("h-7", hasData ? 'text-white/80 hover:text-white hover:bg-white/20' : '')}>Remove All</Button>
                        {hiddenTasksCount > 0 && (
                            <span className={cn("text-xs block mt-1", hasData ? 'text-white/70' : 'text-muted-foreground')}>
                                {hiddenTasksCount} hidden
                            </span>
                        )}
                    </div>
                </CardTitle>
                <div className={cn("text-sm space-y-1 pt-2", hasData ? 'text-white/80' : 'text-muted-foreground')}>
                    {daySchedule.map((item: ProductionItem) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                            <div key={item.id}>
                                <span className="font-semibold">{item.batches}</span> {product?.coPacker} {product?.name || 'Unknown Product'}
                            </div>
                        )
                    })}
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className={cn(hasData ? 'bg-white/90 text-black hover:bg-white' : '')}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add/Remove Tasks
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-96 overflow-y-auto">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={handleSelectAllTasks}>
                            Select All Individual Tasks
                        </DropdownMenuItem>
                        {taskGroups.length > 0 && <DropdownMenuSeparator />}
                        {taskGroups.map(group => (
                          <DropdownMenuItem key={group.id} onSelect={() => handleSelectTaskGroup(group)}>
                            Group: {group.name}
                          </DropdownMenuItem>
                        ))}

                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Available Tasks</DropdownMenuLabel>
                        {tasks.map(task => (
                            <DropdownMenuCheckboxItem
                                key={task.id}
                                checked={(dayAssignments || []).some(a => a.taskId === task.id)}
                                onCheckedChange={(isChecked) => handleToggleTask(task.id, isChecked)}
                                onSelect={(e) => e.preventDefault()}
                            >
                                {task.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={(dayAssignments || [])} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                            {(dayAssignments || []).map(assignment => !assignment.hidden && (
                                <SortableTaskItem 
                                    key={assignment.id} 
                                    assignment={assignment} 
                                    tasks={tasks}
                                    employees={employees}
                                    onVisibilityToggle={toggleVisibility}
                                    onTaskRemove={handleToggleTask}
                                    onEmployeeAssign={handleEmployeeAssign}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </CardContent>
        </Card>
    );
}

function SortableTaskItem({
    assignment,
    tasks,
    employees,
    onVisibilityToggle,
    onTaskRemove,
    onEmployeeAssign,
} : {
    assignment: TaskAssignment,
    tasks: Task[],
    employees: User[],
    onVisibilityToggle: (id: string, hidden: boolean) => void,
    onTaskRemove: (id: string, checked: boolean) => void,
    onEmployeeAssign: (assignment: TaskAssignment, employeeId: string, isChecked: boolean) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: assignment.id });

    const style: React.CSSProperties = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="p-3 rounded-lg bg-background/80 text-foreground space-y-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <button {...listeners} className="cursor-grab p-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                 </button>
                 <h3 className="font-semibold">{tasks.find(t => t.id === assignment.taskId)?.name || 'Unknown Task'}</h3>
               </div>
               <div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => onVisibilityToggle(assignment.id, true)}><EyeOff className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70" onClick={() => onTaskRemove(assignment.taskId, false)}><Trash2 className="h-4 w-4" /></Button>
               </div>
            </div>
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-sm">Assigned Employees</h4>
                </div>
                <div className="flex flex-col gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add/Remove Employees
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                            <DropdownMenuLabel>Available Employees</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {employees.map(employee => (
                                <DropdownMenuCheckboxItem
                                    key={employee.id}
                                    checked={assignment.employeeIds.includes(employee.id)}
                                    onCheckedChange={(isChecked) => onEmployeeAssign(assignment, employee.id, isChecked)}
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    {employee.name}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex flex-wrap gap-2">
                        {assignment.employeeIds.map(empId => {
                            const employee = employees.find(e => e.id === empId);
                            return (
                                <Badge key={empId} variant="secondary" className="text-sm">
                                    {employee?.name}
                                    <button onClick={() => onEmployeeAssign(assignment, empId, false)} className="ml-1.5 text-muted-foreground hover:text-foreground">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}


function EditableList({ title, items, onSave, onDelete, onDeleteAll, bulkAdd = false }: { 
    title: string, 
    items: {id: string, name: string}[], 
    onSave: (item: {id: string, name: string}) => void, 
    onDelete: (id: string) => void,
    onDeleteAll: () => void,
    bulkAdd?: boolean 
}) {
    const [newItemName, setNewItemName] = useState('');
    
    const handleAddNew = () => {
        if (bulkAdd) {
            const newItems = newItemName.split('\n').map(name => name.trim()).filter(name => name);
            if (newItems.length > 0) {
                newItems.forEach(name => {
                    onSave({ id: `item-${Date.now()}-${Math.random()}`, name });
                });
                setNewItemName('');
            }
        } else {
            if (newItemName.trim()) {
                onSave({ id: `item-${Date.now()}`, name: newItemName.trim() });
                setNewItemName('');
            }
        }
    };
    
    return (
        <AccordionItem value={title.toLowerCase()}>
            <AccordionTrigger className="text-lg">{title}</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-2">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                            <p className="flex-grow">{item.name}</p>
                            <Button size="icon" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    ))}
                </div>
                 <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Add New {bulkAdd ? title : title.slice(0, -1)}</h4>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={items.length === 0}>Remove All</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete all {title.toLowerCase()} and remove them from any assignments.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteAll()}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex flex-col gap-2">
                        {bulkAdd ? (
                            <Textarea placeholder={`Paste a list of ${title}. Each new line is a new ${title.slice(0, -1)}.`} value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                        ) : (
                            <Input placeholder={`New ${title.slice(0, -1)} Name...`} value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddNew()} />
                        )}
                        <Button onClick={handleAddNew} className="self-start">Add New</Button>
                    </div>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

function TaskGroupList({ taskGroups, tasks, onSave, onDelete, onDeleteAll }: {
  taskGroups: TaskGroup[];
  tasks: Task[];
  onSave: (group: TaskGroup) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const [editingGroup, setEditingGroup] = useState<TaskGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newTaskGroupIds, setNewTaskGroupIds] = useState<string[]>([]);
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleStartEdit = (group: TaskGroup) => {
    setEditingGroup({ ...group });
  };
  
  const handleCancelEdit = () => {
    setEditingGroup(null);
  }

  const handleSaveEdit = () => {
    if (editingGroup && editingGroup.name.trim()) {
      onSave(editingGroup);
      setEditingGroup(null);
    }
  };
  
  const handleAddNew = () => {
    if (newGroupName.trim() && newTaskGroupIds.length > 0) {
      onSave({
        id: `group-${Date.now()}`,
        name: newGroupName.trim(),
        taskIds: newTaskGroupIds,
      });
      setNewGroupName('');
      setNewTaskGroupIds([]);
    }
  };

  const handleTaskToggle = (taskId: string, isChecked: boolean, groupStateSetter: React.Dispatch<React.SetStateAction<TaskGroup | null>> | React.Dispatch<React.SetStateAction<string[]>>) => {
      if (typeof groupStateSetter === 'function' && 'id' in (editingGroup || {})) {
          (groupStateSetter as React.Dispatch<React.SetStateAction<TaskGroup | null>>)(currentGroup => {
              if(!currentGroup) return null;
              const newTasks = isChecked ? [...currentGroup.taskIds, taskId] : currentGroup.taskIds.filter(id => id !== taskId);
              return { ...currentGroup, taskIds: newTasks };
          });
      } else {
          (groupStateSetter as React.Dispatch<React.SetStateAction<string[]>>)(currentTaskIds => {
               return isChecked ? [...currentTaskIds, taskId] : currentTaskIds.filter(id => id !== taskId);
          });
      }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

            if (jsonData.length < 2) {
                throw new Error("CSV must have a header row and at least one task row.");
            }

            const headerRow = jsonData[0];
            const groupNames = headerRow.slice(1);
            const taskNames = jsonData.slice(1).map(row => row[0]);

            const newGroups: TaskGroup[] = groupNames.map((groupName, colIndex) => {
                const taskIds: string[] = [];
                jsonData.slice(1).forEach((row, rowIndex) => {
                    if (row[colIndex + 1] && row[colIndex + 1].trim().toLowerCase() === 'x') {
                        const taskName = taskNames[rowIndex];
                        const task = tasks.find(t => t.name === taskName);
                        if (task) {
                            taskIds.push(task.id);
                        }
                    }
                });

                return {
                    id: `group-${Date.now()}-${Math.random()}`,
                    name: groupName,
                    taskIds,
                };
            });
            
            newGroups.forEach(group => {
                if (group.name && group.taskIds.length > 0) {
                    onSave(group);
                }
            });

            toast({ title: "Import Successful", description: `${newGroups.length} task groups imported.` });
        } catch (error: any) {
            console.error("Task designator group import failed:", error);
            toast({ variant: 'destructive', title: "Import Failed", description: error.message || "Could not parse the file. Please check format." });
        } finally {
             if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderTaskCheckboxes = (selectedTaskIds: string[], setter: any) => (
      <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
          {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2">
                  <input 
                      type="checkbox" 
                      id={`task-${task.id}`} 
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={e => handleTaskToggle(task.id, e.target.checked, setter)}
                  />
                  <label htmlFor={`task-${task.id}`} className="text-sm">{task.name}</label>
              </div>
          ))}
      </div>
  );

  return (
    <AccordionItem value="task-groups">
      <AccordionTrigger className="text-lg">Pre-Selected Task Groups</AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
            {taskGroups.map(group => (
                <div key={group.id} className="p-3 rounded-md bg-muted/50">
                    {editingGroup?.id === group.id ? (
                        <div className="space-y-2">
                            <Input 
                                value={editingGroup.name}
                                onChange={e => setEditingGroup({...editingGroup, name: e.target.value})}
                                placeholder="Group Name"
                            />
                            {renderTaskCheckboxes(editingGroup.taskIds, setEditingGroup)}
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-grow">
                            <p className="font-semibold">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{group.taskIds.length} tasks</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => handleStartEdit(group)}><Edit className="h-4 w-4"/></Button>
                          <Button size="icon" variant="ghost" className="text-destructive/70 hover:text-destructive" onClick={() => onDelete(group.id)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                    )}
                </div>
            ))}
        </div>
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium mb-2">Create New Task Group</h4>
          <div className="space-y-3">
              <Input
                  placeholder="New Group Name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
              />
              {renderTaskCheckboxes(newTaskGroupIds, setNewTaskGroupIds)}
              <div className="flex justify-between items-center">
                  <Button onClick={handleAddNew}>Add New Group</Button>
              </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
                <h4 className="font-medium">Import & Export</h4>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={taskGroups.length === 0}>Remove All</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete all task groups. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteAll()}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <p className="text-sm text-muted-foreground my-2">Upload a CSV where the first column lists all task names. Each subsequent column header is a group name. Place an 'X' in a cell to include that row's task in that column's group.</p>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="hidden" id="taskgroup-csv-upload" />
            <Button asChild variant="outline">
                <Label htmlFor="taskgroup-csv-upload" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload CSV File
                </Label>
            </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
