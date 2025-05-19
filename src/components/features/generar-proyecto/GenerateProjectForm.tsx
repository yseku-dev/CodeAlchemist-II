
// src/components/features/generar-proyecto/GenerateProjectForm.tsx
"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GenerateProjectFormProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onGenerateClick: () => void;
  isLoading: boolean;
  isRedefining: boolean;
  onRedefineRequest: () => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for the input form of the "Generate Project" page.
 * Includes LLM config selector, project description textarea, and action buttons.
 * All texts are internationalized.
 * @module GenerateProjectForm
 */

/**
 * GenerateProjectForm component.
 * Renders the form elements for the "Generate Project" feature.
 *
 * @param {GenerateProjectFormProps} props - The props for the component.
 * @returns {JSX.Element} The rendered form component.
 */
const GenerateProjectForm: React.FC<GenerateProjectFormProps> = ({
  llmConfigSource,
  onLlmConfigSourceChange,
  description,
  onDescriptionChange,
  onGenerateClick,
  isLoading,
  isRedefining,
  onRedefineRequest,
  t,
}) => {
  return (
    <div className="space-y-6">
      <LLMConfigSelector
        value={llmConfigSource}
        onChange={onLlmConfigSourceChange}
        label={t('common.llmSourceLabel')}
      />
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="project-description">{t('generateProject.describeProjectLabel')}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedefineRequest}
            disabled={!description.trim() || isRedefining || isLoading}
            title={t('generateProject.redefineRequestButton')}
          >
            {isRedefining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t('generateProject.redefineRequestButton')}
          </Button>
        </div>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('generateProject.describeProjectPlaceholder')}
          rows={8}
          disabled={isLoading || isRedefining}
          className="bg-background"
        />
      </div>
      <Button onClick={onGenerateClick} disabled={isLoading || isRedefining || !description.trim()} className="w-full">
        {isLoading && !isRedefining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isLoading && !isRedefining ? t('common.processing') : t('generateProject.generateButton')}
      </Button>
    </div>
  );
};

export default GenerateProjectForm;
