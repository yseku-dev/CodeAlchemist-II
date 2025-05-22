
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
  CodeSnapshot,
  AnalyzeCodeInput,
  ProjectGenerationResult,
  RedefinePromptOutput,
  ChatMessage, // Make sure ChatMessage is imported
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callChatWithAgentOrGlobal, // For consultation on ZIP source
  callModifyProjectStructure, // For Git source modifications
} from '@/utils/apiClient';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import JSZip from 'jszip';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_AGENTS } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card'; // Added Card and CardContent
import { Loader2 } from 'lucide-react'; // For loading states

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
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
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

  // Define ignorePatterns and binaryExtensions locally or import if they become shared
  const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/'];
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm', '.zip', '.tgz'];


  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024;

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        setError(null);
        setOriginalProjectFiles(null); // Clear previous project files from state
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Project file selected: ${file.name}` });

        if (isZip) {
          setLoadingMessage(t('analyzeProject.toast.processingFile'));
          toast({ title: t('analyzeProject.toast.processingFile') });
          try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const extractedFiles: AppSourceFile[] = [];
            const fileProcessingPromises: Promise<void>[] = [];
            
            // More comprehensive list of text-based extensions
            const textFileExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.php', '.rb', '.md', '.txt', '.xml', '.yaml', '.yml', '.env', '.ini', '.cfg', '.sh', '.bat', '.sql', '.graphql', '.tf', '.hcl', '.text', '.properties', '.log', '.gitignore', 'dockerfile', '.dockerignore', '.npmrc', '.editorconfig', 'gemfile', 'procfile', 'makefile', '.mod', '.rs', '.swift', '.kt', '.kts', '.gradle', '.csproj', '.sln', '.vb', '.xaml', '.lua', '.pl', '.r', '.dart', '.ex', '.exs', '.toml', '.vue'];

            zip.forEach((relativePath, fileEntry) => {
              const isIgnored = ignorePatternsSimple.some(pattern => relativePath.toLowerCase().startsWith(pattern.replace('**', '')));
              const isBinary = binaryExtensions.some(ext => relativePath.toLowerCase().endsWith(ext));
              const isAllowedText = textFileExtensions.some(ext => relativePath.toLowerCase().endsWith(ext)) || !relativePath.includes('.');


              if (!fileEntry.dir && !isIgnored && !isBinary && isAllowedText) {
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
              const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles', {fileName: file.name });
              setError(noFilesError);
              setOriginalProjectFiles(null);
              toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: noFilesError });
            } else {
              setOriginalProjectFiles(extractedFiles);
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Extracted ${extractedFiles.length} files from ZIP for analysis.`});
              toast({ title: t('analyzeProject.toast.zipProcessed.title'), description: t('analyzeProject.toast.zipProcessed.description', { count: extractedFiles.length })});
            }
          } catch (zipError: any) {
            const errorMsg = t('analyzeProject.toast.zipReadError.description', { error: zipError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: errorMsg});
            setError(errorMsg);
            setOriginalProjectFiles(null);
          } finally {
            setLoadingMessage(null);
          }
        } else if (isJson) {
           addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `JSON file ${file.name} selected. Its content will be passed for analysis.`});
           // For JSON, we don't populate originalProjectFiles directly from here, 
           // as analyzeSelfCodeFlow expects a string. Modification logic will be disabled.
           setOriginalProjectFiles(null); // Explicitly set to null for JSON
        }
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description');
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title'), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null); setOriginalProjectFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
         finalResult.groupLog = t('analyzeProject.results.groupContextLog', {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInput.focusArea || t('autoupdate.analysis.general')),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalyzeProject)'
        });
      }

      setResult(finalResult);
      setSuggestionsForUI((finalResult.detailedSuggestions || []).map((s, idx) => ({ ...s, id: `suggestion-ap-${idx}-${Date.now()}`, isSelected: false })));
      toast({ title: t('analyzeProject.toast.analysisComplete.title'), description: t('analyzeProject.toast.analysisComplete.description') });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: "Project analysis successful.", data: {title: finalResult.analysisTitle, suggestions: (finalResult.detailedSuggestions || []).length}, flowName});
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Project analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
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
      setIsLoading(false);
      setLoadingMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing'));
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

    if (projectSourceType === "upload") {
      if (uploadedFile) {
        addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Processing uploaded file for analysis: ${uploadedFile.name}`});
        if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
          if (originalProjectFiles && originalProjectFiles.length > 0) {
            const projectContentString = originalProjectFiles.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
            const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentString, sourceCodeLocation: "UploadedString" };
            await executeAnalysis(analysisInput);
          } else {
            const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles', {fileName: uploadedFile.name });
            setError(noFilesError); setIsLoading(false); setLoadingMessage(null); 
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: noFilesError});
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
            setError(t('analyzeProject.toast.unsupportedFileType.description')); setIsLoading(false); setLoadingMessage(null);
            toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title'), description: t('analyzeProject.toast.unsupportedFileType.description')});
        }
      } else {
         setError(t('analyzeProject.toast.sourceRequired.description')); setIsLoading(false); setLoadingMessage(null);
         toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: t('analyzeProject.toast.sourceRequired.description')});
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit'));
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_FETCH_GIT_REPO', type: 'INFO', message: logMsg }));
        
        if (gitResult.success && gitResult.files) {
          setOriginalProjectFiles(gitResult.files); 
          const projectContentString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, gitRepoUrl: gitUrl, projectContent: projectContentString, sourceCodeLocation: "Git" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown'));
        }
      } catch (gitError: any) {
        const errorMsg = gitError.message || t('analyzeProject.toast.gitFetchError.unknown');
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title'), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Git fetch error: ${errorMsg}`, errorDetails: gitError});
      }
    } else {
      setError(t('analyzeProject.toast.sourceRequired.description')); setIsLoading(false); setLoadingMessage(null);
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: t('analyzeProject.toast.sourceRequired.description')});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, originalProjectFiles, // originalProjectFiles is now dependency for logic
      setIsLoading, setLoadingMessage, setError, addDebugLog, setOriginalProjectFiles, // Include setters if logic inside useCallback changes them
      uploadedFileName // Include if logic inside depends on it
  ]);

  const addServerLogsToDebugAndPage = useCallback((serverLogs: string[] | undefined, sourcePrefix: string = 'SERVER_ANALYZE_PROJECT') => {
    if (serverLogs && typeof window !== 'undefined') {
      serverLogs.forEach(logMsg => addDebugLog({ source: sourcePrefix, type: 'INFO', message: logMsg }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix')} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback')}' ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel')}: "${modificationPrompt}"` : '' }`;
    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing'),
      description: t('error.errorDisplay.toast.autofixAttempt.description')
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, focusArea, projectSourceType, gitUrl, uploadedFileName, modificationPrompt, addDebugLog, toast]);

  const handleRedefineFocusAreaProject = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningFocusArea(true);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefining focus area. Original (start): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.emptyModificationRequest') });
      return;
    }
    
    setIsProcessingModification(true);
    setError(null);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Enviando petición de modificación de proyecto: ${modificationPrompt}`, data: { currentAnalysisTitle: result?.analysisTitle } });

    const tempModificationPrompt = modificationPrompt;
    
    let agentSystemPromptForModification: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForModification = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
        agentSystemPromptForModification = orchestrator?.systemPrompt || group?.mainTask;
    } else { 
        agentSystemPromptForModification = t('analyzeProject.results.defaultChatContextSystemPrompt');
    }

    if (!originalProjectFiles) {
      // If originalProjectFiles is null, it means source was not Git, or ZIP processing failed.
      // In this case, we treat the modification request as a consultation on the analysis.
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: "No originalProjectFiles found, treating modification as consultation on analysis."});
      try {
        const contextForConsultation = `${t('analyzeProject.results.modificationContextPrefix')}
