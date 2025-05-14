
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FolderPlus } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, ProjectGenerationResult, GenerateProjectInput, Agent } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import FileTreeDisplay from '@/components/file-tree';
import LogsDisplay from '@/components/logs-display';
import { generateProjectStructure } from '@/ai/flows/generate-project-structure-flow';
import { useAppState } from '@/context/AppStateContext';


export default function GenerarProyectoPage() {
  const { agents, getAgentById } = useAppState();
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectGenerationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      // For group, we could use the orchestrator's prompt or a designated project generation agent's prompt.
      // For now, let's try passing the group's main task or orchestrator's context.
      // Or, find the orchestrator if it's a fixed ID.
      const orchestrator = agents.find(a => a.name === 'OrquestadorFlujoAgentes');
      agentSystemPrompt = orchestrator?.systemPrompt || "Genera un proyecto basado en la siguiente descripción, actuando como un orquestador de un grupo de agentes especializados.";
      addLog(`Generating project with Group: ${llmConfigSource.name}. Using orchestrator's context for generation flow.`);
    }

    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPrompt,
    };
    
    addLog(`Generating project with config: ${JSON.stringify(llmConfigSource)}, input: ${JSON.stringify(generationInput).substring(0,100)}...`);

    try {
      const aiResult = await generateProjectStructure(generationInput);
      
      let groupLogForDisplay: string | undefined = undefined;
      if (llmConfigSource?.type === 'Grupo') {
        groupLogForDisplay = `(Simulación de Log de Grupo para Generación de Proyecto)\nTurno 1: Orquestador (usando contexto de '${llmConfigSource.name}') -> AgenteDiseñadorProyectos. Tarea: \"${finalPrompt.substring(0, 100)}...\".\nTurno 2: AgenteDiseñadorProyectos -> Estructura de proyecto generada.`;
      }

      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog("Project generation successful.");
      toast({ title: "Proyecto Generado", description: "La estructura base del proyecto ha sido generada." });
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error al generar el proyecto.";
      setError(errorMsg);
      addLog(`Project generation failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Generación", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateClick = () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Descripción Vacía", description: "Por favor, describe tu proyecto."});
      return;
    }
    setCurrentPromptForDialog(description);
    setShowConfirmDialog(true);
  };

  const handleDownloadProject = () => {
    if (!result) {
      toast({ variant: "destructive", title: "Sin Resultados", description: "No hay estructura de proyecto para descargar." });
      return;
    }
    const filename = `${result.projectName || 'proyecto-generado'}.json`;
    const jsonString = JSON.stringify(result, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Proyecto Descargado (JSON)", description: `La estructura del proyecto "${result.projectName}" ha sido descargada como ${filename}. Puedes usar este JSON para crear los archivos y carpetas.` });
    addLog(`Project structure "${result.projectName}" downloaded as JSON.`);
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FolderPlus className="h-7 w-7 text-primary" />
          <span>Generar Proyecto</span>
        </CardTitle>
        <CardDescription>Crea una estructura base para nuevos proyectos a partir de tus especificaciones.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
        
        <div className="space-y-2">
          <Label htmlFor="description">Describe tu proyecto</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Un API REST con Node.js y Express, con rutas para usuarios y productos, y una base de datos PostgreSQL."
            rows={8}
            disabled={isLoading}
          />
        </div>
        
        <Button onClick={handleGenerateClick} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Generar Proyecto
        </Button>

        {error && <ErrorDisplay error={error} />}

        {result && (
          <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
            <div>
              <h3 className="font-semibold text-xl mb-1">Nombre Sugerido:</h3>
              <p className="text-lg text-primary">{result.projectName}</p>
            </div>
             {result.aiNotes && (
              <div>
                <h3 className="font-semibold text-lg mb-1">Notas de la IA:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.aiNotes}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg mb-2">Archivos Generados:</h3>
              <FileTreeDisplay files={result.files} />
            </div>
            <Button onClick={handleDownloadProject} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Descargar Estructura (JSON)
            </Button>
            {result.groupLog && ( // Display group log if it exists
              <LogsDisplay title="Log Detallado del Grupo" logs={result.groupLog} />
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleProjectGeneration(currentPromptForDialog)}
        title="Confirmar Generación de Proyecto"
        confirmText="Sí, Generar Proyecto"
      >
        <div className="space-y-4">
            <div>
                <Label className="font-semibold">Prompt Actual:</Label>
                <ScrollArea className="h-24 border rounded-md p-2 text-sm bg-muted mt-1">
                    {description}
                </ScrollArea>
            </div>
            <div>
                <Label htmlFor="redefine-prompt">Redefinir Prompt (opcional):</Label>
                <Textarea
                    id="redefine-prompt"
                    value={currentPromptForDialog}
                    onChange={(e) => setCurrentPromptForDialog(e.target.value)}
                    rows={4}
                    className="mt-1"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                Configuración LLM a usar: {llmConfigSource?.type} {llmConfigSource?.name ? `(${llmConfigSource.name})` : ''}
            </p>
        </div>
      </ConfirmDialog>
    </Card>
  );
}
