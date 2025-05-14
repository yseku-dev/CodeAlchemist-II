
"use client";

import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { AppSettings, Agent, AIAgentGroup, CodeSnapshot, LLMSettings, GitSettings } from '@/types';
import { DEFAULT_LLM_SETTINGS, DEFAULT_AGENTS, DEFAULT_GROUPS, APP_NAME } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

/**
 * @fileOverview Provides the main application state using React Context.
 * Manages settings, agents, groups, and code snapshots, persisting them to localStorage.
 */

/**
 * Defines the shape of the application state context.
 */
interface AppStateContextType {
  /** Current application settings. */
  settings: AppSettings;
  /** Function to update partial application settings. */
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  /** Function to update partial LLM configuration settings. */
  updateLLMConfig: (newConfig: Partial<LLMSettings>) => void;
  /** Function to update partial Git configuration settings. */
  updateGitConfig: (newConfig: Partial<GitSettings>) => void;
  
  /** Array of all configured AI agents. */
  agents: Agent[];
  /** Setter function for the agents array. */
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  /** Adds a new AI agent to the application state. */
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  /** Updates an existing AI agent in the application state. */
  updateAgent: (agent: Agent) => void;
  /** Deletes an AI agent from the application state by its ID. */
  deleteAgent: (agentId: string) => boolean;
  /** Retrieves an AI agent by its ID. */
  getAgentById: (agentId: string) => Agent | undefined;

  /** Array of all configured AI agent groups. */
  groups: AIAgentGroup[];
  /** Setter function for the AI agent groups array. */
  setGroups: React.Dispatch<React.SetStateAction<AIAgentGroup[]>>;
  /** Adds a new AI agent group to the application state. */
  addGroup: (group: Omit<AIAgentGroup, 'id'>) => void;
  /** Updates an existing AI agent group in the application state. */
  updateGroup: (group: AIAgentGroup) => void;
  /** Deletes an AI agent group from the application state by its ID. */
  deleteGroup: (groupId: string) => void;
  /** Retrieves an AI agent group by its ID. */
  getGroupById: (groupId: string) => AIAgentGroup | undefined;

  /** Array of all saved code snapshots. */
  snapshots: CodeSnapshot[];
  /** Setter function for the code snapshots array. */
  setSnapshots: React.Dispatch<React.SetStateAction<CodeSnapshot[]>>;
  /** Adds a new code snapshot to the application state. */
  addSnapshot: (snapshot: Omit<CodeSnapshot, 'id' | 'createdAt'>) => void;
  /** Deletes a code snapshot from the application state by its ID. */
  deleteSnapshot: (snapshotId: string) => void;
  /** Deletes all code snapshots from the application state. */
  deleteAllSnapshots: () => void;
  /** Retrieves a code snapshot by its ID. */
  getSnapshotById: (snapshotId: string) => CodeSnapshot | undefined;

  /** Initializes default agents and groups if they don't exist in localStorage. */
  initializeDefaultData: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

/**
 * Initial default settings for the application.
 */
const initialSettings: AppSettings = {
  llmConfig: DEFAULT_LLM_SETTINGS,
  gitConfig: { repoUrl: '', username: '', email: '', pat: '' },
  debugMode: false,
};

/**
 * Provides the application state to its children components.
 * It manages settings, agents, groups, and snapshots, persisting them to localStorage.
 * @param {object} props - The component's props.
 * @param {ReactNode} props.children - The child components to be wrapped by the provider.
 * @returns {JSX.Element} The AppStateProvider component.
 */
export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useLocalStorage<AppSettings>(`${APP_NAME}-settings`, initialSettings);
  const [agents, setAgents] = useLocalStorage<Agent[]>(`${APP_NAME}-agents`, []);
  const [groups, setGroups] = useLocalStorage<AIAgentGroup[]>(`${APP_NAME}-groups`, []);
  const [snapshots, setSnapshots] = useLocalStorage<CodeSnapshot[]>(`${APP_NAME}-snapshots`, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, [setSettings]);

  const updateLLMConfig = useCallback((newConfig: Partial<LLMSettings>) => {
    setSettings(prev => ({ ...prev, llmConfig: { ...prev.llmConfig, ...newConfig } }));
  }, [setSettings]);

  const updateGitConfig = useCallback((newConfig: Partial<GitSettings>) => {
    setSettings(prev => ({ ...prev, gitConfig: { ...prev.gitConfig, ...newConfig } }));
  }, [setSettings]);

  const addAgent = useCallback((agentData: Omit<Agent, 'id'>) => {
    const newAgent: Agent = { ...agentData, id: uuidv4() };
    setAgents(prev => [...prev, newAgent]);
    toast({ title: "Agente Creado", description: `Agente "${newAgent.name}" añadido.` });
  }, [setAgents, toast]);

