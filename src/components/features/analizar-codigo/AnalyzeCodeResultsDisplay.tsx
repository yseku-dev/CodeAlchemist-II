
// src/components/features/analizar-codigo/AnalyzeCodeResultsDisplay.tsx
"use client";

import React from 'react';
import CodeBlock from '@/components/code-block';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import type { AnalyzeCodeSnippetOutput } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface AnalyzeCodeResultsDisplayProps {
  result: AnalyzeCodeSnippetOutput | null;
  onSaveSnapshot: (type: 'original' | 'suggested') => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for displaying the results of a code snippet analysis.
 * Shows the AI's explanation, the original code, and the suggested code,
 * along with buttons to save snapshots of the original and suggested code.
 * All texts are internationalized.
 * @module AnalyzeCodeResultsDisplay
 */

/**
 * AnalyzeCodeResultsDisplay component.
 * Renders the analysis results section for the "Analyze Code" page.
 *
 * @param {AnalyzeCodeResultsDisplayProps} props - The props for the component.
 * @param {AnalyzeCodeSnippetOutput | null} props.result - The analysis result object from the AI.
 * @param {function} props.onSaveSnapshot - Callback function to save a snapshot of the code.
 * @param {function} props.t - The translation function from `useI18n`.
 * @returns {JSX.Element | null} The rendered results display section, or null if no result.
 */
const AnalyzeCodeResultsDisplay: React.FC<AnalyzeCodeResultsDisplayProps> = ({
  result,
  onSaveSnapshot,
  t,
}) => {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6 mt-6 p-4 border rounded-md bg-background">
      {result.explanation && (
        <div>
          <h3 className="font-semibold text-lg mb-2">{t('analyzeCode.results.explanationLabel')}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
        </div>
      )}
      {result.originalCode && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-lg">{t('analyzeCode.results.originalCodeLabel')}</h3>
            <Button variant="outline" size="sm" onClick={() => onSaveSnapshot('original')}>
              <Save className="mr-2 h-4 w-4" /> {t('analyzeCode.results.saveOriginalButton')}
            </Button>
          </div>
          <CodeBlock code={result.originalCode} maxHeight="300px" />
        </div>
      )}
      {result.suggestedCode && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-lg">{t('analyzeCode.results.suggestedCodeLabel')}</h3>
            <Button variant="outline" size="sm" onClick={() => onSaveSnapshot('suggested')}>
              <Save className="mr-2 h-4 w-4" /> {t('analyzeCode.results.saveSuggestedButton')}
            </Button>
          </div>
          <CodeBlock code={result.suggestedCode} maxHeight="300px" />
        </div>
      )}
    </div>
  );
};

export default AnalyzeCodeResultsDisplay;
