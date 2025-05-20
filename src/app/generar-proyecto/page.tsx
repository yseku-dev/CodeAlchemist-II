
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
    setCurrentPromptForDialog(value); 
  };

  const getAgentSystemPromptForFlow = useCallback((): string | undefined => {
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      return agent?.systemPrompt;
    }
    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const orchestratorAgent = DEFAULT_AGENTS.find(a => a.id === 'orquestador-flujo-agentes');
      return orchestratorAgent?.systemPrompt;
    }
    return undefined;
  }, [llmConfigSource, getAgentById, agents]); // Added agents to dependencies

  const handleProjectGeneration = async (finalPrompt: string) => {
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
    let groupLogForDisplay: string | undefined;

    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
      const group = getGroupById(llmConfigSource.id);
      groupLogForDisplay = t('generateProject.logs.groupContextLog', {
        groupName: llmConfigSource.name,
        groupTask: (group?.mainTask || 'N/A').substring(0,150),
        userInput: finalPrompt.substring(0, 100),
        orchestratorContext: (agentSystemPromptForFlow || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
        flowName: `generateProjectStructure (Grupo: ${group?.name || 'N/A'})`,
      });
    } else if (llmConfigSource?.type === 'Agente' && llmConfigSource.id && llmConfigSource.name) {
       const agent = getAgentById(llmConfigSource.id);
       groupLogForDisplay = t('generateProject.logs.agentContextLog' as TranslationKey, {
        agentName: agent?.name || llmConfigSource.name,
        userInput: finalPrompt.substring(0, 100),
        agentContext: (agentSystemPromptForFlow || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
        flowName: `generateProjectStructure (Agente: ${agent?.name || 'N/A'})`,
      });
    }


    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPromptForFlow,
    };

    try {
      const aiResult = await callGenerateProjectStructure(generationInput);
      addDebugLog({ 
        source: 'GenerarProyectoPage', 
        type: 'SUCCESS', 
        message: "Respuesta de callGenerateProjectStructure recibida.", 
        data: { 
          projectName: aiResult.projectName, 
          numFiles: aiResult.files?.length, 
          notesLength: aiResult.aiNotes?.length, 
          groupLogLength: aiResult.groupLog?.length 
        } 
      });
      
      const finalResult = {
        ...aiResult,
        groupLog: aiResult.groupLog || groupLogForDisplay,
      };
      setResult(finalResult);

      toast({
        title: t('generateProject.toast.projectGenerated.title'),
        description: t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName || t('common.unknownError' as TranslationKey) })
      });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorLog = `${t('generateProject.toast.generationError.title')}: ${e.friendlyMessage || e.message}\n${groupLogForDisplay || ''}`;
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
        title: t('generateProject.toast.downloadError.title' as TranslationKey),
        description: t('generateProject.toast.downloadError.descriptionNoFiles' as TranslationKey)
      });
      return;
    }
    const projectNameForFile = (result.projectName || 'proyecto_generado').replace(/\s+/g, '_').toLowerCase();
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Preparando descarga ZIP para proyecto: ${projectNameForFile}. Archivos: ${result.files.length}` });
    
    const zip = new JSZip();
    result.files.forEach(file => {
      let cleanPath = file.path;
      // Eliminar barras iniciales si existen para evitar problemas de ruta absoluta en algunos descompresores
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }
      if (!cleanPath) {
        addDebugLog({ source: 'GenerarProyectoPage', type: 'WARN', message: `Omitiendo archivo/carpeta con ruta vacía en ZIP.` });
        return; // Omitir entradas con ruta vacía
      }

      if (file.isFolder || cleanPath.endsWith('/')) {
        // Asegurarse de que las rutas de carpeta no estén vacías y terminen en /
        const folderPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
        if (folderPath !== '/') { // No intentar crear la carpeta raíz explícitamente si es solo "/"
             zip.folder(folderPath);
             addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `Añadiendo carpeta a ZIP: ${folderPath}` });
        }
      } else {
        // Asegurar que el contenido es una cadena; si es null o undefined, usar cadena vacía.
        zip.file(cleanPath, file.content ?? '');
        addDebugLog({ source: 'GenerarProyectoPage', type: 'DEBUG', message: `Añadiendo archivo a ZIP: ${cleanPath}, longitud contenido: ${file.content?.length ?? 0}` });
      }
    });

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = `${projectNameForFile}.zip`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({
        title: t('generateProject.toast.zipDownloadSuccess.title' as TranslationKey),
        description: t('generateProject.toast.zipDownloadSuccess.description' as TranslationKey, { filename, projectName: result.projectName || t('common.unknownError' as TranslationKey) })
      });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Proyecto "${result.projectName}" descargado como ${filename}.` });
    } catch (e: any) {
      const errorMsg = (e as Error).message || t('generateProject.toast.zipDownloadError.descriptionGeneric' as TranslationKey);
      toast({ variant: "destructive", title: t('generateProject.toast.zipDownloadError.title' as TranslationKey), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  };

  const handleAutoFixError = async (errorMsgToFix: string) => {
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: currentModificationRequest } });
    // La lógica de llamar a callAutoFixErrorWithGroup está en ErrorDisplay
  };

  const handleRedefineRequest = async () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefining(true);
    setError(null);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo descripción de proyecto. Original (inicio): ${description.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      setCurrentPromptForDialog(resultOutput.redefinedPrompt); 
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Descripción de proyecto redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir descripción.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  };

  const handleRedefineInDialog = async () => {
    if (!currentPromptForDialog.trim()) {
      toast({ variant: "destructive", title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningInDialog(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo prompt en diálogo. Original (inicio): ${currentPromptForDialog.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: currentPromptForDialog });
      setCurrentPromptForDialog(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Prompt en diálogo redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir prompt en diálogo.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) {
        setShowConfirmDialog(false); 
        router.push(e.redirectTo);
      }
    } finally {
      setIsRedefiningInDialog(false);
    }
  };

  const handleSendModificationRequest = async () => {
    if (!currentModificationRequest.trim() || !result) {
      toast({ variant: "destructive", title: t('generateProject.toast.emptyModificationRequest.title' as TranslationKey), description: t('generateProject.toast.emptyModificationRequest.description' as TranslationKey) });
      return;
    }
    setIsModifyingProject(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${currentModificationRequest}`, data: { currentProjectName: result.projectName } });

    const userMessage: ChatMessage = { id: uuidv4(), role: 'user', content: currentModificationRequest, timestamp: new Date().toISOString() };
    setChatHistory(prev => [...prev, userMessage]);
    const tempCurrentModificationRequest = currentModificationRequest;
    setCurrentModificationRequest('');

    const agentSystemPromptForModification = getAgentSystemPromptForFlow();
    
    try {
      const modificationInput = {
        currentProject: result,
        modificationRequest: tempCurrentModificationRequest,
        chatHistory: chatHistory,
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(modificationInput);
      
      setResult(modifiedProjectResult); 

      const assistantResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.defaultAiNote' as TranslationKey);
      const aiMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content: assistantResponseMessage, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiMessage]);

      toast({ title: t('generateProject.toast.modificationSuccess.title' as TranslationKey), description: t('generateProject.toast.modificationSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotes: modifiedProjectResult.aiNotes, newFilesCount: modifiedProjectResult.files.length } });

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description' as TranslationKey));
      const systemErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: t('chat.systemMessage.errorPrefix' as TranslationKey) + errorMsg, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, systemErrorMessage]);
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsModifyingProject(false);
    }
  };
  
  const handleRedefineModificationRequest = async () => {
    if (!currentModificationRequest.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningModificationRequest(true);
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefiniendo petición de modificación. Original (inicio): ${currentModificationRequest.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: currentModificationRequest });
      setCurrentModificationRequest(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `'currentModificationRequest' redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir 'currentModificationRequest'.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationRequest(false);
    }
  };

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('generateProject.toast.noProjectToSave' as TranslationKey)});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName' as TranslationKey, { name: result.projectName || "Sin Nombre", time: new Date().toLocaleTimeString() });
    const stringifiedResult = JSON.stringify(result, null, 2);
    const stringLength = stringifiedResult.length;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando guardar snapshot: ${snapshotName}. Longitud del JSON: ${stringLength} caracteres.`});
    if (stringLength > 4.5 * 1024 * 1024) { // Approx 4.5MB to be safe for ~5MB limit
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
        source: 'generated-project'
      });
    } catch (e) {
      // This catch might not be effective if useLocalStorage itself handles the QuotaExceededError
      // and doesn't re-throw, but it's good for other potential errors.
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Error al llamar a addSnapshot para ${snapshotName}.`, errorDetails: e});
      // Toast for quota exceeded is now handled within useLocalStorage
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

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))} context={`Prompt del proyecto: "${description}" ${currentModificationRequest ? `Última petición de modificación: "${currentModificationRequest}"` : '' }`} />}
        
        {isLoading && !result && <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin mr-2"/>{t('common.processing' as TranslationKey)}</div>}

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
        title={t('generateProject.confirmDialog.title' as TranslationKey)}
        confirmText={t('generateProject.confirmDialog.confirmButton' as TranslationKey)}
        cancelText={t('common.cancel' as TranslationKey)}
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
                  aria-label={t('common.redefineRequestButton' as TranslationKey)}
                >
                  {isRedefiningInDialog ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                  {t('common.redefineRequestButton' as TranslationKey)}
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

