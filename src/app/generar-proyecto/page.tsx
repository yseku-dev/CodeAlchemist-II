
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
import type { LLMConfigSourceOption, ProjectGenerationResult, GenerateProjectInput, Agent, RedefinePromptOutput, AIAgentGroup, ChatMessage, ModifyProjectStructureInput, CodeSnapshot } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import LogsDisplay from '@/components/logs-display';
import { useAppState } from '@/context/AppStateContext';
import { AppError } from '@/utils/AppError';
import { callGenerateProjectStructure, callRedefinePrompt, callModifyProjectStructure } from '@/utils/apiClient';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_AGENTS } from '@/lib/constants';

import GenerateProjectHeader from '@/components/features/generar-proyecto/GenerateProjectHeader';
import GenerateProjectForm from '@/components/features/generar-proyecto/GenerateProjectForm';
import GenerateProjectResultsDisplay from '@/components/features/generar-proyecto/GenerateProjectResultsDisplay';

const MAX_GENERATION_TURNS = 7; // Límite de turnos para la generación de proyectos por grupo

/**
 * @fileOverview GenerarProyectoPage component allows users to generate a base project structure.
 * Users describe the project, select an LLM configuration source, and the AI generates
 * a suggested project name, notes, and a list of files with their content.
 * The generated structure can be downloaded as a ZIP (containing a JSON representation).
 * After generation, users can interactively request modifications to the project via a chat interface,
 * which calls an AI flow to attempt real modifications to the project structure.
 * The current state of the project can be saved as a snapshot.
 * All UI texts are internationalized.
 */
