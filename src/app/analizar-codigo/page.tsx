
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card'; 
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Save, ScanLine } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import CodeBlock from '@/components/code-block';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AnalyzeCodeSnippetInput, AnalyzeCodeSnippetOutput } from '@/types';
import { AppError } from '@/utils/AppError';
import { callAnalyzeCodeSnippet } from '@/utils/apiClient';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import CodeEditor from '@/components/CodeEditor';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';


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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();
  

  /**
   * Handles changes to the file input, reading the file content and pre-filling the textarea.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('text/') && file.size <= 5 * 1024 * 1024) { 
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setCodeToAnalyze(content); 
          addLog(`File loaded: ${file.name}, size: ${file.size}`);
        };
        reader.readAsText(file);
      } else {
        toast({ variant: "destructive", title: t('analyzeCode.toast.invalidFile.title' as TranslationKey), description: t('analyzeCode.toast.invalidFile.description' as TranslationKey) });
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  /**
   * Fetches code content from a given Git URL.
   */
  const handleFetchFromUrl = async () => {
    if (!fileUrl.trim()) {
      toast({ variant: "destructive", title: t('analyzeCode.toast.emptyUrl.title' as TranslationKey), description: t('analyzeCode.toast.emptyUrl.description' as TranslationKey) });
      return;
    }
    setIsLoading(true);
    setError(null);
    addLog(`Fetching code from URL: ${fileUrl}`);
    try {
      const response = await fetch(fileUrl); 
      if (!response.ok) {
        throw new Error(`Error al obtener de la URL: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      setCodeToAnalyze(text);
      toast({ title: t('analyzeCode.toast.codeFetched.title' as TranslationKey), description: t('analyzeCode.toast.codeFetched.description' as TranslationKey) });
    } catch (e: any) {
      const errorMsg = e.message || "Error al obtener el código de la URL.";
      setError(errorMsg);
      addLog(`Failed to fetch from URL: ${errorMsg}`);
      toast({ variant: "destructive", title: t('analyzeCode.toast.fetchError.title' as TranslationKey), description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initiates the code analysis process by calling the AI flow.
   * Manages loading states, error handling, and displays results.
   */
  const handleAnalyze = async () => {
    if (!codeToAnalyze.trim()) {
      toast({ variant: "destructive", title: t('analyzeCode.toast.emptyCode.title' as TranslationKey), description: t('analyzeCode.toast.emptyCode.description' as TranslationKey) });
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
      addLog({message: `Analyzing with Group: ${llmConfigSource.name}. Using orchestrator's system prompt for analysis flow.`, flowName});
    }

    const analysisInput: AnalyzeCodeSnippetInput = {
      code: codeToAnalyze,
      userPrompt: userAnalysisPrompt || undefined,
      agentSystemPrompt: agentSystemPrompt
    };
    
    addLog({ message: `Analyzing code with input: ${JSON.stringify({code: codeToAnalyze.substring(0,50)+"...", userPrompt: analysisInput.userPrompt})}`, config: llmConfigSource, flowName });


    try {
      const aiResult = await callAnalyzeCodeSnippet(analysisInput);
      setResult(aiResult);
      addLog({ message: "Code analysis successful.", flowName });
      toast({ title: t('analyzeCode.toast.analysisComplete.title' as TranslationKey), description: t('analyzeCode.toast.analysisComplete.description' as TranslationKey) });
    } catch (e: any) {
      addLog({ source:"AnalyzeCodePage", message: "Code analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeCode.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis.";
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeCode.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Saves a snapshot of either the original or suggested code.
   * @param {'original' | 'suggested'} type - The type of code to save.
   */
  const handleSaveSnapshot = (type: 'original' | 'suggested') => {
    if (!result) return;
    const codeToSave = type === 'original' ? result.originalCode : result.suggestedCode;
    if (!codeToSave) {
        toast({variant: "destructive", title: t('analyzeCode.toast.snapshotError.title' as TranslationKey), description: t('analyzeCode.toast.snapshotError.description' as TranslationKey, { type }) });
        return;
    }
    const name = t('analyzeCode.results.snapshotName' as TranslationKey, {type: type === 'original' ? 'Original' : 'Sugerido', time: new Date().toLocaleTimeString() });
    addSnapshot({ name, code: codeToSave, source: type });
  };
  
  /**
   * Attempts to use AI to provide a solution or explanation for a displayed error.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    // This functionality is now handled by ErrorDisplay component itself
    toast({ title: t('common.processing'), description: t('errorDisplay.toast.autofixAttempt.description' as TranslationKey)});
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <PageSectionHeader
        icon={ScanLine}
        title={t('analyzeCode.title' as TranslationKey)}
        description={t('analyzeCode.description' as TranslationKey)}
      />
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} label={t('common.llmSourceLabel' as TranslationKey)} />
        
        <div className="space-y-4 p-4 border rounded-md">
          <Label className="font-semibold">{t('analyzeCode.codeSourceLabel' as TranslationKey)}</Label>
          <div className="space-y-2">
            <Label htmlFor="file-upload-code" className="text-sm">{t('analyzeCode.uploadFileLabel' as TranslationKey)}</Label>
            <Input id="file-upload-code" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.js,.ts,.py,.java,.html,.css,.json,.md" disabled={isLoading} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-grow space-y-2">
              <Label htmlFor="git-file-url" className="text-sm">{t('analyzeCode.gitFileUrlLabel' as TranslationKey)}</Label>
              <Input id="git-file-url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder={t('analyzeCode.gitFileUrlPlaceholder' as TranslationKey)} disabled={isLoading} />
            </div>
            <Button onClick={handleFetchFromUrl} variant="outline" disabled={isLoading || !fileUrl.trim()}>{t('analyzeCode.fetchUrlButton' as TranslationKey)}</Button>
          </div>
           <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('analyzeCode.pasteCodeInstruction' as TranslationKey)}</span>
            </div>
          </div>
          <CodeEditor
            id="analizar-codigo-main"
            value={codeToAnalyze}
            onChange={setCodeToAnalyze}
            placeholder={t('analyzeCode.pasteCodePlaceholder' as TranslationKey)}
            rows={10}
            className="font-mono text-sm"
            disabled={isLoading}
          />
          <div className="space-y-2">
            <Label htmlFor="user-analysis-prompt" className="text-sm">{t('analyzeCode.additionalInstructionsLabel' as TranslationKey)}</Label>
            <Textarea
                id="user-analysis-prompt"
                value={userAnalysisPrompt}
                onChange={(e) => setUserAnalysisPrompt(e.target.value)}
                placeholder={t('analyzeCode.additionalInstructionsPlaceholder' as TranslationKey)}
                rows={2}
                disabled={isLoading}
            />
          </div>
        </div>
        
        <Button onClick={handleAnalyze} disabled={isLoading || !codeToAnalyze.trim()} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('analyzeCode.analyzeButton' as TranslationKey)}
        </Button>

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError' as TranslationKey) )} />}

        {result && (
          <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
            <div>
              <h3 className="font-semibold text-lg mb-2">{t('analyzeCode.results.explanationLabel' as TranslationKey)}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">{t('analyzeCode.results.originalCodeLabel' as TranslationKey)}</h3>
                <Button variant="outline" size="sm" onClick={() => handleSaveSnapshot('original')}><Save className="mr-2 h-3 w-3" />{t('analyzeCode.results.saveOriginalButton' as TranslationKey)}</Button>
              </div>
              <CodeBlock code={result.originalCode} maxHeight="300px"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">{t('analyzeCode.results.suggestedCodeLabel' as TranslationKey)}</h3>
                <Button variant="outline" size="sm" onClick={() => handleSaveSnapshot('suggested')}><Save className="mr-2 h-3 w-3" />{t('analyzeCode.results.saveSuggestedButton' as TranslationKey)}</Button>
              </div>
              <CodeBlock code={result.suggestedCode} maxHeight="300px"/>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
