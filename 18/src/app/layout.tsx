
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ProductionProvider } from '@/lib/store';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ProductionFlow',
  description: 'Streamline your production process with ProductionFlow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ProductionFlow" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                var msg = e && e.message ? e.message.toLowerCase() : '';
                if (msg.indexOf('loading chunk') !== -1 || msg.indexOf('script error') !== -1 || msg.indexOf('unexpected token') !== -1) {
                  if (!sessionStorage.getItem('pwa_auto_refreshed')) {
                    sessionStorage.setItem('pwa_auto_refreshed', '1');
                    window.location.reload(true);
                  }
                }
              }, true);
            `,
          }}
        />
      </head>
      <body className={cn(inter.variable, "font-body antialiased")}>
        <ProductionProvider>
          {children}
        </ProductionProvider>
        <Toaster />
      </body>
    </html>
  );
}
