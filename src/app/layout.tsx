import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import AppLayout from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import { DebugProvider } from '@/context/DebugContext';
import { AppStateProvider } from '@/context/AppStateContext';

export const metadata: Metadata = {
  title: 'CodeAlchemist',
  description: 'Plataforma de desarrollo asistido por IA.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AppStateProvider>
          <DebugProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster />
          </DebugProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
