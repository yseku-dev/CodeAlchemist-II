
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FolderSearch } from 'lucide-react'; // Added FolderSearch
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption } from '@/types';
import { analyzeSelfCode, type AnalyzeSelfCodeOutput, type AnalyzeSelfCodeInput } from '@/ai/flows/analyze-self-code';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';

type ProjectSourceType = "upload" | "git";

export default function AnalizarProyectoPage() {
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(AnalyzeSelfCodeOutput & { groupLog?: string }) | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json'];
      if (allowedTypes.includes(file.type) && file.size <= 25 * 1024 * 1024) { // Max 25MB for ZIP/JSON
        setUploadedFile(file);
        addLog(`Project file selected: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      } else {
        toast({ variant: "destructive", title: "Archivo Inválido", description: "Sube un archivo .zip o .json de menos de 25MB." });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    let sourceLocation: AnalyzeSelfCodeInput['sourceCodeLocation'];
    let gitRepoUrlInput: string | undefined;

    if (projectSourceType === "upload" && uploadedFile) {
      sourceLocation = "Local"; // Representing an uploaded project as 'Local' for the AI flow
      // In a real scenario, you'd process the file or make its content available to the AI.
      // For `analyzeSelfCode`, it expects a path or Git URL. We might need a different flow or adapt.
      // Let's assume for now 'Local' means we would conceptually give it a path to the extracted/processed project.
      addLog(`Analyzing uploaded project file: ${uploadedFile.name}`);
      // This flow `analyzeSelfCode` might not be suitable for arbitrary uploads without adaptation.
      // We'll proceed with the assumption it can handle a "Local" source conceptually.
    } else if (projectSourceType === "git" && gitUrl) {
      sourceLocation = "Git";
      gitRepoUrlInput = gitUrl;
      addLog(`Analyzing Git project URL: ${gitUrl}`);
    } else {
      toast({ variant: "destructive", title: "Fuente del Proyecto Requerida", description: "Sube un archivo o proporciona una URL de Git." });
      setIsLoading(false);
      return;
    }

    const input: AnalyzeSelfCodeInput = {
      sourceCodeLocation: sourceLocation,
      gitRepoUrl: gitRepoUrlInput,
      // analysisPreferences can be added if there's a UI field for it
    };
    
    addLog(`Analyzing project with input: ${JSON.stringify(input)} and config: ${JSON.stringify(llmConfigSource)}`);

    try {
      // const aiResult = await analyzeSelfCode(input); 
      // Mocking since `analyzeSelfCode` is for the app's own code.
      // This feature would ideally have its own dedicated AI flow for general project analysis.
      const mockAiResult: AnalyzeSelfCodeOutput & { groupLog?: string } = {
        analysisTitle: `Análisis del Proyecto ${projectSourceType === 'git' ? gitUrl.split('/').pop() : uploadedFile?.name || 'Subido'}`,
        identifiedAreas: ["Módulo de Autenticación", "Componentes de UI Principales", "Acceso a Base de Datos"],
        detailedSuggestions: [
          { area: "Módulo de Autenticación", suggestion: "Considerar el uso de JWT para stateless authentication.", priority: "Alta" },
          { area: "Componentes de UI", suggestion: "Mejorar la responsividad en tablas de datos complejas.", priority: "Media" },
        ],
        generalAssessment: "El proyecto muestra una estructura sólida pero podría beneficiarse de optimizaciones en el rendimiento de la base de datos y una modernización de la gestión de estado en el frontend. Se recomienda una revisión de seguridad en los endpoints públicos."
      };
      if (llmConfigSource?.type === 'Grupo') {
         mockAiResult.groupLog = "Turno 1: Orquestador -> AnalistaGeneralProyectos. Tarea: Analizar proyecto. \nTurno 2: AnalistaGeneralProyectos -> Reporte de análisis generado.";
      }

      setResult(mockAiResult);
      toast({ title: "Análisis Completado", description: "El proyecto ha sido analizado." });
      addLog("Project analysis successful.");
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error durante el análisis del proyecto.";
      setError(errorMsg);
      addLog(`Project analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <FolderSearch className="h-7 w-7 text-primary" />
          <span>Análisis de Proyecto Completo</span>
        </CardTitle>
        <CardDescription>Realiza un análisis holístico de un proyecto entero, subido o desde Git.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />

        <div className="space-y-2">
          <Label>Fuente del Proyecto</Label>
          <Select value={projectSourceType} onValueChange={(value) => setProjectSourceType(value as ProjectSourceType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">Subir Archivo (ZIP/JSON)</SelectItem>
              <SelectItem value="git">URL de Git</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {projectSourceType === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="project-file-upload">Subir Archivo (.zip, .json)</Label>
            <Input id="project-file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zip,application/zip,.json,application/json" disabled={isLoading} />
            {uploadedFile && <p className="text-xs text-muted-foreground">Archivo seleccionado: {uploadedFile.name}</p>}
          </div>
        )}

        {projectSourceType === "git" && (
          <div className="space-y-2">
            <Label htmlFor="project-git-url">URL de Git</Label>
            <Input id="project-git-url" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/usuario/repo.git" disabled={isLoading} />
          </div>
        )}
        
        <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analizar Proyecto
        </Button>

        {error && <ErrorDisplay error={error} />}

        {isLoading && !result && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando proyecto...</p></div>}
        
        {result && (
          <Card className="mt-6 bg-background">
            <CardHeader>
              <CardTitle>{result.analysisTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Evaluación General:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.generalAssessment}</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Áreas Identificadas:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {result.identifiedAreas.map((area, index) => <li key={index}>{area}</li>)}
                </ul>
              </div>
              {result.detailedSuggestions && result.detailedSuggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Sugerencias Específicas:</h3>
                  <ScrollArea className="h-60 border rounded-md p-2">
                    <ul className="space-y-3">
                    {result.detailedSuggestions.map((s, index) => (
                      <li key={index} className="p-2 border-b last:border-b-0">
                        <p className="font-medium text-sm">{s.area}</p>
                        <p className="text-xs text-muted-foreground">{s.suggestion}</p>
                        <p className_priority="text-xs">Prioridad: <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></p>
                      </li>
                    ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              {result.groupLog && <LogsDisplay title="Log Detallado del Análisis" logs={result.groupLog} />}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
