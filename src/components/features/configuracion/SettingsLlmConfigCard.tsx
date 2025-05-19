// src/components/features/configuracion/SettingsLlmConfigCard.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Info, Cpu } from 'lucide-react';
import type { LLMSettings, LLMProvider } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import { LLM_PROVIDERS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface FieldLabelWithTooltipProps {
  htmlFor: string;
  labelKey: TranslationKey;
  tooltipKey: TranslationKey;
  t: (key: TranslationKey) => string;
}

const FieldLabelWithTooltip: React.FC<FieldLabelWithTooltipProps> = ({ htmlFor, labelKey, tooltipKey, t }) => (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor}>{t(labelKey)}</Label>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
              <span className="sr-only">{t(tooltipKey)}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right"><p className="max-w-xs">{t(tooltipKey)}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
);


interface SettingsLlmConfigCardProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  config: LLMSettings;
  onConfigChange: (field: keyof LLMSettings, value: string | LLMProvider) => void;
  availableModels: string[];
  isLoadingGroqModels: boolean;
  onTestLLM: () => void;
  isTestingLLM: boolean;
  isMounted: boolean;
}

const SettingsLlmConfigCard: React.FC<SettingsLlmConfigCardProps> = ({
  t,
  config,
  onConfigChange,
  availableModels,
  isLoadingGroqModels,
  onTestLLM,
  isTestingLLM,
  isMounted,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Cpu className="h-5 w-5 text-primary" />
        <div>
          <CardTitle className="text-xl">{t('settings.llm.title')}</CardTitle>
          <CardDescription>{t('settings.llm.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="llm-provider">{t('settings.llm.providerLabel')}</Label>
          <Select
            value={config.provider}
            onValueChange={(value) => onConfigChange('provider', value as LLMProvider)}
          >
            <SelectTrigger id="llm-provider">
              <SelectValue placeholder={isMounted ? t('settings.llm.providerPlaceholder') : 'settings.llm.providerPlaceholder'} />
            </SelectTrigger>
            <SelectContent>
              {LLM_PROVIDERS.map(provider => (
                <SelectItem key={provider} value={provider}>{provider}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <FieldLabelWithTooltip htmlFor="llm-api-url" labelKey={'settings.llm.apiUrlLabel'} tooltipKey={'settings.llm.apiUrlTooltip'} t={t} />
          <Input
            id="llm-api-url"
            value={config.apiUrl || ''}
            onChange={(e) => onConfigChange('apiUrl', e.target.value)}
            placeholder={LLM_PROVIDER_DEFAULT_API_URLS[config.provider as LLMProvider] || (isMounted ? t('settings.llm.apiUrlPlaceholder') : 'settings.llm.apiUrlPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">{t('settings.llm.apiUrlDescription')}</p>
        </div>

        <div className="space-y-2">
          <FieldLabelWithTooltip htmlFor="llm-api-key" labelKey={'settings.llm.apiKeyLabel'} tooltipKey={'settings.llm.apiKeyTooltip'} t={t} />
          <Input
            id="llm-api-key"
            type="password"
            value={config.apiKey || ''}
            onChange={(e) => onConfigChange('apiKey', e.target.value)}
            placeholder={isMounted ? t('settings.llm.apiKeyPlaceholder') : 'settings.llm.apiKeyPlaceholder'}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FieldLabelWithTooltip htmlFor="llm-model" labelKey={'settings.llm.modelNameLabel'} tooltipKey={'settings.llm.modelNameTooltip'} t={t} />
            {config.provider === "Groq" && isLoadingGroqModels && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <Select
            value={config.model || ''}
            onValueChange={(value) => onConfigChange('model', value)}
            disabled={availableModels.length === 0 && !["Google Gemini", "LM Studio", "Ollama"].includes(config.provider)}
          >
            <SelectTrigger id="llm-model">
              <SelectValue placeholder={
                isMounted ? (
                  (["Google Gemini", "LM Studio", "Ollama"].includes(config.provider))
                  ? t('settings.llm.modelNamePlaceholderLocal', {provider: config.provider})
                  : availableModels.length === 0 && !(config.provider === "Groq" && isLoadingGroqModels)
                  ? t('settings.llm.modelNamePlaceholderDefault')
                  : t('settings.llm.modelNamePlaceholder')
                ) : 'settings.llm.modelNamePlaceholder'
              } />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(model => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
              {(config.provider === "Groq" && isLoadingGroqModels && availableModels.length === 0) && (
                <div className="p-2 text-center text-xs text-muted-foreground">{t('common.loading')}</div>
              )}
            </SelectContent>
          </Select>
          {(["Google Gemini", "LM Studio", "Ollama"].includes(config.provider)) && (
            <p className="text-xs text-muted-foreground">{t('settings.llm.modelNameDescriptionLocal', {provider: config.provider})}</p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onTestLLM} disabled={isTestingLLM}>
          {isTestingLLM ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isMounted ? (isTestingLLM ? t('settings.llm.testingConnectionButton') : t('settings.llm.testConnectionButton')) : 'Test Connection'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SettingsLlmConfigCard;
