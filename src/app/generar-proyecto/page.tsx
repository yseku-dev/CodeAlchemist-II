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
  AppSourceFile,
} from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import LogsDisplay from '@/components/logs-display';
import { useAppState } from '@/context/AppStateContext';
import { AppError } from '@/utils/AppError';
import {
  callGenerateProjectStructure,
  callRedefinePrompt,
  callModifyProjectStructure,
  callChatWithAgentOrGlobal,
  callAutoFixErrorWithGroup
} from '@/utils/apiClient';
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

// Helper para procesar ZIP (se podría mover a utils si se usa en más sitios)
async function _processUploadedZip(
  file: File,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void
): Promise<{ projectName: string; files: GeneratedFile[]; aiNotes: string } | null> {
  addDebugLog({ source: 'GenerarProyectoPage_Helper', type: 'INFO', message: `Procesando ZIP subido: ${file.name}` });
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
  const ignorePatternsSimple = ['node_modules/', '.git/', '.next/', 'dist/', 'build/', '__pycache__/', '.DS_Store', 'package-lock.json', 'yarn.lock', 'bun.lockb', '.env.local', '.env.development', '.env.production', '.env.test', '.idea/', '.vscode/', 'venv/', '.venv/'];
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.mov', '.avi', '.webm', '.webp', '.gz', '.tar', '.rar', '.7z', '.jar', '.war', '.ear', '.dll', '.exe', '.so', '.bin', '.img', '.iso', '.dmg', '.class', '.svg', '.deb', '.rpm'];


  try {
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(file);
    const extractedAppSourceFiles: AppSourceFile[] = [];
    const fileProcessingPromises: Promise<void>[] = [];

    zip.forEach((relativePath, fileEntry) => {
      const entryNameLower = fileEntry.name.toLowerCase();
      const isIgnored = ignorePatternsSimple.some(pattern => entryNameLower.includes(pattern.replace('**', '')));
      const extension = (entryNameLower.includes('.') ? '.' + entryNameLower.split('.').pop() : '');
      const isBinary = binaryExtensions.some(ext => entryNameLower.endsWith(ext));
      const isAllowedText = textFileExtensions.includes(extension) || (!entryNameLower.includes('.') && !isBinary && !entryNameLower.endsWith('/'));

      addDebugLog({ source: 'GenerarProyectoPage_Helper_ZIP', type: 'DEBUG', message: `Revisando: ${relativePath}, EsDir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

      if (!fileEntry.dir && !isIgnored && isAllowedText) {
        fileProcessingPromises.push(
          fileEntry.async("string").then(content => {
            extractedAppSourceFiles.push({ fileName: relativePath, content });
            addDebugLog({ source: 'GenerarProyectoPage_Helper_ZIP', type: 'DEBUG', message: `Incluido para extracción: ${relativePath}` });
          }).catch(err => {
            addDebugLog({ source: 'GenerarProyectoPage_Helper_ZIP', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}` });
          })
        );
      } else if (!fileEntry.dir) {
        addDebugLog({ source: 'GenerarProyectoPage_Helper_ZIP', type: 'DEBUG', message: `Omitido del ZIP: ${relativePath} (Directorio: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario o no permitido: ${isBinary && !isAllowedText})` });
      }
    });

    await Promise.all(fileProcessingPromises);

    if (extractedAppSourceFiles.length === 0) {
      addDebugLog({ source: 'GenerarProyectoPage_Helper', type: 'ERROR', message: `ZIP ${file.name} no contenía archivos de texto válidos.` });
      return null;
    }

    addDebugLog({ source: 'GenerarProyectoPage_Helper', type: 'INFO', message: `Proyecto cargado desde ZIP ${file.name}. Archivos extraídos: ${extractedAppSourceFiles.length}` });
    const projectNameFromZip = file.name.replace(/\.zip$/i, '');
    return {
      projectName: projectNameFromZip,
      aiNotes: t('generateProject.results.projectFromZipNotes' as TranslationKey),
      files: extractedAppSourceFiles.map(ef => ({ path: ef.fileName, content: ef.content, isFolder: ef.fileName.endsWith('/') })),
    };

  } catch (zipError: any) {
    addDebugLog({ source: 'GenerarProyectoPage_Helper', type: 'ERROR', message: `Error procesando ZIP: ${zipError.message}`, errorDetails: zipError });
    return null;
  }
}