  const updateAgent = useCallback((updatedAgent: Agent) => {
    setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
    toast({ title: "Agente Actualizado", description: `Agente "${updatedAgent.name}" guardado.` });
  }, [setAgents, toast]);

  const deleteAgent = useCallback((agentId: string) => {
    const agentToDelete = agents.find(a => a.id === agentId);
    if (agentToDelete?.isDeletable === false) {
      toast({ variant: "destructive", title: "Error", description: `El agente "${agentToDelete.name}" no se puede eliminar.` });
      return false;
    }
    setAgents(prev => prev.filter(a => a.id !== agentId));
    toast({ title: "Agente Eliminado", description: `Agente "${agentToDelete?.name}" eliminado.` });
    // Also remove agent from any groups
    setGroups(prevGroups => prevGroups.map(g => ({
      ...g,
      agentIds: g.agentIds.filter(id => id !== agentId)
    })));
    return true;
  }, [agents, setAgents, toast, setGroups]);
  
  const getAgentById = useCallback((agentId: string) => agents.find(a => a.id === agentId), [agents]);

  const addGroup = useCallback((groupData: Omit<AIAgentGroup, 'id'>) => {
    const newGroup: AIAgentGroup = { ...groupData, id: uuidv4() };
    setGroups(prev => [...prev, newGroup]);
    toast({ title: "Grupo Creado", description: `Grupo "${newGroup.name}" añadido.` });
  }, [setGroups, toast]);

  const updateGroup = useCallback((updatedGroup: AIAgentGroup) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    toast({ title: "Grupo Actualizado", description: `Grupo "${updatedGroup.name}" guardado.` });
  }, [setGroups, toast]);

  const deleteGroup = useCallback((groupId: string) => {
    const groupToDelete = groups.find(g => g.id === groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    toast({ title: "Grupo Eliminado", description: `Grupo "${groupToDelete?.name}" eliminado.` });
  }, [groups, setGroups, toast]);

  const getGroupById = useCallback((groupId: string) => groups.find(g => g.id === groupId), [groups]);

  const addSnapshot = useCallback((snapshotData: Omit<CodeSnapshot, 'id' | 'createdAt'>) => {
    const newSnapshot: CodeSnapshot = { 
      ...snapshotData, 
      id: uuidv4(), 
      createdAt: new Date().toISOString() 
    };
    setSnapshots(prev => [newSnapshot, ...prev]); // Add to the beginning
    toast({ title: "Snapshot Guardado", description: `Snapshot "${newSnapshot.name}" creado.` });
  }, [setSnapshots, toast]);

  const deleteSnapshot = useCallback((snapshotId: string) => {
    const snapshotToDelete = snapshots.find(s => s.id === snapshotId);
    setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    toast({ title: "Snapshot Eliminado", description: `Snapshot "${snapshotToDelete?.name}" eliminado.` });
  }, [snapshots, setSnapshots, toast]);

  const deleteAllSnapshots = useCallback(() => {
    setSnapshots([]);
    toast({ title: "Todos los Snapshots Eliminados" });
  }, [setSnapshots, toast]);

  const getSnapshotById = useCallback((snapshotId: string) => snapshots.find(s => s.id === snapshotId), [snapshots]);


  const initializeDefaultData = useCallback(() => {
    const areAgentsInitialized = agents.some(agent => agent.isDefault);
    if (!areAgentsInitialized) {
      const agentsWithIds = DEFAULT_AGENTS.map(agent => ({...agent, id: agent.id || uuidv4()}));
      setAgents(agentsWithIds);
      console.log("Default agents initialized.");
    }

    const areGroupsInitialized = groups.some(group => group.isDefault);
    if (!areGroupsInitialized) {
      const groupsWithIds = DEFAULT_GROUPS.map(group => ({...group, id: group.id || uuidv4()}));
      setGroups(groupsWithIds);
      console.log("Default groups initialized.");
    }
  }, [agents, groups, setAgents, setGroups]);

  // Initialize on mount if needed
  useEffect(() => {
     if (typeof window !== 'undefined') { // ensure this runs client-side
        const initialized = localStorage.getItem(`${APP_NAME}-initialized`);
        if (!initialized) {
            initializeDefaultData();
            localStorage.setItem(`${APP_NAME}-initialized`, 'true');
        }
     }
  }, [initializeDefaultData]);


  return (
    <AppStateContext.Provider value={{
      settings, updateSettings, updateLLMConfig, updateGitConfig,
      agents, setAgents, addAgent, updateAgent, deleteAgent, getAgentById,
      groups, setGroups, addGroup, updateGroup, deleteGroup, getGroupById,
      snapshots, setSnapshots, addSnapshot, deleteSnapshot, deleteAllSnapshots, getSnapshotById,
      initializeDefaultData
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

/**
 * Custom hook to access the application state.
 * Must be used within an `AppStateProvider`.
 * @returns {AppStateContextType} The application state and updater functions.
 * @throws {Error} If used outside of an `AppStateProvider`.
 */
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