Análisis Actual (Resumen): ${result?.generalAssessment?.substring(0,500)}...
Áreas Identificadas: ${result?.identifiedAreas?.join(', ')}
Pregunta/Modificación del Usuario: ${tempModificationPrompt}`;

        const consultationResult = await callChatWithAgentOrGlobal({
          userMessage: contextForConsultation,
          agentSystemPrompt: agentSystemPromptForModification,
        });
        
        setResult(prevResult => ({
          ...prevResult!,
          aiNotes: `${prevResult?.aiNotes || ''}\n\n--- ${t('analyzeProject.results.chatInteractionLogPrefix')} (${new Date().toLocaleTimeString()}) ---\n${t('common.userLabel')}: ${tempModificationPrompt}\n${t('common.assistantLabel')}: ${consultationResult.aiResponse}`,
        }));
        toast({ title: t('analyzeProject.toast.modificationConsultationSuccess.title'), description: t('analyzeProject.toast.modificationConsultationSuccess.description') });
        setModificationPrompt('');
      } catch (e: any) {
        const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description'));
        setError(errorMsg); 
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: errorMsg });
         if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
      } finally {
        setIsProcessingModification(false);
      }
      return;
    }

    // If originalProjectFiles exists, proceed with structure modification
    const currentProjectStateForModification: ProjectGenerationResult = {
      projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName', {name: 'Modificado', time: ''}).split(' - ')[2],
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
          ...prevResult!,
          aiNotes: `${prevResult?.aiNotes || ''}\n\n--- ${t('analyzeProject.results.chatInteractionLogPrefix')} (${new Date().toLocaleTimeString()}) ---\n${t('common.userLabel')}: ${tempModificationPrompt}\n${t('common.assistantLabel')}: ${modifiedProjectResult.aiNotes}`,
      }));
      setModificationPrompt('');
      toast({ title: t('analyzeProject.toast.modificationSuccess.title'), description: t('analyzeProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotes: modifiedProjectResult.aiNotes, newFilesCount: modifiedProjectResult.files.length }});
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description'));
      setError(errorMsg); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: errorMsg });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    }
    setIsProcessingModification(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, setIsProcessingModification, setError, uploadedFileName, settings.language]);


  const handleRedefineModificationPrompt = async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningModificationPrompt(true);
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: modificationPrompt });
      setModificationPrompt(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('versions.toast.snapshotSaveError.noContent', {section: t('sidebar.analyzeProject')})});
      return;
    }
    
    const snapshotName = t('analyzeProject.results.snapshotName', { name: (result?.analysisTitle || "Sin Titulo").substring(0,30), time: new Date().toLocaleTimeString() });

    const snapshotDataToSave = {
      analysisResult: result, 
      currentOriginalFiles: originalProjectFiles || undefined, // Include modified files if available
      selectedSuggestionsInfo: suggestionsForUI.filter(s => s.isSelected).map(s=> ({area:s.area, suggestion:s.suggestion, priority:s.priority})),
    };
    const snapshotJsonString = JSON.stringify(snapshotDataToSave, null, 2);
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
        analysisTitle: result?.analysisTitle || "Análisis de Proyecto", 
        sourceWasGit: projectSourceType === 'git' && !!gitUrl, 
        originalFileName: uploadedFileName,
      }
    });
    // Toast for success is handled by addSnapshot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, suggestionsForUI, originalProjectFiles, projectSourceType, gitUrl, uploadedFileName, addSnapshot, t, toast]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, isSelected: !s.isSelected } : s)
    );
  }, [setSuggestionsForUI]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title'), description: t('analyzeProject.toast.downloadError.noBaseFiles')});
      return;
    }
    const selectedAndApplicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent);
    
    setIsLoading(true); // Re-use isLoading for download processing
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping'));
    toast({ title: t('analyzeProject.toast.applyingAndZipping') });

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

      const zipFileName = t('analyzeProject.downloads.zipFilename', {projectName: (result?.analysisTitle || 'proyecto_analizado').replace(/\s+/g, '_').substring(0,30)});

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
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown');
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title'), description: errorMsg });
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoading, setLoadingMessage]);

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
            if (value === 'upload') setGitUrl(''); else setUploadedFileName(null);
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
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))}
                    context={`${t('analyzeProject.results.modificationContextPrefix')} Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback')}' ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel')}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing')}</p></div>}

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
      </CardContent>
    </Card>
  );
}
