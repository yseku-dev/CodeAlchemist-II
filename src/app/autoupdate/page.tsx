
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, GitCommit, Sparkles, ClipboardList, Wand2Icon, Play, TestTubeDiagonal } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput } from '@/types';
import { callAnalyzeSelfCode as analyzeProjectFlow } from '@/utils/apiClient'; // Corrected import alias
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AppError } from '@/utils/AppError';

type AutoUpdateSourceType = "Local" | "Git";

/**
 * @fileOverview Page component for the "AutoUpdate" feature.
 * Allows CodeAlchemist to analyze its own codebase (or a specified Git repository)
 * for improvements, display suggestions, and manage them.
 */

export default function AutoUpdatePage() {
  const { agents, getAgentById } = useAppState();
  const { addLog } = useDebug();
  const { toast } = useToast();

  /**
   * State for the selected LLM configuration source.
   * Defaults to "RefactorizadorCodigoExperto" agent if available, otherwise "Ajustes Globales".
   */
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    () => ({ type: 'Ajustes Globales' as const })
  );

  useEffect(() => {
    // Initialize llmConfigSource after agents are loaded
    if (agents && agents.length > 0) {
      const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      const initialConfig = defaultAgent
        ? { type: 'Agente' as const, id: defaultAgent.id, name: defaultAgent.name }
        : { type: 'Ajustes Globales' as const };
      setLlmConfigSource(initialConfig);
    }
  }, [agents]);

  /** State for the source type of the code to be analyzed (Local or Git). */
  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  /** State for the Git repository URL if sourceType is Git. */
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  /** State for user-defined analysis preferences or focus area. */
  const [analysisPreferences, setAnalysisPreferences] = useState('');
  
  /** State to indicate if an analysis is currently in progress. */
  const [isLoading, setIsLoading] = useState(false);
  /** State for the progress of the analysis (0-100). */
  const [progress, setProgress] = useState(0);
  /** State to store any error message from the analysis. */
  const [error, setError] = useState<string | null>(null);
  /** State to store the full analysis result from the AI. */
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeOutput | null>(null);
  /** State to store the list of detailed suggestions for UI manipulation. */
  const [suggestions, setSuggestions] = useState<AutoUpdateSuggestion[]>([]);

  /** State to control the visibility of the 'Apply Suggestion' confirmation dialog. */
  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  /** State to store the suggestion currently being considered for application. */
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);
  
  /** State to control the visibility of the 'Test Suggestion' dialog. */
  const [showTestDialog, setShowTestDialog] = useState(false);
  /** State to store the suggestion currently being considered for testing. */
  const [suggestionToTest, setSuggestionToTest] = useState<AutoUpdateSuggestion | null>(null);

  /** State to control the visibility of the 'Test in Virtual Environment' dialog. */
  const [showTestInVenvDialog, setShowTestInVenvDialog] = useState(false);
  /** State to store the suggestion for virtual environment testing. */
  const [suggestionToTestInVenv, setSuggestionToTestInVenv] = useState<AutoUpdateSuggestion | null>(null);

  /** State to control the visibility of the Git commit dialog. */
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  /** State for the Git commit message. */
  const [commitMessage, setCommitMessage] = useState('');

  /**
   * Initiates the auto-analysis process.
   * Prepares input for the AI flow, calls the flow, and processes the results.
   */
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
      focusArea: analysisPreferences || undefined, 
    };

    try {
      // Simulate progress bar for non-group analysis
      if (llmConfigSource?.type !== 'Grupo') {
        let currentProgress = 0;
        const intervalId = setInterval(() => {
          currentProgress += 10;
          if (currentProgress <= 100) {
            setProgress(currentProgress);
          } else {
            clearInterval(intervalId); // Stop interval once 100% is reached or surpassed
          }
        }, 200);
        // Ensure interval is cleared if an error occurs or analysis finishes early
        const cleanupInterval = () => clearInterval(intervalId);
        // Use a promise to manage cleanup with finally
        await analyzeProjectFlow(input)
          .then(aiResult => {
            clearInterval(intervalId); // Clear interval on success
            const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => ({
              id: `suggestion-${index}-${Date.now()}`,
              area: s.area,
              suggestion: s.suggestion,
              priority: s.priority,
              fullFileContentSuggested: s.suggestedContent,
              suggestedPromptForImplementation: s.suggestedPromptForImplementation,
              status: 'pending',
              isEditing: false,
              userEditedContent: undefined, 
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
          })
          .catch(err => {
            cleanupInterval(); // Clear interval on error
            throw err; // Re-throw error to be caught by outer catch
          });
      } else { // For group analysis, don't simulate progress bar
        const aiResult = await analyzeProjectFlow(input);
        const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => ({
          id: `suggestion-${index}-${Date.now()}`,
          area: s.area,
          suggestion: s.suggestion,
          priority: s.priority,
          fullFileContentSuggested: s.suggestedContent,
          suggestedPromptForImplementation: s.suggestedPromptForImplementation,
          status: 'pending',
          isEditing: false,
          userEditedContent: undefined, 
        }));
         let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };
        if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name) {
           finalResult.groupLog = `(Simulación de Log de Grupo para AutoUpdate)\nTurno 1: Orquestador -> AgenteAnalizadorInterno (usando '${llmConfigSource.name}'). Tarea: Analizar código de CodeAlchemist con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorInterno -> Sugerencias generadas.`;
        }
        setAnalysisResult(finalResult);
        setSuggestions(mappedSuggestions);
        setProgress(100); // Set to 100 as group analysis might not have granular progress
        toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
        addLog("AutoUpdate analysis successful.");
      }
    } catch (e: any) {
      addLog({ message: "AutoUpdate analysis failed in UI", error: e });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : e.message || "Ocurrió un error durante el auto-análisis.";
      setError(errorMsg);
      toast({ variant: "destructive", title: "Error de Auto-Análisis", description: errorMsg });
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the click on "Aplicar Sugerencia", opening a confirmation dialog.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to be applied.
   */
  const handleApplySuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent || suggestion.fullFileContentSuggested)) {
        toast({variant: "destructive", title: "Sin Contenido", description: "Esta sugerencia no tiene contenido de archivo para aplicar."});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  };

  /**
   * Confirms the application of a suggestion.
   * Marks the suggestion as 'applied' in the UI. Direct file modification is not performed.
   */
  const confirmApplySuggestion = () => {
    if (!suggestionToApply) return;
    addLog(`Marking suggestion as applied for ${suggestionToApply.area}. (Direct file modification is not feasible from browser).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: "Sugerencia Marcada como Aplicada", description: `Cambios para ${suggestionToApply.area} marcados. La modificación real de archivos no es posible desde el navegador.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };

  /**
   * Handles the download of suggested code, either as JSON or a placeholder for ZIP.
   * @param {'JSON' | 'ZIP'} format - The desired download format.
   */
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
        description: "La descarga de sugerencias como archivo ZIP no está implementada directamente en este entorno. Utiliza la opción 'Descargar Sugerencias (JSON)'.",
        duration: 5000,
      });
      addLog("ZIP download for suggestions attempted but not fully implemented client-side.");
    }
  };

  /**
   * Handles the Git commit and push action (currently simulated).
   */
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

  /**
   * Handles the "Auto-Fix" action for an error (currently simulated).
   * @param {string} errorMsg - The error message to be analyzed.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
  };

  /**
   * Toggles the editing mode for a specific suggestion.
   * @param {string} suggestionId - The ID of the suggestion to toggle edit mode for.
   */
  const handleToggleEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        const newIsEditing = !s.isEditing;
        // Initialize userEditedContent with fullFileContentSuggested if starting to edit and no user content exists
        const newUserEditedContent = newIsEditing && s.userEditedContent === undefined ? (s.fullFileContentSuggested || '') : s.userEditedContent;
        return { ...s, isEditing: newIsEditing, userEditedContent: newUserEditedContent };
      }
      return s;
    }));
  };
  
  /**
   * Handles changes to the content of a suggestion being edited.
   * @param {string} suggestionId - The ID of the suggestion being edited.
   * @param {string} newContent - The new content from the textarea.
   */
  const handleSuggestionContentChange = (suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  };

  /**
   * Saves the edited content of a suggestion and exits editing mode.
   * @param {string} suggestionId - The ID of the suggestion whose edit is to be saved.
   */
  const handleSaveEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: "Edición Guardada", description: "El contenido sugerido ha sido actualizado localmente."})
  };

  /**
   * Cancels editing for a suggestion and reverts any user-edited content.
   * @param {string} suggestionId - The ID of the suggestion whose edit is to be cancelled.
   */
  const handleCancelEdit = (suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Revert userEditedContent to the original fullFileContentSuggested or undefined
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested || undefined };
      }
      return s;
    }));
  };

  /**
   * Opens the dialog to "test" a suggestion.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestSuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  };

  /**
   * Opens the dialog to "test in virtual environment" a suggestion.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestInVenvClick = (suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTestInVenv(suggestion);
    setShowTestInVenvDialog(true);
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
                <ScrollArea className="max-h-[calc(100vh-22rem)] md:max-h-[calc(100vh-25rem)] lg:max-h-[50vh] overflow-y-auto pr-2">
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
                        onTestInVenv={() => handleTestInVenvClick(s)}
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

      <Dialog open={showTestDialog && !!suggestionToTest} onOpenChange={(open) => { if(!open) setSuggestionToTest(null); setShowTestDialog(open);}}>
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

      <Dialog open={showTestInVenvDialog && !!suggestionToTestInVenv} onOpenChange={(open) => { if(!open) setSuggestionToTestInVenv(null); setShowTestInVenvDialog(open);}}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Testear Sugerencia en Entorno Virtual: {suggestionToTestInVenv?.area}</DialogTitle>
            <DialogDescription>
              Esta funcionalidad simularía la ejecución del código sugerido en un entorno virtual aislado (ej. Python venv, Node.js NVM).
              La ejecución real requiere una infraestructura local o backend.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] mt-4 border rounded-md">
            <CodeBlock code={suggestionToTestInVenv?.userEditedContent || suggestionToTestInVenv?.fullFileContentSuggested || "No hay contenido para testear."} language="typescript" maxHeight="100%" />
          </ScrollArea>
          <p className="text-xs text-muted-foreground mt-2">Acción: Se intentaría crear un entorno virtual, instalar dependencias (si se pudieran inferir) y ejecutar el código/pruebas.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              toast({ title: "Simulación: Prueba en Entorno Virtual", description: `Se simula el inicio de pruebas para ${suggestionToTestInVenv?.area}.`});
              addLog(`Simulated virtual environment test for ${suggestionToTestInVenv?.area}.`);
              setShowTestInVenvDialog(false);
              setSuggestionToTestInVenv(null);
            }}>
              Simular Inicio de Prueba
            </Button>
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
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={(analysisResult?.groupLog && analysisResult.groupLog.length > 0) ? [analysisResult.groupLog] : ["Inicia un análisis para ver los logs..."]} defaultExpanded={false}/>
      </div>
    </div>
  );
}
