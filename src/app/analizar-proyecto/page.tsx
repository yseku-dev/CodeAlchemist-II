
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card'; // Removed CardHeader etc. for PageSectionHeader
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FolderSearch, ListChecks } from 'lucide-react'; 
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, AnalyzeCodeInput, AnalyzeCodeOutput, Agent } from '@/types'; 
import { analyzeSelfCode as analyzeProjectFlow } from '@/ai/flows/analyze-self-code'; 
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';


type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
 */
export default function AnalizarProyectoPage() {
  const { agents, getAgentById } = useAppState(); 
  const router = useRouter();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>(''); 
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeOutput | null>(null); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  /**
   * Handles changes to the file input for project source.
   * Validates file type (ZIP/JSON) and size.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json'];
      if (allowedTypes.includes(file.type) && file.size <= 25 * 1024 * 1024) { 
        setUploadedFile(file);
        addLog(`Project file selected for analysis: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      } else {
        toast({ variant: "destructive", title: "Archivo Inválido", description: "Sube un archivo .zip o .json de menos de 25MB." });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  /**
   * Initiates the project analysis by constructing the input and calling the AI flow.
   * This function is called by `handleAnalyze` after initial setup.
   * @param {AnalyzeCodeInput} input - The input for the analysis flow.
   */
  const executeAnalysis = async (input: AnalyzeCodeInput) => {
     const flowName = 'analyzeProject (analyzeSelfCode flow)';
     addLog({message: `Analyzing project with input: ${JSON.stringify(input).substring(0, 200)}... and config: ${JSON.stringify(llmConfigSource)}`, flowName});
    
    try {
      const aiResult = await analyzeProjectFlow(input); 
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };

      if (llmConfigSource?.type === 'Grupo') {
         finalResult.groupLog = `(Simulación de Log de Grupo para Análisis de Proyecto)\nTurno 1: Orquestador -> AgenteAnalizadorDeProyectos (usando '${llmConfigSource.name}'). Tarea: Analizar proyecto con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorDeProyectos -> Reporte de análisis generado.`;
      }

      setResult(finalResult);
      toast({ title: "Análisis Completado", description: "El proyecto ha sido analizado." });
      addLog({message: "Project analysis successful.", flowName});
    } catch (e: any) {
      addLog({ message: "Project analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Análisis", description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis del proyecto.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Prepares and triggers the project analysis process.
   * Handles file reading for uploaded projects before calling `executeAnalysis`.
   */
  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    let analysisInput: AnalyzeCodeInput;

    if (projectSourceType === "upload" && uploadedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const projectContent = e.target?.result as string;
          analysisInput = {
            sourceCodeLocation: "UploadedString",
            projectContent: projectContent, 
            analysisPreferences: focusArea || undefined, // Legacy, use focusArea
            searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
            focusArea: focusArea || undefined,
          };
          addLog(`Analyzing uploaded project: ${uploadedFile.name}`);
          await executeAnalysis(analysisInput);
      };
      reader.onerror = () => {
          toast({ variant: "destructive", title: "Error de Lectura", description: "No se pudo leer el archivo."});
          setIsLoading(false);
      }
      if (uploadedFile.type === 'application/json') {
        reader.readAsText(uploadedFile);
      } else if (uploadedFile.type === 'application/zip') {
        // For ZIP, the content will be a base64 string if read as data URL,
        // or just a marker if not fully processed.
        // For simplicity, for now, we'll treat it as a reference.
        analysisInput = {
            sourceCodeLocation: "UploadedString", 
            projectContent: `Contenido del archivo ZIP: ${uploadedFile.name}. (El flujo debe poder interpretar esto como una referencia o el contenido real si se envía).`,
            analysisPreferences: focusArea || undefined,
            searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
            focusArea: focusArea || undefined,
          };
        addLog(`Analyzing uploaded ZIP project: ${uploadedFile.name} (reference/placeholder content)`);
        await executeAnalysis(analysisInput);
      } else {
          toast({ variant: "destructive", title: "Tipo de Archivo no Soportado", description: "El análisis de este tipo de archivo no está completamente implementado."});
          setIsLoading(false);
      }
      return; 
    } else if (projectSourceType === "git" && gitUrl) {
      analysisInput = {
        sourceCodeLocation: "Git",
        gitRepoUrl: gitUrl,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        focusArea: focusArea || undefined,
      };
      addLog(`Analyzing Git project URL: ${gitUrl}`);
      await executeAnalysis(analysisInput);
    } else {
      toast({ variant: "destructive", title: "Fuente del Proyecto Requerida", description: "Sube un archivo o proporciona una URL de Git." });
      setIsLoading(false);
      return;
    }
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <PageSectionHeader
        icon={FolderSearch}
        title="Análisis de Proyecto Completo"
        description="Realiza un análisis holístico de un proyecto entero, subido o desde Git."
      />
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

        <Separator />
        <Label>Parámetros de Análisis</Label>
        <div className="space-y-2">
          <Label htmlFor="search-depth-project" className="text-sm font-normal">Profundidad de Búsqueda (opcional)</Label>
          <Input id="search-depth-project" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder="Ej: 3 (niveles)" disabled={isLoading} min="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-area-project" className="text-sm font-normal">Campo de Enfoque del Análisis (opcional)</Label>
          <Input id="focus-area-project" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="Ej: Rendimiento, Seguridad de API" disabled={isLoading} />
        </div>
        
        <Button onClick={handleAnalyze} disabled={isLoading || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analizar Proyecto
        </Button>

        {error && <ErrorDisplay error={error} />}

        {isLoading && !result && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando proyecto...</p></div>}
        
        {result && (
          <Card className="mt-6 bg-background">
            <PageSectionHeader icon={ListChecks} title={result.analysisTitle} />
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Evaluación General:</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.generalAssessment}</p>
              </div>
              {result.overallImprovementIdeas && result.overallImprovementIdeas.length > 0 && (
                 <div>
                    <h3 className="font-semibold text-lg mb-1">Ideas Generales de Mejora:</h3>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {result.overallImprovementIdeas.map((idea, index) => <li key={`idea-${index}`}>{idea}</li>)}
                    </ul>
                 </div>
              )}
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
                        <p className="text-xs">Prioridad: <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></p>
                        {s.suggestedPromptForImplementation && (
                          <div className="mt-1 pt-1 border-t border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground">Prompt Sugerido:</p>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-1 rounded-sm">{s.suggestedPromptForImplementation}</pre>
                          </div>
                        )}
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
