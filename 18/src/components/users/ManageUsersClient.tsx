
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
import { Trash2, PlusCircle, Download, Upload, Shield, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';

export function ManageUsersClient() {
    const { users, addOrUpdateUser, deleteUser, deleteAllUsers } = useProduction();
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
            setUserPrivileges(selectedUser.privileges || getDefaultPrivileges(selectedUser.role, selectedUser.name));
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

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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

                const importedUsers: User[] = [];
                const errors: string[] = [];

                json.forEach((row, index) => {
                    const nameKey = Object.keys(row).find(k => k.toLowerCase() === 'name') || 'Name';
                    const pinKey = Object.keys(row).find(k => k.toLowerCase() === 'pin') || 'PIN';
                    const roleKey = Object.keys(row).find(k => k.toLowerCase() === 'role') || 'Role';

                    const nameVal = row[nameKey];
                    const name = nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '';
                    let pin = row[pinKey] !== undefined && row[pinKey] !== null ? String(row[pinKey]).trim() : '';
                    if (pin && !isNaN(Number(pin))) {
                        pin = pin.padStart(6, '0');
                    }
                    let roleVal = row[roleKey] !== undefined && row[roleKey] !== null ? String(row[roleKey]).toLowerCase().trim() : '';

                    if (!name && !pin && !roleVal) return;

                    if (!name) {
                        errors.push(`Row ${index + 2}: Name is missing.`);
                        return;
                    }
                    if (pin.length !== 6) {
                        errors.push(`Row ${index + 2} (${name}): PIN must be exactly 6 digits (got "${pin}").`);
                        return;
                    }
                    if (!['admin', 'bank', 'employee', 'miffy'].includes(roleVal)) {
                        roleVal = 'employee';
                    }

                    const existingUser = users.find(u => u.name.toLowerCase().trim() === name.toLowerCase());

                    importedUsers.push({
                        id: existingUser ? existingUser.id : `user-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                        uid: existingUser?.uid,
                        name,
                        pin,
                        role: roleVal as any
                    });
                });

                if (importedUsers.length > 0) {
                    toast({ title: "Importing...", description: `Adding ${importedUsers.length} users...` });
                    for (const user of importedUsers) {
                        await addOrUpdateUser(user);
                    }
                    
                    if (errors.length > 0) {
                        toast({ 
                            title: "Import Complete with Warnings", 
                            description: `${importedUsers.length} users added/updated. ${errors.length} rows skipped.` 
                        });
                    } else {
                        toast({ title: "Import Successful", description: `${importedUsers.length} users have been added/updated.` });
                    }
                } else if (errors.length > 0) {
                    toast({ 
                        variant: 'destructive', 
                        title: "Import Failed", 
                        description: `No valid users found. ${errors.length} rows were invalid.` 
                    });
                } else {
                    toast({ title: "No Data Found", description: "The imported sheet did not contain any user data." });
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
            <Card>
                <CardHeader>
                    <CardTitle>Manage Users</CardTitle>
                    <CardDescription>Add, remove, and manage user roles and PINs.</CardDescription>
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

            <Card>
                <CardHeader>
                    <CardTitle>Add New User</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                    <Input
                        placeholder="Full Name"
                        value={newUser.name}
                        onChange={(e) => setNewUser(prev => ({...prev, name: e.target.value}))}
                    />
                    <Input
                        placeholder="6-Digit PIN"
                        value={newUser.pin}
                        onChange={(e) => setNewUser(prev => ({...prev, pin: e.target.value}))}
                        maxLength={6}
                    />
                    <Select value={newUser.role} onValueChange={(value: any) => setNewUser(prev => ({ ...prev, role: value }))}>
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
                    <Button onClick={handleAddNewUser} className="shrink-0">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Bulk Management</CardTitle>
                    <CardDescription>Import and export user data via CSV.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".csv,.xlsx" className="hidden" id="user-import" />
                    <Button asChild variant="outline">
                        <Label htmlFor="user-import" className="cursor-pointer flex items-center">
                            <Upload className="mr-2 h-4 w-4" />
                            Import from CSV
                        </Label>
                    </Button>
                    <Button onClick={exportToCSV}>
                        <Download className="mr-2 h-4 w-4" />
                        Export as CSV
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={users.length === 0} className="ml-auto">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove All Users
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete all users. The primary admin account will not be deleted.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteAllUsers()}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            {/* USER PRIVILEGES SECTION */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle>User Privileges</CardTitle>
                    </div>
                    <CardDescription>
                        Select a user to configure their tab access permissions and specific sub-feature privileges.
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
                                            <Label htmlFor="priv-bay-days" className="cursor-pointer text-sm">
                                                Bay Days at Top of App
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

                                {/* Manage Users */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-users" 
                                        checked={!!userPrivileges.manageUsers} 
                                        onCheckedChange={() => togglePrivilegeKey('manageUsers')} 
                                    />
                                    <Label htmlFor="priv-users" className="cursor-pointer font-medium">Manage Users</Label>
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

                                {/* Employee Staffing UI */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox 
                                        id="priv-employee-staffing" 
                                        checked={!!userPrivileges.employeeStaffing} 
                                        onCheckedChange={() => togglePrivilegeKey('employeeStaffing')} 
                                    />
                                    <Label htmlFor="priv-employee-staffing" className="cursor-pointer font-medium">Employee Staffing UI</Label>
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
