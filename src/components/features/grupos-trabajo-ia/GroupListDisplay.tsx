// src/components/features/grupos-trabajo-ia/GroupListDisplay.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit3, Trash2, Play } from 'lucide-react';
import type { AIAgentGroup } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GroupListDisplayProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  groups: AIAgentGroup[];
  isAnyGroupExecuting: boolean;
  onExecuteGroup: (group: AIAgentGroup) => void;
  onOpenForm: (group: AIAgentGroup) => void;
  onDeleteGroup: (group: AIAgentGroup) => void;
  isFormForGroupOpen: (groupId: string) => boolean;
}

const GroupListDisplay: React.FC<GroupListDisplayProps> = ({
  t,
  groups,
  isAnyGroupExecuting,
  onExecuteGroup,
  onOpenForm,
  onDeleteGroup,
  isFormForGroupOpen
}) => {
  if (groups.length === 0) {
    return <p className="text-muted-foreground text-center py-8">{t('groups.noGroupsMessage')}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map(group => (
        <Card key={group.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {group.name}
              {group.isDefault && <span className="text-xs text-primary font-normal ml-2">{t('groups.defaultGroupBadge')}</span>}
            </CardTitle>
            <CardDescription className="text-xs h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1 flex-grow">
            <p>
              <strong>{t('groups.agentsLabel')}</strong> {t('groups.agentsCountFormat', { count: group.agentIds.length })}
            </p>
            <p className="truncate">
              <strong>{t('groups.taskLabel')}</strong> {group.mainTask}
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-1 p-2">
            <Button variant="ghost" size="icon" title={t('groups.action.execute')} onClick={() => onExecuteGroup(group)} disabled={isAnyGroupExecuting}>
              <Play className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title={t('groups.action.edit')} onClick={() => onOpenForm(group)} disabled={isAnyGroupExecuting || isFormForGroupOpen(group.id)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title={t('groups.action.delete')} onClick={() => onDeleteGroup(group)} disabled={isAnyGroupExecuting}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default GroupListDisplay;
