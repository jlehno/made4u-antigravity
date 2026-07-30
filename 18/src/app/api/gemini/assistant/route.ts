import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, history, contextData } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is not configured.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are Made4U Flow AI Helper, a friendly, accurate, and concise AI assistant built into the Made4U production scheduling and staffing management app.
Your role is to answer user questions about products, production schedules, prep steps, staff availability, confirmed hours, task assignments, machinery, shopping lists, and pallet storage in Made4U.

Here is the live data snapshot from the Made4U application:
${JSON.stringify(contextData || {}, null, 2)}

Instructions:
1. Provide accurate, clear, and direct answers based on the live data provided above.
2. If data is missing or empty, explain politely what is currently present.
3. Keep responses structured, easy to read, and helpful for bakery/production staff and admins.
4. Always speak warmly and professionally.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nUser Question: ${prompt}` }]
      }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents as any,
    });

    const text = response.text || "I'm sorry, I couldn't generate a response at this time.";

    return NextResponse.json({ response: text });
  } catch (error: any) {
    console.error('Error in AI Assistant API:', error);
    const errorMsg = error?.message || '';
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      return NextResponse.json(
        { error: 'The AI assistant is temporarily busy due to rate limits. Please try again in a few seconds.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: errorMsg || 'An error occurred while communicating with Gemini API.' },
      { status: 500 }
    );
  }
}
