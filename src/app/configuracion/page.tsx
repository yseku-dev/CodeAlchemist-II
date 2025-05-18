
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import { useDebug } from '@/context/DebugContext';
import { useAppState } from '@/context/AppStateContext';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS, APP_NAME } from '@/lib/constants';
import type { LLMSettings, GitSettings, LLMProvider, AppSettings, LanguageCode } from '@/types';
import { Upload, Download, Save, Settings as SettingsIcon, Loader2, Info } from 'lucide-react';
import { getModelsForProvider } from '@/lib/utils';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getGroqModels } from './actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


/**
 * @fileOverview Page component for application configuration.
 * Allows users to configure LLM providers, Git settings, debug mode, and application language.
 * Settings are persisted to localStorage.
 * Provides functionality to import and export application settings.
 * Internationalized using useI18n.
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
export default function ConfiguracionPage(): JSX.Element {
  const { toast } = useToast();
  const { setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings, updateLanguage: updateAppLanguage } = useAppState();
  const { t, language: i18nLanguage, setLanguage: setI18nLanguage, supportedLanguages } = useI18n();

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

  useEffect(() => {
    setCurrentLLMConfig(settings.llmConfig);
    setCurrentGitConfig(settings.gitConfig);
    setCurrentDebugMode(settings.debugMode);
    
    if (settings.llmConfig.provider === "Groq" && settings.llmConfig.apiKey && groqModels.length > 0) {
      setAvailableModels(groqModels);
    } else if (settings.llmConfig.provider) {
      setAvailableModels(getModelsForProvider(settings.llmConfig.provider));
    } else {
      setAvailableModels(getModelsForProvider(DEFAULT_LLM_SETTINGS.provider));
    }
  }, [settings, groqModels]);


  const fetchAndSetGroqModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setGroqModels([]);
      setAvailableModels(getModelsForProvider("Groq"));
      previousApiKeyRef.current = null;
      return;
    }

    if (apiKey === previousApiKeyRef.current && groqModels.length > 0) {
      addLog({ source: 'ConfiguracionPage', type: 'DEBUG', message: 'Usando modelos Groq cacheados para la API key actual.' });
      setAvailableModels(groqModels);
      return;
    }

    setIsLoadingGroqModels(true);
    addLog({ source: 'ConfiguracionPage', type: 'INFO', message: `[CLIENT] Obteniendo modelos de Groq para API key (parcial): ${apiKey.substring(0, 5)}...` });
    toast({ title: t('settings.llm.testingConnectionButton'), description: `${t('settings.llm.providerLabel')}: Groq` });

    try {
      const result = await getGroqModels(apiKey);
      addLog({ source: 'ConfiguracionPage', type: 'DEBUG', message: '[CLIENT] Resultado completo de Server Action (getGroqModels):', data: result });
      console.log('[CLIENT] Resultado de la Server Action (getGroqModels):', result);


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
         if (result.error && result.models?.length === 0) {
            toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error });
        }

      } else {
        setGroqModels([]);
        setAvailableModels(getModelsForProvider("Groq"));
        previousApiKeyRef.current = null; 
        const errorMsg = result.error || t('common.unknownError');
        toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: errorMsg });
        if(result.debug) {
          console.error('[CLIENT] Debug info de Server Action (getGroqModels):', result.debug);
          addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Fallo Server Action getGroqModels: ${errorMsg}`, data: result.debug });
        } else {
          addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Fallo Server Action getGroqModels: ${errorMsg}` });
        }
      }
    } catch (error: any) {
      setGroqModels([]);
      setAvailableModels(getModelsForProvider("Groq"));
      previousApiKeyRef.current = null;
      const errorMsg = error.message || t('common.unknownError');
      toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: errorMsg });
      addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Error al llamar a getGroqModels: ${errorMsg}`, data: error });
    } finally {
      setIsLoadingGroqModels(false);
    }
  }, [t, toast, addLog, currentLLMConfig.provider, currentLLMConfig.model, groqModels]);


  useEffect(() => {
    if (currentLLMConfig.provider === "Groq" && currentLLMConfig.apiKey) {
      if (!isLoadingGroqModels) {
        fetchAndSetGroqModels(currentLLMConfig.apiKey);
      }
    } else if (currentLLMConfig.provider !== "Groq") {
      setGroqModels([]); 
      previousApiKeyRef.current = null;
      setAvailableModels(getModelsForProvider(currentLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider));
    }
  }, [currentLLMConfig.provider, currentLLMConfig.apiKey, fetchAndSetGroqModels, isLoadingGroqModels]);

  const handleLLMConfigChange = useCallback((field: keyof LLMSettings, value: string | LLMProvider) => {
    setCurrentLLMConfig(prevConfig => {
      const newConfig = { ...prevConfig, [field]: value };

      if (field === 'provider') {
        const newProvider = value as LLMProvider;
        newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || ""; 
        
        if (newProvider !== "Groq") {
          const modelsForNewProvider = getModelsForProvider(newProvider);
          setAvailableModels(modelsForNewProvider); 
          setGroqModels([]);
          previousApiKeyRef.current = null;
          if (!modelsForNewProvider.includes(newConfig.model || '')) {
            newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
          }
        } else {
           if (newConfig.apiKey) {
             // fetchAndSetGroqModels will be called by the useEffect dependent on apiKey and provider
           } else {
             setAvailableModels(getModelsForProvider("Groq"));
             setGroqModels([]);
           }
        }
      }
      return newConfig;
    });
  }, []);

  const handleGitConfigChange = (field: keyof GitSettings, value: string) => {
    setCurrentGitConfig({ ...currentGitConfig, [field]: value });
  };

  const handleDebugModeChange = (checked: boolean) => {
    setCurrentDebugMode(checked);
  };

  const handleSaveSettings = () => {
    updateLLMConfig(currentLLMConfig);
    updateGitConfig(currentGitConfig);
    // Language is updated via I18nContext, but ensure it's part of the main settings save
    updateSettings({ debugMode: currentDebugMode, language: i18nLanguage }); 
    setContextDebugMode(currentDebugMode); 

    toast({ title: t('settings.toast.saved.title'), description: t('settings.toast.saved.description') });
    addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration saved."});
  };

  const handleLanguageChange = (langCode: LanguageCode) => {
    setI18nLanguage(langCode); 
    const langName = supportedLanguages.find(l => l.code === langCode)?.name || langCode.toUpperCase();
    toast({ title: t('settings.toast.languageChanged.title'), description: t('settings.toast.languageChanged.description', { langName }) });
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Language changed to: ${langCode}`});
  };


  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Attempting LLM connection test for provider: ${currentLLMConfig.provider}`});
    const success = await testLLMConnection(currentLLMConfig);
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
    const success = await testGitConnection(currentGitConfig);
    if (success) {
      toast({ title: t('settings.toast.gitConnectionSuccess.title'), description: t('settings.toast.gitConnectionSuccess.description') });
      addLog({source: "ConfiguracionPage", type: "SUCCESS", message:"Git connection test successful."});
    } else {
      toast({ variant: "destructive", title: t('settings.toast.gitConnectionError.title'), description: t('settings.toast.gitConnectionError.description') });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:"Git connection test failed."});
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
            setI18nLanguage(importedSettings.language);
            updateSettings({ debugMode: importedSettings.debugMode, language: importedSettings.language }); 
            
            setCurrentLLMConfig(importedSettings.llmConfig);
            setCurrentGitConfig(importedSettings.gitConfig);
            setCurrentDebugMode(importedSettings.debugMode);
            
            toast({ title: t('settings.toast.configImported.title'), description: t('settings.toast.configImported.description') });
            addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration imported and applied."});
          } else {
            throw new Error(t('settings.toast.configImportError.invalidFormat'));
          }
        } catch (err: any) {
          const errorDesc = err.message || t('settings.toast.configImportError.readError');
          toast({ variant: "destructive", title: t('settings.toast.configImportError.title'), description: errorDesc });
          addLog({source: "ConfiguracionPage", type: "ERROR", message:`Configuration import failed: ${errorDesc}`});
        } finally {
          if (importConfigInputRef.current) {
            importConfigInputRef.current.value = "";
          }
        }
      };
      reader.readAsText(file);
    }
  };

  /**
   * A small helper component to render a Label with an associated Tooltip.
   * @param {object} props - Component props.
   * @param {TranslationKey} props.labelKey - The translation key for the label text.
   * @param {TranslationKey} props.tooltipKey - The translation key for the tooltip content.
   * @param {string} props.htmlFor - The `htmlFor` attribute for the label.
   * @returns {JSX.Element} The rendered label and tooltip.
   */
  const FieldLabelWithTooltip = ({ labelKey, tooltipKey, htmlFor }: { labelKey: TranslationKey, tooltipKey: TranslationKey, htmlFor: string }) => (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{t(labelKey)}</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="max-w-xs">{t(tooltipKey)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );


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
              <Upload className="mr-2 h-4 w-4" />{t('settings.importButton')}
            </Button>
            <Button variant="outline" onClick={handleExportConfig}>
              <Download className="mr-2 h-4 w-4" />{t('settings.exportButton')}
            </Button>
            <Button onClick={handleSaveSettings}>
              <Save className="mr-2 h-4 w-4" />{t('settings.saveButton')}
            </Button>
          </div>
        }
      />
      <CardContent className="pt-6 space-y-8">
        {/* LLM Settings Section */}
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
              <FieldLabelWithTooltip htmlFor="llm-api-url" labelKey="settings.llm.apiUrlLabel" tooltipKey="settings.llm.apiUrlTooltip" />
              <Input
                id="llm-api-url"
                value={currentLLMConfig.apiUrl || ''}
                onChange={(e) => handleLLMConfigChange('apiUrl', e.target.value)}
                placeholder={LLM_PROVIDER_DEFAULT_API_URLS[currentLLMConfig.provider as LLMProvider] || t('settings.llm.apiUrlPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.llm.apiUrlDescription')}
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabelWithTooltip htmlFor="llm-api-key" labelKey="settings.llm.apiKeyLabel" tooltipKey="settings.llm.apiKeyTooltip" />
              <Input
                id="llm-api-key"
                type="password"
                value={currentLLMConfig.apiKey || ''}
                onChange={(e) => handleLLMConfigChange('apiKey', e.target.value)}
                placeholder={t('settings.llm.apiKeyPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                 <FieldLabelWithTooltip htmlFor="llm-model" labelKey="settings.llm.modelNameLabel" tooltipKey="settings.llm.modelNameTooltip" />
                {currentLLMConfig.provider === "Groq" && isLoadingGroqModels && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Select
                value={currentLLMConfig.model || ''}
                onValueChange={(value) => handleLLMConfigChange('model', value)}
                disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider)}
              >
                <SelectTrigger id="llm-model">
                  <SelectValue placeholder={
                    (["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider))
                    ? t('settings.llm.modelNamePlaceholderLocal', {provider: currentLLMConfig.provider})
                    : availableModels.length === 0 && !(currentLLMConfig.provider === "Groq" && isLoadingGroqModels)
                    ? t('settings.llm.modelNamePlaceholderDefault')
                    : t('settings.llm.modelNamePlaceholder')
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                   {(currentLLMConfig.provider === "Groq" && isLoadingGroqModels && availableModels.length === 0) && (
                    <div className="p-2 text-center text-xs text-muted-foreground"> {t('common.loading')} </div>
                  )}
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
              {isTestingLLM ? t('settings.llm.testingConnectionButton') : t('settings.llm.testConnectionButton')}
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
              <FieldLabelWithTooltip htmlFor="git-repo-url" labelKey="settings.git.repoUrlLabel" tooltipKey="settings.git.repoUrlTooltip" />
              <Input
                id="git-repo-url"
                value={currentGitConfig.repoUrl || ''}
                onChange={(e) => handleGitConfigChange('repoUrl', e.target.value)}
                placeholder={t('settings.git.repoUrlPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabelWithTooltip htmlFor="git-username" labelKey="settings.git.usernameLabel" tooltipKey="settings.git.usernameTooltip" />
                <Input
                  id="git-username"
                  value={currentGitConfig.username || ''}
                  onChange={(e) => handleGitConfigChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <FieldLabelWithTooltip htmlFor="git-email" labelKey="settings.git.emailLabel" tooltipKey="settings.git.emailTooltip" />
                <Input
                  id="git-email"
                  type="email"
                  value={currentGitConfig.email || ''}
                  onChange={(e) => handleGitConfigChange('email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <FieldLabelWithTooltip htmlFor="git-pat" labelKey="settings.git.patLabel" tooltipKey="settings.git.patTooltip" />
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
              {isTestingGit ? t('settings.git.testingConnectionButton') : t('settings.git.testConnectionButton')}
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
