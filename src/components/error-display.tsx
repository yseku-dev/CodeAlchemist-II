
"use client";

import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, AlertTriangle, Wand2, Loader2, MessageSquareText, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext'; // No se usa directamente aquí, pero es útil para el contexto de Auto-Fix
import { useDebug } from '@/context/DebugContext';
import { callAutoFixErrorWithGroup } from '@/utils/apiClient';
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
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview ErrorDisplay component provides a standardized way to display errors
 * to the user, with options to copy the error and attempt an AI-driven auto-fix.
 * @module ErrorDisplay
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
   * @param {string} [contextForAI] - Optional context for the AI fix.
   * @returns {Promise<void>}
   */
  onAutoFix?: (errorMsg: string, contextForAI?: string) => Promise<void>;
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
  const { t } = useI18n();
  // const { settings } = useAppState(); // Podría usarse para obtener config LLM para Auto-Fix si no se maneja globalmente

  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixErrorWithGroupOutput | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error !== 'string' && error.stack ? error.stack : undefined;

  const handleCopyError = () => {
    const textToCopy = `Error: ${errorMessage}${errorStack ? `\nStack: ${errorStack}` : ''}`;
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: t('errorDisplay.toast.copied.title'),
      description: t('errorDisplay.toast.copied.description'),
    });
    addLog({source: "ErrorDisplay", type: "INFO", message: "Error copiado por el usuario.", data: { error: errorMessage }});
  };

  const handleAttemptAutoFix = async () => {
    // Si se proporciona un manejador onAutoFix personalizado, úsalo.
    if (onAutoFix) {
      setIsAutoFixing(true);
      try {
        addLog({source: "ErrorDisplay", type: "INFO", message: "Iniciando Auto-Fix (manejador personalizado)...", data: { error: errorMessage, context }});
        await onAutoFix(errorMessage, context); // El contexto pasado a onAutoFix es el 'context' prop
      } catch (e) {
        const err = e as Error;
        toast({ variant: "destructive", title: t('errorDisplay.toast.autofixError.title'), description: err.message || "No se pudo iniciar el proceso de Auto-Fix personalizado." });
        addLog({source: "ErrorDisplay", type: "ERROR", message: "Fallo el Auto-Fix personalizado.", data: { error: err.message }});
      } finally {
        setIsAutoFixing(false);
      }
      return;
    }

    // Lógica de Auto-Fix por defecto usando 'EquipoDesarrolloSoftware'
    setIsAutoFixing(true);
    setAutoFixResult(null);
    const autoFixToastDescriptionKey = 'errorDisplay.toast.autofixAttempt.description' as TranslationKey;
    toast({ title: t('errorDisplay.toast.autofixAttempt.title'), description: t(autoFixToastDescriptionKey)});
    addLog({source: "ErrorDisplay", type: "INFO", message: "Invocando 'EquipoDesarrolloSoftware' para Auto-Fix.", data: { error: errorMessage, context }});

    try {
      const result = await callAutoFixErrorWithGroup({
        errorMessage,
        codeContext: errorStack, // Pasar el stack trace como parte del contexto del código
        userInstructions: context, // El 'context' de las props se usa como 'userInstructions'
      });
      setAutoFixResult(result);
      setIsModalOpen(true); // Abrir modal con los resultados
      toast({ title: t('errorDisplay.toast.autofixSuggestionReceived.title'), description: t('errorDisplay.toast.autofixSuggestionReceived.description') });
      addLog({source: "ErrorDisplay", type: "SUCCESS", message: "Sugerencia de Auto-Fix recibida del grupo.", data: result });
    } catch (e: any) {
      const appError = e instanceof AppError ? e : new AppError(t('errorDisplay.toast.autofixError.description'), e, 'ai');
      toast({ variant: "destructive", title: t('errorDisplay.toast.autofixError.title'), description: appError.friendlyMessage });
      addLog({source: "ErrorDisplay", type: "ERROR", message: "Fallo al obtener sugerencia de Auto-Fix del grupo.", errorDetails: appError.originalError || appError, friendlyMessage: appError.friendlyMessage });
    } finally {
      setIsAutoFixing(false);
    }
  };

  return (
    <>
      <Alert variant="destructive" className="my-4 shadow-md">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="font-semibold">{t('errorDisplay.title')}</AlertTitle>
        <AlertDescription>
          <p className="mb-3 text-sm break-words">{errorMessage}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={handleCopyError} className="border-destructive/70 hover:bg-destructive/10 text-destructive-foreground">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> {t('errorDisplay.copyButton')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleAttemptAutoFix} disabled={isAutoFixing} className="border-destructive/70 hover:bg-destructive/10 text-destructive-foreground">
              {isAutoFixing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
              {isAutoFixing ? t('errorDisplay.autofixingButton') : t('errorDisplay.autofixButton')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {autoFixResult && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-accent">
                <Wand2 className="h-6 w-6" />
                {t('errorDisplay.autofixModal.title')}
              </DialogTitle>
              <DialogDescription>
                {t('errorDisplay.autofixModal.description')}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow my-4 pr-3 -mr-3">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{t('errorDisplay.autofixModal.originalErrorLabel')}</h4>
                  <pre className="text-xs p-2 bg-muted rounded-md whitespace-pre-wrap">{errorMessage}</pre>
                  {errorStack && (
                     <details className="group mt-1">
                        <summary className="cursor-pointer flex items-center text-xs text-muted-foreground hover:text-foreground">
                            <MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>
                            Stack Trace (para depuración)
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 ml-auto" />
                        </summary>
                        <pre className="mt-2 text-xs p-2 bg-muted/30 rounded-md whitespace-pre-wrap border max-h-40 overflow-auto">
                            {errorStack}
                        </pre>
                    </details>
                  )}
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{t('errorDisplay.autofixModal.diagnosisLabel')}</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap p-2 bg-muted/50 rounded-md">{autoFixResult.diagnosticNotes || "No se proporcionaron notas de diagnóstico específicas."}</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{t('errorDisplay.autofixModal.solutionLabel')}</h4>
                  <pre className="p-2 bg-muted/50 rounded-md whitespace-pre-wrap font-mono text-xs">{autoFixResult.suggestedSolution}</pre>
                </div>
                <Separator />
                <div>
                    <details className="group">
                        <summary className="cursor-pointer flex items-center text-xs text-muted-foreground hover:text-foreground">
                            <MessageSquareText className="mr-1.5 h-3.5 w-3.5"/>
                            {t('errorDisplay.autofixModal.invocationLogLabel')}
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
                <Button variant="outline">{t('common.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
