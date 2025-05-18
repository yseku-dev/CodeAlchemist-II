
// src/lib/i18n/translations.ts

import type { LanguageCode } from '@/types'; // Assuming LanguageCode is 'es' | 'en' etc.
import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';

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
 * Type for all translations, mapping language codes (e.g., 'es', 'en')
 * to their respective `TranslationSet`.
 */
export type AllTranslations = {
  [lang in LanguageCode]: TranslationSet;
};

/**
 * Represents a key that can be used to look up a translation.
 * Using `string` for flexibility with dot-separated keys that reference nested structures.
 * For example, a key "settings.llm.title" would access `translations[currentLang].settings.llm.title`.
 */
export type TranslationKey = string;


/**
 * The primary export containing all translations for the application.
 * It combines imported JSON translation files into a single object structured
 * by language code.
 *
 * @example
 * // To get the Spanish translation for "app.title":
 * // translations.es["app.title"]
 * // Or, using a helper function that handles nesting for a key "settings.title":
 * // getNestedTranslation("settings.title", translations.es)
 */
export const translations: AllTranslations = {
  es: esTranslations as TranslationSet, // Cast to TranslationSet for type safety
  en: enTranslations as TranslationSet,
  // To add more languages:
  // 1. Create a new JSON file in src/lib/i18n/locales/ (e.g., fr.json).
  // 2. Import it: import frTranslations from './locales/fr.json';
  // 3. Add it here: fr: frTranslations as TranslationSet,
  // 4. Update the LanguageCode type in src/types/index.ts and SUPPORTED_LANGUAGES in src/lib/i18n/constants.ts.
};

// Type guard to check if a value is a TranslationSet (for nested structures)
export function isTranslationSet(value: any): value is TranslationSet {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

    