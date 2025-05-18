
// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useAppState } from './AppStateContext';
import { translations, type TranslationKey, type TranslationSet, isTranslationSet } from '@/lib/i18n/translations';
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
 * Helper function to recursively get a nested translation string.
 * It first checks if the key exists directly on the object (e.g., for keys containing dots like "app.title").
 * If not found, it attempts to resolve a dot-separated path (e.g., "settings.llm.title").
 *
 * @param {string} key - The translation key.
 * @param {TranslationSet | undefined} translationsObject - The translation object for the current language.
 * @returns {string | undefined} The translated string or undefined if not found.
 */
const getNestedTranslation = (key: string, translationsObject?: TranslationSet): string | undefined => {
  if (!isTranslationSet(translationsObject)) {
    return undefined;
  }

  // 1. Check for direct key match first (handles keys like "app.title")
  if (Object.prototype.hasOwnProperty.call(translationsObject, key)) {
    const directValue = translationsObject[key];
    if (typeof directValue === 'string') {
      return directValue;
    }
    // If it's an object, it means the key was like "settings" but we expected a string.
    // The dot-separated logic below will handle nested access like "settings.title".
    // So, if directValue is an object, we let the nested logic proceed or fail.
  }

  // 2. Try to resolve as a dot-separated nested path
  const keys = key.split('.');
  let result: string | TranslationSet | undefined = translationsObject;

  for (const k of keys) {
    if (isTranslationSet(result) && Object.prototype.hasOwnProperty.call(result, k)) {
      result = result[k];
    } else {
      return undefined; // Key path not found
    }
  }

  return typeof result === 'string' ? result : undefined; // Ensure final result is a string
};


/**
 * Provider component for the I18nContext.
 * It determines the active language based on `AppStateContext` and provides
 * the translation function `t` and language management utilities to its children.
 *
 * @param {object} props - The component's props.
 * @param {ReactNode} props.children - The child components to be wrapped by the provider.
 * @returns {JSX.Element} The I18nProvider component.
 */
export const I18nProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const { settings, updateLanguage: updateAppLanguage } = useAppState();
  
  const activeLanguage = settings?.language && SUPPORTED_LANGUAGES.some(l => l.code === settings.language)
    ? settings.language
    : DEFAULT_LANGUAGE_CODE;

  /**
   * Updates the application language in the global AppState and localStorage.
   * Also updates the lang attribute on the HTML document.
   * @param {LanguageCode} langCode - The language code to set.
   */
  const setLanguage = useCallback((langCode: LanguageCode) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === langCode)) {
      updateAppLanguage(langCode); // This updates AppStateContext
      if (typeof window !== 'undefined') {
        document.documentElement.lang = langCode;
      }
    } else {
      console.warn(`[I18nContext] Attempted to set unsupported language: ${langCode}`);
    }
  }, [updateAppLanguage]);

  /**
   * Translates a given key using the currently active language.
   * Interpolates parameters if provided.
   * Falls back to the default language if a translation is not found in the active language.
   * If still not found, returns the key itself.
   * @param {TranslationKey} key - The key of the string to translate (e.g., "dashboard.welcome").
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation.
   * @returns {string} The translated string.
   */
  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let languageTranslations = translations[activeLanguage];
    let translatedString = getNestedTranslation(key, languageTranslations);

    // Fallback to default language if not found in active language
    if (translatedString === undefined && activeLanguage !== DEFAULT_LANGUAGE_CODE) {
      // console.warn(`[I18nContext] Translation not found for key: "${key}" in language: "${activeLanguage}". Falling back to default "${DEFAULT_LANGUAGE_CODE}".`);
      languageTranslations = translations[DEFAULT_LANGUAGE_CODE];
      translatedString = getNestedTranslation(key, languageTranslations);
    }

    if (translatedString === undefined) {
      console.error(`[I18nContext] Translation definitively not found for key: "${key}" in language: "${activeLanguage}" OR default language "${DEFAULT_LANGUAGE_CODE}".`);
      return key; // Return the key itself if no translation is found
    }

    if (params && typeof translatedString === 'string') {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, translatedString);
    }
    return typeof translatedString === 'string' ? translatedString : key;
  }, [activeLanguage]); // Dependency on activeLanguage ensures 't' is updated when language changes

  // Effect to set the HTML lang attribute when the active language changes
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
 * Must be used within an `I18nProvider`.
 * @returns {I18nContextType} The i18n context values and functions.
 * @throws {Error} If used outside of an `I18nProvider`.
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

    