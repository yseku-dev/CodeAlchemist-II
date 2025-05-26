
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
import { fetchRemoteGitRepository, getApplicationSourceBundle } from '@/app/autoupdate/actions';

import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';

export type ProjectSourceType = "upload" | "git" | "local";

const textFileExtensions: string[] = [
  '.mq5', '.mqh', '.mq4', '.ex5', '.ex4', '.js', '.jsx', '.ts', '.tsx', '.py',
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.php', '.rb', '.rs',
  '.swift', '.kt', '.kts', '.lua', '.pl', '.dart', '.ex', '.exs', '.scala',
  '.clj', '.groovy', '.hs', '.erl', '.vb', '.xaml', '.r', '.html', '.htm',
  '.css', '.scss', '.less', '.vue', '.svelte', '.json', '.xml', '.yaml',
  '.yml', '.ini', '.cfg', '.toml', '.env', '.properties', '.conf', '.config',
  '.sh', '.bash', '.bat', '.ps1', '.sql', '.ddl', '.dml', '.graphql', '.md',
  '.txt', '.text', '.rtf', '.log', '.tex', '.rst', '.asciidoc', 'makefile',
  'dockerfile', '.dockerignore', 'gemfile', 'procfile', '.npmrc', '.editorconfig',
  '.csproj', '.sln', '.vbproj', '.vcproj', '.gradle', '.sbt', '.mod', '.tf',
  '.hcl', '.gitignore', '.gitattributes', '.gitmodules', '.glsl', '.hlsl',
  '.metal', '.wgsl', '.csv', '.tsv', '.ics', '.vcf',
];
const ignorePatternsSimple: string[] = [
  'node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/',
  '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local',
  '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/',
  'venv/', '.venv/',
];
const binaryExtensions: string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls',
  '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar',
  '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img',
  '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm',
];


