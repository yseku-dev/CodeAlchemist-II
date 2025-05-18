
// src/components/features/generar-codigo/GenerateCodeHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { CodeXml } from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n/translations';

interface GenerateCodeHeaderProps {
  t: (key: TranslationKey) => string;
}

/**
 * @fileoverview Componente para el encabezado de la página "Generar Código".
 * Utiliza PageSectionHeader para mostrar el título, descripción e icono.
 */
const GenerateCodeHeader: React.FC<GenerateCodeHeaderProps> = ({ t }) => {
  return (
    <PageSectionHeader
      icon={CodeXml}
      title={t('generateCode.title')}
      description={t('generateCode.description')}
    />
  );
};

export default GenerateCodeHeader;