// Helper para orquestación de grupo
async function _callOrchestrator(
  task: string,
  group: AIAgentGroup,
  orchestrator: Agent,
  participants: Agent[],
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void,
  executionLog: string[]
): Promise<any | null> {
  executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorReceivingTitle' as TranslationKey, { taskLength: task.length, taskStart: task.substring(0, 70) }));
  addDebugLog({ source: "GP_OrchestratorCall", type: "INFO", message: "Llamando al orquestador", data: { taskStart: task.substring(0, 100) } });

  try {
    const orchestratorResponse = await callChatWithAIGroup({
      userMessage: task,
      groupMainTask: group.mainTask,
      participatingAgents: participants.map(p => ({
        id: p.id, name: p.name, description: p.description,
        systemPrompt: p.systemPrompt, capabilities: p.capabilities, llmConfig: p.llmConfig
      })),
      orchestratorAgentSystemPrompt: orchestrator.systemPrompt,
    });

    executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorRawResponseTitle' as TranslationKey, { response: orchestratorResponse.orchestratorResponse.substring(0, 200) }));
    const decision = JSON.parse(orchestratorResponse.orchestratorResponse);
    executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorParsedDecisionTitle' as TranslationKey, {
      nextAgent: decision.next_agent_id,
      instructionStart: (decision.instruction_for_next_agent || "").substring(0, 70),
      reasoningStart: (decision.reasoning || "").substring(0, 70)
    }));
    return decision;
  } catch (error: any) {
    const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message;
    executionLog.push(t('generateProject.logs.multiTurnLog.errorCallingOrchestrator' as TranslationKey, { error: errorMsg }));
    addDebugLog({ source: "GP_OrchestratorCall", type: "ERROR", message: "Error llamando/parseando orquestador", errorDetails: error });
    return null;
  }
}

async function _callDelegateAgent(
  instruction: string,
  agent: Agent,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void,
  executionLog: string[]
): Promise<string | null> {
  executionLog.push(t('generateProject.logs.multiTurnLog.callingAgentTitle' as TranslationKey, { agentName: agent.name, instructionStart: instruction.substring(0, 70) }));
  addDebugLog({ source: "GP_AgentCall", type: "INFO", message: `Llamando a agente ${agent.name}`, data: { instructionStart: instruction.substring(0, 100) } });

  try {
    const agentResponse = await callChatWithAgentOrGlobal({
      userMessage: instruction,
      agentSystemPrompt: agent.systemPrompt,
    });
    executionLog.push(t('generateProject.logs.multiTurnLog.agentResponseTitle' as TranslationKey, { agentName: agent.name, response: agentResponse.aiResponse.substring(0, 100) }));
    return agentResponse.aiResponse;
  } catch (error: any) {
    const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message;
    executionLog.push(t('generateProject.logs.multiTurnLog.errorCallingAgent' as TranslationKey, { agentName: agent.name, error: errorMsg }));
    addDebugLog({ source: "GP_AgentCall", type: "ERROR", message: `Error llamando a agente ${agent.name}`, errorDetails: error });
    return null;
  }
}

