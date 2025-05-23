// src/app/autoupdate/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useDebug, type DebugLogEntry } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput, AppSourceFile, CodeSnapshot } from '@/types';
import { callAnalyzeSelfCode, callRedefinePrompt, callAutoFixErrorWithGroup } from '@/utils/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateConfigForm from '@/components/features/autoupdate/AutoUpdateConfigForm';
import AutoUpdateResultsDisplay from '@/components/features/autoupdate/AutoUpdateResultsDisplay';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';
import { getApplicationSourceBundle, handleUploadToGit } from './actions'; 
import JSZip from 'jszip';
import LogsDisplay from '@/components/logs-display';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useLocalStorage } from '@/hooks/useLocalStorage';


/**
 * @fileOverview Page component for the "AutoUpdate" feature.
 * Allows CodeAlchemist to analyze its own codebase (or a specified Git repository)
 * for improvements, display suggestions, and manage them.
 * Includes AI-driven analysis, suggestion editing, conceptual testing, and download/upload of code.
 * All UI texts are internationalized.
 * @module AutoUpdatePage
 */

type AutoUpdateSourceType = "Local" | "Git";

/**
 * AutoUpdatePage component.
 * Manages the state and logic for the AutoUpdate feature, allowing analysis of the application's
 * own source code, display of suggestions, and interaction with those suggestions.
 * @returns {JSX.Element} The rendered AutoUpdate page.
 */
