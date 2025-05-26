
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
  AnalyzeCodeInput,
  CodeSnapshot, // Added for snapshot saving
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
import { fetchRemoteGitRepository, getApplicationSourceBundle } from '@/app/autoupdate/actions';
import { useProjectSourceManager, type ProjectSourceType as HookProjectSourceType } from '@/hooks/useProjectSourceManager'; // Assuming this hook exists

import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';

/**
 * @fileOverview Page component for full project analysis.
 * Allows users to upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. Displays AI analysis results,
 * suggestions, and allows for interactive modification and snapshot saving.
 * Internationalized using useI18n.
 * This page has been refactored to use sub-components and a custom hook for source management.
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const projectSourceManager = useProjectSourceManager('codealchemist-ap', "upload");
  const {
    projectSourceType, setProjectSourceType,
    uploadedFile, uploadedFileName,
    gitUrl, setGitUrl,
    originalProjectFiles, setOriginalProjectFiles,
    isLoadingSource, prepareProjectSourceForAnalysis,
    fileInputRef
  } = projectSourceManager;

  // States for LLM configuration and analysis parameters
  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSourcePage', { type: 'Ajustes Globales' });
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepthPage', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusAreaPage', '');
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);

  // States for analysis process and results
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-resultPage', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUIPage', []);

  // States for post-analysis modification
  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPromptPage', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);
  const [unifiedSuggestionsPrompt, setUnifiedSuggestionsPrompt] = useLocalStorage<string | null>('codealchemist-ap-unifiedSuggestionsPrompt', null);


  const handleFileChangeManager = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      projectSourceManager.handleFileChange(event, (files, err) => {
        if (err) {
          setError(err);
          setOriginalProjectFiles(null);
        } else if (files) {
          setOriginalProjectFiles(files);
          setError(null);
          // Clear previous analysis results if a new file is uploaded successfully
          setResult(null);
          setSuggestionsForUI([]);
          setModificationPrompt('');
          setUnifiedSuggestionsPrompt(null);
        }
      });
    },
    [projectSourceManager, setOriginalProjectFiles, setError, setResult, setSuggestionsForUI, setModificationPrompt, setUnifiedSuggestionsPrompt]
  );
  
  useEffect(() => {
    if (suggestionsForUI && suggestionsForUI.length > 0) {
      const allPrompts = suggestionsForUI
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s =>
          `// --- ${t('analyzeProject.results.promptHeaderForArea', { area: s.area })} ---\n${s.suggestedPromptForImplementation}\n// --- ${t('analyzeProject.results.promptFooterForArea', { area: s.area })} ---`
        )
        .join('\n\n');
      setUnifiedSuggestionsPrompt(allPrompts.trim() !== '' ? allPrompts : null);
    } else {
      setUnifiedSuggestionsPrompt(null);
    }
  }, [suggestionsForUI, t, setUnifiedSuggestionsPrompt]);


  /**
   * Core function to execute the AI analysis based on the selected source and parameters.
   */
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
         finalResult.groupLog = t('analyzeProject.results.groupContextLog', {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInputForFlow.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalizarProyecto)'
        }) as string;
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

  /**
   * Handles the initiation of the project analysis process.
   */
  const handleAnalyze = useCallback(async () => {
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('common.processing'));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');
    setUnifiedSuggestionsPrompt(null);


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
        sourceCodeLocation: sourcePreparationResult.sourceCodeLocation,
        gitRepoUrl: projectSourceType === 'git' ? gitUrl : undefined,
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined, // Keep for backward compatibility if flow uses it
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    await executeAnalysis(analysisInputForFlow);

  }, [
      prepareProjectSourceForAnalysis, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, toast,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoadingAnalysis, setModificationPrompt, projectSourceType, gitUrl, setUnifiedSuggestionsPrompt
  ]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s =>
        s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s
      )
    );
  }, [setSuggestionsForUI]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title'), description: t('analyzeProject.toast.downloadError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping'));
    toast({ title: t('analyzeProject.toast.applyingAndZipping') });

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
      const zipFileName = t('analyzeProject.downloads.zipFilename', {projectName: zipFileNameKey.replace(/\s+/g, '_').substring(0,30)});

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: t('analyzeProject.toast.zipDownloadSuccess.title'), description: t('analyzeProject.toast.zipDownloadSuccess.description', { filename: zipFileName }) });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipReadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoadingAnalysis, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType ]);
  
  const handleApplySelectedCheckboxSuggestions = useCallback(() => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    const applicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area);
    if (applicableSuggestions.length === 0) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.noSuggestionsToApply.title'), description: t('analyzeProject.toast.noSuggestionsToApply.description') });
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
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title'), description: t('analyzeProject.toast.selectedSuggestionsApplied.description') });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles ]);

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.emptyModificationRequest') });
      return;
    }
    if (!originalProjectFiles) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey)}) });
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
        projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName', { name: 'Modificado', time: '' }) || 'ProyectoModificado',
        aiNotes: `${result?.generalAssessment || ''}\n${t('analyzeProject.results.chatInteractionLogPrefix')}: ${tempCurrentModificationRequest}\n`,
        files: filesForModificationFlow,
      },
      modificationRequest: tempCurrentModificationRequest,
      agentSystemPrompt: agentSystemPromptForChat || t('analyzeProject.results.defaultChatContextSystemPrompt'),
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
         toast({ title: t('analyzeProject.toast.modificationSuccess.title') });
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
         setModificationPrompt('');
      } else {
        throw new AppError(t('analyzeProject.toast.modificationError.invalidResponse' as TranslationKey), {originalError: "La IA no devolvió una estructura de archivos válida."});
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description'));
      setError(errorMsg);
      setResult(prev => ({...(prev || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' }), generalAssessment: `${(prev || {generalAssessment:''}).generalAssessment || ''}\n\n[ERROR DE MODIFICACIÓN]: ${errorMsg}`})); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
    modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles,
    t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, setError, setIsProcessingModification, uploadedFileName, projectSourceType
  ]);

  const handleRedefineFocusArea = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningFocusArea(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefiniendo campo de enfoque. Original (inicio): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'focusArea' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'focusArea'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  const handleRedefineModificationPrompt = async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningModificationPrompt(true);
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefiniendo petición de modificación. Original (inicio): ${modificationPrompt.substring(0, 100)}...` });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: modificationPrompt });
      setModificationPrompt(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'modificationPrompt' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'modificationPrompt'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  };

  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result && !originalProjectFiles) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('versions.toast.snapshotSaveError.noContent', {section: t('sidebar.analyzeProject')})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName', { name: (result?.analysisTitle || uploadedFileName || "Analisis").substring(0,30), time: new Date().toLocaleTimeString() });

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
        title: t('versions.toast.snapshotSaveError.title'),
        description: t('versions.toast.snapshotSaveError.tooLarge', { size: (stringLength / (1024*1024)).toFixed(2) }),
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
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix')} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationLabel')}: "${modificationPrompt}"` : '' }`;

    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing'),
      description: t('error.errorDisplay.toast.autofixAttempt.description')
    });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({
        errorMessage: errorToFix,
        codeContext: error || "Error en Análisis de Proyecto.", // Pass current page error if exists
        userInstructions: contextForAI,
      });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida`, data: fixSuggestion});
      // ErrorDisplay component handles showing the modal with fixSuggestion via its own state
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError'));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title'), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e});
    }
  }, [t, modificationPrompt, addDebugLog, toast, error ]); // Added error to dependencies

  const isLoadingOverall = isLoadingAnalysis || isLoadingSource || isProcessingModification || isRedefiningFocusArea || isRedefiningModificationPrompt;

  return (
    <Card className="max-w-7xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType as HookProjectSourceType} // Cast for the hook prop
          onProjectSourceTypeChange={(value) => {
            setProjectSourceType(value as HookProjectSourceType);
            setOriginalProjectFiles(null);
            setResult(null);
            setSuggestionsForUI([]);
            setModificationPrompt('');
            setUnifiedSuggestionsPrompt(null);
            setError(null);
            // uploadedFile & uploadedFileName are managed by useProjectSourceManager
          }}
          uploadedFile={uploadedFile}
          uploadedFileName={uploadedFileName}
          onFileChange={handleFileChangeManager}
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
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))}
                    context={`${t('analyzeProject.results.modificationContextPrefix')} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationLabel')}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoadingAnalysis && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing')}</p></div>}

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
