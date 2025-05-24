
// src/app/analizar-proyecto/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppState } from '@/context/AppStateContext';
import type {
  LLMConfigSourceOption,
  AnalyzeCodeOutput,
  Agent,
  AIAgentGroup,
  DetailedSuggestionForUI,
  AppSourceFile,
  ProjectGenerationResult,
  ModifyProjectStructureInput,
  ChatMessage,
  CodeSnapshot,
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callChatWithAgentOrGlobal,
  callModifyProjectStructure,
  callAutoFixErrorWithGroup
} from '@/utils/apiClient';
import { getApplicationSourceBundle, fetchRemoteGitRepository } from '@/app/autoupdate/actions';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import JSZip from 'jszip';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_AGENTS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type ProjectSourceType = "upload" | "git" | "local";

const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/', 'venv/', '.venv/'];
const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm', '.zip', '.tgz'];

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. They can select an LLM configuration source,
 * and specify analysis parameters. The component then displays the AI's overall assessment,
 * identified areas, and specific suggestions. It includes an interactive section to suggest
 * modifications to the analyzed project files (if available from Git or processed ZIP/local source)
 * and options to save snapshots and download a modified ZIP.
 * All UI texts are internationalized. State is persisted to localStorage.
 * @module AnalizarProyectoPage
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot, settings } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-ap-llmConfigSource', { type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useLocalStorage<ProjectSourceType>("codealchemist-ap-projectSourceType", "upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useLocalStorage<string | null>('codealchemist-ap-uploadedFileName', null);
  const [originalProjectFiles, setOriginalProjectFiles] = useLocalStorage<AppSourceFile[] | null>('codealchemist-ap-originalProjectFiles', null);

  const [gitUrl, setGitUrl] = useLocalStorage<string>('codealchemist-ap-gitUrl', '');
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-ap-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-ap-focusArea', '');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useLocalStorage<AnalyzeCodeOutput | null>('codealchemist-ap-result', null);
  const [suggestionsForUI, setSuggestionsForUI] = useLocalStorage<DetailedSuggestionForUI[]>('codealchemist-ap-suggestionsForUI', []);

  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-ap-modificationPrompt', '');
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const textFileExtensions = [
    '.mq5', '.mqh', '.mq4', '.ex5', '.ex4',
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.php', '.rb', '.rs', '.swift', '.kt', '.kts', '.lua', '.pl', '.dart', '.ex', '.exs', '.scala', '.clj', '.groovy', '.hs', '.erl', '.vb', '.xaml', '.r',
    '.html', '.htm', '.css', '.scss', '.less', '.vue', '.svelte',
    '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.toml', '.env', '.properties', '.conf', '.config',
    '.sh', '.bash', '.bat', '.ps1',
    '.sql', '.ddl', '.dml', '.graphql',
    '.md', '.txt', '.text', '.rtf', '.log', '.tex', '.rst', '.asciidoc',
    'makefile', 'dockerfile', '.dockerignore', 'gemfile', 'procfile', '.npmrc', '.editorconfig',
    '.csproj', '.sln', '.vbproj', '.vcproj', '.gradle', '.sbt', '.mod', '.tf', '.hcl',
    '.gitignore', '.gitattributes', '.gitmodules',
    '.glsl', '.hlsl', '.metal', '.wgsl',
    '.csv', '.tsv', '.ics', '.vcf',
  ];

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024;

      addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Archivo seleccionado: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size} bytes` });
      setError(null);
      setOriginalProjectFiles(null);
      setUploadedFileName(null);

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo ${isZip ? 'ZIP' : 'JSON'} validado: ${file.name}` });

        if (isZip) {
          setLoadingMessage(t('analyzeProject.toast.processingFile'));
          toast({ title: t('analyzeProject.toast.processingFile') });
          try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const extractedFiles: AppSourceFile[] = [];
            const fileProcessingPromises: Promise<void>[] = [];
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Procesando ${Object.keys(zip.files).length} entradas en el ZIP.`});

            zip.forEach((relativePath, fileEntry) => {
              const entryNameLower = fileEntry.name.toLowerCase();
              const isIgnored = ignorePatternsSimple.some(pattern => entryNameLower.includes(pattern.replace('**', '')));
              const isBinary = binaryExtensions.some(ext => entryNameLower.endsWith(ext));
              const extension = (entryNameLower.includes('.') ? '.' + entryNameLower.split('.').pop() : '');
              const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.endsWith('/'));

              addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Revisando: ${relativePath}, Dir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

              if (!fileEntry.dir && !isIgnored && (!isBinary || isAllowedText)) { // Allow text files even if marked as binary by some systems
                fileProcessingPromises.push(
                  fileEntry.async("string").then(content => {
                    extractedFiles.push({ fileName: relativePath, content });
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Incluido para extracción: ${relativePath}` });
                  }).catch(err => {
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}`});
                  })
                );
              } else if (!fileEntry.dir) {
                addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Omitido: ${relativePath} (Directorio: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario y no permitido: ${isBinary && !isAllowedText})` });
              }
            });
            await Promise.all(fileProcessingPromises);

            if (extractedFiles.length === 0) {
              const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles', {fileName: file.name });
              setError(noFilesError);
              toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: noFilesError });
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `ZIP procesado, pero no se extrajeron archivos de texto válidos de ${file.name}.`});
              setUploadedFile(null);
              setUploadedFileName(null);
            } else {
              setOriginalProjectFiles(extractedFiles);
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Extraídos ${extractedFiles.length} archivos del ZIP para análisis.`});
              toast({ title: t('analyzeProject.toast.zipProcessed.title'), description: t('analyzeProject.toast.zipProcessed.description', { count: extractedFiles.length })});
            }
          } catch (zipError: any) {
            const errorMsg = t('analyzeProject.toast.zipReadError.description', { error: zipError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: errorMsg});
            setError(errorMsg);
            setUploadedFile(null);
            setUploadedFileName(null);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al procesar ZIP: ${zipError.message}`, errorDetails: zipError });
          } finally {
            setLoadingMessage(null);
          }
        } else if (isJson) {
           addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo JSON ${file.name} seleccionado. Su contenido se pasará para análisis.`});
           setOriginalProjectFiles(null);
        }
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description');
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title'), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Archivo inválido: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size}`});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, toast, addDebugLog, textFileExtensions, setOriginalProjectFiles, setUploadedFileName, setLoadingMessage, setError, setUploadedFile]);


  const executeAnalysis = useCallback(async (analysisInput: AnalyzeCodeInput ) => {
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
         finalResult.groupLog = t('analyzeProject.results.groupContextLog', {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInput.focusArea || t('autoupdate.analysis.general')),
            orchestratorContext: (orchestrator?.systemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalizarProyecto)'
        });
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
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing'));
    setError(null);
    setResult(null); // Clear previous results
    setSuggestionsForUI([]);
    setOriginalProjectFiles(null); // Clear previous project files for new analysis

    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID);
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask;
    }

    let analysisInputBase: Omit<AnalyzeCodeInput, 'sourceCodeLocation' | 'projectContent' | 'gitRepoUrl'> = {
        focusArea: focusArea || undefined,
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    let projectContentStringForAI: string | undefined;

    if (projectSourceType === "upload") {
      if (uploadedFile) {
        addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Procesando archivo subido para análisis: ${uploadedFile.name}`});
        if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
          if (originalProjectFiles && originalProjectFiles.length > 0) { // This state is set by handleFileChange
            projectContentStringForAI = originalProjectFiles.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          } else {
            const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles', {fileName: uploadedFile.name });
            setError(noFilesError); setIsLoading(false); setLoadingMessage(null);
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title'), description: noFilesError});
            addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: 'Análisis abortado: ZIP subido pero originalProjectFiles no poblado.'});
            return;
          }
        } else if (uploadedFile.name.toLowerCase().endsWith('.json')) {
            projectContentStringForAI = await uploadedFile.text();
            // For JSON, we pass content directly, originalProjectFiles will remain null
            // as we don't have a file-by-file structure from a single JSON content for modification.
        } else { // Other text files (less likely for "analyze project")
            projectContentStringForAI = await uploadedFile.text();
            setOriginalProjectFiles([{fileName: uploadedFile.name, content: projectContentStringForAI}]);
        }
        const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentStringForAI, sourceCodeLocation: "UploadedString" };
        await executeAnalysis(analysisInput);
      } else {
         const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description');
         setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
         toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: sourceRequiredMsg});
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin archivo subido (tipo: upload).`});
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit'));
      toast({ title: t('analyzeProject.toast.fetchingGit') });
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_FETCH_GIT_REPO_AP', type: 'INFO', message: logMsg }));

        if (gitResult.success && gitResult.files) {
          setOriginalProjectFiles(gitResult.files); // Store original files from Git
          projectContentStringForAI = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, gitRepoUrl: gitUrl, projectContent: projectContentStringForAI, sourceCodeLocation: "Git" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown'));
        }
      } catch (gitError: any) {
        const errorMsg = (gitError as Error).message || t('analyzeProject.toast.gitFetchError.unknown');
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title'), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al obtener de Git: ${errorMsg}`, errorDetails: gitError});
      }
    } else if (projectSourceType === "local") {
      setLoadingMessage(t('analyzeProject.toast.gettingLocalSource.title'));
      toast({ title: t('analyzeProject.toast.gettingLocalSource.title') });
      try {
        const bundleResult = await getApplicationSourceBundle(false);
        if (bundleResult.logsBuilt) bundleResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_GET_LOCAL_BUNDLE_AP', type: 'INFO', message: logMsg }));
        if (bundleResult.success && bundleResult.files) {
          setOriginalProjectFiles(bundleResult.files); // Store original files from local source
          projectContentStringForAI = bundleResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentStringForAI, sourceCodeLocation: "Local" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(bundleResult.error || t('analyzeProject.toast.localSourceError.description', {error: 'Error desconocido'}));
        }
      } catch (localError: any) {
        const errorMsg = (localError as Error).message || t('analyzeProject.toast.localSourceError.description', {error: 'Error desconocido'});
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.localSourceError.title'), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al obtener código local: ${errorMsg}`, errorDetails: localError});
      }
    } else {
      const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description');
      setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: sourceRequiredMsg});
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin fuente válida (tipo: ${projectSourceType}, URL Git: ${gitUrl}).`});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, addDebugLog,
      setOriginalProjectFiles, settings.language, textFileExtensions,
      setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoading // Added missing state setters
  ]);

  const handleToggleSuggestionSelection = useCallback((suggestionId: string) => {
    setSuggestionsForUI(prev => prev.map(s => s.id === suggestionId ? {...s, isSelected: !s.isSelected} : s) );
  }, [setSuggestionsForUI]);


  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.emptyModificationRequest') });
      return;
    }
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}`) }) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles (necesario si fuente es Git o ZIP procesado).' });
      return;
    }

    setIsProcessingModification(true);
    setError(null);
    const flowName = 'callModifyProjectStructure (AnalizarProyecto)';
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Procesando modificación: ${modificationPrompt}`, data: { currentAnalysisTitle: result?.analysisTitle }, flowName });

    let agentSystemPromptForChat: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPromptForChat = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = DEFAULT_AGENTS.find(a => a.id === ORCHESTRATOR_AGENT_ID);
        agentSystemPromptForChat = orchestrator?.systemPrompt || group?.mainTask;
    } else {
        agentSystemPromptForChat = t('analyzeProject.results.defaultChatContextSystemPrompt');
    }

    const filesForModificationFlow = (originalProjectFiles || []).map(f => ({
        path: f.fileName, // Map fileName to path
        content: f.content,
        isFolder: f.fileName.endsWith('/'), // Basic inference
    }));

    const inputForModification: ModifyProjectStructureInput = {
      currentProject: {
        projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName', { name: 'Modificado', time: '' }).split(' - ')[2] || 'ProyectoModificado',
        aiNotes: `${result?.generalAssessment || ''}\n${t('analyzeProject.results.chatInteractionLogPrefix', {time: new Date().toLocaleTimeString()})}\n${t('common.userLabel')}: ${modificationPrompt}\n`,
        files: filesForModificationFlow,
      },
      modificationRequest: modificationPrompt,
      agentSystemPrompt: agentSystemPromptForChat,
    };

    try {
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      // Update originalProjectFiles with the modified files from AI
      setOriginalProjectFiles(modifiedProjectResult.files.map(f => ({ fileName: f.path, content: f.content })));
      // Update the main analysis result's notes
      setResult(prevResult => ({
          ...prevResult!, // prevResult should exist if we are here
          aiNotes: modifiedProjectResult.aiNotes,
          // Optionally, update suggestions if the AI provided new ones based on modification
          // detailedSuggestions: modifiedProjectResult.newSuggestions || prevResult!.detailedSuggestions
      }));
      setModificationPrompt('');
      toast({ title: t('analyzeProject.toast.modificationSuccess.title'), description: t('analyzeProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description'));
      setError(errorMsg); // Display in ErrorDisplay
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    }
    setIsProcessingModification(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog, setFocusArea, setLlmConfigSource, setProjectSourceType, setResult, setGitUrl, setSearchDepth, setOriginalProjectFiles, setUploadedFileName, setUploadedFile, uploadedFile, uploadedFileName, projectSourceType, focusArea, searchDepth, textFileExtensions, setSuggestionsForUI, setModificationPrompt, setIsProcessingModification, setError]);


  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title'), description: t('analyzeProject.toast.downloadError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}`) })});
      return;
    }
    setIsLoading(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping'));
    toast({ title: t('analyzeProject.toast.applyingAndZipping') });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))];
      const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));

      suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area).forEach(suggestion => {
        filesMap.set(suggestion.area!, suggestion.suggestedContent!);
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
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown');
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoading, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType]);

  const handleApplySelectedCheckboxSuggestions = useCallback(() => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title'), description: t('analyzeProject.toast.modificationError.noBaseFiles', {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}`) }) });
      return;
    }
    const applicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area);
    if (applicableSuggestions.length === 0) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.noSuggestionsToApply.title'), description: t('analyzeProject.toast.noSuggestionsToApply.description') });
        return;
    }

    let updatedFiles = [...originalProjectFiles];
    const filesMap = new Map<string, string>(updatedFiles.map(f => [f.fileName, f.content]));

    applicableSuggestions.forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area}` });
        }
    });
    updatedFiles = Array.from(filesMap.entries()).map(([fileName, content]) => ({ fileName, content }));
    setOriginalProjectFiles(updatedFiles);
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title'), description: t('analyzeProject.toast.selectedSuggestionsApplied.description') });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles]);


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
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('versions.toast.snapshotSaveError.noContent', {section: t('sidebar.analyzeProject')})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName', { name: (result?.analysisTitle || "Sin Titulo").substring(0,30), time: new Date().toLocaleTimeString() });
    const snapshotDataToSave = {
      analysisResult: result,
      currentOriginalFiles: originalProjectFiles || undefined,
      selectedSuggestionsInfo: suggestionsForUI.filter(s => s.isSelected).map(s=> ({area:s.area, suggestion:s.suggestion, priority:s.priority})),
      modificationPromptHistory: modificationPrompt,
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
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Snapshot guardado: ${snapshotName}`, data: { size: stringLength, fileCount: originalProjectFiles?.length } });
  }, [result, suggestionsForUI, originalProjectFiles, projectSourceType, gitUrl, uploadedFileName, addSnapshot, t, toast, modificationPrompt, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const contextForAI = `${t('analyzeProject.results.modificationContextPrefix', { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : (projectSourceType === 'local' ? t('analyzeProject.sourceLocal') : uploadedFileName || t('analyzeProject.results.uploadedFileFallback')) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel')}: "${modificationPrompt}"` : '' }`;

    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing'),
      description: t('error.errorDisplay.toast.autofixAttempt.description')
    });
    // Actual callAutoFixErrorWithGroup is handled by ErrorDisplay which receives this as onAutoFix prop
  }, [t, modificationPrompt, focusArea, projectSourceType, gitUrl, uploadedFileName, addDebugLog, toast]);


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
            if (value === 'upload' || value === 'local') setGitUrl('');
            else if (value === 'git') setUploadedFileName(null);
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
          isLoading={isLoading || isRedefiningFocusArea}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusArea}
        />

        {error && <ErrorDisplay
                    error={error}
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))}
                    context={`${t('analyzeProject.results.modificationContextPrefix', { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : (projectSourceType === 'local' ? t('analyzeProject.sourceLocal') : uploadedFileName || t('analyzeProject.results.uploadedFileFallback')) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel')}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing')}</p></div>}

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
              isProcessingModification={isProcessingModification || isRedefiningModificationPrompt}
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
