
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FolderSearch, ListChecks } from 'lucide-react'; 
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, AnalyzeCodeInput, AnalyzeCodeOutput, Agent } from '@/types'; 
import { callAnalyzeSelfCode as analyzeProjectFlow } from '@/utils/apiClient'; 
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppState } from '@/context/AppStateContext';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';
import { AppError } from '@/utils/AppError';
import { useI18n } from '@/context/I18nContext';


type ProjectSourceType = "upload" | "git";

/**
 * @fileOverview AnalizarProyectoPage component allows users to perform a holistic analysis
 * of an entire project. Users can upload a project (ZIP/JSON) or provide a Git URL,
 * select an LLM configuration, and specify analysis parameters. The component then
 * displays the AI's overall assessment, identified areas, and specific suggestions.
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeOutput | null>(null); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json'];
      if (allowedTypes.includes(file.type) && file.size <= 25 * 1024 * 1024) { 
        setUploadedFile(file);
        addLog(`Project file selected for analysis: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
      } else {
        toast({ variant: "destructive", title: t('analyzeProject.toast.invalidFile.title'), description: t('analyzeProject.toast.invalidFile.description') });
        setUploadedFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const executeAnalysis = async (input: AnalyzeCodeInput) => {
     const flowName = 'analyzeProject (callAnalyzeSelfCode flow)';
     addLog({message: `Analyzing project with input: ${JSON.stringify(input).substring(0, 200)}... and config: ${JSON.stringify(llmConfigSource)}`, flowName});
    
    try {
      const aiResult = await analyzeProjectFlow(input); 
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined, overallImprovementIdeas: aiResult.overallImprovementIdeas || [] };

      if (llmConfigSource?.type === 'Grupo' && llmConfigSource.name) {
         finalResult.groupLog = t('autoupdate.logs.groupContextLog', { // Reusing autoupdate log for now
            groupName: llmConfigSource.name,
            groupTask: (getGroupById(llmConfigSource.id || '')?.mainTask || 'N/A').substring(0,150),
            userInput: (input.focusArea || t('autoupdate.analysis.general')),
            orchestratorContext: (getAgentById('orquestador-flujo-agentes')?.systemPrompt || t('autoupdate.logs.notAvailable')).substring(0, 200),
            flowName: 'analyzeSelfCode (AnalyzeProject)'
        });
      }

      setResult(finalResult);
      toast({ title: t('analyzeProject.toast.analysisComplete.title'), description: t('analyzeProject.toast.analysisComplete.description') });
      addLog({message: "Project analysis successful.", data: finalResult, flowName});
    } catch (e: any) {
      addLog({ message: "Project analysis failed in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
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
    }
  }

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = getGroupById(llmConfigSource.id || '');
        // Use group's main task as context for the analysis flow, as it's more direct than orchestrator's generic prompt
        agentSystemPrompt = group?.mainTask;
    }

    let analysisInputBase: Omit<AnalyzeCodeInput, 'sourceCodeLocation' | 'projectContent' | 'gitRepoUrl'> = {
        analysisPreferences: focusArea || undefined, 
        searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
        focusArea: focusArea || undefined,
        agentSystemPrompt: agentSystemPrompt
    };

    if (projectSourceType === "upload" && uploadedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const projectContent = e.target?.result as string;
          const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            sourceCodeLocation: "UploadedString",
            projectContent: projectContent, 
          };
          addLog(`Analyzing uploaded project: ${uploadedFile.name}`);
          await executeAnalysis(analysisInput);
      };
      reader.onerror = () => {
          toast({ variant: "destructive", title: t('analyzeProject.toast.readError.title'), description: t('analyzeProject.toast.readError.description')});
          setIsLoading(false);
      }
      if (uploadedFile.type === 'application/json') {
        reader.readAsText(uploadedFile);
      } else if (uploadedFile.type === 'application/zip') {
        // Pass a reference for ZIP; the flow `analyzeSelfCode` should handle it based on projectContent.
        const analysisInput: AnalyzeCodeInput = {
            ...analysisInputBase,
            sourceCodeLocation: "UploadedString", 
            projectContent: `Contenido del archivo ZIP: ${uploadedFile.name}. (El flujo debe poder interpretar esto como una referencia o el contenido real si se envía).`,
          };
        addLog(`Analyzing uploaded ZIP project: ${uploadedFile.name} (reference/placeholder content)`);
        await executeAnalysis(analysisInput);
      } else {
          toast({ variant: "destructive", title: t('analyzeProject.toast.unsupportedFileType.title'), description: t('analyzeProject.toast.unsupportedFileType.description')});
          setIsLoading(false);
      }
      return; 
    } else if (projectSourceType === "git" && gitUrl) {
      const analysisInput: AnalyzeCodeInput = {
        ...analysisInputBase,
        sourceCodeLocation: "Git",
        gitRepoUrl: gitUrl,
      };
      addLog(`Analyzing Git project URL: ${gitUrl}`);
      await executeAnalysis(analysisInput);
    } else {
      toast({ variant: "destructive", title: t('analyzeProject.toast.sourceRequired.title'), description: t('analyzeProject.toast.sourceRequired.description') });
      setIsLoading(false);
      return;
    }
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <PageSectionHeader
        icon={FolderSearch}
        title={t('analyzeProject.title')}
        description={t('analyzeProject.description')}
      />
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} label={t('analyzeProject.llmSourceLabel')} />

        <div className="space-y-2">
          <Label>{t('analyzeProject.projectSourceLabel')}</Label>
          <Select value={projectSourceType} onValueChange={(value) => setProjectSourceType(value as ProjectSourceType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">{t('analyzeProject.sourceUpload')}</SelectItem>
              <SelectItem value="git">{t('analyzeProject.sourceGit')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {projectSourceType === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="project-file-upload">{t('analyzeProject.uploadLabel')}</Label>
            <Input id="project-file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zip,application/zip,.json,application/json" disabled={isLoading} />
            {uploadedFile && <p className="text-xs text-muted-foreground">Archivo seleccionado: {uploadedFile.name}</p>}
          </div>
        )}

        {projectSourceType === "git" && (
          <div className="space-y-2">
            <Label htmlFor="project-git-url">{t('analyzeProject.gitUrlLabel')}</Label>
            <Input id="project-git-url" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} placeholder={t('analyzeProject.gitUrlPlaceholder')} disabled={isLoading} />
          </div>
        )}

        <Separator />
        <Label>{t('analyzeProject.paramsLabel')}</Label>
        <div className="space-y-2">
          <Label htmlFor="search-depth-project" className="text-sm font-normal">{t('analyzeProject.depthLabel')}</Label>
          <Input id="search-depth-project" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder={t('analyzeProject.depthPlaceholder')} disabled={isLoading} min="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-area-project" className="text-sm font-normal">{t('analyzeProject.focusLabel')}</Label>
          <Input id="focus-area-project" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder={t('analyzeProject.focusPlaceholder')} disabled={isLoading} />
        </div>
        
        <Button onClick={handleAnalyze} disabled={isLoading || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('analyzeProject.analyzeButton')}
        </Button>

        {error && <ErrorDisplay error={error} />}

        {isLoading && !result && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{t('analyzeProject.results.analyzing')}</p></div>}
        
        {result && (
          <Card className="mt-6 bg-background">
            <PageSectionHeader icon={ListChecks} title={result.analysisTitle} />
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.overallAssessmentLabel')}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.generalAssessment}</p>
              </div>
              {result.overallImprovementIdeas && result.overallImprovementIdeas.length > 0 && (
                 <div>
                    <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.improvementIdeasLabel')}</h3>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {result.overallImprovementIdeas.map((idea, index) => <li key={`idea-${index}`}>{idea}</li>)}
                    </ul>
                 </div>
              )}
              <div>
                <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.identifiedAreasLabel')}</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {result.identifiedAreas.map((area, index) => <li key={index}>{area}</li>)}
                </ul>
              </div>
              {result.detailedSuggestions && result.detailedSuggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('analyzeProject.results.specificSuggestionsLabel')}</h3>
                  <ScrollArea className="h-60 border rounded-md p-2">
                    <ul className="space-y-3">
                    {result.detailedSuggestions.map((s, index) => (
                      <li key={index} className="p-2 border-b last:border-b-0">
                        <p className="font-medium text-sm">{s.area}</p>
                        <p className="text-xs text-muted-foreground">{s.suggestion}</p>
                        <p className="text-xs">{t('analyzeProject.results.suggestionPriorityLabel')} <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></p>
                        {s.suggestedPromptForImplementation && (
                          <div className="mt-1 pt-1 border-t border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground">{t('analyzeProject.results.suggestedPromptLabel')}</p>
                            <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-1 rounded-sm">{s.suggestedPromptForImplementation}</pre>
                          </div>
                        )}
                      </li>
                    ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              {result.groupLog && <LogsDisplay title={t('analyzeProject.results.groupLogTitle')} logs={result.groupLog} />}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
