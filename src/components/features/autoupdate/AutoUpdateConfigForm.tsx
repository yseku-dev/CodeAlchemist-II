
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Wand2 } from 'lucide-react'; // Added Wand2
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

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
  isAnalysisInProgress: boolean;
  isRedefiningAnalysisPrefs: boolean; // New prop
  onRedefineAnalysisPrefs: () => Promise<void>; // New prop
}

/**
 * @fileOverview Component for the AutoUpdate configuration form.
 * Allows users to set LLM source, code source, and analysis preferences.
 * Internationalized using useI18n.
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
  isRedefiningAnalysisPrefs, // New prop
  onRedefineAnalysisPrefs, // New prop
}: AutoUpdateConfigFormProps) {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted && typeof window === 'undefined') { // Check for SSR context specifically
    return (
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                <Sparkles className="h-7 w-7 text-primary" />
                <span>{t('autoupdate.config.title')}</span>
                </CardTitle>
                <CardDescription>{t('autoupdate.config.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div>
                <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div>
                <div className="h-20 w-full bg-muted rounded-md animate-pulse"></div>
                <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div>
            </CardContent>
        </Card>
    );
  }


  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          <span>{isMounted ? t('autoupdate.config.title') : 'autoupdate.config.title'}</span>
        </CardTitle>
        <CardDescription>{isMounted ? t('autoupdate.config.description') : 'autoupdate.config.description'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LLMConfigSelector 
            value={llmConfigSource} 
            onChange={onLlmConfigSourceChange} 
            label={t('autoupdate.config.llmSourceLabel')} 
        />

        <div className="space-y-2">
          <Label>{t('autoupdate.config.codeSourceLabel')}</Label>
          <Select value={sourceType} onValueChange={(value) => onSourceTypeChange(value as AutoUpdateSourceType)} disabled={isLoading || isRedefiningAnalysisPrefs}>
            <SelectTrigger><SelectValue placeholder={t('common.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Local">{t('autoupdate.config.sourceLocal')}</SelectItem>
              <SelectItem value="Git">{t('autoupdate.config.sourceGit')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sourceType === "Git" && (
          <div className="space-y-2">
            <Label htmlFor="autoupdate-git-url">{t('autoupdate.config.gitUrlLabel')}</Label>
            <Input 
              id="autoupdate-git-url" 
              value={gitRepoUrl} 
              onChange={(e) => onGitRepoUrlChange(e.target.value)} 
              placeholder={t('autoupdate.config.gitUrlPlaceholder')} 
              disabled={isLoading || isRedefiningAnalysisPrefs} 
            />
          </div>
        )}

        <Separator />
        <Label>{t('autoupdate.config.analysisParamsLabel')}</Label>
        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor="analysis-prefs" className="text-sm font-normal">{t('autoupdate.config.analysisPrefsLabel')}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onRedefineAnalysisPrefs}
              disabled={!analysisPreferences.trim() || isRedefiningAnalysisPrefs || isLoading}
            >
              {isRedefiningAnalysisPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {t('common.redefineRequestButton')}
            </Button>
          </div>
          <Textarea 
            id="analysis-prefs" 
            value={analysisPreferences} 
            onChange={(e) => onAnalysisPreferencesChange(e.target.value)} 
            placeholder={t('autoupdate.config.analysisPrefsPlaceholder')} 
            rows={3} 
            disabled={isLoading || isRedefiningAnalysisPrefs} 
          />
        </div>

        <Button onClick={onStartAnalysis} disabled={isLoading || isRedefiningAnalysisPrefs || !llmConfigSource } className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4"/>}
          {isLoading ? t('autoupdate.config.startButtonLoading') : t('autoupdate.config.startButton')}
        </Button>
        {isAnalysisInProgress && progress > 0 && progress < 100 && llmConfigSource?.type !== 'Grupo' && (
          <Progress value={progress} className="w-full mt-2" />
        )}
      </CardContent>
    </Card>
  );
}
