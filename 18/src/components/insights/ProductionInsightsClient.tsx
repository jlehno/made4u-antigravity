"use client"

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

interface ProductionInsightsOutput {
  insights: string;
  suggestions: string;
}

const insightsSchema = z.object({
  productionData: z.string().min(50, {
    message: "Production data must be at least 50 characters.",
  }),
});

type InsightsSchema = z.infer<typeof insightsSchema>;

export function ProductionInsightsClient() {
  const { schedule, assignments, products, tasks, users } = useProduction();
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
        items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          formattedString += `    - Product: ${product?.name || 'Unknown'}, Batches: ${item.batches}\n`;
        });
        
        const dayAssignments = assignments[date]?.[bay] || [];
        if (dayAssignments.length > 0) {
            formattedString += `    Assignments:\n`
            dayAssignments.forEach(assignment => {
                if(!assignment.hidden) {
                    const task = tasks.find(t => t.id === assignment.taskId);
                    const assignedEmployees = assignment.employeeIds.map(id => users.find(e => e.id === id)?.name).filter(Boolean);
                    formattedString += `      - Task: ${task?.name || 'Unknown'}, Assigned to: ${assignedEmployees.join(', ') || 'None'}\n`;
                }
            });
        }
      });
      formattedString += "\n";
    });
    if(formattedString.length < 50) return "No sufficient production data recorded yet. Please use the calendar and task tabs to create a production schedule."
    return formattedString;
  };

  const handleAutofill = () => {
    const data = formatDataForAI();
    form.setValue("productionData", data);
  };
  
  const onSubmit = async (data: InsightsSchema) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to generate insights");
      }
      const insights = await response.json();
      setResult(insights);
    } catch (e: any) {
      setError("Failed to generate insights. Please try again.");
      console.error(e);
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
          <AlertTitle>Error</AlertTitle>
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
                <Button variant="outline" onClick={() => {
                    navigator.clipboard.writeText(`Insights:\n${result.insights}\n\nSuggestions:\n${result.suggestions}`);
                    toast({title: "Copied to clipboard!"})
                }}>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copy Report
                </Button>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}
