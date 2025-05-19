
// src/components/features/generar-proyecto/GenerateProjectResultsDisplay.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import FileTreeDisplay from '@/components/file-tree';
import LogsDisplay from '@/components/logs-display';
import type { ProjectGenerationResult } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GenerateProjectResultsDisplayProps {
  result: ProjectGenerationResult | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onDownloadProject: () => void;
}

/**
 * @fileOverview Component for displaying the results of a project generation.
 * Shows the suggested project name, AI notes, a file tree of generated files,
 * a download button, and group logs if applicable.
 * All texts are internationalized.
 * @module GenerateProjectResultsDisplay
 */

/**
 * GenerateProjectResultsDisplay component.
 * Renders the results section for the "Generate Project" page.
 *
 * @param {GenerateProjectResultsDisplayProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered results display section, or null if no result.
 */
const GenerateProjectResultsDisplay: React.FC<GenerateProjectResultsDisplayProps> = ({
  result,
  t,
  onDownloadProject,
}) => {
  if (!result) {
    return null;
  }

  const downloadButtonText = t('generateProject.results.downloadButton');
  const downloadNoteText = t('generateProject.results.downloadNote', {
    filename: `${(result.projectName || 'proyecto_generado').replace(/\s+/g, '_').toLowerCase()}.json` // Assuming JSON download for structure
  });


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

      <Button onClick={onDownloadProject} variant="outline">
        <Download className="mr-2 h-4 w-4" />
        {downloadButtonText}
      </Button>
      {/* 
        The original PRD mentioned a ZIP download. If this button actually triggers a JSON download,
        the note below should clarify it, or the toast message.
        The current generateProject.results.downloadNote key seems to imply JSON.
      */}
      <p className="text-xs text-muted-foreground mt-1">
        {downloadNoteText}
      </p>

      {result.groupLog && (
        <LogsDisplay
          title={t('generateProject.results.groupLogTitle')}
          logs={result.groupLog}
        />
      )}
    </div>
  );
};

export default GenerateProjectResultsDisplay;
