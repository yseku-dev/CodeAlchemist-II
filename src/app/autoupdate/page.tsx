
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useDebug, type DebugLogEntry } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput, AppSourceFile } from '@/types';
import { callAnalyzeSelfCode as analyzeProjectFlow } from '@/utils/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateConfigForm from '@/components/features/autoupdate/AutoUpdateConfigForm';
import AutoUpdateResultsDisplay from '@/components/features/autoupdate/AutoUpdateResultsDisplay';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';
import { getApplicationSourceBundle } from './actions';
import JSZip from 'jszip';
import LogsDisplay from '@/components/logs-display';

type AutoUpdateSourceType = "Local" | "Git";

/**
 * @fileOverview Page component for the "AutoUpdate" feature.
 * Allows CodeAlchemist to analyze its own codebase (or a specified Git repository)
 * for improvements, display suggestions (including a unified prompt), and manage them.
 * Includes AI-driven analysis, suggestion editing, conceptual testing, and download of suggestions/code.
 * @module AutoUpdatePage
 */
export default function AutoUpdatePage() {
  const { agents, groups, settings: globalSettings, getAgentById, getGroupById } = useAppState();
  const { addLog: addDebugLog } = useDebug();
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
      
      if (llmConfigSource?.type !== initialConfig.type || 
          (llmConfigSource?.type === 'Agente' && initialConfig.type === 'Agente' && llmConfigSource.id !== initialConfig.id) ||
          (llmConfigSource?.type === 'Ajustes Globales' && initialConfig.type !== 'Ajustes Globales')) {
        setLlmConfigSource(initialConfig);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState(''); 
  
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeOutput | null>(null);
  const [suggestions, setSuggestions] = useState<AutoUpdateSuggestion[]>([]);
  const [unifiedPrompt, setUnifiedPrompt] = useState<string | null>(null);

  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);
  
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [suggestionToTest, setSuggestionToTest] = useState<AutoUpdateSuggestion | null>(null);

  const [showTestInVenvDialog, setShowTestInVenvDialog] = useState(false);
  const [suggestionToTestInVenv, setSuggestionToTestInVenv] = useState<AutoUpdateSuggestion | null>(null);

  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  /**
   * Processes the raw analysis output from the AI flow and prepares it for UI display.
   * This includes mapping detailed suggestions to `AutoUpdateSuggestion` format,
   * handling potential group logs, and generating a unified prompt from individual suggestions.
   * @async
   * @private
   * @param {AnalyzeCodeInput} analysisInput - The input that was sent to the analysis flow.
   * @param {LLMConfigSourceOption | undefined} currentLlmConfigSource - The LLM configuration source used for the analysis.
   * @returns {Promise<{ analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null }>} An object containing the processed analysis output, suggestions mapped for UI, and a unified prompt.
   * @throws {AppError} If the AI flow call fails or returns unexpected data.
   */
  const _executeAnalysisAndProcessResults = useCallback(async (
    analysisInput: AnalyzeCodeInput,
    currentLlmConfigSource: LLMConfigSourceOption | undefined
  ): Promise<{ analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null }> => {
    const flowName = 'analyzeSelfCode (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "Executing analysis for AutoUpdate...", data: { input: analysisInput, config: currentLlmConfigSource }, flowName});
    
    const aiResult = await analyzeProjectFlow(analysisInput);
    
    const projectFilesForOriginalContent = analysisInput.sourceCodeLocation === 'Local' && analysisInput.projectContent 
    ? (await getApplicationSourceBundle(false)).files || []
    : [];


    const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => {
      const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
      const relatedFile = projectFilesForOriginalContent?.find(f => {
        if (!s.area) return false;
        const areaLower = normalizePath(s.area.toLowerCase());
        const fileNameLower = normalizePath(f.fileName.toLowerCase());
        const baseAreaLower = areaLower.split(' (parte ')[0]; 
        return fileNameLower === baseAreaLower;
      });
      return {
        id: `suggestion-${index}-${Date.now()}`,
        area: s.area,
        suggestion: s.suggestion,
        priority: s.priority,
        fullFileContentSuggested: s.suggestedContent,
        suggestedPromptForImplementation: s.suggestedPromptForImplementation,
        status: 'pending',
        isEditing: false,
        userEditedContent: undefined,
        originalContent: relatedFile?.content,
      };
    });

    let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };
    if (currentLlmConfigSource?.type === 'Grupo' && currentLlmConfigSource.name) {
        const group = getGroupById(currentLlmConfigSource.id || '');
        const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
        finalResult.groupLog = `Log de Contexto del Grupo de Trabajo:\n------------------------------------\nGrupo Seleccionado: ${currentLlmConfigSource.name}\nTarea Principal del Grupo: ${(group?.mainTask || 'N/A').substring(0,150)}...\nInput del Usuario: ${analysisInput.focusArea || 'Análisis general'}\nContexto del Orquestador (usado para guiar a la IA):\n\"${(orchestratorAgent?.systemPrompt || 'No disponible').substring(0, 200)}...\"\n---\nNota: El flujo Genkit (analyzeSelfCode) fue ejecutado utilizando el contexto del orquestador del grupo seleccionado para guiar el proceso de la IA.`;
    }

    let generatedUnifiedPrompt = null;
    if (mappedSuggestions.length > 0) {
      const allPrompts = mappedSuggestions
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s => `// --- INICIO: Prompt para mejorar el archivo: ${s.area} ---\n${s.suggestedPromptForImplementation}\n// --- FIN: Prompt para mejorar el archivo: ${s.area} ---`)
        .join('\n\n');
      if (allPrompts.trim() !== '') {
        generatedUnifiedPrompt = allPrompts;
      }
    }
    
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "AutoUpdate analysis processing complete.", data: { output: finalResult, unifiedPrompt: generatedUnifiedPrompt?.substring(0,100) + "..." }, flowName});
    return { analysisOutput: finalResult, mappedSuggestions, generatedUnifiedPrompt };
  }, [agents, groups, getAgentById, getGroupById, addDebugLog]); 
  
  /**
   * Initiates the self-analysis process for CodeAlchemist's codebase.
   * It fetches the source code (either locally via Server Action or from a Git URL),
   * then calls the AI analysis flow, and updates the UI with progress and results.
   * @async
   */
  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setUnifiedPrompt(null);
    setProgress(0);
    const flowName = 'analyzeSelfCode (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Starting AutoUpdate analysis. Source: ${sourceType}, Config: ${JSON.stringify(llmConfigSource)}`, flowName});

    let projectContentForAnalysis: string | undefined;

    if (sourceType === 'Local') {
      try {
        toast({ title: "Obteniendo Código Local...", description: "Contactando al servidor para el código fuente."});
        const bundleResult = await getApplicationSourceBundle(false); 
        if (!bundleResult.success || !bundleResult.files) {
          throw new Error(bundleResult.error || "No se pudo obtener el código fuente local para análisis.");
        }
        projectContentForAnalysis = bundleResult.files.map(f => `// --- Archivo: ${f.fileName} ---\n${f.content}`).join('\n\n');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "Código local obtenido del servidor."});
      } catch (e) {
        const err = e as Error;
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: "Failed to get local source bundle", data: { error: err.message }, flowName});
        handleAnalysisError(err.message);
        setIsAnalyzing(false);
        return;
      }
    }
    
    const currentAgent = llmConfigSource?.type === 'Agente' ? getAgentById(llmConfigSource.id || '') : undefined;
    const currentGroup = llmConfigSource?.type === 'Grupo' ? getGroupById(llmConfigSource.id || '') : undefined;

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      projectContent: projectContentForAnalysis, // For local, this now contains actual code from server
      analysisPreferences: analysisPreferences || undefined, 
      focusArea: analysisPreferences || undefined, 
      agentSystemPrompt: currentAgent 
        ? currentAgent.systemPrompt 
        : currentGroup 
        ? currentGroup.mainTask 
        : undefined,
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
        }, 300); // Slightly slower interval for better perception
        
        await _executeAnalysisAndProcessResults(input, llmConfigSource)
          .then(({ analysisOutput, mappedSuggestions, generatedUnifiedPrompt }) => {
            clearInterval(intervalId);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setUnifiedPrompt(generatedUnifiedPrompt);
            setProgress(100);
            toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "AutoUpdate analysis successful (non-group).", flowName});
          })
          .catch(err => { 
            clearInterval(intervalId);
            throw err; 
          });
      } else { 
        // For group, progress bar is less relevant as it's one complex call
        setProgress(50); // Indicate it's working
        const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = await _executeAnalysisAndProcessResults(input, llmConfigSource);
        setAnalysisResult(analysisOutput);
        setSuggestions(mappedSuggestions);
        setUnifiedPrompt(generatedUnifiedPrompt);
        setProgress(100); 
        toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
        addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "AutoUpdate analysis successful (group).", flowName});
      }
    } catch (e: any) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: "AutoUpdate analysis failed in UI", data: { errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage }, flowName});
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Auto-Análisis", description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el auto-análisis.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Auto-Análisis", description: errorMsg });
      }
      setProgress(0);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sourceType, gitRepoUrl, analysisPreferences, llmConfigSource, agents, groups, getAgentById, getGroupById, _executeAnalysisAndProcessResults, toast, addDebugLog, router]); 

  /**
   * Handles the click to apply a suggestion, opening a confirmation dialog.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to apply.
   */
  const handleApplySuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent || suggestion.fullFileContentSuggested)) {
        toast({variant: "destructive", title: "Sin Contenido", description: "Esta sugerencia no tiene contenido de archivo para aplicar."});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  }, [toast]);

  /**
   * Confirms application of a suggestion, updating its status in the UI.
   * Actual file modification is a manual step by the user due to browser limitations.
   */
  const confirmApplySuggestion = useCallback(() => {
    if (!suggestionToApply) return;
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Marking suggestion as applied for ${suggestionToApply.area}. (Direct file modification is not feasible from browser).`});
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: "Sugerencia Marcada como Aplicada", description: `Cambios para ${suggestionToApply.area} marcados. La modificación real de archivos no es posible desde el navegador.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  }, [suggestionToApply, toast, addDebugLog]);

  /**
   * Handles downloading:
   * - 'JSON_SUGGESTIONS': Downloads a JSON file of suggestions (file path -> suggested content).
   * - 'ZIP_PROJECT': Downloads the current project source code (obtained via Server Action) as a ZIP,
   *                  with 'applied' suggestions conceptually included.
   * @param {'JSON_SUGGESTIONS' | 'ZIP_PROJECT'} format - The desired download format.
   * @async
   */
  const handleDownload = useCallback(async (format: 'JSON_SUGGESTIONS' | 'ZIP_PROJECT') => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Download requested: ${format}`});

    if (format === 'JSON_SUGGESTIONS') {
      if (!suggestions || suggestions.length === 0) {
        toast({ title: "Sin Sugerencias", description: "No hay sugerencias para descargar." });
        return;
      }
      const filesToDownload: Record<string, string | undefined> = {};
      let hasContent = false;
      suggestions.forEach(s => {
        const content = s.userEditedContent ?? s.fullFileContentSuggested;
        if (s.area && content !== undefined) {
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
      addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "AutoUpdate suggestions downloaded as JSON."});
    } else if (format === 'ZIP_PROJECT') {
        toast({ title: "Preparando Descarga del Proyecto (ZIP)...", description: "Obteniendo código del servidor..." });
        setIsAnalyzing(true); // Show loading state
        try {
            const bundleResult = await getApplicationSourceBundle(false);
            if (!bundleResult.success || !bundleResult.files) {
                throw new Error(bundleResult.error || "No se pudo obtener el código fuente del servidor para el ZIP.");
            }

            let filesToPackage: AppSourceFile[] = bundleResult.files;

            if (suggestions && suggestions.length > 0) {
                const appliedSuggestionsMap = new Map<string, string>();
                suggestions.filter(s => s.status === 'applied').forEach(s => {
                    const content = s.userEditedContent ?? s.fullFileContentSuggested;
                    if (s.area && content !== undefined) {
                        appliedSuggestionsMap.set(s.area, content);
                    }
                });

                filesToPackage = filesToPackage.map(file => {
                  const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
                  const normalizedFileName = normalizePath(file.fileName);
                  for (const [area, content] of appliedSuggestionsMap.entries()) {
                      if (normalizePath(area) === normalizedFileName) {
                          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Aplicando contenido de sugerencia a ${file.fileName} para ZIP.`});
                          return { ...file, content: content };
                      }
                  }
                  return file;
                });
                addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencias 'applied' incorporadas conceptualmente para el ZIP.`});
            }

            const zip = new JSZip();
            filesToPackage.forEach(file => {
                zip.file(file.fileName, file.content);
            });

            const zipBlob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = "CodeAlchemist_CodigoActual_Con_Sugerencias.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({ 
                title: "Descarga de Proyecto (ZIP) Iniciada", 
                description: "Este ZIP contiene el código actual de la aplicación (obtenido del servidor) con las sugerencias 'aplicadas' conceptualmente.",
                duration: 8000,
            });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Project ZIP download initiated with ${filesToPackage.length} files.`});
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : "Error desconocido al generar ZIP.";
            toast({ variant: "destructive", title: "Error al Generar ZIP", description: errorMsg });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `ZIP generation failed: ${errorMsg}`});
        } finally {
            setIsAnalyzing(false);
        }
    }
  }, [suggestions, toast, addDebugLog, analysisResult]);

  /**
   * Handles committing and pushing changes to Git (conceptual).
   * Opens a dialog to get a commit message.
   * @async
   */
  const handleGitCommitAndPush = useCallback(async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Committing and pushing to Git with message: "${commitMessage}". (Functionality requires backend/Git CLI access).`});
    toast({ title: "Subida a Git (Simulada)", description: "La subida a Git no está implementada en este entorno. Se requeriría acceso a Git CLI y autenticación." });
    setShowCommitDialog(false);
    setCommitMessage('');
  }, [commitMessage, toast, addDebugLog]);

  /**
   * Attempts to use AI to provide a solution or explanation for a displayed error on this page.
   * @async
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = useCallback(async (errorMsg: string) => {
    const autoFixFlowName = 'analyzeSelfCode (AutoFix Error)'; 
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Attempting Auto-Fix for error: ${errorMsg}`, flowName: autoFixFlowName});
    setIsAnalyzing(true); // Use general loading indicator
    setError(null);
    try {
      const result = await analyzeProjectFlow({ 
        sourceCodeLocation: 'Local', // Context is "local" CodeAlchemist code
        projectContent: `Error a analizar: ${errorMsg}\n\nContexto: Error ocurrido en la funcionalidad AutoUpdate de CodeAlchemist.`,
        focusArea: `Explicar el siguiente error y proponer una solución o pasos para depurarlo: "${errorMsg}"`,
        agentSystemPrompt: getAgentById('refactorizador-codigo-experto')?.systemPrompt, // Use refactorer agent for this
      });
      toast({ title: "Sugerencia de Auto-Fix", description: result.generalAssessment, duration: 10000 });
      // Optionally, display this in a more structured way if needed.
    } catch (e: any) {
      const appErr = e instanceof AppError ? e : new AppError("No se pudo obtener ayuda de la IA para este error.", e, 'ai');
      toast({ variant: "destructive", title: "Error en Auto-Fix", description: appErr.friendlyMessage });
      if (appErr.redirectTo) router.push(appErr.redirectTo);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addDebugLog, toast, router, getAgentById]);

  /**
   * Toggles the editing mode for a specific suggestion.
   * Initializes `userEditedContent` if it's undefined.
   * @param {string} suggestionId - The ID of the suggestion to toggle edit mode for.
   */
  const handleToggleEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        const newIsEditing = !s.isEditing;
        const newUserEditedContent = newIsEditing && s.userEditedContent === undefined 
                                     ? (s.fullFileContentSuggested ?? '') 
                                     : s.userEditedContent;
        return { ...s, isEditing: newIsEditing, userEditedContent: newUserEditedContent };
      }
      return s;
    }));
  }, []);
  
  /**
   * Updates the `userEditedContent` for a suggestion as the user types.
   * @param {string} suggestionId - The ID of the suggestion being edited.
   * @param {string} newContent - The new content from the textarea.
   */
  const handleSuggestionContentChange = useCallback((suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  }, []);

  /**
   * Saves the edited content for a suggestion and exits editing mode.
   * @param {string} suggestionId - The ID of the suggestion to save.
   */
  const handleSaveEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: "Edición Guardada", description: "El contenido sugerido ha sido actualizado localmente."})
  }, [toast]);

  /**
   * Cancels editing for a suggestion and reverts `userEditedContent`.
   * @param {string} suggestionId - The ID of the suggestion to cancel editing for.
   */
  const handleCancelEdit = useCallback((suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Revert to the original AI suggestion or empty if none
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested || undefined };
      }
      return s;
    }));
  }, []);

  /**
   * Opens a dialog to "test" a suggestion (displays code for review).
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestSuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  }, []);

  /**
   * Opens a dialog to "test in virtual environment" (displays code and explanation).
   * @param {AutoUpdateSuggestion} suggestion - The suggestion for virtual environment testing.
   */
  const handleTestInVenvClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTestInVenv(suggestion);
    setShowTestInVenvDialog(true);
  }, []);

  /**
   * Handles analysis errors by setting the error state and displaying a toast.
   * @param {string} [errorMsg] - The error message to display.
   */
  const handleAnalysisError = (errorMsg?: string) => { 
    setError(errorMsg || "Ocurrió un error desconocido durante el análisis.");
    toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg || "Ocurrió un error desconocido." });
    setProgress(0);
    setIsAnalyzing(false);
  };


  return (
    <React.Fragment>
      <div className="space-y-6">
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
          isAnalysisInProgress={isAnalyzing && !analysisResult && progress < 100}
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
          onDownloadSuggestions={handleDownload}
          onOpenCommitDialog={() => setShowCommitDialog(true)}
          unifiedPrompt={unifiedPrompt}
        />

        <ConfirmDialog
          isOpen={showConfirmApplyDialog && !!suggestionToApply}
          onClose={() => { setSuggestionToApply(null); setShowConfirmApplyDialog(false); }}
          onConfirm={confirmApplySuggestion}
          title={`Aplicar Sugerencia a ${suggestionToApply?.area}`}
          confirmText="Sí, Marcar como Aplicada"
        >
          <p className="text-sm mb-2 text-muted-foreground">Se marcará como aplicada la sugerencia para <code className="bg-muted px-1 rounded-sm text-foreground">{suggestionToApply?.area}</code>. La modificación real del archivo no es posible desde el navegador. Revisa el contenido sugerido (o editado) y aplícalo manualmente en tu entorno de desarrollo:</p>
          <ScrollArea className="h-64 border rounded-md">
            <CodeBlock code={suggestionToApply?.userEditedContent ?? suggestionToApply?.fullFileContentSuggested ?? "Error: No hay contenido para mostrar."} language="typescript" maxHeight="100%" />
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
              <CodeBlock code={suggestionToTest?.userEditedContent ?? suggestionToTest?.fullFileContentSuggested ?? "No hay contenido para testear."} language="typescript" maxHeight="100%" />
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
              <CodeBlock code={suggestionToTestInVenv?.userEditedContent ?? suggestionToTestInVenv?.fullFileContentSuggested ?? "No hay contenido para testear."} language="typescript" maxHeight="100%" />
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">Acción: Se intentaría crear un entorno virtual, instalar dependencias (si se pudieran inferir) y ejecutar el código/pruebas.</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => {
                toast({ title: "Simulación: Prueba en Entorno Virtual", description: `Se simula el inicio de pruebas para ${suggestionToTestInVenv?.area}.`});
                addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Simulated virtual environment test for ${suggestionToTestInVenv?.area}.`});
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
          <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Ej: Aplicadas sugerencias de AutoUpdate" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-2">Esta acción intentaría realizar un commit y push. (Funcionalidad requiere acceso a Git CLI y autenticación no disponibles en este entorno).</p>
        </ConfirmDialog>

        {(analysisResult?.groupLog || (isAnalyzing && !analysisResult && llmConfigSource?.type === 'Grupo')) && (
            <div className="lg:col-span-3 mt-4">
            <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={analysisResult?.groupLog || (isAnalyzing ? ["Analizando con grupo..."] : ["Esperando resultados del grupo..."])} defaultExpanded={!!analysisResult?.groupLog}/>
            </div>
        )}
      </div>
    </React.Fragment>
  );
}
