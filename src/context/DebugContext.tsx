
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/**
 * @fileOverview Provides a context for managing debug mode and application logs.
 */

/**
 * Defines the shape of the debug context.
 */
interface DebugContextType {
  /** Whether debug mode is currently active. */
  debugMode: boolean;
  /** Function to enable or disable debug mode. */
  setDebugMode: (mode: boolean) => void;
  /** Array of accumulated log entries. Each entry can be a string or a record. */
  logs: (string | Record<string, any>)[];
  /** Adds a new log entry if debug mode is active. */
  addLog: (log: string | Record<string, any>) => void;
  /** Clears all accumulated log entries. */
  clearLogs: () => void;
  /** Placeholder function for copying logs (actual implementation might be in UI component). */
  copyLogs: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

/**
 * Provider component for the DebugContext.
 * Manages the debug mode state and log entries, persisting debug mode to localStorage.
 * @param {object} props - The component's props.
 * @param {ReactNode} props.children - The child components to be wrapped by the provider.
 * @returns {JSX.Element} The DebugProvider component.
 */
export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [debugModeStorage, setDebugModeStorage] = useLocalStorage<boolean>('codealchemist-debug-mode', false);
  const [debugMode, setDebugModeState] = useState<boolean>(debugModeStorage);
  const [logs, setLogs] = useState<(string | Record<string, any>)[]>([]);

  /**
   * Sets the debug mode state and persists it to localStorage.
   * @param {boolean} mode - The new debug mode state.
   */
  const setDebugMode = useCallback((mode: boolean) => {
    setDebugModeState(mode);
    setDebugModeStorage(mode);
  }, [setDebugModeStorage]);

  /**
   * Adds a log entry to the internal logs state if debug mode is active.
   * Timestamps are automatically prepended to string logs.
   * @param {string | Record<string, any>} log - The log message or object.
   */
  const addLog = useCallback((log: string | Record<string, any>) => {
    if (debugMode) { // Only add logs if debug mode is active
      const timestamp = new Date().toLocaleTimeString();
      const formattedLog = typeof log === 'string' ? `[${timestamp}] ${log}` : { timestamp, ...log };
      setLogs((prevLogs) => [...prevLogs, formattedLog]);
    }
  }, [debugMode]);

  /**
   * Clears all log entries from the state.
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * Placeholder function for copying logs. The actual clipboard logic
   * might reside in the UI component displaying the logs.
   */
  const copyLogs = useCallback(() => {
    // Logic to copy logs to clipboard is in DebugPanel component
    // This function can be used to trigger a toast notification if needed
    console.log("Logs copy action triggered from context");
  }, []);
  
  // Effect to sync debugMode state if changed directly in localStorage by another tab (or by settings page)
  React.useEffect(() => {
    setDebugModeState(debugModeStorage);
  }, [debugModeStorage]);


  return (
    <DebugContext.Provider value={{ debugMode, setDebugMode, logs, addLog, clearLogs, copyLogs }}>
      {children}
    </DebugContext.Provider>
  );
};

/**
 * Custom hook to access the debug context.
 * Must be used within a `DebugProvider`.
 * @returns {DebugContextType} The debug context values and functions.
 * @throws {Error} If used outside of a `DebugProvider`.
 */
export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};