function _aggregateDataFromPayload(
  currentData: { projectName: string; aiNotes: string; files: GeneratedFile[] },
  payload: any,
  addDebugLog: (log: any) => void,
  executionLog: string[]
): { projectName: string; aiNotes: string; files: GeneratedFile[] } {
  let { projectName, aiNotes, files } = currentData;
  if (payload) {
    executionLog.push(`[LOG] Agregando datos del payload: ${JSON.stringify(payload).substring(0, 100)}...`);
    addDebugLog({ source: "GP_AggregateData", type: "INFO", message: "Agregando datos del payload", data: payload });
    if (payload.projectName && typeof payload.projectName === 'string') projectName = payload.projectName;
    if (payload.aiNotes && typeof payload.aiNotes === 'string') aiNotes = (aiNotes ? aiNotes + "\n" : "") + payload.aiNotes;
    if (Array.isArray(payload.files)) {
      const newFiles = payload.files as GeneratedFile[];
      newFiles.forEach(newFile => {
        if (newFile.path && typeof newFile.path === 'string') {
          const existingFileIndex = files.findIndex(f => f.path === newFile.path);
          if (existingFileIndex !== -1) {
            files[existingFileIndex].content = newFile.content ?? '';
            files[existingFileIndex].isFolder = newFile.isFolder ?? newFile.path.endsWith('/');
          } else {
            files.push({ path: newFile.path, content: newFile.content ?? '', isFolder: newFile.isFolder ?? newFile.path.endsWith('/') });
          }
        }
      });
    }
    if (payload.file_to_update && typeof payload.file_to_update.path === 'string' && typeof payload.file_to_update.content === 'string') {
      const { path, content } = payload.file_to_update;
      const existingFileIndex = files.findIndex(f => f.path === path);
      if (existingFileIndex !== -1) {
        files[existingFileIndex].content = content;
      } else {
        files.push({ path, content, isFolder: path.endsWith('/') });
      }
    }
  }
  return { projectName, aiNotes, files };
}


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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

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

    const flowName = `GenerarProyecto (${llmConfigSource?.type || 'Global'})`;
    addDebugLog({
      source: 'GenerarProyectoPage', type: 'INFO',
      message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`,
      data: { config: llmConfigSource, inputLength: finalPrompt.length },
      flowName
    });

    const agentSystemPromptForFlow = getAgentSystemPromptForFlow();

    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && agentSystemPromptForFlow) {
      const group = getGroupById(llmConfigSource.id);
      const orchestrator = agents.find(a => a.id === ORCHESTRATOR_AGENT_ID);
      const participantAgents = group?.agentIds.map(id => getAgentById(id)).filter(Boolean) as Agent[] || [];

      if (!group || !orchestrator) {
        const errorMsg = t('generateProject.toast.generationError.groupConfigError' as TranslationKey);
        setError(errorMsg); setIsLoading(false); toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorMsg });
        return;
      }

      let accumulatedProjectName = t('generateProject.results.defaultProjectName');
      let accumulatedAiNotes = t('generateProject.results.initialAiNotesFromGroup' as TranslationKey);
      let accumulatedFiles: GeneratedFile[] = [];
      const executionLog: string[] = [t('generateProject.logs.multiTurnLog.processStart' as TranslationKey, { groupName: group.name, taskDescriptionStart: finalPrompt.substring(0, 70) })];
      let currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.initialTaskForOrchestrator' as TranslationKey, { projectDescription: finalPrompt });
      let completed = false;
      let turn = 1;

      while (turn <= MAX_GENERATION_TURNS && !completed) {
        addDebugLog({ source: "GP_Loop", type: "INFO", message: `Turno ${turn} para ${group.name}` });
        const decision = await _callOrchestrator(currentTaskForOrchestrator, group, orchestrator, participantAgents, t, addDebugLog, executionLog);

        if (!decision) {
          accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorOrchestratorNoResponse' as TranslationKey, { turn })}`;
          completed = true; break;
        }

        if (decision.data_payload) {
          const aggregated = _aggregateDataFromPayload({ projectName: accumulatedProjectName, aiNotes: accumulatedAiNotes, files: accumulatedFiles }, decision.data_payload, addDebugLog, executionLog);
          accumulatedProjectName = aggregated.projectName;
          accumulatedAiNotes = aggregated.aiNotes;
          accumulatedFiles = aggregated.files;
        }
        if (decision.current_task_status_summary) {
          accumulatedAiNotes = (accumulatedAiNotes ? accumulatedAiNotes + "\n\n" : "") + `Resumen del Orquestador (Turno ${turn}): ${decision.current_task_status_summary}`;
        }

        if (decision.next_agent_id?.toUpperCase() === "COMPLETADO") {
          executionLog.push(t('generateProject.logs.multiTurnLog.taskCompleted' as TranslationKey, { turn, finalSummary: decision.instruction_for_next_agent }));
          if (decision.data_payload && typeof decision.data_payload === 'object') {
             // Intenta obtener el resultado final del data_payload si está estructurado como ProjectGenerationResult
            if (decision.data_payload.projectName && typeof decision.data_payload.projectName === 'string') accumulatedProjectName = decision.data_payload.projectName;
            if (decision.data_payload.aiNotes && typeof decision.data_payload.aiNotes === 'string') accumulatedAiNotes = decision.data_payload.aiNotes;
            if (Array.isArray(decision.data_payload.files)) accumulatedFiles = decision.data_payload.files.map((f:any) => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path?.endsWith('/') }));
          }
          completed = true; break;
        }

        const agentToCall = agents.find(a => a.id === decision.next_agent_id);
        if (!agentToCall) {
          executionLog.push(t('generateProject.logs.multiTurnLog.errorAgentNotFound' as TranslationKey, { turn, agentId: decision.next_agent_id }));
          accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorAgentNotFoundNoRetry' as TranslationKey, { turn, agentId: decision.next_agent_id })}`;
          completed = true; break; 
        }

        const agentResponseText = await _callDelegateAgent(decision.instruction_for_next_agent, agentToCall, t, addDebugLog, executionLog);
        if (agentResponseText === null) { // Error en la llamada al agente
            accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorAgentNoResponse' as TranslationKey, {turn, agentName: agentToCall.name})}`;
            currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.taskForOrchestratorAfterAgentFailure' as TranslationKey, {
                agentName: agentToCall.name,
                originalInstruction: decision.instruction_for_next_agent.substring(0, 100),
                currentProjectName: accumulatedProjectName,
                filesCount: accumulatedFiles.length,
                aiNotesStart: accumulatedAiNotes.substring(0,100)
            });
        } else {
             currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.taskForOrchestratorAfterAgentSuccess' as TranslationKey, {
                agentName: agentToCall.name,
                agentResponse: agentResponseText.substring(0, 200), // Truncate agent response for next prompt
                currentProjectName: accumulatedProjectName,
                filesCount: accumulatedFiles.length,
                aiNotesStart: accumulatedAiNotes.substring(0,100)
            });
        }
        turn++;
      }

      if (!completed && turn > MAX_GENERATION_TURNS) {
        executionLog.push(t('generateProject.logs.multiTurnLog.maxTurnsReached' as TranslationKey, { maxTurns: MAX_GENERATION_TURNS }));
        accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.maxTurnsReachedNotes' as TranslationKey, { maxTurns: MAX_GENERATION_TURNS })}`;
      }
      setResult({ projectName: accumulatedProjectName, aiNotes: accumulatedAiNotes, files: accumulatedFiles, groupLog: executionLog.join('\n\n') });
      setIsLoading(false);
      toast({ title: t('generateProject.toast.projectGenerated.title'), description: t('generateProject.toast.projectGenerated.description', { projectName: accumulatedProjectName }) });

    } else { // Ajustes Globales o Agente Individual
      const generationInput: GenerateProjectInput = { description: finalPrompt, agentSystemPrompt: agentSystemPromptForFlow };
      try {
        const aiResult = await callGenerateProjectStructure(generationInput);
        let groupLogText = aiResult.groupLog; // El flujo ya crea un log de contexto si agentSystemPromptForFlow existe

        setResult({ ...aiResult, groupLog: groupLogText });
        addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Generación de proyecto (modo no-grupo) finalizada.", data: { name: aiResult.projectName, files: aiResult.files?.length } });
        toast({ title: t('generateProject.toast.projectGenerated.title'), description: t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName || t('common.unknownError' as TranslationKey) }) });
      } catch (e: any) {
        const errorDetails = e.originalError || e;
        let friendlyMessage = e.friendlyMessage || (e.message || t('generateProject.toast.generationError.descriptionDefault' as TranslationKey));
        if (e instanceof AppError && e.originalError?.message?.includes("INVALID_ARGUMENT: Schema validation failed")) {
          friendlyMessage = `${t('generateProject.toast.generationError.title')}: La IA no devolvió la estructura esperada. ${e.originalError.message.substring(0,100)}...`;
        }
        addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (modo no-grupo).", errorDetails: errorDetails, friendlyMessage: friendlyMessage, flowName });
        setResult({ projectName: t('generateProject.results.defaultProjectName'), aiNotes: `${t('generateProject.results.initialAiNotes' as TranslationKey)}\n\nERROR: ${friendlyMessage}`, files: [], groupLog: `${t('generateProject.toast.generationError.title')}: ${friendlyMessage}` });
        setError(friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: friendlyMessage });
        if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
      } finally {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    llmConfigSource, agents, getAgentById, getGroupById, t, addDebugLog, toast, router,
    setResult, getAgentSystemPromptForFlow, setError, setIsLoading, setChatHistory, setModificationPrompt
  ]);

  const handleGenerateClick = useCallback(() => {
    if (!description.trim() && !fileInputRef.current?.files?.length) { // Check if file input is also empty
      toast({
        variant: "destructive",
        title: t('generateProject.toast.descriptionOrFileEmpty.title' as TranslationKey),
        description: t('generateProject.toast.descriptionOrFileEmpty.description' as TranslationKey)
      });
      return;
    }
    // If a file is selected, handleFileUpload would have set 'result' and cleared 'description'.
    // If 'description' has text, proceed with generation from description.
    // If 'result' is already populated (from a ZIP), this button might not be the primary action.
    // For now, assume if description is present, new generation is intended.
    // If result exists from a ZIP, generation from description should clear it.
    if (description.trim()) {
      setShowConfirmDialog(true);
    } else if (result && result.files.length > 0) {
        // Project already loaded from ZIP, maybe confirm if user wants to overwrite with new generation?
        // For now, do nothing if description is empty but a project (from ZIP) is loaded.
        // Or, disable this button if 'result' from ZIP is present and description is empty.
        toast({ title: t('generateProject.toast.projectAlreadyLoaded.title' as TranslationKey), description: t('generateProject.toast.projectAlreadyLoaded.description' as TranslationKey) });
    }

  }, [description, toast, t, result]);

  const handleDownloadProject = useCallback(async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title'),
        description: t('generateProject.toast.downloadError.descriptionNoFiles')
      });
      return;
    }
    const projectNameForFile = (result.projectName || t('generateProject.results.defaultProjectName')).replace(/\s+/g, '_').toLowerCase();
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${projectNameForFile}. Archivos: ${result.files.length}` });

    const zip = new JSZip();
    result.files.forEach(file => {
      let cleanPath = file.path;
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
      if (!cleanPath) {
        addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: 'Archivo omitido en ZIP por ruta vacía.', data: file });
        return;
      }

      if (file.isFolder || cleanPath.endsWith('/')) {
        const folderPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
        if (folderPath && folderPath !== '/') zip.folder(folderPath);
      } else {
        zip.file(cleanPath, file.content ?? '');
      }
    });

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = t('generateProject.downloads.zipFilename', { projectName: projectNameForFile });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({
        title: t('generateProject.toast.zipDownloadSuccess.title'),
        description: t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName: result.projectName })
      });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('generateProject.toast.zipReadError.descriptionDefault' as TranslationKey);
      toast({ variant: "destructive", title: t('generateProject.toast.zipReadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  }, [result, t, toast, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    const contextForAI = `${t('generateProject.autofixContext.projectPromptLabel')}: "${description}" ${modificationPrompt ? `${t('generateProject.autofixContext.lastModificationLabel')}: "${modificationPrompt}"` : '' }`;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: modificationPrompt, contextForAI }, flowName: 'callAutoFixErrorWithGroup (GenerarProyecto)' });
    toast({ title: t('common.processing' as TranslationKey), description: t('error.errorDisplay.toast.autofixAttempt.description' as TranslationKey) });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({ errorMessage: errorMsgToFix, codeContext: contextForAI });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida:`, data: fixSuggestion });
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError' as TranslationKey));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title' as TranslationKey), description: t('generateProject.toast.noProjectToModify' as TranslationKey) });
      return;
    }

    setIsProcessingModification(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: 'Seteando isProcessingModification a TRUE' });

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: modificationPrompt, timestamp: new Date().toISOString() };
    
    const tempCurrentModificationRequest = modificationPrompt;
    // setModificationPrompt(''); // Clear input after sending, or keep for user to edit? Let's clear.

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
            groupLog: result.groupLog, // Pass existing group log if any
        },
        modificationRequest: tempCurrentModificationRequest,
        agentSystemPrompt: agentSystemPromptForModification,
        chatHistory: chatHistory,
      };
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      
      setResult(prevResult => {
        const baseResult = prevResult || { 
          projectName: t('generateProject.results.defaultProjectName' as TranslationKey), 
          aiNotes: '', files: [], groupLog: '' 
        };
        
        const newProjectName = 
          modifiedProjectResult.projectName && typeof modifiedProjectResult.projectName === 'string' && modifiedProjectResult.projectName.trim() !== ''
          ? modifiedProjectResult.projectName
          : baseResult.projectName;

        const newAiNotes = 
          modifiedProjectResult.aiNotes && typeof modifiedProjectResult.aiNotes === 'string'
          ? modifiedProjectResult.aiNotes
          : baseResult.aiNotes;

        const newFiles = 
          Array.isArray(modifiedProjectResult.files) 
          ? modifiedProjectResult.files 
          : baseResult.files;
        
        const aiResponseMessage = newAiNotes || t('generateProject.toast.modificationSuccess.description' as TranslationKey);
        const aiMessage: ChatMessage = {
          id: uuidv4(), role: 'assistant',
          content: aiResponseMessage,
          timestamp: new Date().toISOString()
        };
        // Actualizar el chat DESPUÉS de actualizar el result principal.
        // Y asegurar que no se duplique el userMessage si se actualiza el chat en este callback.
        Promise.resolve().then(() => setChatHistory(prevChat => {
            // Evitar añadir userMessage de nuevo si prevChat ya lo tiene como el último mensaje de usuario
            const lastUserMsg = prevChat.filter(m => m.role === 'user').pop();
            if (lastUserMsg?.content === userMessage.content && lastUserMsg.id === userMessage.id) {
                return [...prevChat, aiMessage];
            }
            return [...prevChat, userMessage, aiMessage]; 
        }));


        return {
          projectName: newProjectName,
          aiNotes: newAiNotes,
          files: newFiles,
          groupLog: modifiedProjectResult.groupLog || baseResult.groupLog,
        };
      });
      
      setModificationPrompt(''); // Clear input only after successful processing and state update
      toast({ title: t('generateProject.toast.modificationSuccess.title' as TranslationKey) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length }, flowName});

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description' as TranslationKey));
      setError(errorMsg);
      
      const aiErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: `${t('chat.systemMessage.errorPrefix' as TranslationKey)}${errorMsg}`, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiErrorMessage]);

      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
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
            toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.errorTitle' as TranslationKey), description: t('analyzeProject.toast.invalidFile.description' as TranslationKey) });
            if(fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        setError(null);
        setResult(null); // Clear previous project result
        setChatHistory([]); // Clear modification chat history
        setModificationPrompt('');
        setDescription(''); // Clear project description if uploading a ZIP

        toast({ title: t('generateProject.toast.zipUpload.processing' as TranslationKey) });
        
        const processedZipResult = await _processUploadedZip(file, t, addDebugLog);

        if (processedZipResult) {
            setResult(processedZipResult);
            const initialChatMessage: ChatMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: t('generateProject.results.projectFromZipChatStart' as TranslationKey, { zipName: file.name }),
              timestamp: new Date().toISOString(),
            };
            setChatHistory([initialChatMessage]);
            toast({ title: t('generateProject.toast.zipUpload.success' as TranslationKey) });
        } else {
             toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.errorTitle' as TranslationKey), description: t('generateProject.toast.zipUpload.noValidFiles' as TranslationKey) });
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ t, toast, addDebugLog, setResult, setChatHistory, setModificationPrompt, setDescription ]);

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
                    context={`${t('generateProject.autofixContext.projectPromptLabel')}: "${description}" ${modificationPrompt ? `${t('generateProject.autofixContext.lastModificationLabel')}: "${modificationPrompt}"` : '' }`}
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

```