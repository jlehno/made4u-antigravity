// src/ai/flows/production-insights.ts
/**
 * @fileOverview A production insights AI agent.
 *
 * - generateProductionInsights - A function that handles the generation of production insights.
 * - ProductionInsightsInput - The input type for the generateProductionInsights function.
 * - ProductionInsightsOutput - The return type for the generateProductionInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProductionInsightsInputSchema = z.object({
  productionData: z
    .string()
    .describe('Past production data, including task assignments, timelines, and quantities.'),
});
export type ProductionInsightsInput = z.infer<typeof ProductionInsightsInputSchema>;

const ProductionInsightsOutputSchema = z.object({
  insights: z.string().describe('AI-generated insights on discrepancies, delays, and common problems.'),
  suggestions: z.string().describe('Proactive suggestions to improve production flow and efficiency.'),
});
export type ProductionInsightsOutput = z.infer<typeof ProductionInsightsOutputSchema>;

export async function generateProductionInsights(input: ProductionInsightsInput): Promise<ProductionInsightsOutput> {
  return productionInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'productionInsightsPrompt',
  input: {schema: ProductionInsightsInputSchema},
  output: {schema: ProductionInsightsOutputSchema},
  prompt: `You are an AI assistant designed to analyze production data and provide insights for improvement.

  Analyze the following production data:
  {{productionData}}

  Identify any discrepancies, delays, or common problems.
  Provide proactive suggestions to improve production flow and efficiency.
  Format your response in a structured manner, clearly separating insights and suggestions.
  `,
});

const productionInsightsFlow = ai.defineFlow(
  {
    name: 'productionInsightsFlow',
    inputSchema: ProductionInsightsInputSchema,
    outputSchema: ProductionInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
