// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useCallback, ReactNode, useEffect } from 'react';
import { useAppState } from './AppStateContext';
import { translations, type TranslationKey } from '@/lib/i18n/translations';
import type { LanguageCode } from '@/types';
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from '@/lib/i18n/constants';

/**
 * @fileOverview Provides internationalization (i18n) context and utilities.
 * Manages the current language and provides a translation function `t`.
 */

/**
 * Defines the shape of the i18n context.
 */
interface I18nContextType {
  /** The currently active language code (e.g., 'es', 'en'). */
  language: LanguageCode;
  /**
   * Function to change the current language.
   * @param {LanguageCode} lang - The new language code to set.
   */
  setLanguage: (lang: LanguageCode) => void;
  /**
   * The translation function.
   * @param {TranslationKey} key - The key of the string to translate (must exist in translations).
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation.
   * @returns {string} The translated string, or the key itself if not found.
   */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Array of supported language objects. */
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Provider component for the I18nContext.
 * It wraps parts of the application that need access to translations and language settings.
 * It synchronizes its language state with `AppStateContext`.
 *
 * @param {object} props - The component's props.
 * @param {ReactNode} props.children - The child components to be wrapped by the provider.
 * @returns {JSX.Element} The I18nProvider component.
 */
export const I18nProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const { settings, updateLanguage: updateAppLanguage } = useAppState();
  
  // The language from AppStateContext is the source of truth.
  const activeLanguage = settings?.language || DEFAULT_LANGUAGE_CODE;

  /**
   * Sets the application language.
   * Updates the global AppStateContext, which will trigger re-renders.
   * Also updates the HTML lang attribute.
   * @param {LanguageCode} langCode - The language code to set.
   */
  const setLanguage = useCallback((langCode: LanguageCode) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === langCode)) {
      if (updateAppLanguage) {
        updateAppLanguage(langCode); // Update global state via AppStateContext
      }
      if (typeof window !== 'undefined') {
        document.documentElement.lang = langCode;
      }
    } else {
      console.warn(`[I18nProvider] Attempted to set unsupported language: ${langCode}`);
    }
  }, [updateAppLanguage]);

  /**
   * Retrieves a translated string for a given key and language.
   * Supports basic parameter interpolation.
   * @param {TranslationKey} key - The key of the string to translate.
   * @param {LanguageCode} langToUse - The target language code.
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation.
   * @returns {string} The translated string, or the key if not found.
   */
  const translate = useCallback((key: TranslationKey, langToUse: LanguageCode, params?: Record<string, string | number>): string => {
    const effectiveLang = SUPPORTED_LANGUAGES.some(l => l.code === langToUse) ? langToUse : DEFAULT_LANGUAGE_CODE;
    let translationSet = translations[effectiveLang];

    // Fallback to default language if the current language's translations are missing
    if (!translationSet) {
        console.warn(`[I18nProvider] No translation set for language: "${effectiveLang}", falling back to default language: "${DEFAULT_LANGUAGE_CODE}".`);
        translationSet = translations[DEFAULT_LANGUAGE_CODE];
    }
    
    const keys = key.split('.');
    let text: any = translationSet;
    for (const k of keys) {
        if (text && typeof text === 'object' && k in text) {
            text = text[k];
        } else {
            text = undefined; // Key path not found
            break;
        }
    }

    if (typeof text !== 'string') {
      console.warn(`[I18nProvider] Translation not found for key: "${key}" in language: "${effectiveLang}". Falling back to key.`);
      return key;
    }

    if (params) {
      return Object.entries(params).reduce((acc, [paramKey, paramValue]) => {
        return acc.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, text);
    }
    return text;
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    return translate(key, activeLanguage, params);
  }, [activeLanguage, translate]);

  // Effect to set initial HTML lang attribute and update if activeLanguage changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = activeLanguage;
    }
  }, [activeLanguage]);

  const providerValue: I18nContextType = {
    language: activeLanguage,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES
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
 * @returns {I18nContextType} The i18n context values and functions (language, setLanguage, t).
 * @throws {Error} If used outside of an `I18nProvider`.
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
