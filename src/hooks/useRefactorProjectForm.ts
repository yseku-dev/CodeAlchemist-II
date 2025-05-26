// src/hooks/useRefactorProjectForm.ts
"use client";

import { useState, useRef, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useToast } from './use-toast';
import { useI18n } from '@/context/I18nContext';
import { useDebug } from '@/context/DebugContext';
import type { GeneralPriority } from '@/lib/constants';
import { NINGUNA_PRIORITY_VALUE } from '@/lib/constants';
import { callRedefinePrompt } from '@/utils/apiClient';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation'; // Import useRouter
import type { TranslationKey } from '@/lib/i18n/translations';

export type ProjectSourceType = "upload" | "git" | "local";

export interface RefactorProjectFormData {
  projectSourceType: ProjectSourceType;
  uploadedFile: File | null;
  uploadedFileName: string | null;
  gitUrl: string;
  refactorGoals: string;
  generalPriority: GeneralPriority | typeof NINGUNA_PRIORITY_VALUE;
  searchDepth: string;
  focusArea: string;
}

interface UseRefactorProjectFormReturn extends RefactorProjectFormData {
  setProjectSourceType: React.Dispatch<React.SetStateAction<ProjectSourceType>>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  setGitUrl: React.Dispatch<React.SetStateAction<string>>;
  setRefactorGoals: React.Dispatch<React.SetStateAction<string>>;
  setGeneralPriority: React.Dispatch<React.SetStateAction<GeneralPriority | typeof NINGUNA_PRIORITY_VALUE>>;
  setSearchDepth: React.Dispatch<React.SetStateAction<string>>;
  setFocusArea: React.Dispatch<React.SetStateAction<string>>;
  isRedefiningGoals: boolean;
  handleRedefineGoals: () => Promise<void>;
  isRedefiningFocusArea: boolean;
  handleRedefineFocusArea: () => Promise<void>;
  getFormDataForAnalysis: () => Partial<RefactorProjectFormData>; // For preparing input to AI
}

/**
 * @fileOverview Custom hook to manage the state and logic for the refactor project configuration form.
 * Encapsulates form field states, change handlers, file upload logic, and AI-assisted prompt redefinition.
 * Uses localStorage for persistence of form fields.
 * @module useRefactorProjectForm
 */
