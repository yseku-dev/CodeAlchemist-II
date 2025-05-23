// src/components/features/autoupdate/AutoUpdateConfigForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Wand2, DownloadCloud, FileArchive } from 'lucide-react'; // Added DownloadCloud
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
  onDownloadCurrentSourceZip: () => void; // Nueva prop
  isLoading: boolean; // Estado de carga general (para análisis, git, etc.)
  isDownloadingSource: boolean; // Nuevo estado de carga para descarga ZIP
  progress: number;
  isAnalysisInProgress: boolean;
  isRedefiningAnalysisPrefs: boolean;
  onRedefineAnalysisPrefs: () => Promise<void>;
}

/**
 * @fileOverview Component for the AutoUpdate configuration form.
 * Allows users to set LLM source, code source, analysis preferences,
 * start analysis, and download the current project source code.
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
  onDownloadCurrentSourceZip, // Nueva prop
  isLoading,
  isDownloadingSource, // Nuevo estado
  progress,
  isAnalysisInProgress,
  isRedefiningAnalysisPrefs,
  onRedefineAnalysisPrefs,
}: AutoUpdateConfigFormProps) {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted && !llmConfigSource) {
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
          <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div> {/* Placeholder for LLM Selector */}
          <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div> {/* Placeholder for Source Selector */}
          <div className="h-20 w-full bg-muted rounded-md animate-pulse"></div> {/* Placeholder for Preferences */}
          <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div> {/* Placeholder for Start Button */}
          <div className="h-10 w-full bg-muted rounded-md animate-pulse"></div> {/* Placeholder for Download Button */}
        </CardContent>
      </Card>
    );
  }


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
            {sourceType === "Git" && !gitRepoUrl && <p className="text-xs text-destructive">{t('autoupdate.config.gitUrlRequired')}</p>}
          </div>
        )}

        <Button 
          onClick={onDownloadCurrentSourceZip} 
          disabled={isLoading || isDownloadingSource} 
          variant="outline" 
          className="w-full"
        >
          {isDownloadingSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
          {t('autoupdate.config.downloadCurrentSourceZipButton')}
        </Button>
        <p className="text-xs text-muted-foreground -mt-4 text-center">{t('autoupdate.config.downloadCurrentSourceZipDescription')}</p>


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
           <p className="text-xs text-muted-foreground">{t('autoupdate.config.analysisPrefsDescription')}</p>
        </div>

        <Button 
            onClick={onStartAnalysis} 
            disabled={isLoading || isRedefiningAnalysisPrefs || !llmConfigSource || (sourceType === "Git" && !gitRepoUrl.trim())} 
            className="w-full"
        >
          {isLoading && !isDownloadingSource && !isRedefiningAnalysisPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {isLoading && !isDownloadingSource && !isRedefiningAnalysisPrefs ? t('autoupdate.config.startButtonLoading') : t('autoupdate.config.startButton')}
        </Button>
        {isAnalysisInProgress && progress > 0 && progress < 100 && llmConfigSource?.type !== 'Grupo' && (
          <Progress value={progress} className="w-full mt-2" />
        )}
      </CardContent>
    </Card>
  );
}
