
// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useAppState } from './AppStateContext'; // To get the current language
import { translationsData, type TranslationKey, type TranslationSet, isTranslationSet } from '@/lib/i18n/translations';
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from '@/lib/i18n/constants';
import type { LanguageCode } from '@/types';

/**
 * @fileOverview Provides internationalization (i18n) context and utilities.
 * Manages the current language and provides a translation function `t`.
 * This context relies on `AppStateContext` for language persistence and updates.
 * Translations are now loaded from granular JSON files per language and page/feature.
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
 * It now expects keys like "dashboard.welcome" or "settings.llm.title", where the first part
 * corresponds to the imported JSON file (e.g., "dashboard", "settings") and the rest is the path within that file.
 *
 * @param {string} key - The translation key (e.g., "dashboard.welcome").
 * @param {LanguageCode} langToUse - The language code to use for translation.
 * @param {AllTranslations} allTranslations - The complete translations object.
 * @returns {string | undefined} The translated string or undefined if not found.
 */
const getNestedTranslation = (key: string, langToUse: LanguageCode, allTranslations: typeof translationsData): string | undefined => {
  const langData = allTranslations[langToUse];
  if (!langData || typeof langData !== 'object') {
    console.warn(`[I18nContext] No translations found for language: "${langToUse}"`);
    return undefined;
  }

  const keys = key.split('.');
  if (keys.length === 0) return undefined;

  const topLevelKey = keys[0] as keyof typeof langData; // e.g., "dashboard", "settings"
  let currentObject: string | TranslationSet | undefined = langData[topLevelKey];

  if (!isTranslationSet(currentObject)) {
     // Handle cases like t('app.title') where "app" might be a direct key in a "layout.json" or "common.json"
     // This part handles keys that might NOT start with a filename-like segment if translations are merged differently
     // For our current structure (translationsData.es.dashboard.welcome), this direct check is less likely to be hit first for nested keys.
    if (Object.prototype.hasOwnProperty.call(langData, key) && typeof langData[key as keyof typeof langData] === 'string') {
        return langData[key as keyof typeof langData] as string;
    }
    // If the topLevelKey itself doesn't point to an object, it means the key structure is wrong for this path.
    // console.warn(`[I18nContext] Top-level key "${topLevelKey}" not found or not an object in translations for language: "${langToUse}"`);
    return undefined;
  }

  // Traverse the rest of the key parts
  for (let i = 1; i < keys.length; i++) {
    const part = keys[i];
    if (isTranslationSet(currentObject) && Object.prototype.hasOwnProperty.call(currentObject, part)) {
      currentObject = currentObject[part];
    } else {
      return undefined; // Path not found
    }
  }

  return typeof currentObject === 'string' ? currentObject : undefined;
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
      if (typeof window !== 'undefined') {
        document.documentElement.lang = langCode;
      }
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
      console.error(`[I18nContext] Translation definitively not found for key: "${key}" in language: "${activeLanguage}" OR default language "${DEFAULT_LANGUAGE_CODE}".`);
      return key; // Return the key itself if no translation is found
    }

    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, translatedString);
    }
    return translatedString;
  }, [activeLanguage]);

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
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
