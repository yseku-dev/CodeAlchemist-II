
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, GitCommit, Wand2 } from 'lucide-react';
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

type AutoUpdateSourceType = "Local" | "Git";

export default function AutoUpdatePage() {
  const { settings } = useAppState();
  const defaultAgentId = settings.agents?.find(a => a.name === "RefactorizadorCodigoExperto")?.id || '';
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>(
    defaultAgentId ? { type: 'Agente', id: defaultAgentId, name: 'RefactorizadorCodigoExperto' } : { type: 'Ajustes Globales' }
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
      // Simulate progress for non-group analysis
      if (llmConfigSource?.type !== 'Grupo') {
        let currentProgress = 0;
        const interval = setInterval(() => {
          currentProgress += 10;
          if (currentProgress <= 100) {
            setProgress(currentProgress);
          } else {
            clearInterval(interval);
          }
        }, 200);
      }

      const aiResult = await analyzeSelfCode(input);
      // Map AnalyzeSelfCodeOutput to AutoUpdateSuggestion[]
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
    // In a real app, this would modify files on the filesystem or trigger a backend process.
    // For this web UI, we'll simulate it and update the status.
    addLog(`Applying suggestion to ${suggestionToApply.area} (Simulated).`);
    setSuggestions(prev => prev.map(s => s.id === suggestionToApply.id ? { ...s, status: 'applied' } : s));
    toast({ title: "Sugerencia Aplicada (Simulado)", description: `Cambios para ${suggestionToApply.area} aplicados.` });
    setShowConfirmApplyDialog(false);
    setSuggestionToApply(null);
  };
  
  const handleDownloadCode = (format: 'ZIP' | 'JSON') => {
    // Placeholder for actual download logic
    addLog(`Downloading current CodeAlchemist code as ${format} (Simulated).`);
    toast({ title: `Descarga ${format} (Simulada)`, description: "La descarga del código no está implementada." });
  };

  const handleGitCommitAndPush = async () => {
    if (!commitMessage.trim()) {
      toast({ variant: "destructive", title: "Mensaje de Commit Requerido" });
      return;
    }
    // Placeholder for actual Git operations
    addLog(`Committing and pushing to Git with message: "${commitMessage}" (Simulated).`);
    toast({ title: "Subida a Git (Simulada)", description: "Los cambios se están subiendo al repositorio." });
    setShowCommitDialog(false);
    setCommitMessage('');
  };

  const handleAutoFixError = async (errorMsg: string, context?: any) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    // Placeholder for AI-driven auto-fix logic
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
    // Show modal with AI suggestion after a delay
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
          {error && <ErrorDisplay error={error} onAutoFix={handleAutoFixError} />}
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
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                  {suggestions.map(s => (
                    <Card key={s.id} className={s.status === 'applied' ? 'border-green-500' : s.status === 'discarded' ? 'opacity-60' : ''}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-base">{s.area}</CardTitle>
                        <CardDescription>Prioridad: <span className={`font-semibold ${s.priority === 'Alta' ? 'text-destructive' : s.priority === 'Media' ? 'text-yellow-600' : 'text-green-600'}`}>{s.priority}</span></CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs px-4 pb-3">
                        <p>{s.suggestion}</p>
                        {s.fullFileContentSuggested && s.status === 'pending' && (
                           <Button size="xs" variant="link" className="p-0 h-auto mt-1" onClick={() => handleApplySuggestionClick(s)}>Aplicar Sugerencia</Button>
                        )}
                        {s.status === 'applied' && <p className="text-green-600 font-medium mt-1 text-xs">Aplicada</p>}
                        {s.status === 'discarded' && <p className="text-muted-foreground font-medium mt-1 text-xs">Descartada</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
      
      {/* Placeholder for Auto-Fix Modal if error occurs */}

      <div className="lg:col-span-3 mt-4">
        <LogsDisplay title="Logs de Ejecución Detallados (AutoUpdate)" logs={["Inicia aquí los logs específicos de AutoUpdate..."]} />
      </div>
    </div>
  );
}

