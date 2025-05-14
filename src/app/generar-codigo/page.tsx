
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, CodeXml } from 'lucide-react'; // Added CodeXml
import LLMConfigSelector from '@/components/llm-config-selector';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption } from '@/types';
import { generateCodeFromDescription, type GenerateCodeFromDescriptionOutput } from '@/ai/flows/generate-code-from-description';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function GenerarCodigoPage() {
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodeFromDescriptionOutput | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setShowConfirmDialog(false); // Close confirmation dialog
    setIsLoading(true);
    setError(null);
    setResult(null);
    addLog(`Generating code with config: ${JSON.stringify(llmConfigSource)}, description: ${description.substring(0,50)}...`);

    try {
      // TODO: Adapt input based on llmConfigSource (Global, Agent, Group)
      // For now, directly calling the flow. If Agent/Group, this would be more complex.
      if (llmConfigSource?.type === 'Agente' || llmConfigSource?.type === 'Grupo') {
        // This part needs a more complex logic to handle agent/group based generation
        // For now, we'll simulate a group log and fall back to direct generation
        addLog(`Using ${llmConfigSource.type}: ${llmConfigSource.name}. Orchestration logic not yet implemented. Simulating direct call.`);
        // Mock group log
        setResult(prev => ({...(prev || {explanation: '', code: ''}), groupLog: "Turno 1: Orquestador -> AgenteGeneradorCódigo. Prompt: " + description + "\nTurno 2: AgenteGeneradorCódigo -> Respuesta con código."}));
      }

      const aiResult = await generateCodeFromDescription({ description });
      setResult(prev => ({...prev, ...aiResult}));
      addLog("Code generation successful.");
      toast({ title: "Código Generado", description: "El fragmento de código ha sido generado exitosamente." });
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error al generar el código.";
      setError(errorMsg);
      addLog(`Code generation failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Generación", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateClick = () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Descripción Vacía", description: "Por favor, describe tu necesidad."});
      return;
    }
    setShowConfirmDialog(true);
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <CodeXml className="h-7 w-7 text-primary" />
          <span>Generar Código</span>
        </CardTitle>
        <CardDescription>Crea fragmentos de código a partir de descripciones en lenguaje natural.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
        
        <div className="space-y-2">
          <Label htmlFor="description">Describe tu necesidad</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Una función en Python que sume dos números y maneje errores de tipo."
            rows={5}
            disabled={isLoading}
          />
        </div>
        
        <Button onClick={handleGenerateClick} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generar Código
        </Button>

        {error && <ErrorDisplay error={error} />}

        {result && (
          <div className="space-y-4 mt-6 p-4 border rounded-md bg-background">
            {result.explanation && (
              <div>
                <h3 className="font-semibold text-lg mb-2">Explicación:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg mb-2">Fragmento de Código:</h3>
              <CodeBlock code={result.code} />
            </div>
             {(result as any).groupLog && (
              <LogsDisplay title="Log Detallado del Grupo" logs={(result as any).groupLog} />
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleSubmit}
        title="Confirmar Generación de Código"
      >
        <p className="text-sm text-muted-foreground mb-2">Se utilizará la siguiente configuración:</p>
        <ul className="text-sm list-disc list-inside mb-2">
          <li><strong>Fuente LLM:</strong> {llmConfigSource?.type} {llmConfigSource?.name ? `(${llmConfigSource.name})` : ''}</li>
        </ul>
        <p className="text-sm text-muted-foreground mb-1"><strong>Prompt:</strong></p>
        <ScrollArea className="h-32 border rounded-md p-2 text-sm bg-muted">
          {description}
        </ScrollArea>
      </ConfirmDialog>
    </Card>
  );
}
