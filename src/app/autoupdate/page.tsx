
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, GitCommit, Sparkles, ClipboardList, Wand2, Play, Edit3, Check, X, Save } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput } from '@/types';
import { analyzeSelfCode as analyzeProjectFlow } from '@/ai/flows/analyze-self-code';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

type AutoUpdateSourceType = "Local" | "Git";

export default function AutoUpdatePage() {
  const { agents, getAgentById } = useAppState();
  
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    () => ({ type: 'Ajustes Globales' as const })
  );

  useEffect(() => {
    if (agents && agents.length > 0) {
      const defaultAgentFound = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      const newConfig = defaultAgentFound
        ? { type: 'Agente' as const, id: defaultAgentFound.id, name: defaultAgentFound.name }
        : { type: 'Ajustes Globales' as const };

      if (llmConfigSource?.type !== newConfig.type || llmConfigSource?.id !== newConfig.id) {
        setLlmConfigSource(newConfig);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]); // Only re-run if agents array changes

  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeOutput | null>(null);
  const [suggestions, setSuggestions] = useState<AutoUpdateSuggestion[]>([]);

  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);
  
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [suggestionToTest, setSuggestionToTest] = useState<AutoUpdateSuggestion | null>(null);

  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleStartAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setProgress(0);
    addLog(`Starting AutoUpdate analysis. Source: ${sourceType}, Config: ${JSON.stringify(llmConfigSource)}`);

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      analysisPreferences: analysisPreferences || undefined,
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: analysisPreferences || undefined, // Use analysisPreferences as focusArea
    };

    try {
      if (llmConfigSource?.type !== 'Grupo') {
        let currentProgress = 0;
        const intervalId = setInterval(() => {
          currentProgress += 10;
          if (currentProgress <= 100) {
            setProgress(currentProgress);
          } else {
            clearInterval(intervalId);
          }
        }, 200);
      }

      const aiResult = await analyzeProjectFlow(input);
      const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => ({
        id: `suggestion-${index}-${Date.now()}`,
        area: s.area,
        suggestion: s.suggestion,
        priority: s.priority,
        fullFileContentSuggested: s.suggestedContent,
        status: 'pending',
        isEditing: false,
        userEditedContent: s.suggestedContent, 
      }));

      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };
      if (llmConfigSource?.type === 'Grupo') {
         finalResult.groupLog = `(Simulación de Log de Grupo para AutoUpdate)\nTurno 1: Orquestador -> AgenteAnalizadorInterno (usando '${llmConfigSource.name}'). Tarea: Analizar código de CodeAlchemist con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorInterno -> Sugerencias generadas.`;
      }
      setAnalysisResult(finalResult);
      setSuggestions(mappedSuggestions);
      setProgress(100);
      toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
      addLog("AutoUpdate analysis successful.");
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error durante el auto-análisis.";
      setError(errorMsg);
      addLog(`AutoUpdate analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Auto-Análisis", description: errorMsg });
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent || suggestion.fullFileContentSuggested)) {
        toast({variant: "destructive", title: "Sin Contenido", description: "Esta sugerencia no tiene contenido de archivo para aplicar."});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  };

  const confirmApplySuggestion = () => {
    if (!suggestionToApply) return;
    addLog(`Marking suggestion as applied for ${suggestionToApply.area}. (Direct file modification is not feasible from browser).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: "Sugerencia Marcada como Aplicada", description: `Cambios para ${suggestionToApply.area} marcados. La modificación real de archivos no es posible desde el navegador.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };

  const handleDownloadCode = (format: 'JSON' | 'ZIP') => {
    if (!suggestions || suggestions.length === 0) {
      toast({ title: "Sin Sugerencias", description: "No hay sugerencias para descargar." });
      return;
    }

    if (format === 'JSON') {
      const filesToDownload: Record<string, string | undefined> = {};
      let hasContent = false;
      suggestions.forEach(s => {
        const content = s.userEditedContent ?? s.fullFileContentSuggested;
        if (content !== undefined) {
          filesToDownload[s.area] = content;
          hasContent = true;
        }
      });

      if (!hasContent) {
        toast({ title: "Sin Contenido", description: "Ninguna de las sugerencias tiene contenido de archivo para descargar." });
        return;
      }

      const jsonString = JSON.stringify(filesToDownload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "autoupdate_sugerencias.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Descarga Completada", description: "Sugerencias descargadas como autoupdate_sugerencias.json." });
      addLog("AutoUpdate suggestions downloaded as JSON.");

    } else if (format === 'ZIP') {
      toast({ 
        title: "Descarga ZIP no Implementada", 
        description: "La descarga de sugerencias como archivo ZIP no está implementada en este entorno debido a limitaciones. Por favor, utiliza la opción 'Descargar Sugerencias (JSON)'.",
        duration: 5000,
      });
      addLog("ZIP download for suggestions attempted but not implemented client-side.");
    }
  };

  const handleGitCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    addLog(`Committing and pushing to Git with message: "${commitMessage}". (Functionality requires backend/Git CLI access).`);
    toast({ title: "Subida a Git (Simulada)", description: "La subida a Git no está implementada en este entorno. Se requeriría acceso a Git CLI y autenticación." });
    setShowCommitDialog(false);
    setCommitMessage('');
  };

  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
    // Actual AI call would go here if implemented
  };

  const handleToggleEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        const newIsEditing = !s.isEditing;
        const newUserEditedContent = newIsEditing && !s.userEditedContent ? s.fullFileContentSuggested || '' : s.userEditedContent;
        return { ...s, isEditing: newIsEditing, userEditedContent: newUserEditedContent };
      }
      return s;
    }));
  };
  
  const handleSuggestionContentChange = (suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  };

  const handleSaveEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: "Edición Guardada", description: "El contenido sugerido ha sido actualizado localmente."})
  };

  const handleCancelEdit = (suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested || '' };
      }
      return s;
    }));
  };

  const handleTestSuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            <span>AutoUpdate (Análisis del Propio Código)</span>
          </CardTitle>
          <CardDescription>Permite que CodeAlchemist analice su propio código fuente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />

          <div className="space-y-2">
            <Label>Fuente del Código para Auto-Análisis</Label>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as AutoUpdateSourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Local">Local (código actual de la app)</SelectItem>
                <SelectItem value="Git">URL del Repositorio Git</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourceType === "Git" && (
            <div className="space-y-2">
              <Label htmlFor="autoupdate-git-url">URL del Repositorio Git</Label>
              <Input id="autoupdate-git-url" value={gitRepoUrl} onChange={(e) => setGitRepoUrl(e.target.value)} placeholder="URL HTTPS del repo CodeAlchemist" disabled={isLoading} />
            </div>
          )}

          <Separator />
          <Label>Parámetros de Auto-Análisis</Label>
          <div className="space-y-2">
            <Label htmlFor="analysis-prefs" className="text-sm font-normal">Preferencias de Análisis / Campo de Enfoque (opcional)</Label>
            <Textarea id="analysis-prefs" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)} placeholder="Ej: Enfocarse en optimización UI. Todas las sugerencias en castellano." rows={3} disabled={isLoading} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="search-depth-autoupdate" className="text-sm font-normal">Profundidad de Búsqueda (opcional)</Label>
            <Input id="search-depth-autoupdate" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder="Ej: 2 (niveles)" disabled={isLoading} min="1" />
          </div>

          <Button onClick={handleStartAnalysis} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Auto-Análisis"}
          </Button>
          {isLoading && progress > 0 && progress < 100 && llmConfigSource?.type !== 'Grupo' && <Progress value={progress} className="w-full mt-2" />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary" />
            <span>Resultados del Auto-Análisis</span>
          </CardTitle>
          {analysisResult && (
            <div className="flex flex-wrap gap-2 justify-end mt-2">
                <Button variant="outline" size="sm" onClick={() => handleDownloadCode('JSON')} disabled={!suggestions.length}><Download className="mr-2 h-4 w-4" /> Descargar Sugerencias (JSON)</Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadCode('ZIP')} disabled={!suggestions.length}><Download className="mr-2 h-4 w-4" /> Descargar Sugerencias (ZIP)</Button>
                <Button variant="outline" size="sm" onClick={() => setShowCommitDialog(true)}><GitCommit className="mr-2 h-4 w-4" /> Subir a Git</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} />}
          {isLoading && !analysisResult && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando código...</p></div>}

          {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">Inicia un análisis para ver los resultados.</p>}

          {analysisResult && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{analysisResult.analysisTitle}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.generalAssessment}</p>
              
              {analysisResult.overallImprovementIdeas && analysisResult.overallImprovementIdeas.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold text-lg mb-2">Ideas Generales de Mejora Sugeridas por IA:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {analysisResult.overallImprovementIdeas.map((idea, index) => (
                      <li key={`idea-${index}`}>{idea}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-lg">Sugerencias Detalladas:</h4>
                {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No hay sugerencias detalladas.</p>}
                <ScrollArea className="max-h-[50vh] overflow-y-auto pr-2">
                    <div className="space-y-3">
                    {suggestions.map(s => (
                        <AutoUpdateSuggestionCard
                        key={s.id}
                        suggestion={s}
                        onApply={() => handleApplySuggestionClick(s)}
                        onToggleEdit={() => handleToggleEdit(s.id)}
                        onContentChange={(newContent) => handleSuggestionContentChange(s.id, newContent)}
                        onSaveEdit={() => handleSaveEdit(s.id)}
                        onCancelEdit={() => handleCancelEdit(s.id)}
                        onTest={() => handleTestSuggestionClick(s)}
                        />
                    ))}
                    </div>
                </ScrollArea>
              </div>
              {analysisResult.groupLog && <LogsDisplay title="Log de Ejecución del Grupo" logs={analysisResult.groupLog} />}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showConfirmApplyDialog && !!suggestionToApply}
        onClose={() => setShowConfirmApplyDialog(false)}
        onConfirm={confirmApplySuggestion}
        title={`Aplicar Sugerencia a ${suggestionToApply?.area}`}
        confirmText="Sí, Marcar como Aplicada"
      >
        <p className="text-sm mb-2">Se marcará como aplicada la sugerencia para <code className="bg-muted px-1 rounded-sm">{suggestionToApply?.area}</code>. La modificación real del archivo no es posible desde el navegador. Revisa el contenido sugerido (o editado) y aplícalo manualmente:</p>
        <ScrollArea className="h-64 border rounded-md">
          <CodeBlock code={suggestionToApply?.userEditedContent || suggestionToApply?.fullFileContentSuggested || "Error: No hay contenido para mostrar."} language="typescript" maxHeight="100%" />
        </ScrollArea>
      </ConfirmDialog>

      <Dialog open={showTestDialog && !!suggestionToTest} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Testear Sugerencia: {suggestionToTest?.area}</DialogTitle>
            <DialogDescription>
              Revisa el código sugerido o editado. La prueba real debe realizarse en tu entorno de desarrollo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] mt-4 border rounded-md">
            <CodeBlock code={suggestionToTest?.userEditedContent || suggestionToTest?.fullFileContentSuggested || "No hay contenido para testear."} language="typescript" maxHeight="100%" />
          </ScrollArea>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        onConfirm={handleGitCommitAndPush}
        title="Subir Cambios a Git"
        confirmText="Commit y Push"
      >
        <Label htmlFor="commit-message">Mensaje de Commit:</Label>
        <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Ej: Aplicadas sugerencias de AutoUpdate" className="mt-1" />
        <p className="text-xs text-muted-foreground mt-2">Esta acción intentaría realizar un commit y push. (Funcionalidad requiere acceso a Git CLI y autenticación no disponibles en este entorno).</p>
      </ConfirmDialog>

      <div className="lg:col-span-3 mt-4">
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={analysisResult?.groupLog ? [analysisResult.groupLog] : ["Inicia un análisis para ver los logs..."]} defaultExpanded={false}/>
      </div>
    </div>
  );
}

    