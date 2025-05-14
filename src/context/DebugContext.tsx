
"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface DebugContextType {
  debugMode: boolean;
  setDebugMode: (mode: boolean) => void;
  logs: (string | Record<string, any>)[];
  addLog: (log: string | Record<string, any>) => void;
  clearLogs: () => void;
  copyLogs: () => void; // Placeholder for potential toast message
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export const DebugProvider = ({ children }: { children: ReactNode }) => {
  const [debugModeStorage, setDebugModeStorage] = useLocalStorage<boolean>('codealchemist-debug-mode', false);
  const [debugMode, setDebugModeState] = useState<boolean>(debugModeStorage);
  const [logs, setLogs] = useState<(string | Record<string, any>)[]>([]);

  const setDebugMode = useCallback((mode: boolean) => {
    setDebugModeState(mode);
    setDebugModeStorage(mode);
  }, [setDebugModeStorage]);

  const addLog = useCallback((log: string | Record<string, any>) => {
    if (debugMode) { // Only add logs if debug mode is active
      const timestamp = new Date().toLocaleTimeString();
      const formattedLog = typeof log === 'string' ? `[${timestamp}] ${log}` : { timestamp, ...log };
      setLogs((prevLogs) => [...prevLogs, formattedLog]);
    }
  }, [debugMode]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

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

export const useDebug = (): DebugContextType => {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
};
