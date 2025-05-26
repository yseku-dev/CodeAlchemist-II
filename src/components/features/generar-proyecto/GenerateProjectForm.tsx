// src/components/features/generar-proyecto/GenerateProjectForm.tsx
"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2, Upload } from 'lucide-react'; // Added Upload
import { Input } from '@/components/ui/input'; // Added Input
import { Separator } from '@/components/ui/separator'; // Added Separator
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
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; // New prop
  fileInputRef: React.RefObject<HTMLInputElement>; // New prop
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for the input form of the "Generate Project" page.
 * Includes LLM config selector, project description textarea, file upload, and action buttons.
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
  onFileUpload,
  fileInputRef,
  t,
}) => {
  return (
    <div className="space-y-6">
      <LLMConfigSelector
        value={llmConfigSource}
        onChange={onLlmConfigSourceChange}
        label={t('common.llmSourceLabel')}
      />

      <div className="space-y-2">
        <Label htmlFor="zip-upload-button">{t('generateProject.uploadExistingZipButton')}</Label>
        <Button
          id="zip-upload-button"
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isRedefining}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t('generateProject.uploadExistingZipButton')}
        </Button>
        <Input
            id="zip-upload-input"
            type="file"
            accept=".zip,application/zip"
            ref={fileInputRef}
            onChange={onFileUpload}
            className="hidden"
            disabled={isLoading || isRedefining}
        />
      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('generateProject.describeOrNewLabel')}</span>
        </div>
      </div>

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