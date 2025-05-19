// src/components/features/grupos-trabajo-ia/GroupsPageHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { Button } from '@/components/ui/button';
import { PlusCircle, Workflow, Sparkles as SparklesIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GroupsPageHeaderProps {
  t: (key: TranslationKey) => string;
  onOpenSuggestDialog: () => void;
  onOpenForm: () => void;
  canSuggest: boolean;
}

const GroupsPageHeader: React.FC<GroupsPageHeaderProps> = ({
  t,
  onOpenSuggestDialog,
  onOpenForm,
  canSuggest,
}) => {
  return (
    <PageSectionHeader
      icon={Workflow}
      title={t('groups.title')}
      description={t('groups.description')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenSuggestDialog} disabled={!canSuggest}>
            <SparklesIcon className="mr-2 h-4 w-4" /> {t('groups.createWithAIButton')}
          </Button>
          <Button onClick={onOpenForm}>
            <PlusCircle className="mr-2 h-4 w-4" />{t('groups.createGroupButton')}
          </Button>
        </div>
      }
    />
  );
};

export default GroupsPageHeader;
