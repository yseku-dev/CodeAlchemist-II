
// src/components/features/refactorizar-proyecto/RefactorProjectResultsSection.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ListChecks, Info, BadgeHelp, BadgeCheck, BadgeX, Save } from 'lucide-react'; // Added Save
import ErrorDisplay from '@/components/error-display';
import ConfirmDialog from '@/components/confirm-dialog';
import CodeBlock from '@/components/code-block';
import LogsDisplay from '@/components/logs-display';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { Separator } from '@/components/ui/separator';
import type { RefactorSuggestion, RefactorProjectWithAIOutput as AIResult } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface RefactorProjectResultsSectionProps {
  analysisResult: AIResult | null;
  suggestions: RefactorSuggestion[];
  isLoading: boolean;
  error: string | null;
  loadingMessage: string | null;
  onApplySuggestion: (id: string) => void;
  onViewDiff: (suggestion: RefactorSuggestion) => void;
  onDiscardSuggestion: (id: string) => void;
  onApplyAll: () => void;
  setSuggestions: React.Dispatch<React.SetStateAction<RefactorSuggestion[]>>;
  showDiffModal: boolean;
  onCloseDiffModal: () => void;
  currentDiff: { original?: string; modified?: string } | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onSaveSnapshot: () => void; // Nueva prop
}

