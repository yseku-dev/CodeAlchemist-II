
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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
import type { LLMSettings, GitSettings, LLMProvider, AppSettings } from '@/types';
import { Upload, Download, Save, Settings as SettingsIcon, Loader2 } from 'lucide-react';

/**
 * @fileOverview Page component for application configuration.
 * Allows users to configure LLM providers, Git settings, and debug mode.
 * Settings are persisted to localStorage.
 */

/**
 * Mock function to simulate testing LLM connection.
 * In a real application, this would make an API call to the LLM provider.
 * @param {LLMSettings} config - The LLM configuration to test.
 * @returns {Promise<boolean>} True if connection is successful, false otherwise.
 */
const testLLMConnection = async (config: LLMSettings): Promise<boolean> => {
  console.log("Testing LLM Connection with:", config);
  // Simulate API call success/failure
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000)); 
};

/**
 * Mock function to simulate testing Git connection.
 * In a real application, this would attempt to interact with the Git repository.
 * @param {GitSettings} config - The Git configuration to test.
 * @returns {Promise<boolean>} True if connection is successful, false otherwise.
 */
const testGitConnection = async (config: GitSettings): Promise<boolean> => {
  console.log("Testing Git Connection with:", config);
  // Simulate API call success/failure
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000));
};

/**
 * Retrieves a list of common model names for a given LLM provider.
 * This list might not be exhaustive and users can often type custom model names.
 * @param {LLMProvider} provider - The LLM provider.
 * @returns {string[]} An array of model names.
 */
