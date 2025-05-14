
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card'; // CardHeader, CardTitle, CardDescription removed
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
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';

/**
 * @fileOverview GenerarCodigoPage component allows users to generate code snippets
 * from natural language descriptions. Users can select an LLM configuration source
 * (global, specific agent, or agent group) and provide a detailed prompt.
 * The component handles the AI call, displays results (explanation and code),
 * and manages loading/error states.
 */
export default function GenerarCodigoPage() {
  const { getAgentById, groups } = useAppState(); 
  const router = useRouter();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodeFromDescriptionOutput & { groupLog?: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  /**
   * Handles the code generation process once confirmed by the user.
   * Calls the AI flow and updates the UI with results or errors.
   */
  const handleSubmit = async () => {
    setShowConfirmDialog(false); 
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    let agentSystemPrompt: string | undefined;
    let groupLogForDisplay: string | undefined;
    let flowName = 'generateCodeFromDescription';

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt; 
        flowName = `generateCodeFromDescription (Agent: ${agent?.name || llmConfigSource.id})`;
        addLog({message: `Generating code with Agent: ${llmConfigSource.name}. Agent's system prompt might be used by an enhanced flow.`, flowName});
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
        const group = groups.find(g => g.id === llmConfigSource.id);
        groupLogForDisplay = `(Simulación de Log de Grupo para Generación de Código)\nTurno 1: Orquestador (usando contexto de '${llmConfigSource.name}') -> AgenteGeneradorDeCodigo. Tarea: \"${description.substring(0, 100)}...\".\nTurno 2: AgenteGeneradorDeCodigo -> Código generado.`;
        agentSystemPrompt = group?.mainTask; 
        flowName = `generateCodeFromDescription (Group: ${group?.name || llmConfigSource.id})`;
        addLog({message: `Generating code with Group: ${llmConfigSource.name}. Group's task might be used by an enhanced flow.`, flowName});
    } else {
        addLog({message: `Generating code with Global settings. Description: ${description.substring(0,50)}...`, flowName});
    }

    try {
      // The current `generateCodeFromDescription` flow only takes `description`.
      // If it's enhanced to use agentSystemPrompt, it would be passed here.
      // const inputForFlow = { description, agentSystemPrompt }; 
      const aiResult = await callGenerateCodeFromDescription({ description });
      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog({message: "Code generation successful.", flowName});
      toast({ title: "Código Generado", description: "El fragmento de código ha sido generado exitosamente." });
    } catch (e: any) {
      addLog({ message: "Code generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Generación", description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error al generar el código.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Generación", description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handles the click event for the "Generar Código" button.
   * Validates input and opens the confirmation dialog.
   */
  const handleGenerateClick = () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Descripción Vacía", description: "Por favor, describe tu necesidad."});
      return;
    }
    setShowConfirmDialog(true);
  };
  
  /**
   * Placeholder for an AI-driven error fixing mechanism.
   * @param {string} errorMsg - The error message to be fixed.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    const autoFixFlowName = 'chatWithAgentOrGlobal (AutoFix Error)';
    addLog({ message: `Attempting Auto-Fix for error: ${errorMsg}`, flowName: autoFixFlowName});
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
    // Example:
    // const fixAttempt = await callChatWithAgentOrGlobal({ userMessage: `Explica este error y cómo solucionarlo: ${errorMsg}`});
    // Show fixAttempt.aiResponse in a dialog or toast.
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <PageSectionHeader
        icon={CodeXml}
        title="Generar Código"
        description="Crea fragmentos de código a partir de descripciones en lenguaje natural."
      />
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
