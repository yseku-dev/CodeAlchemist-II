// src/app/refactorizar-proyecto/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react'; // Removed useRef as it's in the hook
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAppState } from '@/context/AppStateContext';
import type {
  LLMConfigSourceOption,
  RefactorSuggestion,
  RefactorProjectWithAIInput,
  RefactorProjectWithAIOutput as AIResult,
  Agent,
  AIAgentGroup,
  CodeSnapshot,
} from '@/types';
import { GENERAL_PRIORITIES, NINGUNA_PRIORITY_VALUE } from '@/lib/constants';
import { callRefactorProjectWithAI } from '@/utils/apiClient';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { fetchRemoteGitRepository, getApplicationSourceBundle } from '@/app/autoupdate/actions';
import RefactorProjectConfigSection from '@/components/features/refactorizar-proyecto/RefactorProjectConfigSection';
import RefactorProjectResultsSection from '@/components/features/refactorizar-proyecto/RefactorProjectResultsSection';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useRefactorProjectForm, type ProjectSourceType, type RefactorProjectFormData } from '@/hooks/useRefactorProjectForm'; // Import the new hook

/**
 * @fileOverview Page component for "Refactorizar Proyecto".
 * Allows users to analyze an existing project (from upload, Git, or local source)
 * for refactoring suggestions, manage these suggestions, and view diffs.
 * Uses custom hook `useRefactorProjectForm` for form state and logic.
 * Internationalized.
 */
