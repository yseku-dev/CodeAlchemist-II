
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
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

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
  /**
   * Function to get a list of available model names for a given LLM provider.
   * @param {LLMProvider} provider - The LLM provider.
   * @returns {string[]} An array of model names.
   */
  getModelsForProvider: (provider: LLMProvider) => string[];
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
  getModelsForProvider,
  globalLLMConfig,
}: AgentFormProps) {
  const { toast } = useToast();
  const { t } = useI18n();
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
              model: '', // Model will be selected or default from getModelsForProvider
              apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[defaultProvider] || ''
            }
          }
        });
        setAvailableModels(getModelsForProvider(defaultProvider));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAgent, getModelsForProvider]); // GlobalLLMConfig omitted to prevent re-init if only global changes

  /**
   * Handles changes to general form fields.
   * @param {keyof AgentFormData} field - The form field being changed.
   * @param {any} value - The new value for the field.
   */
  const handleFormChange = (field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Handles changes to capability switches.
   * @param {keyof AgentFormData['capabilities']} capability - The capability key.
   * @param {boolean} value - The new boolean value for the capability.
   */
  const handleCapabilityChange = (capability: keyof AgentFormData['capabilities'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: { ...prev.capabilities, [capability]: value }
    }));
  };

  /**
   * Handles changes to the LLM configuration section of the form.
   * @param {keyof AgentLLMConfiguration | keyof LLMSettings} field - The LLM configuration field being changed.
   * @param {any} value - The new value for the field.
   */
  const handleLlmConfigChange = (field: keyof AgentLLMConfiguration | keyof LLMSettings, value: any) => {
    setFormData(prev => {
      const newFormState = { ...prev };
      let newCustomConfig = { ...(newFormState.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] || '' }) };

      if (field === 'useGlobal') {
        newFormState.llmConfig.useGlobal = !!value;
        if (!!value === false && !newFormState.llmConfig.customConfig) { // Switching to custom and no custom exists
          const provider = globalLLMConfig.provider || DEFAULT_LLM_SETTINGS.provider;
          newCustomConfig.provider = provider;
          newCustomConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[provider] || '';
          const models = getModelsForProvider(provider);
          newCustomConfig.model = models[0] || '';
          setAvailableModels(models);
          newFormState.llmConfig.customConfig = newCustomConfig;
        } else if (!!value === false && newFormState.llmConfig.customConfig) { // Switching to custom and custom already exists
            setAvailableModels(getModelsForProvider(newFormState.llmConfig.customConfig.provider));
        }
      } else { // Modifying a field within customConfig
        newFormState.llmConfig.useGlobal = false; // Ensure custom is selected
        (newCustomConfig as any)[field] = value;

        if (field === 'provider') {
          const provider = value as LLMProvider;
          newCustomConfig.apiUrl = LLM_PROVIDER_DEFAULT_API_URLS[provider] || '';
          const models = getModelsForProvider(provider);
          setAvailableModels(models);
          if (!models.includes(newCustomConfig.model || '')) { // Ensure model is string for includes check
            newCustomConfig.model = models[0] || '';
          }
        }
        newFormState.llmConfig.customConfig = newCustomConfig;
      }
      return newFormState;
    });
  };


  /**
   * Handles the form submission.
   * Validates the form data and calls the `onSubmit` prop.
   */
  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: t('agents.form.toast.nameRequired.title'), description: t('agents.form.toast.nameRequired.description') });
      return;
    }

    const finalLlmConfig = formData.llmConfig.useGlobal
      ? { useGlobal: true, customConfig: undefined } // Explicitly set customConfig to undefined if global is used
      : { useGlobal: false, customConfig: formData.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalLLMConfig.provider, apiUrl: LLM_PROVIDER_DEFAULT_API_URLS[globalLLMConfig.provider] || '' } };

    const agentDataToSubmit = { ...formData, llmConfig: finalLlmConfig };
    onSubmit(agentDataToSubmit);
  };
  
  const dialogTitleKey = editingAgent 
    ? (editingAgent.id.startsWith('suggested-') ? 'agents.form.title.reviewSuggestion' : 'agents.form.title.edit') 
    : 'agents.form.title.create';
  const dialogDescriptionKey = editingAgent && !editingAgent.id.startsWith('suggested-')
    ? 'agents.form.descriptionModal.edit'
    : 'agents.form.descriptionModal.create';


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t(dialogTitleKey as TranslationKey)}</DialogTitle>
          <DialogDescription>
            {t(dialogDescriptionKey as TranslationKey, { name: editingAgent?.name || '' })}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-6 -mr-6"> {/* ScrollArea for form content */}
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="agent-name">{t('agents.form.label.name')}</Label>
              <Input id="agent-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} disabled={editingAgent?.isNameEditable === false} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-description">{t('agents.form.label.description')}</Label>
              <Textarea id="agent-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="agent-systemPrompt">{t('agents.form.label.systemPrompt')}</Label>
              <Textarea id="agent-systemPrompt" value={formData.systemPrompt} onChange={(e) => handleFormChange('systemPrompt', e.target.value)} rows={5} placeholder={t('agents.form.placeholder.systemPrompt')} />
            </div>

            <Label className="font-semibold">{t('agents.form.label.capabilities')}</Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {(Object.keys(formData.capabilities) as Array<keyof AgentFormData['capabilities']>).map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Switch id={`cap-${key}`} checked={formData.capabilities[key]} onCheckedChange={(checked) => handleCapabilityChange(key, checked)} />
                  <Label htmlFor={`cap-${key}`} className="font-normal">
                    {t(`agents.form.capability.${key}` as TranslationKey)} {/* Removed .toLowerCase() */}
                    {(key === 'execution' || key === 'readWrite') && <span className="text-destructive text-xs ml-1">{t('agents.form.capability.dangerousTooltip')}</span>}
                  </Label>
                </div>
              ))}
            </div>

            <Label className="font-semibold">{t('agents.form.label.llmConfig')}</Label>
            <div className="space-y-3 p-3 border rounded-md">
              <div className="flex items-center space-x-2">
                <Switch id="use-global-llm" checked={formData.llmConfig.useGlobal} onCheckedChange={(checked) => handleLlmConfigChange('useGlobal', checked)} />
                <Label htmlFor="use-global-llm" className="font-normal">{t('agents.form.llm.useGlobal')}</Label>
              </div>
              {!formData.llmConfig.useGlobal && formData.llmConfig.customConfig && (
                <div className="space-y-2 pl-2 border-l-2 ml-2">
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-provider" className="text-xs">{t('agents.form.llm.custom.providerLabel')}</Label>
                    <Select
                      value={formData.llmConfig.customConfig.provider}
                      onValueChange={(val) => handleLlmConfigChange('provider', val as LLMProvider)}
                    >
                      <SelectTrigger id="custom-llm-provider"><SelectValue /></SelectTrigger>
                      <SelectContent>{LLM_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-model" className="text-xs">{t('agents.form.llm.custom.modelLabel')}</Label>
                    <Select
                      value={formData.llmConfig.customConfig.model || ''}
                      onValueChange={(val) => handleLlmConfigChange('model', val )}
                      disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(formData.llmConfig.customConfig.provider)}
                    >
                      <SelectTrigger id="custom-llm-model"><SelectValue placeholder={
                        (["Google Gemini", "LM Studio", "Ollama"].includes(formData.llmConfig.customConfig.provider))
                          ? t('agents.form.llm.custom.modelPlaceholder.geminiLlm', { provider: formData.llmConfig.customConfig.provider })
                          : availableModels.length === 0
                            ? t('agents.form.llm.custom.modelPlaceholder.selectProvider')
                            : t('agents.form.llm.custom.modelPlaceholder.default')
                      } /></SelectTrigger>
                      <SelectContent>{availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    {(["Google Gemini", "LM Studio", "Ollama"].includes(formData.llmConfig.customConfig.provider)) && (
                      <p className="text-xs text-muted-foreground">
                        {t('agents.form.llm.custom.geminiModelDescription')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-apiUrl" className="text-xs">{t('agents.form.llm.custom.apiUrlLabel')}</Label>
                    <Input
                      id="custom-llm-apiUrl"
                      value={formData.llmConfig.customConfig.apiUrl || ''}
                      onChange={(e) => handleLlmConfigChange('apiUrl', e.target.value )}
                      placeholder={LLM_PROVIDER_DEFAULT_API_URLS[formData.llmConfig.customConfig.provider] || t('agents.form.llm.custom.apiUrlPlaceholder')}
                    />
                     <p className="text-xs text-muted-foreground">
                        {t('agents.form.llm.custom.apiUrlDescription')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-llm-apiKey" className="text-xs">{t('agents.form.llm.custom.apiKeyLabel')}</Label>
                    <Input
                      id="custom-llm-apiKey"
                      type="password"
                      value={formData.llmConfig.customConfig.apiKey || ''}
                      onChange={(e) => handleLlmConfigChange('apiKey', e.target.value )}
                      placeholder={t('agents.form.llm.custom.apiKeyPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea> {/* End ScrollArea */}
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild><Button variant="outline">{t('common.cancel')}</Button></DialogClose>
          <Button onClick={handleSubmit}>
            {editingAgent && !editingAgent.id.startsWith('suggested-') ? t('agents.form.button.saveChanges') : (formData.id && formData.id.startsWith('suggested-') ? t('agents.form.button.createAgentWithSuggestion') : t('agents.form.button.createAgent'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    