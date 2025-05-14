
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, GitCommit, Sparkles, ClipboardList } from 'lucide-react'; 
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion, AnalyzeCodeInput, AnalyzeCodeOutput, Agent } from '@/types';
import { analyzeSelfCode as analyzeProjectFlow } from '@/ai/flows/analyze-self-code'; // Renamed for consistency
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';
import { Separator } from '@/components/ui/separator';

type AutoUpdateSourceType = "Local" | "Git";

export default function AutoUpdatePage() {
  const { settings: globalSettings, agents, getAgentById } = useAppState();
  const defaultAgent = agents.find(a => a.name === "RefactorizadorCodigoExperto");
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    defaultAgent ? { type: 'Agente', id: defaultAgent.id, name: defaultAgent.name } : { type: 'Ajustes Globales' }
  );
  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState(''); 
  const [searchDepth, setSearchDepth] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCodeOutput | null>(null);
  const [suggestions, setSuggestions] = useState<AutoUpdateSuggestion[]>([]);

  const [showConfirmApplyDialog, setShowConfirmApplyDialog] = useState(false);
  const [suggestionToApply, setSuggestionToApply] = useState<AutoUpdateSuggestion | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  
  const { addLog } = useDebug();
  const { toast } = useToast();

  const handleStartAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setSuggestions([]);
    setProgress(0);
    addLog(`Starting AutoUpdate analysis. Source: ${sourceType}, Config: ${JSON.stringify(llmConfigSource)}`);

    const input: AnalyzeCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      analysisPreferences: analysisPreferences || undefined, // Used as 'focusArea' in the flow now
      searchDepth: searchDepth ? parseInt(searchDepth, 10) : undefined,
      focusArea: analysisPreferences || undefined,
    };

    // Handle agent/group context for the flow
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
      // The flow 'analyzeProjectFlow' (analyzeSelfCode) might need adaptation
      // to directly use an agent's system prompt if provided.
      // For now, the flow itself will determine the prompt based on its internal logic.
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const orchestrator = agents.find(a => a.id === 'orquestador-flujo-agentes');
      agentSystemPrompt = orchestrator?.systemPrompt;
      addLog(`AutoUpdate with Group: ${llmConfigSource.name}. Orchestrator context might be used by flow.`);
    }
    // If agentSystemPrompt is to be used, the 'input' or the flow call needs to accommodate it.
    // The current 'AnalyzeCodeInput' does not have a field for agentSystemPrompt.
    // For now, we rely on the flow's internal prompt logic.

    try {
      if (llmConfigSource?.type !== 'Grupo') {
        // Progress simulation only for non-group analysis
        let currentProgress = 0;
        const intervalId = setInterval(() => {
          currentProgress += 10;
          if (currentProgress <= 100) {
            setProgress(currentProgress);
          } else {
            clearInterval(intervalId);
          }
        }, 200);
      }

      const aiResult = await analyzeProjectFlow(input);
      const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => ({
        id: `suggestion-${index}-${Date.now()}`,
        area: s.area,
        suggestion: s.suggestion,
        priority: s.priority,
        fullFileContentSuggested: s.suggestedContent,
        status: 'pending',
      }));
      
      let finalResult: AnalyzeCodeOutput = { ...aiResult, groupLog: undefined };
      if (llmConfigSource?.type === 'Grupo') {
         finalResult.groupLog = `(Simulación de Log de Grupo para AutoUpdate)\nTurno 1: Orquestador -> AgenteAnalizadorInterno (usando '${llmConfigSource.name}'). Tarea: Analizar código de CodeAlchemist con enfoque en '${input.focusArea || 'general'}'.\nTurno 2: AgenteAnalizadorInterno -> Sugerencias generadas.`;
      }
      setAnalysisResult(finalResult);
      setSuggestions(mappedSuggestions);
      setProgress(100);
      toast({ title: "Auto-Análisis Completado", description: "Se han generado sugerencias para el código." });
      addLog("AutoUpdate analysis successful.");
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error durante el auto-análisis.";
      setError(errorMsg);
      addLog(`AutoUpdate analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Auto-Análisis", description: errorMsg });
      setProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestionClick = (suggestion: AutoUpdateSuggestion) => {
    if (!suggestion.fullFileContentSuggested) {
        toast({variant: "destructive", title: "Sin Contenido", description: "Esta sugerencia no tiene contenido de archivo para aplicar."});
        return;
    }
    setSuggestionToApply(suggestion);
    setShowConfirmApplyDialog(true);
  };

  const confirmApplySuggestion = () => {
    if (!suggestionToApply) return;
    addLog(`Marking suggestion as applied for ${suggestionToApply.area}. (Direct file modification is not feasible from browser).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied' } : s));
    toast({ title: "Sugerencia Marcada como Aplicada", description: `Cambios para ${suggestionToApply.area} marcados. La modificación real de archivos no es posible desde el navegador.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };
  
  const handleDownloadCode = (format: 'ZIP' | 'JSON') => {
    addLog(`Downloading current CodeAlchemist code as ${format}. (Functionality is a placeholder).`);
    toast({ title: `Descarga ${format}`, description: "La descarga del código fuente completo no está implementada en este entorno." });
  };

  const handleGitCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    addLog(`Committing and pushing to Git with message: "${commitMessage}". (Functionality requires backend/Git CLI access).`);
    toast({ title: "Subida a Git", description: "La subida a Git no está implementada en este entorno. Se requeriría acceso a Git CLI y autenticación." });
    setShowCommitDialog(false);
    setCommitMessage('');
  };

  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix", description: "La IA está analizando el error para proponer una solución. (Funcionalidad no implementada)"});
    // Placeholder for actual AI call to fix error
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-primary" />
            <span>AutoUpdate (Análisis del Propio Código)</span>
          </CardTitle>
          <CardDescription>Permite que CodeAlchemist analice su propio código fuente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
          
          <div className="space-y-2">
            <Label>Fuente del Código para Auto-Análisis</Label>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as AutoUpdateSourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Local">Local (código actual de la app)</SelectItem>
                <SelectItem value="Git">URL del Repositorio Git</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sourceType === "Git" && (
            <div className="space-y-2">
              <Label htmlFor="autoupdate-git-url">URL del Repositorio Git</Label>
              <Input id="autoupdate-git-url" value={gitRepoUrl} onChange={(e) => setGitRepoUrl(e.target.value)} placeholder="URL HTTPS del repo CodeAlchemist" disabled={isLoading} />
            </div>
          )}
          
          <Separator />
          <Label>Parámetros de Auto-Análisis</Label>
          <div className="space-y-2">
            <Label htmlFor="analysis-prefs" className="text-sm font-normal">Preferencias de Análisis / Campo de Enfoque (opcional)</Label>
            <Textarea id="analysis-prefs" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)} placeholder="Ej: Enfocarse en optimización UI. Todas las sugerencias en castellano." rows={3} disabled={isLoading} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="search-depth-autoupdate" className="text-sm font-normal">Profundidad de Búsqueda (opcional)</Label>
            <Input id="search-depth-autoupdate" type="number" value={searchDepth} onChange={(e) => setSearchDepth(e.target.value)} placeholder="Ej: 2 (niveles)" disabled={isLoading} min="1" />
          </div>
          
          <Button onClick={handleStartAnalysis} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Auto-Análisis"}
          </Button>
          {isLoading && progress > 0 && progress < 100 && llmConfigSource?.type !== 'Grupo' && <Progress value={progress} className="w-full mt-2" />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-primary" />
            <span>Resultados del Auto-Análisis</span>
          </CardTitle>
          {analysisResult && (
            <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => handleDownloadCode('ZIP')}><Download className="mr-2 h-4 w-4" /> Descargar Código (ZIP)</Button>
                <Button variant="outline" size="sm" onClick={() => handleDownloadCode('JSON')}><Download className="mr-2 h-4 w-4" /> Descargar Código (JSON)</Button>
                <Button variant="outline" size="sm" onClick={() => setShowCommitDialog(true)}><GitCommit className="mr-2 h-4 w-4" /> Subir a Git</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} />}
          {isLoading && !analysisResult && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando código...</p></div>}
          
          {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">Inicia un análisis para ver los resultados.</p>}

          {analysisResult && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">{analysisResult.analysisTitle}</h3>
              <p className="text-sm text-muted-foreground">{analysisResult.generalAssessment}</p>
              <div>
                <h4 className="font-semibold">Áreas Identificadas:</h4>
                <ul className="list-disc list-inside text-sm">
                  {analysisResult.identifiedAreas.map((area, i) => <li key={i}>{area}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold">Sugerencias Detalladas:</h4>
                {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No hay sugerencias detalladas.</p>}
                <ScrollArea className="max-h-[50vh] overflow-y-auto pr-2">
                    <div className="space-y-3">
                    {suggestions.map(s => (
                        <AutoUpdateSuggestionCard 
                        key={s.id} 
                        suggestion={s} 
                        onApply={handleApplySuggestionClick} 
                        />
                    ))}
                    </div>
                </ScrollArea>
              </div>
              {analysisResult.groupLog && <LogsDisplay title="Log de Ejecución del Grupo" logs={analysisResult.groupLog} />}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showConfirmApplyDialog && !!suggestionToApply}
        onClose={() => setShowConfirmApplyDialog(false)}
        onConfirm={confirmApplySuggestion}
        title={`Aplicar Sugerencia a ${suggestionToApply?.area}`}
        confirmText="Sí, Marcar como Aplicada"
      >
        <p className="text-sm mb-2">Se marcará como aplicada la sugerencia para <code className="bg-muted px-1 rounded-sm">{suggestionToApply?.area}</code>. La modificación real del archivo no es posible desde el navegador. Revisa el contenido sugerido y aplícalo manualmente:</p>
        <ScrollArea className="h-64 border rounded-md">
          <CodeBlock code={suggestionToApply?.fullFileContentSuggested || "Error: No hay contenido para mostrar."} language="typescript" maxHeight="100%" />
        </ScrollArea>
        
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        onConfirm={handleGitCommitAndPush}
        title="Subir Cambios a Git"
        confirmText="Commit y Push"
      >
        <Label htmlFor="commit-message">Mensaje de Commit:</Label>
        <Input id="commit-message" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Ej: Aplicadas sugerencias de AutoUpdate" className="mt-1" />
        <p className="text-xs text-muted-foreground mt-2">Esta acción intentaría realizar un commit y push. (Funcionalidad requiere acceso a Git CLI y autenticación no disponibles en este entorno).</p>
      </ConfirmDialog>
      
      <div className="lg:col-span-3 mt-4">
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={analysisResult?.groupLog ? [analysisResult.groupLog] : ["Inicia un análisis para ver los logs..."]} defaultExpanded={false}/>
      </div>
    </div>
  );
}
