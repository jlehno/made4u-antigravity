"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Client Exception caught by Next.js Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="max-w-md w-full text-center border-amber-200/40 shadow-xl">
        <CardHeader>
          <div className="mx-auto p-3 bg-amber-500/10 rounded-full text-amber-600 mb-2">
            <AlertCircle className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl font-bold">ProductionFlow</CardTitle>
          <CardDescription className="text-xs">
            A temporary browser exception occurred while loading the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              } else {
                reset();
              }
            }}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Go to Login Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