export default function RefactorizarProyectoPage() {
  const { agents, getAgentById, getGroupById, addSnapshot } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { addLog: addDebugLog } = useDebug();
  const { toast } = useToast();

  // LLM Configuration State (remains in page)
  const [llmConfigSource, setLlmConfigSource] = useLocalStorage<LLMConfigSourceOption | undefined>(
    'codealchemist-rp-llmConfigSourcePage', // Ensure unique key if hook uses similar
    undefined
  );

  // Form state and logic now handled by the custom hook
  const {
    projectSourceType, setProjectSourceType,
    uploadedFile, uploadedFileName, handleFileChange, fileInputRef,
    gitUrl, setGitUrl,
    refactorGoals, setRefactorGoals,
    generalPriority, setGeneralPriority,
    searchDepth, setSearchDepth,
    focusArea, setFocusArea,
    isRedefiningGoals, handleRedefineGoals,
    isRedefiningFocusArea, handleRedefineFocusArea,
    getFormDataForAnalysis,
  } = useRefactorProjectForm();

  // Results and UI State (remains in page)
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useLocalStorage<AIResult | null>('codealchemist-rp-analysisResult', null);
  const [suggestions, setSuggestions] = useLocalStorage<RefactorSuggestion[]>('codealchemist-rp-suggestions', []);
  const [projectSourceString, setProjectSourceString] = useLocalStorage<string | null>('codealchemist-rp-projectSourceString', null);

  const [showDiffModal, setShowDiffModal] = useState(false);
  const [currentDiff, setCurrentDiff] = useState<{ original?: string; modified?: string } | null>(null);


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
  }, [agents, llmConfigSource, setLlmConfigSource]);

  /**
   * Handles the main analysis process.
   * Fetches project source based on type, then calls the AI refactoring flow.
   */
  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing' as TranslationKey));
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    let currentProjectSourceString = ""; // Renamed to avoid conflict with state variable

    const formData = getFormDataForAnalysis(); // Get data from hook

    if (formData.projectSourceType === "upload" && formData.uploadedFile) {
      setLoadingMessage(t('refactorProject.toast.processingFile' as TranslationKey));
      try {
        currentProjectSourceString = await formData.uploadedFile.text();
        addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Analizando archivo subido: ${formData.uploadedFile.name}`, flowName: 'handleAnalyze' });
      } catch (readError: any) {
        toast({ variant: "destructive", title: t('refactorProject.toast.fileReadError.title' as TranslationKey), description: t('refactorProject.toast.fileReadError.description' as TranslationKey, { error: readError.message }) });
        setIsLoading(false); setLoadingMessage(null); return;
      }
    } else if (formData.projectSourceType === "git" && formData.gitUrl) {
      setLoadingMessage(t('refactorProject.toast.fetchingGit' as TranslationKey));
      addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Obteniendo URL de Git: ${formData.gitUrl}`, flowName: 'handleAnalyze' });
      try {
        const gitResult = await fetchRemoteGitRepository(formData.gitUrl);
        if (gitResult.success && gitResult.files) {
          currentProjectSourceString = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\\n${f.content}`).join('\\n\\n');
          if (gitResult.logsBuilt) gitResult.logsBuilt.forEach(logMsg => addDebugLog({ source: 'FetchRemoteGit(Refactor)', type: 'INFO', message: logMsg }));
        } else {
          throw new Error(gitResult.error || t('refactorProject.toast.gitFetchError.unknown' as TranslationKey));
        }
      } catch (gitError: any) {
        const errorMsg = (gitError as Error).message || t('refactorProject.toast.gitFetchError.unknown' as TranslationKey);
        toast({ variant: "destructive", title: t('refactorProject.toast.gitFetchError.title' as TranslationKey), description: errorMsg });
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null); return;
      }
    } else if (formData.projectSourceType === "local") {
      setLoadingMessage(t('refactorProject.toast.gettingLocalSource.title' as TranslationKey));
      try {
        const bundleResult = await getApplicationSourceBundle(false);
        if (bundleResult.success && bundleResult.files) {
          currentProjectSourceString = bundleResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\\n${f.content}`).join('\\n\\n');
          if (bundleResult.logsBuilt) addDebugLog({ source: 'GetBundle(Refactor)', type: 'INFO_BATCH', message: 'Logs de ServerAction (getApplicationSourceBundle):', data: bundleResult.logsBuilt });
        } else {
          throw new Error(bundleResult.error || t('refactorProject.toast.localSourceError.descriptionDefault' as TranslationKey));
        }
      } catch (localSourceError: any) {
        const errorMsg = (localSourceError as Error).message || t('refactorProject.toast.localSourceError.descriptionDefault' as TranslationKey);
        toast({ variant: "destructive", title: t('refactorProject.toast.localSourceError.title' as TranslationKey), description: errorMsg });
        setError(errorMsg); setIsLoading(false); setLoadingMessage(null); return;
      }
    }
     else {
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

    const inputForAI: RefactorProjectWithAIInput = {
      projectSource: currentProjectSourceString,
      goals: formData.refactorGoals || undefined,
      priority: formData.generalPriority === NINGUNA_PRIORITY_VALUE ? undefined : formData.generalPriority,
      searchDepth: formData.searchDepth ? parseInt(formData.searchDepth, 10) : undefined,
      focusArea: formData.focusArea || undefined,
      agentSystemPrompt
    };
    addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Refactorizando proyecto. Input (parcial): ${JSON.stringify({ ...inputForAI, projectSource: inputForAI.projectSource.substring(0, 200) + '...' })}. Config: ${JSON.stringify(llmConfigSource)}`, flowName });

    try {
      const aiResultData: AIResult = await callRefactorProjectWithAI(inputForAI);
      let finalResult: AIResult = { ...aiResultData };
      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id && !finalResult.groupLog) {
        const group = getGroupById(llmConfigSource.id || '');
        const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
        finalResult.groupLog = t('refactorProject.logs.groupContextLog' as TranslationKey, {
          groupName: llmConfigSource.name,
          groupTask: (group?.mainTask || 'N/A').substring(0, 150),
          userInput: (inputForAI.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
          orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
          flowName: 'refactorProjectWithAI'
        });
      }
      setAnalysisResult(finalResult);
      setSuggestions(finalResult.suggestions.map((s, idx) => ({ ...s, id: `suggestion-${idx}-${Date.now()}`, status: 'pending' })));
      toast({ title: t('refactorProject.toast.analysisComplete.title' as TranslationKey), description: t('refactorProject.toast.analysisComplete.description' as TranslationKey) });
      addDebugLog({ source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: "Análisis de refactorización exitoso.", data: { overviewLength: finalResult.projectOverview?.length, suggestionCount: finalResult.suggestions?.length }, flowName });
    } catch (e: any) {
      addDebugLog({ source: "RefactorizarProyectoPage", type: 'ERROR', message: "Fallo en análisis de refactorización (UI).", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) router.push(e.redirectTo);
      } else {
        const errorMsg = (e as Error).message || t('refactorProject.toast.analysisError.descriptionDefault' as TranslationKey);
        setError(errorMsg);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title' as TranslationKey), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    llmConfigSource, getAgentById, getGroupById, t, toast, router, addDebugLog,
    setAnalysisResult, setSuggestions, setError, setLoadingMessage, setIsLoading,
    getFormDataForAnalysis, setProjectSourceString,
    // Removed form-specific states as they are now in the hook
  ]);

  const handleApplySuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' } : s));
    const suggestionArea = suggestions.find(s => s.id === id)?.area || t('common.unknownError' as TranslationKey);
    toast({ title: t('refactorProject.toast.suggestionApplied.title' as TranslationKey), description: t('refactorProject.toast.suggestionApplied.description' as TranslationKey, { area: suggestionArea }) });
    addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Sugerencia ${id} marcada como aplicada.`, flowName: 'handleApplySuggestion' });
  }, [suggestions, setSuggestions, t, toast, addDebugLog]);

  const handleViewDiff = useCallback((suggestion: RefactorSuggestion) => {
    if (suggestion.snippetSuggested) {
      setCurrentDiff(suggestion.snippetSuggested);
      setShowDiffModal(true);
    } else {
      toast({ title: t('refactorProject.toast.noDiff.title' as TranslationKey), description: t('refactorProject.toast.noDiff.description' as TranslationKey) });
    }
  }, [toast, t]);

  const handleDiscardSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'discarded' } : s));
    toast({ title: t('refactorProject.toast.suggestionDiscarded.title' as TranslationKey) });
    addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Sugerencia ${id} descartada.`, flowName: 'handleDiscardSuggestion' });
  }, [setSuggestions, t, toast, addDebugLog]);

  const handleApplyAll = useCallback(() => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: t('refactorProject.toast.allApplied.title' as TranslationKey), description: t('refactorProject.toast.allApplied.description' as TranslationKey) });
    addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: "Todas las sugerencias pendientes marcadas como aplicadas.", flowName: 'handleApplyAll' });
  }, [setSuggestions, t, toast, addDebugLog]);

  const handleSaveRefactoredSnapshot = useCallback(() => {
    if (!analysisResult && !projectSourceString) {
      toast({ variant: "destructive", title: t('versions.toast.snapshotSaveError.title' as TranslationKey), description: t('versions.toast.snapshotSaveError.noContent' as TranslationKey, { section: t('sidebar.refactorProject' as TranslationKey) }) });
      return;
    }
    const formData = getFormDataForAnalysis();
    let contentToSave: any = {};
    let snapshotNamePrefix = t('refactorProject.results.snapshotNamePrefix' as TranslationKey);

    if (analysisResult) {
      contentToSave.analysis = {
        projectOverview: analysisResult.projectOverview,
        suggestionsSummary: suggestions.map(s_ => ({ area: s_.area, description: s_.suggestion, priority: s_.priority, status: s_.status })),
      };
      if (suggestions.some(s => s.status === 'applied')) {
        snapshotNamePrefix = t('refactorProject.results.snapshotNameAppliedPrefix' as TranslationKey);
      }
    }
    if (projectSourceString) {
      contentToSave.originalSourceHint = formData.projectSourceType === 'git'
        ? `Git: ${formData.gitUrl}`
        : `Subido: ${formData.uploadedFileName || t('common.unknownFile' as TranslationKey)}`;
    }

    const snapshotName = `${snapshotNamePrefix} - ${new Date().toLocaleTimeString()}`;
    const snapshotDataString = JSON.stringify(contentToSave, null, 2);
    addSnapshot({
      name: snapshotName,
      code: snapshotDataString,
      source: 'refactored-project',
      size: snapshotDataString.length,
    });
    addDebugLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Snapshot de proyecto refactorizado guardado: ${snapshotName}` });
  }, [analysisResult, projectSourceString, suggestions, getFormDataForAnalysis, addSnapshot, t, toast, addDebugLog]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      <RefactorProjectConfigSection
        llmConfigSource={llmConfigSource}
        onLlmConfigSourceChange={setLlmConfigSource}
        // Pass states and handlers from useRefactorProjectForm
        projectSourceType={projectSourceType}
        onProjectSourceTypeChange={setProjectSourceType}
        uploadedFile={uploadedFile} // This is fine, as the hook manages the File object
        uploadedFileName={uploadedFileName}
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
        isRedefiningGoals={isRedefiningGoals}
        onRedefineGoals={handleRedefineGoals}
        isRedefiningFocusArea={isRedefiningFocusArea}
        onRedefineFocusArea={handleRedefineFocusArea}
        // Pass page-level handlers
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        loadingMessage={loadingMessage}
        t={t}
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
