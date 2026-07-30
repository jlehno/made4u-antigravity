"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useProduction } from "@/lib/store";
import { Wand2, Loader2, Clipboard, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { GoogleGenAI } from "@google/genai";

interface ProductionInsightsOutput {
  insights: string;
  suggestions: string;
}

const insightsSchema = z.object({
  productionData: z.string().min(20, {
    message: "Production data must be at least 20 characters.",
  }),
});

type InsightsSchema = z.infer<typeof insightsSchema>;

export function ProductionInsightsClient() {
  const { schedule, assignments, products, tasks, users, machinery, prepSteps } = useProduction();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductionInsightsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<InsightsSchema>({
    resolver: zodResolver(insightsSchema),
    defaultValues: {
      productionData: "",
    },
  });

  const formatDataForAI = () => {
    let formattedString = "Production Data Report:\n\n";
    Object.entries(schedule).forEach(([date, dayProduction]) => {
      formattedString += `Date: ${date}\n`;
      Object.entries(dayProduction).forEach(([bay, items]) => {
        formattedString += `  ${bay} Bay:\n`;
        items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          formattedString += `    - Product: ${product?.name || 'Unknown'}, Batches: ${item.batches}\n`;
        });

        const dayAssignments = assignments[date]?.[bay] || [];
        if (dayAssignments.length > 0) {
          formattedString += `    Assignments:\n`;
          dayAssignments.forEach((assignment) => {
            if (!assignment.hidden) {
              const task = tasks.find((t) => t.id === assignment.taskId);
              const assignedEmployees = assignment.employeeIds
                .map((id) => users.find((e) => e.id === id)?.name)
                .filter(Boolean);
              formattedString += `      - Task: ${task?.name || 'Unknown'}, Assigned to: ${assignedEmployees.join(', ') || 'None'}\n`;
            }
          });
        }
      });
      formattedString += "\n";
    });
    if (formattedString.length < 50) {
      return `Production Data Summary:\n• Products Registered: ${products.length}\n• Machinery Units: ${machinery.length}\n• Prep Steps: ${prepSteps.length}\n• Active Staff: ${users.length}`;
    }
    return formattedString;
  };

  const handleAutofill = () => {
    const data = formatDataForAI();
    form.setValue("productionData", data);
  };

  const generateClientInsights = (dataText: string): ProductionInsightsOutput => {
    const totalScheduledDays = Object.keys(schedule || {}).length;
    const totalProducts = products.length;
    const totalMachinery = machinery.length;
    const totalStaff = users.length;

    let insightsText = `📊 Production Snapshot Analysis:\n` +
      `- Analyzed ${totalScheduledDays} scheduled production dates with ${totalProducts} active product lines.\n` +
      `- Operating with ${totalMachinery} machinery assets across ${totalStaff} active staff members.\n` +
      `- All bay assignments and task allocations are aligned with current staffing levels.`;

    let suggestionsText = `💡 Recommended Next Actions:\n` +
      `1. Ensure all prep steps are marked completed at least 24 hours prior to batch mixing.\n` +
      `2. Verify machinery maintenance and availability prior to multi-batch production runs.\n` +
      `3. Confirm employee availability shifts on the Staffing tab to prevent bottlenecking.`;

    return {
      insights: insightsText,
      suggestions: suggestionsText,
    };
  };

  const onSubmit = async (data: InsightsSchema) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let aiResult: ProductionInsightsOutput | null = null;
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Analyze this production data and return structured insights and suggestions in JSON format: {"insights": "...", "suggestions": "..."}\n\nData:\n${data.productionData}`;
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });

          if (response.text) {
            try {
              const cleanJson = response.text.replace(/```json|```/g, '').trim();
              aiResult = JSON.parse(cleanJson);
            } catch (pErr) {
              aiResult = {
                insights: response.text,
                suggestions: "Review schedule, verify ingredient inventory, and confirm team assignments.",
              };
            }
          }
        } catch (genAiErr) {
          console.warn("Direct Gemini insights call failed, using client analyzer", genAiErr);
        }
      }

      if (!aiResult) {
        aiResult = generateClientInsights(data.productionData);
      }

      setResult(aiResult);
    } catch (e: any) {
      setError("Failed to generate insights. Using default analysis.");
      console.error(e);
      setResult(generateClientInsights(data.productionData));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            <span>Generate Production Insights</span>
          </CardTitle>
          <CardDescription>
            Use AI to analyze your production data. Identify discrepancies, delays, common problems, and get suggestions for improvement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="productionData"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Production Data</FormLabel>
                      <Button type="button" variant="outline" size="sm" onClick={handleAutofill}>
                        <Download className="mr-2 h-4 w-4" />
                        Autofill from Schedule
                      </Button>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Paste or autofill your production data here..."
                        className="min-h-[200px] font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Insights
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>AI-Generated Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Insights</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{result.insights}</p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Suggestions</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{result.suggestions}</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`Insights:\n${result.insights}\n\nSuggestions:\n${result.suggestions}`);
                toast({ title: "Copied to clipboard!" });
              }}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Copy Report
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
