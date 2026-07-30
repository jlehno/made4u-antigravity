"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useProduction } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, X, Sparkles, User, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      text: "Hello! I'm your Made4U AI Muffin helper 🧁! Ask me anything about your production schedule, products, prep steps, employee availability, or machinery.",
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
    hrNotes,
  } = useProduction();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

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
      const contextData = {
        productsCount: products.length,
        products: products.slice(0, 15).map((p) => ({ name: p.name, coPacker: p.coPacker, yield: p.yieldPerBatch })),
        prepStepsCount: prepSteps.length,
        prepSteps: prepSteps.slice(0, 15).map((ps) => ({ title: ps.title, product: ps.productName, day: ps.prepDay })),
        tasks: tasks.slice(0, 15).map((t) => t.name),
        machinery: machinery.slice(0, 10).map((m) => ({ name: m.name, qty: m.quantity })),
        employees: users.map((u) => ({ name: u.name, role: u.role })),
        scheduleDates: Object.keys(schedule || {}).slice(-7),
        availabilityDates: Object.keys(availability || {}).slice(-7),
        shoppingListCount: shoppingList.length,
      };

      const res = await fetch('/api/gemini/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          contextData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get answer.');
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.response || "I have received your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Sorry, I ran into an error: ${err.message || 'Please check your connection or GEMINI_API_KEY.'}`,
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
                    Gemini 2.5
                  </Badge>
                </CardTitle>
                <p className="text-xs text-amber-100 font-normal">Ask about schedule, prep, staffing & data</p>
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
                  <span>🧁</span> Thinking & checking Made4U data...
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
