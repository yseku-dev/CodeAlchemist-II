
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, BadgeHelp, BadgeCheck, BadgeX, GitMerge } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, RefactorSuggestion } from '@/types';
import { GENERAL_PRIORITIES, GeneralPriority } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import { refactorProjectWithAI, type RefactorProjectWithAIOutput, RefactorProjectWithAIInput } from '@/ai/flows/refactor-project-with-ai';
import LogsDisplay from '@/components/logs-display';

type ProjectSourceType = "upload" | "git";

export default function RefactorizarProyectoPage() {
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Agente', id: 'refactorizador-codigo-experto', name: 'RefactorizadorCodigoExperto' });
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [refactorGoals, setRefactorGoals] = useState('');
  const [generalPriority, setGeneralPriority] = useState<GeneralPriority | ''>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RefactorSuggestion[]>([]);
  const [groupLog, setGroupLog] = useState<string | undefined>(undefined);
  
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentDiff, setCurrentDiff] = useState<{ original?: string, modified?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic validation: type and size (example: max 10MB)
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      // Specific extensions for text files
      const allowedExtensions = ['.py', '.js', '.java', '.json', '.html', '.css', '.txt', '.md'];
      const isAllowedTextFile = allowedExtensions.some(ext => file.name.endsWith(ext)) && file.type.startsWith('text/');


      if ((allowedTypes.includes(file.type) || isAllowedTextFile || file.name.endsWith('.zip')) && file.size <= 10 * 1024 * 1024) {
        setUploadedFile(file);
        addLog(`File selected: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      } else {
        toast({ variant: "destructive", title: "Archivo Inválido", description: "Tipo de archivo no admitido o tamaño excede 10MB." });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setGroupLog(undefined);

    let projectSourceValue = "";
    if (projectSourceType === "upload" && uploadedFile) {
      projectSourceValue = `file:${uploadedFile.name}`; // Placeholder, actual file content would be sent
      addLog(`Analyzing uploaded file: ${uploadedFile.name}`);
    } else if (projectSourceType === "git" && gitUrl) {
      projectSourceValue = gitUrl;
      addLog(`Analyzing Git URL: ${gitUrl}`);
    } else {
      toast({ variant: "destructive", title: "Fuente del Proyecto Requerida", description: "Sube un archivo o proporciona una URL de Git." });
      setIsLoading(false);
      return;
    }

    const input: RefactorProjectWithAIInput = {
      projectSource: projectSourceValue, // In a real scenario, this would be file content or Git repo access
      goals: refactorGoals || undefined,
      priority: generalPriority || undefined,
    };
    
    addLog(`Refactoring project with input: ${JSON.stringify(input)}`);

    try {
      // const aiResult = await refactorProjectWithAI(input);
      // Mocking AI result
      const mockAiResult: RefactorProjectWithAIOutput = {
        suggestions: [
          { id: "1", area: "src/utils.js - function calculateTotal", description: "Simplificar lógica condicional y usar early returns para mejorar legibilidad.", priority: "Media", snippetSuggested: { original: "if (value > 0) { if (discount > 0) { return value - discount; } else { return value; } } else { return 0; }", modified: "if (value <= 0) return 0;\nif (discount <= 0) return value;\nreturn value - discount;" } },
          { id: "2", area: "components/UserProfile.tsx", description: "Extraer componente UserAvatar para reutilización.", priority: "Alta" },
          { id: "3", area: "api/paymentController.java", description: "Añadir manejo de excepciones específico para fallos de red.", priority: "Alta", snippetSuggested: { original: "// process payment\nPaymentService.charge(amount);", modified: "try {\n  PaymentService.charge(amount);\n} catch (NetworkException e) {\n  log.error(\\"Network error during payment\\", e);\n  throw new PaymentFailedException(\\"Network issue\\", e);\n}"}},
        ]
      };
      // Simulate group log if group is selected
      if (llmConfigSource?.type === 'Grupo') {
        setGroupLog("Turno 1: Orquestador -> RefactorizadorCodigoExperto. Tarea: Analizar proyecto. \nTurno 2: RefactorizadorCodigoExperto -> Sugerencias generadas.");
      }

      setSuggestions(mockAiResult.suggestions.map(s => ({...s, status: 'pending'})));
      toast({ title: "Análisis Completado", description: "Sugerencias de refactorización generadas." });
      addLog("Refactoring analysis successful.");
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error durante el análisis.";
      setError(errorMsg);
      addLog(`Refactoring analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' } : s));
    toast({ title: "Sugerencia Aplicada", description: `La sugerencia para "${suggestions.find(s=>s.id===id)?.area}" ha sido marcada como aplicada.` });
    addLog(`Suggestion ${id} applied.`);
  };

  const handleViewDiff = (suggestion: RefactorSuggestion) => {
    if (suggestion.snippetSuggested) {
      setCurrentDiff(suggestion.snippetSuggested);
      setShowDiffModal(true);
    } else {
      toast({ title: "Sin Diff", description: "Esta sugerencia no tiene un snippet de código para comparar." });
    }
  };
  
  const handleDiscardSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'discarded' } : s));
    toast({ title: "Sugerencia Descartada" });
    addLog(`Suggestion ${id} discarded.`);
  };

  const handleApplyAll = () => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: "Todas las Sugerencias Aplicadas", description: "Todas las sugerencias pendientes han sido marcadas como aplicadas." });
    addLog("All pending suggestions applied.");
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Refactorizar Proyecto</CardTitle>
          <CardDescription>Analiza un proyecto para obtener sugerencias de refactorización y aplícalas.</CardDescription>
        </CardHeader>
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
            <Select value={generalPriority} onValueChange={(value) => setGeneralPriority(value as GeneralPriority)}>
              <SelectTrigger id="general-priority"><SelectValue placeholder="Seleccionar prioridad..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ninguna</SelectItem>
                {GENERAL_PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analizar para Refactorizar
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Resultados y Sugerencias</CardTitle>
          {suggestions.length > 0 && (
            <div className="flex justify-end">
                <Button onClick={handleApplyAll} size="sm" variant="outline" disabled={isLoading || suggestions.every(s => s.status !== 'pending')}>Aplicar Todas</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && <ErrorDisplay error={error} />}
          {isLoading && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando proyecto...</p></div>}
          
          {!isLoading && suggestions.length === 0 && !error && <p className="text-muted-foreground text-center py-10">Aún no hay sugerencias. Realiza un análisis para comenzar.</p>}

          {suggestions.length > 0 && (
            <ScrollArea className="h-[calc(100vh-12rem)]"> {/* Adjust height as needed */}
              <div className="space-y-4 pr-4">
                {suggestions.map(s => (
                  <Card key={s.id} className={`transition-opacity ${s.status === 'discarded' ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{s.area}</CardTitle>
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
                         <div className="my-2 p-2 bg-muted/30 rounded-md">
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
                          <Button size="sm" onClick={() => handleApplySuggestion(s.id)}>Aplicar</Button>
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
          {groupLog && <LogsDisplay title="Log de Ejecución del Grupo" logs={groupLog} />}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        onConfirm={() => setShowDiffModal(false)} // Or apply from here
        title="Comparación de Código (Diff)"
        confirmText="Cerrar"
        cancelText="" // No cancel button or change text
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
