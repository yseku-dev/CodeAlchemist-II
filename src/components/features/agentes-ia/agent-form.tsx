
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Agent, AgentFormData, AgentLLMConfiguration, LLMSettings, LLMProvider } from '@/types';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

interface AgentFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingAgent: Agent | null;
  onSubmit: (formData: AgentFormData) => void;
  getModelsForProvider: (provider: LLMProvider) => string[];
  globalLLMConfig: LLMSettings;
}

const initialAgentFormData: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
  llmConfig: { useGlobal: true, customConfig: { ...DEFAULT_LLM_SETTINGS } },
};

export default function AgentForm({
  isOpen,
  onOpenChange,
  editingAgent,
  onSubmit,
  getModelsForProvider,
  globalLLMConfig,
}: AgentFormProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<AgentFormData>(initialAgentFormData);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingAgent) {
        const agentConfig = editingAgent.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, model: globalLLMConfig.model, apiUrl: globalLLMConfig.apiUrl };
        setFormData({
          id: editingAgent.id,
          name: editingAgent.name,
          description: editingAgent.description,
          systemPrompt: editingAgent.systemPrompt,
          capabilities: { ...editingAgent.capabilities },
          llmConfig: {
            useGlobal: editingAgent.llmConfig.useGlobal,
            customConfig: { ...agentConfig }
          },
        });
        setAvailableModels(getModelsForProvider(agentConfig.provider));
      } else {
        const defaultProvider = globalLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider;
        setFormData({
          ...initialAgentFormData,
          llmConfig: {
            useGlobal: true,
            customConfig: {
              ...DEFAULT_LLM_SETTINGS,
              provider: defaultProvider,
              model: '',
              apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[defaultProvider] || ''
            }
          }
        });
        setAvailableModels(getModelsForProvider(defaultProvider));
      }
    }
  }, [isOpen, editingAgent, getModelsForProvider, globalLLMConfig]);

  const handleFormChange = (field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCapabilityChange = (capability: keyof AgentFormData['capabilities'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: { ...prev.capabilities, [capability]: value }
    }));
  };

  const handleLlmConfigChange = (field: keyof AgentLLMConfiguration, value: any) => {
    if (field === 'customConfig') {
      const changedCustomConfigProps = value as Partial<LLMSettings>;
      let newCustomConfig = { ...(formData.llmConfig.customConfig || DEFAULT_LLM_SETTINGS), ...changedCustomConfigProps };

      if (changedCustomConfigProps.provider) {
        const newProvider = changedCustomConfigProps.provider as LLMProvider;
        newCustomConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newProvider] || "";
        setAvailableModels(getModelsForProvider(newProvider));
        if (!getModelsForProvider(newProvider).includes(newCustomConfig.model)) {
          newCustomConfig.model = '';
        }
      }
      setFormData(prev => ({
        ...prev,
        llmConfig: { ...prev.llmConfig, useGlobal: false, customConfig: newCustomConfig }
      }));
    } else if (field === 'useGlobal') {
      setFormData(prev => {
        const newLlmConfig = { ...prev.llmConfig, useGlobal: !!value };
        if (!value && !newLlmConfig.customConfig) {
          const globalProvider = globalLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider;
          newLlmConfig.customConfig = {
            ...DEFAULT_LLM_SETTINGS,
            provider: globalProvider,
            model: getModelsForProvider(globalProvider)[0] || '',
            apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[globalProvider] || '',
          };
          setAvailableModels(getModelsForProvider(globalProvider));
        } else if (!value && newLlmConfig.customConfig) {
           newLlmConfig.customConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[newLlmConfig.customConfig.provider] || newLlmConfig.customConfig.apiUrl || "";
           setAvailableModels(getModelsForProvider(newLlmConfig.customConfig.provider));
        }
        return { ...prev, llmConfig: newLlmConfig };
      });
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Nombre Requerido", description: "El agente debe tener un nombre." });
      return;
    }

    const finalLlmConfig = formData.llmConfig.useGlobal
      ? { useGlobal: true }
      : { useGlobal: false, customConfig: formData.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, apiUrl: globalLLMConfig.apiUrl } };

    const agentDataToSubmit = { ...formData, llmConfig: finalLlmConfig };
    onSubmit(agentDataToSubmit);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}</DialogTitle>
          <DialogDescription>
            {editingAgent
              ? `Modifica los detalles del agente "${editingAgent.name}".`
              : "Define un nuevo agente especializado para tus tareas de IA."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6">
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="agent-name">Nombre</Label>
              <Input id="agent-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} disabled={editingAgent?.isNameEditable === false} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-description">Descripción</Label>
              <Textarea id="agent-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-systemPrompt">Mensaje de Sistema (Prompt)</Label>
              <Textarea id="agent-systemPrompt" value={formData.systemPrompt} onChange={(e) => handleFormChange('systemPrompt', e.target.value)} rows={5} placeholder="Define el rol, comportamiento y directrices del agente..." />
            </div>

            <Label className="font-semibold">Capacidades del Agente</Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {Object.entries(formData.capabilities).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Switch id={`cap-${key}`} checked={value} onCheckedChange={(checked) => handleCapabilityChange(key as keyof AgentFormData['capabilities'], checked)} />
                  <Label htmlFor={`cap-${key}`} className="font-normal capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                    {(key === 'execution' || key === 'readWrite') && <span className="text-destructive text-xs ml-1">(Peligroso)</span>}
                  </Label>
                </div>
              ))}
            </div>

            <Label className="font-semibold">Configuración LLM del Agente</Label>
            <div className="space-y-3 p-3 border rounded-md">
              <div className="flex items-center space-x-2">
                <Switch id="use-global-llm" checked={formData.llmConfig.useGlobal} onCheckedChange={(checked) => handleLlmConfigChange('useGlobal', checked)} />
                <Label htmlFor="use-global-llm" className="font-normal">Usar Configuración Global</Label>
              </div>
              {!formData.llmConfig.useGlobal && formData.llmConfig.customConfig && (
                <div className="space-y-2 pl-2 border-l-2 ml-2">
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-provider" className="text-xs">Proveedor LLM</Label>
                    <Select
                      value={formData.llmConfig.customConfig.provider}
                      onValueChange={(val) => handleLlmConfigChange('customConfig', { provider: val as LLMProvider })}
                    >
                      <SelectTrigger id="custom-llm-provider"><SelectValue /></SelectTrigger>
                      <SelectContent>{LLM_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-model" className="text-xs">Modelo</Label>
                    <Select
                      value={formData.llmConfig.customConfig.model}
                      onValueChange={(val) => handleLlmConfigChange('customConfig', { model: val })}
                      disabled={availableModels.length === 0 && formData.llmConfig.customConfig.provider !== "Google Gemini"}
                    >
                      <SelectTrigger id="custom-llm-model"><SelectValue placeholder={
                        formData.llmConfig.customConfig.provider === "Google Gemini" && availableModels.length === 0
                          ? "Ej: gemini-1.5-pro-latest"
                          : availableModels.length === 0
                            ? "Selecciona proveedor"
                            : "Selecciona modelo"
                      } /></SelectTrigger>
                      <SelectContent>{availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    {formData.llmConfig.customConfig.provider === "Google Gemini" && (
                      <p className="text-xs text-muted-foreground">
                        Modelos comunes listados. Puedes escribir otro si es necesario.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-apiUrl" className="text-xs">URL API (Opcional)</Label>
                    <Input
                      id="custom-llm-apiUrl"
                      value={formData.llmConfig.customConfig.apiUrl}
                      onChange={(e) => handleLlmConfigChange('customConfig', { apiUrl: e.target.value })}
                      placeholder="Se auto-rellena al cambiar proveedor"
                    />
                    <p className="text-xs text-muted-foreground">
                      Modifícala si usas un proxy o un endpoint no estándar.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-apiKey" className="text-xs">Clave API (Opcional)</Label>
                    <Input
                      id="custom-llm-apiKey"
                      type="password"
                      value={formData.llmConfig.customConfig.apiKey}
                      onChange={(e) => handleLlmConfigChange('customConfig', { apiKey: e.target.value })}
                      placeholder="Usar global si está vacía"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleSubmit}>{editingAgent ? 'Guardar Cambios' : 'Crear Agente'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

