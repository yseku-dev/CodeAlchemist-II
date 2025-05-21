
"use client";

import React from 'react';
import { CardContent } from '@/components/ui/card'; // Card is not used directly here, only CardContent
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitPullRequestDraft, Wand2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import { GENERAL_PRIORITIES, type GeneralPriority, NINGUNA_PRIORITY_VALUE } from '@/lib/constants'; // Import NINGUNA_PRIORITY_VALUE
import { Separator } from "@/components/ui/separator";
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import type { TranslationKey } from '@/lib/i18n/translations';

type ProjectSourceType = "upload" | "git";
// const NINGUNA_PRIORITY_VALUE = "__none__"; // Removed local definition

interface RefactorProjectConfigSectionProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  projectSourceType: ProjectSourceType;
  onProjectSourceTypeChange: (value: ProjectSourceType) => void;
  uploadedFile: File | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  gitUrl: string;
  onGitUrlChange: (value: string) => void;
  refactorGoals: string;
  onRefactorGoalsChange: (value: string) => void;
  generalPriority: GeneralPriority | typeof NINGUNA_PRIORITY_VALUE;
  onGeneralPriorityChange: (value: GeneralPriority | typeof NINGUNA_PRIORITY_VALUE) => void;
  searchDepth: string;
  onSearchDepthChange: (value: string) => void;
  focusArea: string;
  onFocusAreaChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  loadingMessage: string | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRedefiningGoals: boolean;
  onRedefineGoals: () => Promise<void>;
  isRedefiningFocusArea: boolean;
  onRedefineFocusArea: () => Promise<void>;
}

const RefactorProjectConfigSection: React.FC<RefactorProjectConfigSectionProps> = ({
  llmConfigSource, onLlmConfigSourceChange, projectSourceType, onProjectSourceTypeChange,
  uploadedFile, onFileChange, fileInputRef, gitUrl, onGitUrlChange,
  refactorGoals, onRefactorGoalsChange, generalPriority, onGeneralPriorityChange,
  searchDepth, onSearchDepthChange, focusArea, onFocusAreaChange, onAnalyze,
  isLoading, loadingMessage, t,
  isRedefiningGoals, onRedefineGoals, isRedefiningFocusArea, onRedefineFocusArea,
}) => {
  return (
    // The parent Card is in page.tsx, this component only renders its content structure
    <> 
      <PageSectionHeader
        icon={GitPullRequestDraft}
        title={t('refactorProject.title')}
        description={t('refactorProject.description')}
      />
      <CardContent className="space-y-6">
        <LLMConfigSelector value={llmConfigSource} onChange={onLlmConfigSourceChange} label={t('refactorProject.llmSourceLabel')} />

        <div className="space-y-2">
          <Label>{t('refactorProject.projectSourceLabel')}</Label>
          <Select value={projectSourceType} onValueChange={(value) => onProjectSourceTypeChange(value as ProjectSourceType)} disabled={isLoading}>
            <SelectTrigger><SelectValue placeholder={t('common.selectPlaceholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">{t('refactorProject.sourceUpload')}</SelectItem>
              <SelectItem value="git">{t('refactorProject.sourceGit')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {projectSourceType === "upload" && (
          <div className="space-y-2">
            <Label htmlFor="file-upload">{t('refactorProject.uploadLabel')}</Label>
            <Input id="file-upload" type="file" ref={fileInputRef} onChange={onFileChange} disabled={isLoading} accept=".zip,application/zip,.json,application/json,.js,.ts,.jsx,.tsx,.py,.java,.html,.css,.txt,.md" />
            {uploadedFile && <p className="text-xs text-muted-foreground">{t('common.fileSelected', { name: uploadedFile.name })}</p>}
          </div>
        )}

        {projectSourceType === "git" && (
          <div className="space-y-2">
            <Label htmlFor="git-url">{t('refactorProject.gitUrlLabel')}</Label>
            <Input id="git-url" value={gitUrl} onChange={(e) => onGitUrlChange(e.target.value)} placeholder={t('refactorProject.gitUrlPlaceholder')} disabled={isLoading} />
          </div>
        )}

        <Separator />
        <Label>{t('refactorProject.paramsLabel')}</Label>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor="refactor-goals" className="text-sm font-normal">{t('refactorProject.goalsLabel')}</Label>
            <Button variant="outline" size="sm" onClick={onRedefineGoals} disabled={!refactorGoals.trim() || isRedefiningGoals || isLoading}>
              {isRedefiningGoals ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {t('common.redefineRequestButton')}
            </Button>
          </div>
          <Textarea id="refactor-goals" value={refactorGoals} onChange={(e) => onRefactorGoalsChange(e.target.value)} placeholder={t('refactorProject.goalsPlaceholder')} rows={3} disabled={isLoading || isRedefiningGoals} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="general-priority" className="text-sm font-normal">{t('refactorProject.priorityLabel')}</Label>
          <Select
            value={generalPriority}
            onValueChange={(selectedValue) => onGeneralPriorityChange(selectedValue as GeneralPriority | typeof NINGUNA_PRIORITY_VALUE)}
            disabled={isLoading}
          >
            <SelectTrigger id="general-priority">
              <SelectValue placeholder={t('refactorProject.priorityPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNA_PRIORITY_VALUE}>{t('refactorProject.priorityNone')}</SelectItem>
              {GENERAL_PRIORITIES.map(p => {
                const keyForTranslation = `refactorProject.priorities.${p.replace(/\s+/g, '')}` as TranslationKey;
                return (
                  <SelectItem key={p} value={p}>
                    {t(keyForTranslation, { defaultValue: p })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="search-depth" className="text-sm font-normal">{t('refactorProject.depthLabel')}</Label>
          <Input id="search-depth" type="number" value={searchDepth} onChange={(e) => onSearchDepthChange(e.target.value)} placeholder={t('refactorProject.depthPlaceholder')} disabled={isLoading} min="1" />
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor="focus-area" className="text-sm font-normal">{t('refactorProject.focusLabel')}</Label>
            <Button variant="outline" size="sm" onClick={onRedefineFocusArea} disabled={!focusArea.trim() || isRedefiningFocusArea || isLoading}>
              {isRedefiningFocusArea ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {t('common.redefineRequestButton')}
            </Button>
          </div>
          <Textarea 
            id="focus-area" 
            value={focusArea} 
            onChange={(e) => onFocusAreaChange(e.target.value)} 
            placeholder={t('refactorProject.focusPlaceholder')} 
            disabled={isLoading || isRedefiningFocusArea}
            rows={2} // Slightly larger for focus area
          />
        </div>

        <Button onClick={onAnalyze} disabled={isLoading || isRedefiningGoals || isRedefiningFocusArea || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" /> }
          {isLoading && loadingMessage ? loadingMessage : t('refactorProject.analyzeButton')}
        </Button>
      </CardContent>
    </>
  );
};

export default RefactorProjectConfigSection;
