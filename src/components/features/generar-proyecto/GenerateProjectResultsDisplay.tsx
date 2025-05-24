
// src/components/features/generar-proyecto/GenerateProjectResultsDisplay.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Send, Wand2, Loader2, MessageSquare, Bot, User, Save } from 'lucide-react';
import FileTreeDisplay from '@/components/file-tree';
import type { ProjectGenerationResult, ChatMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


interface GenerateProjectResultsDisplayProps {
  result: ProjectGenerationResult | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onDownloadProject: () => void;
  onSaveSnapshot: () => void;
  chatHistory?: ChatMessage[]; // Made optional
  currentModificationRequest: string;
  onCurrentModificationRequestChange: (value: string) => void;
  onSendModificationRequest: () => Promise<void>;
  isModifyingProject: boolean;
  isRedefiningModificationRequest: boolean;
  onRedefineModificationRequest: () => Promise<void>;
  scrollAreaRefChat: React.RefObject<HTMLDivElement>;
}

/**
 * @fileOverview Component for displaying the results of a project generation.
 * Shows the suggested project name, AI notes, a file tree of generated files,
 * a download button, and group logs if applicable.
 * Also includes a new section for interactively modifying the generated project via chat.
 * All texts are internationalized.
 * @module GenerateProjectResultsDisplay
 */

/**
 * GenerateProjectResultsDisplay component.
 * Renders the results section for the "Generate Project" page, including modification chat.
 *
 * @param {GenerateProjectResultsDisplayProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered results display section, or null if no result.
 */
const GenerateProjectResultsDisplay: React.FC<GenerateProjectResultsDisplayProps> = ({
  result,
  t,
  onDownloadProject,
  onSaveSnapshot,
  chatHistory = [], // Default value provided here
  currentModificationRequest,
  onCurrentModificationRequestChange,
  onSendModificationRequest,
  isModifyingProject,
  isRedefiningModificationRequest,
  onRedefineModificationRequest,
  scrollAreaRefChat,
}) => {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      {result.projectName && (
        <div>
          <h3 className="font-semibold text-xl mb-1">{t('generateProject.results.suggestedNameLabel')}</h3>
          <p className="text-lg text-primary">{result.projectName}</p>
        </div>
      )}

      {result.aiNotes && (
        <div>
          <h3 className="font-semibold text-lg mb-1">{t('generateProject.results.aiNotesLabel')}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.aiNotes}</p>
        </div>
      )}

      {result.files && result.files.length > 0 && (
        <div>
          <h3 className="font-semibold text-lg mb-2">{t('generateProject.results.generatedFilesLabel')}</h3>
          <FileTreeDisplay files={result.files} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onDownloadProject} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {t('generateProject.results.downloadButton')}
        </Button>
        <Button onClick={onSaveSnapshot} variant="outline">
          <Save className="mr-2 h-4 w-4" />
          {t('generateProject.results.saveSnapshotButton')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {t('generateProject.results.downloadNote')}
      </p>

      {/* Interactive Modification Section */}
      <Separator className="my-8" />
      <Card className="border-primary/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary"/>
            {t('generateProject.results.modifyProjectSectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30" ref={scrollAreaRefChat}>
            {(chatHistory || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                    {t('generateProject.results.modificationInputPlaceholder')}
                </p>
            )}
            <div className="space-y-3">
              {(chatHistory || []).map((msg) => (
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
                     {msg.role === 'system' && ( // System messages (like errors)
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
                    <span className="text-sm">{t('chat.thinking')}</span>
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="space-y-1">
             <div className="flex justify-between items-center mb-1">
                <Label htmlFor="project-modification-input">{t('generateProject.results.modificationInputLabel')}</Label>
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
              id="project-modification-input"
              value={currentModificationRequest}
              onChange={(e) => onCurrentModificationRequestChange(e.target.value)}
              placeholder={t('generateProject.results.modificationInputPlaceholder')}
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
            {t('generateProject.results.sendModificationButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default GenerateProjectResultsDisplay;

    