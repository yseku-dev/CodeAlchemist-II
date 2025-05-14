
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AutoUpdateSuggestion } from '@/types';

interface AutoUpdateSuggestionCardProps {
  suggestion: AutoUpdateSuggestion;
  onApply: (suggestion: AutoUpdateSuggestion) => void;
  // Add other handlers like onDiscard, onViewDiff if needed
}

export default function AutoUpdateSuggestionCard({
  suggestion,
  onApply,
}: AutoUpdateSuggestionCardProps) {
  const { id, area, suggestion: description, priority, fullFileContentSuggested, status } = suggestion;

  return (
    <Card key={id} className={status === 'applied' ? 'border-green-500' : status === 'discarded' ? 'opacity-60' : ''}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-base">{area}</CardTitle>
        <CardDescription>Prioridad: <span className={`font-semibold ${priority === 'Alta' ? 'text-destructive' : priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{priority}</span></CardDescription>
      </CardHeader>
      <CardContent className="text-xs px-4 pb-3">
        <p>{description}</p>
        {fullFileContentSuggested && status === 'pending' && (
          <Button size="xs" variant="link" className="p-0 h-auto mt-1" onClick={() => onApply(suggestion)}>Aplicar Sugerencia</Button>
        )}
        {status === 'applied' && <p className="text-green-600 font-medium mt-1 text-xs">Aplicada</p>}
        {status === 'discarded' && <p className="text-muted-foreground font-medium mt-1 text-xs">Descartada</p>}
      </CardContent>
    </Card>
  );
}
