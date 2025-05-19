
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card'; 
import { Button } from '@/components/ui/button';
import { Loader2, Save, ScanLine } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AnalyzeCodeSnippetInput, AnalyzeCodeSnippetOutput } from '@/types';
import { AppError } from '@/utils/AppError';
import { callAnalyzeCodeSnippet, callRedefinePrompt } from '@/utils/apiClient'; // Added callRedefinePrompt
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeCodeHeader from '@/components/features/analizar-codigo/AnalyzeCodeHeader';
import AnalyzeCodeInputSection from '@/components/features/analizar-codigo/AnalyzeCodeInputSection';
import AnalyzeCodeResultsDisplay from '@/components/features/analizar-codigo/AnalyzeCodeResultsDisplay';

/**
 * @fileOverview AnalizarCodigoPage component allows users to analyze code snippets or files.
 * Users can upload a file, fetch code from a Git URL, or paste code directly.
 * The component then calls an AI flow to get an explanation and suggested improvements.
 * Results, including original and suggested code, are displayed, and can be saved as snapshots.
 * All UI texts are internationalized.
 */
export default function AnalizarCodigoPage() {
  const { agents, groups, getAgentById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [codeToAnalyze, setCodeToAnalyze] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [userAnalysisPrompt, setUserAnalysisPrompt] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeSnippetOutput | null>(null);
  const [isRedefiningUserAnalysisPrompt, setIsRedefiningUserAnalysisPrompt] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();
  

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/x-javascript' || file.type === 'application/typescript' || file.name.endsWith('.py') || file.name.endsWith('.java') || file.name.endsWith('.cs') || file.name.endsWith('.go') || file.name.endsWith('.rb') || file.name.endsWith('.php') || file.name.endsWith('.md') && file.size <= 5 * 1024 * 1024) { 
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setCodeToAnalyze(content); 
          addLog({ source: 'AnalizarCodigoPage', type: 'INFO', message: `File loaded: ${file.name}, size: ${file.size}`});
        };
        reader.readAsText(file);
      } else {
        toast({ variant: "destructive", title: t('analyzeCode.toast.invalidFile.title'), description: t('analyzeCode.toast.invalidFile.description') });
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleFetchFromUrl = async () => {
    if (!fileUrl.trim()) {
      toast({ variant: "destructive", title: t('analyzeCode.toast.emptyUrl.title'), description: t('analyzeCode.toast.emptyUrl.description') });
      return;
    }
    setIsLoading(true);
    setError(null);
    addLog({ source: 'AnalizarCodigoPage', type: 'INFO', message: `Fetching code from URL: ${fileUrl}`});
    try {
      const response = await fetch(fileUrl); 
      if (!response.ok) {
        throw new Error(`Error al obtener de la URL: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      setCodeToAnalyze(text);
      toast({ title: t('analyzeCode.toast.codeFetched.title'), description: t('analyzeCode.toast.codeFetched.description') });
    } catch (e: any) {
      const errorMsg = e.message || "Error al obtener el código de la URL.";
      setError(errorMsg);
      addLog({ source: 'AnalizarCodigoPage', type: 'ERROR', message: `Failed to fetch from URL: ${errorMsg}`});
      toast({ variant: "destructive", title: t('analyzeCode.toast.fetchError.title'), description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!codeToAnalyze.trim()) {
      toast({ variant: "destructive", title: t('analyzeCode.toast.emptyCode.title'), description: t('analyzeCode.toast.emptyCode.description') });
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    let agentSystemPrompt: string | undefined;
    let flowName = 'analyzeCodeSnippet';

    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
      flowName = `analyzeCodeSnippet (Agent: ${agent?.name || llmConfigSource.id})`;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const group = groups.find(g => g.id === llmConfigSource.id);
      const orchestrator = getAgentById('orquestador-flujo-agentes');
      agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask; 
      flowName = `analyzeCodeSnippet (Group: ${group?.name || llmConfigSource.id})`;
      addLog({source: 'AnalizarCodigoPage', type: 'INFO', message: `Analyzing with Group: ${llmConfigSource.name}. Using orchestrator's system prompt for analysis flow.`, flowName});
    }

    const analysisInput: AnalyzeCodeSnippetInput = {
      code: codeToAnalyze,
      userPrompt: userAnalysisPrompt || undefined,
      agentSystemPrompt: agentSystemPrompt
    };
    
    addLog({source: 'AnalizarCodigoPage', type: 'INFO', message: `Analyzing code with input: ${JSON.stringify({code: codeToAnalyze.substring(0,50)+"...", userPrompt: analysisInput.userPrompt})}`, data: {config: llmConfigSource}, flowName });


    try {
      const aiResult = await callAnalyzeCodeSnippet(analysisInput);
      setResult(aiResult);
      addLog({ source: 'AnalizarCodigoPage', type: 'SUCCESS', message: "Code analysis successful.", flowName });
      toast({ title: t('analyzeCode.toast.analysisComplete.title'), description: t('analyzeCode.toast.analysisComplete.description') });
    } catch (e: any) {
      addLog({ source:"AnalizarCodigoPage", type: 'ERROR', message: "Code analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeCode.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis.";
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeCode.toast.analysisError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSnapshot = (type: 'original' | 'suggested') => {
    if (!result) return;
    const codeToSave = type === 'original' ? result.originalCode : result.suggestedCode;
    if (!codeToSave) {
        toast({variant: "destructive", title: t('analyzeCode.toast.snapshotError.title'), description: t('analyzeCode.toast.snapshotError.description', { type }) });
        return;
    }
    const name = t('analyzeCode.results.snapshotName', {type: type === 'original' ? t('common.original') : t('common.suggested'), time: new Date().toLocaleTimeString() });
    addSnapshot({ name, code: codeToSave, source: type });
    addLog({source: 'AnalizarCodigoPage', type: 'INFO', message: `Snapshot saved: ${name}`});
  };
  
  const handleAutoFixError = async (errorMsg: string) => {
    toast({ title: t('common.processing'), description: t('errorDisplay.toast.autofixAttempt.description')});
  };

  const handleRedefineUserAnalysisPrompt = async () => {
    if (!userAnalysisPrompt.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningUserAnalysisPrompt(true);
    addLog({ source: 'AnalizarCodigoPage', type: 'INFO', message: `Redefining user analysis prompt. Original: ${userAnalysisPrompt.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: userAnalysisPrompt });
      setUserAnalysisPrompt(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addLog({ source: 'AnalizarCodigoPage', type: 'SUCCESS', message: `'userAnalysisPrompt' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addLog({ source: 'AnalizarCodigoPage', type: 'ERROR', message: `Redefining 'userAnalysisPrompt' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningUserAnalysisPrompt(false);
    }
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <AnalyzeCodeHeader t={t} />
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} label={t('common.llmSourceLabel')} />
        
        <AnalyzeCodeInputSection
          codeToAnalyze={codeToAnalyze}
          onCodeToAnalyzeChange={setCodeToAnalyze}
          fileUrl={fileUrl}
          onFileUrlChange={setFileUrl}
          userAnalysisPrompt={userAnalysisPrompt}
          onUserAnalysisPromptChange={setUserAnalysisPrompt}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          onFetchFromUrl={handleFetchFromUrl}
          isLoading={isLoading || isRedefiningUserAnalysisPrompt}
          t={t}
          isRedefiningUserAnalysisPrompt={isRedefiningUserAnalysisPrompt}
          onRedefineUserAnalysisPrompt={handleRedefineUserAnalysisPrompt}
        />
        
        <Button onClick={handleAnalyze} disabled={isLoading || isRedefiningUserAnalysisPrompt || !codeToAnalyze.trim()} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('analyzeCode.analyzeButton')}
        </Button>

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} />}

        <AnalyzeCodeResultsDisplay result={result} onSaveSnapshot={handleSaveSnapshot} t={t} />
        
      </CardContent>
    </Card>
  );
}
