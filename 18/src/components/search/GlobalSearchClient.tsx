"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProduction } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  X,
  Package,
  Wrench,
  Utensils,
  Calendar,
  Users,
  ShoppingCart,
  Warehouse,
  Timer,
  ArrowRight,
  Sparkles,
  FileText,
} from 'lucide-react';

interface SearchResultItem {
  id: string;
  category: 'Products' | 'Machinery' | 'Prep Steps' | 'Schedule' | 'Staff' | 'Shopping List' | 'Pallet Storage' | 'Process Times' | 'Calendar Notes';
  title: string;
  subtitle: string;
  details: string;
  locationLabel: string;
  link: string;
  icon: any;
  badgeColor: string;
}

export function GlobalSearchClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const router = useRouter();

  const {
    products = [],
    schedule = {},
    prepSteps = [],
    tasks = [],
    machinery = [],
    users = [],
    shoppingList = [],
    palletStorage = [],
    processTimes = [],
    calendarNotes = {},
  } = useProduction();

  // Search Engine - Type-Safe & Null-Guarded
  const results = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    const matchedItems: SearchResultItem[] = [];

    // 1. Products
    (products || []).forEach((prod) => {
      if (!prod) return;
      const matchName = prod.name?.toLowerCase().includes(query);
      const matchCoPacker = prod.coPacker?.toLowerCase().includes(query);
      const matchAllergens = prod.allergens?.toLowerCase().includes(query);
      const matchDeposit = prod.targetDepositWeight?.toLowerCase().includes(query);

      if (matchName || matchCoPacker || matchAllergens || matchDeposit) {
        matchedItems.push({
          id: `prod-${prod.id}`,
          category: 'Products',
          title: prod.name || 'Unnamed Product',
          subtitle: `Co-Packer: ${prod.coPacker || 'N/A'} • Yield: ${prod.yieldPerBatch || 'N/A'} units`,
          details: `Allergens: ${prod.allergens || 'None'} | Target Deposit: ${prod.targetDepositWeight || 'N/A'} | Target Finished: ${prod.targetFinishedWeight || 'N/A'}`,
          locationLabel: 'Adjust Production Calendar / Products',
          link: '/dashboard/calendar',
          icon: Package,
          badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300',
        });
      }
    });

    // 2. Machinery Equipment
    (machinery || []).forEach((m) => {
      if (!m) return;
      const matchName = m.name?.toLowerCase().includes(query);
      const assignedProds = (products || [])
        .filter((p) => p?.machineryIds?.includes(m.id))
        .map((p) => p.name);
      const matchAssigned = assignedProds.some((pName) => pName?.toLowerCase().includes(query));

      if (matchName || matchAssigned) {
        matchedItems.push({
          id: `mach-${m.id}`,
          category: 'Machinery',
          title: m.name || 'Unnamed Machine',
          subtitle: `Quantity Available: ${m.quantity || 1}`,
          details: assignedProds.length > 0 ? `Assigned to Products: ${assignedProds.join(', ')}` : 'No products currently assigned',
          locationLabel: 'Adjust Production Calendar / Machinery',
          link: '/dashboard/calendar',
          icon: Wrench,
          badgeColor: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300',
        });
      }
    });

    // 3. Prep Steps
    (prepSteps || []).forEach((ps) => {
      if (!ps) return;
      const matchTitle = ps.title?.toLowerCase().includes(query);
      const matchProd = ps.productName?.toLowerCase().includes(query);
      const matchDay = ps.prepDay?.toLowerCase().includes(query);
      const matchNotes = ps.notes?.toLowerCase().includes(query);

      if (matchTitle || matchProd || matchDay || matchNotes) {
        matchedItems.push({
          id: `prep-${ps.id}`,
          category: 'Prep Steps',
          title: ps.title || 'Unnamed Prep Step',
          subtitle: `Product: ${ps.productName || 'General'} • Prep Day: ${ps.prepDay || 'N/A'}`,
          details: `Time: ${ps.timeOfDay || 'N/A'} | Status: ${ps.isCompleted ? 'Completed' : 'Pending'}${ps.notes ? ` | Notes: ${ps.notes}` : ''}`,
          locationLabel: 'Adjust Production Calendar / Prep Steps',
          link: '/dashboard/calendar',
          icon: Utensils,
          badgeColor: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-300',
        });
      }
    });

    // 4. Production Schedule Items
    Object.entries(schedule || {}).forEach(([dateStr, dayProd]) => {
      if (!dayProd) return;
      const matchDate = dateStr.toLowerCase().includes(query);
      Object.entries(dayProd || {}).forEach(([bayName, items]) => {
        if (!Array.isArray(items)) return;
        const matchBay = bayName.toLowerCase().includes(query);
        items.forEach((item) => {
          if (!item) return;
          const prod = (products || []).find((p) => p?.id === item.productId);
          const prodName = prod?.name || 'Product';
          const matchProdName = prodName.toLowerCase().includes(query);

          if (matchDate || matchBay || matchProdName) {
            matchedItems.push({
              id: `sched-${dateStr}-${bayName}-${item.productId}`,
              category: 'Schedule',
              title: `${prodName} on ${dateStr}`,
              subtitle: `Bay: ${bayName} • Batches: ${item.batches || 1}`,
              details: `Start Time: ${item.startTime || 'N/A'} | Location: ${bayName} Bay on ${dateStr}`,
              locationLabel: 'View Production Calendar',
              link: '/dashboard/view-calendar',
              icon: Calendar,
              badgeColor: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300',
            });
          }
        });
      });
    });

    // 5. Staff & Users
    (users || []).forEach((u) => {
      if (!u) return;
      const matchName = u.name?.toLowerCase().includes(query);
      const matchRole = u.role?.toLowerCase().includes(query);

      if (matchName || matchRole) {
        matchedItems.push({
          id: `user-${u.id}`,
          category: 'Staff',
          title: u.name || 'Unnamed Staff',
          subtitle: `Role: ${(u.role || 'user').toUpperCase()}`,
          details: `User ID: ${u.id} | Access Role: ${u.role}`,
          locationLabel: u.role === 'admin' ? 'Manage Users' : 'Staffing',
          link: u.role === 'admin' ? '/dashboard/manage-users' : '/dashboard/staffing',
          icon: Users,
          badgeColor: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300',
        });
      }
    });

    // 6. Shopping List
    (shoppingList || []).forEach((s) => {
      if (!s) return;
      const matchName = s.name?.toLowerCase().includes(query);
      const matchCategory = s.category?.toLowerCase().includes(query);
      const matchStore = s.store?.toLowerCase().includes(query);
      const matchNotes = s.notes?.toLowerCase().includes(query);

      if (matchName || matchCategory || matchStore || matchNotes) {
        matchedItems.push({
          id: `shop-${s.id}`,
          category: 'Shopping List',
          title: s.name || 'Unnamed Item',
          subtitle: `Quantity: ${s.quantity || 1} ${s.unit || ''} • Store: ${s.store || 'General'}`,
          details: `Category: ${s.category || 'General'} | Status: ${s.isChecked ? 'Checked' : 'To Buy'}${s.notes ? ` | Notes: ${s.notes}` : ''}`,
          locationLabel: 'Facility Shopping List',
          link: '/dashboard/shopping-list',
          icon: ShoppingCart,
          badgeColor: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-300',
        });
      }
    });

    // 7. Pallet Storage
    (palletStorage || []).forEach((p) => {
      if (!p) return;
      const matchClient = p.clientName?.toLowerCase().includes(query);
      const matchNotes = p.notes?.toLowerCase().includes(query);

      if (matchClient || matchNotes) {
        matchedItems.push({
          id: `pal-${p.id}`,
          category: 'Pallet Storage',
          title: `Client: ${p.clientName}`,
          subtitle: `Pallet Count: ${p.palletCount || 0}`,
          details: p.notes ? `Notes: ${p.notes}` : 'No notes provided',
          locationLabel: 'Pallet Storage',
          link: '/dashboard/pallet-storage',
          icon: Warehouse,
          badgeColor: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-300',
        });
      }
    });

    // 8. Process Times
    (processTimes || []).forEach((entry) => {
      if (!entry) return;
      const matchProcess = entry.processName?.toLowerCase().includes(query);
      const matchClient = entry.clientId?.toLowerCase().includes(query);

      if (matchProcess || matchClient) {
        matchedItems.push({
          id: `pt-${entry.id}`,
          category: 'Process Times',
          title: `${entry.processName || 'Process'}`,
          subtitle: `Co-Packer / Client: ${entry.clientId || 'N/A'}`,
          details: `Min Staff: ${entry.minEmployees || 'N/A'} | Min Rate: ${entry.minRate || 'N/A'}`,
          locationLabel: 'Time for a Process',
          link: '/dashboard/process-times',
          icon: Timer,
          badgeColor: 'bg-pink-500/15 text-pink-800 dark:text-pink-300 border-pink-300',
        });
      }
    });

    // 9. Calendar Notes (Object map)
    Object.entries(calendarNotes || {}).forEach(([dateKey, noteObj]) => {
      if (!noteObj) return;
      const noteText = noteObj.note || '';
      const timeLeftText = noteObj.timeLeftBuilding || '';
      if (noteText.toLowerCase().includes(query) || dateKey.toLowerCase().includes(query) || timeLeftText.toLowerCase().includes(query)) {
        matchedItems.push({
          id: `cn-${dateKey}`,
          category: 'Calendar Notes',
          title: `Note on ${dateKey}`,
          subtitle: noteText || 'Calendar note entry',
          details: `Date: ${dateKey}${timeLeftText ? ` | Time Left: ${timeLeftText}` : ''}`,
          locationLabel: 'View Production Calendar',
          link: '/dashboard/view-calendar',
          icon: FileText,
          badgeColor: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300',
        });
      }
    });

    return matchedItems;
  }, [
    searchTerm,
    products,
    machinery,
    prepSteps,
    schedule,
    users,
    shoppingList,
    palletStorage,
    processTimes,
    calendarNotes,
  ]);

  // Filter by category pill
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'All') return results;
    return results.filter((r) => r.category === selectedCategory);
  }, [results, selectedCategory]);

  const categories = [
    'All',
    'Products',
    'Machinery',
    'Prep Steps',
    'Schedule',
    'Staff',
    'Shopping List',
    'Pallet Storage',
    'Process Times',
  ];

  const popularSearches = ['Mixer', 'Product A', 'Shopping', 'Baking', 'CP-1', 'Peanuts', 'Pallet'];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <Search className="h-8 w-8 text-amber-600" />
          Search Made4U Application
        </h1>
        <p className="text-muted-foreground text-sm">
          Type any keyword below to search across products, machinery, prep steps, production schedule, staff, shopping list, pallet storage, and process times.
        </p>
      </div>

      {/* Prominent Search Input Box */}
      <Card className="shadow-lg border-2 border-amber-200/80 dark:border-amber-950 bg-gradient-to-b from-background to-muted/20">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-6 w-6 text-muted-foreground" />
            <Input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type keyword to search (e.g. Mixer, Product A, Baking, Staff name)..."
              className="pl-13 pr-12 h-14 text-base sm:text-lg bg-background rounded-xl border-amber-300 focus-visible:ring-amber-500 shadow-sm"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Quick Filter Categories */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Filter by:</span>
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className={`cursor-pointer text-xs px-3 py-1 transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : 'hover:bg-amber-100 dark:hover:bg-amber-950'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          {/* Popular Search Suggestions when empty */}
          {!searchTerm && (
            <div className="pt-2 border-t flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Popular searches:
              </span>
              {popularSearches.map((sug) => (
                <button
                  key={sug}
                  onClick={() => setSearchTerm(sug)}
                  className="bg-muted hover:bg-amber-100 dark:hover:bg-amber-900/40 text-foreground border rounded-full px-2.5 py-0.5 transition-colors font-medium text-[11px]"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Header & Counter */}
      {searchTerm && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium text-muted-foreground">
            Found <span className="font-bold text-foreground">{filteredResults.length}</span> result
            {filteredResults.length !== 1 ? 's' : ''} for &quot;<span className="text-amber-600 font-semibold">{searchTerm}</span>&quot;
            {selectedCategory !== 'All' && ` in ${selectedCategory}`}
          </p>
        </div>
      )}

      {/* Results Cards List */}
      {searchTerm && filteredResults.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredResults.map((item) => {
            const IconComponent = item.icon;
            return (
              <Card
                key={item.id}
                className="hover:shadow-md transition-all duration-150 border border-border/80 hover:border-amber-400/60"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-foreground leading-tight">{item.title}</h3>
                        <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${item.badgeColor}`}>
                          {item.category}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">{item.subtitle}</p>
                      <p className="text-xs text-foreground/80 bg-muted/40 p-2 rounded-lg font-mono border border-border/40 mt-1.5">
                        {item.details}
                      </p>
                      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 pt-1 flex items-center gap-1">
                        <span>📍</span> {item.locationLabel}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => router.push(item.link)}
                    className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs font-semibold self-end sm:self-center"
                  >
                    Go to Page
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty Search Results */}
      {searchTerm && filteredResults.length === 0 && (
        <Card className="p-8 text-center border-dashed border-2">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-muted rounded-full text-muted-foreground">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold">No matching results found</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              We couldn&apos;t find any products, machinery, prep steps, schedule items, staff, or shopping list items matching &quot;{searchTerm}&quot;. Try checking for typos or searching another keyword.
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearchTerm('')} className="mt-2 text-xs">
              Clear Search
            </Button>
          </div>
        </Card>
      )}

      {/* Initial Landing State */}
      {!searchTerm && (
        <Card className="p-8 text-center bg-muted/20 border-dashed">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-lg mx-auto">
            <div className="p-4 bg-amber-100 dark:bg-amber-950/60 rounded-full text-amber-600">
              <Search className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">Ready to search Made4U Flow</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Start typing in the big search bar above to look through products, co-packers, machinery, prep instructions, calendar production schedules, staffing roster, shopping list items, and storage records.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
