
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card'; // Removed CardHeader etc. for PageSectionHeader
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, BadgeHelp, BadgeCheck, BadgeX, GitMerge, GitPullRequestDraft, ListChecks, Info } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, RefactorSuggestion, RefactorProjectWithAIInput, RefactorProjectWithAIOutput as AIResult } from '@/types';
import { GENERAL_PRIORITIES, GeneralPriority } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import { callRefactorProjectWithAI } from '@/utils/apiClient';
import LogsDisplay from '@/components/logs-display';
import { Separator } from "@/components/ui/separator";
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';


type ProjectSourceType = "upload" | "git";
const NINGUNA_PRIORITY_VALUE = "__none__"; 

/**
 * @fileOverview RefactorizarProyectoPage component allows users to analyze an existing project
 * for refactoring suggestions. Users can upload a project or provide a Git URL,
 * specify refactoring goals and priorities, and then review and manage AI-generated suggestions.
 * The analysis starts with an overview of the project's objectives and functionalities.
 */
export default function RefactorizarProyectoPage() {
  const { agents, getAgentById } = useAppState(); 
  const router = useRouter();
  
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    () => ({ type: 'Ajustes Globales' as const })
  );

  useEffect(() => {
    if (agents && agents.length > 0) {
      const defaultAgentFound = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      const newConfig = defaultAgentFound
        ? { type: 'Agente' as const, id: defaultAgentFound.id, name: defaultAgentFound.name }
        : { type: 'Ajustes Globales' as const };
      
      if (llmConfigSource?.type !== newConfig.type || (llmConfigSource.type === newConfig.type && 'id' in llmConfigSource && 'id' in newConfig && llmConfigSource.id !== newConfig.id )) {
        setLlmConfigSource(newConfig);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);


  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [refactorGoals, setRefactorGoals] = useState('');
  const [generalPriority, setGeneralPriority] = useState<GeneralPriority | ''>('');
  const [searchDepth, setSearchDepth] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIResult | null>(null); // Store the full result
  const [suggestions, setSuggestions] = useState<RefactorSuggestion[]>([]);
  
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentDiff, setCurrentDiff] = useState<{ original?: string, modified?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  /**
   * Handles changes to the file input for project source.
   * Validates file type and size.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      const allowedExtensions = ['.py', '.js', '.java', '.json', '.html', '.css', '.txt', '.md'];
      const isAllowedTextFile = allowedExtensions.some(ext => file.name.endsWith(ext)) && file.type.startsWith('text/');

      if ((allowedTypes.includes(file.type) || isAllowedTextFile || file.name.endsWith('.zip')) && file.size <= 10 * 1024 * 1024) {
        setUploadedFile(file);
        addLog({message: `File selected for refactor: ${file.name}, type: ${file.type}, size: ${file.size} bytes`, flowName: 'handleFileChange'});
      } else {
        toast({ variant: "destructive", title: "Archivo Inválido", description: "Tipo de archivo no admitido o tamaño excede 10MB." });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  /**
   * Initiates the project refactoring analysis by calling the AI flow.
   * Manages loading states, error handling, and displays results including the project overview.
   */
  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    let flowName = 'refactorProjectWithAI';

    let projectSourceValue = "";
    if (projectSourceType === "upload" && uploadedFile) {
      projectSourceValue = `uploaded_file_reference:${uploadedFile.name}`; 
      addLog({message: `Analyzing uploaded file reference for refactor: ${uploadedFile.name}`, flowName});
    } else if (projectSourceType === "git" && gitUrl) {
      projectSourceValue = gitUrl;
      addLog({message: `Analyzing Git URL for refactor: ${gitUrl}`, flowName});
    } else {
      toast({ variant: "destructive", title: "Fuente del Proyecto Requerida", description: "Sube un archivo o proporciona una URL de Git." });
      setIsLoading(false);
      return;
    }
    
    const input: RefactorProjectWithAIInput = {
      projectSource: projectSourceValue,
      goals: refactorGoals || undefined,
      priority: generalPriority || undefined,
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: focusArea || undefined,
    };
    
    addLog({message: `Refactoring project with input: ${JSON.stringify(input)} and config: ${JSON.stringify(llmConfigSource)}`, flowName});

    try {
      const aiResult: AIResult = await callRefactorProjectWithAI(input);
      
      let finalResult: AIResult = { ...aiResult };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name) {
         finalResult.groupLog = `(Simulación de Log de Grupo para Refactorización)\nTurno 1: Orquestador -> AgenteRefactorizador (usando '${llmConfigSource.name}'). Tarea: Refactorizar proyecto con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteRefactorizador -> Sugerencias de refactorización generadas.`;
      }
      setAnalysisResult(finalResult);
      setSuggestions(finalResult.suggestions.map((s,idx) => ({...s, id: `suggestion-${idx}-${Date.now()}`, status: 'pending'})));
      toast({ title: "Análisis Completado", description: "Sugerencias de refactorización generadas." });
      addLog({message: "Refactoring analysis successful.", data: finalResult, flowName});
    } catch (e: any) {
      addLog({ message: "Refactoring analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Análisis", description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis de refactorización.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Marks a refactoring suggestion as applied in the UI.
   * @param {string} id - The ID of the suggestion to apply.
   */
  const handleApplySuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' } : s));
    const suggestionArea = suggestions.find(s=>s.id===id)?.area || 'desconocida';
    toast({ title: "Sugerencia Marcada como Aplicada", description: `La sugerencia para "${suggestionArea}" ha sido marcada. Recuerda aplicar los cambios manualmente en tu código si es necesario.` });
    addLog({message: `Suggestion ${id} marked as applied.`, flowName: 'handleApplySuggestion'});
  };

  /**
   * Opens a modal to display the diff for a suggestion.
   * @param {RefactorSuggestion} suggestion - The suggestion for which to show the diff.
   */
  const handleViewDiff = (suggestion: RefactorSuggestion) => {
    if (suggestion.snippetSuggested) {
      setCurrentDiff(suggestion.snippetSuggested);
      setShowDiffModal(true);
    } else {
      toast({ title: "Sin Diff", description: "Esta sugerencia no tiene un snippet de código para comparar." });
    }
  };
  
  /**
   * Marks a refactoring suggestion as discarded in the UI.
   * @param {string} id - The ID of the suggestion to discard.
   */
  const handleDiscardSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'discarded' } : s));
    toast({ title: "Sugerencia Descartada" });
    addLog({message: `Suggestion ${id} discarded.`, flowName: 'handleDiscardSuggestion'});
  };

  /**
   * Marks all pending suggestions as applied.
   */
  const handleApplyAll = () => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: "Todas Marcadas como Aplicadas", description: "Todas las sugerencias pendientes han sido marcadas. Aplica los cambios manualmente." });
    addLog({message: "All pending suggestions marked as applied.", flowName: 'handleApplyAll'});
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <PageSectionHeader
          icon={GitPullRequestDraft}
          title="Refactorizar Proyecto"
          description="Analiza un proyecto para obtener sugerencias de refactorización y aplícalas."
        />
        <CardContent className="space-y-6">
          <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />

          <div className="space-y-2">
            <Label>Fuente del Proyecto</Label>
            <Select value={projectSourceType} onValueChange={(value) => setProjectSourceType(value as ProjectSourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upload">Subir Archivo</SelectItem>
                <SelectItem value="git">URL de Git</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {projectSourceType === "upload" && (
            <div className="space-y-2">
              <Label htmlFor="file-upload">Subir Archivo (.zip, .json, .py, .js, etc.)</Label>
              <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} disabled={isLoading} />
              {uploadedFile && <p className="text-xs text-muted-foreground">Archivo seleccionado: {uploadedFile.name}</p>}
            </div>
          )}

          {projectSourceType === "git" && (
            <div className="space-y-2">
              <Label htmlFor="git-url">URL de Git</Label>
              <Input id="git-url" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder="https://github.com/usuario/repo.git" disabled={isLoading} />
            </div>
          )}

          <Separator />
          <Label>Parámetros de Refactorización</Label>
          <div className="space-y-2">
            <Label htmlFor="refactor-goals" className="text-sm font-normal">Metas (opcional)</Label>
            <Textarea id="refactor-goals" value={refactorGoals} onChange={(e) => setRefactorGoals(e.target.value)} placeholder="Ej: Mejorar rendimiento UI, simplificar lógica X..." rows={3} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general-priority" className="text-sm font-normal">Prioridad General (opcional)</Label>
            <Select
              value={generalPriority === '' ? NINGUNA_PRIORITY_VALUE : generalPriority}
              onValueChange={(selectedValue) => {
                if (selectedValue === NINGUNA_PRIORITY_VALUE) {
                  setGeneralPriority('');
                } else {
                  setGeneralPriority(selectedValue as GeneralPriority);
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="general-priority">
                <SelectValue placeholder="Seleccionar prioridad..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNA_PRIORITY_VALUE}>Ninguna</SelectItem>
                {GENERAL_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-depth" className="text-sm font-normal">Profundidad de Búsqueda (opcional)</Label>
            <Input id="search-depth" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder="Ej: 3 (niveles)" disabled={isLoading} min="1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="focus-area" className="text-sm font-normal">Campo de Enfoque del Análisis (opcional)</Label>
            <Input id="focus-area" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="Ej: Seguridad, UI, Módulo de pagos" disabled={isLoading} />
          </div>
          
          <Button onClick={handleAnalyze} disabled={isLoading || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analizar para Refactorizar
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <PageSectionHeader
            icon={ListChecks}
            title="Resultados y Sugerencias"
            actions={suggestions.length > 0 ? (
                <Button onClick={handleApplyAll} size="sm" variant="outline" disabled={isLoading || suggestions.every(s => s.status !== 'pending')}>
                    Marcar Todas como Aplicadas
                </Button>
            ) : null}
        />
        <CardContent>
          {error && <ErrorDisplay error={error} />}
          {isLoading && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando proyecto...</p></div>}
          
          {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">Aún no hay sugerencias. Realiza un análisis para comenzar.</p>}

          {analysisResult && (
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-4 pr-4">
                <Card className="mb-4 bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-blue-600" /> Resumen del Proyecto</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="whitespace-pre-wrap">{analysisResult.projectOverview || "No se proporcionó un resumen del proyecto."}</p>
                  </CardContent>
                </Card>
                
                <Separator className="my-4" />
                <h3 className="text-lg font-semibold mb-2">Sugerencias de Refactorización:</h3>
                {suggestions.length === 0 && <p className="text-muted-foreground text-sm">No se generaron sugerencias específicas de refactorización.</p>}
                {suggestions.map(s => (
                  <Card key={s.id} className={`transition-opacity ${s.status === 'discarded' ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-md font-semibold">{s.area}</CardTitle>
                          <CardDescription>Prioridad: <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></CardDescription>
                        </div>
                        {s.status === 'pending' && <BadgeHelp className="text-blue-500 h-5 w-5" />}
                        {s.status === 'applied' && <BadgeCheck className="text-green-500 h-5 w-5" />}
                        {s.status === 'discarded' && <BadgeX className="text-muted-foreground h-5 w-5" />}
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="mb-2">{s.description}</p>
                      {s.snippetSuggested && (
                         <div className="my-2 p-2 bg-secondary/50 rounded-md">
                            <p className="text-xs font-semibold mb-1">Snippet Sugerido:</p>
                            <p className="text-xs text-muted-foreground break-all">Original: <code>{s.snippetSuggested.original?.substring(0,100)}{s.snippetSuggested.original && s.snippetSuggested.original.length > 100 ? '...' : ''}</code></p>
                            <p className="text-xs text-muted-foreground break-all">Modificado: <code>{s.snippetSuggested.modified?.substring(0,100)}{s.snippetSuggested.modified && s.snippetSuggested.modified.length > 100 ? '...' : ''}</code></p>
                         </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 py-2">
                      {s.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleViewDiff(s)} disabled={!s.snippetSuggested}>Ver Diff</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDiscardSuggestion(s.id)}>Descartar</Button>
                          <Button size="sm" onClick={() => handleApplySuggestion(s.id)}>Marcar como Aplicada</Button>
                        </>
                      )}
                       {s.status !== 'pending' && (
                         <Button size="sm" variant="ghost" onClick={() => setSuggestions(prev => prev.map(sg => sg.id === s.id ? {...sg, status: 'pending'} : sg))}>Revertir Estado</Button>
                       )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          {analysisResult?.groupLog && <LogsDisplay title="Log de Ejecución del Grupo" logs={analysisResult.groupLog} />}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        onConfirm={() => setShowDiffModal(false)} 
        title="Comparación de Código (Diff)"
        confirmText="Cerrar"
        cancelText="" 
      >
        {currentDiff && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h4 className="font-semibold mb-1">Original:</h4>
              <CodeBlock code={currentDiff.original || "N/A"} language="plaintext" maxHeight="250px" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Sugerido:</h4>
              <CodeBlock code={currentDiff.modified || "N/A"} language="plaintext" maxHeight="250px"/>
            </div>
          </div>
        )}
      </ConfirmDialog>

    </div>
  );
}
