
// src/app/analizar-proyecto/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ProjectGenerationResult,
  RedefinePromptOutput,
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callChatWithAgentOrGlobal,
  callModifyProjectStructure,
} from '@/utils/apiClient';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions'; // Assuming this exists and is correct
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_AGENTS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';

type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration source, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
 * It also includes an interactive section to suggest modifications to the analyzed project
 * (if files are available) and options to save snapshots and download a modified ZIP.
 * All UI texts are internationalized.
 * @module AnalizarProyectoPage
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

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

  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);

  const scrollAreaRefChat = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/'];
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm', '.zip', '.tgz'];

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [modificationPrompt]); // Assuming chat history was here and now it's modificationPrompt that triggers scroll

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024; // 25MB limit

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        setError(null); // Clear previous errors
        setOriginalProjectFiles(null); // Clear previous project files
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Project file selected: ${file.name}` });

        if (isZip) {
          setLoadingMessage(t('analyzeProject.toast.processingFile' as TranslationKey));
          toast({ title: t('analyzeProject.toast.processingFile' as TranslationKey) });
          try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const extractedFiles: AppSourceFile[] = [];
            const fileProcessingPromises: Promise<void>[] = [];
            
            const textFileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.php', '.rb', '.md', '.txt', '.xml', '.yaml', '.yml', '.env', '.ini', '.cfg', '.sh', '.bat', '.sql', '.graphql', '.tf', '.hcl', '.text', '.properties', '.log', '.gitignore', 'dockerfile', '.dockerignore', '.npmrc', '.editorconfig', '.prettierrc', '.eslintrc', 'gemfile', 'procfile', 'makefile', '.mod'];

            zip.forEach((relativePath, fileEntry) => {
              if (!fileEntry.dir &&
                  !ignorePatternsSimple.some(pattern => relativePath.toLowerCase().startsWith(pattern)) &&
                  !binaryExtensions.some(ext => relativePath.toLowerCase().endsWith(ext)) &&
                  (textFileExtensions.some(ext => relativePath.toLowerCase().endsWith(ext)) || !relativePath.includes('.'))
              ) {
                fileProcessingPromises.push(
                  fileEntry.async("string").then(content => {
                    extractedFiles.push({ fileName: relativePath, content });
                  }).catch(err => {
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Could not read file ${relativePath} from ZIP: ${(err as Error).message}`});
                  })
                );
              } else if (!fileEntry.dir) {
                  addDebugLog({source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Skipping file in ZIP: ${relativePath} (binary, ignored, or directory-like entry)`});
              }
            });
            await Promise.all(fileProcessingPromises);

            if (extractedFiles.length === 0) {
              const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, {fileName: file.name });
              setError(noFilesError);
              setOriginalProjectFiles(null);
              toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: noFilesError });
            } else {
              setOriginalProjectFiles(extractedFiles);
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Extracted ${extractedFiles.length} files from ZIP for analysis.`});
              toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: extractedFiles.length})});
            }
          } catch (zipError: any) {
            const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: errorMsg});
            setError(errorMsg);
            setOriginalProjectFiles(null);
          } finally {
            setLoadingMessage(null);
          }
        } else if (isJson) {
           addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `JSON file ${file.name} selected. Its content will be passed for analysis.`});
           // For JSON, we don't populate originalProjectFiles as it's not a file structure for modification in the same way.
        }
      } else {
        const errorMsgKey = 'analyzeProject.toast.invalidFile.description' as TranslationKey;
        const errorMsg = t(errorMsgKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null); setOriginalProjectFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  }, [t, toast, addDebugLog, setOriginalProjectFiles, setUploadedFileName, setLoadingMessage, setError, ignorePatternsSimple, binaryExtensions]);


  const executeAnalysis = useCallback(async (analysisInput: AnalyzeCodeInput ) => {
    const flowName = 'analyzeProject (callAnalyzeSelfCode)';
    addDebugLog({
        source: 'AnalizarProyectoPage', type: 'INFO',
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
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoading, setLoadingMessage, setError]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask;
    }

    let analysisInputBase: Omit<AnalyzeCodeInput, 'sourceCodeLocation' | 'projectContent' | 'gitRepoUrl'> = {
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined, 
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    if (projectSourceType === "upload" && uploadedFile) {
      addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Processing uploaded file for analysis: ${uploadedFile.name}`});
      if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
        if (originalProjectFiles && originalProjectFiles.length > 0) {
          const projectContentString = originalProjectFiles.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentString, sourceCodeLocation: "UploadedString" };
          await executeAnalysis(analysisInput);
        } else { // This case might happen if handleFileChange had an issue populating originalProjectFiles for ZIP
          const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, {fileName: uploadedFile.name });
          setError(noFilesError); setIsLoading(false); setLoadingMessage(null); 
          addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: 'Analysis aborted: originalProjectFiles not populated from ZIP.'});
          return;
        }
      } else if (uploadedFile.name.toLowerCase().endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const projectContent = e.target?.result as string;
            const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContent, sourceCodeLocation: "UploadedString" };
            await executeAnalysis(analysisInput);
        };
        reader.readAsText(uploadedFile);
      } else {
          setError(t('analyzeProject.toast.unsupportedFileType.description' as TranslationKey)); setIsLoading(false); setLoadingMessage(null);
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit' as TranslationKey));
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        addServerLogsToDebugAndPage(gitResult.logsBuilt, 'SERVER_FETCH_GIT_REPO');
        if (gitResult.success && gitResult.files) {
          setOriginalProjectFiles(gitResult.files); 
          const projectContentString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, gitRepoUrl: gitUrl, projectContent: projectContentString, sourceCodeLocation: "Git" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        setError(gitError.message || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey)); setIsLoading(false); setLoadingMessage(null);
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Git fetch error: ${gitError.message}`, errorDetails: gitError});
      }
    } else {
      setError(t('analyzeProject.toast.sourceRequired.description' as TranslationKey)); setIsLoading(false); setLoadingMessage(null);
    }
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, originalProjectFiles, setOriginalProjectFiles,
      setIsLoading, setLoadingMessage, setError, addDebugLog, uploadedFileName
  ]);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_ANALYZE_PROJECT') => {
    if (serverLogs) {
      setDetailedLogs(prev => [...prev, ...serverLogs]); 
      if (typeof window !== 'undefined') { 
          serverLogs.forEach(logMsg => addDebugLog({ source: sourcePrefix, type: 'INFO', message: logMsg }));
      }
    }
  }, [addDebugLog]);


  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix' as TranslationKey)} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)}' ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`;
    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
    // La lógica real de llamar a callAutoFixErrorWithGroup está en el componente ErrorDisplay
  }, [t, focusArea, projectSourceType, gitUrl, uploadedFileName, modificationPrompt, addDebugLog, toast]);

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
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: "Intento de modificación sin originalProjectFiles." });
      return;
    }
    
    setIsProcessingModification(true);
    setError(null);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Enviando petición de modificación de proyecto: ${modificationPrompt}`, data: { currentAnalysisTitle: result?.analysisTitle } });

    const tempModificationPrompt = modificationPrompt;
    // setModificationPrompt(''); // Do not clear immediately, clear on success

    let agentSystemPromptForModification: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForModification = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
        agentSystemPromptForModification = orchestrator?.systemPrompt || group?.mainTask;
    } else { // Global settings
        agentSystemPromptForModification = t('analyzeProject.results.defaultChatContextSystemPrompt' as TranslationKey);
    }


    const currentProjectStateForModification: ProjectGenerationResult = {
      projectName: result?.analysisTitle || t('analyzeProject.results.modifiedProjectNameFallback' as TranslationKey),
      aiNotes: result?.generalAssessment || "",
      files: originalProjectFiles, 
    };

    try {
      const modifiedProjectResult = await callModifyProjectStructure({
          currentProject: currentProjectStateForModification,
          modificationRequest: tempModificationPrompt,
          agentSystemPrompt: agentSystemPromptForModification,
      });
      
      setOriginalProjectFiles(modifiedProjectResult.files); 
      setResult(prevResult => ({
          ...prevResult!, // We assume result exists if we are modifying
          aiNotes: modifiedProjectResult.aiNotes, 
          generalAssessment: prevResult?.generalAssessment + `\n\n--- ${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey)} (${new Date().toLocaleTimeString()}) ---\n${t('common.userLabel')}: ${tempModificationPrompt}\n${t('common.assistantLabel')}: ${modifiedProjectResult.aiNotes}`, // Append to generalAssessment
      }));
      setModificationPrompt(''); // Clear on success
      toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey), description: t('analyzeProject.toast.modificationSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotes: modifiedProjectResult.aiNotes, newFilesCount: modifiedProjectResult.files.length }});
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      setResult(prevResult => ({
          ...prevResult!,
          aiNotes: prevResult?.aiNotes + `\n\n--- ${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey)} (${new Date().toLocaleTimeString()}) ---\n${t('common.userLabel')}: ${tempModificationPrompt}\n${t('common.assistantLabel')} (ERROR): ${errorMsg}`,
      }));
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: "Modificación de proyecto fallida en UI", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    }
    setIsProcessingModification(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, setIsProcessingModification, setError]);


  const handleRedefineModificationPrompt = async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningModificationPrompt(true);
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: modificationPrompt });
      setModificationPrompt(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
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
    
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || "Sin Titulo").substring(0,30), time: new Date().toLocaleTimeString() });

    const snapshotDataToSave: Partial<AnalyzeCodeOutput> & { 
      currentOriginalFiles?: AppSourceFile[],
      selectedSuggestionsInfo?: {area: string, suggestion: string, priority: string}[],
    } = {
      ...(result || {}), 
      detailedSuggestions: suggestionsForUI.map(s => ({ 
          area: s.area,
          suggestion: s.suggestion,
          priority: s.priority,
          suggestedContent: s.suggestedContent,
          suggestedPromptForImplementation: s.suggestedPromptForImplementation,
      })),
      currentOriginalFiles: originalProjectFiles || undefined,
      selectedSuggestionsInfo: suggestionsForUI.filter(s => s.isSelected).map(s=> ({area:s.area, suggestion:s.suggestion, priority:s.priority})),
    };
    const snapshotJsonString = JSON.stringify(snapshotDataToSave, null, 2);
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
        analysisTitle: result?.analysisTitle || "Análisis de Proyecto", 
        sourceWasGit: projectSourceType === 'git' && !!gitUrl, 
        originalFileName: uploadedFileName,
      }
    });
  }, [result, suggestionsForUI, originalProjectFiles, projectSourceType, gitUrl, uploadedFileName, addSnapshot, t, toast]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s)
    );
  }, [setSuggestionsForUI]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey)});
      return;
    }
    const selectedAndApplicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent);
    
    setIsLoading(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))]; 

      if (selectedAndApplicableSuggestions.length > 0) {
        const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));
        selectedAndApplicableSuggestions.forEach(suggestion => {
          if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
          }
        });
        filesToZip = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));
      }

      const zip = new JSZip();
      filesToZip.forEach(file => {
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
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoading, setLoadingMessage]);

  const [detailedLogs, setDetailedLogs] = useLocalStorage<string[]>('codealchemist-ap-detailedLogs', []);


  return (
    <Card className="max-w-4xl mx-auto">
      <AnalyzeProjectHeader />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType}
          onProjectSourceTypeChange={(value) => { 
            setProjectSourceType(value); 
            setOriginalProjectFiles(null); 
            setUploadedFile(null); 
            setUploadedFileName(null);
            if (value === 'upload') setGitUrl('');
          }}
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
                    context={`${t('analyzeProject.results.modificationContextPrefix' as TranslationKey)} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)}' ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={handleToggleSuggestionSelection}
              onDownloadProjectZip={handleDownloadProjectZip} 
              canApplyAndDownload={!!originalProjectFiles} 
              modificationPrompt={modificationPrompt}
              onModificationPromptChange={setModificationPrompt}
              onProcessModification={handleProcessModification}
              isProcessingModification={isProcessingModification || isRedefiningModificationPrompt}
              isRedefiningModificationPrompt={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineModificationPrompt}
              onSaveSnapshot={handleSaveAnalysisSnapshot}
              scrollAreaRefChat={scrollAreaRefChat}
            />
        )}
         {detailedLogs.length > 0 && (
          <ErrorDisplay error={detailedLogs.join('\n')} />
        )}
      </CardContent>
    </Card>
  );
}
