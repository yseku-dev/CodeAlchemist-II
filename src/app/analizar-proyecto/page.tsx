
// src/app/analizar-proyecto/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppState } from '@/context/AppStateContext';
import type {
  LLMConfigSourceOption,
  AnalyzeCodeOutput,
  DetailedSuggestionForUI,
  AppSourceFile,
  ChatMessage,
  CodeSnapshot,
  AnalyzeCodeInput,
  ModifyProjectStructureInput,
  ProjectGenerationResult,
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callModifyProjectStructure,
  callChatWithAgentOrGlobal,
  callAutoFixErrorWithGroup
} from '@/utils/apiClient';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_AGENTS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useProjectSourceManager, type ProjectSourceType as HookProjectSourceType } from '@/hooks/useProjectSourceManager';
import { v4 as uuidv4 } from 'uuid';

import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
// getApplicationSourceBundle is a Server Action, ensure it's callable from client if needed directly or refactor use
// For this page, projectSourceManager now calls it.

/**
 * @fileOverview Page component for full project analysis.
 * Allows users to upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. Displays AI analysis results,
 * suggestions, and allows for interactive modification and snapshot saving.
 * Internationalized using useI18n.
 * Uses sub-components and a custom hook for source management.
 * @module AnalizarProyectoPage
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const projectSourceManager = useProjectSourceManager(
    'codealchemist-ap-page-v3', // Unique prefix for this page's localStorage items via the hook
    "upload" // Default source type
  );

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>(
    'codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' }
  );
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');
  
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useLocalStorage<string | null>('codealchemist-ap-error', null);
  
  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);
  // originalProjectFiles is now managed by useProjectSourceManager and passed back via its state
  
  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);
  const [unifiedSuggestionsPrompt, setUnifiedSuggestionsPrompt] = useLocalStorage<string | null>('codealchemist-ap-unifiedSuggestionsPrompt', null);
  
  // Callback for when file processing is done by the hook
  const handleFileProcessingDone = useCallback(
    (files: AppSourceFile[] | null, processingError?: string) => {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'CALLBACK', message: 'Callback de handleFileChangeManager (handleFileProcessingDone) ejecutado por hook', data: { hasFiles: !!files, processingError } });
      if (processingError) {
        setError(processingError);
        projectSourceManager.setOriginalProjectFiles(null); 
        setResult(null);
        setSuggestionsForUI([]);
        setModificationPrompt('');
        toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: processingError });
      } else if (files) {
        projectSourceManager.setOriginalProjectFiles(files); // The hook now manages this state, but we get it back for use
        setError(null);
        toast({ title: t('analyzeProject.toast.zipProcessed.title'as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: files.length }) });
      }
    },
    [setError, setResult, setSuggestionsForUI, setModificationPrompt, t, toast, addDebugLog, projectSourceManager]
  );

  useEffect(() => {
    if (suggestionsForUI && suggestionsForUI.length > 0) {
      const allPrompts = suggestionsForUI
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s =>
          `// --- ${t('analyzeProject.results.promptHeaderForArea' as TranslationKey, { area: s.area })} ---\n${s.suggestedPromptForImplementation}\n// --- ${t('analyzeProject.results.promptFooterForArea' as TranslationKey, { area: s.area })} ---`
        )
        .join('\n\n');
      setUnifiedSuggestionsPrompt(allPrompts.trim() !== '' ? allPrompts : null);
    } else {
      setUnifiedSuggestionsPrompt(null);
    }
  }, [suggestionsForUI, t, setUnifiedSuggestionsPrompt]);

  const executeAnalysis = useCallback(async (analysisInputForFlow: AnalyzeCodeInput) => {
    const flowName = 'callAnalyzeSelfCode (AnalizarProyecto)';
    addDebugLog({
        source: 'AnalizarProyectoPage', type: 'INFO',
        message: `Iniciando análisis de proyecto. Config: ${JSON.stringify(llmConfigSource)}`,
        data: { inputLength: analysisInputForFlow.projectContent?.length, focus: analysisInputForFlow.focusArea },
        flowName
    });

   try {
      const aiResult = await callAnalyzeSelfCode(analysisInputForFlow);
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         const group = getGroupById(llmConfigSource.id || '');
         const orchestrator = getAgentById(ORCHESTRATOR_AGENT_ID);
         finalResult.groupLog = t('analyzeProject.results.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInputForFlow.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalizarProyecto)'
        });
      }
      
      setResult(finalResult);
      setSuggestionsForUI((finalResult.detailedSuggestions || []).map((s, idx) => ({ ...s, id: `suggestion-ap-${idx}-${Date.now()}`, isSelected: false, suggestedContent: s.suggestedContent || undefined })));
      toast({ title: t('analyzeProject.toast.analysisComplete.title' as TranslationKey), description: t('analyzeProject.toast.analysisComplete.description' as TranslationKey) });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: "Análisis de proyecto exitoso.", data: {title: finalResult.analysisTitle, suggestions: (finalResult.detailedSuggestions || []).length}, flowName});
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en análisis de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = (e as Error).message || t('common.unknownError' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
    }
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoadingAnalysis, setLoadingMessage, setError]);

  const handleAnalyze = useCallback(async () => {
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');
    setUnifiedSuggestionsPrompt(null);
    
    // If not git and files were previously from a processed ZIP or local, useProjectSourceManager hook should retain them
    // unless projectSourceType changed in a way that clears originalProjectFiles in the hook.
    if (projectSourceManager.projectSourceType !== 'git' && !projectSourceManager.originalProjectFiles && projectSourceManager.projectSourceType === 'upload' && projectSourceManager.uploadedFile) {
        // This case is if the user re-selects "upload" but the file wasn't auto-reprocessed by the hook
        // or if the hook logic for re-processing on type change isn't immediate.
        // Forcing a re-process or relying on the hook's existing originalProjectFiles is key.
        // The hook's prepareProjectSourceForAnalysis should handle getting the files.
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: 'Source is upload, originalProjectFiles are null, attempting to ensure uploadedFile is processed.' });
    }


    const sourcePreparationResult = await projectSourceManager.prepareProjectSourceForAnalysis();
    
    if (sourcePreparationResult.error || !sourcePreparationResult.projectContentStringForAI) {
      const errorMsg = sourcePreparationResult.error || t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey);
      setError(errorMsg);
      toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: errorMsg });
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
      return;
    }
    
    // originalProjectFiles in the page state is updated by the hook's callback or by prepareProjectSourceForAnalysis effect.
    
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        agentSystemPrompt = group?.mainTask || DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID)?.systemPrompt; 
    }

    const analysisInputForFlow: AnalyzeCodeInput = {
        projectContent: sourcePreparationResult.projectContentStringForAI,
        sourceCodeLocation: sourcePreparationResult.sourceCodeLocationForAI,
        gitRepoUrl: projectSourceManager.projectSourceType === 'git' ? projectSourceManager.gitUrl : undefined,
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined, 
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    await executeAnalysis(analysisInputForFlow);

  }, [
      projectSourceManager, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, toast,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoadingAnalysis, setModificationPrompt, 
      setUnifiedSuggestionsPrompt
  ]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s =>
        s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s
      )
    );
  }, [setSuggestionsForUI]);
  
  const handleProcessModification = useCallback(async () => {
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: 'handleProcessModification INVOCADO', data: { modificationPromptVal: modificationPrompt, originalFilesExist: !!projectSourceManager.originalProjectFiles, resultType: result?.analysisTitle } });
    
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey), description: t('analyzeProject.toast.modificationError.description' as TranslationKey) });
      return;
    }

    if (!projectSourceManager.originalProjectFiles) { // Crucial check
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceManager.projectSourceType.charAt(0).toUpperCase() + projectSourceManager.projectSourceType.slice(1)}` as TranslationKey)}) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles (base para modificar).', data: { projectSourceType: projectSourceManager.projectSourceType } });
      return;
    }

    setIsProcessingModification(true);
    setError(null);
    const flowName = 'callModifyProjectStructure (AnalizarProyecto)';
    const tempCurrentModificationRequest = modificationPrompt;
            
    let agentSystemPromptForModification: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForModification = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID);
        agentSystemPromptForModification = orchestrator?.systemPrompt || group?.mainTask;
    } else {
        agentSystemPromptForModification = t('analyzeProject.results.defaultChatContextSystemPrompt' as TranslationKey);
    }
    
    const filesForModificationFlow = (projectSourceManager.originalProjectFiles || []).map(f_1 => ({
        path: f_1.fileName, 
        content: f_1.content,
        isFolder: f_1.fileName.endsWith('/'),
    }));

    const inputForModification: ModifyProjectStructureInput = {
      currentProject: {
        projectName: result?.analysisTitle || projectSourceManager.uploadedFileName || t('generateProject.results.defaultProjectName' as TranslationKey),
        aiNotes: result?.generalAssessment || "",
        files: filesForModificationFlow,
      },
      modificationRequest: tempCurrentModificationRequest,
      agentSystemPrompt: agentSystemPromptForModification,
    };
    
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Enviando petición de modificación al flujo: ${tempCurrentModificationRequest.substring(0,100)}...`, data: { projectName: inputForModification.currentProject.projectName, numFiles: inputForModification.currentProject.files.length }, flowName });
    
    try {
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto por IA exitosa (flujo completado).', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files?.length }, flowName});

      if (modifiedProjectResult && Array.isArray(modifiedProjectResult.files)) {
         projectSourceManager.setOriginalProjectFiles(modifiedProjectResult.files.map(f_2 => ({ fileName: f_2.path, content: f_2.content ?? '' }))); 
         const newAiNotes = modifiedProjectResult.aiNotes || result?.generalAssessment || t('analyzeProject.toast.modificationSuccess.noSpecificNotes' as TranslationKey);
         const newProjectName = modifiedProjectResult.projectName || result?.analysisTitle || projectSourceManager.uploadedFileName || 'ProyectoModificado';

         setResult(prevResult => ({
             ...(prevResult || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' }),
             analysisTitle: newProjectName,
             generalAssessment: newAiNotes,
             // No actualizar detailedSuggestions aquí, ya que la modificación fue sobre los archivos base
         }));
         
         toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey), description: newAiNotes });
         setModificationPrompt('');
      } else {
        const errorDetail = t('analyzeProject.toast.modificationError.invalidResponse' as TranslationKey);
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: errorDetail, data: { modifiedProjectResult }, flowName });
        throw new AppError(errorDetail, {originalError: "Respuesta de modificación de IA inválida", llmOutput: modifiedProjectResult}, 'ai');
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg); 
      setResult(prev => ({...(prev || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' }), generalAssessment: `${(prev || {generalAssessment:''}).generalAssessment || ''}\n\n[${t('common.error' as TranslationKey).toUpperCase()} ${t('analyzeProject.toast.modificationError.title' as TranslationKey)}]: ${errorMsg}`})); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
      modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, projectSourceManager,
      t, toast, router, addDebugLog, setModificationPrompt, setError, setIsProcessingModification,
      setResult, settings 
  ]);

  const handleRedefineFocusArea = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningFocusArea(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefiniendo campo de enfoque. Original (inicio): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'focusArea' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'focusArea'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg); 
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  const handleRedefineModificationPrompt = async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningModificationPrompt(true);
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefiniendo petición de modificación. Original (inicio): ${modificationPrompt.substring(0, 100)}...` });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: modificationPrompt });
      setModificationPrompt(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'modificationPrompt' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'modificationPrompt'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg); 
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  };

  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result && !projectSourceManager.originalProjectFiles) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, {section: t('sidebar.analyzeProject' as TranslationKey)})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || projectSourceManager.uploadedFileName || "Analisis").substring(0,30), time: new Date().toLocaleTimeString() });

    const dataToSave: Record<string, any> = {
        analysisResult: result, 
        currentOriginalFiles: projectSourceManager.originalProjectFiles || undefined,
        suggestionsWithSelection: suggestionsForUI, 
        sourceDetails: {
            type: projectSourceManager.projectSourceType,
            gitUrl: projectSourceManager.projectSourceType === 'git' ? projectSourceManager.gitUrl : undefined,
            uploadedFileName: projectSourceManager.projectSourceType === 'upload' ? projectSourceManager.uploadedFileName : undefined,
        }
    };

    const snapshotJsonString = JSON.stringify(dataToSave, null, 2);
    const stringLength = snapshotJsonString.length;

    if (stringLength > 4.5 * 1024 * 1024) { 
      toast({
        variant: "destructive",
        title: t('versions.toast.snapshotSaveError.title' as TranslationKey),
        description: t('versions.toast.snapshotSaveError.tooLarge' as TranslationKey, { size: (stringLength / (1024*1024)).toFixed(2) }),
        duration: 7000,
      });
      return;
    }
    addSnapshot({
      name: snapshotName,
      code: snapshotJsonString,
      source: 'project-analysis',
      size: stringLength,
      fileCount: projectSourceManager.originalProjectFiles?.length || undefined,
      metadata: {
        analysisTitle: result?.analysisTitle || projectSourceManager.uploadedFileName || "Análisis de Proyecto",
        sourceWasGit: projectSourceManager.projectSourceType === 'git' && !!projectSourceManager.gitUrl,
        originalFileName: projectSourceManager.uploadedFileName,
        hasProjectFiles: !!projectSourceManager.originalProjectFiles,
      }
    });
    toast({ title: t('versions.toast.snapshotSaved.title' as TranslationKey), description: t('versions.toast.snapshotSaved.description' as TranslationKey, { name: snapshotName })});
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Snapshot de análisis guardado: ${snapshotName}`});
  }, [result, suggestionsForUI, projectSourceManager, addSnapshot, t, toast, addDebugLog ]);

  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const type = projectSourceManager.projectSourceType;
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const sourceTypeTranslationKey = `analyzeProject.source${capitalizedType}` as TranslationKey;
    let translatedSourceType: string;
    try {
      translatedSourceType = t(sourceTypeTranslationKey);
    } catch {
      translatedSourceType = capitalizedType;
    }
    
    let prefixContext: string;
    try {
      prefixContext = t('analyzeProject.results.modificationContextPrefix' as TranslationKey, {
        focusArea: focusArea || "N/A",
        sourceType: translatedSourceType,
        sourceName: projectSourceManager.uploadedFileName || projectSourceManager.gitUrl || "Local"
      });
    } catch (e) {
        console.error("Error translating modificationContextPrefix, using fallback.", e);
        prefixContext = `Contexto para Auto-Fix. Foco: ${focusArea || "N/A"}. Fuente: ${translatedSourceType}. Nombre: ${projectSourceManager.uploadedFileName || projectSourceManager.gitUrl || "Local"}.`;
    }

    let modificationContextPart = "";
    if (modificationPrompt) {
      let modificationLabel: string;
      try {
        modificationLabel = t('analyzeProject.results.lastModificationLabel' as TranslationKey);
      } catch (e) {
          console.error("Error translating lastModificationLabel, using fallback.", e);
          modificationLabel = "Última Petición de Modificación";
      }
      // Sanitize modificationPrompt to be safely included in a string that might be part of another JSON or complex log
      const escapedModificationPrompt = modificationPrompt
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/"/g, '\\"')   // Escape double quotes
        .replace(/\n/g, '\\n');  // Escape newlines
      modificationContextPart = ` ${modificationLabel}: "${escapedModificationPrompt}"`;
    }
    const contextForAI = `${prefixContext}${modificationContextPart}`;

    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({
        errorMessage: errorToFix,
        codeContext: error || t('analyzeProject.results.errorContextFallback' as TranslationKey), 
        userInstructions: contextForAI,
      });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida`, data: fixSuggestion});
      toast({ title: t('error.errorDisplay.toast.autofixSuggestionReceived.title' as TranslationKey), description: t('error.errorDisplay.toast.autofixSuggestionReceived.description'as TranslationKey) });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError' as TranslationKey));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e});
    }
  }, [
    t, focusArea, projectSourceManager.projectSourceType, projectSourceManager.uploadedFileName, projectSourceManager.gitUrl, 
    modificationPrompt, addDebugLog, toast, error, settings.llmConfig
  ]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!projectSourceManager.originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceManager.projectSourceType.charAt(0).toUpperCase() + projectSourceManager.projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoadingAnalysis(true); 
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = projectSourceManager.originalProjectFiles.map(f => ({...f})); 
      
      const filesMap = new Map<string, AppSourceFile>(filesToZip.map(f_1 => [f_1.fileName, f_1]));

      suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area).forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) { 
            if (filesMap.has(suggestion.area)) {
                 filesMap.get(suggestion.area)!.content = suggestion.suggestedContent;
            } else {
                filesMap.set(suggestion.area, { fileName: suggestion.area, content: suggestion.suggestedContent });
            }
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area} para ZIP.` });
        }
      });
      filesToZip = Array.from(filesMap.values());

      const zip = new JSZip();
      filesToZip.forEach(file => {
        let cleanPath = file.fileName;
        if (cleanPath.startsWith('./')) cleanPath = cleanPath.substring(2);
        if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
        if (cleanPath.trim() !== "") { 
            zip.file(cleanPath, file.content);
        }
      });
      const zipFileNameKey = result?.analysisTitle || projectSourceManager.uploadedFileName || 'proyecto_analizado';
      const zipFileName = t('analyzeProject.downloads.zipFilename' as TranslationKey, {projectName: zipFileNameKey.replace(/\s+/g, '_').substring(0,30)});

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: t('analyzeProject.toast.zipDownloadSuccess.title' as TranslationKey), description: t('analyzeProject.toast.zipDownloadSuccess.description'as TranslationKey, { filename: zipFileName }) });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipReadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoadingAnalysis(false); 
      setLoadingMessage(null);
    }
  }, [projectSourceManager.originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoadingAnalysis, setLoadingMessage, addDebugLog, projectSourceManager.uploadedFileName, projectSourceManager.projectSourceType]);

  const handleApplySelectedCheckboxSuggestions = useCallback(() => {
    if (!projectSourceManager.originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles'as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceManager.projectSourceType.charAt(0).toUpperCase() + projectSourceManager.projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    const applicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area);
    if (applicableSuggestions.length === 0) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.noSuggestionsToApply.title'as TranslationKey), description: t('analyzeProject.toast.noSuggestionsToApply.description'as TranslationKey) });
        return;
    }

    const filesMap = new Map<string, AppSourceFile>(projectSourceManager.originalProjectFiles.map(f => [f.fileName, {...f}])); 
    applicableSuggestions.forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) { 
            if (filesMap.has(suggestion.area)) {
                filesMap.get(suggestion.area)!.content = suggestion.suggestedContent;
            } else {
                filesMap.set(suggestion.area, { fileName: suggestion.area, content: suggestion.suggestedContent });
            }
             addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox (en memoria) a: ${suggestion.area}.` });
        }
    });
    projectSourceManager.setOriginalProjectFiles(Array.from(filesMap.values())); 
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title'as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description'as TranslationKey) });
  }, [projectSourceManager, suggestionsForUI, toast, t, addDebugLog]);

  const isLoadingOverall = projectSourceManager.isLoadingSource || isLoadingAnalysis || isProcessingModification || isRedefiningFocusArea || isRedefiningModificationPrompt;
  const canApplyAndDownloadOverall = !!projectSourceManager.originalProjectFiles && projectSourceManager.originalProjectFiles.length > 0;

  return (
    <Card className="max-w-7xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceManager.projectSourceType}
          onProjectSourceTypeChange={(value) => projectSourceManager.setProjectSourceType(value as HookProjectSourceType)}
          uploadedFileName={projectSourceManager.uploadedFileName}
          onFileChange={(e) => projectSourceManager.handleFileChange(e, handleFileProcessingDone)}
          fileInputRef={projectSourceManager.fileInputRef}
          gitUrl={projectSourceManager.gitUrl}
          onGitUrlChange={projectSourceManager.setGitUrl}
          searchDepth={searchDepth}
          onSearchDepthChange={setSearchDepth}
          focusArea={focusArea}
          onFocusAreaChange={setFocusArea}
          onAnalyze={handleAnalyze}
          isLoading={isLoadingOverall}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusArea}
        />

        {error && <ErrorDisplay
                    error={error}
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))}
                    context={(() => {
                        const type = projectSourceManager.projectSourceType;
                        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
                        const sourceTypeTranslationKey = `analyzeProject.source${capitalizedType}` as TranslationKey;
                        let translatedSourceType: string;
                        try {
                            translatedSourceType = t(sourceTypeTranslationKey);
                        } catch {
                            translatedSourceType = capitalizedType;
                        }
                        
                        let prefixContextPart: string;
                        try {
                          prefixContextPart = t('analyzeProject.results.modificationContextPrefix' as TranslationKey, {
                            focusArea: focusArea || "N/A",
                            sourceType: translatedSourceType,
                            sourceName: projectSourceManager.uploadedFileName || projectSourceManager.gitUrl || "Local"
                          });
                        } catch (e_1) {
                            console.error("Error translating modificationContextPrefix, using fallback.", e_1);
                            prefixContextPart = `Contexto para Auto-Fix. Foco: ${focusArea || "N/A"}. Fuente: ${translatedSourceType}. Nombre: ${projectSourceManager.uploadedFileName || projectSourceManager.gitUrl || "Local"}.`;
                        }
                    
                        let modificationContextPart = "";
                        if (modificationPrompt) {
                          let modificationLabel: string;
                          try {
                            modificationLabel = t('analyzeProject.results.lastModificationLabel' as TranslationKey);
                          } catch (e_2) {
                              console.error("Error translating lastModificationLabel, using fallback.", e_2);
                              modificationLabel = "Última Petición de Modificación";
                          }
                          const escapedModificationPrompt = modificationPrompt
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"')  
                            .replace(/\n/g, '\\n'); 
                          modificationContextPart = ` ${modificationLabel}: "${escapedModificationPrompt}"`;
                        }
                        return `${prefixContextPart}${modificationContextPart}`;
                      })()}
                  />}

        {isLoadingAnalysis && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={handleToggleSuggestionSelection}
              onDownloadProjectZip={handleDownloadProjectZip} 
              canApplyAndDownload={canApplyAndDownloadOverall} 
              modificationPrompt={modificationPrompt}
              onModificationPromptChange={setModificationPrompt}
              onProcessModification={handleProcessModification}
              isProcessingModification={isProcessingModification}
              isRedefiningModificationPrompt={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineModificationPrompt}
              onSaveSnapshot={handleSaveAnalysisSnapshot}
              onApplySelectedCheckboxSuggestions={handleApplySelectedCheckboxSuggestions}
              originalProjectFiles={projectSourceManager.originalProjectFiles} 
              unifiedSuggestionsPrompt={unifiedSuggestionsPrompt}
            />
        )}
      </CardContent>
    </Card>
  );
}

```