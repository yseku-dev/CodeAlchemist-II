
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, GitCommit, ClipboardList, FileArchive } from 'lucide-react';
import ErrorDisplay from '@/components/error-display';
// import LogsDisplay from '@/components/logs-display'; // LogsDisplay is now directly in AutoUpdatePage
import type { AnalyzeCodeOutput, AutoUpdateSuggestion } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';
import CodeBlock from '@/components/code-block';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/context/I18nContext';

interface AutoUpdateResultsDisplayProps {
  analysisResult: AnalyzeCodeOutput | null;
  suggestions: AutoUpdateSuggestion[];
  isLoading: boolean; 
  error: string | null;
  onAutoFixError: (errorMsg: string) => void;
  onApplySuggestion: (suggestion: AutoUpdateSuggestion) => void;
  onToggleEdit: (suggestionId: string) => void;
  onContentChange: (suggestionId: string, newContent: string) => void;
  onSaveEdit: (suggestionId: string) => void;
  onCancelEdit: (suggestionId: string) => void;
  onTestSuggestion: (suggestion: AutoUpdateSuggestion) => void;
  onTestInVenv: (suggestion: AutoUpdateSuggestion) => void;
  onDownloadSuggestions: (format: 'JSON_SUGGESTIONS' | 'ZIP_PROJECT') => void;
  onOpenCommitDialog: () => void;
  unifiedPrompt: string | null;
}

/**
 * @fileOverview Component for displaying AutoUpdate analysis results.
 * Shows analysis summary, detailed suggestions, a unified prompt, and actions like download/commit.
 * Internationalized using useI18n.
 */
export default function AutoUpdateResultsDisplay({
  analysisResult,
  suggestions,
  isLoading,
  error,
  onAutoFixError,
  onApplySuggestion,
  onToggleEdit,
  onContentChange,
  onSaveEdit,
  onCancelEdit,
  onTestSuggestion,
  onTestInVenv,
  onDownloadSuggestions,
  onOpenCommitDialog,
  unifiedPrompt,
}: AutoUpdateResultsDisplayProps) {
  const { t } = useI18n();

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center gap-3">
                <ClipboardList className="h-7 w-7 text-primary" />
                <span>{t('autoupdate.results.title')}</span>
            </CardTitle>
            {analysisResult && (
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onDownloadSuggestions('JSON_SUGGESTIONS')} disabled={!suggestions.length}><Download className="mr-2 h-4 w-4" /> {t('autoupdate.results.downloadSuggestionsJson')}</Button>
                    <Button variant="outline" size="sm" onClick={() => onDownloadSuggestions('ZIP_PROJECT')} disabled={isLoading}><FileArchive className="mr-2 h-4 w-4" /> {t('autoupdate.results.downloadProjectZip')}</Button>
                    <Button variant="outline" size="sm" onClick={onOpenCommitDialog}><GitCommit className="mr-2 h-4 w-4" /> {t('autoupdate.results.uploadToGit')}</Button>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorDisplay error={error} onAutoFix={() => onAutoFixError(error || t('autoupdate.errors.unknownAnalysisError'))} />}
        {isLoading && !analysisResult && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">{t('common.processing')}...</p></div>}

        {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">{t('autoupdate.results.noResults')}</p>}

        {analysisResult && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{analysisResult.analysisTitle}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.generalAssessment}</p>
            
            {analysisResult.overallImprovementIdeas && analysisResult.overallImprovementIdeas.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-lg mb-2">{t('autoupdate.results.overallImprovementIdeasLabel')}</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {analysisResult.overallImprovementIdeas.map((idea, index) => (
                    <li key={`idea-${index}`}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-lg">{t('autoupdate.results.detailedSuggestionsLabel')}</h4>
              {suggestions.length === 0 && <p className="text-sm text-muted-foreground">{t('autoupdate.results.noDetailedSuggestions')}</p>}
              <ScrollArea className="max-h-[calc(100vh-22rem)] md:max-h-[calc(100vh-25rem)] lg:max-h-[65vh] overflow-y-auto pr-2">
                  <div className="space-y-3">
                  {suggestions.map(s => (
                      <AutoUpdateSuggestionCard
                      key={s.id}
                      suggestion={s}
                      onApply={onApplySuggestion}
                      onToggleEdit={onToggleEdit}
                      onContentChange={onContentChange}
                      onSaveEdit={onSaveEdit}
                      onCancelEdit={onCancelEdit}
                      onTest={onTestSuggestion}
                      onTestInVenv={onTestInVenv}
                      />
                  ))}
                  </div>
              </ScrollArea>
            </div>

            {unifiedPrompt && unifiedPrompt.trim() !== '' && (
              <div className="mt-6 pt-4 border-t">
                <Label htmlFor="unified-prompt-display" className="text-lg font-semibold block mb-2">
                  {t('autoupdate.results.unifiedPromptLabel')}
                </Label>
                <CodeBlock code={unifiedPrompt} language="plaintext" maxHeight="300px" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
