
// src/app/refactorizar-proyecto/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, RefactorSuggestion, RefactorProjectWithAIInput, RefactorProjectWithAIOutput as AIResult, Agent, AIAgentGroup, CodeSnapshot } from '@/types';
import { GENERAL_PRIORITIES, type GeneralPriority, NINGUNA_PRIORITY_VALUE } from '@/lib/constants';
import { callRefactorProjectWithAI, callRedefinePrompt } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions';
import RefactorProjectConfigSection from '@/components/features/refactorizar-proyecto/RefactorProjectConfigSection';
import RefactorProjectResultsSection from '@/components/features/refactorizar-proyecto/RefactorProjectResultsSection';
import LogsDisplay from '@/components/logs-display';


type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview RefactorizarProyectoPage component allows users to analyze an existing project
 * for refactoring suggestions. Users can upload a project or provide a Git URL,
 * select an LLM configuration, and specify refactoring goals and priorities.
 * The component then displays AI-generated suggestions and a project overview.
 * All UI texts are internationalized.
 * This page has been refactored into smaller, more granular components.
 */
export default function RefactorizarProyectoPage() {
  const { agents, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(undefined);

  useEffect(() => {
    if (agents && agents.length > 0 && llmConfigSource === undefined) {
      const defaultAgentFound = agents.find(a => a.name === "RefactorizadorCodigoExperto");
      setLlmConfigSource(defaultAgentFound
        ? { type: 'Agente' as const, id: defaultAgentFound.id, name: defaultAgentFound.name }
        : { type: 'Ajustes Globales' as const }
      );
    } else if (agents && llmConfigSource === undefined) { 
        setLlmConfigSource({ type: 'Ajustes Globales' as const });
    }
  }, [agents, llmConfigSource]);


  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [projectSourceString, setProjectSourceString] = useState<string | null>(null); 

  const [refactorGoals, setRefactorGoals] = useState('');
  const [generalPriority, setGeneralPriority] = useState<GeneralPriority | typeof NINGUNA_PRIORITY_VALUE>(NINGUNA_PRIORITY_VALUE);
  const [searchDepth, setSearchDepth] = useState<string>(''); 
  const [focusArea, setFocusArea] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIResult | null>(null);
  const [suggestions, setSuggestions] = useState<RefactorSuggestion[]>([]);

  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentDiff, setCurrentDiff] = useState<{ original?: string, modified?: string } | null>(null);
  
  const [isRedefiningGoals, setIsRedefiningGoals] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      const allowedExtensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.json', '.html', '.css', '.txt', '.md'];
      const isAllowedTextFile = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) && 
                                (file.type.startsWith('text/') || file.type === 'application/octet-stream' || file.type === '');

      if ((allowedTypes.includes(file.type) || isAllowedTextFile || file.name.toLowerCase().endsWith('.zip')) && file.size <= 10 * 1024 * 1024) { 
        setUploadedFile(file);
        addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Archivo seleccionado para refactorizar: ${file.name}`, flowName: 'handleFileChange'});
      } else {
        toast({ variant: "destructive", title: t('refactorProject.toast.invalidFile.title' as TranslationKey), description: t('refactorProject.toast.invalidFile.description' as TranslationKey) });
        setUploadedFile(null); 
        if(fileInputRef.current) fileInputRef.current.value = ""; 
      }
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    let projectContentForAI = "";
    let currentProjectSourceString = "";

    if (projectSourceType === "upload" && uploadedFile) {
      setLoadingMessage(t('refactorProject.toast.processingFile' as TranslationKey));
      try {
        currentProjectSourceString = await uploadedFile.text();
        projectContentForAI = currentProjectSourceString;
        if (uploadedFile.type === 'application/zip' || uploadedFile.name.toLowerCase().endsWith('.zip')) {
            projectContentForAI = `Contenido del archivo ZIP: ${uploadedFile.name}. (El contenido real del ZIP no se envía directamente al LLM en esta versión; se espera que el análisis se base en las metas y el enfoque si el LLM no puede procesar el ZIP).`;
        }
        addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Analizando archivo subido para refactorizar: ${uploadedFile.name}`, flowName: 'handleAnalyze'});
      } catch (readError: any) {
        toast({ variant: "destructive", title: t('refactorProject.toast.fileReadError.title' as TranslationKey), description: t('refactorProject.toast.fileReadError.description' as TranslationKey, { error: readError.message }) });
        setIsLoading(false); setLoadingMessage(null); return;
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('refactorProject.toast.fetchingGit' as TranslationKey));
      addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Obteniendo URL de Git para refactorizar: ${gitUrl}`, flowName: 'handleAnalyze'});
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.success && gitResult.files) {
          currentProjectSourceString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\\n${f.content}`).join('\\n\\n');
          projectContentForAI = currentProjectSourceString; 
          if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addLog({ source: 'FetchRemoteGit(Refactor)', type: 'INFO', message: logMsg }));
        } else {
          throw new Error(gitResult.error || t('refactorProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        const errorMsg = gitError.message || t('refactorProject.toast.gitFetchError.unknown' as TranslationKey);
        toast({ variant: "destructive", title: t('refactorProject.toast.gitFetchError.title' as TranslationKey), description: errorMsg });
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null); return;
      }
    } else {
      toast({ variant: "destructive", title: t('refactorProject.toast.sourceRequired.title' as TranslationKey), description: t('refactorProject.toast.sourceRequired.description' as TranslationKey) });
      setIsLoading(false); setLoadingMessage(null); return;
    }
    setProjectSourceString(currentProjectSourceString); 

    setLoadingMessage(t('refactorProject.toast.analyzingWithAI' as TranslationKey));
    let agentSystemPrompt: string | undefined;
    const flowName = 'callRefactorProjectWithAI';
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group: AIAgentGroup | undefined = getGroupById(llmConfigSource.id || '');
        const orchestrator: Agent | undefined = getAgentById('orquestador-flujo-agentes');
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask;
    }

    const input: RefactorProjectWithAIInput = {
      projectSource: projectContentForAI,
      goals: refactorGoals || undefined,
      priority: generalPriority === NINGUNA_PRIORITY_VALUE ? undefined : generalPriority,
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: focusArea || undefined,
      agentSystemPrompt
    };
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Refactorizando proyecto con input: ${JSON.stringify({...input, projectSource: input.projectSource.substring(0,200) + '...' })} y config: ${JSON.stringify(llmConfigSource)}`, flowName});

    try {
      const aiResultData: AIResult = await callRefactorProjectWithAI(input);
      let finalResult: AIResult = { ...aiResultData };
      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id && !finalResult.groupLog) {
         const group = getGroupById(llmConfigSource.id || '');
         const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
         finalResult.groupLog = t('refactorProject.logs.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (input.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'refactorProjectWithAI'
        });
      }
      setAnalysisResult(finalResult);
      setSuggestions(finalResult.suggestions.map((s,idx) => ({...s, id: `suggestion-${idx}-${Date.now()}`, status: 'pending'})));
      toast({ title: t('refactorProject.toast.analysisComplete.title' as TranslationKey), description: t('refactorProject.toast.analysisComplete.description' as TranslationKey) });
      addLog({source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: "Análisis de refactorización exitoso.", data: {overviewLength: finalResult.projectOverview.length, suggestionCount: finalResult.suggestions.length}, flowName});
    } catch (e: any) {
      addLog({source:"RefactorizarProyectoPage", type: 'ERROR', message: "Fallo en análisis de refactorización (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('refactorProject.toast.analysisError.description' as TranslationKey) ;
        setError(errorMsg);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  const handleApplySuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' } : s));
    const suggestionArea = suggestions.find(s=>s.id===id)?.area || t('common.unknownError' as TranslationKey);
    toast({ title: t('refactorProject.toast.suggestionApplied.title' as TranslationKey), description: t('refactorProject.toast.suggestionApplied.description' as TranslationKey, { area: suggestionArea }) });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Sugerencia ${id} marcada como aplicada.`, flowName: 'handleApplySuggestion'});
  };

  const handleViewDiff = (suggestion: RefactorSuggestion) => {
    if (suggestion.snippetSuggested) {
      setCurrentDiff(suggestion.snippetSuggested);
      setShowDiffModal(true);
    } else {
      toast({ title: t('refactorProject.toast.noDiff.title' as TranslationKey), description: t('refactorProject.toast.noDiff.description' as TranslationKey) });
    }
  };

  const handleDiscardSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'discarded' } : s));
    toast({ title: t('refactorProject.toast.suggestionDiscarded.title' as TranslationKey) });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Sugerencia ${id} descartada.`, flowName: 'handleDiscardSuggestion'});
  };

  const handleApplyAll = () => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: t('refactorProject.toast.allApplied.title' as TranslationKey), description: t('refactorProject.toast.allApplied.description' as TranslationKey) });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: "Todas las sugerencias pendientes marcadas como aplicadas.", flowName: 'handleApplyAll'});
  };

  const handleRedefineGoals = async () => {
    if (!refactorGoals.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningGoals(true);
    addLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Redefiniendo metas. Original (inicio): ${refactorGoals.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: refactorGoals });
      setRefactorGoals(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addLog({ source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: `'metas' redefinidas. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addLog({ source: 'RefactorizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'metas'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsRedefiningGoals(false);
    }
  };

  const handleRedefineFocusArea = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningFocusArea(true);
    addLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Redefiniendo campo de enfoque. Original (inicio): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addLog({ source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: `'campo de enfoque' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addLog({ source: 'RefactorizarProyectoPage', type: 'ERROR', message: `Fallo al redefinir 'campo de enfoque'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('common.toast.redefineError.description' as TranslationKey);
        setError(errorMsg);
        toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };
  
  const handleSaveRefactoredSnapshot = useCallback(() => {
    if (!analysisResult && !projectSourceString) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, { section: t('sidebar.refactorProject' as TranslationKey) }) });
      return;
    }

    let contentToSave: any = {};
    let snapshotNamePrefix = t('refactorProject.results.snapshotNamePrefix' as TranslationKey);

    if (analysisResult) {
      contentToSave.analysis = {
        projectOverview: analysisResult.projectOverview,
        // Solo guardamos la descripción de las sugerencias, no el contenido de código completo si es muy grande
        suggestionsSummary: suggestions.map(s => ({ area: s.area, description: s.description, priority: s.priority, status: s.status })),
      };
      if (suggestions.some(s => s.status === 'applied')) {
        snapshotNamePrefix = t('refactorProject.results.snapshotNameAppliedPrefix' as TranslationKey);
      }
    }
    if (projectSourceString) {
      contentToSave.originalSourceHint = projectSourceType === 'git' 
        ? `Git: ${gitUrl}` 
        : `Subido: ${uploadedFile?.name || t('common.unknownFile' as TranslationKey) }`;
      // No guardamos el projectSourceString completo si es muy grande, solo una referencia.
      // Para guardar el código con sugerencias aplicadas, necesitaríamos un proceso más complejo.
    }
    
    const snapshotName = `${snapshotNamePrefix} - ${new Date().toLocaleTimeString()}`;
    addSnapshot({
      name: snapshotName,
      code: JSON.stringify(contentToSave, null, 2),
      source: 'refactored-project'
    });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Snapshot de proyecto refactorizado guardado: ${snapshotName}`});
  }, [analysisResult, projectSourceString, suggestions, projectSourceType, gitUrl, uploadedFile, addSnapshot, t, toast]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      <RefactorProjectConfigSection
        llmConfigSource={llmConfigSource}
        onLlmConfigSourceChange={setLlmConfigSource}
        projectSourceType={projectSourceType}
        onProjectSourceTypeChange={setProjectSourceType}
        uploadedFile={uploadedFile}
        onFileChange={handleFileChange}
        fileInputRef={fileInputRef}
        gitUrl={gitUrl}
        onGitUrlChange={setGitUrl}
        refactorGoals={refactorGoals}
        onRefactorGoalsChange={setRefactorGoals}
        generalPriority={generalPriority}
        onGeneralPriorityChange={setGeneralPriority}
        searchDepth={searchDepth}
        onSearchDepthChange={setSearchDepth}
        focusArea={focusArea}
        onFocusAreaChange={setFocusArea}
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        t={t}
        isRedefiningGoals={isRedefiningGoals}
        onRedefineGoals={handleRedefineGoals}
        isRedefiningFocusArea={isRedefiningFocusArea}
        onRedefineFocusArea={handleRedefineFocusArea}
      />
      <div className="lg:col-span-2 space-y-6">
        <RefactorProjectResultsSection
          analysisResult={analysisResult}
          suggestions={suggestions}
          isLoading={isLoading}
          error={error}
          loadingMessage={loadingMessage}
          onApplySuggestion={handleApplySuggestion}
          onViewDiff={handleViewDiff}
          onDiscardSuggestion={handleDiscardSuggestion}
          onApplyAll={handleApplyAll}
          setSuggestions={setSuggestions}
          showDiffModal={showDiffModal}
          onCloseDiffModal={() => setShowDiffModal(false)}
          currentDiff={currentDiff}
          t={t}
          onSaveSnapshot={handleSaveRefactoredSnapshot}
        />
         {analysisResult?.groupLog && (
          <LogsDisplay title={t('refactorProject.logs.groupLogTitle' as TranslationKey)} logs={analysisResult.groupLog} />
        )}
      </div>
    </div>
  );
}
