
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, RefactorSuggestion, RefactorProjectWithAIInput, RefactorProjectWithAIOutput as AIResult, Agent, AIAgentGroup } from '@/types';
import { GENERAL_PRIORITIES, type GeneralPriority } from '@/lib/constants';
import { callRefactorProjectWithAI, callRedefinePrompt } from '@/utils/apiClient';
import { useAppState } from '@/context/AppStateContext';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions'; // Assuming this is the correct path for server action
import RefactorProjectConfigSection from '@/components/features/refactorizar-proyecto/RefactorProjectConfigSection';
import RefactorProjectResultsSection from '@/components/features/refactorizar-proyecto/RefactorProjectResultsSection';


type ProjectSourceType = "upload" | "git";
const NINGUNA_PRIORITY_VALUE = "__none__";

/**
 * @fileOverview RefactorizarProyectoPage component allows users to analyze an existing project
 * for refactoring suggestions. Users can upload a project or provide a Git URL,
 * select an LLM configuration, and specify refactoring goals and priorities.
 * The component then displays AI-generated suggestions and a project overview.
 * All UI texts are internationalized.
 * This page has been refactored into smaller, more granular components.
 */
export default function RefactorizarProyectoPage() {
  const { agents, getAgentById, getGroupById } = useAppState();
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
    } else if (llmConfigSource === undefined && agents) { // Ensure agents is loaded before defaulting
        setLlmConfigSource({ type: 'Ajustes Globales' as const });
    }
  }, [agents, llmConfigSource]);


  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [refactorGoals, setRefactorGoals] = useState('');
  const [generalPriority, setGeneralPriority] = useState<GeneralPriority | typeof NINGUNA_PRIORITY_VALUE>(NINGUNA_PRIORITY_VALUE);
  const [searchDepth, setSearchDepth] = useState<string>(''); // Kept as string for input[type=number]
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
      // Looser validation: allow common code files and general text, plus ZIP and JSON for projects
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      const allowedExtensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.json', '.html', '.css', '.txt', '.md'];
      // Check if it's a known text-based type or has a common code extension (even if type is octet-stream)
      const isAllowedTextFile = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) && 
                                (file.type.startsWith('text/') || file.type === 'application/octet-stream' || file.type === '');

      if ((allowedTypes.includes(file.type) || isAllowedTextFile || file.name.toLowerCase().endsWith('.zip')) && file.size <= 10 * 1024 * 1024) { // 10MB limit
        setUploadedFile(file);
        addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `File selected for refactor: ${file.name}, type: ${file.type}, size: ${file.size} bytes`, flowName: 'handleFileChange'});
      } else {
        toast({ variant: "destructive", title: t('refactorProject.toast.invalidFile.title'), description: t('refactorProject.toast.invalidFile.description') });
        setUploadedFile(null); // Clear selection
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    setLoadingMessage(t('common.processing'));
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    let flowName = 'refactorProjectWithAI';

    let projectContentForAI = "";

    if (projectSourceType === "upload" && uploadedFile) {
      setLoadingMessage(t('refactorProject.toast.processingFile'));
      try {
        projectContentForAI = await uploadedFile.text();
        // If it's a zip, send a marker message instead of actual content for now.
        // A real implementation would need server-side unzipping.
        if (uploadedFile.type === 'application/zip' || uploadedFile.name.toLowerCase().endsWith('.zip')) {
            projectContentForAI = `Contenido del archivo ZIP: ${uploadedFile.name}. La IA debe inferir la estructura y contenido relevante o esperar un análisis más profundo.`;
        }
        addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Analyzing uploaded file for refactor: ${uploadedFile.name}`, flowName});
      } catch (readError: any) {
        toast({ variant: "destructive", title: t('refactorProject.toast.fileReadError.title'), description: t('refactorProject.toast.fileReadError.description', { error: readError.message }) });
        setIsLoading(false);
        setLoadingMessage(null);
        return;
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('refactorProject.toast.fetchingGit'));
      addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Fetching Git URL for refactor: ${gitUrl}`, flowName});
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl); // Uses Server Action
        if (gitResult.success && gitResult.files) {
          projectContentForAI = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker' as TranslationKey)}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          if (gitResult.logsBuilt) {
            gitResult.logsBuilt.forEach(logMsg => addLog({ source: 'FetchRemoteGit(Refactor)', type: 'INFO', message: logMsg }));
          }
        } else {
          throw new Error(gitResult.error || t('refactorProject.toast.gitFetchError.unknown'));
        }
      } catch (gitError: any) {
        const errorMsg = gitError.message || t('refactorProject.toast.gitFetchError.unknown');
        toast({ variant: "destructive", title: t('refactorProject.toast.gitFetchError.title'), description: errorMsg });
        setError(errorMsg);
        setIsLoading(false);
        setLoadingMessage(null);
        return;
      }
    } else {
      toast({ variant: "destructive", title: t('refactorProject.toast.sourceRequired.title'), description: t('refactorProject.toast.sourceRequired.description') });
      setIsLoading(false);
      setLoadingMessage(null);
      return;
    }

    if (!projectContentForAI && !(projectSourceType === "git" && gitUrl)) { // Ensure content or git url was processed
        toast({ variant: "destructive", title: t('refactorProject.toast.noContentToAnalyze.title'), description: t('refactorProject.toast.noContentToAnalyze.description') });
        setIsLoading(false);
        setLoadingMessage(null);
        return;
    }
    setLoadingMessage(t('refactorProject.toast.analyzingWithAI'));

    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
        flowName = `refactorProjectWithAI (Agent: ${agent?.name || llmConfigSource.id})`;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group: AIAgentGroup | undefined = getGroupById(llmConfigSource.id || '');
        const orchestrator: Agent | undefined = getAgentById('orquestador-flujo-agentes');
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask; // Prioritize Orchestrator
        flowName = `refactorProjectWithAI (Group: ${group?.name || llmConfigSource.id})`;
    }

    const input: RefactorProjectWithAIInput = {
      projectSource: projectContentForAI, // This might be very large
      goals: refactorGoals || undefined,
      priority: generalPriority === NINGUNA_PRIORITY_VALUE ? undefined : generalPriority,
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: focusArea || undefined,
      agentSystemPrompt
    };

    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Refactoring project with input: ${JSON.stringify({...input, projectSource: input.projectSource.substring(0,200) + '...' })} and config: ${JSON.stringify(llmConfigSource)}`, flowName});

    try {
      const aiResultData: AIResult = await callRefactorProjectWithAI(input);
      let finalResult: AIResult = { ...aiResultData };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         const group = getGroupById(llmConfigSource.id || '');
         const orchestratorAgent = getAgentById('orquestador-flujo-agentes');
         finalResult.groupLog = t('refactorProject.logs.groupContextLog', {
            groupName: llmConfigSource.name,
            groupTask: (group?.mainTask || 'N/A').substring(0,150),
            userInput: (input.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (orchestratorAgent?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'refactorProjectWithAI'
        });
      }
      setAnalysisResult(finalResult);
      setSuggestions(finalResult.suggestions.map((s,idx) => ({...s, id: `suggestion-${idx}-${Date.now()}`, status: 'pending'})));
      toast({ title: t('refactorProject.toast.analysisComplete.title'), description: t('refactorProject.toast.analysisComplete.description') });
      addLog({source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: "Refactoring analysis successful.", data: finalResult, flowName});
    } catch (e: any) {
      addLog({source:"RefactorizarProyectoPage", type: 'ERROR', message: "Refactoring analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title'), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = (e as Error).message || t('refactorProject.toast.analysisError.description') ;
        setError(errorMsg);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title'), description: errorMsg });
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  const handleApplySuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'applied' } : s));
    const suggestionArea = suggestions.find(s=>s.id===id)?.area || t('common.unknownError');
    toast({ title: t('refactorProject.toast.suggestionApplied.title'), description: t('refactorProject.toast.suggestionApplied.description', { area: suggestionArea }) });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Suggestion ${id} marked as applied.`, flowName: 'handleApplySuggestion'});
  };

  const handleViewDiff = (suggestion: RefactorSuggestion) => {
    if (suggestion.snippetSuggested) {
      setCurrentDiff(suggestion.snippetSuggested);
      setShowDiffModal(true);
    } else {
      toast({ title: t('refactorProject.toast.noDiff.title'), description: t('refactorProject.toast.noDiff.description') });
    }
  };

  const handleDiscardSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'discarded' } : s));
    toast({ title: t('refactorProject.toast.suggestionDiscarded.title') });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: `Suggestion ${id} discarded.`, flowName: 'handleDiscardSuggestion'});
  };

  const handleApplyAll = () => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: t('refactorProject.toast.allApplied.title'), description: t('refactorProject.toast.allApplied.description') });
    addLog({source: 'RefactorizarProyectoPage', type: 'INFO', message: "All pending suggestions marked as applied.", flowName: 'handleApplyAll'});
  };

  const handleRedefineGoals = async () => {
    if (!refactorGoals.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningGoals(true);
    addLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Redefining goals. Original: ${refactorGoals.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: refactorGoals });
      setRefactorGoals(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addLog({ source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: `'goals' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addLog({ source: 'RefactorizarProyectoPage', type: 'ERROR', message: `Redefining 'goals' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningGoals(false);
    }
  };

  const handleRedefineFocusArea = async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningFocusArea(true);
    addLog({ source: 'RefactorizarProyectoPage', type: 'INFO', message: `Redefining focus area. Original: ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addLog({ source: 'RefactorizarProyectoPage', type: 'SUCCESS', message: `'focusArea' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addLog({ source: 'RefactorizarProyectoPage', type: 'ERROR', message: `Redefining 'focusArea' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  };

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
      />
    </div>
  );
}

