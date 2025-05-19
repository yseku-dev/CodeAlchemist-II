// src/components/features/analizar-proyecto/AnalyzeProjectHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { FolderSearch } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';
import { useI18n } from '@/context/I18nContext';

/**
 * @fileOverview Component for the header of the "Analyze Full Project" page.
 * Uses PageSectionHeader to display the title, description, and icon.
 * All texts are internationalized.
 * @module AnalyzeProjectHeader
 */

/**
 * AnalyzeProjectHeader component.
 * Renders the standardized header for the "Analyze Full Project" section.
 *
 * @returns {JSX.Element} The rendered header component.
 */
const AnalyzeProjectHeader: React.FC = () => {
  const { t } = useI18n();

  return (
    <PageSectionHeader
      icon={FolderSearch}
      title={t('analyzeProject.title')}
      description={t('analyzeProject.description')}
    />
  );
};

export default AnalyzeProjectHeader;
