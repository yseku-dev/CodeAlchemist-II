// src/components/features/configuracion/SettingsDebugCard.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bug } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface SettingsDebugCardProps {
  t: (key: TranslationKey) => string;
  isDebugMode: boolean;
  onDebugModeChange: (checked: boolean) => void;
}

const SettingsDebugCard: React.FC<SettingsDebugCardProps> = ({
  t,
  isDebugMode,
  onDebugModeChange,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Bug className="h-5 w-5 text-primary" />
        <div>
          <CardTitle className="text-xl">{t('settings.debug.title')}</CardTitle>
          <CardDescription>{t('settings.debug.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="debug-mode"
            checked={isDebugMode}
            onCheckedChange={onDebugModeChange}
          />
          <Label htmlFor="debug-mode">{t('settings.debug.switchLabel')}</Label>
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsDebugCard;
