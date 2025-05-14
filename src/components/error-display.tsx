
"use client";

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, AlertTriangle, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { useAI } from '@/hooks/useAI'; // Assuming a hook for AI interactions

interface ErrorDisplayProps {
  error: string | Error | null;
  context?: any; // Optional context for Auto-Fix
  onAutoFix?: (error: string, context?: any) => Promise<void>; // Specific auto-fix handler
}

export default function ErrorDisplay({ error, context, onAutoFix }: ErrorDisplayProps) {
  const { toast } = useToast();
  // const { fixErrorWithAI } = useAI(); // Example usage
  const [isAutoFixing, setIsAutoFixing] = React.useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  const handleCopyError = () => {
    navigator.clipboard.writeText(errorMessage);
    toast({
      title: "Error Copiado",
      description: "El mensaje de error ha sido copiado al portapapeles.",
    });
  };

  const handleAutoFix = async () => {
    if (onAutoFix) {
      setIsAutoFixing(true);
      try {
        await onAutoFix(errorMessage, context);
        toast({ title: "Auto-Fix Iniciado", description: "Intentando corregir el error..." });
      } catch (e) {
        toast({ variant: "destructive", title: "Error en Auto-Fix", description: "No se pudo iniciar el proceso de Auto-Fix." });
      } finally {
        setIsAutoFixing(false);
      }
    } else {
       // Generic Auto-Fix (example)
       setIsAutoFixing(true);
       // await fixErrorWithAI(errorMessage, context);
       toast({ title: "Auto-Fix (simulado)", description: "La IA está analizando el error." });
       // Simulate AI processing
       setTimeout(() => {
         toast({ title: "Sugerencia de Auto-Fix", description: "La IA sugiere revisar la configuración de red." });
         setIsAutoFixing(false);
       }, 2000);
    }
  };

  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        <p className="mb-2 break-words">{errorMessage}</p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={handleCopyError}>
            <Copy className="mr-2 h-4 w-4" /> Copiar Error
          </Button>
          {(onAutoFix || true) && ( // Enable if onAutoFix prop exists or always for generic
            <Button variant="outline" size="sm" onClick={handleAutoFix} disabled={isAutoFixing}>
              <Wand2 className="mr-2 h-4 w-4" /> {isAutoFixing ? "Analizando..." : "Auto-Fix"}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
