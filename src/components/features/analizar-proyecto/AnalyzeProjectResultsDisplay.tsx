
// src/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ListChecks, Info, MessageSquare, Bot, User, Loader2, Send, Wand2, Save, Download, ShieldAlert } from 'lucide-react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AnalyzeCodeOutput, ChatMessage, DetailedSuggestionForUI } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface AnalyzeProjectResultsDisplayProps {
  result: AnalyzeCodeOutput | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  suggestionsForUI: DetailedSuggestionForUI[];
  onToggleSuggestionSelection: (suggestionId: string) => void;
  onDownloadProjectZip: () => Promise<void>;
  canApplyAndDownload: boolean;
  modificationPrompt: string;
  onModificationPromptChange: (value: string) => void;
  onProcessModification: () => Promise<void>;
  isProcessingModification: boolean;
  isRedefiningModificationPrompt: boolean;
  onRedefineModificationRequest: () => Promise<void>;
  onSaveSnapshot: () => void;
  onApplySelectedCheckboxSuggestions: () => void;
  scrollAreaRefChat: React.RefObject<HTMLDivElement>;
}

/**
 * @fileOverview Component for displaying the results of a full project analysis.
 * Shows the AI's overall assessment, identified areas, specific suggestions (with selection for application),
 * general improvement ideas, and a section for suggesting further modifications.
 * Also displays group logs if applicable and allows saving a snapshot and downloading a modified ZIP.
 * All texts are internationalized.
 * @module AnalyzeProjectResultsDisplay
 */
const AnalyzeProjectResultsDisplay: React.FC<AnalyzeProjectResultsDisplayProps> = ({
  result,
  t,
  suggestionsForUI,
  onToggleSuggestionSelection,
  onDownloadProjectZip,
  canApplyAndDownload,
  modificationPrompt,
  onModificationPromptChange,
  onProcessModification,
  isProcessingModification,
  isRedefiningModificationPrompt,
  onRedefineModificationRequest,
  onSaveSnapshot,
  onApplySelectedCheckboxSuggestions,
  scrollAreaRefChat,
}) => {
  if (!result) {
    return null;
  }

  const hasApplicableSuggestionsSelected = suggestionsForUI.some(s => s.isSelected && s.suggestedContent);

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onSaveSnapshot} variant="outline" size="sm">
        <Save className="mr-2 h-4 w-4" />
        {t('analyzeProject.results.saveSnapshotButton')}
      </Button>
      <TooltipProvider>
        <Tooltip open={!canApplyAndDownload ? undefined : false}>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button
                onClick={onDownloadProjectZip}
                variant="outline"
                size="sm"
                disabled={!canApplyAndDownload}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('analyzeProject.results.applyAndDownloadButton')}
              </Button>
            </span>
          </TooltipTrigger>
          {!canApplyAndDownload && (
            <TooltipContent>
              <p>{t('analyzeProject.results.downloadProjectZipTooltipDisabled')}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="mt-6 bg-background">
        <PageSectionHeader
          icon={ListChecks}
          title={result.analysisTitle || t('analyzeProject.results.noResults')}
          actions={headerActions}
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

          {suggestionsForUI && suggestionsForUI.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">{t('analyzeProject.results.specificSuggestionsLabel')}</h3>
              </div>
              {canApplyAndDownload && (
                <div className="p-3 my-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-md flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                        {t('analyzeProject.results.applyInfoText')}
                    </p>
                </div>
              )}
              <ScrollArea className="h-60 border rounded-md p-2 bg-muted/30">
                <ul className="space-y-3 text-sm">
                  {suggestionsForUI.map((suggestion) => (
                    <li key={suggestion.id} className="p-2 border-b last:border-b-0">
                      <div className="flex items-start gap-2">
                        {suggestion.suggestedContent && canApplyAndDownload && (
                            <Checkbox
                                id={`suggestion-cb-${suggestion.id}`}
                                checked={!!suggestion.isSelected}
                                onCheckedChange={() => onToggleSuggestionSelection(suggestion.id)}
                                className="mt-1"
                                aria-label={t('analyzeProject.results.selectSuggestionCheckboxAria', { area: suggestion.area })}
                            />
                        )}
                         <div className="flex-grow">
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
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              {canApplyAndDownload && (
                <Button 
                  onClick={onApplySelectedCheckboxSuggestions} 
                  disabled={!hasApplicableSuggestionsSelected}
                  className="mt-4 w-full sm:w-auto"
                >
                  {t('analyzeProject.results.applySelectedSuggestionsButton')}
                </Button>
              )}
            </div>
          )}
          {result.groupLog && (
            <LogsDisplay title={t('analyzeProject.results.groupLogTitle')} logs={result.groupLog} />
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />
      <Card className="border-primary/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary"/>
            {t('analyzeProject.results.modifyAnalysisSectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-1">
             <div className="flex justify-between items-center mb-1">
                <Label htmlFor="project-analysis-modification-input">{t('analyzeProject.results.modificationInputLabel')}</Label>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRedefineModificationRequest}
                    disabled={(!modificationPrompt || !modificationPrompt.trim()) || isRedefiningModificationPrompt || isProcessingModification}
                    title={t('common.redefineRequestButton')}
                >
                    {isRedefiningModificationPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span className="sr-only">{t('common.redefineRequestButton')}</span>
                </Button>
            </div>
            <Textarea
              id="project-analysis-modification-input"
              value={modificationPrompt}
              onChange={(e) => onModificationPromptChange(e.target.value)}
              placeholder={t('analyzeProject.results.modificationInputPlaceholder')}
              rows={3}
              disabled={isProcessingModification || isRedefiningModificationPrompt || !canApplyAndDownload}
            />
             {!canApplyAndDownload && <p className="text-xs text-muted-foreground mt-1">{t('analyzeProject.toast.modificationError.noBaseFiles')}</p>}
          </div>
          <Button
            onClick={onProcessModification}
            disabled={isProcessingModification || isRedefiningModificationPrompt || (!modificationPrompt || !modificationPrompt.trim()) || !canApplyAndDownload}
            className="w-full"
          >
            {isProcessingModification ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t('analyzeProject.results.processModificationButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyzeProjectResultsDisplay;
