
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FolderSearch } from 'lucide-react'; 
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, AnalyzeCodeInput, AnalyzeCodeOutput, Agent } from '@/types'; // Updated types
import { analyzeSelfCode as analyzeProjectFlow } from '@/ai/flows/analyze-self-code'; // Renamed import for clarity
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppState } from '@/context/AppStateContext';

type ProjectSourceType = "upload" | "git";

export default function AnalizarProyectoPage() {
  const { agents, getAgentById } = useAppState(); // For group logic
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>(''); // This serves as 'analysisPreferences'
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeOutput | null>(null); // Updated type
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json'];
      if (allowedTypes.includes(file.type) && file.size <= 25 * 1024 * 1024) { 
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

    let analysisInput: AnalyzeCodeInput;

    if (projectSourceType === "upload" && uploadedFile) {
      // For uploaded files, we'd ideally read its content.
      // For this version, we'll send a placeholder string or indicate it's an upload.
      // A real implementation would require sending file content or path to a backend/flow.
      // Let's assume the flow 'analyzeProjectFlow' can take a hint about the source.
      const reader = new FileReader();
      reader.onload = async (e) => {
          const projectContent = e.target?.result as string;
          analysisInput = {
            sourceCodeLocation: "UploadedString",
            projectContent: projectContent, // Sending base64 for ZIPs might be better if flow supports it
            analysisPreferences: focusArea || undefined,
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
      // If it's a JSON, read as text. If ZIP, indicate it.
      if (uploadedFile.type === 'application/json') {
        reader.readAsText(uploadedFile);
      } else if (uploadedFile.type === 'application/zip') {
        // For ZIP, sending filename might be a hint to a backend. Here, we'll send a marker.
        // Or, ideally, extract content if possible, or send base64.
        // For now, we'll treat it like a string for the flow, with a note.
        analysisInput = {
            sourceCodeLocation: "UploadedString", // Or a new type like "UploadedZip" if flow handles it
            projectContent: `Contenido del archivo ZIP: ${uploadedFile.name}. El flujo debe poder manejar esta referencia.`,
            analysisPreferences: focusArea || undefined,
            searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
            focusArea: focusArea || undefined,
          };
        addLog(`Analyzing uploaded ZIP project: ${uploadedFile.name} (content not sent, reference only)`);
        await executeAnalysis(analysisInput);
      } else {
          toast({ variant: "destructive", title: "Tipo de Archivo no Soportado", description: "El análisis de este tipo de archivo no está completamente implementado para envío directo."});
          setIsLoading(false);
          return;
      }
      return; // Execution continues in FileReader onload
    } else if (projectSourceType === "git" && gitUrl) {
      analysisInput = {
        sourceCodeLocation: "Git",
        gitRepoUrl: gitUrl,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        focusArea: focusArea || undefined,
      };
      addLog(`Analyzing Git project URL: ${gitUrl}`);
    } else {
      toast({ variant: "destructive", title: "Fuente del Proyecto Requerida", description: "Sube un archivo o proporciona una URL de Git." });
      setIsLoading(false);
      return;
    }
    
    await executeAnalysis(analysisInput);
  };

  const executeAnalysis = async (input: AnalyzeCodeInput) => {
     addLog(`Analyzing project with input: ${JSON.stringify(input).substring(0, 200)}... and config: ${JSON.stringify(llmConfigSource)}`);
    
    let agentSystemPrompt: string | undefined;
     if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
      // Potentially pass this to flow if flow supports agent context for generic analysis
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const orchestrator = agents.find(a => a.id === 'orquestador-flujo-agentes');
      agentSystemPrompt = orchestrator?.systemPrompt;
      addLog(`Analyzing project with Group: ${llmConfigSource.name}. Orchestrator context might be used by flow.`);
    }
    // The analyzeProjectFlow (analyzeSelfCode) might need to be adapted to use agentSystemPrompt
    // if we want specific agent's persona to drive the generic project analysis.
    // For now, the flow's internal prompt will handle the logic.

    try {
      const aiResult = await analyzeProjectFlow(input); 
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };

      if (llmConfigSource?.type === 'Grupo') {
         finalResult.groupLog = `(Simulación de Log de Grupo para Análisis de Proyecto)\nTurno 1: Orquestador -> AgenteAnalizadorDeProyectos (usando '${llmConfigSource.name}'). Tarea: Analizar proyecto con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorDeProyectos -> Reporte de análisis generado.`;
      }

      setResult(finalResult);
      toast({ title: "Análisis Completado", description: "El proyecto ha sido analizado." });
      addLog("Project analysis successful.");
    } catch (e: any)
{
      const errorMsg = e.message || "Ocurrió un error durante el análisis del proyecto.";
      setError(errorMsg);
      addLog(`Project analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  }


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
                        <p className="text-xs">Prioridad: <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></p>
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
