
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, GitCommit } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AutoUpdateSuggestion } from '@/types';
import { analyzeSelfCode, type AnalyzeSelfCodeOutput, type AnalyzeSelfCodeInput } from '@/ai/flows/analyze-self-code';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';

type AutoUpdateSourceType = "Local" | "Git";

export default function AutoUpdatePage() {
  const { settings } = useAppState();
  const defaultAgent = settings.agents?.find(a => a.name === "RefactorizadorCodigoExperto");
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    defaultAgent ? { type: 'Agente', id: defaultAgent.id, name: defaultAgent.name } : { type: 'Ajustes Globales' }
  );
  const [sourceType, setSourceType] = useState<AutoUpdateSourceType>("Local");
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [analysisPreferences, setAnalysisPreferences] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<(AnalyzeSelfCodeOutput & { groupLog?: string }) | null>(null);
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

    const input: AnalyzeSelfCodeInput = {
      sourceCodeLocation: sourceType,
      gitRepoUrl: sourceType === "Git" ? gitRepoUrl : undefined,
      analysisPreferences: analysisPreferences || undefined,
    };

    try {
      if (llmConfigSource?.type !== 'Grupo') {
        let currentProgress = 0;
        const intervalId = setInterval(() => {
          currentProgress += 10;
          if (currentProgress <= 100) {
            setProgress(currentProgress);
          } else {
            clearInterval(intervalId);
          }
        }, 200);
         // Clear interval if component unmounts or isLoading becomes false
         // This might need more robust handling if analysis takes a very long time
        if (!isLoading) clearInterval(intervalId);
      }

      const aiResult = await analyzeSelfCode(input);
      const mappedSuggestions: AutoUpdateSuggestion[] = aiResult.detailedSuggestions.map((s, index) => ({
        id: `suggestion-${index}-${Date.now()}`,
        area: s.area,
        suggestion: s.suggestion,
        priority: s.priority,
        fullFileContentSuggested: s.suggestedContent,
        status: 'pending',
      }));
      setAnalysisResult({ ...aiResult, groupLog: llmConfigSource?.type === 'Grupo' ? "Simulated group log for AutoUpdate..." : undefined });
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
    addLog(`Applying suggestion to ${suggestionToApply.area} (Simulated).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied' } : s));
    toast({ title: "Sugerencia Aplicada (Simulado)", description: `Cambios para ${suggestionToApply.area} aplicados.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };
  
  const handleDownloadCode = (format: 'ZIP' | 'JSON') => {
    addLog(`Downloading current CodeAlchemist code as ${format} (Simulated).`);
    toast({ title: `Descarga ${format} (Simulada)`, description: "La descarga del código no está implementada." });
  };

  const handleGitCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    addLog(`Committing and pushing to Git with message: "${commitMessage}" (Simulated).`);
    toast({ title: "Subida a Git (Simulada)", description: "Los cambios se están subiendo al repositorio." });
    setShowCommitDialog(false);
    setCommitMessage('');
  };

  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>AutoUpdate (Análisis del Propio Código)</CardTitle>
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

          <div className="space-y-2">
            <Label htmlFor="analysis-prefs">Preferencias de Análisis (Opcional)</Label>
            <Textarea id="analysis-prefs" value={analysisPreferences} onChange={(e) => setAnalysisPreferences(e.target.value)} placeholder="Ej: Enfocarse en optimización UI. Todas las sugerencias en castellano." rows={3} disabled={isLoading} />
          </div>
          
          <Button onClick={handleStartAnalysis} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Auto-Análisis"}
          </Button>
          {isLoading && progress > 0 && progress < 100 && <Progress value={progress} className="w-full mt-2" />}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Resultados del Auto-Análisis</CardTitle>
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
        confirmText="Sí, Aplicar"
      >
        <p className="text-sm mb-2">Se modificará el archivo <code className="bg-muted px-1 rounded-sm">{suggestionToApply?.area}</code>. Revisa el contenido sugerido:</p>
        <ScrollArea className="h-64 border rounded-md">
          <CodeBlock code={suggestionToApply?.fullFileContentSuggested || "Error: No hay contenido para mostrar."} language="typescript" />
        </ScrollArea>
        <p className="text-xs text-destructive mt-2">Esta acción modificará el archivo directamente (simulado en esta UI).</p>
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
        <p className="text-xs text-muted-foreground mt-2">Esto ejecutará \`git commit -m "{commitMessage}"\` y \`git push\` (simulado).</p>
      </ConfirmDialog>
      
      <div className="lg:col-span-3 mt-4">
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={analysisResult?.groupLog ? [analysisResult.groupLog] : ["Inicia un análisis para ver los logs..."]} />
      </div>
    </div>
  );
}
