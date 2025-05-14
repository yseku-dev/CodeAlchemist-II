
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, CodeXml } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption } from '@/types';
import { type GenerateCodeFromDescriptionOutput } from '@/ai/flows/generate-code-from-description';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppError } from '@/utils/AppError';
import { callGenerateCodeFromDescription } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';


export default function GenerarCodigoPage() {
  const { agents, groups, getAgentById } = useAppState(); // Added for context if agent/group is selected
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodeFromDescriptionOutput & { groupLog?: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleSubmit = async () => {
    setShowConfirmDialog(false); 
    setIsLoading(true);
    setError(null);
    setResult(null);
    addLog(`Generating code with config: ${JSON.stringify(llmConfigSource)}, description: ${description.substring(0,50)}...`);

    // Prepare input for the flow.
    // If an agent or group is selected, their context might be used differently by the flow
    // or by a more complex orchestration logic not yet implemented here.
    // For now, the `generateCodeFromDescription` flow is simple and only takes `description`.
    // We can pass agent/group context if the flow is enhanced in the future.
    let agentSystemPrompt: string | undefined;
    let groupLogForDisplay: string | undefined;

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt; // This might be passed to an enhanced flow
        addLog(`Generating code with Agent: ${llmConfigSource.name}. Agent's system prompt might be used by an enhanced flow.`);
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
        const group = groups.find(g => g.id === llmConfigSource.id);
        // For groups, a more complex interaction via orchestrator would be ideal.
        // Here, we simulate a log and might pass group's main task as context.
        groupLogForDisplay = `(Simulación de Log de Grupo para Generación de Código)\nTurno 1: Orquestador (usando contexto de '${llmConfigSource.name}') -> AgenteGeneradorDeCodigo. Tarea: \"${description.substring(0, 100)}...\".\nTurno 2: AgenteGeneradorDeCodigo -> Código generado.`;
        agentSystemPrompt = group?.mainTask; // Example of passing group context
        addLog(`Generating code with Group: ${llmConfigSource.name}. Group's task might be used by an enhanced flow.`);
    }


    try {
      // const enhancedInput = { description, agentSystemPrompt }; // If flow supports it
      const aiResult = await callGenerateCodeFromDescription({ description });
      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog("Code generation successful.");
      toast({ title: "Código Generado", description: "El fragmento de código ha sido generado exitosamente." });
    } catch (e: any) {
      addLog({ message: "Code generation failed in UI", error: e });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Generación", description: e.friendlyMessage });
      } else {
        const errorMsg = e.message || "Ocurrió un error al generar el código.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Generación", description: errorMsg });
      }
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
  
  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
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

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} />}

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
             {result.groupLog && (
              <LogsDisplay title="Log Detallado del Grupo" logs={result.groupLog} />
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
