
// src/lib/i18n/translations.ts

import esTranslations from './locales/es.json';
import enTranslations from './locales/en.json';
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
 * Type for all translations, mapping language codes (e.g., 'es', 'en')
 * to their respective `TranslationSet`.
 */
export type AllTranslations = {
  [lang in LanguageCode]: TranslationSet;
};

/**
 * Represents a key that can be used to look up a translation.
 * Using `string` for flexibility with dot-separated keys that reference nested structures.
 */
export type TranslationKey = string;


/**
 * The primary export containing all translations for the application.
 */
export const translations: AllTranslations = {
  es: esTranslations as TranslationSet,
  en: enTranslations as TranslationSet,
};

// Type guard to check if a value is a TranslationSet (for nested structures)
export function isTranslationSet(value: any): value is TranslationSet {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
