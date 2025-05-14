
"use client";

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react'; // Removed SparklesIcon for direct Sparkles
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput } from '@/types';
import { callAnalyzeSelfCode as analyzeProjectFlow } from '@/utils/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateConfigForm from '@/components/features/autoupdate/AutoUpdateConfigForm';
import AutoUpdateResultsDisplay from '@/components/features/autoupdate/AutoUpdateResultsDisplay';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';

type AutoUpdateSourceType = "Local" | "Git";

/**
 * @fileOverview Page component for the "AutoUpdate" feature.
 * Allows CodeAlchemist to analyze its own codebase (or a specified Git repository)
 * for improvements, display suggestions, and manage them. Includes AI-driven analysis,
 * suggestion editing, conceptual testing, and download of suggestions.
 */
export default function AutoUpdatePage() {
  const { agents, settings: globalSettings } = useAppState(); 
  const { addLog: addLogContext } = useDebug();
  const { toast } = useToast();
  const router = useRouter();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    () => ({ type: 'Ajustes Globales' as const })
  );

  useEffect(() => {
    if (agents && agents.length > 0) {
      const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      const initialConfig = defaultAgent
        ? { type: 'Agente' as const, id: defaultAgent.id, name: defaultAgent.name }
        : { type: 'Ajustes Globales' as const };
      // Only update if the derived initialConfig is different from the current state
      // to prevent unnecessary re-renders if the state was already set correctly.
      if (llmConfigSource?.type !== initialConfig.type || (llmConfigSource?.type === initialConfig.type && ('id' in llmConfigSource && 'id' in initialConfig) && llmConfigSource.id !== initialConfig.id)) {
        setLlmConfigSource(initialConfig);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]); // llmConfigSource removed from deps to avoid loop with its own setter

  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState(''); // Serves as focusArea for analyzeProjectFlow
  
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeOutput | null>(null);
  const [suggestions, setSuggestions] = useState<AutoUpdateSuggestion[]>([]);

  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);
  
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [suggestionToTest, setSuggestionToTest] = useState<AutoUpdateSuggestion | null>(null);

  const [showTestInVenvDialog, setShowTestInVenvDialog] = useState(false);
  const [suggestionToTestInVenv, setSuggestionToTestInVenv] = useState<AutoUpdateSuggestion | null>(null);

  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  /**
   * Internal helper to execute the analysis and process results.
   * @param {AnalyzeCodeInput} analysisInput - The input for the analysis flow.
   * @param {LLMConfigSourceOption | undefined} currentLlmConfigSource - The selected LLM config.
   * @returns {Promise<{ analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[] }>} Processed results.
   */
  const _executeAnalysisAndProcessResults = async (
    analysisInput: AnalyzeCodeInput,
    currentLlmConfigSource: LLMConfigSourceOption | undefined
  ): Promise<{ analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[] }> => {
    const flowName = 'analyzeSelfCode (AutoUpdate)';
    addLogContext({message: "Executing analysis for AutoUpdate...", input: analysisInput, config: currentLlmConfigSource, flowName});
    const aiResult = await analyzeProjectFlow(analysisInput);
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
    if (currentLlmConfigSource?.type === 'Grupo' && currentLlmConfigSource.name) {
        finalResult.groupLog = `(Simulación de Log de Grupo para AutoUpdate)\nTurno 1: Orquestador -> AgenteAnalizadorInterno (usando '${currentLlmConfigSource.name}'). Tarea: Analizar código de CodeAlchemist con enfoque en '${analysisInput.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorInterno -> Sugerencias generadas.`;
    }
    addLogContext({message: "AutoUpdate analysis processing complete.", output: finalResult, flowName});
    return { analysisOutput: finalResult, mappedSuggestions };
  };
  
  /**
   * Initiates the auto-analysis process. Sets loading states, calls the analysis helper,
   * and updates the UI with results or errors.
   */
  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setProgress(0);
    const flowName = 'analyzeSelfCode (AutoUpdate)';
    addLogContext({message: `Starting AutoUpdate analysis. Source: ${sourceType}, Config: ${JSON.stringify(llmConfigSource)}`, flowName});

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      analysisPreferences: analysisPreferences || undefined, 
      focusArea: analysisPreferences || undefined, 
      // searchDepth is not passed, implying full analysis by the flow
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
        
        await _executeAnalysisAndProcessResults(input, llmConfigSource)
          .then(({ analysisOutput, mappedSuggestions }) => {
            clearInterval(intervalId);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setProgress(100);
            toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
            addLogContext({message: "AutoUpdate analysis successful (non-group).", flowName});
          })
          .catch(err => { // Catch errors specifically from _executeAnalysisAndProcessResults
            clearInterval(intervalId);
            throw err; 
          });
      } else { 
        const { analysisOutput, mappedSuggestions } = await _executeAnalysisAndProcessResults(input, llmConfigSource);
        setAnalysisResult(analysisOutput);
        setSuggestions(mappedSuggestions);
        setProgress(100); 
        toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
        addLogContext({message: "AutoUpdate analysis successful (group).", flowName});
      }
    } catch (e: any) {
      addLogContext({ message: "AutoUpdate analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName});
      const errorMsg = e instanceof AppError ? e.friendlyMessage : e.message || "Ocurrió un error durante el auto-análisis.";
      setError(errorMsg);
      toast({ variant: "destructive", title: "Error de Auto-Análisis", description: errorMsg });
      setProgress(0);
      if (e instanceof AppError && e.redirectTo) {
        router.push(e.redirectTo);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handles the click to apply a suggestion, opening a confirmation dialog.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to apply.
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
   * Confirms application of a suggestion, updating its status in the UI.
   * Actual file modification is a manual step by the user.
   */
  const confirmApplySuggestion = () => {
    if (!suggestionToApply) return;
    addLogContext(`Marking suggestion as applied for ${suggestionToApply.area}. (Direct file modification is not feasible from browser).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: "Sugerencia Marcada como Aplicada", description: `Cambios para ${suggestionToApply.area} marcados. La modificación real de archivos no es posible desde el navegador.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };

  /**
   * Handles downloading suggestions, currently supporting JSON format.
   * @param {'JSON' | 'ZIP'} format - The desired download format.
   */
  const handleDownloadSuggestions = (format: 'JSON' | 'ZIP') => {
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
      addLogContext("AutoUpdate suggestions downloaded as JSON.");

    } else if (format === 'ZIP') {
      toast({ 
        title: "Descarga ZIP no Implementada", 
        description: "La descarga de sugerencias como archivo ZIP no está implementada directamente en este entorno debido a limitaciones. Por favor, utiliza la opción 'Descargar Sugerencias (JSON)' para obtener las sugerencias en formato de texto.",
        duration: 7000,
      });
      addLogContext("ZIP download for suggestions attempted but not fully implemented client-side.");
    }
  };

  /**
   * Handles committing and pushing changes to Git (conceptual, as direct Git ops are not feasible from browser).
   */
  const handleGitCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    addLogContext(`Committing and pushing to Git with message: "${commitMessage}". (Functionality requires backend/Git CLI access).`);
    toast({ title: "Subida a Git (Simulada)", description: "La subida a Git no está implementada en este entorno. Se requeriría acceso a Git CLI y autenticación." });
    setShowCommitDialog(false);
    setCommitMessage('');
  };

  /**
   * Placeholder for AI-driven error fixing for this page.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    const autoFixFlowName = 'chatWithAgentOrGlobal (AutoFix Error)';
    addLogContext({message: `Attempting Auto-Fix for error: ${errorMsg}`, flowName: autoFixFlowName});
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
  };

  /**
   * Toggles the editing mode for a specific suggestion.
   * Initializes `userEditedContent` if it's undefined.
   * @param {string} suggestionId - The ID of the suggestion to toggle edit mode for.
   */
  const handleToggleEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        const newIsEditing = !s.isEditing;
        const newUserEditedContent = newIsEditing && s.userEditedContent === undefined 
                                     ? (s.fullFileContentSuggested || '') 
                                     : s.userEditedContent;
        return { ...s, isEditing: newIsEditing, userEditedContent: newUserEditedContent };
      }
      return s;
    }));
  };
  
  /**
   * Updates the `userEditedContent` for a suggestion as the user types.
   * @param {string} suggestionId - The ID of the suggestion being edited.
   * @param {string} newContent - The new content from the textarea.
   */
  const handleSuggestionContentChange = (suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  };

  /**
   * Saves the edited content for a suggestion and exits editing mode.
   * @param {string} suggestionId - The ID of the suggestion to save.
   */
  const handleSaveEdit = (suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: "Edición Guardada", description: "El contenido sugerido ha sido actualizado localmente."})
  };

  /**
   * Cancels editing for a suggestion and reverts `userEditedContent`.
   * @param {string} suggestionId - The ID of the suggestion to cancel editing for.
   */
  const handleCancelEdit = (suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested || undefined };
      }
      return s;
    }));
  };

  /**
   * Opens a dialog to "test" a suggestion (displays code for review).
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestSuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  };

  /**
   * Opens a dialog to "test in virtual environment" (displays code and explanation).
   * @param {AutoUpdateSuggestion} suggestion - The suggestion for virtual environment testing.
   */
  const handleTestInVenvClick = (suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTestInVenv(suggestion);
    setShowTestInVenvDialog(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <AutoUpdateConfigForm
        llmConfigSource={llmConfigSource}
        onLlmConfigSourceChange={setLlmConfigSource}
        sourceType={sourceType}
        onSourceTypeChange={setSourceType}
        gitRepoUrl={gitRepoUrl}
        onGitRepoUrlChange={setGitRepoUrl}
        analysisPreferences={analysisPreferences}
        onAnalysisPreferencesChange={setAnalysisPreferences}
        onStartAnalysis={handleStartAnalysis}
        isLoading={isAnalyzing}
        progress={progress}
        isAnalysisInProgress={isAnalyzing && !analysisResult}
      />

      <AutoUpdateResultsDisplay
        analysisResult={analysisResult}
        suggestions={suggestions}
        isLoading={isAnalyzing && !analysisResult} 
        error={error}
        onAutoFixError={handleAutoFixError}
        onApplySuggestion={handleApplySuggestionClick}
        onToggleEdit={handleToggleEdit}
        onContentChange={handleSuggestionContentChange}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onTestSuggestion={handleTestSuggestionClick}
        onTestInVenv={handleTestInVenvClick}
        onDownloadSuggestions={handleDownloadSuggestions}
        onOpenCommitDialog={() => setShowCommitDialog(true)}
      />

      <ConfirmDialog
        isOpen={showConfirmApplyDialog && !!suggestionToApply}
        onClose={() => setShowConfirmApplyDialog(false)}
        onConfirm={confirmApplySuggestion}
        title={`Aplicar Sugerencia a ${suggestionToApply?.area}`}
        confirmText="Sí, Marcar como Aplicada"
      >
        <p className="text-sm mb-2">Se marcará como aplicada la sugerencia para <code className="bg-muted px-1 rounded-sm">{suggestionToApply?.area}</code>. La modificación real del archivo no es posible desde el navegador. Revisa el contenido sugerido (o editado) y aplícalo manually:</p>
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
              addLogContext(`Simulated virtual environment test for ${suggestionToTestInVenv?.area}.`);
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
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={(analysisResult?.groupLog && analysisResult.groupLog.length > 0) ? [analysisResult.groupLog] : (isAnalyzing && !analysisResult ? ["Analizando..."] : ["Inicia un análisis para ver los logs..."])} defaultExpanded={false}/>
      </div>
    </div>
  );
}
