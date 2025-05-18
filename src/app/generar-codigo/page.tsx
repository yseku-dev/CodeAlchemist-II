
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, GenerateCodeFromDescriptionOutput, Agent, AIAgentGroup } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppError } from '@/utils/AppError';
import { callGenerateCodeFromDescription } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

import GenerateCodeHeader from '@/components/features/generar-codigo/GenerateCodeHeader';
import GenerateCodeForm from '@/components/features/generar-codigo/GenerateCodeForm';
import GenerateCodeResultsDisplay from '@/components/features/generar-codigo/GenerateCodeResultsDisplay';

/**
 * @fileOverview GenerarCodigoPage component allows users to generate code snippets
 * from natural language descriptions. Users can select an LLM configuration source
 * (global, specific agent, or agent group) and provide a detailed prompt.
 * The component handles the AI call, displays results (explanation and code),
 * and manages loading/error states. All UI text is internationalized.
 * This page has been refactored into smaller, more granular components.
 */
export default function GenerarCodigoPage() {
  const { agents, groups, getAgentById, getGroupById } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodeFromDescriptionOutput | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  /**
   * Handles the code generation process once confirmed by the user.
   * Calls the AI flow and updates the UI with results or errors.
   */
  const handleSubmit = async () => {
    setShowConfirmDialog(false); 
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    let agentSystemPrompt: string | undefined;
    let groupLogForDisplay: string | undefined;
    let flowName = 'generateCodeFromDescription';
    const orchestratorAgent: Agent | undefined = agents.find(a => a.id === 'orquestador-flujo-agentes');

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt; 
        flowName = `generateCodeFromDescription (Agent: ${agent?.name || llmConfigSource.id})`;
        addLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generating code with Agent: ${llmConfigSource.name}. Agent's system prompt (start): ${agentSystemPrompt?.substring(0,100)}...`, flowName});
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
        const group: AIAgentGroup | undefined = getGroupById(llmConfigSource.id);
        agentSystemPrompt = orchestratorAgent?.systemPrompt; // Use orchestrator's prompt for group context
        groupLogForDisplay = t('generateCode.logs.groupContextLog', { 
            groupName: llmConfigSource.name || 'N/A',
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: description.substring(0, 100),
            orchestratorContext: (agentSystemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'generateCodeFromDescription (Grupo)'
        });
        flowName = `generateCodeFromDescription (Group: ${group?.name || llmConfigSource.id})`;
        addLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generating code with Group: ${llmConfigSource.name}. Orchestrator's system prompt will be used.`, flowName});
    } else {
        addLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generating code with Global settings. Description: ${description.substring(0,50)}...`, flowName});
    }

    try {
      const aiResult = await callGenerateCodeFromDescription({ description, agentSystemPrompt });
      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog({source: 'GenerarCodigoPage', type: 'SUCCESS', message: "Code generation successful.", data: { explanationLength: aiResult.explanation.length, codeLength: aiResult.code.length }, flowName});
      toast({ title: t('generateCode.toast.codeGenerated.title'), description: t('generateCode.toast.codeGenerated.description') });
    } catch (e: any) {
      addLog({source: 'GenerarCodigoPage', type: 'ERROR', message: "Code generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateCode.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || t('generateCode.toast.generationError.description') || "Ocurrió un error al generar el código.";
        setError(errorMsg);
        toast({ variant: "destructive", title: t('generateCode.toast.generationError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handles the click event for the "Generar Código" button.
   * Validates input and opens the confirmation dialog.
   */
  const handleGenerateClick = () => {
    if (!description.trim()) {
      toast({ 
        variant: "destructive", 
        title: t('generateCode.toast.descriptionEmpty.title'), 
        description: t('generateCode.toast.descriptionEmpty.description')
      });
      return;
    }
    setShowConfirmDialog(true);
  };
  
  /**
   * Attempts to use AI to provide a solution or explanation for a displayed error.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    const autoFixFlowName = 'callAutoFixErrorWithGroup (GenerateCode)'; // More specific flow name
    addLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Attempting Auto-Fix for error: ${errorMsg}`, flowName: autoFixFlowName});
    // ErrorDisplay component handles the actual call and modal display
    toast({ 
      title: t('common.processing'), 
      description: t('errorDisplay.toast.autofixAttempt.description')
    });
  };

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
          isLoading={isLoading}
          t={t}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} />}

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
