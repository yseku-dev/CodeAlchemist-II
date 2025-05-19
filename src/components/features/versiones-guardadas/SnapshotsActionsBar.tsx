// src/components/features/versiones-guardadas/SnapshotsActionsBar.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { GitCompareArrows, Trash2, FileArchive, FileJson } from 'lucide-react'; // Adjusted icons based on actual use
import type { TranslationKey } from '@/lib/i18n/translations';

interface SnapshotsActionsBarProps {
  t: (key: TranslationKey) => string;
  onSaveAppState: (downloadAsZip: boolean) => void;
  onCompareVersions: () => void;
  compareDisabled: boolean;
  onDeleteAll: () => void;
  deleteAllDisabled: boolean;
}

const SnapshotsActionsBar: React.FC<SnapshotsActionsBarProps> = ({
  t,
  onSaveAppState,
  onCompareVersions,
  compareDisabled,
  onDeleteAll,
  deleteAllDisabled,
}) => {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex-grow">
            <Button onClick={() => onSaveAppState(false)} variant="outline" className="w-full sm:w-auto">
                <FileJson className="mr-2 h-4 w-4" /> {t('versions.saveAppStateButton')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 sm:max-w-xs">{t('versions.saveAppStateDescription')}</p>
        </div>
         <div className="flex-grow">
            <Button onClick={() => onSaveAppState(true)} variant="outline" className="w-full sm:w-auto">
                <FileArchive className="mr-2 h-4 w-4" /> {t('versions.saveAndDownloadStateButton')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 sm:max-w-xs">{t('versions.saveAndDownloadStateDescription')}</p>
        </div>
      </div>
       <div className="flex flex-wrap gap-2 justify-end">
        <Button onClick={onCompareVersions} disabled={compareDisabled} variant="outline">
          <GitCompareArrows className="mr-2 h-4 w-4" /> {t('versions.compareButton')}
        </Button>
        <Button onClick={onDeleteAll} variant="destructive" disabled={deleteAllDisabled}>
          <Trash2 className="mr-2 h-4 w-4" /> {t('versions.deleteAllButton')}
        </Button>
      </div>
    </div>
  );
};

export default SnapshotsActionsBar;
