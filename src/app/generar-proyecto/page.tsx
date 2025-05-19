
"use client";

import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card'; // Removed Card import
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FolderPlus, Wand2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, ProjectGenerationResult, GenerateProjectInput, Agent, RedefinePromptOutput } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import FileTreeDisplay from '@/components/file-tree';
import LogsDisplay from '@/components/logs-display';
import { useAppState } from '@/context/AppStateContext';
import { AppError } from '@/utils/AppError';
import { callGenerateProjectStructure, callRedefinePrompt } from '@/utils/apiClient';
import PageSectionHeader from '@/components/layout/PageSectionHeader'; // Keep if used by GenerateProjectHeader
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

import GenerateProjectHeader from '@/components/features/generar-proyecto/GenerateProjectHeader';
import GenerateProjectForm from '@/components/features/generar-proyecto/GenerateProjectForm';
import GenerateProjectResultsDisplay from '@/components/features/generar-proyecto/GenerateProjectResultsDisplay';


/**
 * @fileOverview GenerarProyectoPage component allows users to generate a base project structure.
 * Users describe the project, select an LLM configuration source, and the AI generates
 * a suggested project name, notes, and a list of files with their content.
 * The generated structure can be downloaded as a ZIP archive.
 * All UI texts are internationalized.
 * This page has been refactored into smaller, more granular components.
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectGenerationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { addLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    // Ensure llmConfigSource is initialized consistently on client after mount
    setLlmConfigSource({ type: 'Ajustes Globales' });
  }, []);

  /**
   * Handles the project generation process once confirmed by the user.
   * It calls the AI flow with the final prompt and updates the UI with results or errors.
   * @param {string} finalPrompt - The prompt to be used for project generation.
   */
  const handleProjectGeneration = async (finalPrompt: string) => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);

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
      // For project generation, using the group's main task as the primary context for the AI might be more direct
      // than the orchestrator's generic prompt, if the flow is a single LLM call.
      agentSystemPrompt = group?.mainTask;
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
        const orchestratorContext = agentSystemPrompt || orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable');
        groupLogForDisplay = t('generateProject.logs.groupContextLog', {
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
        title: t('generateProject.toast.projectGenerated.title'),
        description: t('generateProject.toast.projectGenerated.description', { projectName: aiResult.projectName })
      });
    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Project generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('generateProject.toast.generationError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateProject.toast.generationError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the click event for the "Generar Proyecto" button.
   * Validates input and opens the confirmation dialog.
   */
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

  /**
   * Handles the download of the generated project structure as a ZIP file.
   */
  const handleDownloadProject = async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title'),
        description: t('generateProject.toast.downloadError.description')
      });
      return;
    }

    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Preparing to download project: ${result.projectName} as ZIP.`});
    const zip = new JSZip();

    result.files.forEach(file => {
      if (file.isFolder || file.path.endsWith('/')) {
        zip.folder(file.path);
      } else {
        zip.file(file.path, file.content);
      }
    });

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = `${result.projectName.replace(/\s+/g, '_').toLowerCase() || 'proyecto_generado'}.zip`;

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
      addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Project structure "${result.projectName}" downloaded as ${filename}.`});
    } catch (e: any) {
        const errorMsg = e.message || t('generateProject.toast.zipDownloadError.description', { error: "desconocido" });
        toast({
          variant: "destructive",
          title: t('generateProject.toast.zipDownloadError.title'),
          description: errorMsg
        });
        addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: `Failed to generate or download ZIP for project ${result.projectName}: ${errorMsg}`});
    }
  };

  /**
   * Attempts to use AI to provide a solution or explanation for a displayed error.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    toast({
      title: t('common.processing'),
      description: t('errorDisplay.toast.autofixAttempt.description')
    });
    // Actual auto-fix logic would be here, potentially calling an AI flow.
  };

  /**
   * Handles the "Redefinir Petición" button click.
   * Calls an AI flow to refine the project description.
   */
  const handleRedefineRequest = async () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('common.toast.redefineEmpty.title'),
        description: t('common.toast.redefineEmpty.description')
      });
      return;
    }
    setIsRedefining(true);
    setError(null);
    const flowName = 'redefinePromptFlow (GenerarProyecto)';
    addLog({source: 'GenerarProyectoPage', type: 'INFO', message: `Redefining project description. Original: ${description.substring(0,100)}...`, flowName});
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });

    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      toast({
        title: t('common.toast.redefinedSuccess.title'),
        description: t('common.toast.redefinedSuccess.description')
      });
      addLog({source: 'GenerarProyectoPage', type: 'SUCCESS', message: "Project description redefined successfully.", data: {newPrompt: resultOutput.redefinedPrompt.substring(0,100)+"..." }, flowName});
    } catch (e: any) {
      addLog({source: 'GenerarProyectoPage', type: 'ERROR', message: "Redefining project description failed.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('common.toast.redefineError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto"> {/* Replaced Card with div */}
      <GenerateProjectHeader t={t} />
      <CardContent className="space-y-6">
        <GenerateProjectForm
            llmConfigSource={llmConfigSource}
            onLlmConfigSourceChange={setLlmConfigSource}
            description={description}
            onDescriptionChange={setDescription}
            onGenerateClick={handleGenerateClick}
            isLoading={isLoading}
            isRedefining={isRedefining}
            onRedefineRequest={handleRedefineRequest}
            t={t}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} />}

        {result && (
          <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
            <GenerateProjectResultsDisplay result={result} t={t} onDownloadProject={handleDownloadProject} />
             {result.groupLog && (
              <LogsDisplay title={t('generateProject.results.groupLogTitle' as TranslationKey)} logs={result.groupLog} />
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
      >
        <div className="space-y-4">
            <div>
                <Label className="font-semibold">{t('generateProject.confirmDialog.currentPromptLabel')}</Label>
                <ScrollArea className="h-24 border rounded-md p-2 text-sm bg-muted mt-1">
                    {description}
                </ScrollArea>
            </div>
            <div>
                <Label htmlFor="redefine-prompt">{t('generateProject.confirmDialog.redefinePromptLabel')}</Label>
                <Textarea
                    id="redefine-prompt"
                    value={currentPromptForDialog}
                    onChange={(e) => setCurrentPromptForDialog(e.target.value)}
                    rows={4}
                    className="mt-1"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                 {t('generateProject.confirmDialog.llmConfigInfo')} {llmConfigSource?.type} {llmConfigSource?.name ? `(${llmConfigSource.name})` : ''}
            </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
