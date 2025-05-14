
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
import { Upload, Download, Save, Settings as SettingsIcon } from 'lucide-react'; // Added SettingsIcon

// Mock function to simulate API connection tests
const testLLMConnection = async (config: LLMSettings): Promise<boolean> => {
  console.log("Testing LLM Connection with:", config);
  // Simulate API call
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000)); 
};

const testGitConnection = async (config: GitSettings): Promise<boolean> => {
  console.log("Testing Git Connection with:", config);
  // Simulate API call
  return new Promise(resolve => setTimeout(() => resolve(Math.random() > 0.3), 1000));
};

// Placeholder for actual model lists
const getModelsForProvider = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "Groq": return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    case "OpenAI": return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro"];
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model 1", "Local Model 2"]; 
    case "Ollama": return ["llama3", "mistral", "codellama"]; 
    default: return [];
  }
};

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const { setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings } = useAppState();

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


  const handleLLMConfigChange = (field: keyof LLMSettings, value: string) => {
    const newConfig = { ...currentLLMConfig, [field]: value };
    
    if (field === 'provider') {
      const newProvider = value as LLMProvider;
      newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || "";
      setAvailableModels(getModelsForProvider(newProvider));
      
      const modelsForNewProvider = getModelsForProvider(newProvider);
      if (!modelsForNewProvider.includes(newConfig.model) && newConfig.model) {
         newConfig.model = modelsForNewProvider.length > 0 ? modelsForNewProvider[0] : '';
      } else if (!newConfig.model && modelsForNewProvider.length > 0) {
         newConfig.model = modelsForNewProvider[0];
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

    toast({ title: "Configuración Guardada", description: "Tus ajustes han sido guardados localmente." });
    addLog("Configuration saved.");
  };

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
  
  useEffect(() => { 
    setContextDebugMode(settings.debugMode);
  }, [settings.debugMode, setContextDebugMode]);

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
      link.download = "codealchemist_configuracion.json";
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

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedContent = e.target?.result as string;
          const parsedConfig = JSON.parse(importedContent);

          // Basic validation
          if (
            parsedConfig &&
            typeof parsedConfig === 'object' &&
            'llmConfig' in parsedConfig && typeof parsedConfig.llmConfig === 'object' && parsedConfig.llmConfig !== null && 'provider' in parsedConfig.llmConfig &&
            'gitConfig' in parsedConfig && typeof parsedConfig.gitConfig === 'object' && parsedConfig.gitConfig !== null &&
            'debugMode' in parsedConfig && typeof parsedConfig.debugMode === 'boolean'
          ) {
            const importedSettings = parsedConfig as AppSettings;
            
            // Update AppState directly
            updateLLMConfig(importedSettings.llmConfig);
            updateGitConfig(importedSettings.gitConfig);
            updateSettings({ debugMode: importedSettings.debugMode }); // Persists in AppState
            setContextDebugMode(importedSettings.debugMode); // Updates DebugContext

            // Local states will be updated by the useEffect watching `settings`
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
            importConfigInputRef.current.value = ""; // Reset file input
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
                disabled={availableModels.length === 0 && currentLLMConfig.provider !== "Google Gemini"}
              >
                <SelectTrigger id="llm-model">
                  <SelectValue placeholder={
                    currentLLMConfig.provider === "Google Gemini" && availableModels.length === 0 
                    ? "Selecciona un modelo (ej: gemini-1.5-pro-latest)" 
                    : availableModels.length === 0 
                    ? "Selecciona un proveedor primero o introduce manualmente" 
                    : "Selecciona un modelo"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(currentLLMConfig.provider === "Google Gemini" || currentLLMConfig.provider === "LM Studio" || currentLLMConfig.provider === "Ollama") && (
                  <p className="text-xs text-muted-foreground">
                      Para {currentLLMConfig.provider}, los modelos comunes se listan aquí pero también puedes escribir uno directamente si no aparece (ej. gemini-1.5-flash-latest, o el nombre de tu modelo local).
                  </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleTestLLM} disabled={isTestingLLM}>
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
