
// src/app/error.tsx
"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview Global Error Boundary for the application.
 * Catches errors during rendering and in Server Components/Actions.
 * Provides a user-friendly fallback UI and a way to attempt recovery.
 * This component is internationalized.
 */

/**
 * Props for the GlobalError component.
 */
interface GlobalErrorProps {
  /** The error object that was caught. */
  error: Error & { digest?: string };
  /** A function to attempt to re-render the route segment. */
  reset: () => void;
}

/**
 * GlobalError component that serves as the root error boundary.
 *
 * @param {GlobalErrorProps} props - The props for the component.
 * @returns {JSX.Element} The rendered global error fallback UI.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  const { t } = useI18n();

  useEffect(() => {
    // Log the error to a centralized monitoring system in production
    console.error("[GlobalError caught an error]:", error);
    if (error.message) {
      console.error("Error Message:", error.message);
    }
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    if (error.digest) {
      console.error("Error digest (Next.js specific for server errors):", error.digest);
    }
    // En producción, enviar este 'error' a Sentry.
    // Ejemplo:
    // import * as Sentry from "@sentry/nextjs";
    // Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl">{t('error.globalError.title' as TranslationKey)}</CardTitle>
          <CardDescription>
            {t('error.globalError.description' as TranslationKey)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('error.globalError.recoverySuggestion' as TranslationKey)}
          </p>
          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="mt-4 p-3 bg-muted rounded-md text-left text-xs overflow-auto max-h-32">
              <p className="font-semibold">{t('error.globalError.devDetailsTitle' as TranslationKey)}</p>
              <pre className="whitespace-pre-wrap">{error.message}</pre>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => reset()} variant="outline">
            {t('error.globalError.retryButton' as TranslationKey)}
          </Button>
          <Button onClick={() => window.location.href = '/'}>
            {t('error.globalError.homeButton' as TranslationKey)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
