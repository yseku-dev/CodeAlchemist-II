// src/components/features/generar-proyecto/GenerateProjectHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { FolderPlus } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview Component for the header of the "Generate Project" page.
 * Uses PageSectionHeader to display the title, description, and icon.
 * All texts are internationalized.
 * @module GenerateProjectHeader
 */

/**
 * GenerateProjectHeader component.
 * Renders the standardized header for the "Generate Project" section.
 *
 * @returns {JSX.Element} The rendered header component.
 */
const GenerateProjectHeader: React.FC = () => {
  const { t } = useI18n();

  return (
    <PageSectionHeader
      icon={FolderPlus}
      title={t('generateProject.title' as TranslationKey)}
      description={t('generateProject.description' as TranslationKey)}
    />
  );
};

export default GenerateProjectHeader;
