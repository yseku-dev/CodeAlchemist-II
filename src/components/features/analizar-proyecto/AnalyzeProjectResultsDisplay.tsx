
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


interface AnalyzeProjectResultsDisplayProps {
  result: AnalyzeCodeOutput | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  suggestionsForUI: DetailedSuggestionForUI[];
  onToggleSuggestionSelection: (suggestionId: string) => void;
  onApplySelectedAndDownloadZip: () => Promise<void>;
  canApplyAndDownload: boolean; 
  chatHistory: ChatMessage[];
  currentModificationRequest: string;
  onCurrentModificationRequestChange: (value: string) => void;
  onSendModificationRequest: () => Promise<void>;
  isModifyingProject: boolean;
  isRedefiningModificationRequest: boolean;
  onRedefineModificationRequest: () => Promise<void>;
  scrollAreaRefChat: React.RefObject<HTMLDivElement>;
  onSaveSnapshot: () => void;
}

/**
 * @fileOverview Component for displaying the results of a full project analysis.
 * Shows the AI's overall assessment, identified areas, specific suggestions (with selection for application),
 * general improvement ideas, and a chat interface for further interaction.
 * Also displays group logs if applicable and allows saving a snapshot and downloading a modified ZIP (if source was Git).
 * All texts are internationalized.
 * @module AnalyzeProjectResultsDisplay
 */
const AnalyzeProjectResultsDisplay: React.FC<AnalyzeProjectResultsDisplayProps> = ({
  result,
  t,
  suggestionsForUI,
  onToggleSuggestionSelection,
  onApplySelectedAndDownloadZip,
  canApplyAndDownload,
  chatHistory = [],
  currentModificationRequest,
  onCurrentModificationRequestChange,
  onSendModificationRequest,
  isModifyingProject,
  isRedefiningModificationRequest,
  onRedefineModificationRequest,
  scrollAreaRefChat,
  onSaveSnapshot,
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
      {canApplyAndDownload && ( 
        <Button 
          onClick={onApplySelectedAndDownloadZip} 
          variant="outline" 
          size="sm" 
          disabled={!hasApplicableSuggestionsSelected}
          title={!hasApplicableSuggestionsSelected ? t('analyzeProject.toast.downloadError.selectSuggestions') : t('analyzeProject.results.applyAndDownloadButton')}
        >
          <Download className="mr-2 h-4 w-4" />
          {t('analyzeProject.results.applyAndDownloadButton')}
        </Button>
      )}
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
            </div>
          )}
          {result.groupLog && (
            <LogsDisplay title={t('analyzeProject.results.groupLogTitle')} logs={result.groupLog} />
          )}
        </CardContent>
      </Card>

      {/* Interactive Modification Section */}
      <Separator className="my-8" />
      <Card className="border-primary/50 shadow-md"> {/* Changed accent to primary for the border */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary"/> {/* Changed accent to primary */}
            {t('analyzeProject.results.modifyAnalysisSectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30" ref={scrollAreaRefChat}>
             {chatHistory.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                    {t('analyzeProject.results.modificationInputPlaceholder')}
                </p>
            )}
            <div className="space-y-3">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm flex gap-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : msg.role === 'assistant'
                        ? 'bg-card text-card-foreground border'
                        : 'bg-destructive/10 text-destructive-foreground border border-destructive/30 items-start'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <Bot className="h-5 w-5 self-start flex-shrink-0 text-primary" /> /* Changed accent to primary */
                    )}
                     {msg.role === 'system' && (
                      <Bot className="h-5 w-5 self-start flex-shrink-0 text-destructive" />
                    )}
                    {msg.role === 'user' && (
                      <User className="h-5 w-5 self-start flex-shrink-0" />
                    )}
                     <div className="flex-grow">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs opacity-70 mt-1.5 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                        </p>
                    </div>
                  </div>
                </div>
              ))}
              {isModifyingProject && (
                <div className="flex justify-start">
                    <div className="max-w-[85%] p-2.5 rounded-lg bg-card text-card-foreground border flex items-center shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" /> {/* Changed accent to primary */}
                    <span className="text-sm">{t('chat.thinking')}</span>
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="space-y-1">
             <div className="flex justify-between items-center mb-1">
                <Label htmlFor="project-analysis-modification-input">{t('analyzeProject.results.modificationInputLabel')}</Label>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRedefineModificationRequest}
                    disabled={(!currentModificationRequest || !currentModificationRequest.trim()) || isRedefiningModificationRequest || isModifyingProject}
                    title={t('common.redefineRequestButton')}
                >
                    {isRedefiningModificationRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span className="sr-only">{t('common.redefineRequestButton')}</span>
                </Button>
            </div>
            <Textarea
              id="project-analysis-modification-input"
              value={currentModificationRequest}
              onChange={(e) => onCurrentModificationRequestChange(e.target.value)}
              placeholder={t('analyzeProject.results.modificationInputPlaceholder')}
              rows={3}
              disabled={isModifyingProject || isRedefiningModificationRequest}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendModificationRequest(); }}}
            />
          </div>
          <Button
            onClick={onSendModificationRequest}
            disabled={isModifyingProject || isRedefiningModificationRequest || (!currentModificationRequest || !currentModificationRequest.trim())}
            className="w-full"
          >
            {isModifyingProject ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t('analyzeProject.results.sendModificationButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyzeProjectResultsDisplay;

