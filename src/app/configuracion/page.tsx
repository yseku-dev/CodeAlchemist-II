"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import { useDebug } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS, APP_NAME } from '@/lib/constants';
import type { LLMSettings, GitSettings, LLMProvider, AppSettings, LanguageCode } from '@/types';
import { Upload, Download, Save, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { getModelsForProvider } from '@/lib/utils';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useI18n } from '@/context/I18nContext';

/**
 * @fileOverview Page component for application configuration.
 * Allows users to configure LLM providers, Git settings, debug mode, and application language.
 * Settings are persisted to localStorage.
 * Provides functionality to import and export application settings.
 */

/**
 * Mock function to simulate testing LLM connection.
 * @param {LLMSettings} config - The LLM configuration to test.
 * @returns {Promise<boolean>} True if connection is successful, false otherwise.
 */
const testLLMConnection = async (config: LLMSettings): Promise<boolean> => {
  console.info("Testing LLM Connection with:", config);
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000)); 
};

/**
 * Mock function to simulate testing Git connection.
 * @param {GitSettings} config - The Git configuration to test.
 * @returns {Promise<boolean>} True if connection is successful, false otherwise.
 */
const testGitConnection = async (config: GitSettings): Promise<boolean> => {
  console.info("Testing Git Connection with:", config);
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000));
};

/**
 * ConfigurationPage component.
 * Handles display and modification of global application settings.
 * @returns {JSX.Element} The rendered configuration page.
 */
