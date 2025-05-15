
"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from '@/context/I18nContext';

/**
 * @fileOverview A reusable confirmation dialog component.
 * Uses ShadCN's AlertDialog component and supports i18n for default button texts.
 */

/**
 * Props for the ConfirmDialog component.
 */
interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Callback fired when the dialog is requested to be closed (e.g., by clicking outside or pressing Esc). */
  onClose: () => void;
  /** Callback fired when the confirm action is triggered. */
  onConfirm: () => void;
  /** The title of the dialog. */
  title: string;
  /** Optional description or main content of the dialog. Can be a string or ReactNode. */
  description?: string | React.ReactNode;
  /** Text for the confirm button. Defaults to "Confirmar" (translated). */
  confirmText?: string;
  /** Text for the cancel button. Defaults to "Cancelar" (translated). Can be an empty string to hide it. */
  cancelText?: string;
  /** Optional children to render inside the dialog's content area, above the footer. */
  children?: React.ReactNode;
  /** Optional boolean to disable the confirm button, e.g., while an action is in progress. */
  confirmDisabled?: boolean;
}

/**
 * A reusable confirmation dialog component.
 * Uses ShadCN's AlertDialog component and i18n for default button texts.
 *
 * @param {ConfirmDialogProps} props - The props for the component.
 * @returns {JSX.Element | null} The rendered dialog or null if not open.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  children,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  // Determine default texts if not provided
  const finalConfirmText = confirmText || t('common.confirm');
  const finalCancelText = cancelText === undefined ? t('common.cancel') : cancelText; // Allow empty string to hide

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children && <div className="py-4">{children}</div>}
        <AlertDialogFooter>
          {finalCancelText && <AlertDialogCancel onClick={onClose}>{finalCancelText}</AlertDialogCancel>}
          <AlertDialogAction onClick={onConfirm} disabled={confirmDisabled}>{finalConfirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
