
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
} from '@/types';
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

const MAX_GENERATION_TURNS = 7; // Límite de turnos para la generación por grupo

/**
 * @fileOverview Página para generar una estructura base de proyecto usando IA.
 * Permite al usuario describir un proyecto, seleccionar una fuente de IA (global, agente o grupo),
 * y generar una estructura de archivos. Incluye una sección de chat para modificar interactivamente
 * el proyecto generado y la opción de guardar el resultado como un snapshot.
 * @module GenerarProyectoPage
 */
export default function GenerarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [currentPromptForDialog, setCurrentPromptForDialog] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Para la generación principal
  const [isRedefining, setIsRedefining] = useState(false); // Para el botón de redefinir descripción principal
  const [isRedefiningInDialog, setIsRedefiningInDialog] = useState(false); // Para redefinir en diálogo
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectGenerationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Estados para el chat de modificación
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentModificationRequest, setCurrentModificationRequest] = useState('');
  const [isModifyingProject, setIsModifyingProject] = useState(false);
  const [isRedefiningModificationRequest, setIsRedefiningModificationRequest] = useState(false);
  const scrollAreaRefChat = useRef<HTMLDivElement>(null);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    // Establecer valor inicial para llmConfigSource después del montaje
    setLlmConfigSource({ type: 'Ajustes Globales' });
  }, []);

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCurrentPromptForDialog(value); // Mantener sincronizado para el diálogo
  };

  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]); // Limpiar historial de chat al generar nuevo proyecto
    addDebugLog({
      source: 'GenerarProyectoPage',
      type: 'INFO',
      message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`,
      data: { config: llmConfigSource, fullPromptLength: finalPrompt.length },
      flowName: 'handleProjectGeneration'
    });

    let agentSystemPromptForFlow: string | undefined;
    let groupLogForDisplay: string | undefined;
    const orchestratorAgent = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPromptForFlow = agent?.systemPrompt;
      const logMsgKey = 'generateProject.logs.agentContextLog' as TranslationKey;
       groupLogForDisplay = t(logMsgKey, {
        agentName: agent?.name || llmConfigSource.name || 'N/A',
        userInput: finalPrompt.substring(0, 100),
        agentContext: (agentSystemPromptForFlow || t('autoupdate.logs.notAvailable')).substring(0, 200),
        flowName: `generateProjectStructure (Agente: ${agent?.name || 'N/A'})`,
      });
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const group = getGroupById(llmConfigSource.id);
      agentSystemPromptForFlow = orchestratorAgent?.systemPrompt; // Usar el prompt del orquestador del grupo
      const logMsgKey = 'generateProject.logs.groupContextLog' as TranslationKey;
      groupLogForDisplay = t(logMsgKey, {
        groupName: group?.name || llmConfigSource.name || 'N/A',
        groupTask: (group?.mainTask || 'N/A').substring(0,150),
        userInput: finalPrompt.substring(0, 100),
        orchestratorContext: (agentSystemPromptForFlow || t('autoupdate.logs.notAvailable')).substring(0, 200),
        flowName: `generateProjectStructure (Grupo: ${group?.name || 'N/A'})`,
      });
    }

    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPromptForFlow,
    };

    try {
      const aiResult = await callGenerateProjectStructure(generationInput);
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Respuesta de callGenerateProjectStructure recibida.", data: { projectName: aiResult.projectName, numFiles: aiResult.files?.length, notesLength: aiResult.aiNotes?.length, groupLogLength: aiResult.groupLog?.length } });
      
      // Usar el groupLog del flujo si existe (modo grupo), si no, el de contexto.
      const finalGroupLog = aiResult.groupLog || groupLogForDisplay;
      setResult({ ...aiResult, groupLog: finalGroupLog });

      toast({
        title: t('generateProject.toast.projectGenerated.title'),
        description: t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName || t('common.unknownError') })
      });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorLog = `Error al generar proyecto: ${e.friendlyMessage || e.message}\n${groupLogForDisplay || ''}`;
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
        description: t('generateProject.toast.downloadError.descriptionNoFiles') // Nueva clave para "no files"
      });
      return;
    }
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${result.projectName}. Archivos: ${result.files.length}` });
    
    const zip = new JSZip();
    result.files.forEach(file => {
      const path = file.path.startsWith('/') ? file.path.substring(1) : file.path;
      if (file.isFolder || path.endsWith('/')) {
        if (path && path !== '/') zip.folder(path);
      } else {
        // Asegurar que el contenido es una cadena; si es null o undefined, usar cadena vacía.
        zip.file(path, file.content ?? '');
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
        description: t('generateProject.toast.zipDownloadSuccess.description', { filename, projectName: result.projectName || t('common.unknownError') })
      });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
      handleSaveGeneratedProjectSnapshot(); // Guardar snapshot después de la descarga
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('generateProject.toast.zipDownloadError.descriptionGeneric');
      toast({ variant: "destructive", title: t('generateProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}` });
    }
  };

  const handleAutoFixError = async (errorMsgToFix: string) => {
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: currentModificationRequest } });
    // La lógica de llamar a callAutoFixErrorWithGroup está en ErrorDisplay
  };

  const handleRedefineRequest = async () => {
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
      setCurrentPromptForDialog(resultOutput.redefinedPrompt); // Actualizar también para el diálogo
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
  };

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
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      // No establecer setError aquí para no afectar el ErrorDisplay principal
      if (e instanceof AppError && e.redirectTo) {
        setShowConfirmDialog(false); // Cerrar diálogo antes de redirigir
        router.push(e.redirectTo);
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
      const orchestrator = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
      agentSystemPromptForModification = orchestrator?.systemPrompt;
    }
    
    try {
      const modificationInput = {
        currentProject: result,
        modificationRequest: tempCurrentModificationRequest,
        chatHistory: chatHistory,
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(modificationInput);
      
      setResult(modifiedProjectResult); // Actualizar el estado principal del proyecto

      const assistantResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.defaultAiNote');
      const aiMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content: assistantResponseMessage, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiMessage]);

      toast({ title: t('generateProject.toast.modificationSuccess.title'), description: t('generateProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotes: modifiedProjectResult.aiNotes, newFilesCount: modifiedProjectResult.files.length } });

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description'));
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
      const resultOutput = await callRedefinePrompt({ originalPrompt: currentModificationRequest });
      setCurrentModificationRequest(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `'currentModificationRequest' redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir 'currentModificationRequest'.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      // No establecer setError aquí para no afectar el ErrorDisplay principal del proyecto
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationRequest(false);
    }
  };

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('generateProject.toast.noProjectToSave')});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName', { name: result.projectName || "Sin Nombre", time: new Date().toLocaleTimeString() });
    addSnapshot({
      name: snapshotName,
      code: JSON.stringify(result, null, 2), // Guardar el ProjectGenerationResult completo
      source: 'generated-project'
    });
    // El toast de confirmación ya lo maneja addSnapshot
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Snapshot de proyecto generado guardado: ${snapshotName}`});
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
            isLoading={isLoading || isRedefining} // isLoading general para toda la sección superior
            isRedefining={isRedefining} // Específico para el botón de redefinir descripción principal
            onRedefineRequest={handleRedefineRequest}
            t={t}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error)} context={`Prompt del proyecto: "${description}"`} />}
        
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
              onSendModificationRequest={handleSendModificationRequest}
              isModifyingProject={isModifyingProject || isRedefiningModificationRequest} // Bloquear mientras se modifica o redefine el input del chat
              isRedefiningModificationRequest={isRedefiningModificationRequest} // Específico para el botón de redefinir del chat
              onRedefineModificationRequest={handleRedefineModificationRequest}
              scrollAreaRefChat={scrollAreaRefChat}
          />
        )}
        {/* El LogsDisplay ahora se maneja dentro de GenerateProjectResultsDisplay si result.groupLog existe */}
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
