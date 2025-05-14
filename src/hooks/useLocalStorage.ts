
"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * @fileOverview Custom React hook `useLocalStorage`.
 * This hook provides a way to persist React state to `localStorage`
 * and keep it synchronized across browser tabs/windows.
 * It handles server-side rendering (SSR) gracefully by initially returning
 * the `defaultValue` and then hydrating with the `localStorage` value on the client.
 */

/**
 * Retrieves a value from localStorage by key.
 * If the key is not found or an error occurs during parsing, it returns the defaultValue.
 * This function is primarily for client-side usage.
 *
 * @template T The type of the value to retrieve.
 * @param {string} key - The key in localStorage.
 * @param {T} defaultValue - The default value to return if the key is not found or parsing fails.
 * @returns {T} The stored value or the default value.
 */
function getStorageValue<T>(key: string, defaultValue: T): T {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved) as T;
      } catch (error) {
        console.error(`Error al parsear la clave de localStorage "${key}":`, error);
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

/**
 * A custom React hook to manage state that persists in `localStorage`.
 * It synchronizes state with `localStorage` and across multiple browser tabs/windows
 * that share the same origin.
 *
 * For Server-Side Rendering (SSR), it initializes with `defaultValue` to prevent
 * hydration mismatches, and then updates to the `localStorage` value on the client-side
 * via a `useEffect` hook.
 *
 * @template T The type of the state to be stored.
 * @param {string} key - The key under which the value will be stored in `localStorage`.
 * @param {T} defaultValue - The initial value to use if no value is found in `localStorage`
 *                           or during server-side rendering.
 * @returns {[T, (value: T | ((val: T) => T)) => void]} A tuple containing the current state value
 *                                                       and a function to update it, similar to `useState`.
 *
 * @example
 * const [name, setName] = useLocalStorage<string>('userName', 'Invitado');
 * // `name` will be 'Invitado' on initial SSR/client render, then hydrate from localStorage.
 * // Calling `setName('Nuevo Nombre')` updates the state and localStorage.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Initialize state with defaultValue for SSR and initial client render.
  const [value, setValue] = useState<T>(defaultValue);

  // Effect to load from localStorage on client mount.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedValue = getStorageValue(key, defaultValue);
      setValue(storedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // Only re-run if key changes (should be rare for localStorage keys)


  // Effect to save to localStorage whenever the value changes.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Only save to localStorage if the current value is different from the initial defaultValue
      // to avoid writing defaultValue to localStorage on first load if nothing was stored.
      // Or, more simply, always save, which is typical.
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);

  // Effect to listen for storage changes from other tabs/windows.
  useEffect(() => {
    /**
     * Handles the 'storage' event fired by the browser.
     * Updates the component's state if the relevant localStorage key has changed.
     * @param {StorageEvent} event - The storage event.
     */
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
         try {
          setValue(JSON.parse(event.newValue) as T);
        } catch (error) {
          console.error(`Error al parsear la clave de localStorage "${key}" en el evento de storage:`, error);
        }
      } else if (event.key === key && event.newValue === null) {
        // Key was removed or set to null in another tab, revert to default.
        setValue(defaultValue);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, defaultValue]); // Include defaultValue in dependencies

  return [value, setValue];
}