export default function ConfiguracionPage() {
  const { toast } = useToast();
  const { setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings } = useAppState();
  const { t, language: i18nLanguage, setLanguage: setI18nLanguage, supportedLanguages } = useI18n();

  const [currentLLMConfig, setCurrentLLMConfig] = useState<LLMSettings>(settings.llmConfig);
  const [currentGitConfig, setCurrentGitConfig] = useState<GitSettings>(settings.gitConfig);
  const [currentDebugMode, setCurrentDebugMode] = useState<boolean>(settings.debugMode);
  
  const [isTestingLLM, setIsTestingLLM] = useState(false);
  const [isTestingGit, setIsTestingGit] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const importConfigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentLLMConfig(settings.llmConfig);
    setCurrentGitConfig(settings.gitConfig);
    setCurrentDebugMode(settings.debugMode);
    if (settings.llmConfig.provider) {
      setAvailableModels(getModelsForProvider(settings.llmConfig.provider));
    } else {
      setAvailableModels(getModelsForProvider(DEFAULT_LLM_SETTINGS.provider));
    }
  }, [settings]);

  const handleLLMConfigChange = (field: keyof LLMSettings, value: string | LLMProvider) => {
    const newConfig = { ...currentLLMConfig, [field]: value };
    
    if (field === 'provider') {
      const newProvider = value as LLMProvider;
      newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || "";
      const modelsForNewProvider = getModelsForProvider(newProvider);
      setAvailableModels(modelsForNewProvider);
      
      if (!modelsForNewProvider.includes(newConfig.model) || !newConfig.model) {
         newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
      }
    }
    setCurrentLLMConfig(newConfig);
  };

  const handleGitConfigChange = (field: keyof GitSettings, value: string) => {
    setCurrentGitConfig({ ...currentGitConfig, [field]: value });
  };

  const handleDebugModeChange = (checked: boolean) => {
    setCurrentDebugMode(checked);
  };

  const handleSaveSettings = () => {
    updateLLMConfig(currentLLMConfig);
    updateGitConfig(currentGitConfig);
    updateSettings({ debugMode: currentDebugMode }); 
    setContextDebugMode(currentDebugMode); 

    toast({ title: t('settings.toast.saved.title'), description: t('settings.toast.saved.description') });
    addLog("Configuration saved.");
  };
  
  const handleLanguageChange = (langCode: LanguageCode) => {
    setI18nLanguage(langCode); 
    const langName = supportedLanguages.find(l => l.code === langCode)?.name || langCode.toUpperCase();
    toast({ title: t('settings.toast.languageChanged.title'), description: t('settings.toast.languageChanged.description', { langName }) });
    addLog(`Language changed to: ${langCode}`);
  };

  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    addLog(`Attempting LLM connection test for provider: ${currentLLMConfig.provider}`);
    const success = await testLLMConnection(currentLLMConfig);
    if (success) {
      toast({ title: t('settings.toast.llmConnectionSuccess.title'), description: t('settings.toast.llmConnectionSuccess.description') });
      addLog("LLM connection test successful.");
    } else {
      toast({ variant: "destructive", title: t('settings.toast.llmConnectionError.title'), description: t('settings.toast.llmConnectionError.description') });
      addLog("LLM connection test failed.");
    }
    setIsTestingLLM(false);
  };

  const handleTestGit = async () => {
    setIsTestingGit(true);
    addLog(`Attempting Git connection test for repo: ${currentGitConfig.repoUrl}`);
    const success = await testGitConnection(currentGitConfig);
    if (success) {
      toast({ title: t('settings.toast.gitConnectionSuccess.title'), description: t('settings.toast.gitConnectionSuccess.description') });
      addLog("Git connection test successful.");
    } else {
      toast({ variant: "destructive", title: t('settings.toast.gitConnectionError.title'), description: t('settings.toast.gitConnectionError.description') });
      addLog("Git connection test failed.");
    }
    setIsTestingGit(false);
  };
  
  useEffect(() => { 
    setContextDebugMode(settings.debugMode);
  }, [settings.debugMode, setContextDebugMode]);

  const handleExportConfig = () => {
    try {
      const configToExport: AppSettings = {
        llmConfig: currentLLMConfig,
        gitConfig: currentGitConfig,
        debugMode: currentDebugMode,
        language: i18nLanguage,
      };
      const jsonString = JSON.stringify(configToExport, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_NAME.toLowerCase()}_configuracion.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: t('settings.toast.configExported.title'), description: t('settings.toast.configExported.description') });
      addLog("Configuration exported.");
    } catch (error) {
      const typedError = error as Error;
      toast({ variant: "destructive", title: t('settings.toast.configExportError.title'), description: t('settings.toast.configExportError.description', {error: typedError.message}) });
      addLog(`Configuration export failed: ${typedError.message}`);
    }
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedContent = e.target?.result as string;
          const parsedConfig = JSON.parse(importedContent);

          if (
            parsedConfig &&
            typeof parsedConfig === 'object' &&
            'llmConfig' in parsedConfig && typeof parsedConfig.llmConfig === 'object' && parsedConfig.llmConfig !== null && 'provider' in parsedConfig.llmConfig &&
            'gitConfig' in parsedConfig && typeof parsedConfig.gitConfig === 'object' && parsedConfig.gitConfig !== null &&
            'debugMode' in parsedConfig && typeof parsedConfig.debugMode === 'boolean' &&
            'language' in parsedConfig && typeof parsedConfig.language === 'string' && supportedLanguages.some(l => l.code === parsedConfig.language)
          ) {
            const importedSettings = parsedConfig as AppSettings;
            
            updateLLMConfig(importedSettings.llmConfig);
            updateGitConfig(importedSettings.gitConfig);
            updateSettings({ debugMode: importedSettings.debugMode }); 
            setI18nLanguage(importedSettings.language); 
            setContextDebugMode(importedSettings.debugMode); 

            toast({ title: t('settings.toast.configImported.title'), description: t('settings.toast.configImported.description') });
            addLog("Configuration imported and applied.");
          } else {
            throw new Error("Formato de archivo de configuración inválido o idioma no soportado.");
          }
        } catch (err: any) {
          const errorDesc = err.message || "No se pudo importar el archivo de configuración.";
          toast({ variant: "destructive", title: t('settings.toast.configImportError.title'), description: t('settings.toast.configImportError.description', {error: errorDesc}) });
          addLog(`Configuration import failed: ${errorDesc}`);
        } finally {
          if (importConfigInputRef.current) {
            importConfigInputRef.current.value = ""; 
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <PageSectionHeader
        icon={SettingsIcon}
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Input type="file" id="import-config-input" ref={importConfigInputRef} className="hidden" onChange={handleImportConfig} accept=".json" />
            <Button variant="outline" onClick={() => importConfigInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> {t('settings.importButton')}
            </Button>
            <Button variant="outline" onClick={handleExportConfig}>
              <Download className="mr-2 h-4 w-4" /> {t('settings.exportButton')}
            </Button>
            <Button onClick={handleSaveSettings}>
              <Save className="mr-2 h-4 w-4" /> {t('settings.saveButton')}
            </Button>
          </div>
        }
      />
      <CardContent className="pt-6 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.llm.title')}</CardTitle>
            <CardDescription>{t('settings.llm.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">{t('settings.llm.providerLabel')}</Label>
              <Select
                value={currentLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider}
                onValueChange={(value) => handleLLMConfigChange('provider', value as LLMProvider)}
              >
                <SelectTrigger id="llm-provider">
                  <SelectValue placeholder={t('settings.llm.providerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map(provider => (
                    <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm-api-url">{t('settings.llm.apiUrlLabel')}</Label>
              <Input
                id="llm-api-url"
                value={currentLLMConfig.apiUrl || ''}
                onChange={(e) => handleLLMConfigChange('apiUrl', e.target.value)}
                placeholder={t('settings.llm.apiUrlPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.llm.apiUrlDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm-api-key">{t('settings.llm.apiKeyLabel')}</Label>
              <Input
                id="llm-api-key"
                type="password"
                value={currentLLMConfig.apiKey || ''}
                onChange={(e) => handleLLMConfigChange('apiKey', e.target.value)}
                placeholder={t('settings.llm.apiKeyPlaceholder')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="llm-model">{t('settings.llm.modelNameLabel')}</Label>
              <Select
                value={currentLLMConfig.model || ''}
                onValueChange={(value) => handleLLMConfigChange('model', value)}
                disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider)}
              >
                <SelectTrigger id="llm-model">
                  <SelectValue placeholder={
                    (["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider))
                    ? t('settings.llm.modelNamePlaceholderLocal', {provider: currentLLMConfig.provider})
                    : availableModels.length === 0 
                    ? t('settings.llm.modelNamePlaceholderDefault') 
                    : t('settings.llm.modelNamePlaceholder')
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider)) && (
                  <p className="text-xs text-muted-foreground">
                      {t('settings.llm.modelNameDescriptionLocal', {provider: currentLLMConfig.provider})}
                  </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTestLLM} disabled={isTestingLLM}>
              {isTestingLLM ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isTestingLLM ? t('settings.llm.testConnectionButton.testing') : t('settings.llm.testConnectionButton')}
            </Button>
          </CardFooter>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.git.title')}</CardTitle>
            <CardDescription>{t('settings.git.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="git-repo-url">{t('settings.git.repoUrlLabel')}</Label>
              <Input
                id="git-repo-url"
                value={currentGitConfig.repoUrl || ''}
                onChange={(e) => handleGitConfigChange('repoUrl', e.target.value)}
                placeholder={t('settings.git.repoUrlPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="git-username">{t('settings.git.usernameLabel')}</Label>
                <Input
                  id="git-username"
                  value={currentGitConfig.username || ''}
                  onChange={(e) => handleGitConfigChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git-email">{t('settings.git.emailLabel')}</Label>
                <Input
                  id="git-email"
                  type="email"
                  value={currentGitConfig.email || ''}
                  onChange={(e) => handleGitConfigChange('email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-pat">{t('settings.git.patLabel')}</Label>
              <Input
                id="git-pat"
                type="password"
                value={currentGitConfig.pat || ''}
                onChange={(e) => handleGitConfigChange('pat', e.target.value)}
                placeholder={t('settings.git.patPlaceholder')}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTestGit} disabled={isTestingGit}>
              {isTestingGit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isTestingGit ? t('settings.git.testConnectionButton.testing') : t('settings.git.testConnectionButton')}
            </Button>
          </CardFooter>
        </Card>

        <Separator />
        
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.language.title')}</CardTitle>
            <CardDescription>{t('settings.language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language-select">{t('settings.language.selectLabel')}</Label>
              <Select
                value={i18nLanguage}
                onValueChange={(value) => handleLanguageChange(value as LanguageCode)}
              >
                <SelectTrigger id="language-select">
                  <SelectValue placeholder={t('settings.language.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.debug.title')}</CardTitle>
            <CardDescription>{t('settings.debug.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="debug-mode"
                checked={currentDebugMode}
                onCheckedChange={handleDebugModeChange}
              />
              <Label htmlFor="debug-mode">{t('settings.debug.switchLabel')}</Label>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}