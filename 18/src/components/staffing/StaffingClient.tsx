

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useProduction } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as CalendarIcon, PlusCircle, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import type { AvailabilitySlot } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const generateTimeSlots = () => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hour = h.toString().padStart(2, '0');
            const minute = m.toString().padStart(2, '0');
            const time = `${hour}:${minute}`;
            const date = new Date(`1970-01-01T${time}:00`);
            const formattedTime = format(date, 'h:mm a');
            slots.push(formattedTime);
        }
    }
    return slots;
};

const timeSlots = generateTimeSlots();

export function StaffingClient() {
  const { userId, availability, setEmployeeAvailability, confirmedHours } = useProduction();
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 7));
  
  const week = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
    const end = addDays(start, 6);
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);
  
  if (!userId) {
    return <div>Loading...</div>; // Or a more appropriate loading state
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>My Weekly Staffing</CardTitle>
              <CardDescription>
                Select a week to submit your availability and view your confirmed hours.
              </CardDescription>
            </div>
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
                  {selectedDate ? `Week of ${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'PPP')}` : <span>Pick a date</span>}
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
          </div>
        </CardHeader>
      </Card>
      
      <DuplicateHoursSection userId={userId} setEmployeeAvailability={setEmployeeAvailability} />

      <Card>
        <CardHeader>
          <CardTitle>My Availability</CardTitle>
          <CardDescription>Submit your available time slots for the selected week.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {week.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAvailability = availability[dateKey]?.[userId] || [];

            return (
              <DayAvailabilityCard 
                key={day.toISOString()}
                day={day}
                userId={userId}
                dayAvailability={dayAvailability}
                setEmployeeAvailability={setEmployeeAvailability}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Confirmed Hours</CardTitle>
          <CardDescription>View your confirmed work schedule for the selected week.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {week.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayConfirmedHours = confirmedHours[dateKey]?.[userId] || [];
              return (
                  <Card key={day.toISOString()} className="p-4">
                      <h4 className="font-semibold">{format(day, 'EEEE, MMM d')}</h4>
                      <Separator className="my-2" />
                      {dayConfirmedHours.length > 0 ? (
                        <div className="space-y-2">
                            {dayConfirmedHours.map((hours, index) => (
                                <Badge key={index} className="text-base py-1 px-3">{hours}</Badge>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No hours confirmed for this day.</p>
                      )}
                  </Card>
              )
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function DuplicateHoursSection({ userId, setEmployeeAvailability }: { 
  userId: string, 
  setEmployeeAvailability: (userId: string, date: string, slots: { start: string, end: string }[]) => void 
}) {
  const [newSlot, setNewSlot] = useState({ start: '', end: '' });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>([]);
  const { availability } = useProduction();
  const { toast } = useToast();

  const handleDuplicate = () => {
    if (!newSlot.start || !newSlot.end) {
      toast({ variant: 'destructive', title: "Missing Time", description: "Please select a start and end time to duplicate." });
      return;
    }
    if (!selectedDates || selectedDates.length === 0) {
      toast({ variant: 'destructive', title: "No Dates Selected", description: "Please select one or more dates from the calendar." });
      return;
    }

    selectedDates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayAvailability = availability[dateKey]?.[userId] || [];
      const updatedSlots = [...dayAvailability, newSlot];
      setEmployeeAvailability(userId, dateKey, updatedSlots);
    });

    toast({ title: "Hours Duplicated", description: `Availability added for ${selectedDates.length} day(s).` });
    setSelectedDates([]);
    setNewSlot({ start: '', end: '' });
    setIsCalendarOpen(false);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Duplicate Hours</CardTitle>
        <CardDescription>Quickly add the same time slot to multiple days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
            <Select value={newSlot.start} onValueChange={(val) => setNewSlot(prev => ({ ...prev, start: val }))}>
                <SelectTrigger><SelectValue placeholder="Start Time" /></SelectTrigger>
                <SelectContent>
                    {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={newSlot.end} onValueChange={(val) => setNewSlot(prev => ({ ...prev, end: val }))}>
                <SelectTrigger><SelectValue placeholder="End Time" /></SelectTrigger>
                <SelectContent>
                    {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
                <Button variant="default" className="w-full">Duplicate Hours</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={setSelectedDates}
                    initialFocus
                />
                <div className="p-2 border-t">
                    <Button onClick={handleDuplicate} className="w-full" size="sm">Save to {selectedDates?.length || 0} days</Button>
                </div>
            </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  )
}

function DayAvailabilityCard({ day, userId, dayAvailability, setEmployeeAvailability }: {
  day: Date,
  userId: string,
  dayAvailability: AvailabilitySlot[],
  setEmployeeAvailability: (userId: string, date: string, slots: { start: string, end: string }[]) => void,
}) {
  const { hrNotes, setEmployeeHrNote } = useProduction();
  const dateKey = format(day, 'yyyy-MM-dd');
  const editableSlots = dayAvailability.filter(s => !s.confirmed);
  const confirmedSlots = dayAvailability.filter(s => s.confirmed);
  const [newSlot, setNewSlot] = useState({ start: '', end: '' });

  const existingNote = hrNotes[dateKey]?.[userId] || '';
  const [noteText, setNoteText] = useState(existingNote);

  useEffect(() => {
    setNoteText(hrNotes[dateKey]?.[userId] || '');
  }, [hrNotes, dateKey, userId]);

  const handleAddSlot = () => {
    if (newSlot.start && newSlot.end) {
      const updatedSlots = [...editableSlots, newSlot];
      setEmployeeAvailability(userId, dateKey, updatedSlots);
      setNewSlot({ start: '', end: '' });
    }
  };

  const handleRemoveSlot = (indexToRemove: number) => {
    const updatedSlots = editableSlots.filter((_, index) => index !== indexToRemove);
    setEmployeeAvailability(userId, dateKey, updatedSlots);
  };

  return (
    <Card className="p-4 flex flex-col">
      <h4 className="font-semibold">{format(day, 'EEEE, MMM d')}</h4>
      <Separator className="my-2" />
      <div className="flex-grow space-y-3">
          {confirmedSlots.map((slot, index) => (
              <div key={`conf-${index}`} className="flex items-center justify-center gap-2 p-2 bg-green-100 rounded-md">
                <span className="font-medium text-sm text-green-800">CONFIRMED: {slot.start} - {slot.end}</span>
              </div>
          ))}
          {editableSlots.map((slot, index) => (
            <div key={index} className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md">
              <span className="font-medium text-sm">{slot.start} - {slot.end}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/80 hover:text-destructive" onClick={() => handleRemoveSlot(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>
      <div className="mt-4 pt-4 border-t space-y-2">
        <div className="flex gap-2">
          <Select value={newSlot.start} onValueChange={(val) => setNewSlot(prev => ({ ...prev, start: val }))}>
            <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
            <SelectContent>
              {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={newSlot.end} onValueChange={(val) => setNewSlot(prev => ({ ...prev, end: val }))}>
            <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
            <SelectContent>
              {timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddSlot} size="sm" className="w-full"><PlusCircle className="mr-2 h-4 w-4"/> Add Hours</Button>

        {/* Notes for HR Section */}
        <div className="mt-3 pt-3 border-t space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-amber-600" /> Notes for HR
          </Label>
          <Textarea
            placeholder="Add note for HR for this day..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={() => setEmployeeHrNote(userId, dateKey, noteText)}
            className="text-xs min-h-[55px] resize-none focus-visible:ring-amber-500"
          />
        </div>
      </div>
    </Card>
  );
}
