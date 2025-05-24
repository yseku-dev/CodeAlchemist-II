
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
  AppSourceFile, // Asegúrate que AppSourceFile esté importado si se usa explícitamente aquí
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
  const [currentPromptForDialog, setCurrentPromptForDialog] = useLocalStorage<string>('codealchemist-gp-currentPromptForDialog', description);
  
  const [result, setResult] = useLocalStorage<ProjectGenerationResult | null>('codealchemist-gp-result', null);
  
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

  // Sincronizar currentPromptForDialog con description si no está en un diálogo de confirmación
  useEffect(() => {
    if (!showConfirmDialog) {
      setCurrentPromptForDialog(description);
    }
  }, [description, showConfirmDialog, setCurrentPromptForDialog]);


  const getAgentSystemPromptForFlow = useCallback((): string | undefined => {
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      return agent?.systemPrompt;
    }
    if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      // Para generación de proyecto por grupo, el flujo espera el prompt del orquestador
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
    
    const flowName = llmConfigSource?.type === 'Grupo' ? 'generateProjectStructure (Grupo)' : 'generateProjectStructure (Global/Agente)';
    addDebugLog({
      source: 'GenerarProyectoPage',
      type: 'INFO',
      message: `Iniciando generación de proyecto. Prompt (inicio): ${finalPrompt.substring(0, 100)}...`,
      data: { config: llmConfigSource, fullPromptLength: finalPrompt.length },
      flowName
    });

    const agentSystemPromptForFlow = getAgentSystemPromptForFlow();
    const generationInput: GenerateProjectInput = { description: finalPrompt, agentSystemPrompt: agentSystemPromptForFlow };

    let aiResult: ProjectGenerationResult | null = null;

    try {
      aiResult = await callGenerateProjectStructure(generationInput);
      
      let groupLogForDisplay = aiResult.groupLog; // Usar el log del flujo si existe (modo grupo)

      if (!groupLogForDisplay && llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestratorAgent = getAgentById(ORCHESTRATOR_AGENT_ID);
        groupLogForDisplay = t('generateProject.logs.groupContextLog', {
           groupName: llmConfigSource.name,
           groupTask: (group?.mainTask || 'N/A').substring(0,150),
           userInput: finalPrompt.substring(0,100),
           orchestratorContext: (agentSystemPromptForFlow || t('common.notAvailable' as TranslationKey)).substring(0, 200),
           flowName,
         });
      } else if (!groupLogForDisplay && llmConfigSource?.type === 'Agente' && llmConfigSource.name && llmConfigSource.id) {
         const agent = getAgentById(llmConfigSource.id || '');
         groupLogForDisplay = t('generateProject.logs.agentContextLog' as TranslationKey, {
            agentName: agent?.name || llmConfigSource.name,
            userInput: finalPrompt.substring(0, 100),
            agentContext: (agentSystemPromptForFlow || t('common.notAvailable' as TranslationKey)).substring(0, 200),
            flowName,
          });
      }
      
      const finalResultToSet: ProjectGenerationResult = {
          projectName: aiResult.projectName || t('generateProject.results.defaultProjectName' as TranslationKey),
          aiNotes: aiResult.aiNotes || t('generateProject.results.initialAiNotes' as TranslationKey),
          files: aiResult.files || [],
          groupLog: groupLogForDisplay,
      };

      setResult(finalResultToSet);
      addDebugLog({
          source: 'GenerarProyectoPage',
          type: 'SUCCESS',
          message: "Generación de proyecto finalizada.",
          data: { name: finalResultToSet.projectName, files: finalResultToSet.files?.length, notesLen: finalResultToSet.aiNotes?.length, logLen: finalResultToSet.groupLog?.length }
      });
      toast({
          title: t('generateProject.toast.projectGenerated.title'),
          description: t('generateProject.toast.projectGenerated.description', { projectName: finalResultToSet.projectName || t('common.unknownError') })
      });

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en generación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      const errorFriendlyMessage = e.friendlyMessage || (e.message || t('generateProject.toast.generationError.description'));
      const errorLogMessage = `${t('generateProject.toast.generationError.title')}: ${errorFriendlyMessage}`;
      
      setResult({ 
          projectName: t('generateProject.results.defaultProjectName' as TranslationKey), 
          aiNotes: `${t('generateProject.results.initialAiNotes' as TranslationKey)}\n\nERROR: ${errorFriendlyMessage}`, 
          files: [], 
          groupLog: errorLogMessage
      });
      setError(errorFriendlyMessage);
      toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorFriendlyMessage });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsLoading(false);
    }
  }, [
    llmConfigSource, 
    agents, 
    getAgentById, 
    getGroupById, 
    t, 
    addDebugLog, 
    toast, 
    router, 
    setResult, 
    getAgentSystemPromptForFlow,
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
    // currentPromptForDialog se actualiza con description en el useEffect
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
      if (!cleanPath) return;

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
      const errorMsg = (e as Error).message || t('generateProject.toast.zipDownloadError.descriptionGeneric');
      toast({ variant: "destructive", title: t('generateProject.toast.zipDownloadError.title'), description: errorMsg });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Fallo al generar/descargar ZIP: ${errorMsg}`, errorDetails: e });
    }
  }, [result, t, toast, addDebugLog]);

  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentProjectPrompt: description, modificationRequest: modificationPrompt } });
    toast({ title: t('common.processing'), description: t('error.errorDisplay.toast.autofixAttempt.description') });
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
      // currentPromptForDialog se actualizará por el useEffect
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: `Descripción de proyecto redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir descripción.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
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
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo al redefinir prompt en diálogo.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) { setShowConfirmDialog(false); router.push(e.redirectTo); }
    } finally {
      setIsRedefiningInDialog(false);
    }
  }, [currentPromptForDialog, setCurrentPromptForDialog, addDebugLog, t, toast, router]);

  const handleProcessModification = useCallback(async () => {
    if (!modificationPrompt.trim()) {
      toast({ variant: "destructive", title: t('generateProject.toast.emptyModificationRequest.title'), description: t('generateProject.toast.emptyModificationRequest.description') });
      return;
    }
    if (!result) {
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: t('generateProject.toast.noProjectToModify') });
      return;
    }

    setIsProcessingModification(true);
    const flowName = 'callModifyProjectStructure (GenerarProyecto)';
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Enviando petición de modificación: ${modificationPrompt}`, data: { currentProjectName: result.projectName }, flowName });

    const tempCurrentModificationRequest = modificationPrompt;
    setModificationPrompt(''); // Clear input immediately

    const agentSystemPromptForModification = getAgentSystemPromptForFlow();

    try {
      const inputForModification: ModifyProjectStructureInput = {
        currentProject: { // Asegurarse que files tenga la estructura correcta {path, content, isFolder?}
            projectName: result.projectName || t('generateProject.results.defaultProjectName' as TranslationKey),
            aiNotes: result.aiNotes || '',
            files: (result.files || []).map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })),
        },
        modificationRequest: tempCurrentModificationRequest,
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(inputForModification);
      
      // Actualizar el resultado principal con el proyecto modificado
      setResult(prevResult => ({
          ...(prevResult || { projectName: '', aiNotes: '', files: [] }), // Fallback si prevResult es null
          ...modifiedProjectResult,
          // Asegurar que el groupLog del resultado original no se pierda si el flujo de modificación no devuelve uno
          groupLog: modifiedProjectResult.groupLog || prevResult?.groupLog 
      }));
      
      toast({ title: t('generateProject.toast.modificationSuccess.title'), description: t('generateProject.toast.modificationSuccess.description') });
      addDebugLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Modificación de proyecto exitosa.', data: { newNotesLength: modifiedProjectResult.aiNotes.length, newFilesCount: modifiedProjectResult.files.length }, flowName});

    } catch (e: any) {
      addDebugLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: "Fallo en modificación de proyecto (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('generateProject.toast.modificationError.description'));
      setError(errorMsg);
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsProcessingModification(false);
    }
  }, [
    modificationPrompt, 
    result, 
    llmConfigSource, 
    getAgentSystemPromptForFlow,
    t, 
    toast, 
    router, 
    addDebugLog, 
    setResult, 
    setError, 
    setModificationPrompt
  ]);

  const handleSaveGeneratedProjectSnapshot = useCallback(() => {
    if (!result) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title'), description: t('generateProject.toast.noProjectToSave' as TranslationKey)});
      return;
    }
    const snapshotName = t('generateProject.results.snapshotName' as TranslationKey, { name: (result.projectName || "Sin_Nombre").substring(0,30), time: new Date().toLocaleTimeString() });
    const stringifiedResult = JSON.stringify(result, null, 2);
    const stringLength = stringifiedResult.length;
    addDebugLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Intentando guardar snapshot: ${snapshotName}. Longitud del JSON: ${stringLength} caracteres.`});
    
    if (stringLength > 4.5 * 1024 * 1024) { // Aprox 4.5MB limit for safety
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
        fileCount: result.files?.length || 0,
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
            onDescriptionChange={setDescription}
            onGenerateClick={handleGenerateClick}
            isLoading={isLoading || isRedefining}
            isRedefining={isRedefining}
            onRedefineRequest={handleRedefineRequest}
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
              modificationPrompt={modificationPrompt}
              onCurrentModificationRequestChange={setModificationPrompt}
              onSendModificationRequest={handleProcessModification}
              isModifyingProject={isProcessingModification || isRedefiningModificationPrompt}
              isRedefiningModificationRequest={isRedefiningModificationPrompt}
              onRedefineModificationRequest={handleRedefineRequest} // Debería ser handleRedefineModificationRequest
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

