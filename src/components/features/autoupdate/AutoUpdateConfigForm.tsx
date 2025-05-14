
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import { Separator } from '@/components/ui/separator';

type AutoUpdateSourceType = "Local" | "Git";

interface AutoUpdateConfigFormProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  sourceType: AutoUpdateSourceType;
  onSourceTypeChange: (value: AutoUpdateSourceType) => void;
  gitRepoUrl: string;
  onGitRepoUrlChange: (value: string) => void;
  analysisPreferences: string;
  onAnalysisPreferencesChange: (value: string) => void;
  onStartAnalysis: () => void;
  isLoading: boolean;
  progress: number;
  isAnalysisInProgress: boolean; // To show progress bar even if main isLoading is for results
}

/**
 * @fileOverview Component for the AutoUpdate configuration form.
 * Allows users to set LLM source, code source, and analysis preferences.
 */
export default function AutoUpdateConfigForm({
  llmConfigSource,
  onLlmConfigSourceChange,
  sourceType,
  onSourceTypeChange,
  gitRepoUrl,
  onGitRepoUrlChange,
  analysisPreferences,
  onAnalysisPreferencesChange,
  onStartAnalysis,
  isLoading,
  progress,
  isAnalysisInProgress,
}: AutoUpdateConfigFormProps) {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <span>AutoUpdate (Análisis del Propio Código)</span>
        </CardTitle>
        <CardDescription>Permite que CodeAlchemist analice su propio código fuente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={onLlmConfigSourceChange} />

        <div className="space-y-2">
          <Label>Fuente del Código para Auto-Análisis</Label>
          <Select value={sourceType} onValueChange={(value) => onSourceTypeChange(value as AutoUpdateSourceType)} disabled={isLoading}>
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
            <Input 
              id="autoupdate-git-url" 
              value={gitRepoUrl} 
              onChange={(e) => onGitRepoUrlChange(e.target.value)} 
              placeholder="URL HTTPS del repo CodeAlchemist" 
              disabled={isLoading} 
            />
          </div>
        )}

        <Separator />
        <Label>Parámetros de Auto-Análisis</Label>
        <div className="space-y-2">
          <Label htmlFor="analysis-prefs" className="text-sm font-normal">Preferencias de Análisis / Campo de Enfoque (opcional)</Label>
          <Textarea 
            id="analysis-prefs" 
            value={analysisPreferences} 
            onChange={(e) => onAnalysisPreferencesChange(e.target.value)} 
            placeholder="Ej: Enfocarse en optimización UI. Todas las sugerencias en castellano." 
            rows={3} 
            disabled={isLoading} 
          />
        </div>

        <Button onClick={onStartAnalysis} disabled={isLoading} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Iniciar Auto-Análisis"}
        </Button>
        {isAnalysisInProgress && progress > 0 && progress < 100 && llmConfigSource?.type !== 'Grupo' && (
          <Progress value={progress} className="w-full mt-2" />
        )}
      </CardContent>
    </Card>
  );
}
