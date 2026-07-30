"use client";

import React, { useState, useMemo } from 'react';
import { useProduction } from '@/lib/store';
import { ManagementNote, ManagementChecklistItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  NotebookPen,
  Plus,
  Search,
  Tag,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  CheckSquare,
  Square,
  X,
  User,
  ShieldAlert,
  FolderOpen,
} from 'lucide-react';

const PRESET_LABELS = ['Staffing', 'Maintenance', 'Quality', 'Inventory', 'HR', 'General'];

export function ManagementNotesClient() {
  const {
    userRole,
    userName,
    managementNotes = [],
    addOrUpdateManagementNote,
    deleteManagementNote,
    toggleManagementChecklistItem,
  } = useProduction();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState('All');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ManagementNote | null>(null);

  // Form State
  const [formSubject, setFormSubject] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formBody, setFormBody] = useState('');
  const [formLabels, setFormLabels] = useState<string[]>(['General']);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [formChecklist, setFormChecklist] = useState<ManagementChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Collect all unique labels from presets + existing notes
  const allAvailableLabels = useMemo(() => {
    const set = new Set<string>(PRESET_LABELS);
    managementNotes.forEach((n) => {
      (n.labels || []).forEach((lbl) => set.add(lbl));
    });
    return Array.from(set);
  }, [managementNotes]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormSubject('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormBody('');
    setFormLabels(['General']);
    setCustomLabelInput('');
    setFormChecklist([]);
    setNewChecklistText('');
    setIsDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (note: ManagementNote) => {
    setEditingNote(note);
    setFormSubject(note.subject);
    setFormDate(note.date || format(new Date(), 'yyyy-MM-dd'));
    setFormBody(note.body || '');
    setFormLabels(note.labels?.length ? note.labels : ['General']);
    setCustomLabelInput('');
    setFormChecklist(note.checklist ? [...note.checklist] : []);
    setNewChecklistText('');
    setIsDialogOpen(true);
  };

  // Toggle Label in Form
  const handleToggleFormLabel = (label: string) => {
    if (formLabels.includes(label)) {
      if (formLabels.length === 1) return; // Keep at least one label
      setFormLabels(formLabels.filter((l) => l !== label));
    } else {
      setFormLabels([...formLabels, label]);
    }
  };

  // Add Custom Label Tag
  const handleAddCustomLabel = () => {
    const trimmed = customLabelInput.trim();
    if (!trimmed) return;
    if (!formLabels.includes(trimmed)) {
      setFormLabels([...formLabels, trimmed]);
    }
    setCustomLabelInput('');
  };

  // Add Checklist Item to Form
  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    const newItem: ManagementChecklistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      completed: false,
    };
    setFormChecklist([...formChecklist, newItem]);
    setNewChecklistText('');
  };

  // Remove Checklist Item from Form
  const handleRemoveChecklistItem = (id: string) => {
    setFormChecklist(formChecklist.filter((item) => item.id !== id));
  };

  // Submit Save Note
  const handleSaveNote = async () => {
    if (!formSubject.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a subject for the note.', variant: 'destructive' });
      return;
    }

    const noteToSave: ManagementNote = {
      id: editingNote ? editingNote.id : `note-${Date.now()}`,
      subject: formSubject.trim(),
      date: formDate,
      body: formBody.trim(),
      labels: formLabels.length > 0 ? formLabels : ['General'],
      checklist: formChecklist.length > 0 ? formChecklist : undefined,
      createdAt: editingNote ? editingNote.createdAt : Date.now(),
      updatedAt: Date.now(),
      authorName: editingNote?.authorName || userName || 'Admin',
    };

    try {
      await addOrUpdateManagementNote(noteToSave);
      toast({
        title: editingNote ? 'Note Updated' : 'Note Created',
        description: `Successfully saved "${noteToSave.subject}".`,
      });
      setIsDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Save Failed', description: err.message || 'Could not save note.', variant: 'destructive' });
    }
  };

  // Handle Delete Note
  const handleDelete = async (noteId: string, subject: string) => {
    if (confirm(`Are you sure you want to delete "${subject}"?`)) {
      try {
        await deleteManagementNote(noteId);
        toast({ title: 'Note Deleted', description: `Deleted note "${subject}".` });
      } catch (err: any) {
        console.error(err);
        toast({ title: 'Delete Failed', description: err.message || 'Could not delete note.', variant: 'destructive' });
      }
    }
  };

  // Filter Notes List
  const filteredNotes = useMemo(() => {
    return managementNotes
      .filter((n) => {
        const matchesLabel = selectedLabelFilter === 'All' || (n.labels || []).includes(selectedLabelFilter);
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          n.subject.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.date.includes(q) ||
          (n.checklist || []).some((item) => item.text.toLowerCase().includes(q));
        return matchesLabel && matchesSearch;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [managementNotes, selectedLabelFilter, searchQuery]);

  // Admin Guard
  if (userRole !== 'admin') {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Card className="p-8 text-center border-2 border-amber-200/50 shadow-md">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">Access Restricted</h2>
            <p className="text-sm text-muted-foreground">
              Management Notes are only accessible to Administrator accounts.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <NotebookPen className="h-8 w-8 text-amber-600" />
            Management Notes
          </h1>
          <p className="text-muted-foreground text-sm">
            Generate and manage operational notes, assign folder/label tags, and track checkable task lists.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold shadow-md">
          <Plus className="h-4 w-4" />
          Generate New Note
        </Button>
      </div>

      {/* Filter Folders Bar & Search */}
      <Card className="shadow-sm border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes by subject, content, date or checklist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-xs h-10 focus-visible:ring-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Total Badge */}
            <Badge variant="outline" className="text-xs px-3 py-1.5 shrink-0 bg-amber-50 dark:bg-amber-950 border-amber-300">
              Total Notes: {managementNotes.length}
            </Badge>
          </div>

          {/* Folder Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
            <span className="text-xs font-semibold text-muted-foreground mr-1.5 flex items-center gap-1">
              <FolderOpen className="h-3.5 w-3.5 text-amber-600" /> Label Folders:
            </span>
            <Badge
              variant={selectedLabelFilter === 'All' ? 'default' : 'outline'}
              className={`cursor-pointer text-xs px-3 py-1 transition-all ${
                selectedLabelFilter === 'All'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'hover:bg-amber-100 dark:hover:bg-amber-950'
              }`}
              onClick={() => setSelectedLabelFilter('All')}
            >
              All Notes ({managementNotes.length})
            </Badge>
            {allAvailableLabels.map((lbl) => {
              const count = managementNotes.filter((n) => (n.labels || []).includes(lbl)).length;
              return (
                <Badge
                  key={lbl}
                  variant={selectedLabelFilter === lbl ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs px-3 py-1 transition-all ${
                    selectedLabelFilter === lbl
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'hover:bg-amber-100 dark:hover:bg-amber-950'
                  }`}
                  onClick={() => setSelectedLabelFilter(lbl)}
                >
                  🏷️ {lbl} ({count})
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const checklistItems = note.checklist || [];
            const completedCount = checklistItems.filter((c) => c.completed).length;
            const progressPercent = checklistItems.length > 0 ? Math.round((completedCount / checklistItems.length) * 100) : 0;

            return (
              <Card key={note.id} className="flex flex-col shadow-sm border hover:border-amber-300 transition-all">
                <CardHeader className="p-4 pb-2 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {(note.labels || ['General']).map((lbl) => (
                          <Badge key={lbl} variant="secondary" className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200">
                            🏷️ {lbl}
                          </Badge>
                        ))}
                      </div>
                      <CardTitle className="text-base font-bold text-foreground leading-snug">{note.subject}</CardTitle>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-amber-700" onClick={() => handleOpenEdit(note)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(note.id, note.subject)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3 text-amber-600" /> {note.date}
                    </span>
                    {note.authorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-amber-600" /> {note.authorName}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 flex-1 space-y-3">
                  {note.body && (
                    <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {note.body}
                    </p>
                  )}

                  {/* Checklist Section */}
                  {checklistItems.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <CheckSquare className="h-3.5 w-3.5" /> Operational Checklist
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {completedCount} / {checklistItems.length} ({progressPercent}%)
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-1.5 bg-amber-100 dark:bg-amber-950" />

                      <div className="space-y-1.5 pt-1">
                        {checklistItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => toggleManagementChecklistItem(note.id, item.id)}
                            className="flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox checked={item.completed} onCheckedChange={() => toggleManagementChecklistItem(note.id, item.id)} />
                            <span className={item.completed ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-10 text-center border-dashed">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
            <NotebookPen className="h-10 w-10 text-amber-500" />
            <h3 className="text-lg font-bold">No Management Notes Found</h3>
            <p className="text-xs text-muted-foreground">
              {searchQuery || selectedLabelFilter !== 'All'
                ? 'No notes match your active search or label filter.'
                : 'Click "Generate New Note" above to create operational notes with subjects, folder labels, and checklists.'}
            </p>
            <Button onClick={handleOpenCreate} className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 mt-2">
              <Plus className="h-3.5 w-3.5" /> Generate First Note
            </Button>
          </div>
        </Card>
      )}

      {/* Create / Edit Note Dialog Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <NotebookPen className="h-5 w-5 text-amber-600" />
              {editingNote ? 'Edit Management Note' : 'Generate New Management Note'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Fill in the subject, date, body notes, label folders, and optional checklist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject / Title *</Label>
              <Input
                placeholder="e.g. Weekly Production & Machinery Audit"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Note Date</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            {/* Labels / Folders Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-amber-600" /> Folder Labels (Select or Add New)
              </Label>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {allAvailableLabels.map((lbl) => {
                  const isSelected = formLabels.includes(lbl);
                  return (
                    <Badge
                      key={lbl}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer text-xs px-2.5 py-1 ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'hover:bg-amber-100 dark:hover:bg-amber-950'
                      }`}
                      onClick={() => handleToggleFormLabel(lbl)}
                    >
                      🏷️ {lbl}
                    </Badge>
                  );
                })}
              </div>

              {/* Add Custom Label */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Add custom folder label tag..."
                  value={customLabelInput}
                  onChange={(e) => setCustomLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomLabel();
                    }
                  }}
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddCustomLabel} className="h-8 text-xs shrink-0">
                  + Add Tag
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Body Notes Content</Label>
              <Textarea
                placeholder="Enter detailed notes, observation logs, operational instructions..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                className="text-xs min-h-[100px]"
              />
            </div>

            {/* Optional Checklist Builder */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CheckSquare className="h-3.5 w-3.5 text-amber-600" /> Optional Checklist Items
              </Label>

              {/* Added Checklist Items List */}
              {formChecklist.length > 0 && (
                <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-lg border">
                  {formChecklist.map((item, i) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs bg-background p-2 rounded border">
                      <span className="font-medium text-foreground">
                        {i + 1}. {item.text}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. Inspect Mixer A seals and grease fittings..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  className="text-xs h-8"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddChecklistItem} className="h-8 text-xs shrink-0">
                  + Add Item
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveNote} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
              Save Management Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
