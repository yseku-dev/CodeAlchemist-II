
"use client";

import React, { useState, useEffect } from 'react';
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
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import type { LLMSettings, GitSettings, LLMProvider } from '@/types';

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
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro"]; // Models available via googleAI plugin
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model 1", "Local Model 2"]; // User would configure these in LM Studio
    case "Ollama": return ["llama3", "mistral", "codellama"]; // User would pull these in Ollama
    default: return [];
  }
};

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const { debugMode, setDebugMode: setContextDebugMode, addLog } = useDebug();
  const { settings, updateLLMConfig, updateGitConfig, updateSettings } = useAppState();

  const [currentLLMConfig, setCurrentLLMConfig] = useState<LLMSettings>(settings.llmConfig);
  const [currentGitConfig, setCurrentGitConfig] = useState<GitSettings>(settings.gitConfig);
  const [currentDebugMode, setCurrentDebugMode] = useState<boolean>(settings.debugMode);
  
  const [isTestingLLM, setIsTestingLLM] = useState(false);
  const [isTestingGit, setIsTestingGit] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    setCurrentLLMConfig(settings.llmConfig);
    setCurrentGitConfig(settings.gitConfig);
    setCurrentDebugMode(settings.debugMode);
    setAvailableModels(getModelsForProvider(settings.llmConfig.provider || DEFAULT_LLM_SETTINGS.provider));
  }, [settings]);


  const handleLLMConfigChange = (field: keyof LLMSettings, value: string) => {
    const newConfig = { ...currentLLMConfig, [field]: value };
    
    if (field === 'provider') {
      const newProvider = value as LLMProvider;
      newConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || ""; // Auto-set API URL
      setAvailableModels(getModelsForProvider(newProvider));
      
      if (!getModelsForProvider(newProvider).includes(newConfig.model)) {
        newConfig.model = ''; // Reset model if not compatible with new provider
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


  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Proveedor LLM</CardTitle>
          <CardDescription>Ajusta la configuración global para la interacción con Modelos de Lenguaje Grandes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="llm-provider">Proveedor LLM</Label>
            <Select
              value={currentLLMConfig.provider}
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
              value={currentLLMConfig.apiUrl}
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
              value={currentLLMConfig.apiKey}
              onChange={(e) => handleLLMConfigChange('apiKey', e.target.value)}
              placeholder="Introduce tu clave API (si es requerida)"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="llm-model">Nombre del Modelo</Label>
             <Select
              value={currentLLMConfig.model}
              onValueChange={(value) => handleLLMConfigChange('model', value)}
              disabled={availableModels.length === 0 && currentLLMConfig.provider !== "Google Gemini"}
            >
              <SelectTrigger id="llm-model">
                <SelectValue placeholder={
                  currentLLMConfig.provider === "Google Gemini" && availableModels.length === 0 
                  ? "Selecciona un modelo (ej: gemini-1.5-pro-latest)" 
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
            {currentLLMConfig.provider === "Google Gemini" && (
                 <p className="text-xs text-muted-foreground">
                    Para Google Gemini, los modelos se listan aquí pero también puedes escribir uno directamente si no aparece (ej. gemini-1.5-flash-latest).
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
              value={currentGitConfig.repoUrl}
              onChange={(e) => handleGitConfigChange('repoUrl', e.target.value)}
              placeholder="Ej: https://github.com/usuario/repo.git"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="git-username">Nombre de Usuario Git</Label>
              <Input
                id="git-username"
                value={currentGitConfig.username}
                onChange={(e) => handleGitConfigChange('username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-email">Email de Git</Label>
              <Input
                id="git-email"
                type="email"
                value={currentGitConfig.email}
                onChange={(e) => handleGitConfigChange('email', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-pat">Token de Acceso Personal (PAT)</Label>
            <Input
              id="git-pat"
              type="password"
              value={currentGitConfig.pat}
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

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSaveSettings}>Guardar Configuración</Button>
      </div>
    </div>
  );
}
