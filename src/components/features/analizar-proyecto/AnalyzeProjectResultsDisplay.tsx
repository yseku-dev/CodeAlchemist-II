
// src/components/features/analizar-proyecto/AnalyzeProjectResultsDisplay.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListChecks, Info, MessageSquare, Bot, User, Loader2, Send, Wand2, Save } from 'lucide-react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import LogsDisplay from '@/components/logs-display';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AnalyzeCodeOutput, ChatMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';


interface AnalyzeProjectResultsDisplayProps {
  result: AnalyzeCodeOutput | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  // Props for modification chat
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
 * Shows the AI's overall assessment, identified areas, specific suggestions,
 * general improvement ideas, and a chat interface for further interaction.
 * Also displays group logs if applicable and allows saving a snapshot.
 * All texts are internationalized.
 * @module AnalyzeProjectResultsDisplay
 */
const AnalyzeProjectResultsDisplay: React.FC<AnalyzeProjectResultsDisplayProps> = ({
  result,
  t,
  chatHistory,
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

  return (
    <div className="space-y-6">
      <Card className="mt-6 bg-background">
        <PageSectionHeader
          icon={ListChecks}
          title={result.analysisTitle || t('analyzeProject.results.noResults')}
          actions={
            <Button onClick={onSaveSnapshot} variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              {t('analyzeProject.results.saveSnapshotButton')}
            </Button>
          }
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
        </CardContent>
      </Card>

      {/* Interactive Modification Section */}
      <Separator className="my-8" />
      <Card className="border-accent/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-accent"/>
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
                      <Bot className="h-5 w-5 self-start flex-shrink-0 text-accent" />
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
                    <Loader2 className="h-5 w-5 animate-spin mr-2 text-accent" />
                    <span className="text-sm">{t('chat.thinking' as TranslationKey)}</span>
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
                    disabled={!currentModificationRequest.trim() || isRedefiningModificationRequest || isModifyingProject}
                    title={t('common.redefineRequestButton' as TranslationKey)}
                >
                    {isRedefiningModificationRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    <span className="sr-only">{t('common.redefineRequestButton' as TranslationKey)}</span>
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
            disabled={isModifyingProject || isRedefiningModificationRequest || !currentModificationRequest.trim()}
            className="w-full"
          >
            {isModifyingProject ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t('analyzeProject.results.sendModificationButton')}
          </Button>
           {/* Se elimina el LogsDisplay de aquí ya que se manejará en la página principal si es necesario */}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyzeProjectResultsDisplay;
