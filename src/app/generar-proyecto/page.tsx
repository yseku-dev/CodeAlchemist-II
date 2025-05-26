
// src/app/generar-proyecto/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type {
  LLMConfigSourceOption,
  ProjectGenerationResult,
  GenerateProjectInput,
  Agent,
  AIAgentGroup,
  ChatMessage,
  CodeSnapshot,
  GeneratedFile,
  ModifyProjectStructureInput,
  AppSourceFile, // Added AppSourceFile
} from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import LogsDisplay from '@/components/logs-display';
import { useAppState } from '@/context/AppStateContext';
import { AppError } from '@/utils/AppError';
import { callGenerateProjectStructure, callRedefinePrompt, callModifyProjectStructure, callChatWithAgentOrGlobal, callAutoFixErrorWithGroup } from '@/utils/apiClient'; // Added callAutoFixErrorWithGroup
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AGENTS, MAX_GENERATION_TURNS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import GenerateProjectHeader from '@/components/features/generar-proyecto/GenerateProjectHeader';
import GenerateProjectForm from '@/components/features/generar-proyecto/GenerateProjectForm';
import GenerateProjectResultsDisplay from '@/components/features/generar-proyecto/GenerateProjectResultsDisplay';

const textFileExtensions = [ // For ZIP processing
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
const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/', 'venv/', '.venv/'];
const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm', '.zip', '.tgz'];


/**
 * @fileOverview Página para generar una estructura base de proyecto usando IA.
 * Permite al usuario describir un proyecto, seleccionar una fuente de IA,
 * y generar una estructura de archivos. Incluye una sección de chat para modificar interactivamente
 * el proyecto generado y la opción de guardar el resultado como un snapshot.
 * El estado de los campos de entrada y los resultados se persiste en localStorage.
 * Permite subir un proyecto ZIP existente para modificarlo.
 * @module GenerarProyectoPage
 */
export default function GenerarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-gp-llmConfigSource', { type: 'Ajustes Globales' });
  const [description, setDescription] = useLocalStorage<string>('codealchemist-gp-description', '');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useLocalStorage<string>('codealchemist-gp-currentPromptForDialog', description);
  
  const [result, setResult] = useLocalStorage<ProjectGenerationResult | null>('codealchemist-gp-result', null);
  
  const [chatHistory, setChatHistory] = useLocalStorage<ChatMessage[]>('codealchemist-gp-chatHistory', []);
  const [modificationPrompt, setModificationPrompt] = useLocalStorage<string>('codealchemist-gp-modificationPrompt', '');


  const [isLoading, setIsLoading] = useState(false);
  const [isRedefining, setIsRedefining] = useState(false);
  const [isRedefiningInDialog, setIsRedefiningInDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const [isProcessingModification, setIsProcessingModification] = useState(false);
  const [isRedefiningModificationPrompt, setIsRedefiningModificationPrompt] = useState(false);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showConfirmDialog) {
      setCurrentPromptForDialog(description);
    }
  }, [description, showConfirmDialog, setCurrentPromptForDialog]);

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    if (!showConfirmDialog) {
      setCurrentPromptForDialog(newDescription);
    }
  };

  const getAgentSystemPromptForFlow = useCallback((): string | undefined => {
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      return agent?.systemPrompt;
    }
    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const orchestratorAgent = agents.find(a => a.id === ORCHESTRATOR_AGENT_ID);
      return orchestratorAgent?.systemPrompt;
    }
    return undefined;
  }, [llmConfigSource, getAgentById, agents]);

  const handleProjectGeneration = useCallback(async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]); 
    setModificationPrompt(''); 

    addDebugLog({
      source: 'GenerarProyectoPage', type: 'INFO',
      message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`,
      data: { config: llmConfigSource, inputLength: finalPrompt.length },
    });

    const agentSystemPromptForFlow = getAgentSystemPromptForFlow();
    const generationInput: GenerateProjectInput = { description: finalPrompt, agentSystemPrompt: agentSystemPromptForFlow };
    
    try {
      const aiResult = await callGenerateProjectStructure(generationInput);
      addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: 'Resultado crudo de callGenerateProjectStructure:', data: aiResult });
      
      let groupLogText = aiResult.groupLog;
      if (!groupLogText && llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id);
        const orchestratorSystemPrompt = agents.find(a => a.id === ORCHESTRATOR_AGENT_ID)?.systemPrompt;
        groupLogText = t('generateProject.logs.groupContextLog', {
           groupName: llmConfigSource.name,
           groupTask: (group?.mainTask || 'N/A').substring(0,150),
           userInput: finalPrompt.substring(0,100),
           orchestratorContext: (orchestratorSystemPrompt || t('common.notAvailable' as TranslationKey)).substring(0, 200),
           flowName: 'generateProjectStructure (Grupo)',
         });
      } else if (!groupLogText && llmConfigSource?.type === 'Agente' && llmConfigSource.name && llmConfigSource.id) {
         const agent = getAgentById(llmConfigSource.id);
         groupLogText = t('generateProject.logs.agentContextLog', {
            agentName: agent?.name || llmConfigSource.name,
            userInput: finalPrompt.substring(0, 100),
            agentContext: (agentSystemPromptForFlow || t('common.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'generateProjectStructure (Agente)',
          });
      }
      
      const finalResultToSet: ProjectGenerationResult = {
          projectName: aiResult.projectName || t('generateProject.results.defaultProjectName' as TranslationKey),
          aiNotes: aiResult.aiNotes || t('generateProject.results.initialAiNotes' as TranslationKey),
          files: aiResult.files || [],
          groupLog: groupLogText,
      };

      setResult(finalResultToSet);
      addDebugLog({
          source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Generación de proyecto finalizada.",
          data: { name: finalResultToSet.projectName, files: finalResultToSet.files?.length, notesLen: finalResultToSet.aiNotes?.length, logLen: finalResultToSet.groupLog?.length }
      });
      toast({
          title: t('generateProject.toast.projectGenerated.title'),
          description: t('generateProject.toast.projectGenerated.description', { projectName: finalResultToSet.projectName || t('common.unknownError') })
      });

    } catch (e: any) {
      const errorDetails = e.originalError || e;
      let friendlyMessage = e.friendlyMessage || (e.message || t('generateProject.toast.generationError.descriptionDefault' as TranslationKey));
      if (e instanceof AppError && e.originalError?.message?.includes("INVALID_ARGUMENT: Schema validation failed")) {
        friendlyMessage = `${t('generateProject.toast.generationError.title' as TranslationKey)}: ${t('common.error' as TranslationKey)} - La IA no devolvió la estructura esperada. ${e.originalError.message}`;
      }

      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: errorDetails, friendlyMessage: friendlyMessage });
      
      setResult({ 
          projectName: t('generateProject.results.defaultProjectName' as TranslationKey), 
          aiNotes: `${t('generateProject.results.initialAiNotes' as TranslationKey)}\n\nERROR: ${friendlyMessage}`, 
          files: [], 
          groupLog: `${t('generateProject.toast.generationError.title')}: ${friendlyMessage}`
      });
      setError(friendlyMessage);
      toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: friendlyMessage });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsLoading(false);
    }
  }, [
    llmConfigSource, agents, getAgentById, getGroupById, t, addDebugLog, toast, router, 
    setResult, getAgentSystemPromptForFlow, setError, setIsLoading, setChatHistory, setModificationPrompt
  ]);

  const handleGenerateClick = useCallback(() => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.descriptionEmpty.title'),
        description: t('generateProject.toast.descriptionEmpty.description')
      });
      return;
    }
    setShowConfirmDialog(true);
  }, [description, toast, t]);

  const handleDownloadProject = useCallback(async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title'),
        description: t('generateProject.toast.downloadError.descriptionNoFiles')
      });
      return;
    }
    const projectNameForFile = (result.projectName || t('generateProject.results.defaultProjectName' as TranslationKey)).replace(/\s+/g, '_').toLowerCase();
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${projectNameForFile}. Archivos: ${result.files.length}` });

    const zip = new JSZip();
    result.files.forEach(file => {
      let cleanPath = file.path;
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
      if (!cleanPath) {
        addDebugLog({source: 'GenerarProyectoPage', type: 'WARN', message: 'Archivo omitido en ZIP por ruta vacía.', data: file});
        return;
      }

      if (file.isFolder || cleanPath.endsWith('/')) {
        const folderPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
        if (folderPath !== '/') zip.folder(folderPath);
      } else {
        zip.file(cleanPath, file.content ?? '');
      }
    });

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = t('generateProject.downloads.zipFilename', {projectName: projectNameForFile});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({
        title: t('generateProject.toast.zipDownloadSuccess.title'),
        description: t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName: result.projectName || t('common.unknownError') })
      });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('generateProject.toast.zipReadError.description');
      toast({ variant: "destructive", title: t('generateProject.toast.zipReadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  }, [result, t, toast, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    const contextForAI = `${t('generateProject.autofixContext.projectPromptLabel' as TranslationKey)}: "${description}" ${modificationPrompt ? `${t('generateProject.autofixContext.lastModificationLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: modificationPrompt, contextForAI }, flowName: 'callAutoFixErrorWithGroup (GenerarProyecto)'});
    toast({ title: t('common.processing'), description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey) });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({errorMessage: errorMsgToFix, codeContext: contextForAI});
      // Further logic to display fixSuggestion in a modal would go here or be handled by ErrorDisplay itself
      addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida:`, data: fixSuggestion});
      // Usually ErrorDisplay component would handle showing the modal with fixSuggestion
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError'));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e});
    }
  }, [description, modificationPrompt, addDebugLog, t, toast]);

  const handleRedefineRequest = useCallback(async () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefining(true);
    setError(null);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo descripción de proyecto. Original (inicio): ${description.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Descripción de proyecto redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir descripción.", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      setError(errorMsg);
      toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefining(false);
    }
  }, [description, setDescription, addDebugLog, t, toast, router, setError]);

  const handleRedefineInDialog = useCallback(async () => {
    if (!currentPromptForDialog.trim()) {
      toast({ variant: "destructive", title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningInDialog(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo prompt en diálogo. Original (inicio): ${currentPromptForDialog.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: currentPromptForDialog });
      setCurrentPromptForDialog(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Prompt en diálogo redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir prompt en diálogo.", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) { setShowConfirmDialog(false); router.push(e.redirectTo); }
    } finally {
      setIsRedefiningInDialog(false);
    }
  }, [currentPromptForDialog, setCurrentPromptForDialog, addDebugLog, t, toast, router]);

  const handleProcessModification = useCallback(async () => {
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: 'handleProcessModification INVOCADO', data: { modificationPromptVal: modificationPrompt, resultExists: !!result } });
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('generateProject.toast.emptyModificationRequest.title'), description: t('generateProject.toast.emptyModificationRequest.description') });
      return;
    }
    if (!result) {
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: t('generateProject.toast.noProjectToModify') });
      return;
    }

    setIsProcessingModification(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: 'Seteando isProcessingModification a TRUE' });

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: modificationPrompt, timestamp: new Date().toISOString() };
    
    const tempCurrentModificationRequest = modificationPrompt;
    setModificationPrompt(''); 

    const agentSystemPromptForModification = getAgentSystemPromptForFlow();
    const flowName = 'callModifyProjectStructure (GenerarProyecto)';
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${tempCurrentModificationRequest}`, data: { currentProjectName: result.projectName }, flowName });

    setChatHistory(prev => [...prev, userMessage]);

    try {
      const inputForModification: ModifyProjectStructureInput = {
        currentProject: {
            projectName: result.projectName || t('generateProject.results.defaultProjectName' as TranslationKey),
            aiNotes: result.aiNotes || '',
            files: (result.files || []).map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })),
        },
        modificationRequest: tempCurrentModificationRequest,
        agentSystemPrompt: agentSystemPromptForModification,
        chatHistory: chatHistory, 
      };
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      
      setResult(prevResult => ({
          ...(prevResult || { projectName: '', aiNotes: '', files: [] }),
          ...modifiedProjectResult,
          groupLog: prevResult?.groupLog || modifiedProjectResult.groupLog 
      }));
      
      const aiResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.description');
      const aiMessage: ChatMessage = {
        id: uuidv4(), role: 'assistant',
        content: aiResponseMessage,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, aiMessage]); 
      
      toast({ title: t('generateProject.toast.modificationSuccess.title'), description: t('generateProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length }, flowName});

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description'));
      setError(errorMsg); 
      
      const aiErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: `${t('chat.systemMessage.errorPrefix' as TranslationKey)}${errorMsg}`, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiErrorMessage]);

      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
      addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: 'Seteando isProcessingModification a FALSE' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modificationPrompt, result, llmConfigSource, agents, getAgentById, getGroupById, 
    t, toast, router, addDebugLog, setResult, setError, setModificationPrompt, 
    setChatHistory, getAgentSystemPromptForFlow, chatHistory 
  ]);

  const handleRedefineModificationPrompt = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningModificationPrompt(true);
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo petición de modificación. Original (inicio): ${modificationPrompt.substring(0, 100)}...` });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: modificationPrompt });
      setModificationPrompt(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `'modificationPrompt' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir 'modificationPrompt'.", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationPrompt(false);
    }
  }, [modificationPrompt, setModificationPrompt, addDebugLog, t, toast, router, setError]);

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('generateProject.toast.noProjectToSave' as TranslationKey)});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName' as TranslationKey, { name: (result.projectName || "Sin_Nombre").substring(0,30), time: new Date().toLocaleTimeString() });
    const stringifiedResult = JSON.stringify(result, null, 2);
    const stringLength = stringifiedResult.length;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando guardar snapshot: ${snapshotName}. Longitud del JSON: ${stringLength} caracteres.`});
    
    if (stringLength > 4.5 * 1024 * 1024) { 
      addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `Snapshot "${snapshotName}" excede el límite de tamaño estimado de localStorage (${stringLength} caracteres). No se guardará para prevenir errores.`});
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
      code: stringifiedResult,
      source: 'generated-project',
      size: stringLength,
      fileCount: result.files?.length || 0,
      metadata: { projectName: result.projectName }
    });
  }, [result, addSnapshot, t, toast, addDebugLog]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const fileNameLower = file.name.toLowerCase();
        if (!fileNameLower.endsWith('.zip')) {
            toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title' as TranslationKey), description: t('analyzeProject.toast.invalidFile.description' as TranslationKey) });
            if(fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        setError(null);
        setResult(null);
        setChatHistory([]);
        setModificationPrompt('');
        setDescription(''); // Clear project description if uploading a ZIP

        toast({ title: t('generateProject.toast.zipUpload.processing' as TranslationKey) });
        addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Procesando ZIP subido: ${file.name}` });
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
              const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.endsWith('/'));


              if (!fileEntry.dir && !isIgnored && (!isBinary || isAllowedText)) {
                fileProcessingPromises.push(
                  fileEntry.async("string").then(content => {
                    extractedFiles.push({ fileName: relativePath, content });
                  }).catch(err => {
                    addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}`});
                  })
                );
              }
            });
            await Promise.all(fileProcessingPromises);

            if (extractedFiles.length === 0) {
              toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.noValidFiles' as TranslationKey) });
              addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `ZIP ${file.name} no contenía archivos de texto válidos.`});
            } else {
              const projectNameFromZip = file.name.replace(/\.zip$/i, '');
              const initialResult: ProjectGenerationResult = {
                projectName: projectNameFromZip,
                aiNotes: t('generateProject.results.projectFromZipNotes' as TranslationKey),
                files: extractedFiles.map(ef => ({ path: ef.fileName, content: ef.content, isFolder: ef.fileName.endsWith('/') })),
                groupLog: undefined,
              };
              setResult(initialResult);
              toast({ title: t('generateProject.toast.zipUpload.success' as TranslationKey) });
              addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Proyecto cargado desde ZIP ${file.name}. Archivos extraídos: ${extractedFiles.length}`});
            }
        } catch (zipError: any) {
            toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.error' as TranslationKey, {error: zipError.message }) });
            addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Error procesando ZIP: ${zipError.message}`, errorDetails: zipError });
        } finally {
             if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ t, toast, addDebugLog, setResult, setChatHistory, setModificationPrompt, setDescription, textFileExtensions]);

  const handleClearModificationChat = useCallback(() => {
    setChatHistory([]);
    toast({
      title: t('generateProject.toast.modificationChatCleared.title' as TranslationKey),
      description: t('generateProject.toast.modificationChatCleared.description' as TranslationKey)
    });
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: 'Chat de modificación limpiado.' });
  }, [setChatHistory, t, toast, addDebugLog]);


  return (
    <Card className="max-w-4xl mx-auto">
      <GenerateProjectHeader />
      <CardContent className="space-y-6">
        <GenerateProjectForm
            llmConfigSource={llmConfigSource}
            onLlmConfigSourceChange={setLlmConfigSource}
            description={description}
            onDescriptionChange={handleDescriptionChange} 
            onGenerateClick={handleGenerateClick}
            isLoading={isLoading || isRedefining}
            isRedefining={isRedefining}
            onRedefineRequest={handleRedefineRequest}
            onFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
            t={t}
        />

        {error && <ErrorDisplay 
                    error={error} 
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))} 
                    context={`${t('generateProject.autofixContext.projectPromptLabel' as TranslationKey)}: "${description}" ${modificationPrompt ? `${t('generateProject.autofixContext.lastModificationLabel' as TranslationKey)}: "${modificationPrompt}"` : '' }`}
                  />}

        {isLoading && !result && <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{t('common.processing')}</div>}

        {result && (
          <GenerateProjectResultsDisplay
              result={result}
              t={t}
              onDownloadProject={handleDownloadProject}
              onSaveSnapshot={handleSaveGeneratedProjectSnapshot}
              chatHistory={chatHistory}
              currentModificationRequest={modificationPrompt}
              onCurrentModificationRequestChange={setModificationPrompt}
              onSendModificationRequest={handleProcessModification}
              onClearModificationChat={handleClearModificationChat}
              isModifyingProject={isProcessingModification}
              isRedefiningModificationRequest={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineModificationPrompt}
          />
        )}
         {result && result.groupLog && (
          <LogsDisplay title={t('generateProject.results.groupLogTitle' as TranslationKey)} logs={result.groupLog} />
        )}
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleProjectGeneration(currentPromptForDialog)}
        title={t('generateProject.confirmDialog.title')}
        confirmText={t('generateProject.confirmDialog.confirmButton')}
        cancelText={t('common.cancel')}
        confirmDisabled={isRedefiningInDialog || isLoading}
      >
        <div className="space-y-4">
            <div>
                <Label className="font-semibold">{t('generateProject.confirmDialog.currentPromptLabel')}</Label>
                <ScrollArea className="h-24 border rounded-md p-2 text-sm bg-muted mt-1">
                    {currentPromptForDialog}
                </ScrollArea>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label htmlFor="redefine-prompt-dialog">{t('generateProject.confirmDialog.redefinePromptLabel')}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedefineInDialog}
                  disabled={!currentPromptForDialog.trim() || isRedefiningInDialog || isLoading}
                  className="text-xs"
                  aria-label={t('common.redefineRequestButton')}
                >
                  {isRedefiningInDialog ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                  {t('common.redefineRequestButton')}
                </Button>
              </div>
                <Textarea
                    id="redefine-prompt-dialog"
                    value={currentPromptForDialog}
                    onChange={(e) => setCurrentPromptForDialog(e.target.value)}
                    rows={4}
                    className="mt-1"
                    disabled={isRedefiningInDialog || isLoading}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                 {t('generateProject.confirmDialog.llmConfigInfo')} {llmConfigSource?.type} {llmConfigSource?.name ? `(${llmConfigSource.name})` : ''}
            </p>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

