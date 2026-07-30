"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function PalletStorageClient() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="w-full h-[calc(100vh-90px)] lg:h-[calc(100vh-110px)] min-h-[500px]">
      <Card className="w-full h-full p-0 overflow-hidden relative shadow-sm border">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Pallet Storage Application...</p>
            </div>
          </div>
        )}
        <iframe
          src="https://made4u-pallet-storage-360969416917.us-east1.run.app/"
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
          title="Made4U Pallet Storage"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
        />
      </Card>
    </div>
  );
}
