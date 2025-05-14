
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
  /** Text for the confirm button. Defaults to "Confirmar". */
  confirmText?: string;
  /** Text for the cancel button. Defaults to "Cancelar". */
  cancelText?: string;
  /** Optional children to render inside the dialog's content area, above the footer. */
  children?: React.ReactNode;
}

/**
 * A reusable confirmation dialog component.
 * Uses ShadCN's AlertDialog component.
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
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  children
}: ConfirmDialogProps) {
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
          {cancelText && <AlertDialogCancel onClick={onClose}>{cancelText}</AlertDialogCancel>}
          <AlertDialogAction onClick={onConfirm}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
