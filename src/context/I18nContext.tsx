
// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useAppState } from './AppStateContext';
import { translationsData, type TranslationKey, type LanguageTranslations, type TranslationSet, isTranslationSet } from '@/lib/i18n/translations';
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from '@/lib/i18n/constants';
import type { LanguageCode } from '@/types';

/**
 * @fileOverview Provides internationalization (i18n) context and utilities.
 * Manages the current language and provides a translation function `t`.
 * This context relies on `AppStateContext` for language persistence and updates.
 */

/**
 * Defines the shape of the i18n context.
 */
interface I18nContextType {
  /** The currently active language code (e.g., 'es', 'en'). */
  language: LanguageCode;
  /**
   * Function to change the current language. This updates the language in AppState.
   * @param {LanguageCode} lang - The new language code to set.
   */
  setLanguage: (lang: LanguageCode) => void;
  /**
   * The translation function.
   * @param {TranslationKey} key - The key of the string to translate (e.g., "dashboard.welcome" or "settings.title").
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation (e.g., { name: "Usuario" }).
   * @returns {string} The translated string, or the key itself if not found.
   */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Array of supported language objects, each with a code and native name. */
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Helper function to recursively get a nested translation string from a specific language's translations.
 *
 * @param {string} key - The translation key (e.g., "dashboard.welcome" or "settings.llm.title").
 * @param {LanguageCode} langToUse - The language code to use for translation.
 * @param {typeof translationsData} allTranslations - The complete translations object.
 * @returns {string | undefined} The translated string or undefined if not found.
 */
const getNestedTranslation = (key: TranslationKey, langToUse: LanguageCode, allTranslations: typeof translationsData): string | undefined => {
  const languageTranslations: LanguageTranslations | undefined = allTranslations[langToUse];

  // Uncomment these logs for deep debugging if issues persist:
  // console.log(`[I18nContext DEBUG] getNestedTranslation: key="${key}", langToUse="${langToUse}"`);
  // if (typeof window !== 'undefined') { // Client-side only log for easier inspection
  //    console.log(`[I18nContext DEBUG Client] translationsData for ${langToUse}:`, languageTranslations);
  // }


  if (!languageTranslations || typeof languageTranslations !== 'object') {
    // console.warn(`[I18nContext DEBUG] No translation set or not an object for language: "${langToUse}" (key: "${key}")`);
    return undefined;
  }

  const keys = key.split('.'); // e.g., "autoupdate.config.title" -> ["autoupdate", "config", "title"]
  if (keys.length === 0) {
    // console.warn(`[I18nContext DEBUG] Empty key parts for key: "${key}"`);
    return undefined;
  }

  let current: TranslationSet | string | undefined = languageTranslations;

  for (let i = 0; i < keys.length; i++) {
    const part = keys[i];
    // console.log(`[I18nContext DEBUG] Traversing: part="${part}", current type="${typeof current}"`, current);
    if (isTranslationSet(current) && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      // console.warn(`[I18nContext DEBUG] Key segment "${part}" (part ${i+1} of "${key}") not found in language "${langToUse}". Current object segment:`, current);
      return undefined; // Path segment not found
    }
  }
  
  // console.log(`[I18nContext DEBUG] Resolved key "${key}" in language "${langToUse}" to:`, typeof current === 'string' ? current : `Not a string (type: ${typeof current})`);
  return typeof current === 'string' ? current : undefined;
};


/**
 * Provider component for the I18nContext.
 */
export const I18nProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const { settings, updateLanguage: updateAppLanguage } = useAppState();
  
  const activeLanguage = settings?.language && SUPPORTED_LANGUAGES.some(l => l.code === settings.language)
    ? settings.language
    : DEFAULT_LANGUAGE_CODE;

  const setLanguage = useCallback((langCode: LanguageCode) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === langCode)) {
      updateAppLanguage(langCode);
    } else {
      console.warn(`[I18nContext] Attempted to set unsupported language: ${langCode}`);
    }
  }, [updateAppLanguage]);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let translatedString = getNestedTranslation(key, activeLanguage, translationsData);

    if (translatedString === undefined && activeLanguage !== DEFAULT_LANGUAGE_CODE) {
      // console.warn(`[I18nContext] Translation not found for key: "${key}" in language: "${activeLanguage}". Falling back to default "${DEFAULT_LANGUAGE_CODE}".`);
      translatedString = getNestedTranslation(key, DEFAULT_LANGUAGE_CODE, translationsData);
    }

    if (translatedString === undefined) {
      // This console.error is the one triggering in your screenshot
      console.error(`[I18nContext] Translation definitively not found for key: "${key}" in language: "${activeLanguage}" OR default language "${DEFAULT_LANGUAGE_CODE}".`);
      return key; // Return the key itself if no translation is found
    }

    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, translatedString);
    }
    return translatedString;
  }, [activeLanguage]); // `translationsData` and `DEFAULT_LANGUAGE_CODE` are static and don't need to be dependencies

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = activeLanguage;
    }
  }, [activeLanguage]);


  const providerValue: I18nContextType = {
    language: activeLanguage,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <I18nContext.Provider value={providerValue}>
      {children}
    </I18nContext.Provider>
  );
};

/**
 * Custom hook to access the i18n context.
 * @returns {I18nContextType} The i18n context object.
 * @throws {Error} If used outside of an `I18nProvider`.
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
