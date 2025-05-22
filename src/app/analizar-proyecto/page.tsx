
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
  ProjectGenerationResult,
  ChatMessage, // Keep for potential future use, though chatHistoryAnalyze is removed
} from '@/types';
import {
  callAnalyzeSelfCode,
  callRedefinePrompt,
  callChatWithAgentOrGlobal,
  callModifyProjectStructure,
} from '@/utils/apiClient';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions'; // For Git source
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
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type ProjectSourceType = "upload" | "git";

const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/', 'venv/', '.venv/'];
const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm', '.zip', '.tgz', '.ex5', '.ex4'];


/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration source, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
 * It includes an interactive section to suggest modifications to the analyzed project
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
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  const textFileExtensions = [
    '.mq5', '.mqh', '.mq4',
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.php', '.rb', '.rs', '.swift', '.kt', '.kts', '.lua', '.pl', '.dart', '.ex', '.exs', '.scala', '.clj', '.groovy', '.hs', '.erl',
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

      if ((isZip || isJson) && isValidSize) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo ${isZip ? 'ZIP' : 'JSON'} validado: ${file.name}` });

        if (isZip) {
          setLoadingMessage(t('analyzeProject.toast.processingFile' as TranslationKey));
          toast({ title: t('analyzeProject.toast.processingFile' as TranslationKey) });
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
              const extension = '.' + entryNameLower.split('.').pop();
              const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.includes('/'));

              addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Revisando: ${relativePath}, Dir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

              if (!fileEntry.dir && !isIgnored && !isBinary && isAllowedText) {
                fileProcessingPromises.push(
                  fileEntry.async("string").then(content => {
                    extractedFiles.push({ fileName: relativePath, content });
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Incluido para extracción: ${relativePath}` });
                  }).catch(err => {
                    addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}`});
                  })
                );
              } else if (!fileEntry.dir) {
                addDebugLog({ source: 'AnalizarProyectoPage', type: 'DEBUG', message: `Omitido: ${relativePath} (Directorio: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, No es texto permitido: ${!isAllowedText})` });
              }
            });
            await Promise.all(fileProcessingPromises);

            if (extractedFiles.length === 0) {
              const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, {fileName: file.name });
              setError(noFilesError);
              toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: noFilesError });
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `ZIP procesado, pero no se extrajeron archivos de texto válidos de ${file.name}.`});
            } else {
              setOriginalProjectFiles(extractedFiles);
              addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Extraídos ${extractedFiles.length} archivos del ZIP para análisis.`});
              toast({ title: t('analyzeProject.toast.zipProcessed.title' as TranslationKey), description: t('analyzeProject.toast.zipProcessed.description' as TranslationKey, { count: extractedFiles.length })});
            }
          } catch (zipError: any) {
            const errorMsg = t('analyzeProject.toast.zipReadError.description' as TranslationKey, { error: zipError.message });
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: errorMsg});
            setError(errorMsg);
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al procesar ZIP: ${zipError.message}`, errorDetails: zipError });
          } finally {
            setLoadingMessage(null);
          }
        } else if (isJson) {
           addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Archivo JSON ${file.name} seleccionado. Su contenido se pasará para análisis.`});
        }
      } else {
        const errorMsg = t('analyzeProject.toast.invalidFile.description' as TranslationKey);
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: errorMsg });
        setError(errorMsg);
        setUploadedFile(null); setUploadedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Archivo inválido: ${file.name}, Tipo: ${file.type}, Tamaño: ${file.size}`});
      }
    }
  }, [t, toast, addDebugLog, setOriginalProjectFiles, setUploadedFileName, setLoadingMessage, setError, textFileExtensions]);

  const executeAnalysis = useCallback(async (analysisInput: AnalyzeCodeInput ) => {
    const flowName = 'analyzeProject (callAnalyzeSelfCode)';
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
  }, [llmConfigSource, getGroupById, getAgentById, t, toast, addDebugLog, router, setResult, setSuggestionsForUI]);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setResult(null);
    setSuggestionsForUI([]);
    setModificationPrompt('');

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
        addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Procesando archivo subido para análisis: ${uploadedFile.name}`});
        let projectContentString: string;
        if (uploadedFile.name.toLowerCase().endsWith('.zip')) {
          if (originalProjectFiles && originalProjectFiles.length > 0) {
            projectContentString = originalProjectFiles.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          } else {
            const noFilesError = t('analyzeProject.toast.zipReadError.noValidFiles' as TranslationKey, {fileName: uploadedFile.name });
            setError(noFilesError); setIsLoading(false); setLoadingMessage(null);
            toast({ variant: "destructive", title: t('analyzeProject.toast.zipReadError.title' as TranslationKey), description: noFilesError});
            addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: 'Análisis abortado: originalProjectFiles no poblado desde ZIP.'});
            return;
          }
        } else if (uploadedFile.name.toLowerCase().endsWith('.json')) {
          projectContentString = await uploadedFile.text();
        } else {
            const unsupportedMsg = t('analyzeProject.toast.unsupportedFileType.description' as TranslationKey);
            setError(unsupportedMsg); setIsLoading(false); setLoadingMessage(null);
            toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: unsupportedMsg});
            addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Tipo de archivo no soportado para análisis directo (no ZIP/JSON): ${uploadedFile.name}`});
            return;
        }
        const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, projectContent: projectContentString, sourceCodeLocation: "UploadedString" };
        await executeAnalysis(analysisInput);

      } else {
         const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
         setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
         toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: sourceRequiredMsg});
         addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin archivo subido (tipo: upload).`});
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit' as TranslationKey));
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'SERVER_FETCH_GIT_REPO_AP', type: 'INFO', message: logMsg }));

        if (gitResult.success && gitResult.files) {
          setOriginalProjectFiles(gitResult.files); // Save original files from Git
          const projectContentString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = { ...analysisInputBase, gitRepoUrl: gitUrl, projectContent: projectContentString, sourceCodeLocation: "Git" };
          await executeAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        const errorMsg = (gitError as Error).message || t('analyzeProject.toast.gitFetchError.unknown' as TranslationKey);
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null);
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title' as TranslationKey), description: errorMsg});
        addDebugLog({source: 'AnalizarProyectoPage', type: 'ERROR', message: `Error al obtener de Git: ${errorMsg}`, errorDetails: gitError});
      }
    } else {
      const sourceRequiredMsg = t('analyzeProject.toast.sourceRequired.description' as TranslationKey);
      setError(sourceRequiredMsg); setIsLoading(false); setLoadingMessage(null);
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title' as TranslationKey), description: sourceRequiredMsg});
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: `Análisis solicitado sin fuente válida (tipo: ${projectSourceType}, URL Git: ${gitUrl}).`});
    }
  }, [
      projectSourceType, uploadedFile, gitUrl, focusArea, searchDepth, llmConfigSource,
      getAgentById, getGroupById, executeAnalysis, t, originalProjectFiles,
      setIsLoading, setLoadingMessage, setError, addDebugLog, setOriginalProjectFiles,
      uploadedFileName, settings.language, textFileExtensions
  ]);

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.emptyModificationRequest' as TranslationKey) });
      return;
    }
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: projectSourceType === 'upload' ? t('analyzeProject.sourceUpload' as TranslationKey) : t('analyzeProject.sourceGit' as TranslationKey)}) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'WARN', message: 'Modificación solicitada pero no hay originalProjectFiles.' });
      return;
    }

    setIsProcessingModification(true);
    setError(null);
    addDebugLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Procesando modificación: ${modificationPrompt}`, data: { currentAnalysisTitle: result?.analysisTitle } });

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
      projectName: result?.analysisTitle || uploadedFileName || t('analyzeProject.results.snapshotName' as TranslationKey, {name: 'Modificado', time: ''}).split(' - ')[2] || 'ProyectoModificado',
      aiNotes: result?.aiNotes || result?.generalAssessment || "",
      files: originalProjectFiles,
    };

    try {
      const modifiedProjectResult = await callModifyProjectStructure({
          currentProject: currentProjectStateForModification,
          modificationRequest: modificationPrompt,
          agentSystemPrompt: agentSystemPromptForModification,
      });

      setOriginalProjectFiles(modifiedProjectResult.files);
      setResult(prevResult => ({
          ...prevResult!,
          aiNotes: `${prevResult?.aiNotes || ''}\n\n--- ${t('analyzeProject.results.chatInteractionLogPrefix' as TranslationKey)} (${new Date().toLocaleTimeString()}) ---\n${t('common.userLabel' as TranslationKey)}: ${modificationPrompt}\n${t('common.assistantLabel'as TranslationKey)}: ${modifiedProjectResult.aiNotes}`,
          // Optionally, update detailedSuggestions if the AI modifies them too
      }));
      setModificationPrompt('');
      toast({ title: t('analyzeProject.toast.modificationSuccess.title' as TranslationKey), description: t('analyzeProject.toast.modificationSuccess.description' as TranslationKey, {sourceType: 'proyecto'}) });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length }});
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('analyzeProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg);
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    }
    setIsProcessingModification(false);
  }, [modificationPrompt, result, llmConfigSource, getAgentById, getGroupById, originalProjectFiles, t, toast, router, addDebugLog, setOriginalProjectFiles, setResult, setModificationPrompt, uploadedFileName, projectSourceType]);

  const handleApplySelectedCheckboxSuggestions = useCallback(() => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.modificationError.title' as TranslationKey), description: t('analyzeProject.toast.modificationError.noBaseFiles' as TranslationKey, {sourceType: projectSourceType === 'upload' ? t('analyzeProject.sourceUpload' as TranslationKey) : t('analyzeProject.sourceGit' as TranslationKey)}) });
      return;
    }
    const applicableSuggestions = suggestionsForUI.filter(s => s.isSelected && s.suggestedContent && s.area);
    if (applicableSuggestions.length === 0) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.noSuggestionsToApply.title' as TranslationKey), description: t('analyzeProject.toast.noSuggestionsToApply.description' as TranslationKey) });
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
    toast({ title: t('analyzeProject.toast.selectedSuggestionsApplied.title' as TranslationKey), description: t('analyzeProject.toast.selectedSuggestionsApplied.description' as TranslationKey) });

  }, [originalProjectFiles, suggestionsForUI, toast, addDebugLog, t, projectSourceType, setOriginalProjectFiles]);


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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg); // Set page error for ErrorDisplay
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'focusArea'.`, errorDetails: e });
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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      setError(errorMsg); // Set page error for ErrorDisplay
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'modificationPrompt'.`, errorDetails: e });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  };

  const handleSaveAnalysisSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, {section: t('sidebar.analyzeProject' as TranslationKey)})});
      return;
    }
    const snapshotName = t('analyzeProject.results.snapshotName' as TranslationKey, { name: (result?.analysisTitle || "Sin Titulo").substring(0,30), time: new Date().toLocaleTimeString() });
    const snapshotDataToSave = {
      analysisResult: result,
      currentOriginalFiles: originalProjectFiles || undefined,
      selectedSuggestionsInfo: suggestionsForUI.filter(s => s.isSelected).map(s=> ({area:s.area, suggestion:s.suggestion, priority:s.priority})),
      modificationPromptHistory: modificationPrompt, // Save the last modification prompt for context
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
  }, [result, suggestionsForUI, originalProjectFiles, projectSourceType, gitUrl, uploadedFileName, addSnapshot, t, toast, modificationPrompt]);

  const handleDownloadProjectZip = useCallback(async () => {
    if (!originalProjectFiles) {
      toast({ variant: "destructive", title: t('analyzeProject.toast.downloadError.title' as TranslationKey), description: t('analyzeProject.toast.downloadError.noBaseFiles' as TranslationKey)});
      return;
    }
    setIsLoading(true);
    setLoadingMessage(t('analyzeProject.toast.applyingAndZipping' as TranslationKey));
    toast({ title: t('analyzeProject.toast.applyingAndZipping' as TranslationKey) });

    try {
      let filesToZip = [...originalProjectFiles.map(f => ({...f}))]; // Deep copy for this operation
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
  }, [originalProjectFiles, suggestionsForUI, result, toast, t, setIsLoading, setLoadingMessage, addDebugLog, uploadedFileName]);

  const handleAutoFixError = useCallback(async (errorToFix: string) => {
    const contextForAI = `${t('analyzeProject.toast.modificationError.consultationError' as TranslationKey)}. Error original: ${errorToFix}. Petición de modificación: "${modificationPrompt}" Enfoque='${focusArea}', Fuente='${projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey)}'`;
    addDebugLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (AnalizarProyecto)'});
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
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
            setOriginalProjectFiles(null); // Clear original files when source type changes
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
          onRedefineFocusArea={handleRedefineFocusArea}
        />

        {error && <ErrorDisplay
                    error={error}
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))}
                    context={`${t('analyzeProject.results.modificationContextPrefix' as TranslationKey, { focusArea: focusArea || 'N/A', sourceType: projectSourceType === 'git' ? gitUrl : uploadedFileName || t('analyzeProject.results.uploadedFileFallback' as TranslationKey) })} ${modificationPrompt ? `${t('analyzeProject.results.lastModificationRequestLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing' as TranslationKey)}</p></div>}

        {result && (
           <AnalyzeProjectResultsDisplay
              result={result}
              t={t}
              suggestionsForUI={suggestionsForUI}
              onToggleSuggestionSelection={(id) => setSuggestionsForUI(prev => prev.map(s => s.id === id ? {...s, isSelected: !s.isSelected} : s) )}
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
            />
        )}
      </CardContent>
    </Card>
  );
}

