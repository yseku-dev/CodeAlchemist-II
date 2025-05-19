
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FolderPlus, Wand2 } from 'lucide-react'; // Added Wand2
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
import { callGenerateProjectStructure, callRedefinePrompt } from '@/utils/apiClient'; // Added callRedefinePrompt
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';


/**
 * @fileOverview GenerarProyectoPage component allows users to generate a base project structure.
 * Users describe the project, select an LLM configuration source, and the AI generates
 * a suggested project name, notes, and a list of files with their content.
 * The generated structure can be downloaded as a ZIP archive.
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
  const [isRedefining, setIsRedefining] = useState(false); // State for redefine button
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectGenerationResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { addLog } = useDebug();
  const { toast } = useToast();

  useEffect(() => {
    // Ensure llmConfigSource is initialized consistently on client after mount
    // This helps prevent hydration issues if its initial value depends on localStorage indirectly
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
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const group = groups.find(g => g.id === llmConfigSource.id);
      agentSystemPrompt = group?.mainTask || orchestratorAgent?.systemPrompt;
      flowName = `generateProjectStructure (Group: ${group?.name || llmConfigSource.id})`;
      addLog({message: `Generating project with Group: ${llmConfigSource.name}. Using group's task/context for generation flow.`, flowName});
    } else {
      addLog({message: `Generating project with Global settings. Prompt: ${finalPrompt.substring(0,100)}...`, flowName});
    }

    const generationInput: GenerateProjectInput = {
      description: finalPrompt,
      agentSystemPrompt: agentSystemPrompt,
    };

    addLog({message: `Generating project input: ${JSON.stringify(generationInput).substring(0,100)}...`, config: llmConfigSource, flowName});

    try {
      const aiResult = await callGenerateProjectStructure(generationInput);

      let groupLogForDisplay: string | undefined = undefined;
      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
        const group = groups.find(g => g.id === llmConfigSource.id);
        groupLogForDisplay = t('generateProject.logs.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: finalPrompt.substring(0, 100),
            orchestratorContext: (agentSystemPrompt || orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'generateProjectStructure'
        });
      }

      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog({message: "Project generation successful.", flowName});
      toast({
        title: t('generateProject.toast.projectGenerated.title' as TranslationKey),
        description: t('generateProject.toast.projectGenerated.description' as TranslationKey, { projectName: aiResult.projectName })
      });
    } catch (e: any) {
      addLog({ message: "Project generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
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

  /**
   * Handles the click event for the "Generar Proyecto" button.
   * Validates input and opens the confirmation dialog.
   */
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

  /**
   * Handles the download of the generated project structure as a ZIP file.
   */
  const handleDownloadProject = async () => {
    if (!result || !result.files || result.files.length === 0) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.downloadError.title' as TranslationKey),
        description: t('generateProject.toast.downloadError.description' as TranslationKey)
      });
      return;
    }

    addLog(`Preparing to download project: ${result.projectName} as ZIP.`);
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
        title: t('generateProject.toast.zipDownloadSuccess.title' as TranslationKey),
        description: t('generateProject.toast.zipDownloadSuccess.description' as TranslationKey, { filename, projectName: result.projectName })
      });
      addLog(`Project structure "${result.projectName}" downloaded as ${filename}.`);
    } catch (e: any) {
        const errorMsg = e.message || t('generateProject.toast.zipDownloadError.description' as TranslationKey, { error: "desconocido" });
        toast({
          variant: "destructive",
          title: t('generateProject.toast.zipDownloadError.title' as TranslationKey),
          description: errorMsg
        });
        addLog(`Failed to generate or download ZIP for project ${result.projectName}: ${errorMsg}`);
    }
  };

  /**
   * Attempts to use AI to provide a solution or explanation for a displayed error.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    toast({
      title: t('common.processing' as TranslationKey),
      description: t('errorDisplay.toast.autofixAttempt.description' as TranslationKey)
    });
  };

  /**
   * Handles the "Redefinir Petición" button click.
   * Calls an AI flow to refine the project description.
   */
  const handleRedefineRequest = async () => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('generateProject.toast.redefineEmpty.title' as TranslationKey),
        description: t('generateProject.toast.redefineEmpty.description' as TranslationKey)
      });
      return;
    }
    setIsRedefining(true);
    setError(null);
    const flowName = 'redefinePromptFlow (GenerarProyecto)';
    addLog({message: `Redefining project description. Original: ${description.substring(0,100)}...`, flowName});
    toast({ title: t('generateProject.toast.redefining.title'), description: t('generateProject.toast.redefining.description') });

    try {
      const resultOutput: RedefinePromptOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      toast({
        title: t('generateProject.toast.redefinedSuccess.title'),
        description: t('generateProject.toast.redefinedSuccess.description')
      });
      addLog({message: "Project description redefined successfully.", newPrompt: resultOutput.redefinedPrompt.substring(0,100)+"...", flowName});
    } catch (e: any) {
      addLog({ message: "Redefining project description failed.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage); // Could display this near the textarea or as a more persistent error
        toast({ variant: "destructive", title: t('generateProject.toast.redefineError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('generateProject.toast.redefineError.description');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateProject.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefining(false);
    }
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <PageSectionHeader
        icon={FolderPlus}
        title={t('generateProject.title' as TranslationKey)}
        description={t('generateProject.description' as TranslationKey)}
      />
      <CardContent className="space-y-6">
        <LLMConfigSelector
          value={llmConfigSource}
          onChange={setLlmConfigSource}
          label={t('common.llmSourceLabel' as TranslationKey)}
        />

        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor="description">{t('generateProject.describeProjectLabel' as TranslationKey)}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedefineRequest}
              disabled={!description.trim() || isRedefining || isLoading}
            >
              {isRedefining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {t('generateProject.redefineRequestButton' as TranslationKey)}
            </Button>
          </div>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('generateProject.describeProjectPlaceholder' as TranslationKey)}
            rows={8}
            disabled={isLoading || isRedefining}
          />
        </div>

        <Button onClick={handleGenerateClick} disabled={isLoading || isRedefining || !description.trim()} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('generateProject.generateButton' as TranslationKey)}
        </Button>

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey))} />}

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
        title={t('generateProject.confirmDialog.title' as TranslationKey)}
        confirmText={t('generateProject.confirmDialog.confirmButton' as TranslationKey)}
      >
        <div className="space-y-4">
            <div>
                <Label className="font-semibold">{t('generateProject.confirmDialog.currentPromptLabel' as TranslationKey)}</Label>
                <ScrollArea className="h-24 border rounded-md p-2 text-sm bg-muted mt-1">
                    {description}
                </ScrollArea>
            </div>
            <div>
                <Label htmlFor="redefine-prompt">{t('generateProject.confirmDialog.redefinePromptLabel' as TranslationKey)}</Label>
                <Textarea
                    id="redefine-prompt"
                    value={currentPromptForDialog}
                    onChange={(e) => setCurrentPromptForDialog(e.target.value)}
                    rows={4}
                    className="mt-1"
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
