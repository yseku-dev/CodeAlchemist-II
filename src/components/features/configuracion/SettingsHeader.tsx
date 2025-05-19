// src/components/features/configuracion/SettingsHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download, Save, Settings as SettingsIcon } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface SettingsHeaderProps {
  t: (key: TranslationKey) => string;
  onImportConfig: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportConfig: () => void;
  onSaveSettings: () => void;
  importConfigInputRef: React.RefObject<HTMLInputElement>;
}

const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  t,
  onImportConfig,
  onExportConfig,
  onSaveSettings,
  importConfigInputRef,
}) => {
  return (
    <PageSectionHeader
      icon={SettingsIcon}
      title={t('settings.title')}
      description={t('settings.description')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Input type="file" id="import-config-input-page" ref={importConfigInputRef} className="hidden" onChange={onImportConfig} accept=".json" />
          <Button variant="outline" onClick={() => importConfigInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />{t('settings.importButton')}
          </Button>
          <Button variant="outline" onClick={onExportConfig}>
            <Download className="mr-2 h-4 w-4" />{t('settings.exportButton')}
          </Button>
          <Button onClick={onSaveSettings}>
            <Save className="mr-2 h-4 w-4" />{t('settings.saveButton')}
          </Button>
        </div>
      }
    />
  );
};

export default SettingsHeader;
