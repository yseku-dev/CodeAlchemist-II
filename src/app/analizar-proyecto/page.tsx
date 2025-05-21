
// src/app/analizar-proyecto/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppState } from '@/context/AppStateContext';
import type {
  LLMConfigSourceOption,
  AnalyzeCodeOutput,
  Agent,
  AIAgentGroup,
  DetailedSuggestionForUI,
  AppSourceFile,
  ChatMessage,
  CodeSnapshot,
  AnalyzeCodeInput,
} from '@/types';
import { callAnalyzeSelfCode, callRedefinePrompt, callChatWithAgentOrGlobal } from '@/utils/apiClient';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Loader2 } from 'lucide-react';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast'; // Importación añadida

type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration source, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
 * It also includes an interactive chat for modifying/discussing the analysis and options to save snapshots
 * and download a modified ZIP if the source was Git.
 * All UI texts are internationalized.
 * @module AnalizarProyectoPage
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useLocalStorage<ProjectSourceType>("codealchemist-ap-projectSourceType", "upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useLocalStorage<string | null>('codealchemist-ap-uploadedFileName', null);

  const [gitUrl, setGitUrl] = useLocalStorage<string>('codealchemist-ap-gitUrl', '');
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);
  const [originalProjectFiles, setOriginalProjectFiles] = useLocalStorage<AppSourceFile[] | null>('codealchemist-ap-originalProjectFiles', null);

  const [chatHistoryAnalyze, setChatHistoryAnalyze] = useLocalStorage<ChatMessage[]>('codealchemist-ap-chatHistoryAnalyze', []);
  const [currentModificationRequestAnalyze, setCurrentModificationRequestAnalyze] = useLocalStorage<string>('codealchemist-ap-modificationRequestAnalyze', '');
  const [isModifyingProjectAnalyze, setIsModifyingProjectAnalyze] = useState(false);
  const [isRedefiningModificationRequestAnalyze, setIsRedefiningModificationRequestAnalyze] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);

  const scrollAreaRefChat = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistoryAnalyze]);

  /**
   * Handles changes to the file input for project uploads.
   * Validates the file type (ZIP or JSON) and size.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024; // 25MB

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        setError(null);
        addDebugLog({
          source: 'AnalizarProyectoPage', type: 'INFO',
          message: `Project file selected: ${file.name}, type: ${file.type || (isZip ? 'zip' : 'json')}, size: ${file.size} bytes`,
          flowName: 'handleFileChange'
        });
      } else {
        const errorMsgKey = 'analyzeProject.toast.invalidFile.description' as TranslationKey;
        const errorMsg = t(errorMsgKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        addDebugLog({
            source: 'AnalizarProyectoPage', type: 'WARN',
            message: `Invalid file: ${file.name}, type: ${file.type}, size: ${file.size}. Valid: ${isZip || isJson}, SizeOK: ${isValidSize}`,
            flowName: 'handleFileChange'
        });
      }
    }
  };

  /**
   * Executes the project analysis by calling the AI flow.
   * This function is memoized with useCallback.
   * @param {AnalyzeCodeInput} analysisInput - The input parameters for the analysis flow.
   */
  const executeAnalysis = useCallback(async (analysisInput: AnalyzeCodeInput ) => {
    const flowName = 'analyzeProject (callAnalyzeSelfCode)';
    addDebugLog({
        source: 'AnalizarProyectoPage',
        type: 'INFO',
        message: `Analyzing project with input (content truncated): ${JSON.stringify({...analysisInput, projectContent: (analysisInput.projectContent || '').substring(0,200) + '...' })} and config: ${JSON.stringify(llmConfigSource)}`,
        flowName
    });

   try {
      const aiResult = await callAnalyzeSelfCode(analysisInput);
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         const group = getGroupById(llmConfigSource.id || '');
         const orchestrator = getAgentById('orquestador-flujo-agentes');
         finalResult.groupLog = t('analyzeProject.results.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInput.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalyzeProject)'
        });
      }

      setResult(finalResult);
      setSuggestionsForUI((finalResult.detailedSuggestions || []).map((s, idx) => ({ ...s, id: `suggestion-ap-${idx}-${Date.now()}`, isSelected: false })));
      toast({ title: t('analyzeProject.toast.analysisComplete.title' as TranslationKey), description: t('analyzeProject.toast.analysisComplete.description' as TranslationKey) });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: "Project analysis successful.", data: {title: finalResult.analysisTitle, suggestions: (finalResult.detailedSuggestions || []).length}, flowName});
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Project analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = (e as Error).message || "Ocurrió un error durante el análisis del proyecto.";
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router]);

  /**
   * Initiates the project analysis process.
   * Fetches project content (from upload or Git) and then calls `executeAnalysis`.
   */
  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setOriginalProjectFiles(null);
    setChatHistoryAnalyze([]);

    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        agentSystemPrompt = group?.mainTask;
    }

    let analysisInputBase: AnalyzeCodeInput = {
        sourceCodeLocation: "UploadedString",
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    if (projectSourceType === "upload" && uploadedFile) {
      setLoadingMessage(t('analyzeProject.toast.processingFile' as TranslationKey));
      addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Processing uploaded file for analysis: ${uploadedFile.name}`, flowName: 'handleAnalyze'});

      if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
        try {
          const jszip = new JSZip();
          const zip = await jszip.loadAsync(uploadedFile);
          let projectContentString = "";
          const fileProcessingPromises: Promise<void>[] = [];
          const textFileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.php', '.rb', '.md', '.txt', '.xml', '.yaml', '.yml', '.env', '.ini', '.cfg', '.sh', '.bat', '.sql', '.graphql', '.tf', '.hcl', '.text', '.properties', '.log', '.gitignore', 'dockerfile', '.dockerignore', '.npmrc', '.editorconfig', '.prettierrc', '.eslintrc'];
          const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test'];
          const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg'];

          zip.forEach((relativePath, fileEntry) => {
            if (!fileEntry.dir &&
                !ignorePatternsSimple.some(pattern => relativePath.startsWith(pattern)) &&
                !binaryExtensions.some(ext => relativePath.toLowerCase().endsWith(ext)) &&
                (textFileExtensions.some(ext => relativePath.toLowerCase().endsWith(ext)) || !relativePath.includes('.'))
            ) {
              fileProcessingPromises.push(
                fileEntry.async("string").then(content => {
                  projectContentString += `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${relativePath} ---\n${content}\n\n`;
                }).catch(err => {
                  addDebugLog({source: 'AnalizarProyectoPage', type: 'WARN', message: `Could not read file ${relativePath} from ZIP: ${(err as Error).message}`, flowName: 'handleAnalyze'});
                })
              );
            } else if (!fileEntry.dir) {
                addDebugLog({source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Skipping file in ZIP: ${relativePath} (binary or ignored)`, flowName: 'handleAnalyze'});
            }
          });

          await Promise.all(fileProcessingPromises);

          if (!projectContentString) {
            const noFilesErrorKey = 'analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey;
            const noFilesError = t(noFilesErrorKey, {fileName: uploadedFile.name });
            addDebugLog({source: 'AnalizarProyectoPage', type: 'WARN', message: noFilesError, flowName: 'handleAnalyze'});
            setError(noFilesError);
            setIsLoading(false); setLoadingMessage(null); return;
          }
          addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Extracted content from ZIP for analysis. Total length: ${projectContentString.length}`});
          const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            projectContent: projectContentString,
            sourceCodeLocation: "UploadedString",
          };
          await executeAnalysis(analysisInput);

        } catch (zipError: any) {
          const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
          toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: errorMsg});
          setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
          addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error processing ZIP: ${zipError.message}`, errorDetails: zipError, flowName: 'handleAnalyze'});
          return;
        }
      } else if (uploadedFile.name.toLowerCase().endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const projectContent = e.target?.result as string;
            const analysisInput: AnalyzeCodeInput = {
              ...analysisInputBase,
              projectContent: projectContent,
              sourceCodeLocation: "UploadedString",
            };
            addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Analyzing uploaded JSON project: ${uploadedFile.name}`, flowName: 'handleAnalyze'});
            await executeAnalysis(analysisInput);
        };
        reader.onerror = () => {
            const errorMsg = t('analyzeProject.toast.readError.description' as TranslationKey);
            toast({ variant: "destructive", title: t('analyzeProject.toast.readError.title' as TranslationKey), description: errorMsg});
            setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
            addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error reading file: ${uploadedFile.name}`, flowName: 'handleAnalyze'});
        }
        reader.readAsText(uploadedFile);
      } else {
          const errorMsg = t('analyzeProject.toast.unsupportedFileType.description' as TranslationKey);
          toast({ variant: "destructive", title: t('analyzeProject.toast.unsupportedFileType.title' as TranslationKey), description: errorMsg});
          setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
          addDebugLog({source: 'AnalizarProyectoPage', type: 'WARN', message: `Unsupported file type for analysis: ${uploadedFile.name}`, flowName: 'handleAnalyze'});
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit' as TranslationKey));
      addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Fetching Git project URL for analysis: ${gitUrl}`, flowName: 'handleAnalyze'});
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.success && gitResult.files) {
          const projectContentString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          setOriginalProjectFiles(gitResult.files);
          const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            gitRepoUrl: gitUrl,
            projectContent: projectContentString,
            sourceCodeLocation: "Git",
          };
          if (gitResult.logsBuilt) {
            gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'FetchRemoteGit(AnalyzeProject)', type: 'INFO', message: logMsg }));
          }
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        const errorMsg = gitError.message || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title' as TranslationKey), description: errorMsg });
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error fetching Git repo: ${errorMsg}`, errorDetails: gitError, flowName: 'handleAnalyze'});
        return;
      }
    } else {
      const errorMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: errorMsg });
      setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
      addDebugLog({source: 'AnalizarProyectoPage', type: 'WARN', message: `Analysis started without valid source. Type: ${projectSourceType}, File: ${uploadedFile?.name}, Git URL: ${gitUrl}`, flowName: 'handleAnalyze'});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, toast, addDebugLog
  ]);

  /**
   * Handles attempts to auto-fix errors displayed by the ErrorDisplay component.
   * @param {string} errorToFix - The error message to be auto-fixed.
   */
  const handleAutoFixError = async (errorToFix: string) => {
    const autoFixFlowName = 'callAutoFixErrorWithGroup (AnalizarProyecto)';
    const contextForAI = `${t('error.errorDisplay.autofixContextPrefix' as TranslationKey)} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)}' ${currentModificationRequestAnalyze ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${currentModificationRequestAnalyze}"` : '' }`;
    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: autoFixFlowName});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
  };

  /**
   * Redefines the 'focusArea' input using AI.
   */
  const handleRedefineFocusAreaProject = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningFocusArea(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefining focus area. Original (start): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'focusArea' redefined. New (start): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Failed to redefine 'focusArea'.`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  /**
   * Sends a modification request to the AI for the current project analysis.
   */
  const handleSendModificationRequestAnalyze = async () => {
    if ((!currentModificationRequestAnalyze || !currentModificationRequestAnalyze.trim()) || !result) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.emptyModificationRequest' as TranslationKey) });
      return;
    }
    setIsModifyingProjectAnalyze(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Sending analysis modification/query request: ${currentModificationRequestAnalyze}`, data: { currentAnalysisTitle: result.analysisTitle } });

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: currentModificationRequestAnalyze, timestamp: new Date().toISOString() };
    setChatHistoryAnalyze(prev => [...prev, userMessage]);
    const tempCurrentModificationRequest = currentModificationRequestAnalyze;
    setCurrentModificationRequestAnalyze('');

    let agentSystemPromptForChat: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForChat = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = getAgentById('orquestador-flujo-agentes');
        agentSystemPromptForChat = orchestrator?.systemPrompt || group?.mainTask;
    }

    const chatContextForAI = t('analyzeProject.results.modificationContextPrefix' as TranslationKey) +
      `\nTítulo del Análisis: ${result.analysisTitle}` +
      `\nEvaluación General: ${result.generalAssessment}` +
      `\nÁreas Identificadas: ${(result.identifiedAreas || []).join(', ')}` +
      `\nSugerencias Detalladas: ${(result.detailedSuggestions || []).map(s => `- ${s.area}: ${s.suggestion}`).join('\n')}` +
      `\n\nEl usuario ahora pregunta o solicita lo siguiente sobre este análisis:`;

    try {
        const aiResponse = await callChatWithAgentOrGlobal({
            userMessage: `${chatContextForAI}\n"${tempCurrentModificationRequest}"`,
            agentSystemPrompt: agentSystemPromptForChat || t('analyzeProject.results.defaultChatContextSystemPrompt' as TranslationKey)
        });

        const assistantMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content: aiResponse.aiResponse, timestamp: new Date().toISOString() };
        setChatHistoryAnalyze(prev => [...prev, assistantMessage]);
        
        setResult(prevResult => {
          if (!prevResult) return null;
          const newAiNotes = (prevResult.aiNotes || '') + 
                             `\n\n[${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey)} ${new Date(userMessage.timestamp).toLocaleTimeString()}]` +
                             `\n  ${t('common.userLabel')}: "${userMessage.content}"` +
                             `\n  ${t('common.assistantLabel')}: "${aiResponse.aiResponse}"`;
          return { ...prevResult, aiNotes: newAiNotes };
        });
        toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey) });
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'AI response received for analysis modification/query.'});

    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: "Failed analysis modification/query (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      const systemErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: t('chat.systemMessage.errorPrefix' as TranslationKey) + errorMsg, timestamp: new Date().toISOString() };
      setChatHistoryAnalyze(prev => [...prev, systemErrorMessage]);
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsModifyingProjectAnalyze(false);
    }
  };

  /**
   * Redefines the current project modification request using AI.
   */
  const handleRedefineModificationRequestAnalyze = async () => {
    if (!currentModificationRequestAnalyze || !currentModificationRequestAnalyze.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningModificationRequestAnalyze(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefining analysis modification request. Original (start): ${currentModificationRequestAnalyze.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: currentModificationRequestAnalyze });
      setCurrentModificationRequestAnalyze(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'currentModificationRequestAnalyze' redefined. New (start): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: "Failed to redefine 'currentModificationRequestAnalyze'.", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationRequestAnalyze(false);
    }
  };

  /**
   * Saves the current project analysis result as a snapshot.
   */
  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, {section: t('sidebar.analyzeProject' as TranslationKey)})});
      return;
    }
    const snapshotNameKey = 'analyzeProject.results.snapshotName' as TranslationKey;
    const snapshotName = t(snapshotNameKey, { name: (result.analysisTitle || "Sin Titulo").substring(0,30), time: new Date().toLocaleTimeString() });

    const snapshotDataToSave: Partial<AnalyzeCodeOutput> & { uiSelectedSuggestions?: DetailedSuggestionForUI[], uiChatHistory?: ChatMessage[] } = {
      ...result,
      detailedSuggestions: suggestionsForUI.map(s => ({
          area: s.area,
          suggestion: s.suggestion,
          priority: s.priority,
          suggestedContent: s.suggestedContent,
          suggestedPromptForImplementation: s.suggestedPromptForImplementation,
      })),
      uiChatHistory: chatHistoryAnalyze,
    };
    const snapshotJsonString = JSON.stringify(snapshotDataToSave, null, 2);
    addSnapshot({
      name: snapshotName,
      code: snapshotJsonString,
      source: 'project-analysis',
      size: snapshotJsonString.length,
      metadata: { analysisTitle: result.analysisTitle }
    });
    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Snapshot of project analysis saved: ${snapshotName}`});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, suggestionsForUI, chatHistoryAnalyze, addSnapshot, t, toast, addDebugLog]);

  /**
   * Toggles the selection state of a detailed suggestion.
   * @param {string} suggestionId - The ID of the suggestion to toggle.
   */
  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s)
    );
  }, [setSuggestionsForUI]);

  /**
   * Applies selected suggestions (with content) to the original project files (if source was Git)
   * and initiates a ZIP download of the modified project.
   */
  const handleApplySelectedAndDownloadZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noGitSource' as TranslationKey)});
      return;
    }
    const selectedAndApplicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent);
    if (selectedAndApplicableSuggestions.length === 0) {
      toast({ title: t('analyzeProject.toast.downloadError.noSuggestionsSelected' as TranslationKey), description: t('analyzeProject.toast.downloadError.selectSuggestions' as TranslationKey) });
      return;
    }

    setIsLoading(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      const filesMap = new Map<string, string>(originalProjectFiles.map(f => [f.fileName, f.content]));

      selectedAndApplicableSuggestions.forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
          filesMap.set(suggestion.area, suggestion.suggestedContent);
          addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Applying suggestion to ${suggestion.area} for ZIP.`});
        }
      });

      const modifiedProjectFiles: AppSourceFile[] = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));

      const zip = new JSZip();
      modifiedProjectFiles.forEach(file => {
        zip.file(file.fileName, file.content);
      });

      const zipFileNameKey = 'analyzeProject.downloads.zipFilename' as TranslationKey;
      const zipFileName = t(zipFileNameKey, {projectName: (result?.analysisTitle || 'proyecto_analizado').replace(/\s+/g, '_').substring(0,30)});

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: t('analyzeProject.toast.zipDownloadSuccess.title' as TranslationKey), description: t('analyzeProject.toast.zipDownloadSuccess.description' as TranslationKey, { filename: zipFileName }) });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `Modified project downloaded as ${zipFileName}`});

    } catch (e: any) {
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Failed to generate/download ZIP of modified project: ${errorMsg}`});
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalProjectFiles, suggestionsForUI, result, toast, addDebugLog, t, setIsLoading, setLoadingMessage]);

  return (
    <Card className="max-w-4xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType}
          onProjectSourceTypeChange={(value) => { setProjectSourceType(value); setOriginalProjectFiles(null); setUploadedFile(null); setUploadedFileName(null);}}
          uploadedFile={uploadedFile}
          uploadedFileName={uploadedFileName || undefined}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          gitUrl={gitUrl}
          onGitUrlChange={setGitUrl}
          searchDepth={searchDepth}
          onSearchDepthChange={setSearchDepth}
          focusArea={focusArea}
          onFocusAreaChange={setFocusArea}
          onAnalyze={handleAnalyze}
          isLoading={isLoading || isRedefiningFocusArea}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusAreaProject}
        />

        {error && <ErrorDisplay
                    error={error}
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))}
                    context={`${t('error.errorDisplay.autofixContextPrefix' as TranslationKey)} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)}' ${currentModificationRequestAnalyze ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${currentModificationRequestAnalyze}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={handleToggleSuggestionSelection}
              onApplySelectedAndDownloadZip={handleApplySelectedAndDownloadZip}
              canApplyAndDownload={!!originalProjectFiles}
              chatHistory={chatHistoryAnalyze}
              currentModificationRequest={currentModificationRequestAnalyze}
              onCurrentModificationRequestChange={setCurrentModificationRequestAnalyze}
              onSendModificationRequest={handleSendModificationRequestAnalyze}
              isModifyingProject={isModifyingProjectAnalyze || isRedefiningModificationRequestAnalyze}
              isRedefiningModificationRequest={isRedefiningModificationRequestAnalyze}
              onRedefineModificationRequest={handleRedefineModificationRequestAnalyze}
              scrollAreaRefChat={scrollAreaRefChat}
              onSaveSnapshot={handleSaveAnalysisSnapshot}
            />
        )}
      </CardContent>
    </Card>
  );
}