export default function GenerarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRedefining, setIsRedefining] = useState(false);
  const [isRedefiningInDialog, setIsRedefiningInDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectGenerationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // States for modification chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentModificationRequest, setCurrentModificationRequest] = useState('');
  const [isModifyingProject, setIsModifyingProject] = useState(false);
  const [isRedefiningModificationRequest, setIsRedefiningModificationRequest] = useState(false);
  const scrollAreaRefChat = useRef<HTMLDivElement>(null);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    setLlmConfigSource({ type: 'Ajustes Globales' });
  }, []);

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCurrentPromptForDialog(value);
  };

  const getAgentSystemPrompt = useCallback((agentId: string): string => {
    const agent = DEFAULT_AGENTS.find(a => a.id === agentId);
    return agent?.systemPrompt || `Eres un asistente IA. Tu tarea actual es: `;
  }, []);


  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`, data: { config: llmConfigSource } });

    let agentSystemPromptForFlow: string | undefined;
    let isGroupExecution = false;

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPromptForFlow = agent?.systemPrompt;
      addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Usando Agente: ${llmConfigSource.name}. Prompt del agente (inicio): ${agentSystemPromptForFlow?.substring(0, 100)}...` });
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
      agentSystemPromptForFlow = orchestrator?.systemPrompt;
      isGroupExecution = true;
      addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Usando Grupo: ${llmConfigSource.name}. Prompt del Orquestador (inicio): ${agentSystemPromptForFlow?.substring(0, 100)}...` });
    }

    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPromptForFlow,
    };

    try {
      const aiResult = await callGenerateProjectStructure(generationInput);
      let finalResult = { ...aiResult };

      if (isGroupExecution && !aiResult.groupLog) {
        const group = getGroupById(llmConfigSource?.id || '');
        finalResult.groupLog = t('generateProject.logs.groupContextLog', {
          groupName: group?.name || llmConfigSource?.name || 'N/A',
          groupTask: (group?.mainTask || 'N/A').substring(0, 150),
          userInput: finalPrompt.substring(0, 100),
          orchestratorContext: (agentSystemPromptForFlow || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
          flowName: 'generateProjectStructure (Grupo - fallback log)',
        });
        addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: "Flujo de grupo no devolvió groupLog, generando log de contexto.", data: finalResult.groupLog });
      } else if (isGroupExecution && aiResult.groupLog) {
         addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: "Flujo de grupo devolvió groupLog detallado.", data: {logLength: aiResult.groupLog.length} });
      }


      setResult(finalResult);
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Generación de proyecto exitosa (llamada a API).", data: { projectName: finalResult.projectName, numFiles: finalResult.files?.length, notesLength: finalResult.aiNotes?.length, groupLogLength: finalResult.groupLog?.length } });
      toast({
        title: t('generateProject.toast.projectGenerated.title'),
        description: t('generateProject.toast.projectGenerated.description', { projectName: finalResult.projectName || "Proyecto Sin Nombre" })
      });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = e.message || t('generateProject.toast.generationError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClick = () => {
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
  };

  const handleDownloadProject = async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title'),
        description: t('generateProject.toast.downloadError.description')
      });
      return;
    }
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${result.projectName}.` });
    const zip = new JSZip();
    result.files.forEach(file => {
      if (file.isFolder || file.path.endsWith('/')) {
        const folderPath = file.path === '/' ? '' : file.path.startsWith('/') ? file.path.substring(1) : file.path;
        if (folderPath) zip.folder(folderPath);
      } else {
        zip.file(file.path, file.content || '');
      }
    });
    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = `${(result.projectName || 'proyecto_generado').replace(/\s+/g, '_').toLowerCase()}.zip`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({
        title: t('generateProject.toast.zipDownloadSuccess.title'),
        description: t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName: result.projectName || "Proyecto Sin Nombre" })
      });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
    } catch (e: any) {
      const errorMsg = e.message || t('generateProject.toast.zipDownloadError.description', { error: "desconocido" });
      toast({ variant: "destructive", title: t('generateProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}` });
    }
  };

  const handleAutoFixError = async (errorMsg: string) => {
    toast({ title: t('common.processing'), description: t('errorDisplay.toast.autofixAttempt.description') });
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsg}` });
    // La lógica real de Auto-Fix se maneja en ErrorDisplay y llama a callAutoFixErrorWithGroup
  };

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
        const errorMsg = e.message || t('common.toast.redefineError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  }, [description, t, toast, addDebugLog, router]);

  const handleRedefineInDialog = async () => {
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
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = e.message || t('common.toast.redefineError.description');
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefiningInDialog(false);
    }
  };

  const handleSendModificationRequest = async () => {
    if (!currentModificationRequest.trim() || !result) {
      toast({ variant: "destructive", title: t('generateProject.toast.emptyModificationRequest.title'), description: t('generateProject.toast.emptyModificationRequest.description') });
      return;
    }
    setIsModifyingProject(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${currentModificationRequest}`, data: { currentProjectName: result.projectName } });

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: currentModificationRequest, timestamp: new Date().toISOString() };
    setChatHistory(prev => [...prev, userMessage]);
    const tempCurrentModificationRequest = currentModificationRequest;
    setCurrentModificationRequest('');

    let agentSystemPromptForModification: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPromptForModification = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const group = getGroupById(llmConfigSource.id);
      const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
      agentSystemPromptForModification = orchestrator?.systemPrompt || group?.mainTask;
    }
    
    try {
      const modificationInput: ModifyProjectStructureInput = {
        currentProject: result, // El ProjectGenerationResult actual
        modificationRequest: tempCurrentModificationRequest,
        chatHistory: chatHistory,
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(modificationInput);
      
      setResult(modifiedProjectResult); // <--- ACTUALIZAR EL ESTADO DEL PROYECTO

      const assistantResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.defaultAiNote');
      const aiMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content: assistantResponseMessage, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiMessage]);

      toast({ title: t('generateProject.toast.modificationSuccess.title'), description: t('generateProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotes: modifiedProjectResult.aiNotes } });

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('generateProject.toast.modificationError.description'));
      const systemErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: t('chat.systemMessage.errorPrefix') + errorMsg, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, systemErrorMessage]);
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsModifyingProject(false);
    }
  };

  const handleRedefineModificationRequest = async () => {
    if (!currentModificationRequest.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningModificationRequest(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo petición de modificación. Original (inicio): ${currentModificationRequest.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const redefined = await callRedefinePrompt({ originalPrompt: currentModificationRequest });
      setCurrentModificationRequest(redefined.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Petición de modificación redefinida."});
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al redefinir petición de modificación.`, errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationRequest(false);
    }
  };

  const handleSaveGeneratedProjectSnapshot = () => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.compareError.title'), description: "No hay proyecto generado para guardar."}); // Reutilizar un toast de error
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName', { name: result.projectName || "Proyecto Sin Nombre", time: new Date().toLocaleTimeString() });
    addSnapshot({
      name: snapshotName,
      code: JSON.stringify(result, null, 2),
      source: 'generated-project'
    });
    toast({ title: t('versions.toast.snapshotSaved.title'), description: t('versions.toast.snapshotSaved.description', {name: snapshotName})});
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Snapshot de proyecto generado guardado: ${snapshotName}`});
  };

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

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} />}
        
        {isLoading && !result && <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{t('common.processing')}</div>}

        {result && (
          <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
            <GenerateProjectResultsDisplay
                result={result}
                t={t}
                onDownloadProject={handleDownloadProject}
                chatHistory={chatHistory}
                currentModificationRequest={currentModificationRequest}
                onCurrentModificationRequestChange={setCurrentModificationRequest}
                onSendModificationRequest={handleSendModificationRequest}
                isModifyingProject={isModifyingProject}
                isRedefiningModificationRequest={isRedefiningModificationRequest}
                onRedefineModificationRequest={handleRedefineModificationRequest}
                scrollAreaRefChat={scrollAreaRefChat}
                onSaveSnapshot={handleSaveGeneratedProjectSnapshot} // Nueva prop
            />
             {result.groupLog && (!chatHistory || chatHistory.length === 0) && ( 
              <LogsDisplay title={t('generateProject.results.groupLogTitle')} logs={result.groupLog} defaultExpanded={true}/>
            )}
          </div>
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

    
