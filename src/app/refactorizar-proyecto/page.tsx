"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, BadgeHelp, BadgeCheck, BadgeX, GitPullRequestDraft, ListChecks, Info } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, RefactorSuggestion, RefactorProjectWithAIInput, RefactorProjectWithAIOutput as AIResult, AppSourceFile } from '@/types';
import { GENERAL_PRIORITIES, GeneralPriority } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import CodeBlock from '@/components/code-block';
import ConfirmDialog from '@/components/confirm-dialog';
import { callRefactorProjectWithAI } from '@/utils/apiClient';
import LogsDisplay from '@/components/logs-display';
import { Separator } from "@/components/ui/separator";
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { fetchRemoteGitRepository } from '@/app/autoupdate/actions';


type ProjectSourceType = "upload" | "git";
const NINGUNA_PRIORITY_VALUE = "__none__";

/**
 * @fileOverview RefactorizarProyectoPage component allows users to analyze an existing project
 * for refactoring suggestions. Users can upload a project or provide a Git URL,
 * select an LLM configuration, and specify refactoring goals and priorities.
 * The component then displays AI-generated suggestions and a project overview.
 * All UI texts are internationalized.
 */
export default function RefactorizarProyectoPage() {
  const { agents, groups, getAgentById, getGroupById } = useAppState();
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
    } else if (llmConfigSource === undefined) {
        setLlmConfigSource({ type: 'Ajustes Globales' as const });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);


  const [projectSourceType, setProjectSourceType] = useState<ProjectSourceType>("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [gitUrl, setGitUrl] = useState('');
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      const allowedExtensions = ['.py', '.js', '.java', '.json', '.html', '.css', '.txt', '.md'];
      const isAllowedTextFile = allowedExtensions.some(ext => file.name.endsWith(ext)) && file.type.startsWith('text/');

      if ((allowedTypes.includes(file.type) || isAllowedTextFile || file.name.endsWith('.zip')) && file.size <= 10 * 1024 * 1024) {
        setUploadedFile(file);
        addLog({message: `File selected for refactor: ${file.name}, type: ${file.type}, size: ${file.size} bytes`, flowName: 'handleFileChange'});
      } else {
        toast({ variant: "destructive", title: t('refactorProject.toast.invalidFile.title' as TranslationKey), description: t('refactorProject.toast.invalidFile.description' as TranslationKey) });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
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
        projectContentForAI = await uploadedFile.text(); // Assuming text-based files or JSON for now
        // For ZIP, actual unzipping and file reading would need a server-side component
        // or a client-side library like JSZip if it's a flat structure or specific known files.
        // For this example, we'll pass the name as a reference if it's a ZIP.
        if (uploadedFile.type === 'application/zip') {
            projectContentForAI = `Contenido del archivo ZIP: ${uploadedFile.name}. La IA debe inferir la estructura y contenido relevante.`;
        }
        addLog({message: `Analyzing uploaded file for refactor: ${uploadedFile.name}`, flowName});
      } catch (readError: any) {
        toast({ variant: "destructive", title: t('refactorProject.toast.fileReadError.title'), description: t('refactorProject.toast.fileReadError.description', { error: readError.message }) });
        setIsLoading(false);
        setLoadingMessage(null);
        return;
      }
    } else if (projectSourceType === "git" && gitUrl) {
      setLoadingMessage(t('refactorProject.toast.fetchingGit'));
      addLog({message: `Fetching Git URL for refactor: ${gitUrl}`, flowName});
      try {
        const gitResult = await fetchRemoteGitRepository(gitUrl);
        if (gitResult.success && gitResult.files) {
          projectContentForAI = gitResult.files.map(f => `// --- ${t('autoupdate.analysis.fileMarker')}: ${f.fileName} ---\n${f.content}`).join('\n\n');
          if (gitResult.logsBuilt) {
            gitResult.logsBuilt.forEach(logMsg => addLog({ source: 'FetchRemoteGit(Refactor)', message: logMsg }));
          }
        } else {
          throw new Error(gitResult.error || t('refactorProject.toast.gitFetchError.unknown'));
        }
      } catch (gitError: any) {
        toast({ variant: "destructive", title: t('refactorProject.toast.gitFetchError.title'), description: gitError.message });
        setError(gitError.message);
        setIsLoading(false);
        setLoadingMessage(null);
        return;
      }
    } else {
      toast({ variant: "destructive", title: t('refactorProject.toast.sourceRequired.title' as TranslationKey), description: t('refactorProject.toast.sourceRequired.description' as TranslationKey) });
      setIsLoading(false);
      setLoadingMessage(null);
      return;
    }

    if (!projectContentForAI && projectSourceType !== 'git') { // Git might fetch empty content if repo is empty
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
        const group = getGroupById(llmConfigSource.id || '');
        const orchestrator = getAgentById('orquestador-flujo-agentes');
        agentSystemPrompt = orchestrator?.systemPrompt || group?.mainTask;
        flowName = `refactorProjectWithAI (Group: ${group?.name || llmConfigSource.id})`;
    }

    const input: RefactorProjectWithAIInput = {
      projectSource: projectContentForAI, // Pass actual content
      goals: refactorGoals || undefined,
      priority: generalPriority === NINGUNA_PRIORITY_VALUE ? undefined : generalPriority,
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: focusArea || undefined,
      agentSystemPrompt
    };

    addLog({message: `Refactoring project with input: ${JSON.stringify({...input, projectSource: input.projectSource.substring(0,200) + '...' })} and config: ${JSON.stringify(llmConfigSource)}`, flowName});

    try {
      const aiResultData: AIResult = await callRefactorProjectWithAI(input);
      let finalResult: AIResult = { ...aiResultData };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name && llmConfigSource.id) {
         finalResult.groupLog = t('refactorProject.logs.groupContextLog' as TranslationKey, {
            groupName: llmConfigSource.name,
            groupTask: (getGroupById(llmConfigSource.id || '')?.mainTask || 'N/A').substring(0,150),
            userInput: (input.focusArea || t('autoupdate.analysis.general' as TranslationKey)),
            orchestratorContext: (getAgentById('orquestador-flujo-agentes')?.systemPrompt || t('autoupdate.logs.notAvailable' as TranslationKey)).substring(0, 200),
            flowName: 'refactorProjectWithAI'
        });
      }
      setAnalysisResult(finalResult);
      setSuggestions(finalResult.suggestions.map((s,idx) => ({...s, id: `suggestion-${idx}-${Date.now()}`, status: 'pending'})));
      toast({ title: t('refactorProject.toast.analysisComplete.title' as TranslationKey), description: t('refactorProject.toast.analysisComplete.description' as TranslationKey) });
      addLog({message: "Refactoring analysis successful.", data: finalResult, flowName});
    } catch (e: any) {
      addLog({source:"RefactorProjectPage", message: "Refactoring analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: t('refactorProject.toast.analysisError.title' as TranslationKey), description: e.friendlyMessage });
        if (e.redirectTo) {
          router.push(e.redirectTo);
        }
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis de refactorización.";
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
    const suggestionArea = suggestions.find(s=>s.id===id)?.area || 'desconocida';
    toast({ title: t('refactorProject.toast.suggestionApplied.title' as TranslationKey), description: t('refactorProject.toast.suggestionApplied.description' as TranslationKey, { area: suggestionArea }) });
    addLog({message: `Suggestion ${id} marked as applied.`, flowName: 'handleApplySuggestion'});
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
    addLog({message: `Suggestion ${id} discarded.`, flowName: 'handleDiscardSuggestion'});
  };

  const handleApplyAll = () => {
    setSuggestions(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'applied' } : s));
    toast({ title: t('refactorProject.toast.allApplied.title' as TranslationKey), description: t('refactorProject.toast.allApplied.description' as TranslationKey) });
    addLog({message: "All pending suggestions marked as applied.", flowName: 'handleApplyAll'});
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <PageSectionHeader
          icon={GitPullRequestDraft}
          title={t('refactorProject.title' as TranslationKey)}
          description={t('refactorProject.description' as TranslationKey)}
        />
        <CardContent className="space-y-6">
          <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} label={t('refactorProject.llmSourceLabel' as TranslationKey)} />

          <div className="space-y-2">
            <Label>{t('refactorProject.projectSourceLabel' as TranslationKey)}</Label>
            <Select value={projectSourceType} onValueChange={(value) => setProjectSourceType(value as ProjectSourceType)} disabled={isLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upload">{t('refactorProject.sourceUpload' as TranslationKey)}</SelectItem>
                <SelectItem value="git">{t('refactorProject.sourceGit' as TranslationKey)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {projectSourceType === "upload" && (
            <div className="space-y-2">
              <Label htmlFor="file-upload">{t('refactorProject.uploadLabel' as TranslationKey)}</Label>
              <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} disabled={isLoading} accept=".zip,.json,.js,.ts,.py,.java,.html,.css,.txt,.md" />
              {uploadedFile && <p className="text-xs text-muted-foreground">{t('common.fileSelected' as TranslationKey, { name: uploadedFile.name })}</p>}
            </div>
          )}

          {projectSourceType === "git" && (
            <div className="space-y-2">
              <Label htmlFor="git-url">{t('refactorProject.gitUrlLabel' as TranslationKey)}</Label>
              <Input id="git-url" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder={t('refactorProject.gitUrlPlaceholder' as TranslationKey)} disabled={isLoading} />
            </div>
          )}

          <Separator />
          <Label>{t('refactorProject.paramsLabel' as TranslationKey)}</Label>
          <div className="space-y-2">
            <Label htmlFor="refactor-goals" className="text-sm font-normal">{t('refactorProject.goalsLabel' as TranslationKey)}</Label>
            <Textarea id="refactor-goals" value={refactorGoals} onChange={(e) => setRefactorGoals(e.target.value)} placeholder={t('refactorProject.goalsPlaceholder' as TranslationKey)} rows={3} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general-priority" className="text-sm font-normal">{t('refactorProject.priorityLabel' as TranslationKey)}</Label>
            <Select
              value={generalPriority === '' ? NINGUNA_PRIORITY_VALUE : generalPriority}
              onValueChange={(selectedValue) => {
                setGeneralPriority(selectedValue as GeneralPriority | typeof NINGUNA_PRIORITY_VALUE);
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="general-priority">
                <SelectValue placeholder={t('refactorProject.priorityPlaceholder' as TranslationKey)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNA_PRIORITY_VALUE}>{t('refactorProject.priorityNone' as TranslationKey)}</SelectItem>
                {GENERAL_PRIORITIES.map(p => <SelectItem key={p} value={p}>{t(`refactorProject.priorities.${p.replace(/\\s+/g, '')}` as TranslationKey, {defaultValue: p} )}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search-depth" className="text-sm font-normal">{t('refactorProject.depthLabel' as TranslationKey)}</Label>
            <Input id="search-depth" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder={t('refactorProject.depthPlaceholder' as TranslationKey)} disabled={isLoading} min="1" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="focus-area" className="text-sm font-normal">{t('refactorProject.focusLabel' as TranslationKey)}</Label>
            <Input id="focus-area" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder={t('refactorProject.focusPlaceholder' as TranslationKey)} disabled={isLoading} />
          </div>

          <Button onClick={handleAnalyze} disabled={isLoading || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? loadingMessage : t('refactorProject.analyzeButton' as TranslationKey)}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <PageSectionHeader
            icon={ListChecks}
            title={t('refactorProject.results.title' as TranslationKey)}
            actions={suggestions.length > 0 ? (
                <Button onClick={handleApplyAll} size="sm" variant="outline" disabled={isLoading || suggestions.every(s => s.status !== 'pending')}>
                    {t('refactorProject.results.applyAllButton' as TranslationKey)}
                </Button>
            ) : null}
        />
        <CardContent>
          {error && <ErrorDisplay error={error} />}
          {isLoading && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{loadingMessage || t('common.processing')}...</p></div>}

          {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">{t('refactorProject.results.noSuggestions' as TranslationKey)}</p>}

          {analysisResult && (
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-4 pr-4">
                {analysisResult.projectOverview && (
                    <Card className="mb-4 bg-muted/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5 text-blue-600" />{t('refactorProject.results.projectSummaryCard.title' as TranslationKey)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                        <p className="whitespace-pre-wrap">{analysisResult.projectOverview || t('refactorProject.results.projectSummaryCard.noSummary' as TranslationKey)}</p>
                    </CardContent>
                    </Card>
                )}

                <Separator className="my-4" />
                <h3 className="text-lg font-semibold mb-2">{t('refactorProject.results.suggestionsTitle' as TranslationKey)}</h3>
                {suggestions.length === 0 && <p className="text-muted-foreground text-sm">{t('refactorProject.results.noSpecificSuggestions' as TranslationKey)}</p>}
                {suggestions.map(s => (
                  <Card key={s.id} className={`transition-opacity ${s.status === 'discarded' ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-md font-semibold">{s.area}</CardTitle>
                          <CardDescription>{t('refactorProject.suggestion.priorityLabel' as TranslationKey)} <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></CardDescription>
                        </div>
                        {s.status === 'pending' && <BadgeHelp className="text-blue-500 h-5 w-5" />}
                        {s.status === 'applied' && <BadgeCheck className="text-green-500 h-5 w-5" />}
                        {s.status === 'discarded' && <BadgeX className="text-muted-foreground h-5 w-5" />}
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="mb-2 whitespace-pre-wrap">{s.description}</p>
                      {s.snippetSuggested && (
                         <div className="my-2 p-2 bg-secondary/50 rounded-md">
                            <p className="text-xs font-semibold mb-1">{t('refactorProject.suggestion.snippetLabel' as TranslationKey)}</p>
                            <p className="text-xs text-muted-foreground break-all">{t('refactorProject.suggestion.snippetOriginal' as TranslationKey)} <code>{s.snippetSuggested.original?.substring(0,100)}{s.snippetSuggested.original && s.snippetSuggested.original.length > 100 ? '...' : ''}</code></p>
                            <p className="text-xs text-muted-foreground break-all">{t('refactorProject.suggestion.snippetModified' as TranslationKey)} <code>{s.snippetSuggested.modified?.substring(0,100)}{s.snippetSuggested.modified && s.snippetSuggested.modified.length > 100 ? '...' : ''}</code></p>
                         </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 py-2">
                      {s.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleViewDiff(s)} disabled={!s.snippetSuggested}>{t('refactorProject.suggestion.viewDiffButton' as TranslationKey)}</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDiscardSuggestion(s.id)}>{t('refactorProject.suggestion.discardButton' as TranslationKey)}</Button>
                          <Button size="sm" onClick={() => handleApplySuggestion(s.id)}>{t('refactorProject.suggestion.applyButton' as TranslationKey)}</Button>
                        </>
                      )}
                       {s.status !== 'pending' && (
                         <Button size="sm" variant="ghost" onClick={() => setSuggestions(prev => prev.map(sg => sg.id === s.id ? {...sg, status: 'pending'} : sg))}>{t('refactorProject.suggestion.revertStateButton' as TranslationKey)}</Button>
                       )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          {analysisResult?.groupLog && <LogsDisplay title={t('refactorProject.logs.groupLogTitle' as TranslationKey)} logs={analysisResult.groupLog} />}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        onConfirm={() => setShowDiffModal(false)}
        title={t('refactorProject.diffModal.title' as TranslationKey)}
        confirmText={t('common.close')}
        cancelText=""
      >
        {currentDiff && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h4 className="font-semibold mb-1">{t('refactorProject.diffModal.originalLabel' as TranslationKey)}</h4>
              <CodeBlock code={currentDiff.original || t('refactorProject.diffModal.noContent' as TranslationKey)} language="plaintext" maxHeight="250px" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">{t('refactorProject.diffModal.suggestedLabel' as TranslationKey)}</h4>
              <CodeBlock code={currentDiff.modified || t('refactorProject.diffModal.noContent' as TranslationKey)} language="plaintext" maxHeight="250px"/>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}