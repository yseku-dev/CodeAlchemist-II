
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FolderPlus } from 'lucide-react'; // Added FolderPlus
import LLMConfigSelector from '@/components/llm-config-selector';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, ProjectGenerationResult } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import FileTreeDisplay from '@/components/file-tree';
import LogsDisplay from '@/components/logs-display';
// import { generateProjectFromDescription } from '@/ai/flows/generate-project'; // Assuming this flow exists

// Mock AI call
const mockGenerateProject = (description: string): Promise<ProjectGenerationResult & { groupLog?: string }> => {
  return new Promise(resolve => setTimeout(() => {
    resolve({
      projectName: "ProyectoIncreible",
      aiNotes: "Este es un proyecto base generado por IA. Asegúrate de instalar las dependencias necesarias (ej: npm install) y revisar la configuración.",
      files: [
        { path: "README.md", content: `# ProyectoIncreible\n\nDescripción: ${description.substring(0, 50)}...` },
        { path: "src/", content: "", isFolder: true },
        { path: "src/index.js", content: `// Punto de entrada principal\nconsole.log("Hola, ${description.substring(0,20)}!");` },
        { path: "package.json", content: JSON.stringify({ name: "proyecto-increible", version: "0.1.0", main: "src/index.js" }, null, 2) },
      ],
      groupLog: "Turno 1: Orquestador -> AgenteDiseñadorProyectos. Prompt: " + description + "\nTurno 2: AgenteDiseñadorProyectos -> Estructura de proyecto generada."
    });
  }, 2000));
};


export default function GenerarProyectoPage() {
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ProjectGenerationResult & {groupLog?: string}) | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    addLog(`Generating project with config: ${JSON.stringify(llmConfigSource)}, prompt: ${finalPrompt.substring(0,50)}...`);

    try {
      // const aiResult = await generateProjectFromDescription({ description: finalPrompt });
      const aiResult = await mockGenerateProject(finalPrompt); // Using mock
      setResult(aiResult);
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

  const handleDownloadZip = () => {
    // Client-side zipping logic (e.g. using JSZip) would go here
    // For now, it's a placeholder
    addLog(`Attempting to download project "${result?.projectName}" as ZIP.`);
    toast({ title: "Descarga (Simulada)", description: "La descarga del proyecto ZIP aún no está implementada." });
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
            <Button onClick={handleDownloadZip} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Descargar Proyecto (ZIP)
            </Button>
            {result.groupLog && (
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
        </div>
      </ConfirmDialog>
    </Card>
  );
}
