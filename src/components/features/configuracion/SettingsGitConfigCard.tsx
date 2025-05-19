// src/components/features/configuracion/SettingsGitConfigCard.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Info, GitBranch } from 'lucide-react';
import type { GitSettings } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
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

interface SettingsGitConfigCardProps {
  t: (key: TranslationKey) => string;
  config: GitSettings;
  onConfigChange: (field: keyof GitSettings, value: string) => void;
  onTestGit: () => void;
  isTestingGit: boolean;
  isMounted: boolean;
}

const SettingsGitConfigCard: React.FC<SettingsGitConfigCardProps> = ({
  t,
  config,
  onConfigChange,
  onTestGit,
  isTestingGit,
  isMounted,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <GitBranch className="h-5 w-5 text-primary" />
        <div>
          <CardTitle className="text-xl">{t('settings.git.title')}</CardTitle>
          <CardDescription>{t('settings.git.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <FieldLabelWithTooltip htmlFor="git-repo-url" labelKey={'settings.git.repoUrlLabel'} tooltipKey={'settings.git.repoUrlTooltip'} t={t} />
          <Input
            id="git-repo-url"
            value={config.repoUrl || ''}
            onChange={(e) => onConfigChange('repoUrl', e.target.value)}
            placeholder={isMounted ? t('settings.git.repoUrlPlaceholder') : 'settings.git.repoUrlPlaceholder'}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabelWithTooltip htmlFor="git-username" labelKey={'settings.git.usernameLabel'} tooltipKey={'settings.git.usernameTooltip'} t={t} />
            <Input
              id="git-username"
              value={config.username || ''}
              onChange={(e) => onConfigChange('username', e.target.value)}
              placeholder={isMounted ? t('settings.git.usernamePlaceholder') : 'settings.git.usernamePlaceholder'}
            />
          </div>
          <div className="space-y-2">
            <FieldLabelWithTooltip htmlFor="git-email" labelKey={'settings.git.emailLabel'} tooltipKey={'settings.git.emailTooltip'} t={t} />
            <Input
              id="git-email"
              type="email"
              value={config.email || ''}
              onChange={(e) => onConfigChange('email', e.target.value)}
              placeholder={isMounted ? t('settings.git.emailPlaceholder') : 'settings.git.emailPlaceholder'}
            />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabelWithTooltip htmlFor="git-pat" labelKey={'settings.git.patLabel'} tooltipKey={'settings.git.patTooltip'} t={t} />
          <Input
            id="git-pat"
            type="password"
            value={config.pat || ''}
            onChange={(e) => onConfigChange('pat', e.target.value)}
            placeholder={isMounted ? t('settings.git.patPlaceholder') : 'settings.git.patPlaceholder'}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onTestGit} disabled={isTestingGit}>
          {isTestingGit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isMounted ? (isTestingGit ? t('settings.git.testingConnectionButton') : t('settings.git.testConnectionButton')) : 'Test Connection'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SettingsGitConfigCard;
