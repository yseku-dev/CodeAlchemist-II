
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
import type { LLMConfigSourceOption, ProjectGenerationResult, GenerateProjectInput, Agent, RedefinePromptOutput, AIAgentGroup, ChatMessage, ModifyProjectStructureInput } from '@/types';
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

import GenerateProjectHeader from '@/components/features/generar-proyecto/GenerateProjectHeader';
import GenerateProjectForm from '@/components/features/generar-proyecto/GenerateProjectForm';
import GenerateProjectResultsDisplay from '@/components/features/generar-proyecto/GenerateProjectResultsDisplay';


/**
 * @fileOverview GenerarProyectoPage component allows users to generate a base project structure.
 * Users describe the project, select an LLM configuration source, and the AI generates
 * a suggested project name, notes, and a list of files with their content.
 * The generated structure can be downloaded.
 * After generation, users can interactively request modifications to the project via a chat interface.
 * All UI texts are internationalized.
 */
export default function GenerarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById } = useAppState();
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

  const { addLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    // Initialize on client to avoid SSR issues with localStorage access from useAppState
    setLlmConfigSource({ type: 'Ajustes Globales' });
  }, []);

  useEffect(() => {
    if (scrollAreaRefChat.current) {
      scrollAreaRefChat.current.scrollTo({ top: scrollAreaRefChat.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    setCurrentPromptForDialog(value); // Keep dialog prompt in sync
  };

  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]); // Clear chat history for new project

    let agentSystemPrompt: string | undefined;
    let flowName = 'generateProjectStructure';
    const orchestratorAgent = getAgentById('orquestador-flujo-agentes');

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
      flowName = `generateProjectStructure (Agent: ${agent?.name || llmConfigSource.id})`;
      addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Generating project with Agent: ${llmConfigSource.name}. Agent's system prompt will be used.`, flowName});
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
      const group = getGroupById(llmConfigSource.id);
      agentSystemPrompt = group?.mainTask; // Use group's main task as context for project generation
      flowName = `generateProjectStructure (Group: ${group?.name || llmConfigSource.id})`;
      addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Generating project with Group: ${llmConfigSource.name}. Group's main task will be used as context.`, flowName});
    } else {
      addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Generating project with Global settings. Prompt: ${finalPrompt.substring(0,100)}...`, flowName});
    }

    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPrompt,
    };

    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Generating project with input: ${JSON.stringify({...generationInput, description: generationInput.description.substring(0,100) + "..."})}`, data: {config: llmConfigSource}, flowName});

    try {
      const aiResult = await callGenerateProjectStructure(generationInput);

      let groupLogForDisplay: string | undefined = undefined;
      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestratorContext = agentSystemPrompt || orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey);
        groupLogForDisplay = t('generateProject.logs.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: finalPrompt.substring(0, 100),
            orchestratorContext: orchestratorContext.substring(0, 200),
            flowName: 'generateProjectStructure (Grupo)'
        });
      }

      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog({source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Project generation successful.", data: {projectName: aiResult.projectName, fileCount: aiResult.files.length}, flowName});
      toast({
        title: t('generateProject.toast.projectGenerated.title' as TranslationKey),
        description: t('generateProject.toast.projectGenerated.description' as TranslationKey, { projectName: aiResult.projectName })
      });
    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Project generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('generateProject.toast.generationError.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateClick = () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.descriptionEmpty.title' as TranslationKey),
        description: t('generateProject.toast.descriptionEmpty.description' as TranslationKey)
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
        description: t('generateProject.toast.downloadError.description' as TranslationKey)
      });
      return;
    }

    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Preparing to download project: ${result.projectName} as ZIP.`});
    const zip = new JSZip();

    result.files.forEach(file => {
      if (file.isFolder || file.path.endsWith('/')) {
        const folderPath = file.path === '/' ? '' : file.path.startsWith('/') ? file.path.substring(1) : file.path;
        if (folderPath) {
            zip.folder(folderPath);
        }
      } else {
        zip.file(file.path, file.content);
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
        title: t('generateProject.toast.zipDownloadSuccess.title' as TranslationKey),
        description: t('generateProject.toast.zipDownloadSuccess.description' as TranslationKey, { filename, projectName: result.projectName })
      });
      addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Project structure "${result.projectName}" downloaded as ${filename}.`});
    } catch (e: any) {
        const errorMsg = e.message || t('generateProject.toast.zipDownloadError.description' as TranslationKey, { error: "desconocido" });
        toast({
          variant: "destructive",
          title: t('generateProject.toast.zipDownloadError.title' as TranslationKey),
          description: errorMsg
        });
        addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: `Failed to generate or download ZIP for project ${result.projectName}: ${errorMsg}`});
    }
  };

  const handleAutoFixError = async (errorMsg: string) => {
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
  };

  const handleRedefineRequest = useCallback(async () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('common.toast.redefineEmpty.title' as TranslationKey),
        description: t('common.toast.redefineEmpty.description' as TranslationKey)
      });
      return;
    }
    setIsRedefining(true);
    setError(null);
    const flowName = 'redefinePromptFlow (GenerarProyecto - Main)';
    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Redefining project description. Original: ${description.substring(0,100)}...`, flowName});
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });

    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      setCurrentPromptForDialog(resultOutput.redefinedPrompt); // Keep dialog prompt in sync
      toast({
        title: t('common.toast.redefinedSuccess.title' as TranslationKey),
        description: t('common.toast.redefinedSuccess.description' as TranslationKey)
      });
      addLog({source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Project description redefined successfully.", data: {newPrompt: resultOutput.redefinedPrompt.substring(0,100)+"..." }, flowName});
    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Redefining project description failed.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('common.toast.redefineError.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  }, [description, t, toast, addLog, router, setDescription, setCurrentPromptForDialog, setError, setIsRedefining]);

  const handleRedefineInDialog = async () => {
    if (!currentPromptForDialog.trim()) {
      toast({
        variant: "destructive",
        title: t('common.toast.redefineEmpty.title' as TranslationKey),
        description: t('common.toast.redefineEmpty.description' as TranslationKey)
      });
      return;
    }
    setIsRedefiningInDialog(true);
    const flowName = 'redefinePromptFlow (GenerarProyecto - Dialog)';
    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Redefining dialog prompt. Original: ${currentPromptForDialog.substring(0,100)}...`, flowName});
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });

    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: currentPromptForDialog });
      setCurrentPromptForDialog(resultOutput.redefinedPrompt);
      toast({
        title: t('common.toast.redefinedSuccess.title' as TranslationKey),
        description: t('common.toast.redefinedSuccess.description' as TranslationKey)
      });
      addLog({source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Dialog prompt redefined successfully.", data: {newPrompt: resultOutput.redefinedPrompt.substring(0,100)+"..." }, flowName});
    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Redefining dialog prompt failed.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        // Don't setError on the main page for a dialog error, just toast
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('common.toast.redefineError.description' as TranslationKey);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
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
    const flowName = 'modifyProjectStructure';
    addLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Sending modification request: ${currentModificationRequest}`, data: { currentProjectName: result.projectName }, flowName});

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
      agentSystemPromptForModification = group?.mainTask; // Or orchestrator's prompt
    }
    
    try {
      const modificationInput: ModifyProjectStructureInput = {
        currentProject: result,
        modificationRequest: tempCurrentModificationRequest,
        chatHistory: chatHistory, // Pass the history up to this point
        agentSystemPrompt: agentSystemPromptForModification,
      };
      const modifiedProjectResult = await callModifyProjectStructure(modificationInput);
      
      setResult(modifiedProjectResult); // Update the main project result

      const assistantResponseMessage = modifiedProjectResult.aiNotes || t('generateProject.toast.modificationSuccess.defaultAiNote' as TranslationKey);
      const aiMessage: ChatMessage = { id: uuidv4(), role: 'assistant', content: assistantResponseMessage, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, aiMessage]);

      toast({ title: t('generateProject.toast.modificationSuccess.title' as TranslationKey), description: t('generateProject.toast.modificationSuccess.description' as TranslationKey) });
      addLog({ source: 'GenerarProyectoPage', type: 'SUCCESS', message: 'Project modification successful.', data: { newNotes: modifiedProjectResult.aiNotes }, flowName });

    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Project modification failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('generateProject.toast.modificationError.description' as TranslationKey));
      
      const systemErrorMessage: ChatMessage = { id: uuidv4(), role: 'system', content: t('chat.systemMessage.errorPrefix' as TranslationKey) + errorMsg, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, systemErrorMessage]);
      
      toast({ variant: "destructive", title: t('generateProject.toast.modificationError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) {
        router.push(e.redirectTo);
      }
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
    const flowName = 'redefinePromptFlow (GenerarProyecto - Modification)';
    addLog({ source: 'GenerarProyectoPage', type: 'INFO', message: `Redefining modification request. Original: ${currentModificationRequest.substring(0, 100)}...`, flowName });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const redefined = await callRedefinePrompt({ originalPrompt: currentModificationRequest });
      setCurrentModificationRequest(redefined.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addLog({source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Modification request redefined.", data: {newPrompt: redefined.redefinedPrompt.substring(0,100)+"..." }, flowName});
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      addLog({ source: 'GenerarProyectoPage', type: 'ERROR', message: `Redefining modification request failed`, errorDetails: e, flowName });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningModificationRequest(false);
    }
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

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))} />}

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
            />
             {result.groupLog && !chatHistory.length && ( // Only show initial group log if no chat modifications yet
              <LogsDisplay title={t('generateProject.results.groupLogTitle' as TranslationKey)} logs={result.groupLog} />
            )}
          </div>
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
                <Label className="font-semibold">{t('generateProject.confirmDialog.currentPromptLabel' as TranslationKey)}</Label>
                <ScrollArea className="h-24 border rounded-md p-2 text-sm bg-muted mt-1">
                    {currentPromptForDialog}
                </ScrollArea>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label htmlFor="redefine-prompt-dialog">{t('generateProject.confirmDialog.redefinePromptLabel' as TranslationKey)}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedefineInDialog}
                  disabled={!currentPromptForDialog.trim() || isRedefiningInDialog || isLoading}
                  className="text-xs"
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
                 {t('generateProject.confirmDialog.llmConfigInfo' as TranslationKey)} {llmConfigSource?.type} {llmConfigSource?.name ? `(${llmConfigSource.name})` : ''}
            </p>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

    