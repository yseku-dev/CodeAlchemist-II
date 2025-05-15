
// src/context/I18nContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAppState } from './AppStateContext'; // Corrected relative path
import { translations } from '@/lib/i18n/translations';
import type { TranslationKey } from '@/lib/i18n/translations'; // Use TranslationKey from translations
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
  
  // Initialize currentLanguage based on settings, or default if settings is not ready
  const initialLanguageFromSettings = settings && settings.language ? settings.language : DEFAULT_LANGUAGE_CODE;
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(initialLanguageFromSettings);

  // Effect to sync currentLanguage with settings.language from AppStateContext
  useEffect(() => {
    if (settings && settings.language && settings.language !== currentLanguage) {
      setCurrentLanguage(settings.language);
    }
  }, [settings, currentLanguage]); // Depend on settings object

  /**
   * Sets the application language.
   * Updates both the local I18nContext state and the global AppStateContext.
   * Also updates the HTML lang attribute.
   * @param {LanguageCode} lang - The language code to set.
   */
  const setLanguage = useCallback((lang: LanguageCode) => {
    if (SUPPORTED_LANGUAGES.some(l => l.code === lang)) {
      setCurrentLanguage(lang);
      if (updateAppLanguage) { // Ensure updateAppLanguage is defined
        updateAppLanguage(lang); // Update global state via AppStateContext
      }
      if (typeof window !== 'undefined') {
        document.documentElement.lang = lang;
      }
    } else {
      console.warn(`[I18nProvider] Attempted to set unsupported language: ${lang}`);
    }
  }, [updateAppLanguage]);

  /**
   * Retrieves a translated string for a given key and language.
   * Supports basic parameter interpolation (e.g., t("greeting", { name: "User" }) for "Hello, {name}").
   * @param {TranslationKey} key - The key of the string to translate.
   * @param {LanguageCode} lang - The target language code.
   * @param {Record<string, string | number>} [params] - Optional parameters for interpolation.
   * @returns {string} The translated string, or the key if not found.
   */
  const translate = useCallback((key: TranslationKey, lang: LanguageCode, params?: Record<string, string | number>): string => {
    let translationSet = translations[lang] || translations[DEFAULT_LANGUAGE_CODE];

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
      console.warn(`[I18nProvider] Translation not found for key: \"${key}\" in language: \"${lang}\". Falling back to key.`);
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
    return translate(key, currentLanguage, params);
  }, [currentLanguage, translate]);

  // Effect to set initial HTML lang attribute and update if currentLanguage changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  const providerValue: I18nContextType = {
    language: currentLanguage,
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

    