const RefactorProjectResultsSection: React.FC<RefactorProjectResultsSectionProps> = ({
  analysisResult,
  suggestions,
  isLoading,
  error,
  loadingMessage,
  onApplySuggestion,
  onViewDiff,
  onDiscardSuggestion,
  onApplyAll,
  setSuggestions,
  showDiffModal,
  onCloseDiffModal,
  currentDiff,
  t,
  onSaveSnapshot, // Nueva prop
}) => {

  const handleRevertSuggestionState = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'pending' } : s));
  };

  const getPriorityColor = (priority: "Alta" | "Media" | "Baja") => {
    if (priority === "Alta") return "text-destructive";
    if (priority === "Media") return "text-yellow-600";
    return "text-green-600";
  };

  const getStatusIcon = (status: 'pending' | 'applied' | 'discarded' | undefined) => {
    if (status === 'applied') return <BadgeCheck className="h-5 w-5 text-green-500" />;
    if (status === 'discarded') return <BadgeX className="h-5 w-5 text-muted-foreground" />;
    return <BadgeHelp className="h-5 w-5 text-blue-500" />; // pending
  };

  const headerActions = [];
  if (analysisResult) {
    headerActions.push(
      <Button key="saveSnapshot" variant="outline" size="sm" onClick={onSaveSnapshot}>
        <Save className="mr-2 h-4 w-4" /> {t('refactorProject.results.saveSnapshotButton')}
      </Button>
    );
    if (suggestions.some(s => s.status === 'pending')) {
      headerActions.push(
        <Button key="applyAll" variant="outline" size="sm" onClick={onApplyAll} disabled={isLoading}>
          {t('refactorProject.results.applyAllButton')}
        </Button>
      );
    }
  }


  return (
    <Card className="lg:col-span-2">
      <PageSectionHeader
        icon={ListChecks}
        title={t('refactorProject.results.title')}
        actions={headerActions.length > 0 ? <div className="flex flex-wrap gap-2">{headerActions}</div> : null}
      />
      <CardContent>
        {error && <ErrorDisplay error={error} onAutoFix={() => { /* Placeholder for auto-fix logic if needed */ }} />}
        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">{loadingMessage || t('common.processing')}</p>
          </div>
        )}

        {!isLoading && !analysisResult && !error && (
          <p className="text-muted-foreground text-center py-10">{t('refactorProject.results.noSuggestions')}</p>
        )}

        {analysisResult && (
          <ScrollArea className="h-[calc(100vh-12rem)] pr-4"> 
            <div className="space-y-4">
              {analysisResult.projectOverview && (
                <Card className="mb-4 bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-600" />
                      {t('refactorProject.results.projectSummaryCard.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p className="whitespace-pre-wrap">{analysisResult.projectOverview || t('refactorProject.results.projectSummaryCard.noSummary')}</p>
                  </CardContent>
                </Card>
              )}
              <Separator className="my-4" />
              <h3 className="text-lg font-semibold mb-2">{t('refactorProject.results.suggestionsTitle')}</h3>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('refactorProject.results.noSpecificSuggestions')}</p>
              ) : (
                <ul className="space-y-3">
                  {suggestions.map(s => (
                    <li key={s.id}>
                      <Card className={`transition-opacity ${s.status === 'discarded' ? 'opacity-60 bg-muted/50' : ''} ${s.status === 'applied' ? 'border-green-500' : ''}`}>
                        <CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-md font-semibold">{s.area}</CardTitle>
                              <CardDescription>
                                {t('refactorProject.suggestion.priorityLabel')}{' '}
                                <span className={getPriorityColor(s.priority)}>{s.priority}</span>
                              </CardDescription>
                            </div>
                            {getStatusIcon(s.status)}
                          </div>
                        </CardHeader>
                        <CardContent className="text-sm px-4 pb-3">
                          <p className="mb-2 whitespace-pre-wrap">{s.description}</p>
                          {s.snippetSuggested && (s.snippetSuggested.original || s.snippetSuggested.modified) && (
                            <div className="my-2 p-2 bg-secondary/50 rounded-md">
                              <p className="text-xs font-semibold mb-1">{t('refactorProject.suggestion.snippetLabel')}</p>
                              {s.snippetSuggested.original && (
                                <p className="text-xs text-muted-foreground break-all">
                                  <strong>{t('refactorProject.diffModal.originalLabel')}</strong>{' '}
                                  {s.snippetSuggested.original.substring(0, 100)}{s.snippetSuggested.original.length > 100 ? '...' : ''}
                                </p>
                              )}
                              {s.snippetSuggested.modified && (
                                <p className="text-xs text-muted-foreground break-all">
                                  <strong>{t('refactorProject.diffModal.suggestedLabel')}</strong>{' '}
                                  {s.snippetSuggested.modified.substring(0, 100)}{s.snippetSuggested.modified.length > 100 ? '...' : ''}
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 py-2 px-4 border-t">
                          {s.status === 'pending' ? (
                            <>
                              {s.snippetSuggested && (s.snippetSuggested.original || s.snippetSuggested.modified) && (
                                <Button variant="outline" size="xs" onClick={() => onViewDiff(s)}>
                                  {t('refactorProject.suggestion.viewDiffButton')}
                                </Button>
                              )}
                              <Button variant="outline" size="xs" onClick={() => onDiscardSuggestion(s.id)}>
                                {t('refactorProject.suggestion.discardButton')}
                              </Button>
                              <Button size="xs" onClick={() => onApplySuggestion(s.id)}>
                                {t('refactorProject.suggestion.applyButton')}
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="xs" onClick={() => handleRevertSuggestionState(s.id)}>
                              {t('refactorProject.suggestion.revertStateButton')}
                            </Button>
                          )}
                        </CardFooter>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {analysisResult.groupLog && (
              <LogsDisplay title={t('refactorProject.logs.groupLogTitle')} logs={analysisResult.groupLog} />
            )}
          </ScrollArea>
        )}
      </CardContent>

      <ConfirmDialog
        isOpen={showDiffModal}
        onClose={onCloseDiffModal}
        onConfirm={onCloseDiffModal} // Confirm action is just to close
        title={t('refactorProject.diffModal.title')}
        confirmText={t('common.close')}
        cancelText="" // No cancel button for this specific dialog use case
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          <div>
            <h4 className="font-semibold mb-1 text-sm">{t('refactorProject.diffModal.originalLabel')}</h4>
            <CodeBlock code={currentDiff?.original || t('refactorProject.diffModal.noContent')} maxHeight="100%" />
          </div>
          <div>
            <h4 className="font-semibold mb-1 text-sm">{t('refactorProject.diffModal.suggestedLabel')}</h4>
            <CodeBlock code={currentDiff?.modified || t('refactorProject.diffModal.noContent')} maxHeight="100%" />
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  );
};

export default RefactorProjectResultsSection;
