
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, GitCommit, ClipboardList, FileArchive } from 'lucide-react'; // Added FileArchive
import ErrorDisplay from '@/components/error-display';
import LogsDisplay from '@/components/logs-display';
import type { AnalyzeCodeOutput, AutoUpdateSuggestion } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import AutoUpdateSuggestionCard from '@/components/features/autoupdate/autoupdate-suggestion-card';

interface AutoUpdateResultsDisplayProps {
  analysisResult: AnalyzeCodeOutput | null;
  suggestions: AutoUpdateSuggestion[];
  isLoading: boolean; // True when analysis is running OR results are being processed initially
  error: string | null;
  onAutoFixError: (errorMsg: string) => void;
  onApplySuggestion: (suggestion: AutoUpdateSuggestion) => void;
  onToggleEdit: (suggestionId: string) => void;
  onContentChange: (suggestionId: string, newContent: string) => void;
  onSaveEdit: (suggestionId: string) => void;
  onCancelEdit: (suggestionId: string) => void;
  onTestSuggestion: (suggestion: AutoUpdateSuggestion) => void;
  onTestInVenv: (suggestion: AutoUpdateSuggestion) => void;
  onDownloadSuggestions: (format: 'JSON_SUGGESTIONS' | 'ZIP_PROJECT') => void; // Updated format types
  onOpenCommitDialog: () => void;
}

/**
 * @fileOverview Component for displaying AutoUpdate analysis results.
 * Shows analysis summary, detailed suggestions, and actions like download/commit.
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
}: AutoUpdateResultsDisplayProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="flex items-center gap-3">
                <ClipboardList className="h-7 w-7 text-primary" />
                <span>Resultados del Auto-Análisis</span>
            </CardTitle>
            {analysisResult && (
                <div className="flex flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onDownloadSuggestions('JSON_SUGGESTIONS')} disabled={!suggestions.length}><Download className="mr-2 h-4 w-4" /> Descargar Sugerencias (JSON)</Button>
                    <Button variant="outline" size="sm" onClick={() => onDownloadSuggestions('ZIP_PROJECT')} disabled={!analysisResult}><FileArchive className="mr-2 h-4 w-4" /> Descargar Código Actual (ZIP)</Button>
                    <Button variant="outline" size="sm" onClick={onOpenCommitDialog}><GitCommit className="mr-2 h-4 w-4" /> Subir a Git</Button>
                </div>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {error && <ErrorDisplay error={error} onAutoFix={() => onAutoFixError(error || "Error desconocido")} />}
        {isLoading && !analysisResult && <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Analizando código...</p></div>}

        {!isLoading && !analysisResult && !error && <p className="text-muted-foreground text-center py-10">Inicia un análisis para ver los resultados.</p>}

        {analysisResult && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{analysisResult.analysisTitle}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{analysisResult.generalAssessment}</p>
            
            {analysisResult.overallImprovementIdeas && analysisResult.overallImprovementIdeas.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-lg mb-2">Ideas Generales de Mejora Sugeridas por IA:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {analysisResult.overallImprovementIdeas.map((idea, index) => (
                    <li key={`idea-${index}`}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-lg">Sugerencias Detalladas:</h4>
              {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No hay sugerencias detalladas.</p>}
              <ScrollArea className="max-h-[calc(100vh-22rem)] md:max-h-[calc(100vh-25rem)] lg:max-h-[65vh] overflow-y-auto pr-2"> {/* Increased lg:max-h */}
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
            {analysisResult.groupLog && <LogsDisplay title="Log de Ejecución del Grupo" logs={analysisResult.groupLog} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
