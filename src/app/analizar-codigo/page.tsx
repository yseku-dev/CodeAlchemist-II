
"use client";

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, Save, ScanLine } from 'lucide-react'; // Added ScanLine
import LLMConfigSelector from '@/components/llm-config-selector';
import CodeBlock from '@/components/code-block';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, AnalyzeCodeResult } from '@/types';
// Assuming a flow for code analysis, e.g., analyzeCodeSnippet from AI services
// import { analyzeCodeSnippet } from '@/ai/flows/analyze-code-snippet';

// Mock AI call for analyzeCodeSnippet
const mockAnalyzeCode = (code: string): Promise<AnalyzeCodeResult> => {
  return new Promise(resolve => setTimeout(() => {
    resolve({
      explanation: `El código proporcionado parece ser una función de ${code.toLowerCase().includes("function") ? "JavaScript" : "Python"} que ${code.length > 50 ? "realiza una tarea compleja" : "es un simple script"}. Se inicializa una variable 'x' y luego se imprime en la consola.`,
      originalCode: code,
      suggestedCode: `// Código original con comentarios mejorados:\n${code}\n\n// Sugerencia: Considerar añadir manejo de errores si 'x' puede ser indefinido.`
    });
  }, 1500));
};

export default function AnalizarCodigoPage() {
  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [codeToAnalyze, setCodeToAnalyze] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadedFileContent, setUploadedFileContent] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeCodeResult | null>(null);
  
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
      // For demonstration, we'll simulate fetching.
      // const response = await fetch(fileUrl); // This will likely fail due to CORS
      // if (!response.ok) throw new Error(`Failed to fetch from URL: ${response.statusText}`);
      // const code = await response.text();
      const mockCode = `// Contenido simulado de ${fileUrl}\nfunction example() { console.log("Fetched from URL!"); }`;
      setCodeToAnalyze(mockCode);
      setUploadedFileContent(null); // Clear file upload if URL is used
      toast({ title: "Código Obtenido", description: "Contenido de la URL cargado (simulado)." });
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
    addLog(`Analyzing code with config: ${JSON.stringify(llmConfigSource)}`);

    try {
      // const aiResult = await analyzeCodeSnippet({ code: codeToAnalyze, config: llmConfigSource });
      const aiResult = await mockAnalyzeCode(codeToAnalyze); // Using mock
      setResult(aiResult);
      addLog("Code analysis successful.");
      toast({ title: "Análisis Completado", description: "El código ha sido analizado." });
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error durante el análisis.";
      setError(errorMsg);
      addLog(`Code analysis failed: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Análisis", description: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSnapshot = (type: 'original' | 'suggested') => {
    if (!result) return;
    const codeToSave = type === 'original' ? result.originalCode : result.suggestedCode;
    const name = `Código ${type} - ${new Date().toLocaleTimeString()}`;
    addSnapshot({ name, code: codeToSave, source: type });
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
        </div>
        
        <Button onClick={handleAnalyze} disabled={isLoading || !codeToAnalyze.trim()} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analizar Código
        </Button>

        {error && <ErrorDisplay error={error} />}

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
