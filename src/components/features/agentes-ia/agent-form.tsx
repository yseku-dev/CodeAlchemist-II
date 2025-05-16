
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { getGroqModels } from '@/app/configuracion/actions';
import { Loader2 } from 'lucide-react';
import { getModelsForProvider } from '@/lib/utils'; // Import from utils

/**
 * @fileOverview AgentForm component for creating and editing AI Agents.
 * This component provides a dialog form with fields for agent name, description,
 * system prompt, capabilities, and LLM configuration.
 * It handles both creation of new agents and editing of existing ones,
 * including pre-filling forms with AI-suggested data.
 * All UI text is internationalized.
 * @module AgentForm
 */

/**
 * Props for the AgentForm component.
 */
interface AgentFormProps {
  /** Whether the form dialog is open. */
  isOpen: boolean;
  /** Callback to change the open state of the dialog. */
  onOpenChange: (open: boolean) => void;
  /**
   * The agent object to edit. If null or if its ID starts with 'suggested-',
   * the form is in creation mode (potentially pre-filled with a suggestion).
   */
  editingAgent: Agent | null;
  /** Callback function invoked when the form is submitted with valid data. */
  onSubmit: (formData: AgentFormData) => void;
  // getModelsForProvider prop is removed as we'll use the imported version
  /** The global LLM configuration from application settings, used for defaults. */
  globalLLMConfig: LLMSettings;
}

/**
 * Initial empty state for the agent form data.
 */
const initialAgentFormData: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
  llmConfig: { useGlobal: true, customConfig: { ...DEFAULT_LLM_SETTINGS } },
};

/**
 * AgentForm component.
 * Provides a dialog form for creating or editing AI agent configurations.
 *
 * @param {AgentFormProps} props - The props for the component.
 * @returns {JSX.Element} The rendered agent form dialog.
 */