export default function AutoUpdatePage() {
  const { agents, groups, settings: globalSettings, getAgentById, getGroupById, addSnapshot } = useAppState();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-au-llmConfigSource', undefined);

  useEffect(() => {
    if (!llmConfigSource && agents?.length > 0) {
      const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      setLlmConfigSource(defaultAgent
        ? { type: 'Agente' as const, id: defaultAgent.id, name: defaultAgent.name }
        : { type: 'Ajustes Globales' as const }
      );
    } else if (!llmConfigSource && agents) { 
        setLlmConfigSource({ type: 'Ajustes Globales' as const });
    }
  }, [agents, llmConfigSource, setLlmConfigSource]);

  const [sourceType, setSourceType] = useLocalStorage<AutoUpdateSourceType>("codealchemist-au-sourceType", "Local");
  const [gitRepoUrl, setGitRepoUrl] = useLocalStorage<string>('codealchemist-au-gitRepoUrl', '');
  const [analysisPreferences, setAnalysisPreferences] = useLocalStorage<string>('codealchemist-au-analysisPreferences', '');

  const [isAnalyzing, setIsAnalyzing] = useState(false); // For analysis process
  const [isDownloadingSource, setIsDownloadingSource] = useState(false); // Specific for source ZIP download
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-au-analysisResult', null);
  const [suggestions, setSuggestions] = useLocalStorage<AutoUpdateSuggestion[]>('codealchemist-au-suggestions', []);
  const [unifiedPrompt, setUnifiedPrompt] = useLocalStorage<string | null>('codealchemist-au-unifiedPrompt', null);
  const [projectSourceString, setProjectSourceString] = useLocalStorage<string | null>('codealchemist-au-projectSourceString', null);


  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);

  const [showTestDialog, setShowTestDialog] = useState(false);
  const [suggestionToTest, setSuggestionToTest] = useState<AutoUpdateSuggestion | null>(null);

  const [showTestInVenvDialog, setShowTestInVenvDialog] = useState(false);
  const [suggestionToTestInVenv, setSuggestionToTestInVenv] = useState<AutoUpdateSuggestion | null>(null);

  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useLocalStorage<string>('codealchemist-au-commitMessage', '');
  const [isUploadingGit, setIsUploadingGit] = useState(false);
  const [detailedLogs, setDetailedLogs] = useLocalStorage<string[]>('codealchemist-au-detailedLogs', []);
  const [isRedefiningAnalysisPrefs, setIsRedefiningAnalysisPrefs] = useState(false);

  const _processAiAnalysisOutput = useCallback((
    aiResult: AnalyzeCodeOutput,
    currentLlmConfigSourceUsed: LLMConfigSourceOption | undefined,
    projectFilesForProcessing?: AppSourceFile[] 
  ): { analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null } => {
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisProcessingComplete'), data: { outputTitle: aiResult.analysisTitle, numSuggestions: aiResult.detailedSuggestions.length } });

    if (projectFilesForProcessing) {
      setProjectSourceString(JSON.stringify(projectFilesForProcessing.map(f=>f.fileName).slice(0,10))); 
    }

    const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => {
      let originalFileContent: string | undefined = undefined;
      if (projectFilesForProcessing && s.area) {
        const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
        const relatedFile = projectFilesForProcessing.find(f => {
          if (!s.area) return false;
          const areaLower = normalizePath(s.area.toLowerCase());
          const fileNameLower = normalizePath(f.fileName.toLowerCase());
          const baseAreaLower = areaLower.split(' (parte ')[0]; 
          return fileNameLower === baseAreaLower;
        });
        originalFileContent = relatedFile?.content;
      }

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
        originalContent: originalFileContent,
      };
    });

    let finalResultOutput: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };
    if (currentLlmConfigSourceUsed?.type === 'Grupo' && currentLlmConfigSourceUsed.name && currentLlmConfigSourceUsed.id) {
      const group = getGroupById(currentLlmConfigSourceUsed.id);
      const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
      finalResultOutput.groupLog = t('autoupdate.logs.groupContextLog', {
        groupName: currentLlmConfigSourceUsed.name,
        groupTask: (group?.mainTask || 'N/A').substring(0, 150),
        userInput: (analysisPreferences || t('autoupdate.analysis.general')),
        orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
        flowName: 'analyzeSelfCode (AutoUpdate)'
      });
    }

    let generatedUnifiedPromptText: string | null = null;
    if (mappedSuggestions.length > 0) {
      const allPrompts = mappedSuggestions
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s => `${t('autoupdate.prompts.unifiedHeader', { area: s.area })}\n${s.suggestedPromptForImplementation}\n${t('autoupdate.prompts.unifiedFooter', { area: s.area })}`)
        .join('\n\n');
      if (allPrompts.trim() !== '') {
        generatedUnifiedPromptText = allPrompts;
      }
    }
    if (finalResultOutput.groupLog) setDetailedLogs(prev => [...prev, finalResultOutput.groupLog!]);
    return { analysisOutput: finalResultOutput, mappedSuggestions, generatedUnifiedPrompt: generatedUnifiedPromptText };
  }, [getAgentById, getGroupById, addDebugLog, t, analysisPreferences, setProjectSourceString]);

  const _executeAnalysisAndProcessResults = useCallback(async (
    analysisInputForFlow: AnalyzeCodeInput,
    currentLlmConfigSourceUsed: LLMConfigSourceOption | undefined,
    projectFilesForProcessing?: AppSourceFile[]
  ) => {
    const flowName = 'callAnalyzeSelfCode (AutoUpdate via _executeAnalysisAndProcessResults)';
    try {
      if (currentLlmConfigSourceUsed?.type !== 'Grupo') {
        let currentProgressVal = 0;
        const intervalId = setInterval(() => {
          currentProgressVal += 10;
          if (currentProgressVal <= 100) {
            setProgress(currentProgressVal);
          } else {
            clearInterval(intervalId);
          }
        }, 300);

        await callAnalyzeSelfCode(analysisInputForFlow)
          .then((aiResult) => {
            clearInterval(intervalId);
            const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSourceUsed, projectFilesForProcessing);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setUnifiedPrompt(generatedUnifiedPrompt);
            setProgress(100);
            toast({ title: t('autoupdate.toast.analysisComplete.title'), description: t('autoupdate.toast.analysisComplete.description') });
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessNonGroup'), flowName });
          })
          .catch(err => {
            clearInterval(intervalId);
            throw err; 
          });
      } else {
        setProgress(50); 
        const aiResult = await callAnalyzeSelfCode(analysisInputForFlow);
        const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSourceUsed, projectFilesForProcessing);
        setAnalysisResult(analysisOutput);
        setSuggestions(mappedSuggestions);
        setUnifiedPrompt(generatedUnifiedPrompt);
        setProgress(100);
        toast({ title: t('autoupdate.toast.analysisComplete.title'), description: t('autoupdate.toast.analysisComplete.description') });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessGroup'), flowName });
      }

    } catch (e: any) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.analysisFailedUI'), errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setAnalysisError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('autoupdate.errors.unknownAnalysisError');
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: errorMsg });
      }
      setProgress(0);
      setProjectSourceString(null);
    }
  }, [_processAiAnalysisOutput, toast, addDebugLog, router, t]);

  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setLoadingMessage(t('autoupdate.toast.gettingLocalCode.title'));
    setAnalysisError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setUnifiedPrompt(null);
    setProgress(0);
    setDetailedLogs([]);
    setProjectSourceString(null);
    const flowName = 'callAnalyzeSelfCode (AutoUpdate)';
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisStarting'), data: { sourceType, config: JSON.stringify(llmConfigSource) }, flowName });

    let projectFilesForProcessing: AppSourceFile[] | undefined;
    let projectContentStringForAnalysis: string | undefined;
    let sourceLocationForAI: AnalyzeCodeInput['sourceCodeLocation'] = sourceType;

    try {
      if (sourceType === 'Local') {
        toast({ title: t('autoupdate.toast.gettingLocalCode.title'), description: t('autoupdate.toast.gettingLocalCode.description') });
        const bundleResult = await getApplicationSourceBundle(false);
        if (bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

        if (!bundleResult.success || !bundleResult.files) {
          const errorMsg = bundleResult.error || t('autoupdate.errors.getLocalSourceFailed');
          throw new AppError(errorMsg, bundleResult, 'server');
        }
        projectFilesForProcessing = bundleResult.files;
        projectContentStringForAnalysis = bundleResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.localCodeObtained'), data: { numFiles: bundleResult.files.length } });
        sourceLocationForAI = "Local"; 
      } else if (sourceType === 'Git' && gitRepoUrl) {
        toast({ title: t('autoupdate.toast.fetchingGit.title'), description: t('autoupdate.toast.fetchingGit.description') });
        // TODO: Implement actual Git fetching Server Action if needed
        // For now, using local bundle as a placeholder
        const bundleResult = await getApplicationSourceBundle(false); 
        if (bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);
        if (!bundleResult.success || !bundleResult.files) throw new AppError(bundleResult.error || "Error simulando obtención de Git", bundleResult, 'server');
        projectFilesForProcessing = bundleResult.files;
        projectContentStringForAnalysis = projectFilesForProcessing.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
        sourceLocationForAI = "Git";
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: "Contenido de Git (simulado localmente) obtenido.", data: { numFiles: projectFilesForProcessing.length } });
      } else if (sourceType === 'Git' && !gitRepoUrl.trim()) {
        const errorMsg = t('autoupdate.config.gitUrlRequired');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: errorMsg, data: { sourceType, gitRepoUrl }, flowName });
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.sourceError.title'), description: errorMsg });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
      }

      if (!projectContentStringForAnalysis) {
        const errorMsg = "No se pudo obtener el contenido del proyecto para analizar.";
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: errorMsg, flowName });
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: errorMsg });
        setIsAnalyzing(false); setLoadingMessage(null);
        return;
      }
      if (projectFilesForProcessing) setProjectSourceString(JSON.stringify(projectFilesForProcessing.map(f=>f.fileName).slice(0,10)));


      setLoadingMessage(t('autoupdate.toast.analyzingWithAI.title'));

      const currentAgent = llmConfigSource?.type === 'Agente' ? getAgentById(llmConfigSource.id || '') : undefined;
      const currentGroup = llmConfigSource?.type === 'Grupo' ? getGroupById(llmConfigSource.id || '') : undefined;

      const inputForFlow: AnalyzeCodeInput = {
        sourceCodeLocation: sourceLocationForAI,
        gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
        projectContent: projectContentStringForAnalysis,
        focusArea: analysisPreferences || undefined, // Use analysisPreferences as focusArea
        agentSystemPrompt: currentAgent?.systemPrompt || currentGroup?.mainTask || undefined,
      };
      await _executeAnalysisAndProcessResults(inputForFlow, llmConfigSource, projectFilesForProcessing);

    } catch (e: any) {
      const appErr = e instanceof AppError ? e : new AppError(t('autoupdate.errors.getLocalSourceBundleFailed'), e, 'server');
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.getLocalSourceBundleFailed'), errorDetails: appErr.originalError, friendlyMessage: appErr.friendlyMessage, flowName });
      setAnalysisError(appErr.friendlyMessage);
      toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: appErr.friendlyMessage });
    } finally {
      setIsAnalyzing(false);
      setLoadingMessage(null);
    }
  }, [sourceType, gitRepoUrl, analysisPreferences, llmConfigSource, getAgentById, getGroupById, _executeAnalysisAndProcessResults, toast, addDebugLog, t]);

  const handleDownloadCurrentSourceZip = useCallback(async () => {
    setIsDownloadingSource(true);
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] ${t('autoupdate.toast.downloadCurrentSourceZip.preparing')}`]);
    toast({ title: t('autoupdate.toast.downloadCurrentSourceZip.preparing') });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: 'Iniciando descarga de código fuente actual (ZIP)...' });

    try {
      const bundleResult = await getApplicationSourceBundle(false);
      if (bundleResult.logsBuilt) addDebugLog({ source: 'SERVER_SOURCE_BUNDLE', type: 'INFO_BATCH', message: 'Logs del servidor al obtener bundle para descarga ZIP:', data: bundleResult.logsBuilt});

      if (!bundleResult.success || !bundleResult.files) {
        const errorMsg = bundleResult.error || t('autoupdate.errors.getServerSourceFailedZip');
        throw new AppError(errorMsg, bundleResult, 'server');
      }

      const filesToPackage: AppSourceFile[] = bundleResult.files;
      const zip = new JSZip();
      filesToPackage.forEach(file => {
        zip.file(file.fileName, file.content);
      });
      
      const zipFileName = t('autoupdate.downloads.currentCodeZipFilenameStatic');
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: t('autoupdate.toast.downloadCurrentCodeZip.successTitle'),
        description: t('autoupdate.toast.downloadCurrentCodeZip.successDescription', { filename: zipFileName }),
        duration: 7000,
      });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.projectZipDownloaded', { numFiles: filesToPackage.length, filename: zipFileName }) });

    } catch (e:any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('autoupdate.errors.unknownZipError'));
      toast({ variant: "destructive", title: t('autoupdate.toast.zipError.title'), description: errorMsg });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.zipGenerationFailed', { error: errorMsg }), errorDetails: e });
    } finally {
      setIsDownloadingSource(false);
    }
  }, [t, toast, addDebugLog]);


  const handleDownloadSuggestions = useCallback(async (format: 'JSON_SUGGESTIONS') => {
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.downloadRequested', { format: format }) });

    if (format === 'JSON_SUGGESTIONS') {
      if (!suggestions || suggestions.length === 0) {
        toast({ title: t('autoupdate.toast.noSuggestionsToDownload.title'), description: t('autoupdate.toast.noSuggestionsToDownload.description') });
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
        toast({ title: t('autoupdate.toast.noContentToDownload.title'), description: t('autoupdate.toast.noContentToDownload.description') });
        return;
      }
      const jsonString = JSON.stringify(filesToDownload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t('autoupdate.downloads.suggestionsJsonFilename');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: t('autoupdate.toast.downloadComplete.title'), description: t('autoupdate.toast.downloadComplete.suggestionsJsonDescription', { filename: t('autoupdate.downloads.suggestionsJsonFilename') }) });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionsDownloadedJson') });
    }
  }, [suggestions, toast, addDebugLog, t]);

  const handleApplySuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent !== undefined || suggestion.fullFileContentSuggested !== undefined)) {
      toast({ variant: "destructive", title: t('autoupdate.toast.noContentToApply.title'), description: t('autoupdate.toast.noContentToApply.description') });
      return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  }, [toast, t]);

  const confirmApplySuggestion = useCallback(() => {
    if (!suggestionToApply) return;
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionMarkedApplied', { area: suggestionToApply.area }) });
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: t('autoupdate.toast.suggestionApplied.title'), description: t('autoupdate.toast.suggestionApplied.description', { area: suggestionToApply.area }) });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  }, [suggestionToApply, toast, addDebugLog, t, setSuggestions]);

  const handleOpenCommitDialog = () => {
    if (!globalSettings.gitConfig.repoUrl || !globalSettings.gitConfig.username || !globalSettings.gitConfig.email || !globalSettings.gitConfig.pat) {
      toast({ variant: "destructive", title: t('autoupdate.toast.gitConfigIncomplete.title'), description: t('autoupdate.toast.gitConfigIncomplete.description') });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadFailedConfig') });
      return;
    }
    setShowCommitDialog(true);
  };

  const performGitUpload = useCallback(async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: t('autoupdate.toast.commitMessageRequired.title') });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.commitMessageMissing') });
      return;
    }

    setIsUploadingGit(true);
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] ${t('autoupdate.logs.initiatingGitUpload')}`]);
    toast({ title: t('autoupdate.toast.uploadingToGit.title'), description: t('autoupdate.toast.uploadingToGit.description', { repo: globalSettings.gitConfig.repoUrl.split('/').pop()?.replace('.git', '') || 'repositorio' }) });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.gitUploadInProgress', { message: commitMessage }), data: { repoUrl: globalSettings.gitConfig.repoUrl } });
    const tempLogs: string[] = [];

    try {
      const result = await handleUploadToGit(globalSettings.gitConfig, commitMessage, tempLogs);
      setDetailedLogs(prev => [...prev, ...tempLogs]);

      if (result.success) {
        toast({ title: t('autoupdate.toast.gitUploadSuccess.title'), description: result.message, duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.gitUploadSuccess'), data: result });
        setShowCommitDialog(false);
        setCommitMessage('');
      } else {
        setAnalysisError(result.message); // Use analysisError for general page errors
        toast({ title: t('autoupdate.toast.gitUploadError.title'), description: result.message, variant: "destructive", duration: 10000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadError', { error: result.message }), data: result });
      }
    } catch (error: any) {
      const errorMsg = (error as Error).message || t('autoupdate.errors.unknownGitUploadError');
      setAnalysisError(errorMsg);
      toast({ title: t('autoupdate.toast.gitUploadError.title'), description: errorMsg, variant: "destructive", duration: 10000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadException', { error: errorMsg }), data: error });
      setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [FATAL_CLIENT] Error en llamada a handleUploadToGit: ${errorMsg}`]);
    } finally {
      setIsUploadingGit(false);
    }
  }, [globalSettings.gitConfig, commitMessage, toast, addDebugLog, t, setDetailedLogs, setCommitMessage, setAnalysisError]);

  const handleAutoFixError = useCallback(async (errorMsgFromDisplay: string) => {
    const contextForAI = t('autoupdate.autofix.errorContext', { error: errorMsgFromDisplay });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.attemptingAutofix', { error: errorMsgFromDisplay }), flowName: 'callAutoFixErrorWithGroup (AutoUpdate)', data: { contextForAI } });
    toast({
      title: t('common.processing'),
      description: t('errorDisplay.toast.autofixAttempt.description')
    });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({
        errorMessage: errorMsgFromDisplay,
        codeContext: analysisError || "Error en AutoUpdate.",
        userInstructions: contextForAI,
      });
      toast({ title: t('autoupdate.toast.autofixSuggestion.title'), description: t('autoupdate.toast.autofixSuggestion.description') });
      // Logic to display fixSuggestion (e.g., in a modal) would go here or in ErrorDisplay
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError'));
      toast({ variant: 'destructive', title: t('autoupdate.toast.autofixError.title'), description: errorMsg });
    }
  }, [addDebugLog, t, analysisError, callAutoFixErrorWithGroup, toast]);

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
  }, [setSuggestions]);

  const handleSuggestionContentChange = useCallback((suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  }, [setSuggestions]);

  const handleSaveEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({ title: t('autoupdate.toast.editSaved.title'), description: t('autoupdate.toast.editSaved.description') })
  }, [toast, t, setSuggestions]);

  const handleCancelEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Revert to original AI suggestion if available, else empty or keep current if no original
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested ?? s.userEditedContent ?? '' };
      }
      return s;
    }));
  }, [setSuggestions]);

  const handleTestSuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  }, []);

  const handleTestInVenvClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTestInVenv(suggestion);
    setShowTestInVenvDialog(true);
  }, []);

  const handleSaveAutoUpdateSnapshot = useCallback(() => {
    if (!analysisResult && !projectSourceString) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('versions.toast.snapshotSaveError.noContent', { section: t('sidebar.autoupdate') }) });
      return;
    }

    const snapshotData = {
      analysis: analysisResult,
      sourceType: sourceType,
      gitRepoUrl: sourceType === 'Git' ? gitRepoUrl : undefined,
      analysisPreferences: analysisPreferences,
      appliedSuggestionsSummary: suggestions.filter(s => s.status === 'applied').map(s_ => ({
        area: s_.area,
        suggestion: s_.suggestion,
        priority: s_.priority
      })),
      projectSourceFilesHint: projectSourceString, 
    };

    const snapshotName = `${t('autoupdate.logs.snapshotNamePrefix')} - ${new Date().toLocaleTimeString()}`;
    addSnapshot({
      name: snapshotName,
      code: JSON.stringify(snapshotData, null, 2),
      source: 'autoupdate-snapshot'
    });
    addDebugLog({ source: 'AutoUpdatePage', type: 'INFO', message: `Snapshot de AutoUpdate guardado: ${snapshotName}` });
  }, [analysisResult, projectSourceString, suggestions, sourceType, gitRepoUrl, analysisPreferences, addSnapshot, t, toast, addDebugLog]);

  const handleRedefineAnalysisPrefs = async () => {
    if (!analysisPreferences.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningAnalysisPrefs(true);
    addDebugLog({ source: 'AutoUpdatePage', type: 'INFO', message: `Redefining analysis preferences. Original: ${analysisPreferences.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: analysisPreferences });
      setAnalysisPreferences(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'AutoUpdatePage', type: 'SUCCESS', message: `'analysisPreferences' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addDebugLog({ source: 'AutoUpdatePage', type: 'ERROR', message: `Redefining 'analysisPreferences' failed`, errorDetails: e });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningAnalysisPrefs(false);
    }
  };
  
  const isLoadingOverall = isAnalyzing || isDownloadingSource || isUploadingGit || isRedefiningAnalysisPrefs;

  return (
    <React.Fragment>
      <div className="space-y-6"> {/* Contenedor principal de la página AutoUpdate */}
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
          onDownloadCurrentSourceZip={handleDownloadCurrentSourceZip} // Nueva prop
          isLoading={isLoadingOverall} // Pasar estado de carga general
          isDownloadingSource={isDownloadingSource} // Pasar estado específico
          progress={progress}
          isAnalysisInProgress={isAnalyzing && !analysisResult && progress < 100 && llmConfigSource?.type !== 'Grupo'}
          isRedefiningAnalysisPrefs={isRedefiningAnalysisPrefs}
          onRedefineAnalysisPrefs={handleRedefineAnalysisPrefs}
        />

        <AutoUpdateResultsDisplay
          analysisResult={analysisResult}
          suggestions={suggestions}
          isLoading={isAnalyzing && !analysisResult} // Solo cargando resultados si el análisis principal está activo
          error={analysisError}
          onAutoFixError={handleAutoFixError}
          onApplySuggestion={handleApplySuggestionClick}
          onToggleEdit={handleToggleEdit}
          onContentChange={handleSuggestionContentChange}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onTestSuggestion={handleTestSuggestionClick}
          onTestInVenv={handleTestInVenvClick}
          onDownloadSuggestions={handleDownloadSuggestions} // Para JSON de sugerencias
          onOpenCommitDialog={handleOpenCommitDialog}
          unifiedPrompt={unifiedPrompt}
          onSaveSnapshot={handleSaveAutoUpdateSnapshot}
        />

        <ConfirmDialog
          isOpen={showConfirmApplyDialog && !!suggestionToApply}
          onClose={() => { setSuggestionToApply(null); setShowConfirmApplyDialog(false); }}
          onConfirm={confirmApplySuggestion}
          title={t('autoupdate.dialogs.applySuggestion.title', { area: suggestionToApply?.area || 'N/A' })}
          confirmText={t('autoupdate.dialogs.applySuggestion.confirmText')}
          cancelText={t('common.cancel')}
        >
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p1', { area: suggestionToApply?.area || 'N/A' })}</p>
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p2')}</p>
          <ScrollArea className="h-64 border rounded-md">
            <CodeBlock code={suggestionToApply?.userEditedContent ?? suggestionToApply?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToShow')} language="typescript" maxHeight="100%" />
          </ScrollArea>
        </ConfirmDialog>

        <Dialog open={showTestDialog && !!suggestionToTest} onOpenChange={(open) => { if (!open) setSuggestionToTest(null); setShowTestDialog(open); }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('autoupdate.dialogs.testSuggestion.title', { area: suggestionToTest?.area || 'N/A' })}</DialogTitle>
              <DialogDescription>
                {t('autoupdate.dialogs.testSuggestion.description')}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] mt-4 border rounded-md">
              <CodeBlock code={suggestionToTest?.userEditedContent ?? suggestionToTest?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToTest')} language="typescript" maxHeight="100%" />
            </ScrollArea>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline">{t('common.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTestInVenvDialog && !!suggestionToTestInVenv} onOpenChange={(open) => { if (!open) setSuggestionToTestInVenv(null); setShowTestInVenvDialog(open); }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('autoupdate.dialogs.testInVenv.title', { area: suggestionToTestInVenv?.area || 'N/A' })}</DialogTitle>
              <DialogDescription>
                {t('autoupdate.dialogs.testInVenv.description')}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] mt-4 border rounded-md">
              <CodeBlock code={suggestionToTestInVenv?.userEditedContent ?? suggestionToTestInVenv?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToTest')} language="typescript" maxHeight="100%" />
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.testInVenv.actionNote')}</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => {
                toast({ title: t('autoupdate.toast.venvSim.title'), description: t('autoupdate.toast.venvSim.description', { area: suggestionToTestInVenv?.area || 'N/A' }) });
                addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.venvSim', { area: suggestionToTestInVenv?.area || 'N/A' }) });
                setShowTestInVenvDialog(false);
                setSuggestionToTestInVenv(null);
              }}>
                {t('autoupdate.dialogs.testInVenv.simulateButton')}
              </Button>
              <DialogClose asChild>
                <Button variant="outline">{t('common.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          isOpen={showCommitDialog}
          onClose={() => setShowCommitDialog(false)}
          onConfirm={performGitUpload}
          title={t('autoupdate.dialogs.commitToGit.title')}
          confirmText={isUploadingGit ? t('common.uploading') : t('autoupdate.dialogs.commitToGit.confirmText')}
          confirmDisabled={isUploadingGit}
          cancelText={t('common.cancel')}
        >
          <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder={t('autoupdate.dialogs.commitToGit.placeholder')} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.commitToGit.description')}</p>
        </ConfirmDialog>

        {(analysisResult?.groupLog || detailedLogs.length > 0 || (isAnalyzing && !analysisResult && llmConfigSource?.type === 'Grupo')) && (
          <div className="mt-4">
            <LogsDisplay
              title={t('autoupdate.logs.detailedExecutionLogsTitle')}
              logs={detailedLogs.length > 0 ? detailedLogs : (analysisResult?.groupLog ? [analysisResult.groupLog] : (isAnalyzing ? [t('autoupdate.logs.analyzingWithGroup')] : [t('autoupdate.logs.waitingForGroup')]))}
              defaultExpanded={!!analysisResult?.groupLog || detailedLogs.length > 0}
            />
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
