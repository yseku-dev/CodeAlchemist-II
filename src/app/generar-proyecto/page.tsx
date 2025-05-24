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
  RedefinePromptOutput,
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
import { callGenerateProjectStructure, callRedefinePrompt, callModifyProjectStructure, callChatWithAgentOrGlobal } from '@/utils/apiClient';
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

/**
 * @fileOverview Página para generar una estructura base de proyecto usando IA.
 * Permite al usuario describir un proyecto, seleccionar una fuente de IA (global, agente o grupo),
 * y generar una estructura de archivos. Incluye una sección de chat para modificar interactivamente
 * el proyecto generado y la opción de guardar el resultado como un snapshot.
 * El estado de los campos de entrada y los resultados se persiste en localStorage.
 * @module GenerarProyectoPage
 */
export default function GenerarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-gp-llmConfigSource', { type: 'Ajustes Globales' });
  const [description, setDescription] = useLocalStorage<string>('codealchemist-gp-description', '');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useLocalStorage<string>('codealchemist-gp-currentPromptForDialog', '');
  const [result, setResult] = useLocalStorage<ProjectGenerationResult | null>('codealchemist-gp-result', null);
  const [chatHistory, setChatHistory] = useLocalStorage<ChatMessage[]>('codealchemist-gp-chatHistory', []);
  const [currentModificationRequest, setCurrentModificationRequest] = useLocalStorage<string>('codealchemist-gp-modificationRequest', '');

  const [isLoading, setIsLoading] = useState(false);
  const [isRedefining, setIsRedefining] = useState(false);
  const [isRedefiningInDialog, setIsRedefiningInDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isModifyingProject, setIsModifyingProject] = useState(false);
  const [isRedefiningModificationRequest, setIsRedefiningModificationRequest] = useState(false);
  const scrollAreaRefChat = useRef<HTMLDivElement>(null);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCurrentPromptForDialog(value);
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
    addDebugLog({
      source: 'GenerarProyectoPage',
      type: 'INFO',
      message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`,
      data: { config: llmConfigSource, fullPromptLength: finalPrompt.length },
      flowName: 'handleProjectGeneration'
    });

    const agentSystemPromptForFlow = getAgentSystemPromptForFlow();
    let finalResultToSet: ProjectGenerationResult | null = null;

    try {
      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name && agentSystemPromptForFlow) {
        addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `[MODO GRUPO] Iniciando generación de proyecto con grupo: ${llmConfigSource.name}. Prompt Orquestador (inicio): ${agentSystemPromptForFlow.substring(0, 100)}...`, flowName: 'callGenerateProjectStructure - Group' });
        
        let accumulatedProjectName: string = t('generateProject.results.defaultProjectName' as TranslationKey);
        let accumulatedAiNotes: string = t('generateProject.results.initialAiNotes' as TranslationKey);
        let accumulatedFiles: GeneratedFile[] = [];
        const executionLog: string[] = [t('generateProject.logs.multiTurnLog.processStart', { groupName: llmConfigSource.name, taskDescription: finalPrompt.substring(0,100) })];
        let currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.initialOrchestratorTask', { projectDescription: finalPrompt });
        let completed = false;
        let turn = 1;

        while (turn <= MAX_GENERATION_TURNS && !completed) {
          executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorTurnStart', { turn }));
          executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorReceiving', { input: currentTaskForOrchestrator.substring(0, 200) + '...' }));
          addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `[MODO GRUPO - Turno ${turn}] Prompt para Orquestador: ${agentSystemPromptForFlow.substring(0,100)}... ||| ${currentTaskForOrchestrator.substring(0,200)}...`});

          try {
            const group = getGroupById(llmConfigSource.id);
            if (!group) throw new Error(`Grupo con ID ${llmConfigSource.id} no encontrado.`);

            const orchestratorResponse = await callChatWithAIGroup({
              userMessage: currentTaskForOrchestrator,
              groupMainTask: group.mainTask,
              participatingAgents: group.agentIds.map(id => {
                const agent = getAgentById(id) || DEFAULT_AGENTS.find(da => da.id === id);
                if (!agent) throw new Error(`Agente con ID ${id} no encontrado en el grupo ${group.name}.`);
                return { id: agent.id, name: agent.name, description: agent.description, systemPrompt: agent.systemPrompt, capabilities: agent.capabilities, llmConfig: agent.llmConfig };
              }),
              orchestratorAgentSystemPrompt: agentSystemPromptForFlow,
            });
            
            executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorRawResponse', { response: orchestratorResponse.orchestratorResponse.substring(0,300) + '...' }));
            addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `[MODO GRUPO - Turno ${turn}] Respuesta cruda Orquestador: ${orchestratorResponse.orchestratorResponse.substring(0,300)}...`});

            let decision: any;
            try {
              decision = JSON.parse(orchestratorResponse.orchestratorResponse);
            } catch (parseError: any) {
              const errorDetail = t('generateProject.logs.multiTurnLog.errorParsingOrchestratorResponse', { response: orchestratorResponse.orchestratorResponse.substring(0,200)+'...', parseError: parseError.message });
              executionLog.push(errorDetail); addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: errorDetail});
              accumulatedAiNotes += `\n${errorDetail}`; completed = true; break;
            }

            if(!decision || typeof decision.next_agent_id === 'undefined' || typeof decision.instruction_for_next_agent === 'undefined'){
                const errorDetail = t('generateProject.logs.multiTurnLog.errorOrchestratorMissingFields');
                executionLog.push(errorDetail); addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: errorDetail, data: decision});
                accumulatedAiNotes += `\n${errorDetail}`; completed = true; break;
            }

            executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorParsedDecision', { 
              nextAgentId: decision.next_agent_id || 'N/A', 
              instructionStart: (decision.instruction_for_next_agent || '').substring(0,50), 
              reasoningStart: (decision.reasoning || '').substring(0,50) 
            }));
            addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `[MODO GRUPO - Turno ${turn}] Decisión Orquestador:`, data: decision});

            if (decision.data_payload) {
              if (decision.data_payload.projectName) accumulatedProjectName = decision.data_payload.projectName;
              if (decision.data_payload.aiNotes) accumulatedAiNotes = (accumulatedAiNotes ? accumulatedAiNotes + "\n---\n" : "") + decision.data_payload.aiNotes;
              if (Array.isArray(decision.data_payload.files)) {
                  (decision.data_payload.files as GeneratedFile[]).forEach((newFile: GeneratedFile) => {
                      const existingFileIndex = accumulatedFiles.findIndex(f => f.path === newFile.path);
                      if (existingFileIndex > -1) accumulatedFiles[existingFileIndex] = { ...newFile, content: newFile.content ?? '', isFolder: newFile.isFolder ?? newFile.path.endsWith('/') };
                      else accumulatedFiles.push({ ...newFile, content: newFile.content ?? '', isFolder: newFile.isFolder ?? newFile.path.endsWith('/') });
                  });
              }
              executionLog.push(t('generateProject.logs.multiTurnLog.orchestratorDataAggregation', {projectName: accumulatedProjectName, aiNotesStart: accumulatedAiNotes.substring(0,50), filesCount: accumulatedFiles.length }));
            }

            if (decision.next_agent_id?.toUpperCase() === "COMPLETADO") {
              executionLog.push(t('generateProject.logs.multiTurnLog.processCompleted', { finalSummary: (decision.instruction_for_next_agent || "N/A").substring(0,100) }));
              addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `[MODO GRUPO - Turno ${turn}] Proceso completado por Orquestador.`});
              if (decision.data_payload && decision.data_payload.projectName && Array.isArray(decision.data_payload.files)) {
                accumulatedProjectName = decision.data_payload.projectName;
                accumulatedAiNotes = (accumulatedAiNotes ? accumulatedAiNotes + "\n---\n" : "") + (decision.data_payload.aiNotes || decision.instruction_for_next_agent || "");
                accumulatedFiles = (decision.data_payload.files as GeneratedFile[]).map((f:any) => ({ ...f, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
              } else if (decision.instruction_for_next_agent) {
                 // Attempt to parse instruction_for_next_agent as ProjectGenerationResult if data_payload is missing
                 try {
                   const finalProjectResult = JSON.parse(decision.instruction_for_next_agent) as ProjectGenerationResult;
                   if (finalProjectResult.projectName && Array.isArray(finalProjectResult.files)) {
                     accumulatedProjectName = finalProjectResult.projectName;
                     accumulatedAiNotes = (accumulatedAiNotes ? accumulatedAiNotes + "\n---\n" : "") + (finalProjectResult.aiNotes || "");
                     accumulatedFiles = finalProjectResult.files.map(f => ({ ...f, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
                   }
                 } catch (e) {
                   addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `[MODO GRUPO - Turno ${turn}] No se pudo parsear 'instruction_for_next_agent' como ProjectGenerationResult JSON.`});
                 }
              }
              completed = true; break;
            }

            const agentIdToCall = decision.next_agent_id;
            const instructionForAgent = decision.instruction_for_next_agent;
            const agentToCall = getAgentById(agentIdToCall) || DEFAULT_AGENTS.find(da => da.id === agentIdToCall);

            if (!agentToCall) {
              const errorDetail = t('generateProject.logs.multiTurnLog.errorAgentNotFound', { agentId: agentIdToCall });
              executionLog.push(errorDetail); addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: errorDetail});
              accumulatedAiNotes += `\n${errorDetail}`; completed = true; break;
            }
            
            executionLog.push(t('generateProject.logs.multiTurnLog.agentTurnStart', { turn, agentName: agentToCall.name }));
            executionLog.push(t('generateProject.logs.multiTurnLog.agentReceivingInstruction', { instruction: instructionForAgent.substring(0,100) + '...' }));
            addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `[MODO GRUPO - Turno ${turn}] Prompt para Agente ${agentToCall.name}: ${agentToCall.systemPrompt.substring(0,50)}... ||| ${instructionForAgent.substring(0,100)}...`});

            const agentResponse = await callChatWithAgentOrGlobal({
              userMessage: instructionForAgent,
              agentSystemPrompt: agentToCall.systemPrompt,
            });
            executionLog.push(t('generateProject.logs.multiTurnLog.agentRawResponse', { response: agentResponse.aiResponse.substring(0,300) + '...' }));
            addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `[MODO GRUPO - Turno ${turn}] Respuesta Agente ${agentToCall.name}: ${agentResponse.aiResponse.substring(0,100)}...`});

            currentTaskForOrchestrator = t('generateProject.logs.multiTurnLog.orchestratorNextInput', {
              agentName: agentToCall.name,
              agentInstruction: instructionForAgent.substring(0,100),
              agentResponse: agentResponse.aiResponse.substring(0,500),
              projectName: accumulatedProjectName,
              filesCount: accumulatedFiles.length,
              aiNotesStart: accumulatedAiNotes.substring(0,100),
              originalRequest: description.substring(0,100)
            });

          } catch (groupError: any) {
            const errorDetail = t('generateProject.logs.multiTurnLog.errorTurn', { turn, actor: 'Grupo', errorMessage: (groupError.friendlyMessage || groupError.message).substring(0,100) });
            executionLog.push(errorDetail); addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: errorDetail, errorDetails: groupError});
            accumulatedAiNotes += `\n${errorDetail}`; completed = true; break;
          }
          turn++;
        }

        if (!completed && turn > MAX_GENERATION_TURNS) {
          const limitMsg = t('generateProject.logs.multiTurnLog.maxTurnsReached', { maxTurns: MAX_GENERATION_TURNS });
          executionLog.push(limitMsg); addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: limitMsg});
          accumulatedAiNotes += `\n${limitMsg}`;
        }
        finalResultToSet = { 
            projectName: accumulatedProjectName, 
            aiNotes: accumulatedAiNotes, 
            files: accumulatedFiles.map(f => ({...f, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/')})), 
            groupLog: executionLog.join('\n\n') 
        };

      } else { // Modo Global o Agente Individual
        const generationInput: GenerateProjectInput = { description: finalPrompt, agentSystemPrompt: agentSystemPromptForFlow };
        addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Generando proyecto con Ajustes Globales/Agente. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`, data: generationInput, flowName: 'callGenerateProjectStructure - Single' });
        const aiResult = await callGenerateProjectStructure(generationInput);
        
        let contextLog = "";
        if (llmConfigSource?.type === 'Agente' && llmConfigSource.id && llmConfigSource.name) {
           const agent = getAgentById(llmConfigSource.id);
           contextLog = t('generateProject.logs.agentContextLog', {
              agentName: agent?.name || llmConfigSource.name,
              userInput: finalPrompt.substring(0, 100),
              agentContext: (agentSystemPromptForFlow || t('common.notAvailable' as TranslationKey)).substring(0, 200),
              flowName: `generateProjectStructure (Agente: ${agent?.name || 'N/A'})`,
            });
        }
        finalResultToSet = { ...aiResult, groupLog: aiResult.groupLog || contextLog };
      }
      
      if (finalResultToSet) {
          setResult(finalResultToSet);
          addDebugLog({
              source: 'GenerarProyectoPage',
              type: 'SUCCESS',
              message: "Generación de proyecto (o intento) finalizada. Resultado:",
              data: { name: finalResultToSet.projectName, files: finalResultToSet.files?.length, notesLen: finalResultToSet.aiNotes?.length, logLen: finalResultToSet.groupLog?.length }
          });
          toast({
              title: t('generateProject.toast.projectGenerated.title'),
              description: t('generateProject.toast.projectGenerated.description', { projectName: finalResultToSet.projectName || t('common.unknownError') })
          });
      } else {
          throw new AppError("No se pudo obtener un resultado final para el proyecto.", null, "ai");
      }
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorLog = `${t('generateProject.toast.generationError.title')}: ${e.friendlyMessage || e.message}`;
      setResult({ 
          projectName: t('generateProject.toast.generationError.title'), 
          aiNotes: e.friendlyMessage || t('generateProject.toast.generationError.description'), 
          files: [], 
          groupLog: errorLog
      });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('generateProject.toast.generationError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    description, 
    llmConfigSource, 
    agents, 
    groups, 
    getAgentById, 
    getGroupById, 
    t, 
    addDebugLog, 
    toast, 
    router, 
    setResult, 
    setChatHistory, 
    getAgentSystemPromptForFlow, 
    setCurrentPromptForDialog,
    setError 
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
    setCurrentPromptForDialog(description);
    setShowConfirmDialog(true);
  }, [description, toast, t, setCurrentPromptForDialog]);

  const handleDownloadProject = useCallback(async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title'),
        description: t('generateProject.toast.downloadError.descriptionNoFiles')
      });
      return;
    }
    const projectNameForFile = (result.projectName || 'proyecto_generado').replace(/\s+/g, '_').toLowerCase();
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${projectNameForFile}. Archivos: ${result.files.length}` });

    const zip = new JSZip();
    result.files.forEach(file => {
      let cleanPath = file.path;
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
      if (!cleanPath) {
        addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `Omitiendo archivo/carpeta con ruta vacía en ZIP.` });
        return;
      }

      if (file.isFolder || cleanPath.endsWith('/')) {
        const folderPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
        if (folderPath !== '/') { 
             zip.folder(folderPath);
             addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `Añadiendo carpeta a ZIP: ${folderPath}` });
        }
      } else {
        zip.file(cleanPath, file.content ?? '');
        addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `Añadiendo archivo a ZIP: ${cleanPath}, longitud contenido: ${file.content?.length ?? 0}` });
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
      const errorMsg = (e as Error).message || t('generateProject.toast.zipDownloadError.descriptionGeneric');
      toast({ variant: "destructive", title: t('generateProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  }, [result, t, toast, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: currentModificationRequest } });
    toast({ title: t('common.processing'), description: t('error.errorDisplay.toast.autofixAttempt.description') });
    // La lógica de llamar a callAutoFixErrorWithGroup está en ErrorDisplay
  }, [description, currentModificationRequest, addDebugLog, t, toast]);

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
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      setCurrentPromptForDialog(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Descripción de proyecto redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir descripción.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  }, [description, setDescription, setCurrentPromptForDialog, addDebugLog, t, toast, router, setError]);

  const handleRedefineInDialog = useCallback(async () => {
    if (!currentPromptForDialog.trim()) {
      toast({ variant: "destructive", title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningInDialog(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo prompt en diálogo. Original (inicio): ${currentPromptForDialog.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: currentPromptForDialog });
      setCurrentPromptForDialog(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Prompt en diálogo redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir prompt en diálogo.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      if (e instanceof AppError) {
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: e.friendlyMessage });
        if (e.redirectTo) { setShowConfirmDialog(false); router.push(e.redirectTo); }
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description');
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefiningInDialog(false);
    }
  }, [currentPromptForDialog, setCurrentPromptForDialog, addDebugLog, t, toast, router]);

  const handleProcessModification = useCallback(async () => {
    if (!currentModificationRequest.trim()) {
      toast({ variant: "destructive", title: t('generateProject.toast.emptyModificationRequest.title'), description: t('generateProject.toast.emptyModificationRequest.description') });
      return;
    }
    if (!result) {
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: t('generateProject.toast.noProjectToModify') });
      return;
    }

    setIsModifyingProject(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${currentModificationRequest}`, data: { currentProjectName: result.projectName } });

    setChatHistory(prev => [...prev, { id: uuidv4(), role: 'user', content: currentModificationRequest, timestamp: new Date().toISOString() }]);
    const tempCurrentModificationRequest = currentModificationRequest;
    setCurrentModificationRequest('');

    const agentSystemPromptForModification = getAgentSystemPromptForFlow();

    try {
      const inputForModification: ModifyProjectStructureInput = {
        currentProject: result,
        modificationRequest: tempCurrentModificationRequest,
        chatHistory: chatHistory,
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      setResult(modifiedProjectResult);

      const assistantResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.defaultAiNote' as TranslationKey);
      setChatHistory(prev => [...prev, { id: uuidv4(), role: 'assistant', content: assistantResponseMessage, timestamp: new Date().toISOString() }]);
      
      toast({ title: t('generateProject.toast.modificationSuccess.title'), description: t('generateProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length } });

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description'));
      setChatHistory(prev => [...prev, { id: uuidv4(), role: 'system', content: t('chat.systemMessage.errorPrefix') + errorMsg, timestamp: new Date().toISOString() }]);
      setError(errorMsg);
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsModifyingProject(false);
    }
  }, [
    currentModificationRequest, 
    result, 
    chatHistory, 
    llmConfigSource, 
    getAgentSystemPromptForFlow,
    agents, 
    groups, 
    getAgentById, 
    getGroupById, 
    t, 
    toast, 
    router, 
    addDebugLog, 
    setResult, 
    setError, 
    setChatHistory, 
    setCurrentModificationRequest
  ]);

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('generateProject.toast.noProjectToSave' as TranslationKey)});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName' as TranslationKey, { name: result.projectName || "Sin Nombre", time: new Date().toLocaleTimeString() });
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

    try {
      addSnapshot({
        name: snapshotName,
        code: stringifiedResult,
        source: 'generated-project',
        size: stringLength,
        fileCount: result.files?.length,
        metadata: { projectName: result.projectName }
      });
    } catch (e) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Error al llamar a addSnapshot para ${snapshotName}.`, errorDetails: e});
    }
  }, [result, addSnapshot, t, toast, addDebugLog]);


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
            t={t}
        />

        {error && <ErrorDisplay 
                    error={error} 
                    onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} 
                    context={`${t('generateProject.autofixContext.projectPromptLabel')}: "${description}" ${currentModificationRequest ? `${t('generateProject.autofixContext.lastModificationLabel')}: "${currentModificationRequest}"` : '' }`}
                  />}

        {isLoading && !result && <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{t('common.processing')}</div>}

        {result && (
          <GenerateProjectResultsDisplay
              result={result}
              t={t}
              onDownloadProject={handleDownloadProject}
              onSaveSnapshot={handleSaveGeneratedProjectSnapshot}
              chatHistory={chatHistory}
              currentModificationRequest={currentModificationRequest}
              onCurrentModificationRequestChange={setCurrentModificationRequest}
              onSendModificationRequest={handleProcessModification} // Cambiado a handleProcessModification
              isModifyingProject={isModifyingProject || isRedefiningModificationRequest}
              isRedefiningModificationRequest={isRedefiningModificationRequest}
              onRedefineModificationRequest={handleRedefineModificationRequest}
              scrollAreaRefChat={scrollAreaRefChat}
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