
"use client";

import React, { useState, useEffect } from 'react';
import { useProduction } from '@/lib/store';
import type { User, UserPrivileges } from '@/lib/types';
import { getDefaultPrivileges } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Download, Upload, Shield, Save, DownloadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';

export function ManageUsersClient() {
    const { 
        users, addOrUpdateUser, deleteUser, deleteAllUsers,
        products, schedule, prepSteps, shoppingList, registeredShoppingItems,
        palletStorage, processTimes, managementNotes, machinery, calendarNotes, confirmedHours 
    } = useProduction();
    const [newUser, setNewUser] = useState<Omit<User, 'id'>>({ name: '', pin: '', role: 'employee' });
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // Privileges state
    const [selectedPrivilegeUserId, setSelectedPrivilegeUserId] = useState<string>('');
    const [userPrivileges, setUserPrivileges] = useState<UserPrivileges>({});

    const selectedUser = users.find(u => u.id === selectedPrivilegeUserId);

    useEffect(() => {
        if (!selectedPrivilegeUserId && users.length > 0) {
            setSelectedPrivilegeUserId(users[0].id);
        }
    }, [users, selectedPrivilegeUserId]);

    useEffect(() => {
        if (selectedUser) {
            setUserPrivileges({
                ...getDefaultPrivileges(selectedUser.role, selectedUser.name),
                ...(selectedUser.privileges || {})
            });
        }
    }, [selectedUser]);

    const handleSavePrivileges = () => {
        if (!selectedUser) return;
        addOrUpdateUser({
            ...selectedUser,
            privileges: userPrivileges,
        });
        toast({
            title: "Privileges Saved",
            description: `User privileges for "${selectedUser.name}" have been updated successfully.`,
        });
    };

    const togglePrivilegeKey = (key: keyof UserPrivileges, value?: any) => {
        setUserPrivileges(prev => {
            if (typeof value !== 'undefined') {
                return { ...prev, [key]: value };
            }
            return { ...prev, [key]: !prev[key] };
        });
    };

    const handleAddNewUser = () => {
        if (newUser.name.trim() && newUser.pin.length === 6) {
            addOrUpdateUser({ ...newUser, id: `user-${Date.now()}` });
            setNewUser({ name: '', pin: '', role: 'employee' });
        } else {
            toast({ variant: 'destructive', title: "Validation Error", description: "Name cannot be empty and PIN must be 6 digits." });
        }
    };

    const handleUpdateUser = (id: string, key: keyof User, value: any) => {
        const userToUpdate = users.find(u => u.id === id);
        if (userToUpdate) {
            addOrUpdateUser({ ...userToUpdate, [key]: value });
        }
    };
    
    const exportToCSV = () => {
        const dataToExport = users.map(u => ({ Name: u.name, PIN: u.pin, Role: u.role }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
        XLSX.writeFile(workbook, "Made4U_Users.xlsx");
        toast({ title: 'Export Successful', description: 'User data has been downloaded.' });
    };

    const handleBackupAllData = async () => {
        try {
            const escapeCsv = (str: any) => {
                if (str === null || str === undefined) return '';
                const stringified = String(str);
                if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
                    return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
            };

            const zip = new JSZip();

            // 1. Products.csv
            const productLines = ['name,coPacker,coPackerColor,allergens,targetDepositWeight,targetFinishedWeight,batchSizeLbs,yieldPerBatch,batchesPricedFor1BayDay,ftesPricedFor1BayDay'];
            (products || []).forEach(p => {
                productLines.push([
                    escapeCsv(p.name),
                    escapeCsv(p.coPacker),
                    escapeCsv(p.coPackerColor),
                    escapeCsv(p.allergens),
                    escapeCsv(p.targetDepositWeight),
                    escapeCsv(p.targetFinishedWeight),
                    escapeCsv(p.batchSizeLbs),
                    escapeCsv(p.yieldPerBatch),
                    escapeCsv(p.batchesPricedFor1BayDay),
                    escapeCsv(p.ftesPricedFor1BayDay),
                ].join(','));
            });
            zip.file('Products.csv', productLines.join('\r\n'));

            // 2. ProductionSchedule.csv
            const scheduleLines = ['date,bay,productName,batches,calendarNote,ScheduledFTEs excluding Lehn family,totalFTEs,timeLeftBuilding'];

            const calculateHours = (startStr: string, endStr: string) => {
                const parseTime = (t: string) => {
                    const match = t.trim().match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
                    if (!match) return 0;
                    let hrs = parseInt(match[1], 10);
                    const mins = parseInt(match[2] || '0', 10);
                    const period = match[3]?.toLowerCase();
                    if (period === 'pm' && hrs < 12) hrs += 12;
                    if (period === 'am' && hrs === 12) hrs = 0;
                    return hrs + mins / 60;
                };
                const hStart = parseTime(startStr);
                const hEnd = parseTime(endStr);
                return hEnd > hStart ? (hEnd - hStart) : 0;
            };

            Object.entries(schedule || {}).forEach(([dateKey, dayProd]) => {
                if (!dayProd) return;

                const noteObj = (calendarNotes || {})[dateKey] || {};
                const dayNote = noteObj.note || '';
                const dayTimeLeft = noteObj.timeLeftBuilding || '';

                let totalNonLehnHours = 0;
                try {
                    const dayConfirmedHours = (confirmedHours || {})[dateKey] || {};
                    const workingUserIds = Object.keys(dayConfirmedHours).filter(id => (dayConfirmedHours[id] || []).length > 0);
                    const nonLehnUsers = (users || []).filter(u => workingUserIds.includes(u.id) && !u.name.toLowerCase().includes('lehn'));

                    nonLehnUsers.forEach(u => {
                        const ranges = dayConfirmedHours[u.id] || [];
                        ranges.forEach(range => {
                            const [start, end] = range.split('-');
                            if (start && end) {
                                totalNonLehnHours += calculateHours(start, end);
                            }
                        });
                    });
                } catch (e) {
                    console.error("FTE calc error:", e);
                }

                const scheduledFTEsExcludingLehnStr = totalNonLehnHours > 0 ? (totalNonLehnHours / 8.5).toFixed(2) : '0';

                let dayTotalRequiredFTEs = 0;
                Object.values(dayProd).flat().forEach(item => {
                    const prod = (products || []).find(p => p.id === item.productId);
                    if (prod) {
                        const batchesPriced = parseFloat(prod.batchesPricedFor1BayDay || '0');
                        const ftesPriced = parseFloat(prod.ftesPricedFor1BayDay || '0');
                        const batchesToday = parseFloat(item.batches || '0');
                        if (batchesPriced > 0) {
                            dayTotalRequiredFTEs += (batchesToday / batchesPriced) * ftesPriced;
                        }
                    }
                });
                const totalFTEsStr = dayTotalRequiredFTEs > 0 ? dayTotalRequiredFTEs.toFixed(2) : '0';

                Object.entries(dayProd).forEach(([bay, items]) => {
                    (items || []).forEach(item => {
                        const prod = (products || []).find(p => p.id === item.productId);
                        scheduleLines.push([
                            escapeCsv(dateKey),
                            escapeCsv(bay),
                            escapeCsv(prod?.name || item.productId),
                            escapeCsv(item.batches),
                            escapeCsv(dayNote),
                            escapeCsv(scheduledFTEsExcludingLehnStr),
                            escapeCsv(totalFTEsStr),
                            escapeCsv(dayTimeLeft),
                        ].join(','));
                    });
                });
            });
            zip.file('ProductionSchedule.csv', scheduleLines.join('\r\n'));

            // 3. PrepSteps.csv
            const prepLines = ['name,daysInAdvance,products'];
            (prepSteps || []).forEach(step => {
                const prodNames = (step.productIds || []).map(id => products.find(p => p.id === id)?.name || id).join(';');
                prepLines.push([
                    escapeCsv(step.name),
                    escapeCsv(step.daysInAdvance),
                    escapeCsv(prodNames),
                ].join(','));
            });
            zip.file('PrepSteps.csv', prepLines.join('\r\n'));

            // 4. StaffUsers.csv
            const userLines = ['name,role,pin'];
            (users || []).forEach(u => {
                userLines.push([
                    escapeCsv(u.name),
                    escapeCsv(u.role),
                    escapeCsv(u.pin),
                ].join(','));
            });
            zip.file('StaffUsers.csv', userLines.join('\r\n'));

            // 5. ShoppingList.csv
            const shopLines = ['name,category,supplier,quantity,needDeliveredBy,ordered,expectedDeliveryDate'];
            (shoppingList || []).forEach(s => {
                shopLines.push([
                    escapeCsv(s.name),
                    escapeCsv(s.category),
                    escapeCsv(s.supplier),
                    escapeCsv(s.quantity),
                    escapeCsv(s.needDeliveredBy),
                    escapeCsv(s.ordered),
                    escapeCsv(s.expectedDeliveryDate),
                ].join(','));
            });
            zip.file('ShoppingList.csv', shopLines.join('\r\n'));

            // 6. RegisteredShoppingItems.csv
            const regLines = ['name,category,supplier,leadTime'];
            (registeredShoppingItems || []).forEach((r: any) => {
                regLines.push([
                    escapeCsv(r.name),
                    escapeCsv(r.category),
                    escapeCsv(r.supplier),
                    escapeCsv(r.leadTime),
                ].join(','));
            });
            zip.file('RegisteredShoppingItems.csv', regLines.join('\r\n'));

            // 7. PalletStorage.csv
            const palletLines = ['clientId,weekKey,dryPallets,tallDryPallets,frozenPallets,tallFrozenPallets,rebuilds'];
            (palletStorage || []).forEach(p => {
                palletLines.push([
                    escapeCsv(p.clientId),
                    escapeCsv(p.weekKey),
                    escapeCsv(p.dryPallets),
                    escapeCsv(p.tallDryPallets),
                    escapeCsv(p.frozenPallets),
                    escapeCsv(p.tallFrozenPallets),
                    escapeCsv(p.rebuilds),
                ].join(','));
            });
            zip.file('PalletStorage.csv', palletLines.join('\r\n'));

            // 8. ProcessTimes.csv
            const processLines = ['clientId,processName,minEmployees,minRate'];
            (processTimes || []).forEach(pt => {
                processLines.push([
                    escapeCsv(pt.clientId),
                    escapeCsv(pt.processName),
                    escapeCsv(pt.minEmployees),
                    escapeCsv(pt.minRate),
                ].join(','));
            });
            zip.file('ProcessTimes.csv', processLines.join('\r\n'));

            // 9. ManagementNotes.csv
            const mgtLines = ['subject,date,authorName,body'];
            (managementNotes || []).forEach(m => {
                mgtLines.push([
                    escapeCsv(m.subject),
                    escapeCsv(m.date),
                    escapeCsv(m.authorName),
                    escapeCsv(m.body),
                ].join(','));
            });
            zip.file('ManagementNotes.csv', mgtLines.join('\r\n'));

            // 10. Machinery.csv
            const macLines = ['name,quantity'];
            (machinery || []).forEach(m => {
                macLines.push([
                    escapeCsv(m.name),
                    escapeCsv(m.quantity),
                ].join(','));
            });
            zip.file('Machinery.csv', macLines.join('\r\n'));

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Made4U_Full_Backup_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
                title: "Backup Downloaded",
                description: "Downloaded ZIP archive containing CSV backups for all system data categories.",
            });
        } catch (err: any) {
            console.error("Backup failed:", err);
            toast({
                variant: "destructive",
                title: "Backup Failed",
                description: err.message || "Failed to generate backup zip file.",
            });
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (!json || json.length === 0) {
                    toast({ variant: 'destructive', title: "Import Failed", description: "The uploaded file is empty or formatted incorrectly." });
                    return;
                }

                const importedUsers: Omit<User, 'id'>[] = [];
                const errors: string[] = [];

                json.forEach((row, index) => {
                    const name = row['Name'] || row['name'];
                    const pin = String(row['PIN'] || row['pin'] || '').trim();
                    let role = String(row['Role'] || row['role'] || 'employee').toLowerCase().trim();

                    if (!['admin', 'employee', 'bank', 'miffy'].includes(role)) {
                        role = 'employee';
                    }

                    if (name && pin && pin.length === 6) {
                        importedUsers.push({ name: String(name).trim(), pin, role: role as any });
                    } else {
                        errors.push(`Row ${index + 2}: Invalid Name or PIN (PIN must be 6 digits)`);
                    }
                });

                if (importedUsers.length > 0) {
                    for (const u of importedUsers) {
                        const existingUser = users.find(ex => ex.name.toLowerCase() === u.name.toLowerCase());
                        const user: User = {
                            ...u,
                            id: existingUser ? existingUser.id : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
                        };
                        await addOrUpdateUser(user);
                    }
                    
                    if (errors.length > 0) {
                        toast({ 
                            title: "Import Complete", 
                            description: `${importedUsers.length} users updated. ${errors.length} rows skipped.` 
                        });
                    } else {
                        toast({ title: "Import Successful", description: `${importedUsers.length} users updated.` });
                    }
                } else {
                    toast({ variant: 'destructive', title: "Import Failed", description: "No valid users found in file." });
                }

            } catch (error: any) {
                console.error("User import failed:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-6">
            {/* System Data Backup Action Card */}
            <Card className="border-emerald-500/40 bg-emerald-950/20 shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2 text-emerald-400">
                            <DownloadCloud className="h-5 w-5 text-emerald-400" />
                            System Data Backup
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground max-w-2xl">
                            Download a full ZIP archive containing structured CSV files for all production schedules, products, prep steps, shopping lists, users, pallet storage, process times, and notes.
                        </CardDescription>
                    </div>
                    <Button onClick={handleBackupAllData} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md whitespace-nowrap">
                        <DownloadCloud className="h-4 w-4" />
                        Backup All Data
                    </Button>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>User Settings / Backup</CardTitle>
                    <CardDescription>Add, remove, and manage user roles, PINs, and system backups.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>6-Digit PIN</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <Input 
                                            value={user.name} 
                                            onChange={(e) => handleUpdateUser(user.id, 'name', e.target.value)}
                                            className="font-medium"
                                            disabled={user.id === 'user-1'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input 
                                            value={user.pin} 
                                            onChange={(e) => handleUpdateUser(user.id, 'pin', e.target.value)}
                                            maxLength={6}
                                            disabled={user.id === 'user-1'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select value={user.role} onValueChange={(value) => handleUpdateUser(user.id, 'role', value)} disabled={user.id === 'user-1'}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="employee">Employee</SelectItem>
                                                <SelectItem value="bank">Bank</SelectItem>
                                                <SelectItem value="miffy">Miffy</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive" disabled={user.id === 'user-1'}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete user &quot;{user.name}&quot;? This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>No</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteUser(user.id)}>Yes</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add New User */}
            <Card>
                <CardHeader>
                    <CardTitle>Add New User</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input 
                            placeholder="Name" 
                            value={newUser.name} 
                            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        />
                        <Input 
                            placeholder="6-Digit PIN" 
                            value={newUser.pin} 
                            onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                            maxLength={6}
                        />
                        <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="bank">Bank</SelectItem>
                                <SelectItem value="miffy">Miffy</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAddNewUser} className="gap-2">
                        <PlusCircle className="h-4 w-4" /> Add User
                    </Button>
                </CardContent>
            </Card>

            {/* Bulk User Tools */}
            <Card>
                <CardHeader>
                    <CardTitle>Bulk User Tools</CardTitle>
                    <CardDescription>Export current users to Excel or import users from an Excel/CSV file.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    <Button variant="outline" onClick={exportToCSV} className="gap-2">
                        <Download className="h-4 w-4" /> Export Users to Excel
                    </Button>

                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileImport} 
                        accept=".xlsx, .xls, .csv" 
                        className="hidden" 
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <Upload className="h-4 w-4" /> Import Users from File
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="gap-2 ml-auto">
                                <Trash2 className="h-4 w-4" /> Delete All Users
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete All Users?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will remove all users except the default Admin user. Are you sure you want to proceed?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={deleteAllUsers}>Yes, Delete All</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            {/* User Privileges Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        User Privileges (Granular Access Controls)
                    </CardTitle>
                    <CardDescription>
                        Select a user to customize which sidebar navigation links and tools they are allowed to access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="max-w-md space-y-2">
                        <Label className="text-sm font-medium">Select User</Label>
                        <Select value={selectedPrivilegeUserId} onValueChange={setSelectedPrivilegeUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a user..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.name} ({u.role.toUpperCase()})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedUser && (
                        <div className="space-y-6 border rounded-lg p-4 bg-muted/20">
                            <div className="text-sm font-semibold text-foreground pb-2 border-b">
                                Access Control Menu for <span className="text-primary">{selectedUser.name}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Search App Data */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-search" 
                                        checked={!!userPrivileges.searchAppData} 
                                        onCheckedChange={() => togglePrivilegeKey('searchAppData')} 
                                    />
                                    <Label htmlFor="priv-search" className="cursor-pointer font-medium">Search App Data</Label>
                                </div>

                                {/* Management Notes */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-mnotes" 
                                        checked={!!userPrivileges.managementNotes} 
                                        onCheckedChange={() => togglePrivilegeKey('managementNotes')} 
                                    />
                                    <Label htmlFor="priv-mnotes" className="cursor-pointer font-medium">Management Notes</Label>
                                </div>

                                {/* Adjust Production Calendar */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-adj-cal" 
                                        checked={!!userPrivileges.adjustProductionCalendar} 
                                        onCheckedChange={() => togglePrivilegeKey('adjustProductionCalendar')} 
                                    />
                                    <Label htmlFor="priv-adj-cal" className="cursor-pointer font-medium">Adjust Production Calendar</Label>
                                </div>

                                {/* View Production Calendar with Sub-checkboxes */}
                                <div className="space-y-3 md:col-span-2 border p-3 rounded-md bg-background">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox 
                                            id="priv-view-cal" 
                                            checked={!!userPrivileges.viewProductionCalendar} 
                                            onCheckedChange={() => togglePrivilegeKey('viewProductionCalendar')} 
                                        />
                                        <Label htmlFor="priv-view-cal" className="cursor-pointer font-semibold text-primary">View Production Calendar</Label>
                                    </div>

                                    {/* Sub Checkboxes */}
                                    <div className="ml-7 pl-4 border-l-2 border-primary/30 space-y-3 pt-1">
                                        <div className="flex items-center space-x-3">
                                            <Checkbox 
                                                id="priv-bay-days" 
                                                checked={!!userPrivileges.viewCalendarBayDaysTop} 
                                                onCheckedChange={() => togglePrivilegeKey('viewCalendarBayDaysTop')} 
                                                disabled={!userPrivileges.viewProductionCalendar}
                                            />
                                            <Label htmlFor="priv-bay-days" className="cursor-pointer text-sm font-medium">
                                                Show Bay Days on Top of View Calendar
                                            </Label>
                                        </div>

                                        <div className="space-y-2 pt-1">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Access Scope</Label>
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id="priv-client-all" 
                                                        checked={userPrivileges.clientAccess === 'all'} 
                                                        onCheckedChange={() => togglePrivilegeKey('clientAccess', 'all')} 
                                                        disabled={!userPrivileges.viewProductionCalendar}
                                                    />
                                                    <Label htmlFor="priv-client-all" className="cursor-pointer text-sm">Client Access: All</Label>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id="priv-client-miffy" 
                                                        checked={userPrivileges.clientAccess === 'miffy'} 
                                                        onCheckedChange={() => togglePrivilegeKey('clientAccess', 'miffy')} 
                                                        disabled={!userPrivileges.viewProductionCalendar}
                                                    />
                                                    <Label htmlFor="priv-client-miffy" className="cursor-pointer text-sm">Client Access: Miffy&apos;s</Label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Task Designator */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-tasks" 
                                        checked={!!userPrivileges.taskDesignator} 
                                        onCheckedChange={() => togglePrivilegeKey('taskDesignator')} 
                                    />
                                    <Label htmlFor="priv-tasks" className="cursor-pointer font-medium">Task Designator</Label>
                                </div>

                                {/* Assigned Tasks */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-assigned" 
                                        checked={!!userPrivileges.assignedTasks} 
                                        onCheckedChange={() => togglePrivilegeKey('assignedTasks')} 
                                    />
                                    <Label htmlFor="priv-assigned" className="cursor-pointer font-medium">Assigned Tasks</Label>
                                </div>

                                {/* User Settings / Backup Access */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-manage-users" 
                                        checked={!!userPrivileges.manageUsers} 
                                        onCheckedChange={() => togglePrivilegeKey('manageUsers')} 
                                    />
                                    <Label htmlFor="priv-manage-users" className="cursor-pointer font-medium">User Settings / Backup</Label>
                                </div>

                                {/* Admin Staffing */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-admin-staffing" 
                                        checked={!!userPrivileges.adminStaffing} 
                                        onCheckedChange={() => togglePrivilegeKey('adminStaffing')} 
                                    />
                                    <Label htmlFor="priv-admin-staffing" className="cursor-pointer font-medium">Admin Staffing</Label>
                                </div>

                                {/* Staffing */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-emp-staffing" 
                                        checked={!!userPrivileges.employeeStaffing} 
                                        onCheckedChange={() => togglePrivilegeKey('employeeStaffing')} 
                                    />
                                    <Label htmlFor="priv-emp-staffing" className="cursor-pointer font-medium">Staffing</Label>
                                </div>

                                {/* Facility Shopping List */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-shopping" 
                                        checked={!!userPrivileges.facilityShoppingList} 
                                        onCheckedChange={() => togglePrivilegeKey('facilityShoppingList')} 
                                    />
                                    <Label htmlFor="priv-shopping" className="cursor-pointer font-medium">Facility Shopping List</Label>
                                </div>

                                {/* Pallet Storage */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-pallet" 
                                        checked={!!userPrivileges.palletStorage} 
                                        onCheckedChange={() => togglePrivilegeKey('palletStorage')} 
                                    />
                                    <Label htmlFor="priv-pallet" className="cursor-pointer font-medium">Pallet Storage</Label>
                                </div>

                                {/* Time for a Process */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-process-times" 
                                        checked={!!userPrivileges.timeForAProcess} 
                                        onCheckedChange={() => togglePrivilegeKey('timeForAProcess')} 
                                    />
                                    <Label htmlFor="priv-process-times" className="cursor-pointer font-medium">Time for a Process</Label>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex justify-end">
                                <Button onClick={handleSavePrivileges} className="gap-2">
                                    <Save className="h-4 w-4" />
                                    Save Privileges
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
