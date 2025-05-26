
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
  ProjectGenerationResult,
  ModifyProjectStructureInput,
  ChatMessage,
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
import JSZip from 'jszip';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AGENTS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useProjectSourceManager, type ProjectSourceType } from '@/hooks/useProjectSourceManager';

import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';

/**
 * @fileOverview Page component for full project analysis.
 * Allows users to upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. Displays AI analysis results,
 * suggestions, and allows for interactive modification and snapshot saving.
 * This page has been refactored to use custom hooks for managing source and analysis logic.
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const {
    projectSourceType,
    setProjectSourceType,
    uploadedFile,
    uploadedFileName,
    handleFileChange: handleSourceFileChange,
    gitUrl,
    setGitUrl,
    originalProjectFiles,
    setOriginalProjectFiles,
    isLoadingSource,
    prepareProjectSourceForAnalysis,
    fileInputRef,
  } = useProjectSourceManager('codealchemist-ap', 'upload');

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' });
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');

  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);

  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);

  const isLoading = isLoadingSource || isLoadingAnalysis || isProcessingModification || isRedefiningFocusArea || isRedefiningModificationPrompt;

  const onFileProcessedByHook = useCallback((processedFiles: AppSourceFile[] | null, processingError?: string) => {
    if (processingError) {
        setError(processingError);
        setOriginalProjectFiles(null);
    } else if (processedFiles) {
        setOriginalProjectFiles(processedFiles);
        setError(null); 
        // Clear previous analysis results if a new file is successfully processed
        setResult(null);
        setSuggestionsForUI([]);
        setModificationPrompt('');
    }
  }, [setError, setOriginalProjectFiles, setResult, setSuggestionsForUI, setModificationPrompt]);


  const executeAnalysis = useCallback(async (analysisInput: AnalyzeCodeInput) => {
    const flowName = 'callAnalyzeSelfCode (AnalizarProyecto)';
    addDebugLog({
        source: 'AnalizarProyectoPage', type: 'INFO',
        message: `Analizando proyecto. Input (contenido truncado): ${JSON.stringify({...analysisInput, projectContent: (analysisInput.projectContent || '').substring(0,200) + '...' })}. Config: ${JSON.stringify(llmConfigSource)}`,
        flowName
    });

   try {
      const aiResult = await callAnalyzeSelfCode(analysisInput);
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         const group = getGroupById(llmConfigSource.id || '');
         const orchestrator = getAgentById(ORCHESTRATOR_AGENT_ID);
         finalResult.groupLog = t('analyzeProject.results.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInput.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalizarProyecto)'
        });
      }

      setResult(finalResult);
      setSuggestionsForUI((finalResult.detailedSuggestions || []).map((s, idx) => ({ ...s, id: `suggestion-ap-${idx}-${Date.now()}`, isSelected: false })));
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
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoadingAnalysis, setLoadingMessage, setError ]);

  const handleAnalyze = useCallback(async () => {
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');
    
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Iniciando análisis. Fuente: ${projectSourceType}`});

    const sourceData = await prepareProjectSourceForAnalysis();

    if (sourceData.error || !sourceData.projectContentStringForAI) {
      setError(sourceData.error || t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey));
      toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: sourceData.error || t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey) });
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

    const analysisInput: AnalyzeCodeInput = {
        projectContent: sourceData.projectContentStringForAI,
        sourceCodeLocation: sourceData.sourceCodeLocation,
        gitRepoUrl: projectSourceType === 'git' ? gitUrl : undefined,
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    await executeAnalysis(analysisInput);

  }, [
      projectSourceType, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, addDebugLog,
      prepareProjectSourceForAnalysis,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoadingAnalysis, setModificationPrompt,
  ]);

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles.' });
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
        projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName' as TranslationKey, { name: 'Modificado', time: '' }).split(' - ')[2].trim() || 'ProyectoModificado',
        aiNotes: `${result?.generalAssessment || ''}\n${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey, {time: new Date().toLocaleTimeString()})}: ${tempCurrentModificationRequest}\n`,
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
                 // aiNotes: modifiedProjectResult.aiNotes || prevResult!.aiNotes, // This can overwrite important analysis notes
             };
         });

         toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey), description: t('analyzeProject.toast.modificationSuccess.description' as TranslationKey) });
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
         setModificationPrompt('');
      } else {
        throw new AppError(t('analyzeProject.toast.modificationError.invalidResponse' as TranslationKey), {originalError: "La IA no devolvió una estructura de archivos válida."});
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg);
      setResult(prev => ({...prev!, aiNotes: `${prev!.aiNotes || ''}\n\n[ERROR DE MODIFICACIÓN]: ${errorMsg}`}));
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
    modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, uploadedFileName, t, toast, router, addDebugLog,
    setOriginalProjectFiles, setResult, setModificationPrompt, setError, setIsProcessingModification,
  ]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoadingAnalysis(true); // Re-use for general loading indicator
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))];
      const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));

      suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area).forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area}` });
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
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoadingAnalysis, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType ]);

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
    setOriginalProjectFiles(updatedFilesData);
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title' as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description' as TranslationKey) });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles ]);


  const handleRedefineFocusAreaProject = async () => {
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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'as TranslationKey));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'as TranslationKey), description: errorMsg });
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
      toast({ title: t('common.toast.redefinedSuccess.title'as TranslationKey), description: t('common.toast.redefinedSuccess.description'as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'modificationPrompt' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'modificationPrompt'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'as TranslationKey));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'as TranslationKey), description: errorMsg });
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

    const dataToSave = {
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
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : (projectSourceType === 'local' ? t('analyzeProject.sourceLocal' as TranslationKey) : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`;

    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({
        errorMessage: errorToFix,
        codeContext: contextForAI,
      });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida`, data: fixSuggestion});
      // ErrorDisplay component handles showing the modal with fixSuggestion via its own state
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError' as TranslationKey));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e});
    }
  }, [t, modificationPrompt, focusArea, projectSourceType, gitUrl, uploadedFileName, addDebugLog, toast ]);

  return (
    <Card className="max-w-7xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType}
          onProjectSourceTypeChange={(value) => {
            setProjectSourceType(value);
            if (value !== 'upload') {
              setUploadedFile(null); // Keep using this setter from the hook
              setUploadedFileName(null);
            }
             if (value !== 'git') {
               setGitUrl('');
             }
             // Reset results and files if source type changes
             setResult(null);
             setSuggestionsForUI([]);
             setOriginalProjectFiles(null);
             setModificationPrompt('');
             setError(null);
          }}
          uploadedFile={uploadedFile} // From hook
          uploadedFileName={uploadedFileName} // From hook
          onFileChange={(e) => handleSourceFileChange(e, onFileProcessedByHook)} // Use hook's handler
          fileInputRef={fileInputRef} // From hook
          gitUrl={gitUrl} // From hook
          onGitUrlChange={setGitUrl} // From hook
          searchDepth={searchDepth}
          onSearchDepthChange={setSearchDepth}
          focusArea={focusArea}
          onFocusAreaChange={setFocusArea}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusAreaProject}
        />

        {error && <ErrorDisplay
                    error={error}
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))}
                    context={`${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : (projectSourceType === 'local' ? t('analyzeProject.sourceLocal' as TranslationKey) : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoadingAnalysis && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={(id) => setSuggestionsForUI(prev => prev.map(s => s.id === id ? { ...s, isSelected: !s.isSelected } : s))}
              onDownloadProjectZip={handleDownloadProjectZip}
              canApplyAndDownload={!!originalProjectFiles}
              modificationPrompt={modificationPrompt}
              onModificationPromptChange={setModificationPrompt}
              onProcessModification={handleProcessModification}
              isProcessingModification={isProcessingModification}
              isRedefiningModificationPrompt={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineModificationPrompt}
              onSaveSnapshot={handleSaveAnalysisSnapshot}
              onApplySelectedCheckboxSuggestions={handleApplySelectedCheckboxSuggestions}
              originalProjectFiles={originalProjectFiles}
            />
        )}
      </CardContent>
    </Card>
  );
}
```