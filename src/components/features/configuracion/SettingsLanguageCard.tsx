// src/components/features/configuracion/SettingsLanguageCard.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from 'lucide-react';
import type { LanguageCode } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';
import type { SUPPORTED_LANGUAGES } from '@/lib/i18n/constants'; // Only for type

interface SettingsLanguageCardProps {
  t: (key: TranslationKey) => string;
  currentLanguage: LanguageCode;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  onLanguageChange: (langCode: LanguageCode) => void;
  isMounted: boolean;
}

const SettingsLanguageCard: React.FC<SettingsLanguageCardProps> = ({
  t,
  currentLanguage,
  supportedLanguages,
  onLanguageChange,
  isMounted,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Languages className="h-5 w-5 text-primary" />
        <div>
          <CardTitle className="text-xl">{t('settings.language.title')}</CardTitle>
          <CardDescription>{t('settings.language.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="language-select">{t('settings.language.selectLabel')}</Label>
          <div className="flex items-center gap-2">
            <Select
              value={currentLanguage} 
              onValueChange={(value) => onLanguageChange(value as LanguageCode)}
            >
              <SelectTrigger id="language-select" className="flex-grow">
                <SelectValue placeholder={isMounted ? t('settings.language.selectPlaceholder') : 'settings.language.selectPlaceholder'} />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Languages className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsLanguageCard;
