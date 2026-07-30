import { NextRequest, NextResponse } from 'next/server';
import { generateProductionInsights } from '@/ai/flows/production-insights';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateProductionInsights(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error generating insights:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
