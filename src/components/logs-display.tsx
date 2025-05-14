
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview A reusable component for displaying logs in an expandable/collapsible card.
 */

/**
 * Props for the LogsDisplay component.
 */
interface LogsDisplayProps {
  /** 
   * The title to display in the header of the logs card.
   * @example "Log de Ejecución Detallado"
   */
  title: string;
  /** 
   * The log content to display. Can be a single string (with newlines)
   * or an array of strings (where each string is a log line).
   * @example "Turno 1: Orquestador decide...\nAgente X responde..."
   * @example ["Turno 1: Orquestador decide...", "Agente X responde..."]
   */
  logs: string | string[];
  /** 
   * Optional. Determines if the logs section should be expanded by default.
   * Defaults to `false`.
   */
  defaultExpanded?: boolean;
}

/**
 * LogsDisplay component.
 * Renders a card that can display a list of log messages.
 * The card is expandable/collapsible and includes a button to copy the logs.
 *
 * @param {LogsDisplayProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered logs display card, or null if no logs are provided.
 *
 * @example
 * const exampleLogs = ["Log line 1", "Log line 2"];
 * <LogsDisplay title="Historial de Eventos" logs={exampleLogs} defaultExpanded={true} />
 */
export default function LogsDisplay({ title, logs, defaultExpanded = false }: LogsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { toast } = useToast();

  // Ensure logs state is updated if defaultExpanded prop changes (though less common for default props)
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const logsArray = Array.isArray(logs) ? logs : (logs ? logs.split('\\n') : []);

  const handleCopyLogs = () => {
    if (logsArray.length > 0) {
      navigator.clipboard.writeText(logsArray.join('\\n'));
      toast({
        title: "Logs Copiados",
        description: "El contenido de los logs ha sido copiado.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Sin Logs",
        description: "No hay logs para copiar.",
      });
    }
  };

  if (!logs || logsArray.length === 0 || (logsArray.length === 1 && !logsArray[0].trim())) {
    // Optionally, render a "No logs to display" message or nothing.
    // For now, let's return null if effectively empty to not show the card.
    // Or, you could show the card header with a message in content.
    // Example: If title should always show, then structure differently.
    return null; 
  }

  return (
    <Card className="mt-6 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 border-b">
        <CardTitle className="text-sm sm:text-md font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={handleCopyLogs} title="Copiar Logs" className="h-7 w-7 sm:h-8 sm:w-8">
            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Contraer" : "Expandir"} className="h-7 w-7 sm:h-8 sm:w-8">
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-0">
          <ScrollArea className="h-48 sm:h-64">
            <pre className="p-3 sm:p-4 text-xs whitespace-pre-wrap bg-muted/30">
              {logsArray.map((logLine, index) => (
                <div key={index} className="border-b border-border/50 py-1 last:border-b-0">
                  {logLine.trim() ? logLine : <span className="text-muted-foreground/50">(Línea vacía)</span>}
                </div>
              ))}
              {logsArray.length === 0 && <div className="text-muted-foreground italic">No hay logs para mostrar.</div>}
            </pre>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
