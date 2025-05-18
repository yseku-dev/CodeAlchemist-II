
// src/components/features/generar-codigo/GenerateCodeResultsDisplay.tsx
"use client";

import React from 'react';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import type { GenerateCodeFromDescriptionOutput } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GenerateCodeResultsDisplayProps {
  result: GenerateCodeFromDescriptionOutput | null;
  t: (key: TranslationKey) => string;
}

/**
 * @fileoverview Componente para mostrar los resultados de la generación de código.
 * Muestra la explicación, el fragmento de código y el log del grupo si aplica.
 */
const GenerateCodeResultsDisplay: React.FC<GenerateCodeResultsDisplayProps> = ({ result, t }) => {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4 mt-6 p-4 border rounded-md bg-background">
      {result.explanation && (
        <div>
          <h3 className="font-semibold text-lg mb-2">{t('generateCode.results.explanationLabel')}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.explanation}</p>
        </div>
      )}
      <div>
        <h3 className="font-semibold text-lg mb-2">{t('generateCode.results.codeSnippetLabel')}</h3>
        <CodeBlock code={result.code} />
      </div>
      {result.groupLog && (
        <LogsDisplay title={t('generateCode.results.groupLogTitle')} logs={result.groupLog} />
      )}
    </div>
  );
};

export default GenerateCodeResultsDisplay;