export function useRefactorProjectForm(): UseRefactorProjectFormReturn {
  const { t } = useI18n();
  const { toast } = useToast();
  const { addLog: addDebugLog } = useDebug();
  const router = useRouter(); // Initialize useRouter

  const [projectSourceType, setProjectSourceType] = useLocalStorage<ProjectSourceType>("codealchemist-rp-projectSourceType", "upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useLocalStorage<string | null>('codealchemist-rp-uploadedFileName', null);
  const [gitUrl, setGitUrl] = useLocalStorage<string>('codealchemist-rp-gitUrl', '');

  const [refactorGoals, setRefactorGoals] = useLocalStorage<string>('codealchemist-rp-refactorGoals', '');
  const [generalPriority, setGeneralPriority] = useLocalStorage<GeneralPriority | typeof NINGUNA_PRIORITY_VALUE>('codealchemist-rp-generalPriority', NINGUNA_PRIORITY_VALUE);
  const [searchDepth, setSearchDepth] = useLocalStorage<string>('codealchemist-rp-searchDepth', '');
  const [focusArea, setFocusArea] = useLocalStorage<string>('codealchemist-rp-focusArea', '');

  const [isRedefiningGoals, setIsRedefiningGoals] = useState(false);
  const [isRedefiningFocusArea, setIsRedefiningFocusArea] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/zip', 'application/json', 'text/plain', 'text/javascript', 'text/x-python-script', 'text/css', 'text/html'];
      const allowedExtensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.json', '.html', '.css', '.txt', '.md', '.zip']; // Added .zip
      const fileNameLower = file.name.toLowerCase();
      const fileExtension = `.${fileNameLower.split('.').pop()}`;
      const isAllowedTextFile = allowedExtensions.includes(fileExtension) &&
        (file.type.startsWith('text/') || file.type === 'application/octet-stream' || file.type === '' || allowedTypes.includes(file.type) || file.type === 'application/zip');

      if ((allowedTypes.includes(file.type) || isAllowedTextFile || fileNameLower.endsWith('.zip')) && file.size <= 10 * 1024 * 1024) {
        setUploadedFile(file);
        setUploadedFileName(file.name);
        addDebugLog({ source: 'useRefactorProjectForm', type: 'INFO', message: `Archivo seleccionado para refactorizar: ${file.name}`, flowName: 'handleFileChange' });
      } else {
        toast({ variant: "destructive", title: t('refactorProject.toast.invalidFile.title' as TranslationKey), description: t('refactorProject.toast.invalidFile.description' as TranslationKey) });
        setUploadedFile(null);
        setUploadedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  }, [setUploadedFile, setUploadedFileName, addDebugLog, toast, t]);

  const handleRedefineGoals = useCallback(async () => {
    if (!refactorGoals.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningGoals(true);
    addDebugLog({ source: 'useRefactorProjectForm', type: 'INFO', message: `Redefiniendo metas. Original (inicio): ${refactorGoals.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: refactorGoals });
      setRefactorGoals(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'useRefactorProjectForm', type: 'SUCCESS', message: `'metas' redefinidas. Nueva (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'useRefactorProjectForm', type: 'ERROR', message: `Fallo al redefinir 'metas'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningGoals(false);
    }
  }, [refactorGoals, setRefactorGoals, addDebugLog, t, toast, router]);

  const handleRedefineFocusArea = useCallback(async () => {
    if (!focusArea.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title' as TranslationKey), description: t('common.toast.redefineEmpty.description' as TranslationKey) });
      return;
    }
    setIsRedefiningFocusArea(true);
    addDebugLog({ source: 'useRefactorProjectForm', type: 'INFO', message: `Redefiniendo campo de enfoque. Original (inicio): ${focusArea.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title' as TranslationKey), description: t('common.toast.redefining.description' as TranslationKey) });
    try {
      const resultOutput = await callRedefinePrompt({ originalPrompt: focusArea });
      setFocusArea(resultOutput.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title' as TranslationKey), description: t('common.toast.redefinedSuccess.description' as TranslationKey) });
      addDebugLog({ source: 'useRefactorProjectForm', type: 'SUCCESS', message: `'campo de enfoque' redefinido. Nuevo (inicio): ${resultOutput.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      addDebugLog({ source: 'useRefactorProjectForm', type: 'ERROR', message: `Fallo al redefinir 'campo de enfoque'.`, errorDetails: e.originalError || e, friendlyMessage: (e as AppError).friendlyMessage });
      const errorMsg = e instanceof AppError ? e.friendlyMessage : ((e as Error).message || t('common.toast.redefineError.description' as TranslationKey));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title' as TranslationKey), description: errorMsg });
      if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningFocusArea(false);
    }
  }, [focusArea, setFocusArea, addDebugLog, t, toast, router]);

  const getFormDataForAnalysis = useCallback((): Partial<RefactorProjectFormData> => ({
    projectSourceType,
    uploadedFile,
    uploadedFileName,
    gitUrl,
    refactorGoals,
    generalPriority,
    searchDepth,
    focusArea,
  }), [projectSourceType, uploadedFile, uploadedFileName, gitUrl, refactorGoals, generalPriority, searchDepth, focusArea]);

  return {
    projectSourceType, setProjectSourceType,
    uploadedFile, uploadedFileName, handleFileChange, fileInputRef,
    gitUrl, setGitUrl,
    refactorGoals, setRefactorGoals,
    generalPriority, setGeneralPriority,
    searchDepth, setSearchDepth,
    focusArea, setFocusArea,
    isRedefiningGoals, handleRedefineGoals,
    isRedefiningFocusArea, handleRedefineFocusArea,
    getFormDataForAnalysis,
  };
}
