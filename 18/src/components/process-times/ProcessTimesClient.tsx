"use client";

import React, { useState, useMemo } from 'react';
import { useProduction } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Download, Upload, ChevronDown, ChevronRight, Edit, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import type { ProcessTimeEntry } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';

function ProcessRowItem({
  proc,
  onUpdate,
  onDelete,
}: {
  proc: ProcessTimeEntry;
  onUpdate: (id: string, updates: Partial<ProcessTimeEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [name, setName] = useState<string>(proc.processName);
  const [minEmployees, setMinEmployees] = useState<string>(proc.minEmployees);
  const [minRate, setMinRate] = useState<string>(proc.minRate);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);

  const handleSave = () => {
    onUpdate(proc.id, {
      processName: name,
      minEmployees,
      minRate,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setName(proc.processName);
    setMinEmployees(proc.minEmployees);
    setMinRate(proc.minRate);
    setIsEditing(false);
  };

  return (
    <div className="border border-zinc-800 rounded-lg bg-zinc-950/60 overflow-hidden transition-all">
      {/* Header Row: Collapsible Arrow | Process Name | Edit | Delete */}
      <div className="flex items-center justify-between p-3 gap-3 bg-zinc-900/60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>

          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Process name..."
              className="h-8 text-sm bg-zinc-900 border-zinc-700 max-w-md"
            />
          ) : (
            <span
              className="font-semibold text-sm text-zinc-100 truncate cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {proc.processName || <span className="italic text-zinc-500">Unnamed Process</span>}
            </span>
          )}
        </div>

        {/* Action Buttons: Edit & Delete */}
        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-zinc-400 hover:text-white"
                onClick={handleCancelEdit}
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              onClick={() => {
                setIsEditing(true);
                setIsExpanded(true);
              }}
            >
              <Edit className="h-3.5 w-3.5 text-sky-400" />
              <span>Edit</span>
            </Button>
          )}

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete process "{proc.processName || 'Unnamed Process'}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => onDelete(proc.id)}
                >
                  Yes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Expanded Content: Min Employees Desired & Minimum Individual Rate */}
      {isExpanded && (
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/90 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-400">Minimum # Employees Desired:</Label>
            {isEditing ? (
              <Input
                value={minEmployees}
                onChange={(e) => setMinEmployees(e.target.value)}
                placeholder="e.g. 4"
                className="h-8 text-xs bg-zinc-900 border-zinc-700"
              />
            ) : (
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 font-mono text-emerald-400 font-semibold">
                {proc.minEmployees ? `${proc.minEmployees} employees` : <span className="text-zinc-600 italic">Not set</span>}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-400">Minimum Individual Employee Rate:</Label>
            {isEditing ? (
              <Input
                value={minRate}
                onChange={(e) => setMinRate(e.target.value)}
                placeholder="e.g. 150 units/hr"
                className="h-8 text-xs bg-zinc-900 border-zinc-700"
              />
            ) : (
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 font-mono text-emerald-400 font-semibold">
                {proc.minRate ? proc.minRate : <span className="text-zinc-600 italic">Not set</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProcessTimesClient() {
  const { products, processTimes, addOrUpdateProcessTime, deleteProcessTime, bulkAddProcessTimes } = useProduction();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const { toast } = useToast();
  const importRef = React.useRef<HTMLInputElement>(null);

  const clients = useMemo(() => {
    const uniqueClients = new Set(products.map(p => p.coPacker));
    return Array.from(uniqueClients).sort();
  }, [products]);

  const filteredProcesses = useMemo(() => {
    return processTimes.filter(p => p.clientId === selectedClient);
  }, [processTimes, selectedClient]);

  const handleAddRow = () => {
    if (!selectedClient) {
      toast({ variant: 'destructive', title: "No client selected", description: "Please select a client before adding a process." });
      return;
    }
    const newEntry: ProcessTimeEntry = {
      id: `proc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientId: selectedClient,
      processName: '',
      minEmployees: '',
      minRate: ''
    };
    addOrUpdateProcessTime(newEntry);
  };

  const handleUpdate = (id: string, updates: Partial<ProcessTimeEntry>) => {
    const entry = processTimes.find(e => e.id === id);
    if (entry) {
      addOrUpdateProcessTime({ ...entry, ...updates });
      toast({ title: "Updated", description: "Process time details updated." });
    }
  };

  const handleExport = () => {
    if (processTimes.length === 0) {
      toast({ variant: 'destructive', title: "No data to export" });
      return;
    }
    const data = processTimes.map(e => ({
      'Client Name': e.clientId,
      'Process Name': e.processName,
      'Min Employees Required': e.minEmployees,
      'Min Individual Rate': e.minRate
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Process Times");
    XLSX.writeFile(wb, "Process_Times_Data.xlsx");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];

        const entries: ProcessTimeEntry[] = json.map((row, index) => {
          const client = row['Client Name'] || row['client name'];
          const name = row['Process Name'] || row['process name'];
          const minEmp = row['Min Employees Required'] || row['min employees required'];
          const minRate = row['Min Individual Rate'] || row['min individual rate'];

          if (!client || !name) throw new Error(`Invalid data at row ${index + 2}`);

          return {
            id: `proc-${Date.now()}-${index}-${Math.random()}`,
            clientId: client,
            processName: name,
            minEmployees: String(minEmp || ''),
            minRate: String(minRate || '')
          };
        });

        bulkAddProcessTimes(entries);
        toast({ title: "Import Successful", description: `${entries.length} processes added.` });
      } catch (err: any) {
        console.error("Process times import failed:", err);
        toast({ variant: 'destructive', title: "Import Failed", description: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
    if (importRef.current) importRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-muted/30">
          <CardTitle>Instructions</CardTitle>
          <CardDescription className="text-foreground font-medium">
            Managers at Made4U Foods, please use clean timers from the dishwashing area to time employees during production/packaging processes. Confirm we are keeping a good pace throughout the day against these process rates below.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <CardTitle>Process Times</CardTitle>
              <CardDescription>View and manage performance standards for each co-packer's processes.</CardDescription>
            </div>
            <div className="w-64">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Co-Packer" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedClient ? (
            <div className="space-y-3">
              {filteredProcesses.length > 0 ? (
                <div className="space-y-2">
                  {filteredProcesses.map(proc => (
                    <ProcessRowItem
                      key={proc.id}
                      proc={proc}
                      onUpdate={handleUpdate}
                      onDelete={deleteProcessTime}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground border border-dashed rounded-lg">
                  No process times saved for {selectedClient} yet. Click "Add Process" below.
                </div>
              )}

              <Button onClick={handleAddRow} className="w-full mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Process
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              Please select a client to view their process times.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import/Export All Data</CardTitle>
          <CardDescription>Manage all process time standards via CSV file.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <input type="file" ref={importRef} onChange={handleImport} className="hidden" accept=".xlsx,.csv" />
          <Button onClick={() => importRef.current?.click()} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
