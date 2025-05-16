
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
import { Upload, Download, Save, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import { getModelsForProvider } from '@/lib/utils';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getGroqModels } from './actions'; // Asegúrate que esta ruta es correcta

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
  // In a real scenario, this would make an API call or use a Genkit flow.
  console.info("Testing LLM Connection with:", config);
  // Simulate API call
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000));
};

/**
 * Mock function to simulate testing Git connection.
 * @param {GitSettings} config - The Git configuration to test.
 * @returns {Promise<boolean>} True if connection is successful, false otherwise.
 */
const testGitConnection = async (config: GitSettings): Promise<boolean> => {
  // In a real scenario, this could use a Server Action calling 'simple-git'
  console.info("Testing Git Connection with:", config);
  // Simulate API call or Git operation
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

  // Local state for form fields, initialized from global settings
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

  // Effect to sync local form state when global settings change (e.g., due to import or context update)
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
      setAvailableModels(getModelsForProvider("Groq")); // Fallback to static list
      previousApiKeyRef.current = null;
      return;
    }

    if (apiKey === previousApiKeyRef.current && groqModels.length > 0) {
      addLog({ source: 'ConfiguracionPage', type: 'DEBUG', message: 'Usando modelos Groq cacheados para la API key actual.' });
      setAvailableModels(groqModels); // Ensure availableModels is updated if it was stale
      return;
    }

    setIsLoadingGroqModels(true);
    addLog({ source: 'ConfiguracionPage', type: 'INFO', message: `[CLIENT] Obteniendo modelos de Groq para API key: ${apiKey.substring(0, 5)}...` });
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
         if (result.error && result.models?.length === 0) { // If success is true but there's an error message from fallback
            toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error });
        }

      } else { // result.success is false
        setGroqModels([]);
        setAvailableModels(getModelsForProvider("Groq")); // Fallback to static
        previousApiKeyRef.current = null; 
        toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error || t('common.unknownError') });
        if(result.debug) console.error('[CLIENT] Debug info de Server Action (getGroqModels):', result.debug);
        addLog({ source: 'ConfiguracionPage', type: 'ERROR', message: `[CLIENT] Fallo Server Action getGroqModels: ${result.error}`, data: result.debug });
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
      if (!isLoadingGroqModels) { // Prevent multiple calls if one is in progress
        fetchAndSetGroqModels(currentLLMConfig.apiKey);
      }
    } else if (currentLLMConfig.provider !== "Groq") {
      setGroqModels([]); 
      previousApiKeyRef.current = null;
      setAvailableModels(getModelsForProvider(currentLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLLMConfig.provider, currentLLMConfig.apiKey]);

  /**
   * Handles changes in the LLM configuration form fields.
   * @param {keyof LLMSettings} field - The LLM setting field being changed.
   * @param {string | LLMProvider} value - The new value for the field.
   */
  const handleLLMConfigChange = (field: keyof LLMSettings, value: string | LLMProvider) => {
    setCurrentLLMConfig(prevConfig => {
      const newConfig = { ...prevConfig, [field]: value };

      if (field === 'provider') {
        const newProvider = value as LLMProvider;
        newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || ""; 
        
        if (newProvider !== "Groq") {
          const modelsForNewProvider = getModelsForProvider(newProvider);
          setAvailableModels(modelsForNewProvider); 
          setGroqModels([]); // Clear Groq models if switching away from Groq
          previousApiKeyRef.current = null;
          if (!modelsForNewProvider.includes(newConfig.model) || !newConfig.model) {
            newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
          }
        } else {
           // For Groq, models will be fetched by the useEffect or fetchAndSetGroqModels directly
           // Set availableModels to static list initially or if API key is not present
           if (newConfig.apiKey) {
             fetchAndSetGroqModels(newConfig.apiKey); // This will set availableModels upon completion
           } else {
             setAvailableModels(getModelsForProvider("Groq"));
             setGroqModels([]);
           }
        }
      }
      return newConfig;
    });
  };

  /**
   * Handles changes in the Git configuration form fields.
   * @param {keyof GitSettings} field - The Git setting field being changed.
   * @param {string} value - The new value for the field.
   */
  const handleGitConfigChange = (field: keyof GitSettings, value: string) => {
    setCurrentGitConfig({ ...currentGitConfig, [field]: value });
  };

  /**
   * Handles changes to the debug mode switch.
   * @param {boolean} checked - The new state of the debug mode switch.
   */
  const handleDebugModeChange = (checked: boolean) => {
    setCurrentDebugMode(checked);
  };

  /**
   * Saves all current form settings to the global application state and localStorage.
   */
  const handleSaveSettings = () => {
    updateLLMConfig(currentLLMConfig);
    updateGitConfig(currentGitConfig);
    updateSettings({ debugMode: currentDebugMode }); // Language is updated via I18nContext
    setContextDebugMode(currentDebugMode); 

    toast({ title: t('settings.toast.saved.title'), description: t('settings.toast.saved.description') });
    addLog({source: "ConfiguracionPage", type: "INFO", message:"Configuration saved."});
  };

  /**
   * Handles changes to the application language selection.
   * Updates the language in the I18nContext, which in turn updates AppState.
   * @param {LanguageCode} langCode - The selected language code.
   */
  const handleLanguageChange = (langCode: LanguageCode) => {
    setI18nLanguage(langCode); 
    // updateAppLanguage(langCode); // This is now handled by I18nProvider's setLanguage
    const langName = supportedLanguages.find(l => l.code === langCode)?.name || langCode.toUpperCase();
    toast({ title: t('settings.toast.languageChanged.title'), description: t('settings.toast.languageChanged.description', { langName }) });
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Language changed to: ${langCode}`});
  };


  /**
   * Tests the LLM connection with the current LLM configuration.
   * Displays a toast notification with the result.
   */
  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Attempting LLM connection test for provider: ${currentLLMConfig.provider}`});
    const success = await testLLMConnection(currentLLMConfig); // This is a mock
    if (success) {
      toast({ title: t('settings.toast.llmConnectionSuccess.title'), description: t('settings.toast.llmConnectionSuccess.description') });
      addLog({source: "ConfiguracionPage", type: "SUCCESS", message:"LLM connection test successful."});
    } else {
      toast({ variant: "destructive", title: t('settings.toast.llmConnectionError.title'), description: t('settings.toast.llmConnectionError.description') });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:"LLM connection test failed."});
    }
    setIsTestingLLM(false);
  };

  /**
   * Tests the Git connection with the current Git configuration.
   * Displays a toast notification with the result.
   */
  const handleTestGit = async () => {
    setIsTestingGit(true);
    addLog({source: "ConfiguracionPage", type: "INFO", message:`Attempting Git connection test for repo: ${currentGitConfig.repoUrl}`});
    const success = await testGitConnection(currentGitConfig); // This is a mock
    if (success) {
      toast({ title: t('settings.toast.gitConnectionSuccess.title'), description: t('settings.toast.gitConnectionSuccess.description') });
      addLog({source: "ConfiguracionPage", type: "SUCCESS", message:"Git connection test successful."});
    } else {
      toast({ variant: "destructive", title: t('settings.toast.gitConnectionError.title'), description: t('settings.toast.gitConnectionError.description') });
      addLog({source: "ConfiguracionPage", type: "ERROR", message:"Git connection test failed."});
    }
    setIsTestingGit(false);
  };

  // Effect to ensure debug context is updated if settings.debugMode changes (e.g., from localStorage on load)
  useEffect(() => {
    setContextDebugMode(settings.debugMode);
  }, [settings.debugMode, setContextDebugMode]);

  /**
   * Exports the current application settings (LLM, Git, Debug Mode, Language) to a JSON file.
   */
  const handleExportConfig = () => {
    try {
      const configToExport: AppSettings = {
        llmConfig: currentLLMConfig, // Use current form state for export
        gitConfig: currentGitConfig,
        debugMode: currentDebugMode,
        language: i18nLanguage, // Use current i18n language for export
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

  /**
   * Handles the import of application settings from a JSON file.
   * Updates the global application state and persists the new settings.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
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
            setI18nLanguage(importedSettings.language); // This will update AppState via I18nContext
            updateSettings({ debugMode: importedSettings.debugMode }); // Update other settings
            
            // Update local form state to reflect imported settings immediately
            setCurrentLLMConfig(importedSettings.llmConfig);
            setCurrentGitConfig(importedSettings.gitConfig);
            setCurrentDebugMode(importedSettings.debugMode);
            // The useEffect for currentLLMConfig.provider will handle fetching Groq models if needed

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
              <Label htmlFor="llm-model" className="flex items-center">
                {t('settings.llm.modelNameLabel')}
                {currentLLMConfig.provider === "Groq" && isLoadingGroqModels && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              </Label>
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

        {/* Git Settings Section */}
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
              {isTestingGit ? t('settings.git.testingConnectionButton') : t('settings.git.testConnectionButton')}
            </Button>
          </CardFooter>
        </Card>

        <Separator />

        {/* Language Settings Section */}
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

        {/* Debug Mode Section */}
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
