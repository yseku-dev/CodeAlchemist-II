
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview A reusable dialog component for AI-assisted input.
 * It provides a standard structure for prompting the user for a description
 * and then submitting it to an AI suggestion flow.
 */

/**
 * Props for the AISuggestionDialog component.
 */
interface AISuggestionDialogProps {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Callback function to handle changes to the dialog's open state. */
  onOpenChange: (open: boolean) => void;
  /** The title displayed in the dialog header. */
  dialogTitle: string;
  /** The description displayed below the dialog title. */
  dialogDescription: string;
  /** The label for the textarea input field. */
  textareaLabel: string;
  /** The placeholder text for the textarea. */
  textareaPlaceholder: string;
  /** The current value of the textarea. */
  textareaValue: string;
  /** Callback function to handle changes to the textarea's value. */
  onTextareaChange: (value: string) => void;
  /** Async callback function to execute when the submit button is clicked. */
  onSubmit: () => Promise<void>;
  /** Boolean indicating if the submission process is currently active (shows a loader). */
  isSubmitting: boolean;
  /** Optional text for the submit button. Defaults to "Obtener Sugerencia". */
  submitButtonText?: string;
  /** Optional ReactNode to render additional content in the dialog footer. */
  extraFooterContent?: React.ReactNode;
}

/**
 * AISuggestionDialog component.
 *
 * @param {AISuggestionDialogProps} props - The props for the component.
 * @returns {JSX.Element} The rendered AI suggestion dialog.
 */
export default function AISuggestionDialog({
  isOpen,
  onOpenChange,
  dialogTitle,
  dialogDescription,
  textareaLabel,
  textareaPlaceholder,
  textareaValue,
  onTextareaChange,
  onSubmit,
  isSubmitting,
  submitButtonText = "Obtener Sugerencia",
  extraFooterContent,
}: AISuggestionDialogProps): JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="ai-suggestion-textarea">{textareaLabel}</Label>
            <Textarea
              id="ai-suggestion-textarea"
              value={textareaValue}
              onChange={(e) => onTextareaChange(e.target.value)}
              placeholder={textareaPlaceholder}
              rows={4}
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-grow mb-2 sm:mb-0">
            {extraFooterContent}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={onSubmit} disabled={isSubmitting || !textareaValue.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitButtonText}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