export default function AgentForm({
  isOpen,
  onOpenChange,
  editingAgent,
  onSubmit,
  globalLLMConfig,
}: AgentFormProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [formData, setFormData] = useState<AgentFormData>(initialAgentFormData);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [customGroqModels, setCustomGroqModels] = useState<string[]>([]);
  const [isLoadingCustomGroqModels, setIsLoadingCustomGroqModels] = useState(false);
  const previousCustomApiKeyRef = useRef<string | null>(null);

  const fetchAndSetCustomGroqModels = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setCustomGroqModels([]);
      setAvailableModels(getModelsForProvider("Groq"));
      previousCustomApiKeyRef.current = null; // Ensure it's reset
      return;
    }
    if (apiKey === previousCustomApiKeyRef.current && customGroqModels.length > 0) {
      setAvailableModels(customGroqModels);
      return;
    }

    setIsLoadingCustomGroqModels(true);
    toast({ title: t('settings.llm.testingConnectionButton'), description: `${t('settings.llm.providerLabel')}: Groq` });
    console.log(`[AgentForm CLIENT] Fetching Groq models for API key: ${apiKey.substring(0,5)}...`);

    try {
      const result = await getGroqModels(apiKey);
      console.log('[AgentForm CLIENT] Result from getGroqModels Server Action:', result);

      if (result.success && result.models) {
        setCustomGroqModels(result.models);
        const modelsToUse = result.models.length > 0 ? result.models : getModelsForProvider("Groq");
        setAvailableModels(modelsToUse);
        previousCustomApiKeyRef.current = apiKey;

        if (result.models.length > 0) {
          toast({ title: t('settings.toast.groqModelsLoadSuccess.title'), description: t('settings.toast.groqModelsLoadSuccess.description', { count: result.models.length }) });
        } else {
          toast({ title: t('settings.toast.groqModelsLoadNoModels.title'), description: result.error || t('settings.toast.groqModelsLoadNoModels.description')});
        }
        if (result.error && result.models.length === 0) {
            toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error });
        }
        // Auto-select first model if current is not in new list (for custom config)
        if (formData.llmConfig.customConfig && formData.llmConfig.customConfig.provider === "Groq" && !modelsToUse.includes(formData.llmConfig.customConfig.model || '')) {
            setFormData(prev => ({ 
                ...prev, 
                llmConfig: { 
                    ...prev.llmConfig, 
                    customConfig: { 
                        ...prev.llmConfig.customConfig!, 
                        model: modelsToUse[0] || '' 
                    } 
                } 
            }));
        }
      } else {
        setCustomGroqModels([]);
        setAvailableModels(getModelsForProvider("Groq"));
        previousCustomApiKeyRef.current = null;
        toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: result.error || t('common.unknownError') });
        if(result.debug) console.error('[AgentForm CLIENT] Debug info from Server Action (getGroqModels):', result.debug);
      }
    } catch (error: any) {
      setCustomGroqModels([]);
      setAvailableModels(getModelsForProvider("Groq"));
      previousCustomApiKeyRef.current = null;
      toast({ variant: "destructive", title: t('settings.toast.groqModelsLoadError.title'), description: error.message || t('common.unknownError') });
      console.error('[AgentForm CLIENT] Error calling getGroqModels:', error);
    } finally {
      setIsLoadingCustomGroqModels(false);
    }
  }, [customGroqModels, getModelsForProvider, t, toast, formData.llmConfig.customConfig]);

  useEffect(() => {
    if (isOpen) {
      let initialProvider: LLMProvider;
      let initialApiKey: string | undefined;
      let initialModel: string | undefined;

      if (editingAgent) {
        // Ensure customConfig is initialized if it's undefined but useGlobal is false
        const customCfg = editingAgent.llmConfig.useGlobal 
          ? { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, model: globalLLMConfig.model, apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] }
          : (editingAgent.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, model: globalLLMConfig.model, apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] });

        setFormData({
          id: editingAgent.id,
          name: editingAgent.name,
          description: editingAgent.description,
          systemPrompt: editingAgent.systemPrompt,
          capabilities: { ...editingAgent.capabilities },
          llmConfig: {
            useGlobal: editingAgent.llmConfig.useGlobal,
            customConfig: { ...customCfg } // Use the ensured customCfg
          },
        });
        initialProvider = customCfg.provider;
        initialApiKey = customCfg.apiKey;
        initialModel = customCfg.model;
      } else { // Creating new agent or from suggestion (editingAgent.id starts with 'suggested-')
        const defaultProvider = globalLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider;
        initialModel = globalLLMConfig.model || getModelsForProvider(defaultProvider)[0] || '';
        const initialFormState = editingAgent?.id?.startsWith('suggested-') ? 
          { // Pre-fill from suggestion
            id: editingAgent.id,
            name: editingAgent.name,
            description: editingAgent.description,
            systemPrompt: editingAgent.systemPrompt,
            capabilities: { ...editingAgent.capabilities },
            llmConfig: { // Default to global for suggestions initially, or derive from editingAgent if present
              useGlobal: editingAgent.llmConfig?.useGlobal ?? true,
              customConfig: editingAgent.llmConfig?.customConfig ?? {
                ...DEFAULT_LLM_SETTINGS,
                provider: defaultProvider,
                model: initialModel,
                apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[defaultProvider] || ''
              }
            }
          } : 
          { // Completely new agent
            ...initialAgentFormData,
            llmConfig: {
              useGlobal: true,
              customConfig: {
                ...DEFAULT_LLM_SETTINGS,
                provider: defaultProvider,
                model: initialModel,
                apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[defaultProvider] || ''
              }
            }
          };
        setFormData(initialFormState as AgentFormData);
        initialProvider = (initialFormState.llmConfig.customConfig as LLMSettings).provider;
        initialApiKey = (initialFormState.llmConfig.customConfig as LLMSettings).apiKey;
        initialModel = (initialFormState.llmConfig.customConfig as LLMSettings).model;
      }
      
      // Initial model list setup
      if (initialProvider === "Groq" && initialApiKey && !formData.llmConfig.useGlobal) { 
        fetchAndSetCustomGroqModels(initialApiKey);
      } else if (initialProvider) {
        setAvailableModels(getModelsForProvider(initialProvider));
      } else {
        setAvailableModels([]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAgent, globalLLMConfig]); // fetchAndSetCustomGroqModels removed to avoid loop, handled by other effect

  // Effect to fetch Groq models when custom provider/API key changes
  useEffect(() => {
    if (!isOpen || formData.llmConfig.useGlobal) return; // Only run if form is open and custom config is active
    
    const customConfig = formData.llmConfig.customConfig;
    if (customConfig?.provider === "Groq" && customConfig.apiKey) {
        if (customConfig.apiKey !== previousCustomApiKeyRef.current || customGroqModels.length === 0) {
             fetchAndSetCustomGroqModels(customConfig.apiKey);
        } else {
            setAvailableModels(customGroqModels); // Use cached if API key hasn't changed
        }
    } else if (customConfig) {
        setAvailableModels(getModelsForProvider(customConfig.provider));
        setCustomGroqModels([]); // Clear Groq models if provider is not Groq
        previousCustomApiKeyRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formData.llmConfig.useGlobal, formData.llmConfig.customConfig?.provider, formData.llmConfig.customConfig?.apiKey]);


  const handleFormChange = (field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCapabilityChange = (capability: keyof AgentFormData['capabilities'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: { ...prev.capabilities, [capability]: value }
    }));
  };

  const handleLlmConfigChange = (field: keyof AgentLLMConfiguration | keyof LLMSettings, value: any) => {
    setFormData(prev => {
      const newFormState = { ...prev };
      let newCustomConfig = { ...(newFormState.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] || '', model: globalLLMConfig.model || '' }) };

      if (field === 'useGlobal') {
        newFormState.llmConfig.useGlobal = !!value;
        if (!!value === false && !newFormState.llmConfig.customConfig) { // If switching to custom and customConfig is not set up
          newFormState.llmConfig.customConfig = { 
            ...DEFAULT_LLM_SETTINGS, 
            provider: globalLLMConfig.provider, 
            model: globalLLMConfig.model || getModelsForProvider(globalLLMConfig.provider)[0] || '',
            apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] || ''
          };
           if (globalLLMConfig.provider === "Groq" && globalLLMConfig.apiKey) {
             fetchAndSetCustomGroqModels(globalLLMConfig.apiKey); // Fetch if global was Groq
           } else {
             setAvailableModels(getModelsForProvider(globalLLMConfig.provider));
           }
        } else if (!!value === false && newFormState.llmConfig.customConfig) { // Switching to custom, ensure models are loaded for its provider
           const currentCustomProvider = newFormState.llmConfig.customConfig.provider;
           if (currentCustomProvider === "Groq" && newFormState.llmConfig.customConfig.apiKey) {
             fetchAndSetCustomGroqModels(newFormState.llmConfig.customConfig.apiKey);
           } else {
             setAvailableModels(getModelsForProvider(currentCustomProvider));
           }
        }
      } else { 
        newFormState.llmConfig.useGlobal = false; 
        (newCustomConfig as any)[field] = value;

        if (field === 'provider') {
          const provider = value as LLMProvider;
          newCustomConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[provider] || '';
          let models: string[];
          if (provider === "Groq" && newCustomConfig.apiKey) {
            fetchAndSetCustomGroqModels(newCustomConfig.apiKey); // This will set availableModels
            models = customGroqModels.length > 0 ? customGroqModels : getModelsForProvider(provider); // Use current customGroqModels or fallback
          } else {
            models = getModelsForProvider(provider);
            setAvailableModels(models);
            setCustomGroqModels([]);
            previousCustomApiKeyRef.current = null;
          }
          // Ensure model is valid for new provider
          if (!models.includes(newCustomConfig.model || '')) { 
            newCustomConfig.model = models[0] || '';
          }
        }
        newFormState.llmConfig.customConfig = newCustomConfig;
      }
      return newFormState;
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: t('agents.form.toast.nameRequired.title' as TranslationKey), description: t('agents.form.toast.nameRequired.description' as TranslationKey) });
      return;
    }

    const finalLlmConfig = formData.llmConfig.useGlobal
      ? { useGlobal: true, customConfig: undefined } 
      : { useGlobal: false, customConfig: formData.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, apiUrl: globalLLMConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] || '' , model: globalLLMConfig.model || ''} };

    const agentDataToSubmit = { ...formData, llmConfig: finalLlmConfig };
    onSubmit(agentDataToSubmit);
  };
  
  const dialogTitleKey = editingAgent 
    ? (editingAgent.id.startsWith('suggested-') ? 'agents.form.title.reviewSuggestion' : 'agents.form.title.edit') 
    : 'agents.form.title.create';
  const dialogDescriptionKey = editingAgent && !editingAgent.id.startsWith('suggested-')
    ? 'agents.form.descriptionModal.edit'
    : 'agents.form.descriptionModal.create';

  const currentCustomProvider = formData.llmConfig.customConfig?.provider || DEFAULT_LLM_SETTINGS.provider;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t(dialogTitleKey as TranslationKey)}</DialogTitle>
          <DialogDescription>
            {t(dialogDescriptionKey as TranslationKey, { name: editingAgent?.name || '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-6 -mr-6"> 
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="agent-name">{t('agents.form.label.name' as TranslationKey)}</Label>
                <Input id="agent-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} disabled={editingAgent?.isNameEditable === false} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="agent-description">{t('agents.form.label.description' as TranslationKey)}</Label>
                <Textarea id="agent-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="agent-systemPrompt">{t('agents.form.label.systemPrompt' as TranslationKey)}</Label>
                <Textarea id="agent-systemPrompt" value={formData.systemPrompt} onChange={(e) => handleFormChange('systemPrompt', e.target.value)} rows={5} placeholder={t('agents.form.placeholder.systemPrompt' as TranslationKey)} />
              </div>

              <Label className="font-semibold">{t('agents.form.label.capabilities' as TranslationKey)}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {(Object.keys(formData.capabilities) as Array<keyof AgentFormData['capabilities']>).map((key) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Switch id={`cap-${key}`} checked={formData.capabilities[key]} onCheckedChange={(checked) => handleCapabilityChange(key, checked)} />
                    <Label htmlFor={`cap-${key}`} className="font-normal">
                      {t(`agents.form.capability.${key}` as TranslationKey)} 
                      {(key === 'execution' || key === 'readWrite') && <span className="text-destructive text-xs ml-1">{t('agents.form.capability.dangerousTooltip' as TranslationKey)}</span>}
                    </Label>
                  </div>
                ))}
              </div>

              <Label className="font-semibold">{t('agents.form.label.llmConfig' as TranslationKey)}</Label>
              <div className="space-y-3 p-3 border rounded-md">
                <div className="flex items-center space-x-2">
                  <Switch id="use-global-llm" checked={formData.llmConfig.useGlobal} onCheckedChange={(checked) => handleLlmConfigChange('useGlobal', checked)} />
                  <Label htmlFor="use-global-llm" className="font-normal">{t('agents.form.llm.useGlobal' as TranslationKey)}</Label>
                </div>
                {!formData.llmConfig.useGlobal && formData.llmConfig.customConfig && (
                  <div className="space-y-2 pl-2 border-l-2 ml-2">
                    <div className="space-y-1">
                      <Label htmlFor="custom-llm-provider" className="text-xs">{t('agents.form.llm.custom.providerLabel' as TranslationKey)}</Label>
                      <Select
                        value={formData.llmConfig.customConfig.provider}
                        onValueChange={(val) => handleLlmConfigChange('provider', val as LLMProvider)}
                      >
                        <SelectTrigger id="custom-llm-provider"><SelectValue /></SelectTrigger>
                        <SelectContent>{LLM_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-llm-model" className="text-xs flex items-center">
                          {t('agents.form.llm.custom.modelLabel' as TranslationKey)}
                          {currentCustomProvider === "Groq" && isLoadingCustomGroqModels && <Loader2 className="h-3 w-3 animate-spin ml-2" />}
                      </Label>
                      <Select
                        value={formData.llmConfig.customConfig.model || ''}
                        onValueChange={(val) => handleLlmConfigChange('model', val )}
                        disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(currentCustomProvider)}
                      >
                        <SelectTrigger id="custom-llm-model"><SelectValue placeholder={
                          (["Google Gemini", "LM Studio", "Ollama"].includes(currentCustomProvider))
                            ? t('agents.form.llm.custom.modelPlaceholder.geminiLlm' as TranslationKey, { provider: currentCustomProvider })
                            : availableModels.length === 0
                              ? t('agents.form.llm.custom.modelPlaceholder.selectProvider' as TranslationKey)
                              : t('agents.form.llm.custom.modelPlaceholder.default' as TranslationKey)
                        } /></SelectTrigger>
                        <SelectContent>
                          {availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                           {(currentCustomProvider === "Groq" && isLoadingCustomGroqModels && availableModels.length === 0) && (
                             <div className="p-2 text-center text-xs text-muted-foreground"> {t('common.loading')} </div>
                           )}
                        </SelectContent>
                      </Select>
                      {(["Google Gemini", "LM Studio", "Ollama"].includes(currentCustomProvider)) && (
                        <p className="text-xs text-muted-foreground">
                          {t('agents.form.llm.custom.geminiModelDescription' as TranslationKey, {provider: currentCustomProvider})}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-llm-apiUrl" className="text-xs">{t('agents.form.llm.custom.apiUrlLabel' as TranslationKey)}</Label>
                      <Input
                        id="custom-llm-apiUrl"
                        value={formData.llmConfig.customConfig.apiUrl || ''}
                        onChange={(e) => handleLlmConfigChange('apiUrl', e.target.value )}
                        placeholder={LLM_PROVIDER_DEFAULT_API_URLS[currentCustomProvider] || t('agents.form.llm.custom.apiUrlPlaceholder' as TranslationKey)}
                      />
                      <p className="text-xs text-muted-foreground">
                          {t('agents.form.llm.custom.apiUrlDescription' as TranslationKey)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-llm-apiKey" className="text-xs">{t('agents.form.llm.custom.apiKeyLabel' as TranslationKey)}</Label>
                      <Input
                        id="custom-llm-apiKey"
                        type="password"
                        value={formData.llmConfig.customConfig.apiKey || ''}
                        onChange={(e) => handleLlmConfigChange('apiKey', e.target.value )}
                        placeholder={t('agents.form.llm.custom.apiKeyPlaceholder' as TranslationKey)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea> 
        </div>
        <DialogFooter className="pt-4 border-t mt-auto">
          <DialogClose asChild><Button variant="outline">{t('common.cancel' as TranslationKey)}</Button></DialogClose>
          <Button onClick={handleSubmit}>
            {editingAgent && !editingAgent.id.startsWith('suggested-') ? t('agents.form.button.saveChanges' as TranslationKey) : (formData.id && formData.id.startsWith('suggested-') ? t('agents.form.button.createAgentWithSuggestion' as TranslationKey) : t('agents.form.button.createAgent' as TranslationKey))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
