
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AutoUpdateSuggestion } from '@/types';
import { Edit3, Check, X, Play, Wand2Icon, Save } from 'lucide-react';

interface AutoUpdateSuggestionCardProps {
  suggestion: AutoUpdateSuggestion;
  onApply: (suggestion: AutoUpdateSuggestion) => void;
  onToggleEdit: (suggestionId: string) => void;
  onContentChange: (suggestionId: string, newContent: string) => void;
  onSaveEdit: (suggestionId: string) => void;
  onCancelEdit: (suggestionId: string) => void;
  onTest: (suggestion: AutoUpdateSuggestion) => void;
}

export default function AutoUpdateSuggestionCard({
  suggestion,
  onApply,
  onToggleEdit,
  onContentChange,
  onSaveEdit,
  onCancelEdit,
  onTest,
}: AutoUpdateSuggestionCardProps) {
  const { id, area, suggestion: descriptionText, priority, fullFileContentSuggested, status, isEditing, userEditedContent } = suggestion;

  return (
    <Card key={id} className={`shadow-md ${status === 'applied' ? 'border-green-500' : status === 'discarded' ? 'opacity-70 bg-muted/50' : 'border-border'}`}>
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-md font-semibold">{area}</CardTitle>
            <CardDescription className="text-xs">Prioridad: <span className={`font-semibold ${priority === 'Alta' ? 'text-destructive' : priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{priority}</span></CardDescription>
          </div>
          {status === 'applied' && <Check className="h-5 w-5 text-green-500" />}
          {status === 'discarded' && <X className="h-5 w-5 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="text-sm px-4 pb-3 space-y-2">
        <p className="text-xs">{descriptionText}</p>
        {isEditing && fullFileContentSuggested && (
          <div className="space-y-2 mt-2">
            <Label htmlFor={`edit-${id}`} className="text-xs font-medium">Editar Contenido Sugerido:</Label>
            <Textarea
              id={`edit-${id}`}
              value={userEditedContent || ''}
              onChange={(e) => onContentChange(id, e.target.value)}
              rows={6}
              className="text-xs font-mono bg-background"
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 py-3 px-4 border-t">
        {status === 'pending' && (
          <>
            {isEditing ? (
              <>
                <Button size="xs" variant="outline" onClick={() => onCancelEdit(id)}>
                  <X className="mr-1 h-3 w-3" /> Cancelar
                </Button>
                <Button size="xs" onClick={() => onSaveEdit(id)}>
                  <Save className="mr-1 h-3 w-3" /> Guardar Edición
                </Button>
              </>
            ) : (
              <>
                {fullFileContentSuggested && (
                   <Button size="xs" variant="outline" onClick={() => onToggleEdit(id)}>
                    <Edit3 className="mr-1 h-3 w-3" /> Editar
                  </Button>
                )}
                <Button size="xs" variant="outline" onClick={() => onTest(suggestion)}>
                  <Play className="mr-1 h-3 w-3" /> Testear
                </Button>
                <Button size="xs" onClick={() => onApply(suggestion)} disabled={!fullFileContentSuggested && !userEditedContent}>
                   <Wand2Icon className="mr-1 h-3 w-3" /> Aplicar
                </Button>
              </>
            )}
          </>
        )}
        {status !== 'pending' && (
          <p className={`text-xs font-semibold ${status === 'applied' ? 'text-green-600' : 'text-muted-foreground'}`}>
            {status === 'applied' ? 'Sugerencia Aplicada (marcada)' : 'Sugerencia Descartada'}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
