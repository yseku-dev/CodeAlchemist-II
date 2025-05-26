// src/app/analizar-proyecto/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppState } from '@/context/AppStateContext';
import type {
  LLMConfigSourceOption,
  AnalyzeCodeOutput,
  DetailedSuggestionForUI,
  AppSourceFile,
  ProjectGenerationResult,
  ModifyProjectStructureInput,
  ChatMessage,
  CodeSnapshot,
  AnalyzeCodeInput,
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
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AGENTS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useProjectSourceManager, type ProjectSourceType as HookProjectSourceType } from '@/hooks/useProjectSourceManager';

import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import JSZip from 'jszip'; // Asegúrate de que JSZip esté importado

/**
 * @fileOverview Page component for full project analysis.
 * Allows users to upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. Displays AI analysis results,
 * suggestions, and allows for interactive modification and snapshot saving.
 * Internationalized using useI18n.
 * This page uses sub-components and a custom hook for source management.
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const projectSourceManager = useProjectSourceManager('codealchemist-ap-page', "upload");
  const {
    projectSourceType, setProjectSourceType,
    uploadedFile, uploadedFileName,
    gitUrl, setGitUrl,
    originalProjectFiles, setOriginalProjectFiles,
    isLoadingSource, prepareProjectSourceForAnalysis,
    fileInputRef
  } = projectSourceManager;

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' });
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);

  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);

  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);
  const [unifiedSuggestionsPrompt, setUnifiedSuggestionsPrompt] = useLocalStorage<string | null>('codealchemist-ap-unifiedSuggestionsPrompt', null);

  const handleFileChangeManagerCallback = useCallback(
    (files: AppSourceFile[] | null, err?: string) => {
      if (err) {
        setError(err);
        setOriginalProjectFiles(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: err });
      } else if (files) {
        setOriginalProjectFiles(files);
        setError(null);
        setResult(null);
        setSuggestionsForUI([]);
        setModificationPrompt('');
        setUnifiedSuggestionsPrompt(null);
        toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: files.length }) });
      }
    },
    [setOriginalProjectFiles, setError, setResult, setSuggestionsForUI, setModificationPrompt, setUnifiedSuggestionsPrompt, t, toast]
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
      setSuggestionsForUI((finalResult.detailedSuggestions || []).map((s, idx) => ({ ...s, id: `suggestion-ap-${idx}-${Date.now()}`, isSelected: false })));
      toast({ title: t('analyzeProject.toast.analysisComplete.title'), description: t('analyzeProject.toast.analysisComplete.description') });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: "Análisis de proyecto exitoso.", data: {title: finalResult.analysisTitle, suggestions: (finalResult.detailedSuggestions || []).length}, flowName});
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en análisis de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = (e as Error).message || t('common.unknownError');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title'), description: errorMsg });
      }
    } finally {
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
    }
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoadingAnalysis, setLoadingMessage, setError]);

  const handleAnalyze = useCallback(async () => {
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('common.processing'));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');
    setUnifiedSuggestionsPrompt(null);
    
    // No limpiar originalProjectFiles aquí si la fuente es 'upload' y ya se procesó,
    // o si es 'git' y ya se obtuvieron. Solo limpiar si se cambia de fuente o es un análisis nuevo no-git/no-upload.
    if (projectSourceType !== 'git' && projectSourceType !== 'upload') {
      setOriginalProjectFiles(null);
    } else if (projectSourceType === 'upload' && !uploadedFile && !uploadedFileName) {
        // Si es upload pero no hay archivo seleccionado, y no hay archivos originales de un zip previo, limpiar.
        if(!originalProjectFiles) setOriginalProjectFiles(null);
    } else if (projectSourceType === 'git' && !gitUrl.trim()) {
        if(!originalProjectFiles) setOriginalProjectFiles(null);
    }


    const sourcePreparationResult = await prepareProjectSourceForAnalysis();
    if (sourcePreparationResult.error || !sourcePreparationResult.projectContentStringForAI) {
      setError(sourcePreparationResult.error || t('analyzeProject.toast.noContentToAnalyze.description'));
      toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title'), description: sourcePreparationResult.error || t('analyzeProject.toast.noContentToAnalyze.description') });
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
      return;
    }
    
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID);
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask;
    }

    const analysisInputForFlow: AnalyzeCodeInput = {
        projectContent: sourcePreparationResult.projectContentStringForAI,
        sourceCodeLocation: sourcePreparationResult.sourceCodeLocation as AnalyzeCodeInput['sourceCodeLocation'],
        gitRepoUrl: projectSourceType === 'git' ? gitUrl : undefined,
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined, 
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    await executeAnalysis(analysisInputForFlow);

  }, [
      prepareProjectSourceForAnalysis, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, toast,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoadingAnalysis, setModificationPrompt, 
      projectSourceType, gitUrl, setOriginalProjectFiles, uploadedFile, uploadedFileName, setUnifiedSuggestionsPrompt
  ]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s =>
        s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s
      )
    );
  }, [setSuggestionsForUI]);
  
  const handleApplySelectedCheckboxSuggestions = useCallback(() => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    const applicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area);
    if (applicableSuggestions.length === 0) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.noSuggestionsToApply.title' as TranslationKey), description: t('analyzeProject.toast.noSuggestionsToApply.description' as TranslationKey) });
        return;
    }

    let updatedFilesData = [...originalProjectFiles.map(f => ({...f}))];
    const filesMap = new Map<string, string>(updatedFilesData.map(f => [f.fileName, f.content]));

    applicableSuggestions.forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area}` });
        }
    });
    updatedFilesData = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));
    setOriginalProjectFiles(updatedFilesData); // Actualiza el estado con los archivos modificados
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title' as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description' as TranslationKey) });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles ]);


 const handleProcessModification = useCallback(async () => {
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: 'handleProcessModification INVOCADO', data: { modificationPromptVal: modificationPrompt, originalFilesExist: !!originalProjectFiles } });
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey)}) });
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles. Fuente:', data: { projectSourceType } });
        return;
    }

    setIsProcessingModification(true);
    setError(null);
    const flowName = 'callModifyProjectStructure (AnalizarProyecto)';
    const tempCurrentModificationRequest = modificationPrompt;
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${tempCurrentModificationRequest}`, data: { currentAnalysisTitle: result?.analysisTitle }, flowName });
    
    let agentSystemPromptForChat: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForChat = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID);
        agentSystemPromptForChat = orchestrator?.systemPrompt || group?.mainTask;
    }
    
    const filesForModificationFlow = (originalProjectFiles || []).map(f => ({
        path: f.fileName,
        content: f.content,
        isFolder: f.fileName.endsWith('/'),
    }));

    const inputForModification: ModifyProjectStructureInput = {
      currentProject: {
        projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName' as TranslationKey, { name: 'Modificado', time: '' }).split(' - ')[2] || 'ProyectoModificado',
        aiNotes: result?.generalAssessment || "",
        files: filesForModificationFlow,
      },
      modificationRequest: tempCurrentModificationRequest,
      agentSystemPrompt: agentSystemPromptForChat || t('analyzeProject.results.defaultChatContextSystemPrompt' as TranslationKey),
    };
    
    try {
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);

      if (modifiedProjectResult && Array.isArray(modifiedProjectResult.files)) {
         setOriginalProjectFiles(modifiedProjectResult.files.map(f => ({ fileName: f.path, content: f.content ?? '' })));
         setResult(prevResult => {
             const baseResult = prevResult || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' };
             return {
                 ...baseResult,
                 analysisTitle: modifiedProjectResult.projectName || baseResult.analysisTitle,
                 generalAssessment: modifiedProjectResult.aiNotes || baseResult.generalAssessment,
             };
         });
         toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey) });
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
         setModificationPrompt('');
      } else {
        throw new AppError(t('analyzeProject.toast.modificationError.invalidResponse' as TranslationKey), {originalError: "La IA no devolvió una estructura de archivos válida para modificar."});
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg);
      setResult(prev => ({...(prev || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' }), generalAssessment: `${(prev || {generalAssessment:''}).generalAssessment || ''}\n\n[ERROR DE MODIFICACIÓN]: ${errorMsg}`})); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
    modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, uploadedFileName,
    t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, setError, setIsProcessingModification, projectSourceType
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
    if (!result && !originalProjectFiles) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, {section: t('sidebar.analyzeProject' as TranslationKey)})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || uploadedFileName || "Analisis").substring(0,30), time: new Date().toLocaleTimeString() });

    const dataToSave: Record<string, any> = {
        analysisResult: result, 
        currentOriginalFiles: originalProjectFiles || undefined, 
        suggestionsWithSelection: suggestionsForUI, 
        sourceDetails: {
            type: projectSourceType,
            gitUrl: projectSourceType === 'git' ? gitUrl : undefined,
            uploadedFileName: projectSourceType === 'upload' ? uploadedFileName : undefined,
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
      fileCount: originalProjectFiles?.length || undefined,
      metadata: {
        analysisTitle: result?.analysisTitle || uploadedFileName || "Análisis de Proyecto",
        sourceWasGit: projectSourceType === 'git' && !!gitUrl,
        originalFileName: uploadedFileName,
        hasProjectFiles: !!originalProjectFiles,
      }
    });
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Snapshot de análisis guardado: ${snapshotName}`});
  }, [result, suggestionsForUI, originalProjectFiles, projectSourceType, gitUrl, uploadedFileName, addSnapshot, t, toast, addDebugLog ]);

  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || "N/A", sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey), sourceName: uploadedFileName || gitUrl || "Local" })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`;

    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({
        errorMessage: errorToFix,
        codeContext: error || "Error en Análisis de Proyecto.",
        userInstructions: contextForAI,
      });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida`, data: fixSuggestion});
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError' as TranslationKey));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e});
    }
  }, [t, focusArea, projectSourceType, uploadedFileName, gitUrl, modificationPrompt, addDebugLog, toast, error ]); 

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoadingAnalysis(true); // Reutilizar este estado para la carga del ZIP
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))];
      const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));

      suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area).forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area} para ZIP.` });
        }
      });
      filesToZip = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));

      const zip = new JSZip();
      filesToZip.forEach(file => {
        let cleanPath = file.fileName;
        if (cleanPath.startsWith('./')) cleanPath = cleanPath.substring(2);
        if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
        if (cleanPath.trim() !== "") {
            zip.file(cleanPath, file.content);
        }
      });
      const zipFileNameKey = result?.analysisTitle || uploadedFileName || 'proyecto_analizado';
      const zipFileName = t('analyzeProject.downloads.zipFilename' as TranslationKey, {projectName: zipFileNameKey.replace(/\s+/g, '_').substring(0,30)});

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: t('analyzeProject.toast.zipDownloadSuccess.title' as TranslationKey), description: t('analyzeProject.toast.zipDownloadSuccess.description' as TranslationKey, { filename: zipFileName }) });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipReadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoadingAnalysis(false); // Reutilizar este estado
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoadingAnalysis, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType ]);

  const isLoadingOverall = isLoadingAnalysis || isLoadingSource || isProcessingModification || isRedefiningFocusArea || isRedefiningModificationPrompt;

  return (
    <Card className="max-w-7xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType as HookProjectSourceType}
          onProjectSourceTypeChange={(value) => {
            setProjectSourceType(value as HookProjectSourceType);
            setOriginalProjectFiles(null); 
            setResult(null);
            setSuggestionsForUI([]);
            setModificationPrompt('');
            setUnifiedSuggestionsPrompt(null);
            setError(null);
          }}
          uploadedFile={uploadedFile}
          uploadedFileName={uploadedFileName}
          onFileChange={(e) => projectSourceManager.handleFileChange(e, handleFileChangeManagerCallback)}
          fileInputRef={fileInputRef}
          gitUrl={gitUrl}
          onGitUrlChange={setGitUrl}
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
                    context={`${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || "N/A", sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey), sourceName: uploadedFileName || gitUrl || "Local" })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoadingAnalysis && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={handleToggleSuggestionSelection}
              onDownloadProjectZip={handleDownloadProjectZip}
              canApplyAndDownload={!!originalProjectFiles && originalProjectFiles.length > 0}
              modificationPrompt={modificationPrompt}
              onModificationPromptChange={setModificationPrompt}
              onProcessModification={handleProcessModification}
              isProcessingModification={isProcessingModification}
              isRedefiningModificationPrompt={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineModificationPrompt}
              onSaveSnapshot={handleSaveAnalysisSnapshot}
              onApplySelectedCheckboxSuggestions={handleApplySelectedCheckboxSuggestions}
              originalProjectFiles={originalProjectFiles}
              unifiedSuggestionsPrompt={unifiedSuggestionsPrompt}
            />
        )}
      </CardContent>
    </Card>
  );
}

```
This XML file contains the code for the `AnalizarProyectoPage` component, located at `/src/app/analizar-proyecto/page.tsx`. The code defines the component's state, event handlers, and JSX structure, including the integration of sub-components like `AnalyzeProjectHeader`, `AnalyzeProjectForm`, and `AnalyzeProjectResultsDisplay`. It also handles internationalization using the `useI18n` hook and interacts with AI services via functions from `apiClient.ts`. The component manages different project sources (upload, Git, local), processes them, and displays analysis results and modification options.
Error en la ejecucion local:
Build Error
Error: Copy to clipboard is not supported in this browser

Processing image failed

./src/app/favicon.ico

Processing image failed
unable to decode image data

Caused by:
- Format error decoding Ico: ICO image entry has too many color planes or too large hotspot value
- ICO image entry has too many color planes or too large hotspot value
This error occurred during the build process and can only be dismissed by fixing the error.

Error en terminal:
Processing image failed
unable to decode image data

Caused by:
- Format error decoding Ico: ICO image entry has too many color planes or too large hotspot value
- ICO image entry has too many color planes or too large hotspot value


 ○ Compiling /_error ...
 ✓ Compiled /_error in 1792ms
Warning: useLayoutEffect does nothing on the server, because its effect cannot be encoded into the server renderer's output format. This will lead to a mismatch between the initial, non-hydrated UI and the intended UI. To avoid this, useLayoutEffect should only be used in components that render exclusively on the client. See https://reactjs.org/link/uselayouteffect-ssr for common fixes.
    at ShadowPortal (D:\CodeAlchemist\node_modules\next\src\client\components\react-dev-overlay\ui\components\shadow-portal.tsx:5:32)
    at DevOverlay (D:\CodeAlchemist\node_modules\next\src\client\components\react-dev-overlay\ui\dev-overlay.tsx:14:3)
    at ReactDevOverlay (D:\CodeAlchemist\node_modules\next\src\server\dev\next-dev-server.ts:82:10)
    at div
    at Body (D:\CodeAlchemist\node_modules\next\src\server\render.tsx:1263:19)
Warning: useLayoutEffect does nothing on the server, because its effect cannot be encoded into the server renderer's output format. This will lead to a mismatch between the initial, non-hydrated UI and the intended UI. To avoid this, useLayoutEffect should only be used in components that render exclusively on the client. See https://reactjs.org/link/uselayouteffect-ssr for common fixes.
    at ShadowPortal (D:\CodeAlchemist\node_modules\next\src\client\components\react-dev-overlay\ui\components\shadow-portal.tsx:5:32)
    at DevOverlay (D:\CodeAlchemist\node_modules\next\src\client\components\react-dev-overlay\ui\dev-overlay.tsx:14:3)
    at ReactDevOverlay (D:\CodeAlchemist\node_modules\next\src\server\dev\next-dev-server.ts:82:10)
    at div
    at Body (D:\CodeAlchemist\node_modules\next\src\server\render.tsx:1263:19)
 GET / 500 in 9617ms
 ○ Compiling /favicon.ico ...
 ✓ Compiled /favicon.ico in 989ms
 GET /favicon.ico 500 in 1037ms