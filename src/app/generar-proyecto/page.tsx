
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
  AppSourceFile, // Necesario para el tipo de _processUploadedZip
} from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import LogsDisplay from '@/components/logs-display';
import { useAppState } from '@/context/AppStateContext';
import { AppError } from '@/utils/AppError';
import {
  callGenerateProjectStructure,
  callRedefinePrompt,
  callModifyProjectStructure,
  callChatWithAgentOrGlobal, // Necesario para _callDelegateAgent
  callChatWithAIGroup, // Necesario para _callOrchestrator
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

// --- INICIO: Funciones Auxiliares para Granularización ---

async function _processUploadedZip(
  file: File,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void
): Promise<{ projectName: string; files: GeneratedFile[]; aiNotes: string } | null> {
  addDebugLog({ source: 'GP_ProcessZip', type: 'INFO', message: `Procesando ZIP subido: ${file.name}` });
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

      addDebugLog({ source: 'GP_ProcessZip_Detail', type: 'DEBUG', message: `Revisando ZIP: ${relativePath}, EsDir: ${fileEntry.dir}, Ignorado: ${isIgnored}, Binario: ${isBinary}, TextoPermitido: ${isAllowedText} (Ext: ${extension})` });

      if (!fileEntry.dir && !isIgnored && isAllowedText) {
        fileProcessingPromises.push(
          fileEntry.async("string").then(content => {
            extractedAppSourceFiles.push({ fileName: relativePath, content });
          }).catch(err => {
            addDebugLog({ source: 'GP_ProcessZip_Detail', type: 'WARN', message: `No se pudo leer el archivo ${relativePath} del ZIP como texto: ${(err as Error).message}` });
          })
        );
      } else if (!fileEntry.dir) {
        addDebugLog({ source: 'GP_ProcessZip_Detail', type: 'DEBUG', message: `Omitido del ZIP: ${relativePath}` });
      }
    });

    await Promise.all(fileProcessingPromises);

    if (extractedAppSourceFiles.length === 0) {
      addDebugLog({ source: 'GP_ProcessZip', type: 'ERROR', message: `ZIP ${file.name} no contenía archivos de texto válidos.` });
      return null;
    }

    const projectNameFromZip = file.name.replace(/\.zip$/i, '');
    return {
      projectName: projectNameFromZip,
      aiNotes: t('generateProject.results.projectFromZipNotes'),
      files: extractedAppSourceFiles.map(ef => ({ path: ef.fileName, content: ef.content ?? '', isFolder: ef.fileName.endsWith('/') })),
    };
  } catch (zipError: any) {
    addDebugLog({ source: 'GP_ProcessZip', type: 'ERROR', message: `Error procesando ZIP: ${zipError.message}`, errorDetails: zipError });
    return null;
  }
}

async function _callOrchestrator(
  task: string,
  group: AIAgentGroup,
  orchestrator: Agent,
  participants: Agent[],
  llmConfig: LLMConfigSourceOption | undefined, // Se usa para logging, no para la llamada directa
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void,
  executionLog: string[]
): Promise<any | null> {
  const logEntry = t('generateProject.logs.multiTurnLog.orchestratorReceivingTitle' as TranslationKey, {
    taskLength: task.length,
    taskStart: task.substring(0, 70),
  });
  executionLog.push(logEntry);
  addDebugLog({ source: "GP_OrchestratorCall", type: "INFO", message: "Llamando al orquestador", data: { taskStart: task.substring(0, 100), configSourceForCall: llmConfig } });

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
    
    let decision;
    try {
      decision = JSON.parse(orchestratorResponse.orchestratorResponse);
    } catch (parseError: any) {
      executionLog.push(t('generateProject.logs.multiTurnLog.errorParsingOrchestratorResponse' as TranslationKey, {
        response: orchestratorResponse.orchestratorResponse.substring(0, 200),
        parseError: parseError.message,
      }));
      addDebugLog({ source: "GP_OrchestratorCall", type: "ERROR", message: "Error parseando JSON del orquestador", data: { rawResponse: orchestratorResponse.orchestratorResponse, error: parseError } });
      return null;
    }
    
    executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorParsedDecisionTitle' as TranslationKey, {
      nextAgent: decision?.next_agent_id || "N/A",
      instructionStart: (decision?.instruction_for_next_agent || "").substring(0, 70),
      reasoningStart: (decision?.reasoning || "").substring(0, 70)
    }));
    return decision;
  } catch (error: any) {
    const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message;
    executionLog.push(t('generateProject.logs.multiTurnLog.errorCallingOrchestrator' as TranslationKey, { error: errorMsg }));
    addDebugLog({ source: "GP_OrchestratorCall", type: "ERROR", message: "Error llamando al orquestador", errorDetails: error });
    return null;
  }
}

