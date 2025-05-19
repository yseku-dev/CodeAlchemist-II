
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, AnalyzeCodeInput, AnalyzeCodeOutput } from '@/types';
import { callAnalyzeSelfCode as analyzeProjectFlow, callRedefinePrompt } from '@/utils/apiClient'; // Added callRedefinePrompt
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AnalyzeProjectHeader from '@/components/features/analizar-proyecto/AnalyzeProjectHeader';
import AnalyzeProjectForm from '@/components/features/analizar-proyecto/AnalyzeProjectForm';
import AnalyzeProjectResultsDisplay from '@/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions';


type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
 * All UI texts are internationalized.
 */
export default function AnalizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [searchDepth, setSearchDepth] = useState<string>('');
  const [focusArea, setFocusArea] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeOutput | null>(null);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json'];
      if (allowedTypes.includes(file.type) && file.size <= 25 * 1024 * 1024) {
        setUploadedFile(file);
        addLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Project file selected for analysis: ${file.name}, type: ${file.type}, size: ${file.size} bytes`, flowName: 'handleFileChange'});
      } else {
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title'), description: t('analyzeProject.toast.invalidFile.description') });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const executeActualAnalysis = async (input: AnalyzeCodeInput) => {
     const flowName = 'analyzeProject (analyzeProjectFlow via callAnalyzeSelfCode)';
     addLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Analyzing project with input: ${JSON.stringify({...input, projectContent: input.projectContent ? input.projectContent.substring(0,200) + '...' : 'N/A' })} and config: ${JSON.stringify(llmConfigSource)}`, flowName});

    try {
      const aiResult = await analyzeProjectFlow(input);
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         finalResult.groupLog = t('analyzeProject.results.groupContextLog', {
            groupName: llmConfigSource.name,
            groupTask: (getGroupById(llmConfigSource.id || '')?.mainTask || 'N/A').substring(0,150),
            userInput: (input.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (getAgentById('orquestador-flujo-agentes')?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalyzeProject)'
        });
      }

      setResult(finalResult);
      toast({ title: t('analyzeProject.toast.analysisComplete.title'), description: t('analyzeProject.toast.analysisComplete.description') });
      addLog({source: 'AnalizarProyectoPage', type: 'SUCCESS', message: "Project analysis successful.", data: finalResult, flowName});
    } catch (e: any) {
      addLog({ source:"AnalizarProyectoPage", type: 'ERROR', message: "Project analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis del proyecto.";
        setError(errorMsg);
        toast({ variant: "destructive", title: t('analyzeProject.toast.analysisError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }

  const handleAnalyze = async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing'));
    setError(null);
    setResult(null);

    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        agentSystemPrompt = group?.mainTask; 
    }

    let analysisInputBase: AnalyzeCodeInput = {
        sourceCodeLocation: projectSourceType === 'git' ? 'Git' : 'UploadedString',
        analysisPreferences: focusArea || undefined,
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        focusArea: focusArea || undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    if (projectSourceType === "upload" && uploadedFile) {
      setLoadingMessage(t('analyzeProject.toast.processingFile'));
      const reader = new FileReader();
      reader.onload = async (e) => {
          const projectContent = e.target?.result as string;
          const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            projectContent: projectContent,
            sourceCodeLocation: "UploadedString",
          };
          addLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Analyzing uploaded project: ${uploadedFile.name}`, flowName: 'analyzeProject'});
          await executeActualAnalysis(analysisInput);
      };
      reader.onerror = () => {
          toast({ variant: "destructive", title: t('analyzeProject.toast.readError.title'), description: t('analyzeProject.toast.readError.description')});
          setIsLoading(false);
          setLoadingMessage(null);
      }
      if (uploadedFile.type === 'application/json') {
        reader.readAsText(uploadedFile);
      } else if (uploadedFile.type === 'application/zip') {
        const analysisInput: AnalyzeCodeInput = { 
            ...analysisInputBase,
            projectContent: `Contenido del archivo ZIP: ${uploadedFile.name}. La IA debe inferir el contenido o la estructura relevante.`,
            sourceCodeLocation: "UploadedString",
        };
        addLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Analyzing uploaded ZIP project (by reference): ${uploadedFile.name}`, flowName: 'analyzeProject'});
        await executeActualAnalysis(analysisInput);
      } else {
          toast({ variant: "destructive", title: t('analyzeProject.toast.unsupportedFileType.title'), description: t('analyzeProject.toast.unsupportedFileType.description')});
          setIsLoading(false);
          setLoadingMessage(null);
      }
      return;
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('analyzeProject.toast.fetchingGit'));
      addLog({source: 'AnalizarProyectoPage', type: 'INFO', message: `Fetching Git project URL for analysis: ${gitUrl}`, flowName: 'analyzeProject'});
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.success && gitResult.files) {
          const projectContentString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            gitRepoUrl: gitUrl,
            projectContent: projectContentString,
            sourceCodeLocation: "Git",
          };
          if (gitResult.logsBuilt) {
            gitResult.logsBuilt.forEach(logMsg => addLog({ source: 'FetchRemoteGit(AnalyzeProject)', message: logMsg }));
          }
          await executeActualAnalysis(analysisInput);
        } else {
          throw new Error(gitResult.error || t('analyzeProject.toast.gitFetchError.unknown'));
        }
      } catch (gitError: any) {
        toast({ variant: "destructive", title: t('analyzeProject.toast.gitFetchError.title'), description: gitError.message });
        setError(gitError.message);
        setIsLoading(false);
        setLoadingMessage(null);
        return;
      }
    } else {
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: t('analyzeProject.toast.sourceRequired.description') });
      setIsLoading(false);
      setLoadingMessage(null);
      return;
    }
  };

  const handleAutoFixError = async (errorMsg: string) => {
    toast({
      title: t('common.processing'),
      description: t('errorDisplay.toast.autofixAttempt.description')
    });
  };
  
  const handleRedefineFocusAreaProject = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningFocusArea(true);
    addLog({ source: 'AnalizarProyectoPage', type: 'INFO', message: `Redefining focus area. Original: ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addLog({ source: 'AnalizarProyectoPage', type: 'SUCCESS', message: `'focusArea' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addLog({ source: 'AnalizarProyectoPage', type: 'ERROR', message: `Redefining 'focusArea' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <AnalyzeProjectHeader t={t} />
      <CardContent className="space-y-6">
        <AnalyzeProjectForm
          llmConfigSource={llmConfigSource}
          onLlmConfigSourceChange={setLlmConfigSource}
          projectSourceType={projectSourceType}
          onProjectSourceTypeChange={setProjectSourceType}
          uploadedFile={uploadedFile}
          onFileChange={handleFileChange}
          fileInputRef={fileInputRef}
          gitUrl={gitUrl}
          onGitUrlChange={setGitUrl}
          searchDepth={searchDepth}
          onSearchDepthChange={setSearchDepth}
          focusArea={focusArea}
          onFocusAreaChange={setFocusArea}
          onAnalyze={handleAnalyze}
          isLoading={isLoading || isRedefiningFocusArea}
          loadingMessage={loadingMessage}
          t={t}
          isRedefiningFocusArea={isRedefiningFocusArea}
          onRedefineFocusArea={handleRedefineFocusAreaProject}
        />

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || t('common.unknownError'))} />}

        {isLoading && !result && !error && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('analyzeProject.results.analyzing')}</p></div>}

        <AnalyzeProjectResultsDisplay result={result} t={t} />
      </CardContent>
    </Card>
  );
}
