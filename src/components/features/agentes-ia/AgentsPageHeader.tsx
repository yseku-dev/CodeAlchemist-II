// src/components/features/agentes-ia/AgentsPageHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Upload, Download, Users2, Sparkles as SparklesIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';
import type { Agent } from '@/types';

interface AgentsPageHeaderProps {
  t: (key: TranslationKey) => string;
  onOpenSuggestDialog: () => void;
  onImportAgents: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportAgents: () => void;
  agentsCount: number;
  onOpenForm: () => void;
}

const AgentsPageHeader: React.FC<AgentsPageHeaderProps> = ({
  t,
  onOpenSuggestDialog,
  onImportAgents,
  onExportAgents,
  agentsCount,
  onOpenForm,
}) => {
  return (
    <PageSectionHeader
      icon={Users2}
      title={t('agents.title')}
      description={t('agents.description')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenSuggestDialog}>
            <SparklesIcon className="mr-2 h-4 w-4" /> {t('agents.createWithAIButton')}
          </Button>
          <Input type="file" accept=".json" onChange={onImportAgents} className="hidden" id="import-agents-input-page" />
          <Button variant="outline" onClick={() => document.getElementById('import-agents-input-page')?.click()}>
            <Upload className="mr-2 h-4 w-4" />{t('agents.importButton')}
          </Button>
          <Button variant="outline" onClick={onExportAgents} disabled={agentsCount === 0}>
            <Download className="mr-2 h-4 w-4" />{t('agents.exportAllButton')}
          </Button>
          <Button onClick={onOpenForm}>
            <PlusCircle className="mr-2 h-4 w-4" />{t('agents.createAgentButton')}
          </Button>
        </div>
      }
    />
  );
};

export default AgentsPageHeader;
