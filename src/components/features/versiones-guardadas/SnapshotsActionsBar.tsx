// src/components/features/versiones-guardadas/SnapshotsActionsBar.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileJson, FileArchive } from 'lucide-react'; // Adjusted icons
import type { TranslationKey } from '@/lib/i18n/translations';

interface SnapshotsActionsBarProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onSaveAppState: (downloadAsZip: boolean) => void;
}

const SnapshotsActionsBar: React.FC<SnapshotsActionsBarProps> = ({
  t,
  onSaveAppState,
}) => {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex-grow w-full sm:w-auto">
            <Button onClick={() => onSaveAppState(false)} variant="outline" className="w-full">
                <FileJson className="mr-2 h-4 w-4" /> {t('versions.saveAppStateButton')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">{t('versions.saveAppStateDescription')}</p>
        </div>
         <div className="flex-grow w-full sm:w-auto">
            <Button onClick={() => onSaveAppState(true)} variant="outline" className="w-full">
                <FileArchive className="mr-2 h-4 w-4" /> {t('versions.saveAndDownloadStateButton')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">{t('versions.saveAndDownloadStateDescription')}</p>
        </div>
      </div>
    </div>
  );
};

export default SnapshotsActionsBar;
