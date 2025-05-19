// src/components/features/agentes-ia/AgentListDisplay.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit3, Trash2, Download, PlayCircle } from 'lucide-react';
import type { Agent, LLMSettings } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface AgentListDisplayProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  agents: Agent[];
  globalSettings: { llmConfig: LLMSettings };
  onTestAgent: (agent: Agent) => void;
  onExportSingleAgent: (agent: Agent) => void;
  onOpenForm: (agent: Agent) => void;
  onDeleteAgent: (agent: Agent) => void;
}

const AgentListDisplay: React.FC<AgentListDisplayProps> = ({
  t,
  agents,
  globalSettings,
  onTestAgent,
  onExportSingleAgent,
  onOpenForm,
  onDeleteAgent,
}) => {
  if (agents.length === 0) {
    return <p className="text-muted-foreground text-center py-8">{t('agents.noAgentsMessage')}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map(agent => (
        <Card key={agent.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {agent.name}
              {agent.isDefault && <span className="text-xs text-primary font-normal ml-2">{t('agents.defaultAgentBadge')}</span>}
            </CardTitle>
            <CardDescription className="text-xs h-10 overflow-hidden text-ellipsis">{agent.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1 flex-grow">
            <p>
              <strong>{t('agents.llmLabel')}</strong>{' '}
              {agent.llmConfig.useGlobal
                ? t('agents.llmGlobalFormat', { provider: globalSettings.llmConfig.provider })
                : t('agents.llmCustomFormat', { provider: agent.llmConfig.customConfig?.provider || t('agents.llmNotApplicable') })}
            </p>
            <p>
              <strong>{t('agents.capabilitiesLabel')}</strong>{' '}
              {Object.entries(agent.capabilities)
                .filter(([, val]) => val)
                .map(([key]) => {
                  const capabilityKey = `agents.form.capability.${key}` as TranslationKey;
                  const translatedCap = t(capabilityKey);
                  return translatedCap !== capabilityKey ? translatedCap : key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());
                })
                .join(', ') || t('agents.noCapabilities')}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-1 p-2">
            <Button variant="ghost" size="icon" title={t('agents.action.test')} onClick={() => onTestAgent(agent)}>
              <PlayCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title={t('agents.action.export')} onClick={() => onExportSingleAgent(agent)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title={t('agents.action.edit')} onClick={() => onOpenForm(agent)} disabled={agent.isNameEditable === false}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title={t('agents.action.delete')} onClick={() => onDeleteAgent(agent)} disabled={agent.isDeletable === false}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default AgentListDisplay;
