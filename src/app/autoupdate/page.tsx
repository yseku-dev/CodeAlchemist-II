
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useDebug } from '@/context/DebugContext';
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
import { getApplicationSourceBundle, handleUploadToGit } from './actions';
import JSZip from 'jszip';
import LogsDisplay from '@/components/logs-display';
import { useI18n } from '@/context/I18nContext';

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
  const { agents, groups, settings: globalSettings, getAgentById, getGroupById } = useAppState();
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


  const _processAiAnalysisOutput = useCallback((
    aiResult: AnalyzeCodeOutput,
    currentLlmConfigSource: LLMConfigSourceOption | undefined,
    currentProjectFiles?: AppSourceFile[]
  ): { analysisOutput: AnalyzeCodeOutput; mappedSuggestions: AutoUpdateSuggestion[]; generatedUnifiedPrompt: string | null } => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisProcessingComplete'), data: { outputTitle: aiResult.analysisTitle, numSuggestions: aiResult.detailedSuggestions.length }});
    
    const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => {
      const normalizePath = (p: string) => p.replace(new RegExp("^\\.\\/"), '').replace(new RegExp("^src\\/"), '');
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
        finalResultOutput.groupLog = t('autoupdate.logs.groupContextLog', {
            groupName: currentLlmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisPreferences || t('autoupdate.analysis.general')),
            orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'analyzeSelfCode'
        });
    }

    let generatedUnifiedPromptText: string | null = null;
    if (mappedSuggestions.length > 0) {
      const allPrompts = mappedSuggestions
        .filter(s => s.suggestedPromptForImplementation && s.suggestedPromptForImplementation.trim() !== '')
        .map(s => t('autoupdate.prompts.unifiedHeader', { area: s.area }) + `\n${s.suggestedPromptForImplementation}\n` + t('autoupdate.prompts.unifiedFooter', { area: s.area }))
        .join('\n\n');
      if (allPrompts.trim() !== '') {
        generatedUnifiedPromptText = allPrompts;
      }
    }
    
    return { analysisOutput: finalResultOutput, mappedSuggestions, generatedUnifiedPrompt: generatedUnifiedPromptText };
  }, [getAgentById, getGroupById, addDebugLog, t, analysisPreferences]);
  
  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setUnifiedPrompt(null);
    setProgress(0);
    setDetailedLogs([]); 
    const flowName = 'callAnalyzeSelfCode (AutoUpdate)';
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.analysisStarting'), data: { sourceType, config: JSON.stringify(llmConfigSource) }, flowName});

    let projectFilesForAnalysis: AppSourceFile[] | undefined;
    let projectContentStringForAnalysis: string | undefined;

    if (sourceType === 'Local') {
      try {
        toast({ title: t('autoupdate.toast.gettingLocalCode.title'), description: t('autoupdate.toast.gettingLocalCode.description')});
        const bundleResult = await getApplicationSourceBundle(false); 
        if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);
        
        if (!bundleResult.success || !bundleResult.files) {
          throw new Error(bundleResult.error || t('autoupdate.errors.getLocalSourceFailed'));
        }
        projectFilesForAnalysis = bundleResult.files;
        projectContentStringForAnalysis = projectFilesForAnalysis.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.localCodeObtained'), data: { numFiles: projectFilesForAnalysis.length }});
      } catch (e) {
        const err = e as Error;
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.getLocalSourceBundleFailed'), data: { error: err.message }, flowName});
        setAnalysisError(err.message);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: err.message });
        setIsAnalyzing(false);
        return;
      }
    }
    
    const currentAgent = llmConfigSource?.type === 'Agente' ? getAgentById(llmConfigSource.id || '') : undefined;
    const currentGroup = llmConfigSource?.type === 'Grupo' ? getGroupById(llmConfigSource.id || '') : undefined;

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      projectContent: projectContentStringForAnalysis, 
      focusArea: analysisPreferences || undefined, 
      agentSystemPrompt: currentAgent 
        ? currentAgent.systemPrompt 
        : currentGroup 
        ? currentGroup.mainTask 
        : undefined,
    };

    try {
      if (llmConfigSource?.type !== 'Grupo') {
        let currentProgressVal = 0;
        const intervalId = setInterval(() => {
          currentProgressVal += 10;
          if (currentProgressVal <= 100) {
            setProgress(currentProgressVal);
          } else {
            clearInterval(intervalId);
          }
        }, 300); 
        
        await callAnalyzeSelfCode(input)
          .then((aiResult) => {
            clearInterval(intervalId);
            const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, llmConfigSource, projectFilesForAnalysis);
            setAnalysisResult(analysisOutput);
            setSuggestions(mappedSuggestions);
            setUnifiedPrompt(generatedUnifiedPrompt);
            setProgress(100);
            toast({ title: t('autoupdate.toast.analysisComplete.title'), description: t('autoupdate.toast.analysisComplete.description') });
            if (analysisOutput.groupLog) setDetailedLogs(prev => [...prev, analysisOutput.groupLog!]);
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessNonGroup'), flowName});
          })
          .catch(err => { 
            clearInterval(intervalId);
            throw err; 
          });
      } else { 
        setProgress(50); 
        const aiResult = await callAnalyzeSelfCode(input);
        const { analysisOutput, mappedSuggestions, generatedUnifiedPrompt } = _processAiAnalysisOutput(aiResult, llmConfigSource, projectFilesForAnalysis);
        setAnalysisResult(analysisOutput);
        setSuggestions(mappedSuggestions);
        setUnifiedPrompt(generatedUnifiedPrompt);
        setProgress(100); 
        toast({ title: t('autoupdate.toast.analysisComplete.title'), description: t('autoupdate.toast.analysisComplete.description') });
        if (analysisOutput.groupLog) setDetailedLogs(prev => [...prev, analysisOutput.groupLog!]);
        addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.analysisSuccessGroup'), flowName});
      }
    } catch (e: any) {
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.errors.analysisFailedUI'), data: { errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage }, flowName});
      if (e instanceof AppError) {
        setAnalysisError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = e.message || t('autoupdate.errors.unknownAnalysisError');
        setAnalysisError(errorMsg);
        toast({ variant: "destructive", title: t('autoupdate.toast.analysisError.title'), description: errorMsg });
      }
      setProgress(0); 
    } finally {
      setIsAnalyzing(false);
    }
  }, [sourceType, gitRepoUrl, analysisPreferences, llmConfigSource, getAgentById, getGroupById, _processAiAnalysisOutput, toast, addDebugLog, router, t]); 

  const handleApplySuggestionClick = useCallback((suggestion: AutoUpdateSuggestion) => {
    if (!(suggestion.userEditedContent !== undefined || suggestion.fullFileContentSuggested !== undefined)) {
        toast({variant: "destructive", title: t('autoupdate.toast.noContentToApply.title'), description: t('autoupdate.toast.noContentToApply.description')});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  }, [toast, t]);

  const confirmApplySuggestion = useCallback(() => {
    if (!suggestionToApply) return;
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionMarkedApplied', { area: suggestionToApply.area })});
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied', isEditing: false } : s));
    toast({ title: t('autoupdate.toast.suggestionApplied.title'), description: t('autoupdate.toast.suggestionApplied.description', { area: suggestionToApply.area }) });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  }, [suggestionToApply, toast, addDebugLog, t]);

  const handleDownload = useCallback(async (format: 'JSON_SUGGESTIONS' | 'ZIP_PROJECT') => {
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.downloadRequested', { format: format })});

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
      addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.suggestionsDownloadedJson')});
    } else if (format === 'ZIP_PROJECT') {
        setIsAnalyzing(true); 
        toast({ title: t('autoupdate.toast.preparingProjectZip.title'), description: t('autoupdate.toast.preparingProjectZip.description')});
        try {
            const bundleResult = await getApplicationSourceBundle(false); 
            if(bundleResult.logsBuilt) setDetailedLogs(prev => [...prev, ...bundleResult.logsBuilt!]);

            if (!bundleResult.success || !bundleResult.files) {
                throw new Error(bundleResult.error || t('autoupdate.errors.getServerSourceFailedZip'));
            }

            let filesToPackage: AppSourceFile[] = bundleResult.files;
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
                          addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'DEBUG', message: t('autoupdate.logs.applyingSuggestionToZip', { fileName: file.fileName })});
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

            const zipFileName = t('autoupdate.downloads.projectZipFilename');

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
                title: t('autoupdate.toast.projectZipDownloadInitiated.title'), 
                description: t('autoupdate.toast.projectZipDownloadInitiated.description', {filename: zipFileName}),
                duration: 12000, 
            });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.projectZipDownloaded', { numFiles: filesToPackage.length })});
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : t('autoupdate.errors.unknownZipError');
            toast({ variant: "destructive", title: t('autoupdate.toast.zipError.title'), description: errorMsg });
            addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.zipGenerationFailed', { error: errorMsg })});
        } finally {
            setIsAnalyzing(false);
        }
    }
  }, [suggestions, toast, addDebugLog, t, analysisResult, setIsAnalyzing]);

  const handleOpenCommitDialog = () => {
    if (!globalSettings.gitConfig.repoUrl || !globalSettings.gitConfig.username || !globalSettings.gitConfig.email || !globalSettings.gitConfig.pat) {
      toast({ variant: "destructive", title: t('autoupdate.toast.gitConfigIncomplete.title'), description: t('autoupdate.toast.gitConfigIncomplete.description') });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadFailedConfig')});
      return;
    }
    setShowCommitDialog(true);
  };

  const performGitUpload = useCallback(async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: t('autoupdate.toast.commitMessageRequired.title') });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.commitMessageMissing')});
      return;
    }
    
    setIsUploadingGit(true);
    setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [INFO] ${t('autoupdate.logs.initiatingGitUpload')}`]);
    toast({ title: t('autoupdate.toast.uploadingToGit.title'), description: t('autoupdate.toast.uploadingToGit.description', { repo: globalSettings.gitConfig.repoUrl.split('/').pop()?.replace('.git','') || 'repositorio' }) });
    addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.gitUploadInProgress', { message: commitMessage }), data: { repoUrl: globalSettings.gitConfig.repoUrl }});

    try {
      const result = await handleUploadToGit(globalSettings.gitConfig, commitMessage, detailedLogs); 
      
      if (result.success) {
        toast({ title: t('autoupdate.toast.gitUploadSuccess.title'), description: result.message, duration: 7000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'SUCCESS', message: t('autoupdate.logs.gitUploadSuccess'), data: result });
        setShowCommitDialog(false);
        setCommitMessage('');
      } else {
        toast({ title: t('autoupdate.toast.gitUploadError.title'), description: result.message, variant: "destructive", duration: 10000 });
        addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadError', { error: result.message }), data: result });
      }
    } catch (error: any) {
      const errorMsg = error.message || t('autoupdate.errors.unknownGitUploadError');
      toast({ title: t('autoupdate.toast.gitUploadError.title'), description: errorMsg, variant: "destructive", duration: 10000 });
      addDebugLog({ source: 'AUTOUPDATE_PAGE', type: 'ERROR', message: t('autoupdate.logs.gitUploadException', { error: errorMsg }), data: error });
      setDetailedLogs(prev => [...prev, `[${new Date().toISOString()}] [FATAL_CLIENT] Error en llamada a handleUploadToGit: ${errorMsg}`]);
    } finally {
      setIsUploadingGit(false);
    }
  }, [globalSettings.gitConfig, commitMessage, toast, addDebugLog, t, detailedLogs]);


  const handleAutoFixError = useCallback(async (errorMsg: string) => {
    const autoFixFlowName = 'callAnalyzeSelfCode (AutoFix Error)'; 
    addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.attemptingAutofix', { error: errorMsg }), flowName: autoFixFlowName});
    setIsAnalyzing(true); 
    setAnalysisError(null);
    try {
      const agentForFix = getAgentById('refactorizador-codigo-experto') || (agents.length > 0 ? getAgentById(agents[0].id) : undefined);
      const result = await callAnalyzeSelfCode({ 
        sourceCodeLocation: 'Local', 
        projectContent: t('autoupdate.autofix.errorContext', { error: errorMsg }),
        focusArea: t('autoupdate.autofix.focusArea', { error: errorMsg }),
        agentSystemPrompt: agentForFix?.systemPrompt, 
      });
      toast({ title: t('autoupdate.toast.autofixSuggestion.title'), description: result.generalAssessment, duration: 10000 });
    } catch (e: any) {
      const appErr = e instanceof AppError ? e : new AppError(t('autoupdate.errors.autofixHelperFailed'), e, 'ai');
      toast({ variant: "destructive", title: t('autoupdate.toast.autofixError.title'), description: appErr.friendlyMessage });
      if (appErr.redirectTo) router.push(appErr.redirectTo);
    } finally {
      setIsAnalyzing(false);
    }
  }, [addDebugLog, toast, router, getAgentById, agents, t]);

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
    toast({title: t('autoupdate.toast.editSaved.title'), description: t('autoupdate.toast.editSaved.description')})
  }, [toast, t]);

  const handleCancelEdit = useCallback((suggestionId: string) => {
     setSuggestions(prev => prev.map(s => {
      if (s.id === suggestionId) {
        // Revert to original AI suggestion or empty if no original AI suggestion
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
          title={t('autoupdate.dialogs.applySuggestion.title', { area: suggestionToApply?.area || 'N/A' })}
          confirmText={t('autoupdate.dialogs.applySuggestion.confirmText')}
        >
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p1', { area: suggestionToApply?.area || 'N/A' })}</p>
          <p className="text-sm mb-2 text-muted-foreground">{t('autoupdate.dialogs.applySuggestion.description.p2')}</p>
          <ScrollArea className="h-64 border rounded-md">
            <CodeBlock code={suggestionToApply?.userEditedContent ?? suggestionToApply?.fullFileContentSuggested ?? t('autoupdate.dialogs.noContentToShow')} language="typescript" maxHeight="100%" />
          </ScrollArea>
        </ConfirmDialog>

        <Dialog open={showTestDialog && !!suggestionToTest} onOpenChange={(open) => { if(!open) setSuggestionToTest(null); setShowTestDialog(open);}}>
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

        <Dialog open={showTestInVenvDialog && !!suggestionToTestInVenv} onOpenChange={(open) => { if(!open) setSuggestionToTestInVenv(null); setShowTestInVenvDialog(open);}}>
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
                toast({ title: t('autoupdate.toast.venvSim.title'), description: t('autoupdate.toast.venvSim.description', { area: suggestionToTestInVenv?.area || 'N/A' })});
                addDebugLog({source: 'AUTOUPDATE_PAGE', type: 'INFO', message: t('autoupdate.logs.venvSim', { area: suggestionToTestInVenv?.area || 'N/A' })});
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
        >
          <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder={t('autoupdate.dialogs.commitToGit.placeholder')} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-2">{t('autoupdate.dialogs.commitToGit.description')}</p>
        </ConfirmDialog>

        {(analysisResult?.groupLog || detailedLogs.length > 0 || (isAnalyzing && !analysisResult && llmConfigSource?.type === 'Grupo')) && (
            <div className="lg:col-span-3 mt-4">
            <LogsDisplay 
              title={t('autoupdate.logs.detailedExecutionLogsTitle')} 
              logs={detailedLogs.length > 0 ? detailedLogs : (analysisResult?.groupLog || (isAnalyzing ? [t('autoupdate.logs.analyzingWithGroup')] : [t('autoupdate.logs.waitingForGroup')]))} 
              defaultExpanded={!!analysisResult?.groupLog || detailedLogs.length > 0}
            />
            </div>
        )}
      </div>
    </React.Fragment>
  );
}
    
