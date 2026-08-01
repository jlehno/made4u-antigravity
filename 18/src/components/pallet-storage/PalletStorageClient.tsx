"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';

export function PalletStorageClient() {
  const [isLoading, setIsLoading] = useState(true);
  const PALLET_APP_URL = "https://made4u-pallet-storage-360969416917.us-east1.run.app/";

  return (
    <div className="w-full flex flex-col gap-3 h-[calc(100dvh-120px)] min-h-[500px]">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 px-3 bg-muted/60 border rounded-lg text-sm">
        <span className="text-muted-foreground font-medium">
          Mobile Google Sign-In Issue?
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8 bg-background shadow-xs hover:bg-accent"
          onClick={() => window.open(PALLET_APP_URL, '_blank', 'noopener,noreferrer')}
        >
          <span>Open Pallet Storage in New Tab</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Card className="w-full flex-1 p-0 overflow-hidden relative shadow-sm border">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Pallet Storage Application...</p>
            </div>
          </div>
        )}
        <iframe
          src={PALLET_APP_URL}
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
          title="Made4U Pallet Storage"
          allow="clipboard-write; identity-credentials-get; storage-access; popups; popups-to-escape-sandbox"
        />
      </Card>
    </div>
  );
}
