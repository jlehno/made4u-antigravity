
"use client";

import React, { useState } from 'react';
import { useProduction } from '@/lib/store';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


export function ManageUsersClient() {
    const { users, addOrUpdateUser, deleteUser, deleteAllUsers } = useProduction();
    const [newUser, setNewUser] = useState<Omit<User, 'id'>>({ name: '', pin: '', role: 'employee' });
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const { toast } = useToast();

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

                    // If completely empty row, skip without logging an error
                    if (!name && !pin && !roleVal) {
                        return;
                    }

                    if (!name) {
                        errors.push(`Row ${index + 2}: Name is missing.`);
                        return;
                    }
                    if (pin.length !== 6) {
                        errors.push(`Row ${index + 2} (${name}): PIN must be exactly 6 digits (got "${pin}").`);
                        return;
                    }
                    if (!['admin', 'bank', 'employee', 'miffy'].includes(roleVal)) {
                        roleVal = 'employee'; // default to employee if invalid
                    }

                    // Find if user already exists in the system to preserve their ID and UID (prevents duplicates)
                    const existingUser = users.find(u => u.name.toLowerCase().trim() === name.toLowerCase());

                    importedUsers.push({
                        id: existingUser ? existingUser.id : `user-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
                        uid: existingUser?.uid, // Preserve existing auth UID
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
                            description: `${importedUsers.length} users added/updated. ${errors.length} rows skipped (see console for details).` 
                        });
                        console.warn("Skipped rows during import:\n" + errors.join("\n"));
                    } else {
                        toast({ title: "Import Successful", description: `${importedUsers.length} users have been added/updated.` });
                    }
                } else if (errors.length > 0) {
                    toast({ 
                        variant: 'destructive', 
                        title: "Import Failed", 
                        description: `No valid users found. ${errors.length} rows were invalid (see console).` 
                    });
                    console.error("Invalid rows:\n" + errors.join("\n"));
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
                                        <Button variant="ghost" size="icon" onClick={() => deleteUser(user.id)} className="text-destructive/70 hover:text-destructive" disabled={user.id === 'user-1'}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
        </div>
    );
}
