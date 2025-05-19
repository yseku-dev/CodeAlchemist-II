
// src/components/features/generar-codigo/GenerateCodeForm.tsx
"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react'; // Added Wand2
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GenerateCodeFormProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onGenerateClick: () => void;
  isLoading: boolean;
  isRedefiningDescription: boolean; // New prop
  onRedefineDescription: () => Promise<void>; // New prop
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileoverview Componente para el formulario de entrada de la página "Generar Código".
 * Incluye el selector de LLM, el área de texto para la descripción y el botón de generación.
 */
const GenerateCodeForm: React.FC<GenerateCodeFormProps> = ({
  llmConfigSource,
  onLlmConfigSourceChange,
  description,
  onDescriptionChange,
  onGenerateClick,
  isLoading,
  isRedefiningDescription, // New prop
  onRedefineDescription, // New prop
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
          <Label htmlFor="description">{t('generateCode.describeNeedLabel')}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedefineDescription}
            disabled={!description.trim() || isRedefiningDescription || isLoading}
          >
            {isRedefiningDescription ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t('common.redefineRequestButton')}
          </Button>
        </div>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('generateCode.describeNeedPlaceholder')}
          rows={5}
          disabled={isLoading || isRedefiningDescription}
        />
      </div>
      <Button onClick={onGenerateClick} disabled={isLoading || isRedefiningDescription} className="w-full">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('generateCode.generateButton')}
      </Button>
    </div>
  );
};

export default GenerateCodeForm;
