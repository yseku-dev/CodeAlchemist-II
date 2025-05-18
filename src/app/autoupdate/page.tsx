
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useDebug, type DebugLogEntry } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput, AppSourceFile } from '@/types';
import { callAnalyzeSelfCode } from '@/utils/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateConfigForm from '@/components/features/autoupdate/AutoUpdateConfigForm';
import AutoUpdateResultsDisplay from '@/components/features/autoupdate/AutoUpdateResultsDisplay';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';
import { getApplicationSourceBundle, handleUploadToGit, fetchRemoteGitRepository } from './actions';
import JSZip from 'jszip';
import LogsDisplay from '@/components/logs-display';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview Page component for the "AutoUpdate" feature.
 * Allows CodeAlchemist to analyze its own codebase (or a specified Git repository)
 * for improvements, display suggestions, and manage them.
 * Includes AI-driven analysis, suggestion editing, conceptual testing, and download/upload of code.
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
  const { agents, groups, settings: globalSettings, getAgentById, getGroupById } = useAppState(); // Correct hook call
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(undefined);

  useEffect(() => {
    if (agents && agents.length > 0 && llmConfigSource === undefined) {
      const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      setLlmConfigSource(defaultAgent
        ? { type: 'Agente' as const, id: defaultAgent.id, name: defaultAgent.name }
        : { type: 'Ajustes Globales' as const }
      );
    } else if (llmConfigSource === undefined) {
      setLlmConfigSource({ type: 'Ajustes Globales' as const });
    }
  }, [agents, llmConfigSource]);

  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
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
  const [isUploadingGit, setIsUploadingGit] = useState(false);
  const [detailedLogs, setDetailedLogs] = useState<string[]>([]);

  /**
   * Processes the raw AI analysis output into a format suitable for the page's state.
   * Maps AI suggestions to `AutoUpdateSuggestion` objects and generates a unified prompt.
   * @param {AnalyzeCodeOutput} aiResult - The raw output from the AI analysis flow.
   * @param {LLMConfigSourceOption | undefined} currentLlmConfigSource - The LLM configuration source used for the analysis.
   * @param {AppSourceFile[]} [currentProjectFiles] - The project files that were analyzed (local or from Git).
   * @returns {{ analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null }} Processed analysis data.
   */
  const _processAiAnalysisOutput = useCallback((
    aiResult: AnalyzeCodeOutput,
    currentLlmConfigSource: LLMConfigSourceOption | undefined,
    currentProjectFiles?: AppSourceFile[]
  ): { analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null } => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisProcessingComplete' as TranslationKey), data: { outputTitle: aiResult.analysisTitle, numSuggestions: aiResult.detailedSuggestions.length }});

    const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => {
      const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
      const relatedFile = currentProjectFiles?.find(f => {
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

    let finalResultOutput: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };
    if (currentLlmConfigSource?.type === 'Grupo' && currentLlmConfigSource.name && currentLlmConfigSource.id) {
        const group = getGroupById(currentLlmConfigSource.id);
        const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
        finalResultOutput.groupLog = t('autoupdate.logs.groupContextLog' as TranslationKey, {
            groupName: currentLlmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisPreferences || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AutoUpdate)'
        });
    }

    let generatedUnifiedPromptText: string | null = null;
    if (mappedSuggestions.length > 0) {
      const allPrompts = mappedSuggestions
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s => t('autoupdate.prompts.unifiedHeader' as TranslationKey, { area: s.area }) + `\n${s.suggestedPromptForImplementation}\n` + t('autoupdate.prompts.unifiedFooter' as TranslationKey, { area: s.area }))
        .join('\n\n');
      if (allPrompts.trim() !== '') {
        generatedUnifiedPromptText = allPrompts;
      }
    }

    return { analysisOutput: finalResultOutput, mappedSuggestions, generatedUnifiedPrompt: generatedUnifiedPromptText };
  }, [getAgentById, getGroupById, addDebugLog, t, analysisPreferences]);


  /**
   * Handles the core logic of calling the AI analysis flow and processing its results.
   * @param {AnalyzeCodeInput} analysisInput - The input for the AI analysis flow.
   * @param {LLMConfigSourceOption | undefined} currentLlmConfigSource - The LLM configuration being used.
   * @param {AppSourceFile[]} [currentProjectFiles] - The project files being analyzed.
   * @returns {Promise<void>}
   */
  const _executeAnalysisAndProcessResults = useCallback(async (
    analysisInput: AnalyzeCodeInput,
    currentLlmConfigSource: LLMConfigSourceOption | undefined,
    currentProjectFiles?: AppSourceFile[]
  ) => {
    const flowName = 'callAnalyzeSelfCode (AutoUpdate via _executeAnalysisAndProcessResults)';
    try {
      if (currentLlmConfigSource?.type !== 'Grupo') {
        let currentProgressVal = 0;
        const intervalId = setInterval(() => {
          currentProgressVal += 10;
          if (currentProgressVal <= 100) {
            setProgress(currentProgressVal);
          } else {
            clearInterval(intervalId);
          }
        }, 300);

        await callAnalyzeSelfCode(analysisInput)
          .then((aiResult) => {
            clearInterval(intervalId);
            const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSource, currentProjectFiles);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setUnifiedPrompt(generatedUnifiedPrompt);
            setProgress(100);
            toast({ title: t('autoupdate.toast.analysisComplete.title' as TranslationKey), description: t('autoupdate.toast.analysisComplete.description' as TranslationKey) });
            if (analysisOutput.groupLog) setDetailedLogs(prev => [...prev, analysisOutput.groupLog!]);
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessNonGroup' as TranslationKey), flowName});
          })
          .catch(err => {
            clearInterval(intervalId);
            throw err; // Re-throw to be caught by the outer catch
          });
      } else { // Group-based analysis
        setProgress(50); // Initial progress for group
        const aiResult = await callAnalyzeSelfCode(analysisInput);
        const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSource, currentProjectFiles);
        setAnalysisResult(analysisOutput);
        setSuggestions(mappedSuggestions);
        setUnifiedPrompt(generatedUnifiedPrompt);
        setProgress(100);
        toast({ title: t('autoupdate.toast.analysisComplete.title' as TranslationKey), description: t('autoupdate.toast.analysisComplete.description' as TranslationKey) });
        if (analysisOutput.groupLog) setDetailedLogs(prev => [...prev, analysisOutput.groupLog!]);
        addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessGroup' as TranslationKey), flowName});
      }
    } catch (e: any) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.analysisFailedUI' as TranslationKey), data: { errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage }, flowName});
      if (e instanceof AppError) {
        setAnalysisError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = e.message || t('autoupdate.errors.unknownAnalysisError' as TranslationKey);
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
      setProgress(0); // Reset progress on error
    }
  }, [_processAiAnalysisOutput, toast, addDebugLog, router, t, getAgentById, getGroupById]);

  /**
   * Initiates the self-analysis process.
   * Fetches source code (local via Server Action or from Git via Server Action),
   * then calls the AI analysis flow.
   */
  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setLoadingMessage(t('autoupdate.toast.gettingLocalCode.title' as TranslationKey));
    setAnalysisError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setUnifiedPrompt(null);
    setProgress(0);
    setDetailedLogs([]);
    const flowName = 'callAnalyzeSelfCode (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisStarting' as TranslationKey), data: { sourceType, config: JSON.stringify(llmConfigSource) }, flowName});

    let projectFilesForAnalysis: AppSourceFile[] | undefined;
    let projectContentStringForAnalysis: string | undefined;
    let sourceLocationForAI: AnalyzeCodeInput['sourceCodeLocation'] = sourceType;

    if (sourceType === 'Local') {
      toast({ title: t('autoupdate.toast.gettingLocalCode.title' as TranslationKey), description: t('autoupdate.toast.gettingLocalCode.description' as TranslationKey)});
      try {
        const bundleResult = await getApplicationSourceBundle(false); // Server Action call
        if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

        if (!bundleResult.success || !bundleResult.files) {
          const errorMsg = bundleResult.error || t('autoupdate.errors.getLocalSourceFailed' as TranslationKey);
          throw new AppError(errorMsg, bundleResult, 'server');
        }
        projectFilesForAnalysis = bundleResult.files;
        projectContentStringForAnalysis = projectFilesForAnalysis.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.localCodeObtained' as TranslationKey), data: { numFiles: projectFilesForAnalysis.length }});
        sourceLocationForAI = "Local";
      } catch (e: any) {
        const appErr = e instanceof AppError ? e : new AppError(t('autoupdate.errors.getLocalSourceFailed' as TranslationKey), e, 'server');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.getLocalSourceBundleFailed' as TranslationKey), data: { error: appErr.friendlyMessage, originalError: appErr.originalError }, flowName});
        setAnalysisError(appErr.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: appErr.friendlyMessage });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
      }
    } else if (sourceType === 'Git' && gitRepoUrl) {
        setLoadingMessage(t('refactorProject.toast.fetchingGit' as TranslationKey));
        toast({ title: t('refactorProject.toast.fetchingGit' as TranslationKey), description: gitRepoUrl });
        try {
          const gitResult = await fetchRemoteGitRepository(gitRepoUrl); // Server Action call
          if(gitResult.logsBuilt) setDetailedLogs(prev => [...prev, ...gitResult.logsBuilt!]);

          if (!gitResult.success || !gitResult.files) {
              const errorMsg = gitResult.error || t('refactorProject.toast.gitFetchError.unknown' as TranslationKey);
              throw new AppError(errorMsg, gitResult, 'server');
          }
          projectFilesForAnalysis = gitResult.files;
          projectContentStringForAnalysis = projectFilesForAnalysis.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Git repo content obtained for AutoUpdate: ${gitRepoUrl}`, data: { numFiles: projectFilesForAnalysis.length }});
          sourceLocationForAI = "Git";
        } catch (e: any) {
          const appErr = e instanceof AppError ? e : new AppError(t('refactorProject.toast.gitFetchError.title' as TranslationKey), e, 'server');
          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Error fetching Git repo for AutoUpdate: ${appErr.friendlyMessage}`, data: { gitRepoUrl, originalError: appErr.originalError }, flowName});
          setAnalysisError(appErr.friendlyMessage);
          toast({ variant: "destructive", title: t('refactorProject.toast.gitFetchError.title' as TranslationKey), description: appErr.friendlyMessage });
          setIsAnalyzing(false);
          setLoadingMessage(null);
          return;
        }
    } else {
        const errorMsg = sourceType === 'Git' && !gitRepoUrl ? t('autoupdate.config.gitUrlRequired' as TranslationKey) : t('autoupdate.errors.unknownSourceError' as TranslationKey);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Invalid source for AutoUpdate: ${errorMsg}`, data: { sourceType, gitRepoUrl }, flowName});
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.sourceError.title' as TranslationKey), description: errorMsg });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
    }
    setLoadingMessage(t('autoupdate.toast.analyzingWithAI.title' as TranslationKey));

    const currentAgent = llmConfigSource?.type === 'Agente' ? getAgentById(llmConfigSource.id || '') : undefined;
    const currentGroup = llmConfigSource?.type === 'Grupo' ? getGroupById(llmConfigSource.id || '') : undefined;

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceLocationForAI,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      projectContent: projectContentStringForAnalysis,
      focusArea: analysisPreferences || undefined, // Use analysisPreferences as focusArea
      agentSystemPrompt: currentAgent
        ? currentAgent.systemPrompt
        : currentGroup
        ? currentGroup.mainTask // For groups, their main task might serve as the high-level prompt context for analysis
        : undefined,
    };
    await _executeAnalysisAndProcessResults(input, llmConfigSource, projectFilesForAnalysis);
    setIsAnalyzing(false);
    setLoadingMessage(null);
  }, [sourceType, gitRepoUrl, analysisPreferences, llmConfigSource, getAgentById, getGroupById, _executeAnalysisAndProcessResults, toast, addDebugLog, t, _processAiAnalysisOutput]);


  /**
   * Opens the confirmation dialog for applying a suggestion.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to be applied.
   */
  const handleApplySuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent !== undefined || suggestion.fullFileContentSuggested !== undefined)) {
        toast({variant: "destructive", title: t('autoupdate.toast.noContentToApply.title' as TranslationKey), description: t('autoupdate.toast.noContentToApply.description' as TranslationKey)});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  }, [toast, t]);

  /**
   * Marks a suggestion as "applied" in the UI.
   * Actual file modification is not performed due to browser limitations.
   */
  const confirmApplySuggestion = useCallback(() => {
    if (!suggestionToApply) return;
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionMarkedApplied' as TranslationKey, { area: suggestionToApply.area })});
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: t('autoupdate.toast.suggestionApplied.title' as TranslationKey), description: t('autoupdate.toast.suggestionApplied.description' as TranslationKey, { area: suggestionToApply.area }) });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  }, [suggestionToApply, toast, addDebugLog, t]);


  /**
   * Handles the download of suggestions or the conceptual project with applied suggestions.
   * @param {'JSON_SUGGESTIONS' | 'ZIP_PROJECT'} format - The desired download format.
   */
  const handleDownload = useCallback(async (format: 'JSON_SUGGESTIONS' | 'ZIP_PROJECT') => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.downloadRequested' as TranslationKey, { format: format })});

    if (format === 'JSON_SUGGESTIONS') {
      if (!suggestions || suggestions.length === 0) {
        toast({ title: t('autoupdate.toast.noSuggestionsToDownload.title' as TranslationKey), description: t('autoupdate.toast.noSuggestionsToDownload.description' as TranslationKey) });
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
        toast({ title: t('autoupdate.toast.noContentToDownload.title' as TranslationKey), description: t('autoupdate.toast.noContentToDownload.description' as TranslationKey) });
        return;
      }
      const jsonString = JSON.stringify(filesToDownload, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = t('autoupdate.downloads.suggestionsJsonFilename' as TranslationKey);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: t('autoupdate.toast.downloadComplete.title' as TranslationKey), description: t('autoupdate.toast.downloadComplete.suggestionsJsonDescription' as TranslationKey, { filename: t('autoupdate.downloads.suggestionsJsonFilename' as TranslationKey) }) });
      addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionsDownloadedJson' as TranslationKey)});
    } else if (format === 'ZIP_PROJECT') {
        setIsAnalyzing(true); // Re-use isAnalyzing to indicate processing
        setLoadingMessage(t('autoupdate.toast.preparingProjectZip.title' as TranslationKey));
        toast({ title: t('autoupdate.toast.preparingProjectZip.title' as TranslationKey), description: t('autoupdate.toast.preparingProjectZip.description' as TranslationKey)});
        let filesToPackage: AppSourceFile[] = [];
        try {
            const bundleResult = await getApplicationSourceBundle(false); // Call Server Action
            if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

            if (!bundleResult.success || !bundleResult.files) {
                throw new Error(bundleResult.error || t('autoupdate.errors.getServerSourceFailedZip' as TranslationKey));
            }
            filesToPackage = bundleResult.files; // Real files from server
            addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: `Archivos base para ZIP (del servidor): ${filesToPackage.length}` });

            if (suggestions && suggestions.length > 0) {
                const appliedSuggestionsMap = new Map<string, string>();
                suggestions.filter(s => s.status === 'applied').forEach(s => {
                    const content = s.userEditedContent ?? s.fullFileContentSuggested;
                    if (s.area && content !== undefined) {
                        appliedSuggestionsMap.set(s.area, content);
                    }
                });

                if (appliedSuggestionsMap.size > 0) {
                   addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Aplicando ${appliedSuggestionsMap.size} sugerencias marcadas al bundle del servidor para ZIP.`});
                }

                filesToPackage = filesToPackage.map(file => {
                  const normalizePath = (p: string) => p.replace(/^\.\//, '').replace(/^src\//, '');
                  const normalizedFileName = normalizePath(file.fileName);
                  for (const [area, content] of appliedSuggestionsMap.entries()) {
                      if (normalizePath(area) === normalizedFileName) {
                          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: t('autoupdate.logs.applyingSuggestionToZip' as TranslationKey, { fileName: file.fileName })});
                          return { ...file, content: content };
                      }
                  }
                  return file;
                });
            }

            const zip = new JSZip();
            filesToPackage.forEach(file => {
                zip.file(file.fileName, file.content);
            });
            const zipFileName = t('autoupdate.downloads.currentCodeZipFilename' as TranslationKey);
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
                title: t('autoupdate.toast.downloadCurrentCodeZipToast.title' as TranslationKey),
                description: t('autoupdate.toast.downloadCurrentCodeZipToast.description' as TranslationKey, {filename: zipFileName}),
                duration: 12000,
            });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.projectZipDownloaded' as TranslationKey, { numFiles: filesToPackage.length, filename: zipFileName })});
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : t('autoupdate.errors.unknownZipError' as TranslationKey);
            toast({ variant: "destructive", title: t('autoupdate.toast.zipError.title' as TranslationKey), description: errorMsg });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.zipGenerationFailed' as TranslationKey, { error: errorMsg })});
        } finally {
            setIsAnalyzing(false);
            setLoadingMessage(null);
        }
    }
  }, [suggestions, toast, addDebugLog, t, analysisResult, setIsAnalyzing, setLoadingMessage]);

  /**
   * Opens the dialog for entering a Git commit message.
   */
  const handleOpenCommitDialog = () => {
    if (!globalSettings.gitConfig.repoUrl || !globalSettings.gitConfig.username || !globalSettings.gitConfig.email || !globalSettings.gitConfig.pat) {
      toast({ variant: "destructive", title: t('autoupdate.toast.gitConfigIncomplete.title' as TranslationKey), description: t('autoupdate.toast.gitConfigIncomplete.description' as TranslationKey) });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadFailedConfig' as TranslationKey)});
      return;
    }
    setShowCommitDialog(true);
  };

  /**
   * Performs the Git upload operation by calling the Server Action.
   */
  const performGitUpload = useCallback(async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: t('autoupdate.toast.commitMessageRequired.title' as TranslationKey) });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.commitMessageMissing' as TranslationKey)});
      return;
    }

    setIsUploadingGit(true);
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] ${t('autoupdate.logs.initiatingGitUpload' as TranslationKey)}`]);
    toast({ title: t('autoupdate.toast.uploadingToGit.title' as TranslationKey), description: t('autoupdate.toast.uploadingToGit.description' as TranslationKey, { repo: globalSettings.gitConfig.repoUrl.split('/').pop()?.replace('.git','') || 'repositorio' }) });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.gitUploadInProgress' as TranslationKey, { message: commitMessage }), data: { repoUrl: globalSettings.gitConfig.repoUrl }});
    const tempLogs: string[] = []; // Create a new array for this specific action's logs

    try {
      const result = await handleUploadToGit(globalSettings.gitConfig, commitMessage, tempLogs); // Pass tempLogs
      setDetailedLogs(prev => [...prev, ...tempLogs]); // Append Server Action logs to page logs

      if (result.success) {
        toast({ title: t('autoupdate.toast.gitUploadSuccess.title' as TranslationKey), description: result.message, duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.gitUploadSuccess' as TranslationKey), data: result });
        setShowCommitDialog(false);
        setCommitMessage('');
      } else {
        setAnalysisError(result.message);
        toast({ title: t('autoupdate.toast.gitUploadError.title' as TranslationKey), description: result.message, variant: "destructive", duration: 10000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadError' as TranslationKey, { error: result.message }), data: result });
      }
    } catch (error: any) {
      const errorMsg = error.message || t('autoupdate.errors.unknownGitUploadError' as TranslationKey);
      setAnalysisError(errorMsg);
      toast({ title: t('autoupdate.toast.gitUploadError.title' as TranslationKey), description: errorMsg, variant: "destructive", duration: 10000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadException' as TranslationKey, { error: errorMsg }), data: error });
      setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [FATAL_CLIENT] Error en llamada a handleUploadToGit: ${errorMsg}`]);
    } finally {
      setIsUploadingGit(false);
    }
  }, [globalSettings.gitConfig, commitMessage, toast, addDebugLog, t]);


  /**
   * Attempts to get an AI-driven fix for a displayed error.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = useCallback(async (errorMsg: string) => {
    const autoFixFlowName = 'callAnalyzeSelfCode (AutoFix Error)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.attemptingAutofix' as TranslationKey, { error: errorMsg }), flowName: autoFixFlowName});
    setIsAnalyzing(true);
    setAnalysisError(null);
    setLoadingMessage(t('autoupdate.toast.autofixAttempt.description' as TranslationKey));
    try {
      const agentForFix = getAgentById('refactorizador-codigo-experto') || (agents.length > 0 ? getAgentById(agents[0].id) : undefined);
      const result = await callAnalyzeSelfCode({
        sourceCodeLocation: 'Local',
        projectContent: t('autoupdate.autofix.errorContext' as TranslationKey, { error: errorMsg }),
        focusArea: t('autoupdate.autofix.focusArea' as TranslationKey, { error: errorMsg }),
        agentSystemPrompt: agentForFix?.systemPrompt,
      });
      toast({ title: t('autoupdate.toast.autofixSuggestion.title' as TranslationKey), description: result.generalAssessment, duration: 10000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: `Sugerencia de Auto-Fix recibida: ${result.analysisTitle}`, data: result, flowName: autoFixFlowName});
    } catch (e: any) {
      const appErr = e instanceof AppError ? e : new AppError(t('autoupdate.errors.autofixHelperFailed' as TranslationKey), e, 'ai');
      toast({ variant: "destructive", title: t('autoupdate.toast.autofixError.title' as TranslationKey), description: appErr.friendlyMessage });
      if (appErr.redirectTo) router.push(appErr.redirectTo);
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: `Fallo Auto-Fix: ${appErr.friendlyMessage}`, errorDetails: appErr.originalError, flowName: autoFixFlowName});
    } finally {
      setIsAnalyzing(false);
      setLoadingMessage(null);
    }
  }, [addDebugLog, toast, router, getAgentById, agents, t, setIsAnalyzing, setAnalysisError, setLoadingMessage]);

  /**
   * Toggles the editing mode for a suggestion.
   * @param {string} suggestionId - The ID of the suggestion.
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
   * Handles changes to the content of a suggestion being edited.
   * @param {string} suggestionId - The ID of the suggestion.
   * @param {string} newContent - The new content.
   */
  const handleSuggestionContentChange = useCallback((suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  }, []);

  /**
   * Saves the edited content of a suggestion.
   * @param {string} suggestionId - The ID of the suggestion.
   */
  const handleSaveEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: t('autoupdate.toast.editSaved.title' as TranslationKey), description: t('autoupdate.toast.editSaved.description' as TranslationKey)})
  }, [toast, t]);

  /**
   * Cancels editing for a suggestion, reverting any changes.
   * @param {string} suggestionId - The ID of the suggestion.
   */
  const handleCancelEdit = useCallback((suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Revert to original AI suggestion or clear if no original AI suggestion
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested ?? undefined };
      }
      return s;
    }));
  }, []);

  /**
   * Opens the dialog for testing a suggestion.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestSuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTest(suggestion);
    setShowTestDialog(true);
  }, []);

  /**
   * Opens the dialog for conceptually testing a suggestion in a virtual environment.
   * @param {AutoUpdateSuggestion} suggestion - The suggestion to test.
   */
  const handleTestInVenvClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    setSuggestionToTestInVenv(suggestion);
    setShowTestInVenvDialog(true);
  }, []);

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
          isLoading={isAnalyzing || isUploadingGit}
          progress={progress}
          isAnalysisInProgress={isAnalyzing && !analysisResult && progress < 100 && llmConfigSource?.type !== 'Grupo'}
        />

        <AutoUpdateResultsDisplay
          analysisResult={analysisResult}
          suggestions={suggestions}
          isLoading={isAnalyzing && !analysisResult}
          error={analysisError}
          onAutoFixError={handleAutoFixError}
          onApplySuggestion={handleApplySuggestionClick}
          onToggleEdit={handleToggleEdit}
          onContentChange={handleSuggestionContentChange}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onTestSuggestion={handleTestSuggestionClick}
          onTestInVenv={handleTestInVenvClick}
          onDownloadSuggestions={handleDownload}
          onOpenCommitDialog={handleOpenCommitDialog}
          unifiedPrompt={unifiedPrompt}
        />

        <ConfirmDialog
          isOpen={showConfirmApplyDialog && !!suggestionToApply}
          onClose={() => { setSuggestionToApply(null); setShowConfirmApplyDialog(false); }}
          onConfirm={confirmApplySuggestion}
          title={t('autoupdate.dialogs.applySuggestion.title' as TranslationKey, { area: suggestionToApply?.area || 'N/A' })}
          confirmText={t('autoupdate.dialogs.applySuggestion.confirmText' as TranslationKey)}
        >
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p1' as TranslationKey, { area: suggestionToApply?.area || 'N/A' })}</p>
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p2' as TranslationKey)}</p>
          <ScrollArea className="h-64 border rounded-md">
            <CodeBlock code={suggestionToApply?.userEditedContent ?? suggestionToApply?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToShow' as TranslationKey)} language="typescript" maxHeight="100%" />
          </ScrollArea>
        </ConfirmDialog>

        <Dialog open={showTestDialog && !!suggestionToTest} onOpenChange={(open) => { if(!open) setSuggestionToTest(null); setShowTestDialog(open);}}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('autoupdate.dialogs.testSuggestion.title' as TranslationKey, { area: suggestionToTest?.area || 'N/A' })}</DialogTitle>
              <DialogDescription>
                {t('autoupdate.dialogs.testSuggestion.description' as TranslationKey)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] mt-4 border rounded-md">
              <CodeBlock code={suggestionToTest?.userEditedContent ?? suggestionToTest?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToTest' as TranslationKey)} language="typescript" maxHeight="100%" />
            </ScrollArea>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline">{t('common.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showTestInVenvDialog && !!suggestionToTestInVenv} onOpenChange={(open) => { if(!open) setSuggestionToTestInVenv(null); setShowTestInVenvDialog(open);}}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('autoupdate.dialogs.testInVenv.title' as TranslationKey, { area: suggestionToTestInVenv?.area || 'N/A' })}</DialogTitle>
              <DialogDescription>
                {t('autoupdate.dialogs.testInVenv.description' as TranslationKey)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] mt-4 border rounded-md">
              <CodeBlock code={suggestionToTestInVenv?.userEditedContent ?? suggestionToTestInVenv?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToTest' as TranslationKey)} language="typescript" maxHeight="100%" />
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.testInVenv.actionNote' as TranslationKey)}</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => {
                toast({ title: t('autoupdate.toast.venvSim.title' as TranslationKey), description: t('autoupdate.toast.venvSim.description' as TranslationKey, { area: suggestionToTestInVenv?.area || 'N/A' })});
                addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.venvSim' as TranslationKey, { area: suggestionToTestInVenv?.area || 'N/A' })});
                setShowTestInVenvDialog(false);
                setSuggestionToTestInVenv(null);
              }}>
                {t('autoupdate.dialogs.testInVenv.simulateButton' as TranslationKey)}
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
          title={t('autoupdate.dialogs.commitToGit.title' as TranslationKey)}
          confirmText={isUploadingGit ? t('common.uploading') : t('autoupdate.dialogs.commitToGit.confirmText' as TranslationKey)}
          confirmDisabled={isUploadingGit}
        >
          <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder={t('autoupdate.dialogs.commitToGit.placeholder' as TranslationKey)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.commitToGit.description' as TranslationKey)}</p>
        </ConfirmDialog>

        {(analysisResult?.groupLog || detailedLogs.length > 0 || (isAnalyzing && !analysisResult && llmConfigSource?.type === 'Grupo')) && (
            <div className="mt-4"> {/* Removed lg:col-span-3 to allow natural flow */}
            <LogsDisplay
              title={t('autoupdate.logs.detailedExecutionLogsTitle' as TranslationKey)}
              logs={detailedLogs.length > 0 ? detailedLogs : (analysisResult?.groupLog || (isAnalyzing ? [t('autoupdate.logs.analyzingWithGroup' as TranslationKey)] : [t('autoupdate.logs.waitingForGroup' as TranslationKey)]))}
              defaultExpanded={!!analysisResult?.groupLog || detailedLogs.length > 0}
            />
            </div>
        )}
      </div>
    </React.Fragment>
  );
}
