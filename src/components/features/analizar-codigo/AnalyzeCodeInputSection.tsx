
"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react'; // Added Wand2
import CodeEditor from '@/components/CodeEditor';
import type { TranslationKey } from '@/lib/i18n/translations';

interface AnalyzeCodeInputSectionProps {
  codeToAnalyze: string;
  onCodeToAnalyzeChange: (value: string) => void;
  fileUrl: string;
  onFileUrlChange: (value: string) => void;
  userAnalysisPrompt: string;
  onUserAnalysisPromptChange: (value: string) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFetchFromUrl: () => void;
  isLoading: boolean;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRedefiningUserAnalysisPrompt: boolean; // New prop
  onRedefineUserAnalysisPrompt: () => Promise<void>; // New prop
}

const AnalyzeCodeInputSection: React.FC<AnalyzeCodeInputSectionProps> = ({
  codeToAnalyze, onCodeToAnalyzeChange, fileUrl, onFileUrlChange,
  userAnalysisPrompt, onUserAnalysisPromptChange, onFileChange, fileInputRef,
  onFetchFromUrl, isLoading, t,
  isRedefiningUserAnalysisPrompt, onRedefineUserAnalysisPrompt,
}) => {
  return (
    <div className="space-y-4 p-4 border rounded-md">
      <Label className="font-semibold">{t('analyzeCode.codeSourceLabel')}</Label>
      <div className="space-y-2">
        <Label htmlFor="file-upload-code" className="text-sm">{t('analyzeCode.uploadFileLabel')}</Label>
        <Input id="file-upload-code" type="file" ref={fileInputRef} onChange={onFileChange} accept=".txt,.js,.ts,.py,.java,.html,.css,.json,.md" disabled={isLoading} />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-grow space-y-2">
          <Label htmlFor="git-file-url" className="text-sm">{t('analyzeCode.gitFileUrlLabel')}</Label>
          <Input id="git-file-url" value={fileUrl} onChange={(e) => onFileUrlChange(e.target.value)} placeholder={t('analyzeCode.gitFileUrlPlaceholder')} disabled={isLoading} />
        </div>
        <Button onClick={onFetchFromUrl} variant="outline" disabled={isLoading || !fileUrl.trim()}>{t('analyzeCode.fetchUrlButton')}</Button>
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('analyzeCode.pasteCodeInstruction')}</span>
        </div>
      </div>
      <CodeEditor
        id="analizar-codigo-main"
        value={codeToAnalyze}
        onChange={onCodeToAnalyzeChange}
        placeholder={t('analyzeCode.pasteCodePlaceholder')}
        rows={10}
        className="font-mono text-sm"
        disabled={isLoading}
      />
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="user-analysis-prompt" className="text-sm">{t('analyzeCode.additionalInstructionsLabel')}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedefineUserAnalysisPrompt}
            disabled={!userAnalysisPrompt.trim() || isRedefiningUserAnalysisPrompt || isLoading}
          >
            {isRedefiningUserAnalysisPrompt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t('common.redefineRequestButton')}
          </Button>
        </div>
        <Textarea
          id="user-analysis-prompt"
          value={userAnalysisPrompt}
          onChange={(e) => onUserAnalysisPromptChange(e.target.value)}
          placeholder={t('analyzeCode.additionalInstructionsPlaceholder')}
          rows={2}
          disabled={isLoading || isRedefiningUserAnalysisPrompt}
        />
      </div>
    </div>
  );
};

export default AnalyzeCodeInputSection;
