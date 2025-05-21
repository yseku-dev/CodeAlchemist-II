
// src/components/features/versiones-guardadas/SnapshotsActionsBar.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileJson, GitCompareArrows, Trash2, Server } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Loader2 } from 'lucide-react';

interface SnapshotsActionsBarProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onSaveSnapshotOfCurrentState: (type: 'config' | 'projectSource') => void;
  onCompareVersions: () => void;
  onDeleteAllSnapshots: () => void;
  isCompareDisabled: boolean;
  isDeleteAllDisabled: boolean;
  isSavingProjectSource: boolean;
}

const SnapshotsActionsBar: React.FC<SnapshotsActionsBarProps> = ({
  t,
  onSaveSnapshotOfCurrentState,
  onCompareVersions,
  onDeleteAllSnapshots,
  isCompareDisabled,
  isDeleteAllDisabled,
  isSavingProjectSource,
}) => {
  return (
    <div className="mb-6 space-y-3"> {/* Reducido el espacio y- de 4 a 3 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start"> {/* Reducido el gap de 4 a 3 */}
        <div className="flex-grow w-full sm:w-auto space-y-1">
            <Button onClick={() => onSaveSnapshotOfCurrentState('config')} variant="outline" className="w-full">
                <FileJson className="mr-2 h-4 w-4" /> {t('versions.saveConfigStateButton')}
            </Button>
            <p className="text-xs text-muted-foreground px-1">{t('versions.saveConfigStateDescription')}</p>
        </div>
         <div className="flex-grow w-full sm:w-auto space-y-1">
            <Button 
              onClick={() => onSaveSnapshotOfCurrentState('projectSource')} 
              variant="outline" 
              className="w-full"
              disabled={isSavingProjectSource}
            >
                {isSavingProjectSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Server className="mr-2 h-4 w-4" />} 
                {isSavingProjectSource ? t('versions.savingProjectSourceButtonLoading') : t('versions.saveProjectSourceButton')}
            </Button>
            <p className="text-xs text-muted-foreground px-1">{t('versions.saveProjectSourceDescription')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-start pt-2"> {/* Añadido pt-2 para separar de los botones de arriba */}
          <Button onClick={onCompareVersions} disabled={isCompareDisabled} variant="outline">
            <GitCompareArrows className="mr-2 h-4 w-4" /> {t('versions.compareButton')}
          </Button>
          <Button onClick={onDeleteAllSnapshots} variant="destructive" disabled={isDeleteAllDisabled}>
            <Trash2 className="mr-2 h-4 w-4" /> {t('versions.deleteAllButton')}
          </Button>
      </div>
    </div>
  );
};

export default SnapshotsActionsBar;

  