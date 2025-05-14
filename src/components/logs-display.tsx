
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogsDisplayProps {
  title: string;
  logs: string | string[]; // Can be a single string or an array of strings
  defaultExpanded?: boolean;
}

export default function LogsDisplay({ title, logs, defaultExpanded = false }: LogsDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { toast } = useToast();

  const logsArray = Array.isArray(logs) ? logs : logs.split('\n');

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logsArray.join('\n'));
    toast({
      title: "Logs Copiados",
      description: "El contenido de los logs ha sido copiado.",
    });
  };

  if (!logs || logsArray.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <CardTitle className="text-md">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleCopyLogs} title="Copiar Logs">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Contraer" : "Expandir"}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-0">
          <ScrollArea className="h-64 border-t">
            <pre className="p-4 text-xs whitespace-pre-wrap bg-muted/50">
              {logsArray.map((logLine, index) => (
                <div key={index}>{logLine}</div>
              ))}
            </pre>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
