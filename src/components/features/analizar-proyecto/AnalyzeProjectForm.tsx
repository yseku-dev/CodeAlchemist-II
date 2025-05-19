
"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wand2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea import

type ProjectSourceType = "upload" | "git";

interface AnalyzeProjectFormProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  projectSourceType: ProjectSourceType;
  onProjectSourceTypeChange: (value: ProjectSourceType) => void;
  uploadedFile: File | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  gitUrl: string;
  onGitUrlChange: (value: string) => void;
  searchDepth: string;
  onSearchDepthChange: (value: string) => void;
  focusArea: string;
  onFocusAreaChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  loadingMessage: string | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRedefiningFocusArea: boolean;
  onRedefineFocusArea: () => Promise<void>;
}

const AnalyzeProjectForm: React.FC<AnalyzeProjectFormProps> = ({
  llmConfigSource, onLlmConfigSourceChange, projectSourceType, onProjectSourceTypeChange,
  uploadedFile, onFileChange, fileInputRef, gitUrl, onGitUrlChange,
  searchDepth, onSearchDepthChange, focusArea, onFocusAreaChange, onAnalyze,
  isLoading, loadingMessage, t,
  isRedefiningFocusArea, onRedefineFocusArea,
}) => {
  return (
    <div className="space-y-6">
      <LLMConfigSelector value={llmConfigSource} onChange={onLlmConfigSourceChange} label={t('analyzeProject.llmSourceLabel')} />

      <div className="space-y-2">
        <Label>{t('analyzeProject.projectSourceLabel')}</Label>
        <Select value={projectSourceType} onValueChange={(value) => onProjectSourceTypeChange(value as ProjectSourceType)} disabled={isLoading}>
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
          <Input id="project-file-upload" type="file" ref={fileInputRef} onChange={onFileChange} accept=".zip,application/zip,.json,application/json" disabled={isLoading} />
          {uploadedFile && <p className="text-xs text-muted-foreground">{t('common.fileSelected', { name: uploadedFile.name })}</p>}
        </div>
      )}

      {projectSourceType === "git" && (
        <div className="space-y-2">
          <Label htmlFor="project-git-url">{t('analyzeProject.gitUrlLabel')}</Label>
          <Input id="project-git-url" value={gitUrl} onChange={(e) => onGitUrlChange(e.target.value)} placeholder={t('analyzeProject.gitUrlPlaceholder')} disabled={isLoading} />
        </div>
      )}

      <Separator />
      <Label>{t('analyzeProject.paramsLabel')}</Label>
      <div className="space-y-2">
        <Label htmlFor="search-depth-project" className="text-sm font-normal">{t('analyzeProject.depthLabel')}</Label>
        <Input id="search-depth-project" type="number" value={searchDepth} onChange={(e) => onSearchDepthChange(e.target.value)} placeholder={t('analyzeProject.depthPlaceholder')} disabled={isLoading} min="1" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="focus-area-project" className="text-sm font-normal">{t('analyzeProject.focusLabel')}</Label>
          <Button variant="outline" size="sm" onClick={onRedefineFocusArea} disabled={!focusArea.trim() || isRedefiningFocusArea || isLoading}>
            {isRedefiningFocusArea ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t('common.redefineRequestButton')}
          </Button>
        </div>
        <Textarea
          id="focus-area-project"
          value={focusArea}
          onChange={(e) => onFocusAreaChange(e.target.value)}
          placeholder={t('analyzeProject.focusPlaceholder')}
          disabled={isLoading || isRedefiningFocusArea}
          rows={3} // Make the textarea larger
        />
      </div>

      <Button onClick={onAnalyze} disabled={isLoading || isRedefiningFocusArea || (projectSourceType === 'upload' && !uploadedFile) || (projectSourceType === 'git' && !gitUrl.trim())} className="w-full">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isLoading && loadingMessage ? loadingMessage : t('analyzeProject.analyzeButton')}
      </Button>
    </div>
  );
};

export default AnalyzeProjectForm;
