
// src/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ListChecks, Info } from 'lucide-react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AnalyzeCodeOutput } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface AnalyzeProjectResultsDisplayProps {
  result: AnalyzeCodeOutput | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for displaying the results of a full project analysis.
 * Shows the AI's overall assessment, identified areas, specific suggestions,
 * and general improvement ideas. Also displays group logs if applicable.
 * All texts are internationalized.
 * @module AnalyzeProjectResultsDisplay
 */

/**
 * AnalyzeProjectResultsDisplay component.
 * Renders the results section for the "Analyze Full Project" page.
 *
 * @param {AnalyzeProjectResultsDisplayProps} props - The props for the component.
 * @param {AnalyzeCodeOutput | null} props.result - The analysis result object from the AI.
 * @param {function} props.t - The translation function from `useI18n`.
 * @returns {JSX.Element | null} The rendered results display section, or null if no result.
 */
const AnalyzeProjectResultsDisplay: React.FC<AnalyzeProjectResultsDisplayProps> = ({
  result,
  t,
}) => {
  if (!result) {
    return null;
  }

  return (
    <Card className="mt-6 bg-background">
      <PageSectionHeader
        icon={ListChecks}
        title={result.analysisTitle || t('analyzeProject.results.noResults')}
      />
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.overallAssessmentLabel')}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.generalAssessment}</p>
        </div>

        {result.overallImprovementIdeas && result.overallImprovementIdeas.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.improvementIdeasLabel')}</h3>
            <ul className="list-disc list-inside pl-5 space-y-1 text-sm text-muted-foreground">
              {result.overallImprovementIdeas.map((idea, index) => (
                <li key={`idea-${index}`}>{idea}</li>
              ))}
            </ul>
          </div>
        )}

        {result.identifiedAreas && result.identifiedAreas.length > 0 && (
           <div>
            <h3 className="font-semibold text-lg mb-1">{t('analyzeProject.results.identifiedAreasLabel')}</h3>
            <ul className="list-disc list-inside pl-5 space-y-1 text-sm text-muted-foreground">
              {result.identifiedAreas.map((area, index) => (
                <li key={`area-${index}`}>{area}</li>
              ))}
            </ul>
          </div>
        )}

        {result.detailedSuggestions && result.detailedSuggestions.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-2">{t('analyzeProject.results.specificSuggestionsLabel')}</h3>
            <ScrollArea className="h-60 border rounded-md p-2 bg-muted/30">
              <ul className="space-y-3 text-sm">
                {result.detailedSuggestions.map((suggestion, index) => (
                  <li key={`suggestion-${index}`} className="p-2 border-b last:border-b-0">
                    <p className="font-medium text-foreground">{suggestion.area}</p>
                    <p className="text-muted-foreground my-1 whitespace-pre-wrap">{suggestion.suggestion}</p>
                    <p className="text-xs">
                      <strong>{t('analyzeProject.results.suggestionPriorityLabel')}</strong> {suggestion.priority}
                    </p>
                    {suggestion.suggestedPromptForImplementation && (
                       <div className="text-xs mt-1">
                        <strong>{t('analyzeProject.results.suggestedPromptLabel')}</strong>
                        <pre className="mt-1 p-1.5 bg-background rounded-sm text-xs whitespace-pre-wrap border">
                            {suggestion.suggestedPromptForImplementation}
                        </pre>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {result.groupLog && (
          <LogsDisplay title={t('analyzeProject.results.groupLogTitle')} logs={result.groupLog} />
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyzeProjectResultsDisplay;

