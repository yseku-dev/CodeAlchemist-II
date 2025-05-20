
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

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(undefined);

  useEffect(() => {
    if (agents && agents.length > 0 && llmConfigSource === undefined) {
      const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      setLlmConfigSource(defaultAgent
        ? { type: 'Agente' as const, id: defaultAgent.id, name: defaultAgent.name }
        : { type: 'Ajustes Globales' as const }
      );
    } else if (agents && llmConfigSource === undefined) { 
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
  const [projectSourceString, setProjectSourceString] = useState<string | null>(null); // To store concatenated source for snapshot


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
  const [isRedefiningAnalysisPrefs, setIsRedefiningAnalysisPrefs] = useState(false);


  const _processAiAnalysisOutput = useCallback((
    aiResult: AnalyzeCodeOutput,
    currentLlmConfigSourceUsed: LLMConfigSourceOption | undefined,
    currentProjectFilesSource?: string // Pass the concatenated source string
  ): { analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null } => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisProcessingComplete' as TranslationKey), data: { outputTitle: aiResult.analysisTitle, numSuggestions: aiResult.detailedSuggestions.length }});

    if (currentProjectFilesSource) {
      setProjectSourceString(currentProjectFilesSource);
    }

    const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => {
      // This is a simplified way to find original content if we don't have separate file objects
      // For AutoUpdate, 'originalContent' is tricky if the AI suggests changes to a file it hasn't seen the 'current' version of.
      // The `suggestedContent` IS the full file content.
      return {
        id: `suggestion-${index}-${Date.now()}`,
        area: s.area,
        suggestion: s.suggestion,
        priority: s.priority,
        fullFileContentSuggested: s.suggestedContent,
        suggestedPromptForImplementation: s.suggestedPromptForImplementation,
        status: 'pending', // Non-optional status
        isEditing: false,
        userEditedContent: undefined,
        originalContent: s.suggestedContent, // Assuming suggestedContent is the new base
      };
    });

    let finalResultOutput: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };
    if (currentLlmConfigSourceUsed?.type === 'Grupo' && currentLlmConfigSourceUsed.name && currentLlmConfigSourceUsed.id) {
        const group = getGroupById(currentLlmConfigSourceUsed.id);
        const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
        finalResultOutput.groupLog = t('autoupdate.logs.groupContextLog' as TranslationKey, {
            groupName: currentLlmConfigSourceUsed.name,
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
        .map(s => `${t('autoupdate.prompts.unifiedHeader' as TranslationKey, { area: s.area })}\n${s.suggestedPromptForImplementation}\n${t('autoupdate.prompts.unifiedFooter' as TranslationKey, { area: s.area })}`)
        .join('\n\n');
      if (allPrompts.trim() !== '') {
        generatedUnifiedPromptText = allPrompts;
      }
    }
    if (finalResultOutput.groupLog) setDetailedLogs(prev => [...prev, finalResultOutput.groupLog!]);
    return { analysisOutput: finalResultOutput, mappedSuggestions, generatedUnifiedPrompt: generatedUnifiedPromptText };
  }, [getAgentById, getGroupById, addDebugLog, t, analysisPreferences]);


  const _executeAnalysisAndProcessResults = useCallback(async (
    analysisInputForFlow: AnalyzeCodeInput,
    currentLlmConfigSourceUsed: LLMConfigSourceOption | undefined,
    concatenatedProjectSource?: string
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
            const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSourceUsed, concatenatedProjectSource);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setUnifiedPrompt(generatedUnifiedPrompt);
            setProgress(100);
            toast({ title: t('autoupdate.toast.analysisComplete.title' as TranslationKey), description: t('autoupdate.toast.analysisComplete.description' as TranslationKey) });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessNonGroup' as TranslationKey), flowName});
          })
          .catch(err => {
            clearInterval(intervalId);
            throw err; // Re-throw to be caught by outer catch
          });
      } else { // Group execution
          setProgress(50); // Indicate processing started
          const aiResult = await callAnalyzeSelfCode(analysisInputForFlow);
          const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, currentLlmConfigSourceUsed, concatenatedProjectSource);
          setAnalysisResult(analysisOutput);
          setSuggestions(mappedSuggestions);
          setUnifiedPrompt(generatedUnifiedPrompt);
          setProgress(100);
          toast({ title: t('autoupdate.toast.analysisComplete.title' as TranslationKey), description: t('autoupdate.toast.analysisComplete.description' as TranslationKey) });
          addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessGroup' as TranslationKey), flowName});
      }

    } catch (e: any) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.analysisFailedUI' as TranslationKey), errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage , flowName});
      if (e instanceof AppError) {
        setAnalysisError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = e.message || t('autoupdate.errors.unknownAnalysisError' as TranslationKey);
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
      setProgress(0);
      setProjectSourceString(null); // Clear source string on error
    }
  }, [_processAiAnalysisOutput, toast, addDebugLog, router, t]);

  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setLoadingMessage(t('autoupdate.toast.gettingLocalCode.title' as TranslationKey));
    setAnalysisError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setUnifiedPrompt(null);
    setProgress(0);
    setDetailedLogs([]);
    setProjectSourceString(null);
    const flowName = 'callAnalyzeSelfCode (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisStarting' as TranslationKey), data: { sourceType, config: JSON.stringify(llmConfigSource) }, flowName});

    let projectContentStringForAnalysis: string | undefined;
    let sourceLocationForAI: AnalyzeCodeInput['sourceCodeLocation'] = sourceType;

    try {
      if (sourceType === 'Local') {
        toast({ title: t('autoupdate.toast.gettingLocalCode.title' as TranslationKey), description: t('autoupdate.toast.gettingLocalCode.description' as TranslationKey)});
        const bundleResult = await getApplicationSourceBundle(false); // Concatenate false for this context
        if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

        if (!bundleResult.success || !bundleResult.files) {
          const errorMsg = bundleResult.error || t('autoupdate.errors.getLocalSourceFailed' as TranslationKey);
          throw new AppError(errorMsg, bundleResult, 'server');
        }
        projectContentStringForAnalysis = bundleResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.localCodeObtained' as TranslationKey), data: { numFiles: bundleResult.files.length }});
        sourceLocationForAI = "Local";
      } else if (sourceType === 'Git' && gitRepoUrl) {
        // Here you would call a server action to fetch git repo content
        // For now, this part remains conceptual for direct git fetching if not fully server-side
        // This is similar to 'Analizar Proyecto' if a server action is used.
        // Let's assume for now it works like 'Local' or we pass a placeholder
        // For this plan, we'll treat Git as needing a server action like `fetchRemoteGitRepository`
        // and then a similar `projectContentStringForAnalysis` construction.
        // This needs a proper server action call as in `analizar-proyecto`.
        // For now, I'll make it a placeholder and error if not implemented.
        const errorMsg = "La obtención de código fuente desde Git para AutoUpdate no está completamente implementada en este flujo directo. Se recomienda usar 'Local' o una URL que el flujo 'analyzeSelfCode' pueda procesar si es un string de contenido.";
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: errorMsg, data: { sourceType, gitRepoUrl }, flowName});
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.sourceError.title' as TranslationKey), description: errorMsg });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
      } else if (sourceType === 'Git' && !gitRepoUrl) {
        const errorMsg = t('autoupdate.config.gitUrlRequired' as TranslationKey);
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: errorMsg, data: { sourceType, gitRepoUrl }, flowName});
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.sourceError.title' as TranslationKey), description: errorMsg });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
      }
      
      if (!projectContentStringForAnalysis) {
        const errorMsg = "No se pudo obtener el contenido del proyecto para analizar.";
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: errorMsg, flowName});
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: errorMsg });
        setIsAnalyzing(false);
        setLoadingMessage(null);
        return;
      }
      setProjectSourceString(projectContentStringForAnalysis); // Save for snapshot

      setLoadingMessage(t('autoupdate.toast.analyzingWithAI.title' as TranslationKey));

      const currentAgent = llmConfigSource?.type === 'Agente' ? getAgentById(llmConfigSource.id || '') : undefined;
      const currentGroup = llmConfigSource?.type === 'Grupo' ? getGroupById(llmConfigSource.id || '') : undefined;

      const inputForFlow: AnalyzeCodeInput = {
        sourceCodeLocation: sourceLocationForAI, // or 'UploadedString' if we got content
        gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
        projectContent: projectContentStringForAnalysis,
        focusArea: analysisPreferences || undefined,
        agentSystemPrompt: currentAgent
          ? currentAgent.systemPrompt
          : currentGroup
          ? currentGroup.mainTask // Or orchestrator's prompt for group-based analysis
          : undefined,
      };
      await _executeAnalysisAndProcessResults(inputForFlow, llmConfigSource, projectContentStringForAnalysis);

    } catch (e:any) {
       const appErr = e instanceof AppError ? e : new AppError(t('autoupdate.errors.getLocalSourceBundleFailed' as TranslationKey), e, 'server');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.getLocalSourceBundleFailed' as TranslationKey), errorDetails: appErr.originalError, friendlyMessage: appErr.friendlyMessage , flowName});
        setAnalysisError(appErr.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title' as TranslationKey), description: appErr.friendlyMessage });
    } finally {
       setIsAnalyzing(false);
       setLoadingMessage(null);
    }
  }, [sourceType, gitRepoUrl, analysisPreferences, llmConfigSource, getAgentById, getGroupById, _executeAnalysisAndProcessResults, toast, addDebugLog, t]);


  const handleApplySuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent !== undefined || suggestion.fullFileContentSuggested !== undefined)) {
        toast({variant: "destructive", title: t('autoupdate.toast.noContentToApply.title' as TranslationKey), description: t('autoupdate.toast.noContentToApply.description' as TranslationKey)});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  }, [toast, t]);

  const confirmApplySuggestion = useCallback(() => {
    if (!suggestionToApply) return;
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionMarkedApplied' as TranslationKey, { area: suggestionToApply.area })});
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: t('autoupdate.toast.suggestionApplied.title' as TranslationKey), description: t('autoupdate.toast.suggestionApplied.description' as TranslationKey, { area: suggestionToApply.area }) });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  }, [suggestionToApply, toast, addDebugLog, t]);


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
        setIsAnalyzing(true); // Re-use isAnalyzing for loading state
        setLoadingMessage(t('autoupdate.toast.preparingProjectZip.title' as TranslationKey));
        toast({ title: t('autoupdate.toast.preparingProjectZip.title' as TranslationKey), description: t('autoupdate.toast.preparingProjectZip.description' as TranslationKey)});
        let filesToPackage: AppSourceFile[] = [];
        try {
            const bundleResult = await getApplicationSourceBundle(false);
            if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

            if (!bundleResult.success || !bundleResult.files) {
                throw new AppError(bundleResult.error || t('autoupdate.errors.getServerSourceFailedZip' as TranslationKey), bundleResult, 'server');
            }
            filesToPackage = bundleResult.files;
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
        } catch (e: any) {
            const errorMsg = e instanceof Error ? e.message : t('autoupdate.errors.unknownZipError' as TranslationKey);
            toast({ variant: "destructive", title: t('autoupdate.toast.zipError.title' as TranslationKey), description: errorMsg });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.zipGenerationFailed' as TranslationKey, { error: errorMsg })});
        } finally {
            setIsAnalyzing(false);
            setLoadingMessage(null);
        }
    }
  }, [suggestions, toast, addDebugLog, t, setIsAnalyzing, setLoadingMessage]);

  const handleOpenCommitDialog = () => {
    if (!globalSettings.gitConfig.repoUrl || !globalSettings.gitConfig.username || !globalSettings.gitConfig.email || !globalSettings.gitConfig.pat) {
      toast({ variant: "destructive", title: t('autoupdate.toast.gitConfigIncomplete.title' as TranslationKey), description: t('autoupdate.toast.gitConfigIncomplete.description' as TranslationKey) });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadFailedConfig' as TranslationKey)});
      return;
    }
    setShowCommitDialog(true);
  };

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
    const tempLogs: string[] = [];

    try {
      // Here, we conceptually pass the current GIT configuration.
      // handleUploadToGit is a server action that should handle file bundling and git operations.
      const result = await handleUploadToGit(globalSettings.gitConfig, commitMessage, tempLogs);
      setDetailedLogs(prev => [...prev, ...tempLogs]);

      if (result.success) {
        toast({ title: t('autoupdate.toast.gitUploadSuccess.title' as TranslationKey), description: result.message, duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.gitUploadSuccess' as TranslationKey), data: result });
        setShowCommitDialog(false);
        setCommitMessage('');
      } else {
        setAnalysisError(result.message); // Use analysisError to display Git upload errors as well
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


  const handleAutoFixError = useCallback(async (errorMsg: string) => {
    const autoFixFlowName = 'callAutoFixErrorWithGroup (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.attemptingAutofix' as TranslationKey, { error: errorMsg }), flowName: autoFixFlowName});
    toast({ title: t('common.processing' as TranslationKey), description: t('errorDisplay.toast.autofixAttempt.description' as TranslationKey)});
    // Actual auto-fix logic via ErrorDisplay component's internal call to callAutoFixErrorWithGroup
  }, [addDebugLog, t]);

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

  const handleSuggestionContentChange = useCallback((suggestionId: string, newContent: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, userEditedContent: newContent } : s));
  }, []);

  const handleSaveEdit = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, isEditing: false } : s));
    toast({title: t('autoupdate.toast.editSaved.title' as TranslationKey), description: t('autoupdate.toast.editSaved.description' as TranslationKey)})
  }, [toast, t]);

  const handleCancelEdit = useCallback((suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        return { ...s, isEditing: false, userEditedContent: s.fullFileContentSuggested ?? undefined };
      }
      return s;
    }));
  }, []);

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
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, { section: "AutoUpdate" }) });
      return;
    }

    // Construct a meaningful representation for the snapshot
    // It could be the original source string plus the applied suggestions,
    // or the full analysis result if that's more representative.
    // For now, let's save the analysisResult if available, otherwise the source.
    const snapshotData = {
      analysis: analysisResult,
      sourceHint: sourceType === 'Local' ? 'Local CodeAlchemist Source' : `Git: ${gitRepoUrl}`,
      appliedSuggestions: suggestions.filter(s => s.status === 'applied').map(s => ({
        area: s.area,
        suggestion: s.suggestion,
        newContent: s.userEditedContent ?? s.fullFileContentSuggested,
      })),
      analysisPreferences: analysisPreferences,
    };

    const snapshotName = t('autoupdate.logs.snapshotNamePrefix' as TranslationKey) + ` - ${new Date().toLocaleTimeString()}`;
    addSnapshot({
      name: snapshotName,
      code: JSON.stringify(snapshotData, null, 2),
      source: 'autoupdate-snapshot'
    });
    // Toast for saving is handled by addSnapshot in AppStateContext
    addDebugLog({ source: 'AutoUpdatePage', type: 'INFO', message: `Snapshot de AutoUpdate guardado: ${snapshotName}`});
  }, [analysisResult, projectSourceString, suggestions, sourceType, gitRepoUrl, analysisPreferences, addSnapshot, t, toast]);


  const handleRedefineAnalysisPrefs = async () => {
    if (!analysisPreferences.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningAnalysisPrefs(true);
    addDebugLog({ source: 'AutoUpdatePage', type: 'INFO', message: `Redefining analysis preferences. Original: ${analysisPreferences.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const result = await callRedefinePrompt({ originalPrompt: analysisPreferences });
      setAnalysisPreferences(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AutoUpdatePage', type: 'SUCCESS', message: `'analysisPreferences' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AutoUpdatePage', type: 'ERROR', message: `Redefining 'analysisPreferences' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningAnalysisPrefs(false);
    }
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
          isLoading={isAnalyzing || isUploadingGit || isRedefiningAnalysisPrefs}
          progress={progress}
          isAnalysisInProgress={isAnalyzing && !analysisResult && progress < 100 && llmConfigSource?.type !== 'Grupo'}
          isRedefiningAnalysisPrefs={isRedefiningAnalysisPrefs}
          onRedefineAnalysisPrefs={handleRedefineAnalysisPrefs}
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
          onSaveSnapshot={handleSaveAutoUpdateSnapshot}
        />

        <ConfirmDialog
          isOpen={showConfirmApplyDialog && !!suggestionToApply}
          onClose={() => { setSuggestionToApply(null); setShowConfirmApplyDialog(false); }}
          onConfirm={confirmApplySuggestion}
          title={t('autoupdate.dialogs.applySuggestion.title' as TranslationKey, { area: suggestionToApply?.area || 'N/A' })}
          confirmText={t('autoupdate.dialogs.applySuggestion.confirmText' as TranslationKey)}
          cancelText={t('common.cancel' as TranslationKey)}
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
                <Button variant="outline">{t('common.close' as TranslationKey)}</Button>
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
                <Button variant="outline">{t('common.close' as TranslationKey)}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          isOpen={showCommitDialog}
          onClose={() => setShowCommitDialog(false)}
          onConfirm={performGitUpload}
          title={t('autoupdate.dialogs.commitToGit.title' as TranslationKey)}
          confirmText={isUploadingGit ? t('common.uploading' as TranslationKey) : t('autoupdate.dialogs.commitToGit.confirmText' as TranslationKey)}
          confirmDisabled={isUploadingGit}
          cancelText={t('common.cancel' as TranslationKey)}
        >
          <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder={t('autoupdate.dialogs.commitToGit.placeholder' as TranslationKey)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.commitToGit.description' as TranslationKey)}</p>
        </ConfirmDialog>

        {(analysisResult?.groupLog || detailedLogs.length > 0 || (isAnalyzing && !analysisResult && llmConfigSource?.type === 'Grupo')) && (
            <div className="mt-4">
            <LogsDisplay
              title={t('autoupdate.logs.detailedExecutionLogsTitle' as TranslationKey)}
              logs={detailedLogs.length > 0 ? detailedLogs : (analysisResult?.groupLog ? [analysisResult.groupLog] : (isAnalyzing ? [t('autoupdate.logs.analyzingWithGroup' as TranslationKey)] : [t('autoupdate.logs.waitingForGroup' as TranslationKey)]))}
              defaultExpanded={!!analysisResult?.groupLog || detailedLogs.length > 0}
            />
            </div>
        )}
      </div>
    </React.Fragment>
  );
}
