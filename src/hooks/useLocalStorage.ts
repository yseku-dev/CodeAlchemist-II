
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast'; // Ajusta la ruta si es necesario

/**
 * @fileOverview Custom React hook `useLocalStorage`.
 * This hook provides a way to persist React state to `localStorage`
 * and keep it synchronized across browser tabs/windows.
 * It handles server-side rendering (SSR) gracefully by initially returning
 * the `defaultValue` and then hydrating with the `localStorage` value on the client.
 * Includes error handling for QuotaExceededError when saving to localStorage.
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
        // No mostrar toast aquí, se manejará en useLocalStorage si es crítico
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
 * Includes error handling for QuotaExceededError when saving to localStorage.
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
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const { toast } = useToast();
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedValue = getStorageValue(key, defaultValue);
      setValue(storedValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]); // defaultValue is intentionally omitted from deps

  const setStoredValue = useCallback(
    (newValue: T | ((val: T) => T)) => {
      try {
        const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
        setValue(valueToStore);
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error: any) {
        console.error(`Error guardando en localStorage (clave: "${key}"):`, error);
        if (error.name === 'QuotaExceededError' || (error.message && error.message.toLowerCase().includes('quota'))) {
          toast({
            variant: 'destructive',
            title: 'Error de Almacenamiento Local', // TODO: i18n this
            description: `No se pudo guardar la información (clave: ${key}). El almacenamiento local está lleno. Considera exportar datos o limpiar snapshots/versiones guardadas.`, // TODO: i18n this
            duration: 7000,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error de Almacenamiento', // TODO: i18n this
            description: `Ocurrió un error al intentar guardar en localStorage para la clave ${key}.`, // TODO: i18n this
            duration: 5000,
          });
        }
        // No relanzar el error aquí para no romper la app, el toast es la notificación.
      }
    },
    [key, value, toast, defaultValue] // defaultValue added here as if an error occurs, we might revert to it.
  );
  
  // Sincronización entre pestañas
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === localStorage) {
        if (event.newValue !== null) {
          try {
            setValue(JSON.parse(event.newValue) as T);
          } catch (error) {
            console.error(`Error al parsear clave de localStorage "${key}" en evento de storage:`, error);
            setValue(defaultValue); // Revertir al valor por defecto si el parseo falla
          }
        } else {
          // La clave fue eliminada o establecida a null en otra pestaña
          setValue(defaultValue);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [key, defaultValue]);

  return [value, setStoredValue];
}

