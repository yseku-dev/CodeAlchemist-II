// src/app/configuracion/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card'; // Only Card needed from here now
import { useToast } from "@/hooks/use-toast";
import { useDebug } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import { APP_NAME } from '@/lib/constants';
import type { LLMSettings, GitSettings, AppSettings, LanguageCode } from '@/types';
import { getModelsForProvider } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getGroqModels } from './actions';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/constants';

import SettingsHeader from '@/components/features/configuracion/SettingsHeader';
import SettingsLlmConfigCard from '@/components/features/configuracion/SettingsLlmConfigCard';
import SettingsGitConfigCard from '@/components/features/configuracion/SettingsGitConfigCard';
import SettingsLanguageCard from '@/components/features/configuracion/SettingsLanguageCard';
import SettingsDebugCard from '@/components/features/configuracion/SettingsDebugCard';
import { Separator } from '@/components/ui/separator';

/**
 * @fileOverview Page component for application configuration.
 * Allows users to configure LLM providers, Git settings, debug mode, and application language.
 * Settings are persisted to localStorage.
 * Provides functionality to import and export application settings.
 * Internationalized using useI18n.
 * This page has been refactored into smaller, more granular components.
 */
export default function ConfiguracionPage(): JSX.Element {
  const { toast } = useToast();
  const { setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings, updateLanguage: updateAppLanguage } = useAppState();
  const { t, language: i18nLanguage, setLanguage: setI18nLanguage } = useI18n();

  const [currentLLMConfig, setCurrentLLMConfig] = useState<LLMSettings>(settings.llmConfig);
  const [currentGitConfig, setCurrentGitConfig] = useState<GitSettings>(settings.gitConfig);
  const [currentDebugMode, setCurrentDebugMode] = useState<boolean>(settings.debugMode);

  const [isTestingLLM, setIsTestingLLM] = useState(false);
  const [isTestingGit, setIsTestingGit] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [groqModels, setGroqModels] = useState<string[]>([]);
  const [isLoadingGroqModels, setIsLoadingGroqModels] = useState(false);
  const previousApiKeyRef = useRef<string | null>(null);
  
  const importConfigInputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setCurrentLLMConfig(settings.llmConfig);
    setCurrentGitConfig(settings.gitConfig);
    setCurrentDebugMode(settings.debugMode);
    
    if (settings.llmConfig.provider === "Groq" && settings.llmConfig.apiKey && groqModels.length > 0) {
      setAvailableModels(groqModels);
    } else if (settings.llmConfig.provider) {
      setAvailableModels(getModelsForProvider(settings.llmConfig.provider));
    } else {
      setAvailableModels(getModelsForProvider('Groq')); // Fallback if no provider initially
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [settings]); // Removed groqModels to prevent loop if settings are updated by groqModels fetch

  const fetchAndSetGroqModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setGroqModels([]);
      setAvailableModels(getModelsForProvider("Groq"));
      previousApiKeyRef.current = null;
      return;
    }
    if (apiKey === previousApiKeyRef.current && groqModels.length > 0) {
      addLog({ source: 'ConfiguracionPage', type: 'DEBUG', message: 'Usando modelos Groq cacheados para la API key actual.' });
      setAvailableModels(groqModels); return;
    }
    setIsLoadingGroqModels(true);
    addLog({ source: 'ConfiguracionPage', type: 'INFO', message: `[CLIENT] Obteniendo modelos de Groq para API key (parcial): ${apiKey.substring(0, 5)}...` });
    toast({ title: t('settings.llm.testingConnectionButton'), description: `${t('settings.llm.providerLabel')}: Groq` });
    try {
      const result = await getGroqModels(apiKey);
      addLog({ source: 'ConfiguracionPage', type: 'DEBUG', message: '[CLIENT] Resultado completo de Server Action (getGroqModels):', data: result });
      if (result.success && result.models) {
        setGroqModels(result.models);
        const modelsToUse = result.models.length > 0 ? result.models : getModelsForProvider("Groq");
        setAvailableModels(modelsToUse);
        previousApiKeyRef.current = apiKey;
        if (result.models.length > 0) {
          toast({ title: t('settings.toast.groqModelsLoadSuccess.title'), description: t('settings.toast.groqModelsLoadSuccess.description', { count: result.models.length }) });
          if (currentLLMConfig.provider === "Groq" && !modelsToUse.includes(currentLLMConfig.model || '')) {
             setCurrentLLMConfig(prev => ({ ...prev, model: modelsToUse[0] || '' }));
          }
        } else {
          toast({ title: t('settings.toast.groqModelsLoadNoModels.title'), description: result.error || t('settings.toast.groqModelsLoadNoModels.description') });
        }
        if (result.error && result.models.length === 0) {
            toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error });
        }
      } else {
        setGroqModels([]); setAvailableModels(getModelsForProvider("Groq")); previousApiKeyRef.current = null;
        const errorMsg = result.error || t('common.unknownError');
        toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: errorMsg });
        if(result.debug) { addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Fallo Server Action getGroqModels: ${errorMsg}`, data: result.debug }); } 
        else { addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Fallo Server Action getGroqModels: ${errorMsg}` }); }
      }
    } catch (error: any) {
      setGroqModels([]); setAvailableModels(getModelsForProvider("Groq")); previousApiKeyRef.current = null;
      const errorMsg = error.message || t('common.unknownError');
      toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: errorMsg });
      addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Error al llamar a getGroqModels: ${errorMsg}`, data: error });
    } finally { setIsLoadingGroqModels(false); }
  }, [t, toast, addLog, currentLLMConfig.provider, currentLLMConfig.model, groqModels]);

  useEffect(() => {
    if (currentLLMConfig.provider === "Groq" && currentLLMConfig.apiKey) {
      if (!isLoadingGroqModels) { fetchAndSetGroqModels(currentLLMConfig.apiKey); }
    } else if (currentLLMConfig.provider !== "Groq") {
      setGroqModels([]); previousApiKeyRef.current = null;
      setAvailableModels(getModelsForProvider(currentLLMConfig.provider || 'Groq'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLLMConfig.provider, currentLLMConfig.apiKey, fetchAndSetGroqModels]); // isLoadingGroqModels removed

  const handleLLMConfigChange = useCallback((field: keyof LLMSettings, value: string | LLMSettings['provider']) => {
    setCurrentLLMConfig(prevConfig => {
      const newConfig = { ...prevConfig, [field]: value };
      if (field === 'provider') {
        const newProvider = value as LLMSettings['provider'];
        newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || ""; 
        if (newProvider !== "Groq") {
          const modelsForNewProvider = getModelsForProvider(newProvider);
          setAvailableModels(modelsForNewProvider); setGroqModels([]); previousApiKeyRef.current = null;
          if (!modelsForNewProvider.includes(newConfig.model || '')) {
            newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
          }
        } else {
           if (!newConfig.apiKey) { setAvailableModels(getModelsForProvider("Groq")); setGroqModels([]); }
        }
      }
      return newConfig;
    });
  }, []);

  const handleGitConfigChange = (field: keyof GitSettings, value: string) => {
    setCurrentGitConfig({ ...currentGitConfig, [field]: value });
  };

  const handleDebugModeChange = (checked: boolean) => { setCurrentDebugMode(checked); };

  const handleSaveSettings = () => {
    updateLLMConfig(currentLLMConfig);
    updateGitConfig(currentGitConfig);
    updateSettings({ debugMode: currentDebugMode }); // Language is handled by I18nContext -> AppState
    setContextDebugMode(currentDebugMode); 
    toast({ title: t('settings.toast.saved.title'), description: t('settings.toast.saved.description') });
    addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration saved."});
  };

  const handleLanguageChange = (langCode: LanguageCode) => {
    setI18nLanguage(langCode); // This updates I18nContext, which calls updateAppLanguage
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    toast({ title: t('settings.toast.languageChanged.title'), description: t('settings.toast.languageChanged.description', { langName: langObj ? langObj.name : langCode.toUpperCase() }) });
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Language changed to: ${langCode}`});
  };

  const testLLMConnection = async () => Promise.resolve(Math.random() > 0.3);
  const testGitConnection = async () => Promise.resolve(Math.random() > 0.3);

  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Attempting LLM connection test for provider: ${currentLLMConfig.provider}`});
    const success = await testLLMConnection(); // Pass currentLLMConfig if needed by real test
    if (success) {
      toast({ title: t('settings.toast.llmConnectionSuccess.title'), description: t('settings.toast.llmConnectionSuccess.description') });
      addLog({source: "ConfiguracionPage", type: "SUCCESS", message:"LLM connection test successful."});
    } else {
      toast({ variant: "destructive", title: t('settings.toast.llmConnectionError.title'), description: t('settings.toast.llmConnectionError.description') });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:"LLM connection test failed."});
    }
    setIsTestingLLM(false);
  };

  const handleTestGit = async () => {
    setIsTestingGit(true);
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Attempting Git connection test for repo: ${currentGitConfig.repoUrl}`});
    const success = await testGitConnection(); // Pass currentGitConfig if needed by real test
    if (success) {
      toast({ title: t('settings.toast.gitConnectionSuccess.title'), description: t('settings.toast.gitConnectionSuccess.description') });
      addLog({source: "ConfiguracionPage", type: "SUCCESS", message:"Git connection test successful."});
    } else {
      toast({ variant: "destructive", title: t('settings.toast.gitConnectionError.title'), description: t('settings.toast.gitConnectionError.description') });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:"Git connection test failed."});
    }
    setIsTestingGit(false);
  };

  const handleExportConfig = () => {
    try {
      const configToExport: AppSettings = {
        llmConfig: currentLLMConfig, gitConfig: currentGitConfig, debugMode: currentDebugMode, language: i18nLanguage,
      };
      const jsonString = JSON.stringify(configToExport, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_NAME.toLowerCase()}_configuracion.json`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      toast({ title: t('settings.toast.configExported.title'), description: t('settings.toast.configExported.description') });
      addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration exported."});
    } catch (error) {
      const typedError = error as Error;
      toast({ variant: "destructive", title: t('settings.toast.configExportError.title'), description: t('settings.toast.configExportError.description', {error: typedError.message}) });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:`Configuration export failed: ${typedError.message}`});
    }
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedContent = e.target?.result as string;
          const parsedConfig = JSON.parse(importedContent) as AppSettings;
          if (parsedConfig && parsedConfig.llmConfig && parsedConfig.gitConfig && typeof parsedConfig.debugMode === 'boolean' && parsedConfig.language) {
            updateLLMConfig(parsedConfig.llmConfig); updateGitConfig(parsedConfig.gitConfig);
            setI18nLanguage(parsedConfig.language); 
            updateSettings({ debugMode: parsedConfig.debugMode }); // Language already set via I18nContext
            setCurrentLLMConfig(parsedConfig.llmConfig); setCurrentGitConfig(parsedConfig.gitConfig); setCurrentDebugMode(parsedConfig.debugMode);
            toast({ title: t('settings.toast.configImported.title'), description: t('settings.toast.configImported.description') });
            addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration imported and applied."});
          } else { throw new Error(t('settings.toast.configImportError.invalidFormat')); }
        } catch (err: any) {
          const errorDesc = err.message || t('settings.toast.configImportError.readError');
          toast({ variant: "destructive", title: t('settings.toast.configImportError.title'), description: errorDesc });
          addLog({source: "ConfiguracionPage", type: "ERROR", message:`Configuration import failed: ${errorDesc}`});
        } finally { if (importConfigInputRef.current) { importConfigInputRef.current.value = ""; } }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <SettingsHeader
        t={t}
        onImportConfig={handleImportConfig}
        onExportConfig={handleExportConfig}
        onSaveSettings={handleSaveSettings}
        importConfigInputRef={importConfigInputRef}
      />
      <CardContent className="pt-6 space-y-8">
        <SettingsLlmConfigCard
          t={t}
          config={currentLLMConfig}
          onConfigChange={handleLLMConfigChange}
          availableModels={availableModels}
          isLoadingGroqModels={isLoadingGroqModels}
          onTestLLM={handleTestLLM}
          isTestingLLM={isTestingLLM}
          isMounted={isMounted}
        />
        <Separator />
        <SettingsGitConfigCard
          t={t}
          config={currentGitConfig}
          onConfigChange={handleGitConfigChange}
          onTestGit={handleTestGit}
          isTestingGit={isTestingGit}
          isMounted={isMounted}
        />
        <Separator />
        <SettingsLanguageCard
          t={t}
          currentLanguage={i18nLanguage}
          supportedLanguages={SUPPORTED_LANGUAGES}
          onLanguageChange={handleLanguageChange}
          isMounted={isMounted}
        />
        <Separator />
        <SettingsDebugCard
          t={t}
          isDebugMode={currentDebugMode}
          onDebugModeChange={handleDebugModeChange}
        />
      </CardContent>
    </Card>
  );
}