/**
 * @fileOverview Page component for full project analysis.
 * Allows users to upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. Displays AI analysis results,
 * suggestions, and allows for interactive modification and snapshot saving.
 * Internationalized using useI18n.
 * This page has been refactored to use sub-components for its main UI sections.
 * It manages state related to LLM configuration, project source, analysis parameters,
 * results, and interactive modifications.
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  // States for LLM configuration and project source
  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useLocalStorage<ProjectSourceType>("codealchemist-ap-projectSourceType", "upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null); // File object cannot be directly stringified for localStorage
  const [uploadedFileName, setUploadedFileName] = useLocalStorage<string | null>('codealchemist-ap-uploadedFileName', null);
  const [gitUrl, setGitUrl] = useLocalStorage<string>('codealchemist-ap-gitUrl', '');
  const [originalProjectFiles, setOriginalProjectFiles] = useLocalStorage<AppSourceFile[] | null>('codealchemist-ap-originalProjectFiles', null);

  // States for analysis parameters
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');

  // States for analysis process and results
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);

  // States for post-analysis modification
  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false); // For focusArea in the main form
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false); // For modificationPrompt in results section

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const isLoading = isLoadingAnalysis || isProcessingModification || isRedefiningFocusArea || isRedefiningModificationPrompt;

  /**
   * Processes an uploaded ZIP file, extracting text-based files.
   * @param {File} file - The ZIP file to process.
   * @returns {Promise<{ files?: AppSourceFile[]; error?: string }>} Object containing extracted files or an error.
   */
  const _processUploadedZipForAnalysis = useCallback(async (file: File): Promise<{ files?: AppSourceFile[]; error?: string }> => {
    addDebugLog({ source: 'AnalizarProyectoPage:_processZip', type: 'INFO', message: `Procesando ZIP subido: ${file.name}` });
    try {
      const jszip = new JSZip();
      const zip = await jszip.loadAsync(file);
      const extractedFiles: AppSourceFile[] = [];
      const fileProcessingPromises: Promise<void>[] = [];

      zip.forEach((relativePath, fileEntry) => {
        const entryNameLower = fileEntry.name.toLowerCase();
        const isIgnored = ignorePatternsSimple.some(pattern => entryNameLower.includes(pattern.replace('**', '')));
        const extension = (entryNameLower.includes('.') ? '.' + entryNameLower.split('.').pop() : '');
        const isBinary = binaryExtensions.some(ext => entryNameLower.endsWith(ext));
        // Check if it's an allowed text file OR has no extension (and is not binary/ignored)
        const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.endsWith('/'));
        
        addDebugLog({ source: 'AnalizarProyectoPage:_processZip_Detail', type: 'DEBUG', message: `Revisando ZIP: ${relativePath}, EsDir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

        if (!fileEntry.dir && !isIgnored && isAllowedText) {
          fileProcessingPromises.push(
            fileEntry.async("string").then(content => {
              extractedFiles.push({ fileName: relativePath, content });
            }).catch(err => {
              addDebugLog({ source: 'AnalizarProyectoPage:_processZip_Detail', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}`});
            })
          );
        } else if (!fileEntry.dir) {
           addDebugLog({ source: 'AnalizarProyectoPage:_processZip_Detail', type: 'DEBUG', message: `Omitido del ZIP (directorio, ignorado, binario, o no texto): ${relativePath}` });
        }
      });

      await Promise.all(fileProcessingPromises);

      if (extractedFiles.length === 0) {
        const errorMsg = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, { fileName: file.name });
        addDebugLog({ source: 'AnalizarProyectoPage:_processZip', type: 'ERROR', message: errorMsg });
        return { error: errorMsg };
      }
      addDebugLog({ source: 'AnalizarProyectoPage:_processZip', type: 'INFO', message: `${extractedFiles.length} archivos de texto extraídos del ZIP.` });
      return { files: extractedFiles };
    } catch (zipError: any) {
      const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
      addDebugLog({ source: 'AnalizarProyectoPage:_processZip', type: 'ERROR', message: `Error procesando ZIP: ${zipError.message}`, errorDetails: zipError });
      return { error: errorMsg };
    }
  }, [t, addDebugLog]);

  /**
   * Fetches content from a remote Git repository using a Server Action.
   * @param {string} url - The URL of the Git repository.
   * @returns {Promise<{ files?: AppSourceFile[]; error?: string; }>} Object containing fetched files or an error.
   */
  const _fetchGitRepoForAnalysis = useCallback(async (url: string): Promise<{ files?: AppSourceFile[]; error?: string; }> => {
    addDebugLog({ source: 'AnalizarProyectoPage:_fetchGit', type: 'INFO', message: `Obteniendo de Git: ${url}` });
    const gitResult = await fetchRemoteGitRepository(url); // Server Action
    if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(log => addDebugLog({ source: 'SERVER_FETCH_GIT_AnalizarProyecto', type: 'INFO', message: log }));
    if (gitResult.success && gitResult.files) {
      return { files: gitResult.files };
    } else {
      return { error: gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey) };
    }
  }, [t, addDebugLog]);

  /**
   * Handles the change event when a user selects a file for upload.
   * Processes ZIP or JSON files, updating relevant states.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024; // 25MB

      setUploadedFile(file); // Store the file object
      setUploadedFileName(file.name); // Persist file name
      setError(null); // Clear previous errors
      setResult(null); // Clear previous analysis results
      setSuggestionsForUI([]);
      setModificationPrompt('');
      setOriginalProjectFiles(null); // Clear any previous project files

      if (isZip && isValidSize) {
        toast({ title: t('analyzeProject.toast.zipUpload.processing' as TranslationKey) });
        setIsLoadingAnalysis(true);
        setLoadingMessage(t('analyzeProject.toast.zipUpload.processing' as TranslationKey));
        const zipResult = await _processUploadedZipForAnalysis(file);
        if (zipResult.files && zipResult.files.length > 0) {
            setOriginalProjectFiles(zipResult.files);
            toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: zipResult.files.length })});
        } else {
            const errorMsg = zipResult.error || t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, { fileName: file.name});
            setError(errorMsg);
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: errorMsg });
            setUploadedFile(null); // Clear invalid file
            setUploadedFileName(null);
        }
        setIsLoadingAnalysis(false);
        setLoadingMessage(null);

      } else if (isJson && isValidSize) {
        // For JSON, assume it's a single content file for analysis, not a project structure
        // The content will be read in handleAnalyze if this source is chosen
        toast({ title: t('analyzeProject.toast.jsonProcessed.title' as TranslationKey), description: t('analyzeProject.toast.jsonProcessed.description' as TranslationKey, { name: file.name}) });
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        setUploadedFile(null);
        setUploadedFileName(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    }
  }, [setUploadedFile, setUploadedFileName, setOriginalProjectFiles, setError, setResult, setSuggestionsForUI, setModificationPrompt, toast, t, _processUploadedZipForAnalysis, setIsLoadingAnalysis, setLoadingMessage, addDebugLog]);

  /**
   * Core function to execute the AI analysis based on the selected source and parameters.
   * @param {AnalyzeCodeInput} analysisInputForFlow - The input object for the AI flow.
   * @param {AppSourceFile[] | null} sourceFilesForProcessing - Files used for analysis (if any).
   */
  const executeAnalysis = useCallback(async (analysisInputForFlow: AnalyzeCodeInput, sourceFilesForProcessing: AppSourceFile[] | null) => {
    const flowName = 'callAnalyzeSelfCode (AnalizarProyecto)';
    addDebugLog({
        source: 'AnalizarProyectoPage', type: 'INFO',
        message: `Iniciando análisis de proyecto. Input (contenido truncado): ${JSON.stringify({...analysisInputForFlow, projectContent: (analysisInputForFlow.projectContent || '').substring(0,200) + '...' })}. Config: ${JSON.stringify(llmConfigSource)}`,
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
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoadingAnalysis, setLoadingMessage, setError]);

  /**
   * Handles the initiation of the project analysis process.
   * Prepares input for the AI flow based on selected project source.
   */
  const handleAnalyze = useCallback(async () => {
    setIsLoadingAnalysis(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null); // Clear previous results
    setSuggestionsForUI([]);
    setModificationPrompt('');
    // Do not clear originalProjectFiles here if it was from a ZIP, allow modification attempts on it.
    // If source changes, handleFileChange or a useEffect on projectSourceType should clear it.

    let currentProjectFiles: AppSourceFile[] | null = originalProjectFiles; // Start with potentially existing files (from ZIP upload)
    let projectContentStringForAI: string | undefined;
    let sourceCodeLocationForAI: AnalyzeCodeInput['sourceCodeLocation'] = "UploadedString"; // Default
    let sourceNameForAI = uploadedFileName || "archivo_subido";


    if (projectSourceType === "upload") {
      if (uploadedFile && !currentProjectFiles) { // File selected but not yet processed by handleFileChange or re-selecting
        if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
          toast({ title: t('analyzeProject.toast.zipUpload.processing' as TranslationKey) });
          const zipResult = await _processUploadedZipForAnalysis(uploadedFile);
          if (zipResult.error) {
            setError(zipResult.error);
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: zipResult.error });
            setIsLoadingAnalysis(false); setLoadingMessage(null); return;
          }
          currentProjectFiles = zipResult.files || null;
          setOriginalProjectFiles(currentProjectFiles); // Store for modification
        } else if (uploadedFile.name.toLowerCase().endsWith('.json')) {
           const jsonContent = await uploadedFile.text();
           currentProjectFiles = [{ fileName: uploadedFile.name, content: jsonContent }];
           setOriginalProjectFiles(currentProjectFiles);
        } else {
           const textContent = await uploadedFile.text();
           currentProjectFiles = [{ fileName: uploadedFile.name, content: textContent }];
           setOriginalProjectFiles(currentProjectFiles);
        }
        sourceNameForAI = uploadedFile.name;
      } else if (!currentProjectFiles) { // No uploaded file and no pre-processed files
        setError(t('analyzeProject.toast.sourceRequired.description' as TranslationKey));
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: t('analyzeProject.toast.sourceRequired.description' as TranslationKey) });
        setIsLoadingAnalysis(false); setLoadingMessage(null); return;
      }
    } else if (projectSourceType === "git" && gitUrl) {
      toast({ title: t('analyzeProject.toast.fetchingGit' as TranslationKey) });
      const gitFetchResult = await _fetchGitRepoForAnalysis(gitUrl);
      if (gitFetchResult.error) {
          setError(gitFetchResult.error);
          toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title' as TranslationKey), description: gitFetchResult.error });
          setIsLoadingAnalysis(false); setLoadingMessage(null); return;
      }
      currentProjectFiles = gitFetchResult.files || null;
      setOriginalProjectFiles(currentProjectFiles); // Store for modification
      sourceCodeLocationForAI = "Git";
      sourceNameForAI = gitUrl;
    } else if (projectSourceType === "local") {
      toast({ title: t('analyzeProject.toast.gettingLocalSource.title' as TranslationKey) });
      const bundleResult = await getApplicationSourceBundle(false); // Server Action
      if (bundleResult.logsBuilt) addDebugLog({ source: 'SERVER_GET_BUNDLE_AnalizarProyecto', type: 'INFO_BATCH', message: 'Logs del servidor al obtener bundle local:', data: bundleResult.logsBuilt});
      if (!bundleResult.success || !bundleResult.files) {
        const errorMsg = bundleResult.error || t('analyzeProject.toast.localSourceError.description' as TranslationKey, {error: 'Error desconocido'});
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.localSourceError.title' as TranslationKey), description: errorMsg });
        setIsLoadingAnalysis(false); setLoadingMessage(null); return;
      }
      currentProjectFiles = bundleResult.files;
      setOriginalProjectFiles(currentProjectFiles); // Store for modification
      sourceCodeLocationForAI = "Local";
      sourceNameForAI = t('analyzeProject.sourceLocal' as TranslationKey);
    } else {
      setError(t('analyzeProject.toast.sourceRequired.description' as TranslationKey));
      toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: t('analyzeProject.toast.sourceRequired.description' as TranslationKey) });
      setIsLoadingAnalysis(false); setLoadingMessage(null); return;
    }

    if (currentProjectFiles && currentProjectFiles.length > 0) {
      projectContentStringForAI = currentProjectFiles
        .map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`)
        .join('\n\n');
    } else {
      setError(t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey));
      toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title' as TranslationKey), description: t('analyzeProject.toast.noContentToAnalyze.description' as TranslationKey) });
      setIsLoadingAnalysis(false); setLoadingMessage(null); return;
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
        projectContent: projectContentStringForAI,
        sourceCodeLocation: sourceCodeLocationForAI,
        gitRepoUrl: projectSourceType === 'git' ? gitUrl : undefined,
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    await executeAnalysis(analysisInputForFlow, currentProjectFiles);

  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource, originalProjectFiles, uploadedFileName,
      getAgentById, getGroupById, executeAnalysis, t, toast, addDebugLog, setOriginalProjectFiles,
      _processUploadedZipForAnalysis, _fetchGitRepoForAnalysis,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoadingAnalysis, setModificationPrompt,
  ]);

  /**
   * Handles the user's request to modify the currently analyzed project.
   * Invokes an AI flow to process the modification.
   */
  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) { // Crucial: Modification needs base files
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles. Fuente:', data: { projectSourceType } });
        return;
    }

    setIsProcessingModification(true);
    setError(null); // Clear previous errors
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
    
    // Construct ProjectGenerationResult from originalProjectFiles and current result notes/title
    const filesForModificationFlow = (originalProjectFiles || []).map(f => ({
        path: f.fileName, // Map fileName to path
        content: f.content,
        isFolder: f.fileName.endsWith('/'), // Basic inference
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
         // Update originalProjectFiles with the modified files from AI
         setOriginalProjectFiles(modifiedProjectResult.files.map(f => ({ fileName: f.path, content: f.content ?? '' })));
         // Update the main result's notes to reflect the AI's notes on modification
         setResult(prevResult => {
             const baseResult = prevResult || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' };
             return {
                 ...baseResult,
                 analysisTitle: modifiedProjectResult.projectName || baseResult.analysisTitle,
                 generalAssessment: modifiedProjectResult.aiNotes || baseResult.generalAssessment,
                 // Keep existing suggestions, or potentially re-analyze if structure changed significantly (complex)
             };
         });

         toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey) });
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
         setModificationPrompt(''); // Clear input after successful modification
      } else {
        throw new AppError(t('analyzeProject.toast.modificationError.invalidResponse' as TranslationKey), {originalError: "La IA no devolvió una estructura de archivos válida."});
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg); // Display this error
      setResult(prev => ({...(prev || { analysisTitle: '', identifiedAreas: [], detailedSuggestions: [], generalAssessment: '' }), generalAssessment: `${(prev || {generalAssessment:''}).generalAssessment || ''}\n\n[ERROR DE MODIFICACIÓN]: ${errorMsg}`})); 
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, setError, setIsProcessingModification, uploadedFileName, projectSourceType]);

  /**
   * Handles downloading the current project state (potentially modified) as a ZIP file.
   * Applies selected checkbox suggestions before zipping.
   */
  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) { // Guard against no base files
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoadingAnalysis(true); // Use existing loading state for simplicity or create a new one
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))]; // Operate on a copy
      const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));

      // Apply checkbox-selected suggestions
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
      setIsLoadingAnalysis(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoadingAnalysis, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType ]);

  /**
   * Applies selected checkbox suggestions to the `originalProjectFiles` state in memory.
   */
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

    let updatedFilesData = [...originalProjectFiles.map(f => ({...f}))]; // Operate on a copy
    const filesMap = new Map<string, string>(updatedFilesData.map(f => [f.fileName, f.content]));

    applicableSuggestions.forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area}` });
        }
    });
    updatedFilesData = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));
    setOriginalProjectFiles(updatedFilesData); // Update the main state
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title' as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description' as TranslationKey) });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles ]);


  /**
   * Handles redefining the focus area input using AI.
   */
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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'as TranslationKey));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  /**
   * Handles redefining the modification prompt input using AI.
   */
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
      setError(errorMsg); // Set page-level error
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  };

  /**
   * Saves the current analysis result and potentially modified project files as a snapshot.
   */
  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result && !originalProjectFiles) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, {section: t('sidebar.analyzeProject' as TranslationKey)})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || uploadedFileName || "Analisis").substring(0,30), time: new Date().toLocaleTimeString() });

    const dataToSave = {
        analysisResult: result, // The original AnalyzeCodeOutput
        currentOriginalFiles: originalProjectFiles || undefined, // The AppSourceFile[] which might have been modified
        suggestionsWithSelection: suggestionsForUI, // To remember which suggestions were selected
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
      source: 'project-analysis', // New source type
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

  /**
   * Handles auto-fixing errors by invoking the 'EquipoDesarrolloSoftware' group.
   * @param {string} errorToFix - The error message to be fixed.
   */
  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    // Construct context for the AI based on current page state
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
      // No direct state update here for the modal, ErrorDisplay is self-contained for that.
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
            setProjectSourceType(value as ProjectSourceType);
            // Reset states when source type changes to avoid inconsistencies
            setUploadedFile(null);
            setUploadedFileName(null);
            setGitUrl(value === 'git' ? gitUrl : ''); // Keep gitUrl if switching back to git
            setOriginalProjectFiles(null); // Crucial: clear files if source fundamentally changes
            setResult(null);
            setSuggestionsForUI([]);
            setModificationPrompt('');
            setError(null);
          }}
          uploadedFile={uploadedFile}
          uploadedFileName={uploadedFileName}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          gitUrl={gitUrl}
          onGitUrlChange={setGitUrl}
          searchDepth={searchDepth}
          onSearchDepthChange={setSearchDepth}
          focusArea={focusArea}
          onFocusAreaChange={setFocusArea}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusArea}
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
            />
        )}
      </CardContent>
    </Card>
  );
}
