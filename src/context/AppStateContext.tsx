
"use client";

import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { AppSettings, Agent, AIAgentGroup, CodeSnapshot, LLMSettings, GitSettings } from '@/types';
import { DEFAULT_LLM_SETTINGS, DEFAULT_AGENTS, DEFAULT_GROUPS, APP_NAME } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

interface AppStateContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  updateLLMConfig: (newConfig: Partial<LLMSettings>) => void;
  updateGitConfig: (newConfig: Partial<GitSettings>) => void;
  
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (agent: Agent) => void;
  deleteAgent: (agentId: string) => boolean;
  getAgentById: (agentId: string) => Agent | undefined;

  groups: AIAgentGroup[];
  setGroups: React.Dispatch<React.SetStateAction<AIAgentGroup[]>>;
  addGroup: (group: Omit<AIAgentGroup, 'id'>) => void;
  updateGroup: (group: AIAgentGroup) => void;
  deleteGroup: (groupId: string) => void;
  getGroupById: (groupId: string) => AIAgentGroup | undefined;

  snapshots: CodeSnapshot[];
  setSnapshots: React.Dispatch<React.SetStateAction<CodeSnapshot[]>>;
  addSnapshot: (snapshot: Omit<CodeSnapshot, 'id' | 'createdAt'>) => void;
  deleteSnapshot: (snapshotId: string) => void;
  deleteAllSnapshots: () => void;
  getSnapshotById: (snapshotId: string) => CodeSnapshot | undefined;

  initializeDefaultData: () => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

const initialSettings: AppSettings = {
  llmConfig: DEFAULT_LLM_SETTINGS,
  gitConfig: { repoUrl: '', username: '', email: '', pat: '' },
  debugMode: false,
};

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

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
