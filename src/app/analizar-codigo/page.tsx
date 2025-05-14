
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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


export default function AnalizarCodigoPage() {
  const { agents, groups, getAgentById } = useAppState();
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [codeToAnalyze, setCodeToAnalyze] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
  const [userAnalysisPrompt, setUserAnalysisPrompt] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeSnippetOutput | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addLog } = useDebug();
  const { toast } = useToast();
  const { addSnapshot } = useAppState();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('text/') && file.size <= 5 * 1024 * 1024) { // Max 5MB for text files
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setUploadedFileContent(content);
          setCodeToAnalyze(content); // Pre-fill textarea
          addLog(`File loaded: ${file.name}, size: ${file.size}`);
        };
        reader.readAsText(file);
      } else {
        toast({ variant: "destructive", title: "Archivo Inválido", description: "Sube un archivo de texto de menos de 5MB." });
        setUploadedFileContent(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  const handleFetchFromUrl = async () => {
    if (!fileUrl.trim()) {
      toast({ variant: "destructive", title: "URL Vacía", description: "Introduce una URL de archivo Git." });
      return;
    }
    setIsLoading(true);
    setError(null);
    addLog(`Fetching code from URL: ${fileUrl}`);
    try {
      // This is a placeholder. Real fetching needs a backend or CORS-enabled endpoint.
      // For a robust solution, this would ideally be a server action that fetches the URL content.
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Error al obtener de la URL: ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      setCodeToAnalyze(text);
      setUploadedFileContent(null); // Clear file upload if URL is used
      toast({ title: "Código Obtenido", description: "Contenido de la URL cargado." });
    } catch (e: any) {
      const errorMsg = e.message || "Error al obtener el código de la URL.";
      setError(errorMsg);
      addLog(`Failed to fetch from URL: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Obtención", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!codeToAnalyze.trim()) {
      toast({ variant: "destructive", title: "Código Vacío", description: "Introduce o carga código para analizar." });
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    let agentSystemPrompt: string | undefined;
    if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
      const agent = getAgentById(llmConfigSource.id);
      agentSystemPrompt = agent?.systemPrompt;
    } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
      const group = groups.find(g => g.id === llmConfigSource.id);
      // For group, use its mainTask as context or a specific agent's prompt if defined.
      // Here, we might pass the group's main task or a generic instruction.
      // The `analyzeCodeSnippet` flow's prompt might need to be aware of this context.
      agentSystemPrompt = group?.mainTask || "Analiza este código en el contexto de un grupo de trabajo especializado.";
      addLog(`Analyzing with Group: ${llmConfigSource.name}. Using group's task/context for analysis flow.`);
    }

    const analysisInput: AnalyzeCodeSnippetInput = {
      code: codeToAnalyze,
      userPrompt: userAnalysisPrompt || undefined,
      agentSystemPrompt: agentSystemPrompt
    };
    
    addLog(`Analyzing code with config: ${JSON.stringify(llmConfigSource)}, input: ${JSON.stringify({code: codeToAnalyze.substring(0,50)+"...", userPrompt: analysisInput.userPrompt})}`);

    try {
      const aiResult = await callAnalyzeCodeSnippet(analysisInput);
      setResult(aiResult);
      addLog("Code analysis successful.");
      toast({ title: "Análisis Completado", description: "El código ha sido analizado." });
    } catch (e: any) {
      addLog({ message: "Code analysis failed in UI", error: e });
      if (e instanceof AppError) {
        setError(e.friendlyMessage);
        toast({ variant: "destructive", title: "Error de Análisis", description: e.friendlyMessage });
      } else {
        const errorMsg = e.message || "Ocurrió un error durante el análisis.";
        setError(errorMsg);
        toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSnapshot = (type: 'original' | 'suggested') => {
    if (!result) return;
    const codeToSave = type === 'original' ? result.originalCode : result.suggestedCode;
    if (!codeToSave) {
        toast({variant: "destructive", title: "Error", description: `No hay código ${type} para guardar.`});
        return;
    }
    const name = `Código ${type} - ${new Date().toLocaleTimeString()}`;
    addSnapshot({ name, code: codeToSave, source: type });
  };
  
  const handleAutoFixError = async (errorMsg: string) => {
    addLog(`Attempting Auto-Fix for error: ${errorMsg}`);
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error para proponer una solución."});
    // This would call another flow, perhaps a generic error analysis flow.
    // For now, it's a placeholder for UI interaction.
  };


  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <ScanLine className="h-7 w-7 text-primary" />
          <span>Analizar Código</span>
        </CardTitle>
        <CardDescription>Obtén análisis detallados y sugerencias de mejora para fragmentos o archivos de código.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
        
        <div className="space-y-4 p-4 border rounded-md">
          <Label className="font-semibold">Fuente del Código:</Label>
          <div className="space-y-2">
            <Label htmlFor="file-upload-code" className="text-sm">Subir un archivo de código (opcional)</Label>
            <Input id="file-upload-code" type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.js,.ts,.py,.java,.html,.css,.json,.md" disabled={isLoading} />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-grow space-y-2">
              <Label htmlFor="git-file-url" className="text-sm">URL de Archivo Git (opcional, raw content)</Label>
              <Input id="git-file-url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="Ej: https://raw.githubusercontent.com/..." disabled={isLoading} />
            </div>
            <Button onClick={handleFetchFromUrl} variant="outline" disabled={isLoading || !fileUrl.trim()}>Obtener</Button>
          </div>
           <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">O pega el código abajo</span>
            </div>
          </div>
          <Textarea
            value={codeToAnalyze}
            onChange={(e) => setCodeToAnalyze(e.target.value)}
            placeholder="Pega tu código aquí para analizarlo..."
            rows={10}
            className="font-mono text-sm"
            disabled={isLoading}
          />
          <div className="space-y-2">
            <Label htmlFor="user-analysis-prompt" className="text-sm">Instrucciones Adicionales para el Análisis (opcional)</Label>
            <Textarea
                id="user-analysis-prompt"
                value={userAnalysisPrompt}
                onChange={(e) => setUserAnalysisPrompt(e.target.value)}
                placeholder="Ej: Enfócate en la seguridad, o sugiere alternativas más performantes."
                rows={2}
                disabled={isLoading}
            />
          </div>
        </div>
        
        <Button onClick={handleAnalyze} disabled={isLoading || !codeToAnalyze.trim()} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analizar Código
        </Button>

        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido")} />}

        {result && (
          <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
            <div>
              <h3 className="font-semibold text-lg mb-2">Explicación:</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">Código Original:</h3>
                <Button variant="outline" size="sm" onClick={() => handleSaveSnapshot('original')}><Save className="mr-2 h-3 w-3" /> Guardar Original</Button>
              </div>
              <CodeBlock code={result.originalCode} maxHeight="300px"/>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">Código Sugerido:</h3>
                <Button variant="outline" size="sm" onClick={() => handleSaveSnapshot('suggested')}><Save className="mr-2 h-3 w-3" /> Guardar Sugerido</Button>
              </div>
              <CodeBlock code={result.suggestedCode} maxHeight="300px"/>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
