
"use client";

import React, { useState } from 'react'; // Added useState
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, AlertTriangle, Wand2, Loader2, MessageSquareText, ChevronDown, ChevronUp } from 'lucide-react'; // Added Loader2, MessageSquareText, Chevrons
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import { useDebug } from '@/context/DebugContext';
import { callAutoFixErrorWithGroup } from '@/utils/apiClient'; // Import the new API client function
import type { AutoFixErrorWithGroupOutput } from '@/types';
import { AppError } from '@/utils/AppError';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

/**
 * @fileOverview ErrorDisplay component provides a standardized way to display errors
 * to the user, with options to copy the error and attempt an AI-driven auto-fix.
 */

/**
 * Props for the ErrorDisplay component.
 */
interface ErrorDisplayProps {
  /** The error message or Error object to display. If null, the component renders nothing. */
  error: string | Error | null;
  /**
   * Optional additional context that might be useful for the Auto-Fix AI.
   * Could be a code snippet, user input that led to the error, etc.
   */
  context?: string;
  /**
   * Optional. A specific handler to invoke for the Auto-Fix action.
   * If not provided, a default AI-based auto-fix mechanism will be attempted.
   * @param {string} errorMsg - The error message to fix.
   * @param {string} [context] - Optional context for the fix.
   * @returns {Promise<void>}
   */
  onAutoFix?: (errorMsg: string, context?: string) => Promise<void>;
}

/**
 * ErrorDisplay component.
 * Renders an alert with the error message, a "Copiar Error" button,
 * and an "Auto-Fix" button that attempts to use AI to suggest a solution.
 * The Auto-Fix feature now uses the 'EquipoDesarrolloSoftware' group.
 *
 * @param {ErrorDisplayProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered error display alert, or null if no error.
 */
export default function ErrorDisplay({ error, context, onAutoFix }: ErrorDisplayProps) {
  const { toast } = useToast();
  const { addLog } = useDebug();
  const { agents, groups } = useAppState(); // To get group info for auto-fix

  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixErrorWithGroupOutput | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  const handleCopyError = () => {
    navigator.clipboard.writeText(errorMessage);
    toast({
      title: "Error Copiado",
      description: "El mensaje de error ha sido copiado al portapapeles.",
    });
    addLog({source: "ErrorDisplay", type: "INFO", message: "Error copiado por el usuario.", data: { error: errorMessage }});
  };

  const handleAttemptAutoFix = async () => {
    if (onAutoFix) { // If a custom handler is provided
      setIsAutoFixing(true);
      try {
        addLog({source: "ErrorDisplay", type: "INFO", message: "Iniciando Auto-Fix personalizado...", data: { error: errorMessage, context }});
        await onAutoFix(errorMessage, context);
      } catch (e) {
        const err = e as Error;
        toast({ variant: "destructive", title: "Error en Auto-Fix", description: err.message || "No se pudo iniciar el proceso de Auto-Fix personalizado." });
        addLog({source: "ErrorDisplay", type: "ERROR", message: "Fallo el Auto-Fix personalizado.", data: { error: err.message }});
      } finally {
        setIsAutoFixing(false);
      }
      return;
    }

    // Default Auto-Fix using 'EquipoDesarrolloSoftware'
    setIsAutoFixing(true);
    setAutoFixResult(null); // Clear previous results
    toast({ title: "Intentando Auto-Corrección", description: "Consultando al 'EquipoDesarrolloSoftware' para una posible solución..." });
    addLog({source: "ErrorDisplay", type: "INFO", message: "Invocando 'EquipoDesarrolloSoftware' para Auto-Fix.", data: { error: errorMessage, context }});

    try {
      const result = await callAutoFixErrorWithGroup({
        errorMessage,
        codeContext: context,
      });
      setAutoFixResult(result);
      setIsModalOpen(true);
      toast({ title: "Sugerencia de Auto-Corrección Recibida", description: "El 'EquipoDesarrolloSoftware' ha proporcionado una sugerencia." });
      addLog({source: "ErrorDisplay", type: "SUCCESS", message: "Sugerencia de Auto-Fix recibida del grupo.", data: result });
    } catch (e: any) {
      const appError = e instanceof AppError ? e : new AppError("Falló la solicitud de auto-corrección al grupo.", e, 'ai');
      toast({ variant: "destructive", title: "Error en Auto-Corrección", description: appError.friendlyMessage });
      addLog({source: "ErrorDisplay", type: "ERROR", message: "Fallo al obtener sugerencia de Auto-Fix del grupo.", errorDetails: appError.originalError || appError, friendlyMessage: appError.friendlyMessage });
    } finally {
      setIsAutoFixing(false);
    }
  };

  return (
    <>
      <Alert variant="destructive" className="my-4 shadow-md">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-semibold">Error Detectado</AlertTitle>
        <AlertDescription>
          <p className="mb-3 text-sm break-words">{errorMessage}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleCopyError} className="border-destructive/70 hover:bg-destructive/10 text-destructive-foreground">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Error
            </Button>
            <Button variant="outline" size="sm" onClick={handleAttemptAutoFix} disabled={isAutoFixing} className="border-destructive/70 hover:bg-destructive/10 text-destructive-foreground">
              {isAutoFixing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
              {isAutoFixing ? "Analizando..." : "Auto-Fix con IA"}
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {autoFixResult && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wand2 className="h-6 w-6 text-accent" />
                Sugerencia de Auto-Corrección del Equipo de Software
              </DialogTitle>
              <DialogDescription>
                El grupo &apos;EquipoDesarrolloSoftware&apos; ha analizado el error y propone lo siguiente:
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow my-4 pr-3 -mr-3">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Mensaje de Error Original:</h4>
                  <pre className="text-xs p-2 bg-muted rounded-md whitespace-pre-wrap">{errorMessage}</pre>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Diagnóstico del Grupo:</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap p-2 bg-muted/50 rounded-md">{autoFixResult.diagnosticNotes || "No se proporcionaron notas de diagnóstico específicas."}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Solución Sugerida:</h4>
                  <pre className="p-2 bg-muted/50 rounded-md whitespace-pre-wrap font-mono text-xs">{autoFixResult.suggestedSolution}</pre>
                </div>
                <Separator />
                <div>
                    <details className="group">
                        <summary className="cursor-pointer flex items-center text-xs text-muted-foreground hover:text-foreground">
                            <MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>
                            Log de Invocación del Grupo (para depuración)
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 ml-auto" />
                        </summary>
                        <pre className="mt-2 text-xs p-2 bg-muted rounded-md whitespace-pre-wrap border">
                            {autoFixResult.initialGroupLog}
                        </pre>
                    </details>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
