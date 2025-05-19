// src/components/features/analizar-codigo/AnalyzeCodeHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { ScanLine } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface AnalyzeCodeHeaderProps {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for the header of the "Analyze Code" page.
 * Uses PageSectionHeader to display the title, description, and icon.
 * All texts are internationalized.
 * @module AnalyzeCodeHeader
 */

/**
 * AnalyzeCodeHeader component.
 * Renders the standardized header for the "Analyze Code" section.
 *
 * @param {AnalyzeCodeHeaderProps} props - The props for the component.
 * @param {function} props.t - The translation function from `useI18n`.
 * @returns {JSX.Element} The rendered header component.
 */
const AnalyzeCodeHeader: React.FC<AnalyzeCodeHeaderProps> = ({ t }) => {
  return (
    <PageSectionHeader
      icon={ScanLine}
      title={t('analyzeCode.title')}
      description={t('analyzeCode.description')}
    />
  );
};

export default AnalyzeCodeHeader;
