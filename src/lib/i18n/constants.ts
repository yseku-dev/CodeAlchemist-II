
// src/lib/i18n/constants.ts

/**
 * @fileOverview Defines constants related to internationalization (i18n),
 * including supported languages and the default language code.
 */

import type { LanguageCode } from '@/types';

/**
 * Represents a supported language with its code and native name.
 */
interface SupportedLanguage {
  /** The ISO 639-1 language code (e.g., 'es', 'en'). */
  code: LanguageCode;
  /** The name of the language in its native form (e.g., "Español", "English"). */
  name: string;
}

/**
 * Array of languages supported by the application.
 * Add new languages here.
 * @constant {SupportedLanguage[]}
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  // Add other supported languages here
  // e.g., { code: 'fr', name: 'Français' },
] as const; // Using `as const` for stricter typing if needed elsewhere

/**
 * The default language code for the application.
 * This language will be used if no language is set by the user or if a translation is missing.
 * It must be one of the codes defined in `SUPPORTED_LANGUAGES`.
 * @constant {LanguageCode}
 */
export const DEFAULT_LANGUAGE_CODE: LanguageCode = 'es';