async function _callDelegateAgent(
  instruction: string,
  agent: Agent,
  llmConfig: LLMConfigSourceOption | undefined, // Se usa para logging, no para la llamada directa
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  addDebugLog: (log: any) => void,
  executionLog: string[]
): Promise<string | null> {
  executionLog.push(t('generateProject.logs.multiTurnLog.callingAgentTitle' as TranslationKey, { agentName: agent.name, instructionStart: instruction.substring(0, 70) }));
  addDebugLog({ source: "GP_AgentCall", type: "INFO", message: `Llamando a agente ${agent.name}`, data: { instructionStart: instruction.substring(0, 100), configSourceForCall: llmConfig } });

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
  let { projectName, aiNotes, files } = { ...currentData, files: [...currentData.files] }; // Deep copy files array
  
  if (payload && typeof payload === 'object') {
    executionLog.push(t('generateProject.logs.multiTurnLog.dataAggregation' as TranslationKey, {
      projectName: payload.projectName || currentData.projectName,
      aiNotesStart: (payload.aiNotes || currentData.aiNotes).substring(0, 70),
      filesCount: payload.files?.length || currentData.files.length
    }));
    addDebugLog({ source: "GP_AggregateData", type: "INFO", message: "Agregando datos del payload del orquestador", data: payload });

    if (payload.projectName && typeof payload.projectName === 'string') projectName = payload.projectName;
    if (payload.aiNotes && typeof payload.aiNotes === 'string') aiNotes = (aiNotes ? aiNotes + "\n\n" : "") + payload.aiNotes;
    
    if (Array.isArray(payload.files)) {
      const newFilesFromPayload = payload.files as Partial<GeneratedFile>[];
      newFilesFromPayload.forEach(newFile => {
        if (newFile.path && typeof newFile.path === 'string') {
          const existingFileIndex = files.findIndex(f => f.path === newFile.path);
          const fileContent = typeof newFile.content === 'string' ? newFile.content : '';
          const isFolder = typeof newFile.isFolder === 'boolean' ? newFile.isFolder : newFile.path.endsWith('/');
          if (existingFileIndex !== -1) {
            files[existingFileIndex] = { path: newFile.path, content: fileContent, isFolder };
          } else {
            files.push({ path: newFile.path, content: fileContent, isFolder });
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

// --- FIN: Funciones Auxiliares ---


/**
 * @fileOverview Página para generar una estructura base de proyecto usando IA.
 * Permite al usuario describir un proyecto, seleccionar una fuente de IA, subir un ZIP existente
 * y generar/modificar una estructura de archivos. Incluye chat interactivo para modificaciones.
 * El estado se persiste en localStorage.
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
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`, data: { config: llmConfigSource, inputLength: finalPrompt.length }, flowName });

    const agentSystemPromptForFlow = getAgentSystemPromptForFlow();

    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && agentSystemPromptForFlow) {
      const group = getGroupById(llmConfigSource.id);
      const orchestrator = agents.find(a => a.id === ORCHESTRATOR_AGENT_ID);
      const participantAgents = group?.agentIds.map(id => getAgentById(id)).filter(Boolean) as Agent[] || [];

      if (!group || !orchestrator) {
        const errorMsg = t('generateProject.toast.generationError.groupConfigError');
        setError(errorMsg); setIsLoading(false); toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorMsg });
        addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: errorMsg, flowName });
        return;
      }

      let accumulatedProjectName = t('generateProject.results.defaultProjectName');
      let accumulatedAiNotes = t('generateProject.results.initialAiNotesFromGroup');
      let accumulatedFiles: GeneratedFile[] = [];
      const executionLog: string[] = [t('generateProject.logs.multiTurnLog.processStart', { groupName: group.name, taskDescriptionStart: finalPrompt.substring(0, 70) })];
      let currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.initialTaskForOrchestrator', { projectDescription: finalPrompt });
      let completed = false;
      let turn = 1;

      while (turn <= MAX_GENERATION_TURNS && !completed) {
        addDebugLog({ source: "GP_Loop", type: "INFO", message: `Turno ${turn} para ${group.name}` });
        const decision = await _callOrchestrator(currentTaskForOrchestrator, group, orchestrator, participantAgents, llmConfigSource, t, addDebugLog, executionLog);

        if (!decision) {
          accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorOrchestratorNoResponse', { turn })}`;
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
          executionLog.push(t('generateProject.logs.multiTurnLog.taskCompleted', { turn, finalSummary: decision.instruction_for_next_agent || 'N/A' }));
          if (decision.data_payload) {
            try {
              const finalPayload = typeof decision.data_payload === 'string' ? JSON.parse(decision.data_payload) : decision.data_payload;
              if (finalPayload && typeof finalPayload === 'object') {
                if (finalPayload.projectName) accumulatedProjectName = finalPayload.projectName;
                if (finalPayload.aiNotes) accumulatedAiNotes = finalPayload.aiNotes;
                if (Array.isArray(finalPayload.files)) accumulatedFiles = finalPayload.files.map((f:any) => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path?.endsWith('/') }));
              }
            } catch (e) {
              executionLog.push(t('generateProject.logs.multiTurnLog.failedToParseFinalResult' as TranslationKey, { payloadString: String(decision.data_payload).substring(0,100) }));
            }
          }
          completed = true; break;
        }

        const agentToCall = agents.find(a => a.id === decision.next_agent_id);
        if (!agentToCall) {
          executionLog.push(t('generateProject.logs.multiTurnLog.errorAgentNotFound', { turn, agentId: decision.next_agent_id || 'N/A' }));
          accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorAgentNotFoundNoRetry', { turn, agentId: decision.next_agent_id || 'N/A' })}`;
          completed = true; break; 
        }

        const agentResponseText = await _callDelegateAgent(decision.instruction_for_next_agent, agentToCall, llmConfigSource, t, addDebugLog, executionLog);
        if (agentResponseText === null) {
            accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.errorAgentNoResponse', {turn, agentName: agentToCall.name})}`;
            currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.taskForOrchestratorAfterAgentFailure', {
                agentName: agentToCall.name,
                originalInstruction: (decision.instruction_for_next_agent || "").substring(0, 100),
                currentProjectName: accumulatedProjectName,
                filesCount: accumulatedFiles.length,
                aiNotesStart: accumulatedAiNotes.substring(0,100)
            });
        } else {
             currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.taskForOrchestratorAfterAgentSuccess', {
                agentName: agentToCall.name,
                agentResponse: agentResponseText.substring(0, 200), 
                currentProjectName: accumulatedProjectName,
                filesCount: accumulatedFiles.length,
                aiNotesStart: accumulatedAiNotes.substring(0,100)
            });
        }
        turn++;
      }

      if (!completed && turn > MAX_GENERATION_TURNS) {
        executionLog.push(t('generateProject.logs.multiTurnLog.maxTurnsReached', { maxTurns: MAX_GENERATION_TURNS }));
        accumulatedAiNotes += `\n${t('generateProject.logs.multiTurnLog.maxTurnsReachedNotes', { maxTurns: MAX_GENERATION_TURNS })}`;
      }
      setResult({ projectName: accumulatedProjectName, aiNotes: accumulatedAiNotes, files: accumulatedFiles, groupLog: executionLog.join('\n\n') });
      setIsLoading(false);
      toast({ title: t('generateProject.toast.projectGenerated.title'), description: t('generateProject.toast.projectGenerated.description', { projectName: accumulatedProjectName }) });

    } else { 
      const generationInput: GenerateProjectInput = { description: finalPrompt, agentSystemPrompt: agentSystemPromptForFlow };
      try {
        const aiResult = await callGenerateProjectStructure(generationInput);
        setResult({ ...aiResult, groupLog: aiResult.groupLog || (agentSystemPromptForFlow ? t('generateProject.logs.agentContextLog', { agentName: llmConfigSource?.name || 'N/A', userInput: finalPrompt.substring(0,70), agentContext: agentSystemPromptForFlow.substring(0,200), flowName: 'generateProjectStructure (Agente)' }) : undefined )});
        addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Generación de proyecto (modo no-grupo) finalizada.", data: { name: aiResult.projectName, files: aiResult.files?.length } });
        toast({ title: t('generateProject.toast.projectGenerated.title'), description: t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName || t('common.unknownError') }) });
      } catch (e: any) {
        const errorDetails = e.originalError || e;
        let friendlyMessage = e.friendlyMessage || (e.message || t('generateProject.toast.generationError.descriptionDefault'));
         if (e instanceof AppError && e.originalError?.message?.includes("INVALID_ARGUMENT: Schema validation failed")) {
          friendlyMessage = `${t('generateProject.toast.generationError.title')}: La IA no devolvió la estructura esperada. ${e.originalError.message.substring(0,100)}...`;
        }
        addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (modo no-grupo).", errorDetails: errorDetails, friendlyMessage: friendlyMessage, flowName });
        setResult({ projectName: t('generateProject.results.defaultProjectName'), aiNotes: `${t('generateProject.results.initialAiNotes')}\n\nERROR: ${friendlyMessage}`, files: [], groupLog: `${t('generateProject.toast.generationError.title')}: ${friendlyMessage}` });
        setError(friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: friendlyMessage });
        if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    llmConfigSource, agents, getAgentById, getGroupById, t, addDebugLog, toast, router,
    setResult, getAgentSystemPromptForFlow, setError, setIsLoading, setChatHistory, setModificationPrompt
  ]);

  const handleGenerateClick = useCallback(() => {
    if (!description.trim() && !fileInputRef.current?.files?.length) {
      toast({ variant: "destructive", title: t('generateProject.toast.descriptionOrFileEmpty.title'), description: t('generateProject.toast.descriptionOrFileEmpty.description') });
      return;
    }
    if (description.trim()) {
      setShowConfirmDialog(true);
    } else if (result && result.files.length > 0) {
        toast({ title: t('generateProject.toast.projectAlreadyLoaded.title'), description: t('generateProject.toast.projectAlreadyLoaded.description') });
    }
  }, [description, toast, t, result]);

  const handleDownloadProject = useCallback(async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({ variant: "destructive", title: t('generateProject.toast.downloadError.title'), description: t('generateProject.toast.downloadError.descriptionNoFiles') });
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
      toast({ title: t('generateProject.toast.zipDownloadSuccess.title'), description: t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName: result.projectName }) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('generateProject.toast.zipReadError.descriptionDefault');
      toast({ variant: "destructive", title: t('generateProject.toast.zipReadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  }, [result, t, toast, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    const contextForAI = `${t('generateProject.autofixContext.projectPromptLabel')}: "${description}" ${modificationPrompt ? `${t('generateProject.autofixContext.lastModificationLabel')}: "${modificationPrompt}"` : '' }`;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { contextForAI }, flowName: 'callAutoFixErrorWithGroup (GenerarProyecto)' });
    toast({ title: t('common.processing'), description: t('error.errorDisplay.toast.autofixAttempt.description') });
    try {
      const fixSuggestion = await callAutoFixErrorWithGroup({ errorMessage: errorMsgToFix, codeContext: contextForAI });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Sugerencia de Auto-Fix recibida:`, data: fixSuggestion });
    } catch (e) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.unknownError'));
      toast({ variant: "destructive", title: t('error.errorDisplay.toast.autofixError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo en Auto-Fix: ${errorMsg}`, errorDetails: e });
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
    
    const agentSystemPromptForModification = getAgentSystemPromptForFlow();
    const flowName = 'callModifyProjectStructure (GenerarProyecto)';
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${tempCurrentModificationRequest}`, data: { currentProjectName: result.projectName }, flowName });

    setChatHistory(prev => [...prev, userMessage]);

    try {
      const inputForModification: ModifyProjectStructureInput = {
        currentProject: {
            projectName: result.projectName || t('generateProject.results.defaultProjectName'),
            aiNotes: result.aiNotes || '',
            files: (result.files || []).map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })),
            groupLog: result.groupLog,
        },
        modificationRequest: tempCurrentModificationRequest,
        agentSystemPrompt: agentSystemPromptForModification,
        chatHistory: chatHistory,
      };
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      
      setResult(prevResult => {
        const baseResult = prevResult || { 
          projectName: t('generateProject.results.defaultProjectName'), 
          aiNotes: '', files: [], groupLog: '' 
        };
        
        const newProjectName = 
          modifiedProjectResult.projectName && typeof modifiedProjectResult.projectName === 'string' && modifiedProjectResult.projectName.trim() !== ''
          ? modifiedProjectResult.projectName
          : baseResult.projectName;

        let newAiNotes = baseResult.aiNotes;
        if (modifiedProjectResult.aiNotes && typeof modifiedProjectResult.aiNotes === 'string') {
          newAiNotes = modifiedProjectResult.aiNotes;
        } else {
          newAiNotes = (baseResult.aiNotes || "") + `\n[ADVERTENCIA IA: La IA no proporcionó 'aiNotes' como un string válido o estaba vacío. Se utilizaron notas previas o un mensaje por defecto.]`;
        }

        const newFiles = 
          Array.isArray(modifiedProjectResult.files) 
          ? modifiedProjectResult.files 
          : baseResult.files;
        
        if (!Array.isArray(modifiedProjectResult.files)) {
           newAiNotes += `\n[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]`;
        }
        
        const aiResponseMessage = newAiNotes || t('generateProject.toast.modificationSuccess.description');
        const aiMessage: ChatMessage = {
          id: uuidv4(), role: 'assistant',
          content: aiResponseMessage,
          timestamp: new Date().toISOString()
        };
        
        setChatHistory(prevChat => {
            const lastUserMsg = prevChat.filter(m => m.role === 'user').pop();
            if (lastUserMsg?.content === userMessage.content && lastUserMsg.id === userMessage.id) {
                return [...prevChat, aiMessage];
            }
            return [...prevChat, userMessage, aiMessage]; 
        });

        return {
          projectName: newProjectName,
          aiNotes: newAiNotes,
          files: newFiles,
          groupLog: modifiedProjectResult.groupLog || baseResult.groupLog,
        };
      });
      
      setModificationPrompt(''); 
      toast({ title: t('generateProject.toast.modificationSuccess.title') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes?.length, newFilesCount: modifiedProjectResult.files?.length }, flowName});

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description'));
      setError(errorMsg);
      
      const aiErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: `${t('chat.systemMessage.errorPrefix')}${errorMsg}`, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiErrorMessage]);

      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
      addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: 'Seteando isProcessingModification a FALSE' });
    }
  }, [
    modificationPrompt, result, llmConfigSource, agents, getAgentById, getGroupById,
    t, toast, router, addDebugLog, setResult, setError, setModificationPrompt,
    setChatHistory, getAgentSystemPromptForFlow, chatHistory
  ]);

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('generateProject.toast.noProjectToSave')});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName', { name: (result.projectName || "Sin_Nombre").substring(0,30), time: new Date().toLocaleTimeString() });
    const stringifiedResult = JSON.stringify(result, null, 2);
    const stringLength = stringifiedResult.length;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando guardar snapshot: ${snapshotName}. Longitud del JSON: ${stringLength} caracteres.`});
    
    if (stringLength > 4.5 * 1024 * 1024) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `Snapshot "${snapshotName}" excede el límite de tamaño estimado de localStorage (${stringLength} caracteres). No se guardará para prevenir errores.`});
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
            toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.errorTitle'), description: t('analyzeProject.toast.invalidFile.description') });
            if(fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        
        setError(null);
        setResult(null);
        setChatHistory([]); 
        setModificationPrompt('');
        setDescription(''); 

        toast({ title: t('generateProject.toast.zipUpload.processing') });
        
        const processedZipResult = await _processUploadedZip(file, t, addDebugLog);

        if (processedZipResult) {
            setResult(processedZipResult);
            const initialChatMessage: ChatMessage = {
              id: uuidv4(),
              role: 'assistant',
              content: t('generateProject.results.projectFromZipChatStart', { zipName: file.name }),
              timestamp: new Date().toISOString(),
            };
            setChatHistory([initialChatMessage]);
            toast({ title: t('generateProject.toast.zipUpload.success') });
        } else {
             toast({ variant: "destructive", title: t('generateProject.toast.zipUpload.errorTitle'), description: t('generateProject.toast.zipUpload.noValidFiles') });
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [ t, toast, addDebugLog, setResult, setChatHistory, setModificationPrompt, setDescription ]);

  const handleClearModificationChat = useCallback(() => {
    setChatHistory([]);
    toast({
      title: t('generateProject.toast.modificationChatCleared.title'),
      description: t('generateProject.toast.modificationChatCleared.description')
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
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))}
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
              onRedefineModificationRequest={handleRedefineRequest} // Debería ser handleRedefineModificationPrompt
          />
        )}
         {result && result.groupLog && (
          <LogsDisplay title={t('generateProject.results.groupLogTitle')} logs={result.groupLog} />
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