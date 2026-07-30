
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProduction } from '@/lib/store';
import type { ShoppingListItem, ShoppingListCategory, RegisteredShoppingItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Download, Upload, Calendar as CalendarIcon, GripVertical, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';

const CATEGORIES: ShoppingListCategory[] = ['Ingredients', 'Packaging', 'Cleaning Supplies'];

export function ShoppingListClient() {
    const { shoppingList, registeredShoppingItems, addRegisteredShoppingItems, clearRegisteredShoppingItems, removeRegisteredShoppingItem, addOrUpdateRegisteredShoppingItem, addShoppingListItem, updateShoppingListItem, removeShoppingListItem } = useProduction();
    const [supplierFilter, setSupplierFilter] = useState('all');

    const allSuppliers = useMemo(() => {
        const suppliers = new Set(registeredShoppingItems.map(item => item.supplier).filter(Boolean));
        return Array.from(suppliers).sort((a, b) => a.localeCompare(b));
    }, [registeredShoppingItems]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Supplier Filter</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                    <Label htmlFor="supplier-filter" className="text-nowrap">Show Items Only From This Supplier:</Label>
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                        <SelectTrigger id="supplier-filter" className="w-full max-w-sm">
                            <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Show All</SelectItem>
                            {allSuppliers.map(supplier => (
                                <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {CATEGORIES.map(category => (
                <ShoppingListCategoryCard 
                    key={category} 
                    category={category} 
                    supplierFilter={supplierFilter}
                    addRegisteredItems={addRegisteredShoppingItems}
                    clearRegisteredItems={clearRegisteredShoppingItems}
                    removeRegisteredShoppingItem={removeRegisteredShoppingItem}
                    addOrUpdateRegisteredShoppingItem={addOrUpdateRegisteredShoppingItem}
                    shoppingList={shoppingList}
                    registeredShoppingItems={registeredShoppingItems}
                    addShoppingListItem={addShoppingListItem}
                    updateShoppingListItem={updateShoppingListItem}
                    removeShoppingListItem={removeShoppingListItem}
                />
            ))}
        </div>
    );
}

function ShoppingListCategoryCard({ category, supplierFilter, addRegisteredItems, clearRegisteredItems, removeRegisteredShoppingItem, addOrUpdateRegisteredShoppingItem, shoppingList, registeredShoppingItems, addShoppingListItem, updateShoppingListItem, removeShoppingListItem }: { 
    category: ShoppingListCategory, 
    supplierFilter: string;
    addRegisteredItems: (items: Omit<RegisteredShoppingItem, 'id'>[]) => void,
    clearRegisteredItems: (category: ShoppingListCategory) => void,
    removeRegisteredShoppingItem: (id: string) => void,
    addOrUpdateRegisteredShoppingItem: (item: Omit<RegisteredShoppingItem, 'id'> | RegisteredShoppingItem) => void;
    shoppingList: ShoppingListItem[];
    registeredShoppingItems: RegisteredShoppingItem[];
    addShoppingListItem: (item: ShoppingListItem) => void;
    updateShoppingListItem: (item: ShoppingListItem) => void;
    removeShoppingListItem: (id: string) => void;
}) {
    const [selectedRegisteredItemId, setSelectedRegisteredItemId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<string>('1');
    const [needDeliveredBy, setNeedDeliveredBy] = useState<Date | null>(null);
    const { toast } = useToast();
    
    const categoryItems = useMemo(() => {
        const items = shoppingList.filter(item => item.category === category);
        if (supplierFilter === 'all') return items;
        return items.filter(item => item.supplier === supplierFilter);
    }, [shoppingList, category, supplierFilter]);
    
    const categoryRegisteredItems = registeredShoppingItems.filter(item => item.category === category);

    const handleAddItem = () => {
        if (!selectedRegisteredItemId || !quantity) {
            toast({ variant: 'destructive', title: "Missing Information", description: "Please select an item and quantity." });
            return;
        }

        const registeredItem = registeredShoppingItems.find(i => i.id === selectedRegisteredItemId);
        if (!registeredItem) return;

        const newItem: ShoppingListItem = {
            id: `sli-${Date.now()}-${Math.random()}`,
            category,
            name: registeredItem.name,
            quantity,
            supplier: registeredItem.supplier,
            leadTime: registeredItem.leadTime,
            needDeliveredBy: needDeliveredBy ? needDeliveredBy.toISOString() : null,
            ordered: false,
            expectedDeliveryDate: null,
        };

        addShoppingListItem(newItem);

        // Reset form
        setSelectedRegisteredItemId(null);
        setQuantity('1');
        setNeedDeliveredBy(null);
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>Items to be ordered for this category.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="space-y-4">
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">Qty</TableHead>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Lead Time</TableHead>
                                    <TableHead>Need Delivered by</TableHead>
                                    <TableHead>Ordered</TableHead>
                                    <TableHead>Expected Delivery</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categoryItems.map(item => (
                                    <ShoppingItemRow
                                        key={item.id} 
                                        item={item} 
                                        updateShoppingListItem={updateShoppingListItem}
                                        removeShoppingListItem={removeShoppingListItem}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="pt-4 border-t space-y-2">
                        <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                            <Input 
                                type="text"
                                placeholder="Qty" 
                                value={quantity} 
                                onChange={e => setQuantity(e.target.value)}
                            />
                            <ItemSelector 
                                items={categoryRegisteredItems}
                                selectedId={selectedRegisteredItemId}
                                onSelect={setSelectedRegisteredItemId}
                            />
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={'outline'}
                                        size="sm"
                                        className={cn(
                                            "w-[150px] justify-start text-left font-normal h-10",
                                            !needDeliveredBy && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {needDeliveredBy ? format(needDeliveredBy, "P") : <span>Need Delivered by</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={needDeliveredBy || undefined}
                                        onSelect={(date) => setNeedDeliveredBy(date || null)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={handleAddItem} className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Add to List</Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/50 p-0 mt-auto">
                <RegisterItems
                    category={category}
                    registeredItems={categoryRegisteredItems}
                    addRegisteredItems={addRegisteredItems}
                    clearRegisteredItems={clearRegisteredItems}
                    removeRegisteredShoppingItem={removeRegisteredShoppingItem}
                    addOrUpdateRegisteredShoppingItem={addOrUpdateRegisteredShoppingItem}
                />
            </CardFooter>
        </Card>
    );
}

function ShoppingItemRow({ item, updateShoppingListItem, removeShoppingListItem }: {
    item: ShoppingListItem;
    updateShoppingListItem: (item: ShoppingListItem) => void;
    removeShoppingListItem: (id: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState(item);

    useEffect(() => {
        setEditedItem(item);
    }, [item]);

    const handleSave = () => {
        updateShoppingListItem(editedItem);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedItem(item);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <TableRow className={cn(item.ordered ? 'bg-emerald-950/80 text-emerald-100 border-emerald-800/40' : 'bg-red-950/80 text-red-100 border-red-800/40')}>
                <TableCell>
                    <Input value={editedItem.quantity} onChange={(e) => setEditedItem({...editedItem, quantity: e.target.value})} className="h-8 w-24" />
                </TableCell>
                <TableCell>
                    <Input value={editedItem.name} onChange={(e) => setEditedItem({...editedItem, name: e.target.value})} className="h-8" />
                </TableCell>
                <TableCell>
                    <Input value={editedItem.supplier} onChange={(e) => setEditedItem({...editedItem, supplier: e.target.value})} className="h-8" />
                </TableCell>
                <TableCell>
                    <Input value={editedItem.leadTime} onChange={(e) => setEditedItem({...editedItem, leadTime: e.target.value})} className="h-8" />
                </TableCell>
                <TableCell>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={'outline'} size="sm" className={cn("w-[150px] justify-start text-left font-normal h-8", !editedItem.needDeliveredBy && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editedItem.needDeliveredBy ? format(new Date(editedItem.needDeliveredBy), "P") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={editedItem.needDeliveredBy ? new Date(editedItem.needDeliveredBy) : undefined} onSelect={(date) => setEditedItem({...editedItem, needDeliveredBy: date ? date.toISOString() : null})} initialFocus />
                        </PopoverContent>
                    </Popover>
                </TableCell>
                <TableCell>
                    <Checkbox checked={editedItem.ordered} onCheckedChange={(checked) => setEditedItem({...editedItem, ordered: !!checked})} />
                </TableCell>
                <TableCell>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={'outline'} size="sm" className={cn("w-[150px] justify-start text-left font-normal h-8", !editedItem.expectedDeliveryDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editedItem.expectedDeliveryDate ? format(new Date(editedItem.expectedDeliveryDate), "P") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={editedItem.expectedDeliveryDate ? new Date(editedItem.expectedDeliveryDate) : undefined} onSelect={(date) => setEditedItem({...editedItem, expectedDeliveryDate: date ? date.toISOString() : null})} initialFocus />
                        </PopoverContent>
                    </Popover>
                </TableCell>
                <TableCell className="text-right">
                    <Button onClick={handleSave} size="sm" className="mr-2">Save</Button>
                    <Button onClick={handleCancel} size="sm" variant="ghost">Cancel</Button>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <TableRow className={cn(item.ordered ? 'bg-emerald-950/80 text-emerald-100 border-emerald-800/40' : 'bg-red-950/80 text-red-100 border-red-800/40')}>
            <TableCell>{item.quantity}</TableCell>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell>{item.supplier}</TableCell>
            <TableCell>{item.leadTime}</TableCell>
            <TableCell>{item.needDeliveredBy ? format(new Date(item.needDeliveredBy), "P") : '-'}</TableCell>
            <TableCell>
                <Checkbox checked={item.ordered} onCheckedChange={(checked) => updateShoppingListItem({ ...item, ordered: !!checked })} />
            </TableCell>
            <TableCell>{item.expectedDeliveryDate ? format(new Date(item.expectedDeliveryDate), "P") : '-'}</TableCell>
            <TableCell className="text-right">
                 <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8">
                    <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeShoppingListItem(item.id)} className="h-8 w-8 text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
}

function ItemSelector({ items, selectedId, onSelect }: {
    items: RegisteredShoppingItem[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}) {
    const uniqueItems = useMemo(() => {
        const seen = new Set<string>();
        return items.filter(item => {
            if (seen.has(item.id)) {
                return false;
            } else {
                seen.add(item.id);
                return true;
            }
        });
    }, [items]);

    const sortedItems = useMemo(() => {
        return [...uniqueItems].sort((a, b) => a.name.localeCompare(b.name));
    }, [uniqueItems]);

    return (
        <Select value={selectedId || ''} onValueChange={(value) => onSelect(value)}>
            <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Select item..." />
            </SelectTrigger>
            <SelectContent>
                {sortedItems.length === 0 && <SelectItem value="no-items" disabled>No items registered</SelectItem>}
                {sortedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                        {item.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function RegisterItems({ category, registeredItems, addRegisteredItems, clearRegisteredItems, removeRegisteredShoppingItem, addOrUpdateRegisteredShoppingItem }: {
    category: ShoppingListCategory;
    registeredItems: RegisteredShoppingItem[];
    addRegisteredItems: (items: Omit<RegisteredShoppingItem, 'id'>[]) => void;
    clearRegisteredItems: (category: ShoppingListCategory) => void;
    removeRegisteredShoppingItem: (id: string) => void;
    addOrUpdateRegisteredShoppingItem: (item: Omit<RegisteredShoppingItem, 'id'> | RegisteredShoppingItem) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [newItemName, setNewItemName] = useState('');
    const [newItemSupplier, setNewItemSupplier] = useState('');
    const [newItemLeadTime, setNewItemLeadTime] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editedItem, setEditedItem] = useState<Partial<RegisteredShoppingItem>>({});

    const handleManualAddItem = () => {
        if (!newItemName) {
            toast({ variant: 'destructive', title: "Item name is required." });
            return;
        }
        const newItem: Omit<RegisteredShoppingItem, 'id'> = {
            category,
            name: newItemName,
            supplier: newItemSupplier,
            leadTime: newItemLeadTime,
        };
        addOrUpdateRegisteredShoppingItem(newItem);
        // Reset form
        setNewItemName('');
        setNewItemSupplier('');
        setNewItemLeadTime('');
        toast({ title: "Item Registered", description: `${newItemName} has been added to the registered items.` });
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length < 1) {
                    throw new Error("CSV is empty.");
                }

                const dataRows = jsonData.slice(0);

                const newItems: Omit<RegisteredShoppingItem, 'id'>[] = dataRows.map((row: any) => {
                    const name = row[0];
                    const supplier = row[1];
                    const leadTime = row[2];

                    if (!name) return null;

                    return {
                        category,
                        name: String(name),
                        supplier: String(supplier || ''),
                        leadTime: String(leadTime || ''),
                    };
                }).filter((item): item is Omit<RegisteredShoppingItem, 'id'> => item !== null);


                if (newItems.length > 0) {
                    addRegisteredShoppingItems(newItems);
                    toast({ title: "Import Successful", description: `${newItems.length} items registered for ${category}.` });
                } else {
                    toast({ variant: 'destructive', title: "Import Warning", description: "No items with a 'name' in the first column were found." });
                }
            } catch (error: any) {
                console.error("Shopping list import failed:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: error.message || "Could not parse the file." });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExport = () => {
        if (registeredItems.length === 0) {
            toast({ variant: 'destructive', title: "No registered items to export."});
            return;
        }

        const dataToExport = registeredItems.map(item => ({
            'name': item.name,
            'supplier': item.supplier,
            'lead time': item.leadTime,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registered Items');
        
        XLSX.writeFile(workbook, `${category}_Registered_Items.xlsx`);
        toast({ title: 'Export Successful', description: `Registered items for ${category} have been downloaded.` });
    };

    const handleEditClick = (item: RegisteredShoppingItem) => {
        setEditingItemId(item.id);
        setEditedItem(item);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditedItem({});
    };

    const handleSaveEdit = () => {
        if (editingItemId && editedItem.name) {
            addOrUpdateRegisteredShoppingItem({ ...editedItem, id: editingItemId, category } as RegisteredShoppingItem);
            handleCancelEdit();
        }
    };


    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="register-items" className="border-b-0">
                <AccordionTrigger className="px-4 py-2 text-sm font-medium">
                    Register Items
                </AccordionTrigger>
                <AccordionContent>
                    <div className="p-4 border-t space-y-4">
                        {registeredItems.length > 0 && (
                            <div className="max-h-60 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item Name</TableHead>
                                            <TableHead>Supplier</TableHead>
                                            <TableHead>Lead Time</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registeredItems.map(item => (
                                            <TableRow key={item.id}>
                                                {editingItemId === item.id ? (
                                                    <>
                                                        <TableCell><Input value={editedItem.name} onChange={e => setEditedItem({...editedItem, name: e.target.value})} /></TableCell>
                                                        <TableCell><Input value={editedItem.supplier} onChange={e => setEditedItem({...editedItem, supplier: e.target.value})} /></TableCell>
                                                        <TableCell><Input value={editedItem.leadTime} onChange={e => setEditedItem({...editedItem, leadTime: e.target.value})} /></TableCell>
                                                        <TableCell className="text-right">
                                                            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell>{item.name}</TableCell>
                                                        <TableCell>{item.supplier}</TableCell>
                                                        <TableCell>{item.leadTime}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)} className="h-8 w-8">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => removeRegisteredShoppingItem(item.id)} className="h-8 w-8 text-destructive/80">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-muted-foreground mb-2">Import a list of items. The CSV should have columns in this order: Name, Supplier, Lead Time.</p>
                            <div className="flex gap-2">
                                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv,.xlsx" className="hidden" id={`register-import-${category}`} />
                                <Button asChild variant="outline" size="sm">
                                    <Label htmlFor={`register-import-${category}`} className="cursor-pointer flex items-center">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Import
                                    </Label>
                                </Button>
                                <Button onClick={handleExport} size="sm" variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                                <Button onClick={() => clearRegisteredItems(category)} size="sm" variant="destructive" className="ml-auto">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </Button>
                            </div>
                        </div>
                        <div className="pt-4 border-t space-y-2">
                            <h4 className="text-sm font-medium">Add New Registered Item</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Input placeholder="Item Name" value={newItemName} onChange={e => setNewItemName(e.target.value)} />
                                <Input placeholder="Supplier" value={newItemSupplier} onChange={e => setNewItemSupplier(e.target.value)} />
                                <Input placeholder="Lead Time" value={newItemLeadTime} onChange={e => setNewItemLeadTime(e.target.value)} />
                            </div>
                             <Button onClick={handleManualAddItem} size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add New Item</Button>
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
