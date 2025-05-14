// src/app/error.tsx
"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * @fileOverview Global Error Boundary for the application.
 * Catches errors during rendering and in Server Components/Actions.
 * Provides a user-friendly fallback UI and a way to attempt recovery.
 */

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * GlobalError component that serves as the root error boundary.
 *
 * @param {GlobalErrorProps} props - The props for the component.
 * @param {Error & { digest?: string }} props.error - The error object.
 * @param {() => void} props.reset - A function to attempt to re-render the route segment.
 * @returns {JSX.Element} The rendered global error fallback UI.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  useEffect(() => {
    // Log the error to a centralized monitoring system in production
    console.error("GlobalError caught an error:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    if (error.digest) {
      console.error("Error digest (Next.js specific for server errors):", error.digest);
    }
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="mt-4 text-2xl">¡Ups! Algo salió mal</CardTitle>
          <CardDescription>
            Lo sentimos, encontramos un error inesperado. Nuestro equipo ha sido notificado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Puedes intentar recargar la página o volver a la acción anterior.
          </p>
          {process.env.NODE_ENV === 'development' && error?.message && (
            <div className="mt-4 p-3 bg-muted rounded-md text-left text-xs overflow-auto max-h-32">
              <p className="font-semibold">Detalles del Error (Solo Desarrollo):</p>
              <pre className="whitespace-pre-wrap">{error.message}</pre>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={() => reset()} variant="outline">
            Intentar de Nuevo
          </Button>
          <Button onClick={() => window.location.href = '/'}>
            Ir a la Página Principal
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
