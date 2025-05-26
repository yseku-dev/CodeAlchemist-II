
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
  CodeSnapshot,
  ChatMessage,
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callModifyProjectStructure,
  callChatWithAgentOrGlobal,
  callAutoFixErrorWithGroup
} from '@/utils/apiClient';
import { getApplicationSourceBundle, fetchRemoteGitRepository } from '@/app/autoupdate/actions';
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

// Importar los subcomponentes
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';

type ProjectSourceType = "upload" | "git" | "local";

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
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON), provide a Git URL, or analyze
 * the current application's local source code. They can select an LLM configuration source,
 * and specify analysis parameters. The component then displays the AI's overall assessment,
 * identified areas, and specific suggestions. It includes an interactive section to suggest
 * modifications to the analyzed project files (if available from Git or processed ZIP)
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

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileNameLower = file.name.toLowerCase();
      const isZip = fileNameLower.endsWith('.zip');
      const isJson = fileNameLower.endsWith('.json');
      const isValidSize = file.size <= 25 * 1024 * 1024;

      addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Archivo seleccionado: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size} bytes` });
      setError(null);
      setResult(null);
      setSuggestionsForUI([]);
      setModificationPrompt('');
      setOriginalProjectFiles(null);

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo ${isZip ? 'ZIP' : 'JSON'} validado: ${file.name}` });

        if (isZip) {
          setLoadingMessage(t('analyzeProject.toast.zipUpload.processing' as TranslationKey));
          toast({ title: t('analyzeProject.toast.zipUpload.processing' as TranslationKey) });
          setIsLoading(true);
          try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(file);
            const extractedFiles: AppSourceFile[] = [];
            const fileProcessingPromises: Promise<void>[] = [];
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Procesando ${Object.keys(zip.files).length} entradas en el ZIP.`});

            zip.forEach((relativePath, fileEntry) => {
              const entryNameLower = fileEntry.name.toLowerCase();
              const isIgnored = ignorePatternsSimple.some(pattern => entryNameLower.includes(pattern.replace('**', '')));
              const extension = (entryNameLower.includes('.') ? '.' + entryNameLower.split('.').pop() : '');
              const isBinary = binaryExtensions.some(ext => entryNameLower.endsWith(ext));
              const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.endsWith('/'));

              addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Revisando entrada ZIP: ${relativePath}, EsDir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

              if (!fileEntry.dir && !isIgnored && isAllowedText) {
                fileProcessingPromises.push(
                  fileEntry.async("string").then(content => {
                    extractedFiles.push({ fileName: relativePath, content });
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Incluido para extracción: ${relativePath}` });
                  }).catch(err => {
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}`});
                  })
                );
              } else if (!fileEntry.dir) {
                addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Omitido del ZIP: ${relativePath} (Directorio: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario o no permitido: ${isBinary && !isAllowedText})` });
              }
            });
            await Promise.all(fileProcessingPromises);

            if (extractedFiles.length === 0) {
              const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, {fileName: file.name });
              setError(noFilesError);
              toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: noFilesError });
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `ZIP procesado, pero no se extrajeron archivos de texto válidos de ${file.name}.`});
              setUploadedFile(null);
              setUploadedFileName(null);
              setOriginalProjectFiles(null);
            } else {
              setOriginalProjectFiles(extractedFiles);
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Extraídos ${extractedFiles.length} archivos del ZIP para análisis.`, data: extractedFiles.map(f=>f.fileName).slice(0,10) });
              toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: extractedFiles.length })});
            }
          } catch (zipError: any) {
            const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: errorMsg});
            setError(errorMsg);
            setUploadedFile(null);
            setUploadedFileName(null);
            setOriginalProjectFiles(null);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al procesar ZIP: ${zipError.message}`, errorDetails: zipError });
          } finally {
            setLoadingMessage(null);
            setIsLoading(false);
          }
        } else if (isJson) {
           addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo JSON ${file.name} seleccionado. Su contenido se pasará para análisis.`});
           setOriginalProjectFiles(null);
        }
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description' as TranslationKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null);
        setOriginalProjectFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Archivo inválido: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size}`});
      }
    }
  }, [t, toast, addDebugLog, setOriginalProjectFiles, setUploadedFileName, setLoadingMessage, setError, setUploadedFile, setResult, setSuggestionsForUI, setModificationPrompt]);

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
         finalResult.groupLog = t('analyzeProject.results.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (analysisInput.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
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
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI, setIsLoading, setLoadingMessage, setError ]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');
    // No limpiar originalProjectFiles aquí si la fuente es ZIP, ya que handleFileChange ya lo pobló.
    // Se limpiará si se cambia de fuente explícitamente.

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
        analysisPreferences: focusArea || undefined, // analysisPreferences is deprecated, use focusArea
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    let projectContentStringForAI: string | undefined;

    if (projectSourceType === "upload") {
      if (uploadedFile?.name.toLowerCase().endsWith('.zip')) {
        if (originalProjectFiles && originalProjectFiles.length > 0) {
          addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Usando originalProjectFiles (de ZIP procesado previamente) para análisis. Archivos: ${originalProjectFiles.length}`});
          projectContentStringForAI = originalProjectFiles.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentStringForAI, sourceCodeLocation: "UploadedString" };
          await executeAnalysis(analysisInput);
        } else {
          const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
          setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
          toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: sourceRequiredMsg});
          addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado para ZIP, pero originalProjectFiles está vacío. El archivo ZIP debe ser procesado por handleFileChange primero.`});
        }
      } else if (uploadedFile?.name.toLowerCase().endsWith('.json')) {
          projectContentStringForAI = await uploadedFile.text();
          setOriginalProjectFiles(null); // No hay estructura de archivos base para JSON
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentStringForAI, sourceCodeLocation: "UploadedString" };
          await executeAnalysis(analysisInput);
      } else {
         const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
         setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
         toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: sourceRequiredMsg});
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin archivo subido (tipo: upload).`});
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit' as TranslationKey));
      toast({ title: t('analyzeProject.toast.fetchingGit' as TranslationKey) });
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_FETCH_GIT_REPO_AP', type: 'INFO', message: logMsg }));

        if (gitResult.success && gitResult.files) {
          setOriginalProjectFiles(gitResult.files);
          projectContentStringForAI = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, gitRepoUrl: gitUrl, projectContent: projectContentStringForAI, sourceCodeLocation: "Git" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        const errorMsg = (gitError as Error).message || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey);
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        setOriginalProjectFiles(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title' as TranslationKey), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al obtener de Git: ${errorMsg}`, errorDetails: gitError});
      }
    } else if (projectSourceType === "local") {
      setLoadingMessage(t('analyzeProject.toast.gettingLocalSource.title' as TranslationKey));
      toast({ title: t('analyzeProject.toast.gettingLocalSource.title' as TranslationKey) });
      try {
        const bundleResult = await getApplicationSourceBundle(false);
        if (bundleResult.logsBuilt) bundleResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_GET_LOCAL_BUNDLE_AP', type: 'INFO', message: logMsg }));
        if (bundleResult.success && bundleResult.files) {
          setOriginalProjectFiles(bundleResult.files);
          projectContentStringForAI = bundleResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentStringForAI, sourceCodeLocation: "Local" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(bundleResult.error || t('analyzeProject.toast.localSourceError.description' as TranslationKey, {error: 'Error desconocido'}));
        }
      } catch (localError: any) {
        const errorMsg = (localError as Error).message || t('analyzeProject.toast.localSourceError.description' as TranslationKey, {error: 'Error desconocido'});
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        setOriginalProjectFiles(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.localSourceError.title' as TranslationKey), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al obtener código local: ${errorMsg}`, errorDetails: localError});
      }
    } else {
      const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
      setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: sourceRequiredMsg});
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin fuente válida (tipo: ${projectSourceType}, URL Git: ${gitUrl}).`});
    }
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, addDebugLog,
      setOriginalProjectFiles, setResult, setSuggestionsForUI, setError, setLoadingMessage, setIsLoading, setModificationPrompt,
  ]);

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles. La fuente probablemente no fue Git o el ZIP no se procesó/contenía archivos válidos.' });
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
        projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName' as TranslationKey, { name: 'Modificado', time: '' }).split(' - ')[2].trim() || 'ProyectoModificado',
        aiNotes: `${result?.generalAssessment || ''}\n${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey, {time: new Date().toLocaleTimeString()})}: ${tempCurrentModificationRequest}\n`,
        files: filesForModificationFlow,
      },
      modificationRequest: tempCurrentModificationRequest,
      agentSystemPrompt: agentSystemPromptForChat || t('analyzeProject.results.defaultChatContextSystemPrompt' as TranslationKey),
    };

    setModificationPrompt('');

    try {
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);

      if (modifiedProjectResult && Array.isArray(modifiedProjectResult.files)) {
         setOriginalProjectFiles(modifiedProjectResult.files.map(f => ({ fileName: f.path, content: f.content ?? '' })));
         setResult(prevResult => ({
             ...prevResult!,
             analysisTitle: modifiedProjectResult.projectName || prevResult!.analysisTitle,
             generalAssessment: modifiedProjectResult.aiNotes || prevResult!.generalAssessment,
             aiNotes: modifiedProjectResult.aiNotes || prevResult!.aiNotes,
         }));

         toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey), description: t('analyzeProject.toast.modificationSuccess.description' as TranslationKey) });
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files.length }, flowName});
      } else {
        throw new AppError(t('analyzeProject.toast.modificationError.description' as TranslationKey), {originalError: "La IA no devolvió una estructura de archivos válida."});
      }
    } catch (e: any) {
      addDebugLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg);
      setResult(prev => ({...prev!, aiNotes: `${prev!.aiNotes || ''}\n\n[ERROR DE MODIFICACIÓN]: ${errorMsg}`}));
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
    modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog,
    setOriginalProjectFiles, setResult, setModificationPrompt, setError, setIsProcessingModification, uploadedFileName, projectSourceType,
  ]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey, {sourceType: t(`analyzeProject.source${projectSourceType.charAt(0).toUpperCase() + projectSourceType.slice(1)}` as TranslationKey) }) });
      return;
    }
    setIsLoading(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))];
      const filesMap = new Map<string, string>(filesToZip.map(f => [f.fileName, f.content]));

      suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area).forEach(suggestion => {
        if (suggestion.area && suggestion.suggestedContent) {
            filesMap.set(suggestion.area, suggestion.suggestedContent);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Aplicando sugerencia de checkbox a: ${suggestion.area}` });
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
      const errorMsg = (e as Error).message || t('analyzeProject.toast.zipDownloadError.unknown' as TranslationKey);
      toast({ variant: "destructive", title: t('analyzeProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al generar/descargar ZIP: ${errorMsg}`, errorDetails: e});
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoading, setLoadingMessage, addDebugLog, uploadedFileName, projectSourceType ]);

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
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title' as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description' as TranslationKey) });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles ]);


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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

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
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'modificationPrompt' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'modificationPrompt'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg);
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
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || uploadedFileName || "Analisis").substring(0,30), time: new Date().toLocaleTimeString() });

    const dataToSave = {
        analysisResult: result,
        currentOriginalFiles: originalProjectFiles || undefined,
        suggestionsWithSelection: suggestionsForUI,
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
      // ErrorDisplay component handles showing the modal with fixSuggestion
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
            setProjectSourceType(value);
            setUploadedFile(null);
            setUploadedFileName(null);
            if (value !== 'upload') {
              setOriginalProjectFiles(null);
            }
            setResult(null);
            setSuggestionsForUI([]);
            if (value === 'upload' || value === 'local') setGitUrl('');
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
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))}
                    context={`${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : (projectSourceType === 'local' ? t('analyzeProject.sourceLocal' as TranslationKey) : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={(id) => setSuggestionsForUI(prev => prev.map(s => s.id === id ? { ...s, isSelected: !s.isSelected } : s))}
              onDownloadProjectZip={handleDownloadProjectZip}
              canApplyAndDownload={!!originalProjectFiles}
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
