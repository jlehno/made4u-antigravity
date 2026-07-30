"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useProduction } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, X, User, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function MuffinAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Hello! I'm your Made4U AI Muffin helper 🧁! Ask me anything about your production schedule, products, prep steps, employee availability, machinery equipment, shopping list, or pallet storage.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    products,
    schedule,
    prepSteps,
    tasks,
    machinery,
    users,
    availability,
    confirmedHours,
    shoppingList,
    palletStorage,
    processTimeEntries,
    calendarNotes,
  } = useProduction();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Client-side AI Data Analyzer for Made4U App Data
  const analyzeMade4UData = (prompt: string): string => {
    const p = prompt.toLowerCase().trim();

    // 1. Machinery & Equipment
    if (p.includes('machinery') || p.includes('equipment') || p.includes('machine') || p.includes('tools')) {
      if (!machinery || machinery.length === 0) {
        return "⚙️ **Machinery & Equipment Overview**\nNo machinery equipment currently registered in Made4U.";
      }
      const lines = machinery.map((m) => {
        const assignedProds = products
          .filter((prod) => prod.machineryIds?.includes(m.id))
          .map((prod) => prod.name);
        const assignedText = assignedProds.length > 0 ? ` (Assigned to: ${assignedProds.join(', ')})` : '';
        return `• **${m.name}** — Quantity: **${m.quantity || 1}**${assignedText}`;
      });
      return `🛠️ **Made4U Machinery & Equipment** (${machinery.length} registered)\n\n${lines.join('\n')}`;
    }

    // 2. Products & Recipes
    if (p.includes('product') || p.includes('item') || p.includes('co-packer') || p.includes('copacker') || p.includes('yield') || p.includes('batch')) {
      if (!products || products.length === 0) {
        return "📦 **Products Overview**\nNo products currently created in Made4U.";
      }
      const lines = products.map((prod) => {
        return `• **${prod.name}** (Co-Packer: *${prod.coPacker || 'N/A'}*)\n  - Yield/Batch: ${prod.yieldPerBatch || 'N/A'} units | Batch Size: ${prod.batchSizeLbs || 'N/A'} lbs\n  - Target Weights: Deposit ${prod.targetDepositWeight || 'N/A'} / Finished ${prod.targetFinishedWeight || 'N/A'}\n  - Allergens: ${prod.allergens || 'None'}`;
      });
      return `📦 **Made4U Product Catalog** (${products.length} products)\n\n${lines.join('\n\n')}`;
    }

    // 3. Prep Steps
    if (p.includes('prep') || p.includes('step') || p.includes('preparation') || p.includes('recipe')) {
      if (!prepSteps || prepSteps.length === 0) {
        return "🥣 **Prep Steps Overview**\nNo prep steps registered yet.";
      }
      const lines = prepSteps.map((ps) => {
        const status = ps.isCompleted ? "✅ Completed" : "⏳ Pending";
        return `• **${ps.title}** (${ps.productName || 'General Product'})\n  - Prep Day: ${ps.prepDay || 'Unscheduled'} | Time: ${ps.timeOfDay || 'N/A'} | Status: ${status}${ps.notes ? `\n  - Notes: ${ps.notes}` : ''}`;
      });
      return `🥣 **Made4U Prep Steps** (${prepSteps.length} steps)\n\n${lines.join('\n\n')}`;
    }

    // 4. Schedule & Production
    if (p.includes('schedule') || p.includes('today') || p.includes('week') || p.includes('calendar') || p.includes('bay') || p.includes('planned')) {
      const dates = Object.keys(schedule || {});
      if (dates.length === 0) {
        return "📅 **Production Schedule**\nNo production schedule items booked yet. Add production items on the Calendar tab!";
      }
      let responseText = `📅 **Made4U Scheduled Production** (${dates.length} scheduled dates)\n\n`;
      dates.slice(-5).forEach((dateStr) => {
        responseText += `📆 **${dateStr}**:\n`;
        const dayProd = schedule[dateStr];
        Object.entries(dayProd || {}).forEach(([bay, items]: [string, any]) => {
          if (Array.isArray(items) && items.length > 0) {
            responseText += `  • **${bay} Bay**:\n`;
            items.forEach((it: any) => {
              const prod = products.find((p) => p.id === it.productId);
              responseText += `    - ${prod?.name || 'Product'} (${it.batches} batches${it.startTime ? ` @ ${it.startTime}` : ''})\n`;
            });
          }
        });
        responseText += `\n`;
      });
      return responseText.trim();
    }

    // 5. Staffing, Users & Availability
    if (p.includes('staff') || p.includes('employee') || p.includes('user') || p.includes('available') || p.includes('role') || p.includes('hours') || p.includes('team')) {
      if (!users || users.length === 0) {
        return "👥 **Staff & Team**\nNo user accounts added yet.";
      }
      const staffLines = users.map((u) => `• **${u.name}** — Role: *${u.role.toUpperCase()}*`);
      return `👥 **Made4U Team Roster** (${users.length} members)\n\n${staffLines.join('\n')}\n\n💡 *Tip: Check the Staffing tab for weekly availability and confirmed hours.*`;
    }

    // 6. Shopping List
    if (p.includes('shopping') || p.includes('grocery') || p.includes('store') || p.includes('buy') || p.includes('ingredient') || p.includes('supplies')) {
      if (!shoppingList || shoppingList.length === 0) {
        return "🛒 **Shopping List**\nYour shopping list is currently empty!";
      }
      const items = shoppingList.map((item) => {
        const check = item.isChecked ? "✅ [Checked]" : "📌 [To Buy]";
        return `• ${check} **${item.name}** — Qty: ${item.quantity || 1} ${item.unit || ''} (Store: ${item.store || 'General'}, Cat: ${item.category || 'General'})`;
      });
      return `🛒 **Made4U Shopping List** (${shoppingList.length} items)\n\n${items.join('\n')}`;
    }

    // 7. Pallet Storage
    if (p.includes('pallet') || p.includes('storage') || p.includes('client')) {
      if (!palletStorage || palletStorage.length === 0) {
        return "📦 **Pallet Storage**\nNo pallet storage entries recorded.";
      }
      const items = palletStorage.map((entry) => `• **${entry.clientName}**: ${entry.palletCount} pallets${entry.notes ? ` (${entry.notes})` : ''}`);
      return `📦 **Pallet Storage Overview**\n\n${items.join('\n')}`;
    }

    // 8. General System Overview Summary
    return `🧁 **Made4U System Summary**\n\n` +
      `• **Products**: ${products?.length || 0} registered products\n` +
      `• **Machinery**: ${machinery?.length || 0} machinery units\n` +
      `• **Prep Steps**: ${prepSteps?.length || 0} active prep steps\n` +
      `• **Team Members**: ${users?.length || 0} staff members\n` +
      `• **Shopping List**: ${shoppingList?.length || 0} items\n` +
      `• **Scheduled Dates**: ${Object.keys(schedule || {}).length} scheduled calendar days\n\n` +
      `Ask me specific questions like *"List machinery equipment"*, *"What products are scheduled?"*, or *"Show prep steps overview"* for detailed insights!`;
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      let aiResponseText = '';
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const contextData = {
            products: products.map((p) => ({ name: p.name, coPacker: p.coPacker, yield: p.yieldPerBatch })),
            prepSteps: prepSteps.map((ps) => ({ title: ps.title, product: ps.productName, day: ps.prepDay })),
            tasks: tasks.map((t) => t.name),
            machinery: machinery.map((m) => ({ name: m.name, qty: m.quantity })),
            employees: users.map((u) => ({ name: u.name, role: u.role })),
            schedule: schedule,
            shoppingList: shoppingList.map((s) => ({ name: s.name, qty: s.quantity })),
          };

          const systemInstruction = `You are Made4U Flow AI Helper, a friendly, accurate AI assistant for the Made4U production scheduling app.
Answer user questions based on this live application data snapshot:
${JSON.stringify(contextData, null, 2)}`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nUser Question: ${textToSend}` }]
              }
            ]
          });

          if (response.text) {
            aiResponseText = response.text;
          }
        } catch (genAiErr) {
          console.warn('Direct Gemini API call failed, falling back to local analyzer:', genAiErr);
        }
      }

      // If no API key or direct API call wasn't used/failed, use smart client-side analyzer
      if (!aiResponseText) {
        aiResponseText = analyzeMade4UData(textToSend);
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const fallbackText = analyzeMade4UData(textToSend);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "What products are scheduled?",
    "Who is available this week?",
    "Show prep steps overview",
    "List machinery equipment",
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Floating Muffin Window */}
      {isOpen && (
        <Card className="w-[360px] sm:w-[400px] h-[520px] shadow-2xl border-2 border-amber-200 dark:border-amber-800/50 mb-3 flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200 rounded-2xl overflow-hidden bg-background">
          {/* Header */}
          <CardHeader className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm flex items-center justify-center text-xl">
                🧁
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-1.5 text-white">
                  Made4U AI Assistant
                  <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 text-[10px] px-1.5 py-0 border-none">
                    Made4U AI
                  </Badge>
                </CardTitle>
                <p className="text-xs text-amber-100 font-normal">Ask about schedule, prep, machinery & data</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Messages Body */}
          <CardContent className="flex-1 p-3 overflow-hidden flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                    msg.sender === 'user'
                      ? "ml-auto bg-amber-600 text-white rounded-br-none"
                      : "mr-auto bg-muted border border-border text-foreground rounded-bl-none"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-[10px] opacity-80 mb-1">
                    {msg.sender === 'user' ? (
                      <>
                        <User className="h-3 w-3" /> You
                      </>
                    ) : (
                      <>
                        <span>🧁</span> Made4U Helper
                      </>
                    )}
                    <span className="ml-auto font-normal text-[9px] opacity-70">{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))}

              {isLoading && (
                <div className="mr-auto bg-muted border border-border p-3 rounded-2xl rounded-bl-none text-xs flex items-center gap-2 text-muted-foreground animate-pulse">
                  <span>🧁</span> Analyzing Made4U app data...
                  <RefreshCw className="h-3 w-3 animate-spin ml-1" />
                </div>
              )}
            </div>

            {/* Quick Suggestions */}
            <div className="pt-2 flex flex-wrap gap-1.5 border-t mt-2">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(sug)}
                  disabled={isLoading}
                  className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-full px-2.5 py-1 transition-colors text-left font-medium"
                >
                  ✨ {sug}
                </button>
              ))}
            </div>
          </CardContent>

          {/* Footer Input */}
          <CardFooter className="p-2.5 border-t bg-muted/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 w-full"
            >
              <Input
                placeholder="Ask muffin about app data..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="text-xs h-9 bg-background focus-visible:ring-amber-500"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="h-9 w-9 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* Floating Muffin Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 ring-4 ring-amber-200/50 dark:ring-amber-900/50 active:scale-95"
        title="Open Made4U AI Helper"
      >
        <span className="text-2xl transition-transform duration-200 group-hover:scale-110">🧁</span>
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[9px] font-bold text-white items-center justify-center">AI</span>
        </span>
      </button>
    </div>
  );
}
