// src/components/features/chat-ia/ChatHeader.tsx
"use client";

import React from 'react';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview Component for the header of the "AI Chat" page.
 * Uses PageSectionHeader to display the title, description, and icon.
 * All texts are internationalized.
 * @module ChatHeader
 */

/**
 * ChatHeader component.
 * Renders the standardized header for the "AI Chat" section.
 *
 * @returns {JSX.Element} The rendered header component.
 */
const ChatHeader: React.FC = () => {
  const { t } = useI18n();

  return (
    <PageSectionHeader
      icon={MessageCircle}
      title={t('chat.title' as TranslationKey)}
      description={t('chat.description' as TranslationKey)}
    />
  );
};

export default ChatHeader;
