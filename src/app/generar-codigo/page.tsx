
// src/app/generar-codigo/page.tsx
"use client";

import React, { useState, useCallback } from 'react'; // Added useCallback
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, GenerateCodeFromDescriptionOutput, Agent, AIAgentGroup, GenerateCodeFromDescriptionInput } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppError } from '@/utils/AppError';
import { callGenerateCodeFromDescription, callRedefinePrompt, callAutoFixErrorWithGroup } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import GenerateCodeHeader from '@/components/features/generar-codigo/GenerateCodeHeader';
import GenerateCodeForm from '@/components/features/generar-codigo/GenerateCodeForm';
import GenerateCodeResultsDisplay from '@/components/features/generar-codigo/GenerateCodeResultsDisplay';

/**
 * @fileOverview GenerarCodigoPage component allows users to generate code snippets
 * from natural language descriptions. Users can select an LLM configuration source
 * (global, specific agent, or agent group) and provide a detailed prompt.
 * The component handles the AI call, displays results (explanation and code),
 * and manages loading/error states. All UI text is internationalized.
 * Page state (LLM config, description, and result) is persisted to localStorage.
 * @module GenerarCodigoPage
 */
export default function GenerarCodigoPage() {
  const { agents, getAgentById, getGroupById } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>('codealchemist-gc-llmConfigSource', { type: 'Ajustes Globales' });
  const [description, setDescription] = useLocalStorage<string>('codealchemist-gc-description', '');
  const [result, setResult] = useLocalStorage<GenerateCodeFromDescriptionOutput | null>('codealchemist-gc-result', null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRedefiningDescription, setIsRedefiningDescription] = useState(false);

  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  /**
   * Handles the code generation process once confirmed by the user.
   * Calls the AI flow and updates the UI with results or errors.
   */
  const handleSubmit = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    setError(null);
    setResult(null);

    let agentSystemPrompt: string | undefined;
    let groupLogForDisplay: string | undefined;
    let flowName = 'callGenerateCodeFromDescription (Global)';
    const orchestratorAgent: Agent | undefined = agents.find(a => a.id === 'orquestador-flujo-agentes');

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
        flowName = `callGenerateCodeFromDescription (Agent: ${agent?.name || llmConfigSource.id})`;
        addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generando código con Agente: ${llmConfigSource.name}. System Prompt del Agente (inicio): ${agentSystemPrompt?.substring(0,100)}...`, flowName});
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
        const group: AIAgentGroup | undefined = getGroupById(llmConfigSource.id);
        agentSystemPrompt = orchestratorAgent?.systemPrompt;
        const groupTaskSummary = (group?.mainTask || 'N/A').substring(0,150);
        const orchestratorContextSummary = (agentSystemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200);

        groupLogForDisplay = t('generateCode.logs.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name || 'N/A',
            groupTask: groupTaskSummary,
            userInput: description.substring(0, 100),
            orchestratorContext: orchestratorContextSummary,
            flowName: `callGenerateCodeFromDescription (Grupo: ${group?.name || llmConfigSource.id})`
        });
        flowName = `callGenerateCodeFromDescription (Group: ${group?.name || llmConfigSource.id})`;
        addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generando código con Grupo: ${llmConfigSource.name}. Se usará el prompt del Orquestador.`, data: { groupTask: groupTaskSummary, orchestratorContext: orchestratorContextSummary }, flowName});
    } else {
        addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generando código con Ajustes Globales. Descripción: ${description.substring(0,50)}...`, flowName});
    }

    const input: GenerateCodeFromDescriptionInput = { description, agentSystemPrompt };

    try {
      const aiResult = await callGenerateCodeFromDescription(input);
      setResult({...aiResult, groupLog: groupLogForDisplay});
      addDebugLog({source: 'GenerarCodigoPage', type: 'SUCCESS', message: "Generación de código exitosa.", data: { explanationLength: aiResult.explanation.length, codeLength: aiResult.code.length, groupLogProvided: !!groupLogForDisplay }, flowName});
      toast({ title: t('generateCode.toast.codeGenerated.title'), description: t('generateCode.toast.codeGenerated.description') });
    } catch (e: any) {
      addDebugLog({source: 'GenerarCodigoPage', type: 'ERROR', message: "Fallo en la generación de código (UI).", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateCode.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = (e as Error).message || t('generateCode.toast.generationError.descriptionDefault');
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateCode.toast.generationError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, llmConfigSource, agents, getAgentById, getGroupById, t, addDebugLog, toast, router, setResult]);

  /**
   * Handles the click event for the "Generar Código" button.
   * Validates input and opens the confirmation dialog.
   */
  const handleGenerateClick = useCallback(() => {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: t('generateCode.toast.descriptionEmpty.title'),
        description: t('generateCode.toast.descriptionEmpty.description')
      });
      return;
    }
    setShowConfirmDialog(true);
  }, [description, toast, t]);

  /**
   * Handles the Auto-Fix action for an error.
   * @param {string} errorMsgToFix - The error message to be fixed.
   */
  const handleAutoFixError = useCallback(async (errorMsgToFix: string) => {
    const autoFixFlowName = 'callAutoFixErrorWithGroup (GenerateCode)';
    addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentDescription: description }, flowName: autoFixFlowName});
    toast({ title: t('common.processing'), description: t('error.errorDisplay.toast.autofixAttempt.description') });
    // The actual call to callAutoFixErrorWithGroup is handled by ErrorDisplay component
    // which receives this function as onAutoFix. ErrorDisplay will then show results in its own modal.
  }, [description, addDebugLog, t, toast]);

  /**
   * Handles redefining the user's input description using AI.
   */
  const handleRedefineDescription = useCallback(async () => {
    if (!description.trim()) {
      toast({
        variant: 'destructive',
        title: t('common.toast.redefineEmpty.title'),
        description: t('common.toast.redefineEmpty.description'),
      });
      return;
    }
    setIsRedefiningDescription(true);
    addDebugLog({ source: 'GenerarCodigoPage', type: 'INFO', message: `Redefiniendo descripción. Original (inicio): ${description.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });

    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: description });
      setDescription(resultOutput.redefinedPrompt);
      toast({
        title: t('common.toast.redefinedSuccess.title'),
        description: t('common.toast.redefinedSuccess.description'),
      });
      addDebugLog({ source: 'GenerarCodigoPage', type: 'SUCCESS', message: `'description' redefinida. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'GenerarCodigoPage', type: 'ERROR', message: "Fallo al redefinir 'description'.", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description'));
      setError(errorMsg);
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningDescription(false);
    }
  }, [description, setDescription, addDebugLog, t, toast, router]);

  return (
    <Card className="max-w-3xl mx-auto">
      <GenerateCodeHeader t={t} />
      <CardContent className="space-y-6">
        <GenerateCodeForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          description={description}
          onDescriptionChange={setDescription}
          onGenerateClick={handleGenerateClick}
          isLoading={isLoading || isRedefiningDescription}
          isRedefiningDescription={isRedefiningDescription}
          onRedefineDescription={handleRedefineDescription}
          t={t}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} context={t('generateCode.autofixContext', {prompt: description})} />}

        <GenerateCodeResultsDisplay result={result} t={t} />
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleSubmit}
        title={t('generateCode.confirmDialog.title')}
        confirmText={t('generateCode.confirmDialog.confirmButtonText')}
        cancelText={t('common.cancel')}
      >
        <p className="text-sm text-muted-foreground mb-2">{t('common.llmSourceLabel')}</p>
        <ul className="text-sm list-disc list-inside mb-2">
          <li><strong>{t('generateCode.confirmDialog.llmSourceLabel')}</strong> {llmConfigSource?.type === 'Ajustes Globales' ? t('common.globalSettings') : `${llmConfigSource?.type}: ${llmConfigSource?.name || 'N/A'}`}</li>
        </ul>
        <p className="text-sm text-muted-foreground mb-1"><strong>{t('generateCode.confirmDialog.promptLabel')}</strong></p>
        <ScrollArea className="h-32 border rounded-md p-2 text-sm bg-muted">
          {description}
        </ScrollArea>
      </ConfirmDialog>
    </Card>
  );
}
