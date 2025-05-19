// src/lib/i18n/translations.ts

// Importaciones de Español
import esCommon from './locales/es/common.json';
import esDashboard from './locales/es/dashboard.json';
import esSettings from './locales/es/settings.json';
import esGenerateCode from './locales/es/generateCode.json';
import esGenerateProject from './locales/es/generateProject.json';
import esAnalyzeCode from './locales/es/analyzeCode.json';
import esAnalyzeProject from './locales/es/analyzeProject.json';
import esRefactorProject from './locales/es/refactorProject.json';
import esAutoupdate from './locales/es/autoupdate.json';
import esVersions from './locales/es/versions.json';
import esChat from './locales/es/chat.json';
import esAgents from './locales/es/agents.json';
import esGroups from './locales/es/groups.json';
import esLayout from './locales/es/layout.json';
import esError from './locales/es/error.json';
import esFlows from './locales/es/flows.json';
import esFileTree from './locales/es/fileTree.json';
import esCodeEditor from './locales/es/codeEditor.json';

// Importaciones de Inglés
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enSettings from './locales/en/settings.json';
import enGenerateCode from './locales/en/generateCode.json';
import enGenerateProject from './locales/en/generateProject.json';
import enAnalyzeCode from './locales/en/analyzeCode.json';
import enAnalyzeProject from './locales/en/analyzeProject.json';
import enRefactorProject from './locales/en/refactorProject.json';
import enAutoupdate from './locales/en/autoupdate.json';
import enVersions from './locales/en/versions.json';
import enChat from './locales/en/chat.json';
import enAgents from './locales/en/agents.json';
import enGroups from './locales/en/groups.json';
import enLayout from './locales/en/layout.json';
import enError from './locales/en/error.json';
import enFlows from './locales/en/flows.json';
import enFileTree from './locales/en/fileTree.json';
import enCodeEditor from './locales/en/codeEditor.json';

import type { LanguageCode } from '@/types';

/**
 * @fileOverview Centralized translation strings for the CodeAlchemist application.
 * This file imports translations from language-specific JSON files and exports
 * them in a structure usable by the I18nContext. It also defines common
 * internationalization-related types.
 */

/**
 * Type for a single language's translations, mapping keys to strings or nested objects.
 * A nested object allows for grouping translations, e.g., `settings: { title: "..." }`.
 */
export type TranslationSet = {
  [key: string]: string | TranslationSet;
};

/**
 * Defines the structure for a single language's complete set of translations,
 * organized by feature or page.
 */
export interface LanguageTranslations {
  common: TranslationSet;
  dashboard: TranslationSet;
  settings: TranslationSet;
  generateCode: TranslationSet;
  generateProject: TranslationSet;
  analyzeCode: TranslationSet;
  analyzeProject: TranslationSet;
  refactorProject: TranslationSet;
  autoupdate: TranslationSet;
  versions: TranslationSet;
  chat: TranslationSet;
  agents: TranslationSet;
  groups: TranslationSet;
  layout: TranslationSet;
  error: TranslationSet;
  flows: TranslationSet;
  fileTree: TranslationSet;
  codeEditor: TranslationSet;
  [key: string]: TranslationSet | undefined;
}

/**
 * Type for all translations, mapping language codes (e.g., 'es', 'en')
 * to their respective `LanguageTranslations`.
 */
export type AllTranslations = {
  [lang in LanguageCode]: LanguageTranslations;
};

/**
 * Represents a key that can be used to look up a translation.
 * Using `string` for flexibility with dot-separated keys that reference nested structures.
 */
export type TranslationKey = string;

/**
 * The primary export containing all translations for the application.
 * Each language object now contains top-level keys corresponding to the imported JSON files.
 */
export const translationsData: AllTranslations = {
  es: {
    common: esCommon,
    dashboard: esDashboard,
    settings: esSettings,
    generateCode: esGenerateCode,
    generateProject: esGenerateProject,
    analyzeCode: esAnalyzeCode,
    analyzeProject: esAnalyzeProject,
    refactorProject: esRefactorProject,
    autoupdate: esAutoupdate,
    versions: esVersions,
    chat: esChat,
    agents: esAgents,
    groups: esGroups,
    layout: esLayout,
    error: esError,
    flows: esFlows,
    fileTree: esFileTree,
    codeEditor: esCodeEditor,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    settings: enSettings,
    generateCode: enGenerateCode,
    generateProject: enGenerateProject,
    analyzeCode: enAnalyzeCode,
    analyzeProject: enAnalyzeProject,
    refactorProject: enRefactorProject,
    autoupdate: enAutoupdate,
    versions: enVersions,
    chat: enChat,
    agents: enAgents,
    groups: enGroups,
    layout: enLayout,
    error: enError,
    flows: enFlows,
    fileTree: enFileTree,
    codeEditor: enCodeEditor,
  },
};

// Type guard to check if a value is a TranslationSet (for nested structures)
export function isTranslationSet(value: any): value is TranslationSet {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
