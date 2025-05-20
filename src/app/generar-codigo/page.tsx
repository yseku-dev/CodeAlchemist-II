
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
import { callGenerateCodeFromDescription, callRedefinePrompt } from '@/utils/apiClient';
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
 * @module GenerarCodigoPage
 */
export default function GenerarCodigoPage() {
  const { agents, getAgentById, getGroupById } = useAppState(); // Removed unused 'groups'
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodeFromDescriptionOutput | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isRedefiningDescription, setIsRedefiningDescription] = useState(false);
  
  const { addLog: addDebugLog } = useDebug(); // Renamed for consistency
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
    let flowName = 'callGenerateCodeFromDescription'; // Corrected flow name for logging
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
        const orchestratorContextSummary = (agentSystemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200);

        groupLogForDisplay = t('generateCode.logs.groupContextLog', { 
            groupName: llmConfigSource.name || 'N/A',
            groupTask: groupTaskSummary,
            userInput: description.substring(0, 100),
            orchestratorContext: orchestratorContextSummary,
            flowName: `callGenerateCodeFromDescription (Grupo: ${group?.name || llmConfigSource.id})`
        });
        flowName = `callGenerateCodeFromDescription (Group: ${group?.name || llmConfigSource.id})`;
        addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generando código con Grupo: ${llmConfigSource.name}. Se usará el prompt del Orquestador.`, data: { groupTask: groupTaskSummary, orchestratorContext: orchestratorContextSummary }, flowName});
    } else {
        flowName = `callGenerateCodeFromDescription (Global)`;
        addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Generando código con Ajustes Globales. Descripción: ${description.substring(0,50)}...`, flowName});
    }

    try {
      const aiResult = await callGenerateCodeFromDescription({ description, agentSystemPrompt });
      setResult({...aiResult, groupLog: groupLogForDisplay}); // Pass groupLog to result
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
        const errorMsg = (e as Error).message || t('generateCode.toast.generationError.descriptionDefault') || "Ocurrió un error al generar el código.";
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
  
  const handleAutoFixError = async (errorMsgToFix: string) => {
    const autoFixFlowName = 'callAutoFixErrorWithGroup (GenerateCode)';
    addDebugLog({source: 'GenerarCodigoPage', type: 'INFO', message: `Intentando Auto-Fix para error: ${errorMsgToFix}`, data: { currentDescription: description }, flowName: autoFixFlowName});
    // La lógica real de llamar a callAutoFixErrorWithGroup está en ErrorDisplay,
    // pero aquí podemos pasar el contexto específico de esta página.
    // Este onAutoFix se pasa a ErrorDisplay, que luego lo invoca.
    // El ErrorDisplay ya tiene su propia lógica para llamar a callAutoFixErrorWithGroup.
    // Esta función actúa como el `onAutoFix` prop para ErrorDisplay.
    // El ErrorDisplay se encargará de la lógica de mostrar el modal y el toast inicial.
  };

  const handleRedefineDescription = async () => {
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
      if (e instanceof AppError) {
        setError(e.friendlyMessage); // Podríamos mostrar este error también en el ErrorDisplay
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description');
        setError(errorMsg);
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      }
    } finally {
      setIsRedefiningDescription(false);
    }
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
          isLoading={isLoading || isRedefiningDescription} // isLoading general para todo el proceso
          isRedefiningDescription={isRedefiningDescription} // Específico para el botón de redefinir
          onRedefineDescription={handleRedefineDescription}
          t={t}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error)} context={`Prompt del usuario que causó el error: "${description}"`} />}

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
