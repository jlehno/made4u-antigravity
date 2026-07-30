
"use client";

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useProduction } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, FileText, X, Eye } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function SopDocumentsClient() {
  const { products, schedule } = useProduction();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  
  const productsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = schedule[dateKey];
    if (!daySchedule) return [];

    const productIds = new Set<string>();
    Object.values(daySchedule).forEach(bayItems => {
      bayItems.forEach(item => productIds.add(item.productId));
    });
    
    return products.filter(p => productIds.has(p.id) && p.sopFile);
  }, [selectedDate, schedule, products]);

  const searchedProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerCaseQuery = searchQuery.toLowerCase();
    return products.filter(p =>
      (p.name.toLowerCase().includes(lowerCaseQuery) || p.coPacker.toLowerCase().includes(lowerCaseQuery)) && p.sopFile
    );
  }, [searchQuery, products]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>SOPs by Production Date</CardTitle>
          <CardDescription>Select a day to view SOPs for all products scheduled for production.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
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
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => setSelectedDate(new Date())}>Today</Button>
          </div>
          
          {selectedDate && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                SOPs for {format(selectedDate, 'PPP')}
              </h3>
              {productsOnSelectedDate.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {productsOnSelectedDate.map(product => (
                        <SopCard key={product.id} product={product} />
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No products with SOPs scheduled for this date.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Search All SOPs</CardTitle>
          <CardDescription>Search for SOPs by product or co-packer name.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              type="text"
              placeholder="e.g., 'Product A' or 'CP-1'"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
             {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
           {searchQuery && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">
                Search Results
              </h3>
              {searchedProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {searchedProducts.map(product => (
                        <SopCard key={product.id} product={product} />
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No SOPs found matching your search.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SopCard({ product }: { product: Product }) {
    if (!product.sopFile || !product.sopFileName) return null;

    const openFileInNewWindow = () => {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`<embed src="${product.sopFile}" type="application/pdf" width="100%" height="100%" />`);
            newWindow.document.title = product.sopFileName || 'SOP Document';
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <FileText className="h-8 w-8 text-primary" />
                        <CardTitle className="text-xl font-bold">SOP</CardTitle>
                    </div>
                    <div className="flex-1 text-right">
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        <CardDescription>{product.coPacker}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground truncate mb-4" title={product.sopFileName}>
                    {product.sopFileName}
                </p>
                 <Button onClick={openFileInNewWindow} size="sm" className="w-full">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                </Button>
            </CardContent>
        </Card>
    )
}
