
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea'; // Assuming TextareaProps can be imported
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview A simple code editor component using a Textarea with localStorage persistence
 * for content and cursor position.
 */

/**
 * Props for the CodeEditor component.
 */
interface CodeEditorProps extends Omit<TextareaProps, 'onChange' | 'value'> {
  /**
   * A unique identifier for this editor instance.
   * Used to create a unique key for localStorage.
   */
  id: string;
  /**
   * The current value of the editor (controlled component).
   */
  value: string;
  /**
   * Callback function invoked when the editor content changes.
   * @param {string} newValue - The new content of the editor.
   */
  onChange: (newValue: string) => void;
  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Number of rows for the textarea. */
  rows?: number;
  /** Additional CSS class names. */
  className?: string;
  /** Whether the textarea is disabled. */
  disabled?: boolean;
}

interface StoredEditorState {
  content: string;
  cursorPosition: number;
}

/**
 * CodeEditor component.
 * A simple textarea-based editor that persists its content and cursor position
 * to localStorage.
 *
 * To clear the stored state for this editor, you would typically call:
 * `localStorage.removeItem(\`code-editor-\${yourEditorId}\`);`
 * from the parent component or application logic when a reset is needed.
 *
 * @param {CodeEditorProps} props - The props for the component.
 * @returns {JSX.Element} The rendered code editor.
 */
export default function CodeEditor({
  id,
  value,
  onChange,
  placeholder,
  rows,
  className,
  disabled,
  ...rest
}: CodeEditorProps): JSX.Element {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `code-editor-${id}`;
  const [initialCursorPos, setInitialCursorPos] = useState<number | null>(null);

  // Load from localStorage on mount or when ID changes
  useEffect(() => {
    try {
      const savedStateString = localStorage.getItem(storageKey);
      if (savedStateString) {
        const savedState = JSON.parse(savedStateString) as StoredEditorState;
        if (savedState.content !== undefined && savedState.content !== value) {
          onChange(savedState.content);
        }
        if (savedState.cursorPosition !== undefined) {
          setInitialCursorPos(savedState.cursorPosition);
        }
      }
    } catch (error) {
      console.error(`CodeEditor: Error loading state for ID "${id}" from localStorage:`, error);
      toast({
        variant: 'destructive',
        title: 'Error de Carga',
        description: `No se pudo cargar el estado guardado del editor para ${id}.`,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // onChange and value are omitted to prevent re-triggering load on parent re-renders unless ID changes

  // Effect to set cursor position after content has been updated from localStorage
  useEffect(() => {
    if (textareaRef.current && initialCursorPos !== null && value) {
      // Ensure this runs after the value prop has caused a re-render
      // A small timeout can help ensure the DOM is updated
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          try {
            textareaRef.current.selectionStart = initialCursorPos;
            textareaRef.current.selectionEnd = initialCursorPos;
            // textareaRef.current.focus(); // Optionally focus
          } catch (e) {
            console.warn("CodeEditor: Could not set cursor position", e);
          }
        }
        setInitialCursorPos(null); // Reset after attempting to set
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [value, initialCursorPos]);


  const saveStateToLocalStorage = useCallback((currentContent: string, currentCursorPosition: number) => {
    try {
      const stateToSave: StoredEditorState = {
        content: currentContent,
        cursorPosition: currentCursorPosition,
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error(`CodeEditor: Error saving state for ID "${id}" to localStorage:`, error);
      // Potentially show a toast if saving persistently fails (e.g., storage full)
    }
  }, [storageKey, id]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = event.target.value;
    const newCursorPosition = event.target.selectionStart;
    onChange(newContent);
    saveStateToLocalStorage(newContent, newCursorPosition);
  };

  const handleBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    const currentContent = event.target.value;
    const currentCursorPosition = event.target.selectionStart;
    saveStateToLocalStorage(currentContent, currentCursorPosition);
  };

  return (
    <Textarea
      ref={textareaRef}
      id={id} // Pass the id to the textarea for label association if needed
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      rows={rows}
      className={className}
      disabled={disabled}
      {...rest} // Pass down any other TextareaProps
    />
  );
}
