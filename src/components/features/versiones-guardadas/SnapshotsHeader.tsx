// src/components/features/versiones-guardadas/SnapshotsHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { GitCompareArrows } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface SnapshotsHeaderProps {
  t: (key: TranslationKey) => string;
  actions?: React.ReactNode;
}

const SnapshotsHeader: React.FC<SnapshotsHeaderProps> = ({ t, actions }) => {
  return (
    <PageSectionHeader
      icon={GitCompareArrows}
      title={t('versions.title')}
      description={t('versions.description')}
      actions={actions}
    />
  );
};

export default SnapshotsHeader;
