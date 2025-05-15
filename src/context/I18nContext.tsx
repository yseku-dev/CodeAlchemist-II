
// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useAppState } from './AppStateContext'; // To get the current language
import { translations, type TranslationKey, type LanguageCode } from '@/lib/i18n/translations';
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from '@/lib/i18n/constants';

/**
 * @fileOverview Provides internationalization (i18n) context and utilities.
 * Manages the current language and provides a translation function `t`.
 */

/**
 * Defines the shape of the i18n context.
 */
interface I18nContextType {
  /** The currently active language code (e.g., 'es', 'en'), derived directly from AppState. */
  language: LanguageCode;
  /**
   * Function to change the current language. This updates the language in AppState.
   * @param {LanguageCode} lang - The new language code to set.
   */
  setLanguage: (lang: LanguageCode) => void;
  /**
   * The translation function.
   * @param {TranslationKey} key - The key of the string to translate.
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation.
   * @returns {string} The translated string, or the key itself if not found.
   */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Array of supported language objects. */
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Helper function to recursively get a nested translation string.
 * It first checks if the key exists directly, then attempts to resolve a dot-separated path.
 * @param {string} key - The key (e.g., "app.title" or "settings.title").
 * @param {any} translationsObject - The translation object for the current language.
 * @returns {string | undefined} The translated string or undefined if not found.
 */
const getNestedTranslation = (key: string, translationsObject: any): string | undefined => {
  if (!translationsObject || typeof translationsObject !== 'object') {
    return undefined;
  }
  // Check for direct key first (handles keys like "app.title")
  if (Object.prototype.hasOwnProperty.call(translationsObject, key)) {
    const directValue = translationsObject[key];
    if (typeof directValue === 'string') {
      return directValue;
    }
  }
  // If not found directly, try to resolve as a nested path
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), translationsObject);
};


/**
 * Provider component for the I18nContext.
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
      updateAppLanguage(langCode);
      if (typeof window !== 'undefined') {
        document.documentElement.lang = langCode;
      }
    } else {
      console.warn(`[I18nProvider] Attempted to set unsupported language: ${langCode}`);
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
      console.warn(`[I18nContext] Translation not found for key: "${key}" in language: "${activeLanguage}". Falling back to default "${DEFAULT_LANGUAGE_CODE}".`);
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
  }, [activeLanguage]);

  // Effect to set the HTML lang attribute when the active language changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = activeLanguage;
    }
  }, [activeLanguage]);


  const providerValue = {
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