const getModelsForProvider = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "Groq": return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    case "OpenAI": return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro", "gemini-1.5-flash-latest"]; // Added flash
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model LM Studio (escribir nombre)", "Llama3-LMStudio", "Mistral-LMStudio"]; // Examples
    case "Ollama": return ["llama3", "mistral", "codellama", "phi3"]; // Examples
    default: return [];
  }
};

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const { setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings } = useAppState();

  /** State for the current LLM configuration being edited. */
  const [currentLLMConfig, setCurrentLLMConfig] = useState<LLMSettings>(settings.llmConfig);
  /** State for the current Git configuration being edited. */
  const [currentGitConfig, setCurrentGitConfig] = useState<GitSettings>(settings.gitConfig);
  /** State for the current debug mode setting being edited. */
  const [currentDebugMode, setCurrentDebugMode] = useState<boolean>(settings.debugMode);
  
  /** State to indicate if LLM connection test is in progress. */
  const [isTestingLLM, setIsTestingLLM] = useState(false);
  /** State to indicate if Git connection test is in progress. */
  const [isTestingGit, setIsTestingGit] = useState(false);

  /** State for the list of available models based on the selected LLM provider. */
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  /** Ref for the hidden file input used for importing configurations. */
  const importConfigInputRef = useRef<HTMLInputElement>(null);

  /** Effect to synchronize local component state with global AppState settings. */
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

  /**
   * Handles changes to the LLM configuration form fields.
   * @param {keyof LLMSettings} field - The LLM setting field being changed.
   * @param {string | LLMProvider} value - The new value for the field.
   */
  const handleLLMConfigChange = (field: keyof LLMSettings, value: string | LLMProvider) => {
    const newConfig = { ...currentLLMConfig, [field]: value };
    
    if (field === 'provider') {
      const newProvider = value as LLMProvider;
      newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || "";
      const modelsForNewProvider = getModelsForProvider(newProvider);
      setAvailableModels(modelsForNewProvider);
      
      // If current model is not in the new provider's list, or no model is set, select the first available or empty.
      if (!modelsForNewProvider.includes(newConfig.model) || !newConfig.model) {
         newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
      }
    }
    setCurrentLLMConfig(newConfig);
  };

  /**
   * Handles changes to the Git configuration form fields.
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
   * Saves all current configuration settings to AppState and localStorage.
   */
  const handleSaveSettings = () => {
    updateLLMConfig(currentLLMConfig);
    updateGitConfig(currentGitConfig);
    updateSettings({ debugMode: currentDebugMode }); 
    setContextDebugMode(currentDebugMode); 

    toast({ title: "Configuración Guardada", description: "Tus ajustes han sido guardados localmente." });
    addLog("Configuration saved.");
  };

  /**
   * Tests the connection to the configured LLM provider.
   */
  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    addLog(`Attempting LLM connection test for provider: ${currentLLMConfig.provider}`);
    const success = await testLLMConnection(currentLLMConfig);
    if (success) {
      toast({ title: "Conexión Exitosa", description: "La conexión con el proveedor LLM funciona." });
      addLog("LLM connection test successful.");
    } else {
      toast({ variant: "destructive", title: "Conexión Fallida", description: "No se pudo conectar con el proveedor LLM. Revisa la configuración." });
      addLog("LLM connection test failed.");
    }
    setIsTestingLLM(false);
  };

  /**
   * Tests the connection to the configured Git repository.
   */
  const handleTestGit = async () => {
    setIsTestingGit(true);
    addLog(`Attempting Git connection test for repo: ${currentGitConfig.repoUrl}`);
    const success = await testGitConnection(currentGitConfig);
    if (success) {
      toast({ title: "Conexión Git Exitosa", description: "La conexión con el repositorio Git funciona." });
      addLog("Git connection test successful.");
    } else {
      toast({ variant: "destructive", title: "Conexión Git Fallida", description: "No se pudo conectar con el repositorio Git. Revisa la URL y las credenciales." });
      addLog("Git connection test failed.");
    }
    setIsTestingGit(false);
  };
  
  /** Effect to ensure DebugContext is updated if global debugMode changes. */
  useEffect(() => { 
    setContextDebugMode(settings.debugMode);
  }, [settings.debugMode, setContextDebugMode]);

  /**
   * Handles the export of the current application configuration to a JSON file.
   */
  const handleExportConfig = () => {
    try {
      const configToExport: AppSettings = {
        llmConfig: currentLLMConfig,
        gitConfig: currentGitConfig,
        debugMode: currentDebugMode,
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
      toast({ title: "Configuración Exportada", description: "La configuración actual ha sido exportada." });
      addLog("Configuration exported.");
    } catch (error) {
      toast({ variant: "destructive", title: "Error de Exportación", description: "No se pudo exportar la configuración." });
      addLog(`Configuration export failed: ${error}`);
    }
  };

  /**
   * Handles the import of application configuration from a JSON file.
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

          // Basic validation for the structure of AppSettings
          if (
            parsedConfig &&
            typeof parsedConfig === 'object' &&
            'llmConfig' in parsedConfig && typeof parsedConfig.llmConfig === 'object' && parsedConfig.llmConfig !== null && 'provider' in parsedConfig.llmConfig &&
            'gitConfig' in parsedConfig && typeof parsedConfig.gitConfig === 'object' && parsedConfig.gitConfig !== null &&
            'debugMode' in parsedConfig && typeof parsedConfig.debugMode === 'boolean'
          ) {
            const importedSettings = parsedConfig as AppSettings;
            
            // Update AppState directly, which also persists to localStorage via useLocalStorage
            updateLLMConfig(importedSettings.llmConfig);
            updateGitConfig(importedSettings.gitConfig);
            updateSettings({ debugMode: importedSettings.debugMode }); 
            setContextDebugMode(importedSettings.debugMode); // Update DebugContext directly

            // Local form states will be updated by the useEffect watching `settings`
            toast({ title: "Configuración Importada", description: "La configuración ha sido importada y aplicada." });
            addLog("Configuration imported and applied.");
          } else {
            throw new Error("Formato de archivo de configuración inválido.");
          }
        } catch (err: any) {
          toast({ variant: "destructive", title: "Error de Importación", description: err.message || "No se pudo importar el archivo de configuración." });
          addLog(`Configuration import failed: ${err.message}`);
        } finally {
          if (importConfigInputRef.current) {
            importConfigInputRef.current.value = ""; // Reset file input to allow re-importing the same file
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-3">
            <SettingsIcon className="h-7 w-7 text-primary" />
            <span>Configuración General</span>
          </CardTitle>
          <CardDescription>Ajusta los parámetros globales de la aplicación y gestiona tu configuración.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <Input type="file" id="import-config-input" ref={importConfigInputRef} className="hidden" onChange={handleImportConfig} accept=".json" />
          <Button variant="outline" onClick={() => importConfigInputRef.current?.click()} className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" onClick={handleExportConfig} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button onClick={handleSaveSettings} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" /> Guardar Configuración
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Configuración del Proveedor LLM</CardTitle>
            <CardDescription>Ajusta la configuración global para la interacción con Modelos de Lenguaje Grandes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">Proveedor LLM</Label>
              <Select
                value={currentLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider}
                onValueChange={(value) => handleLLMConfigChange('provider', value as LLMProvider)}
              >
                <SelectTrigger id="llm-provider">
                  <SelectValue placeholder="Selecciona un proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map(provider => (
                    <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm-api-url">URL del Endpoint de API</Label>
              <Input
                id="llm-api-url"
                value={currentLLMConfig.apiUrl || ''}
                onChange={(e) => handleLLMConfigChange('apiUrl', e.target.value)}
                placeholder="Ej: https://api.openai.com/v1"
              />
              <p className="text-xs text-muted-foreground">
                Se auto-rellena al cambiar de proveedor. Modifícala si usas un proxy o un endpoint no estándar.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="llm-api-key">Clave API</Label>
              <Input
                id="llm-api-key"
                type="password"
                value={currentLLMConfig.apiKey || ''}
                onChange={(e) => handleLLMConfigChange('apiKey', e.target.value)}
                placeholder="Introduce tu clave API (si es requerida)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="llm-model">Nombre del Modelo</Label>
              <Select
                value={currentLLMConfig.model || ''}
                onValueChange={(value) => handleLLMConfigChange('model', value)}
                disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider)}
              >
                <SelectTrigger id="llm-model">
                  <SelectValue placeholder={
                    ["Google Gemini", "LM Studio", "Ollama"].includes(currentLLMConfig.provider) && availableModels.length === 0 
                    ? `Selecciona o escribe un modelo (ej: ${currentLLMConfig.provider === "Google Gemini" ? "gemini-1.5-pro-latest" : "nombre-modelo-local"})`
                    : availableModels.length === 0 
                    ? "Selecciona un proveedor primero" 
                    : "Selecciona un modelo"
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
                      Para {currentLLMConfig.provider}, los modelos comunes se listan aquí pero también puedes escribir uno directamente si no aparece.
                  </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTestLLM} disabled={isTestingLLM}>
              {isTestingLLM ? <Loader2 className="animate-spin" /> : null}
              {isTestingLLM ? "Probando..." : "Probar Conexión LLM"}
            </Button>
          </CardFooter>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Configuración de Git (Opcional)</CardTitle>
            <CardDescription>Configura los detalles para funcionalidades que interactúan con repositorios Git.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="git-repo-url">URL del Repositorio Git</Label>
              <Input
                id="git-repo-url"
                value={currentGitConfig.repoUrl || ''}
                onChange={(e) => handleGitConfigChange('repoUrl', e.target.value)}
                placeholder="Ej: https://github.com/usuario/repo.git"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="git-username">Nombre de Usuario Git</Label>
                <Input
                  id="git-username"
                  value={currentGitConfig.username || ''}
                  onChange={(e) => handleGitConfigChange('username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git-email">Email de Git</Label>
                <Input
                  id="git-email"
                  type="email"
                  value={currentGitConfig.email || ''}
                  onChange={(e) => handleGitConfigChange('email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-pat">Token de Acceso Personal (PAT)</Label>
              <Input
                id="git-pat"
                type="password"
                value={currentGitConfig.pat || ''}
                onChange={(e) => handleGitConfigChange('pat', e.target.value)}
                placeholder="Introduce tu PAT de Git"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTestGit} disabled={isTestingGit}>
              {isTestingGit ? <Loader2 className="animate-spin" /> : null}
              {isTestingGit ? "Probando..." : "Probar Conexión Git"}
            </Button>
          </CardFooter>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Modo Depuración</CardTitle>
            <CardDescription>Activa un panel de logs detallados en la parte inferior de la aplicación.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="debug-mode"
                checked={currentDebugMode}
                onCheckedChange={handleDebugModeChange}
              />
              <Label htmlFor="debug-mode">Activar modo Debug</Label>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
