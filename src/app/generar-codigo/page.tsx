
"use client";

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, CodeXml } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, GenerateCodeFromDescriptionOutput } from '@/types';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppError } from '@/utils/AppError';
import { callGenerateCodeFromDescription } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';

/**
 * @fileOverview GenerarCodigoPage component allows users to generate code snippets
 * from natural language descriptions. Users can select an LLM configuration source
 * (global, specific agent, or agent group) and provide a detailed prompt.
 * The component handles the AI call, displays results (explanation and code),
 * and manages loading/error states. All UI text is internationalized.
 */
export default function GenerarCodigoPage() {
  const { getAgentById, getGroupById } = useAppState();
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
    const orchestratorAgent = getAgentById('orquestador-flujo-agentes');

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt; 
        flowName = `generateCodeFromDescription (Agent: ${agent?.name || llmConfigSource.id})`;
        addLog({message: `Generating code with Agent: ${llmConfigSource.name}. Agent's system prompt: ${agentSystemPrompt?.substring(0,100)}...`, flowName});
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id && llmConfigSource.name) {
        const group = getGroupById(llmConfigSource.id);
        agentSystemPrompt = orchestratorAgent?.systemPrompt;
        groupLogForDisplay = t('generateCode.logs.groupContextLog', { 
            groupName: llmConfigSource.name || 'N/A',
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: description.substring(0, 100),
            orchestratorContext: (agentSystemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'generateCodeFromDescription'
        });
        flowName = `generateCodeFromDescription (Group: ${group?.name || llmConfigSource.id})`;
        addLog({message: `Generating code with Group: ${llmConfigSource.name}. Orchestrator's system prompt will be used.`, flowName});
    } else {
        addLog({message: `Generating code with Global settings. Description: ${description.substring(0,50)}...`, flowName});
    }

    try {
      const aiResult = await callGenerateCodeFromDescription({ description, agentSystemPrompt });
      setResult({...aiResult, groupLog: groupLogForDisplay});
      addLog({message: "Code generation successful.", data: aiResult, flowName});
      toast({ title: t('generateCode.toast.codeGenerated.title'), description: t('generateCode.toast.codeGenerated.description') });
    } catch (e: any) {
      addLog({ message: "Code generation failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('generateCode.toast.generationError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error al generar el código.";
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
      toast({ variant: "destructive", title: t('generateCode.toast.descriptionEmpty.title'), description: t('generateCode.toast.descriptionEmpty.description')});
      return;
    }
    setShowConfirmDialog(true);
  };
  
  /**
   * Placeholder for an AI-driven error fixing mechanism.
   * @param {string} errorMsg - The error message to be fixed.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    const autoFixFlowName = 'chatWithAgentOrGlobal (AutoFix Error)';
    addLog({ message: `Attempting Auto-Fix for error: ${errorMsg}`, flowName: autoFixFlowName});
    toast({ title: t('common.processing'), description: t('errorDisplay.toast.autofixAttempt.description')});
    // This functionality is now handled by ErrorDisplay component itself
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <PageSectionHeader
        icon={CodeXml}
        title={t('generateCode.title')}
        description={t('generateCode.description')}
      />
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} label={t('common.llmSourceLabel')} />
        
        <div className="space-y-2">
          <Label htmlFor="description">{t('generateCode.describeNeedLabel')}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('generateCode.describeNeedPlaceholder')}
            rows={5}
            disabled={isLoading}
          />
        </div>
        
        <Button onClick={handleGenerateClick} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('generateCode.generateButton')}
        </Button>

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} />}

        {result && (
          <div className="space-y-4 mt-6 p-4 border rounded-md bg-background">
            {result.explanation && (
              <div>
                <h3 className="font-semibold text-lg mb-2">{t('generateCode.results.explanationLabel')}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg mb-2">{t('generateCode.results.codeSnippetLabel')}</h3>
              <CodeBlock code={result.code} />
            </div>
             {result.groupLog && ( 
              <LogsDisplay title={t('generateCode.results.groupLogTitle')} logs={result.groupLog} />
            )}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleSubmit}
        title={t('generateCode.confirmDialog.title')}
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
