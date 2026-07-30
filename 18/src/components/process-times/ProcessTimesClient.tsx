
"use client";

import React, { useState, useMemo } from 'react';
import { useProduction } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import type { ProcessTimeEntry } from '@/lib/types';

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
      id: `proc-${Date.now()}-${Math.random()}`,
      clientId: selectedClient,
      processName: '',
      minEmployees: '',
      minRate: ''
    };
    addOrUpdateProcessTime(newEntry);
  };

  const handleUpdate = (id: string, field: keyof ProcessTimeEntry, value: string) => {
    const entry = processTimes.find(e => e.id === id);
    if (entry) {
      addOrUpdateProcessTime({ ...entry, [field]: value });
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
          <div className="flex justify-between items-center">
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
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process Name</TableHead>
                    <TableHead className="w-64">Minimum # Employees Desired</TableHead>
                    <TableHead className="w-64">Minimum Individual Employee Rate</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.map(proc => (
                    <TableRow key={proc.id}>
                      <TableCell>
                        <Input
                          value={proc.processName}
                          onChange={(e) => handleUpdate(proc.id, 'processName', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={proc.minEmployees}
                          onChange={(e) => handleUpdate(proc.id, 'minEmployees', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={proc.minRate}
                          onChange={(e) => handleUpdate(proc.id, 'minRate', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteProcessTime(proc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button onClick={handleAddRow} className="w-full">
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
