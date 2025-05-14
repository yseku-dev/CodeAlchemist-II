
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit3, Trash2, Upload, Download, PlayCircle, Users2, Sparkles as SparklesIcon } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { Agent, AgentFormData, LLMSettings, LLMProvider, SuggestAgentDefinitionOutput } from '@/types';
import { DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import ConfirmDialog from '@/components/confirm-dialog';
import AgentForm from '@/components/features/agentes-ia/agent-form';
import AgentTestChat from '@/components/features/agentes-ia/agent-test-chat';
import { v4 as uuidv4 } from 'uuid';
import { callSuggestAgentDefinition } from '@/utils/apiClient'; 
import { AppError } from '@/utils/AppError';
import { getModelsForProvider } from '@/lib/utils'; 
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import AISuggestionDialog from '@/components/features/common/AISuggestionDialog';

/**
 * @fileOverview Page component for managing AI Agents.
 * Allows users to create, edit, delete, import, export, and test individual AI agents.
 * Also includes AI-assisted agent creation.
 */


/**
 * AgentesIAPage component.
 * Main UI for AI Agent management.
 * @returns {JSX.Element} The rendered agent management page.
 */
export default function AgentesIAPage() {
  const { agents, addAgent, updateAgent, deleteAgent, settings: globalSettings, setAgents } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();

  /** State to control the visibility of the agent creation/editing form dialog. */
  const [isFormOpen, setIsFormOpen] = useState(false);
  /** State to store the agent currently being edited (null if creating a new agent). */
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  /** State to store the agent currently being considered for deletion. */
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  /** State to control the visibility of the agent test chat modal. */
  const [isTestChatOpen, setIsTestChatOpen] = useState(false);
  /** State to store the agent currently being tested. */
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);

  /** State to control the visibility of the AI-assisted agent suggestion dialog. */
  const [isSuggestAgentDialogOpen, setIsSuggestAgentDialogOpen] = useState(false);
  /** State to store the user's description of the agent's role for AI suggestion. */
  const [agentRoleDescription, setAgentRoleDescription] = useState('');
  /** State to indicate if an AI suggestion for an agent is currently being fetched. */
  const [isSuggestingAgent, setIsSuggestingAgent] = useState(false);

  /**
   * Prepares the state for the agent form, either for a new agent, an existing agent, or an AI-suggested one.
   * @param {Agent | SuggestAgentDefinitionOutput} [agentOrSuggestion] - The existing agent to edit or the AI-generated suggestion.
   */
  const _prepareEditingAgentState = (agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput) => {
    if (agentOrSuggestion && 'id' in agentOrSuggestion && typeof agentOrSuggestion.id === 'string' && !agentOrSuggestion.id.startsWith('suggested-')) { 
      // It's an existing Agent
      return agentOrSuggestion as Agent;
    } else if (agentOrSuggestion) { 
      // It's a suggestion (SuggestAgentDefinitionOutput) or a pre-filled structure from suggestion
      const suggestedData = agentOrSuggestion as SuggestAgentDefinitionOutput; 
      const provider = globalSettings.llmConfig.provider || DEFAULT_LLM_SETTINGS.provider;
      const apiUrl = globalSettings.llmConfig.apiUrl || LLM_PROVIDER_DEFAULT_API_URLS[provider] || '';
      
      const suggestedFormData: AgentFormData = {
        name: suggestedData.name,
        description: suggestedData.description,
        systemPrompt: suggestedData.systemPrompt,
        capabilities: suggestedData.capabilities,
        llmConfig: { 
          useGlobal: true, 
          customConfig: { 
            ...DEFAULT_LLM_SETTINGS, 
            provider,
            apiUrl, 
            model: globalSettings.llmConfig.model || getModelsForProvider(provider)[0] || '' 
          } 
        },
      };
      return { ...suggestedFormData, id: `suggested-${uuidv4()}` } as Agent; // Temporary ID for prefill logic
    }
    return null; // For creating a new agent from scratch
  };

  /**
   * Opens the agent form.
   * If an agent or suggestion is provided, the form is pre-filled.
   * @param {Agent | SuggestAgentDefinitionOutput} [agentOrSuggestion] - The agent to edit or the AI suggestion.
   */
  const handleOpenForm = (agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput) => {
    setEditingAgent(_prepareEditingAgentState(agentOrSuggestion));
    setIsFormOpen(true);
  };


  /**
   * Handles the submission of the agent form (create or update).
   * @param {AgentFormData} formData - The data from the agent form.
   */
  const handleSubmitAgentForm = (formData: AgentFormData) => {
    if (editingAgent && editingAgent.id.startsWith('suggested-')) { 
        addAgent(formData); 
    } else if (editingAgent) { 
      if (editingAgent.isNameEditable === false && editingAgent.name !== formData.name) {
        toast({ variant: "destructive", title: "Error", description: `El nombre del agente "${editingAgent.name}" no puede ser editado.`});
        return;
      }
      updateAgent({ ...editingAgent, ...formData } as Agent);
    } else { 
      addAgent(formData);
    }
    setIsFormOpen(false);
    setEditingAgent(null); 
    addLog(`Agent ${formData.id && !formData.id.startsWith('suggested-') ? 'updated/confirmed' : 'created'}: ${formData.name}`);
  };

  /**
   * Sets up an agent for deletion by opening the confirmation dialog.
   * @param {Agent} agent - The agent to be deleted.
   */
  const handleDeleteAgent = (agent: Agent) => {
    if (agent.isDeletable === false) {
      toast({ variant: "destructive", title: "Error", description: `El agente "${agent.name}" no se puede eliminar.`});
      return;
    }
    setAgentToDelete(agent);
  };
  
  /**
   * Confirms and executes the deletion of an agent.
   */
  const confirmDeleteAgent = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
    }
  };

  /**
   * Handles the import of agents from a JSON file.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleImportAgents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedAgents = JSON.parse(e.target?.result as string) as Agent[];
          if (Array.isArray(importedAgents) && importedAgents.every(ag => ag.name && ag.systemPrompt)) {
            const newAgents = importedAgents.map(ia => ({...ia, id: uuidv4(), isDefault: false, isDeletable: true, isNameEditable: true })); 
            setAgents(prev => {
              const existingNames = new Set(newAgents.map(na => na.name));
              const filteredPrev = prev.filter(pa => !existingNames.has(pa.name));
              return [...filteredPrev, ...newAgents];
            }); 
            toast({ title: "Agentes Importados", description: `${importedAgents.length} agentes importados y/o actualizados.` });
            addLog(`${importedAgents.length} agents imported/updated.`);
          } else {
            throw new Error("Formato JSON inválido para agentes.");
          }
        } catch (err: any) {
          toast({ variant: "destructive", title: "Error de Importación", description: err.message });
          addLog(`Agent import failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
      if (event.target) event.target.value = ""; 
    }
  };

  /**
   * Handles the export of all agents to a JSON file.
   */
  const handleExportAgents = () => {
    const jsonString = JSON.stringify(agents, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "codealchemist_agents.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Agentes Exportados", description: "Todos los agentes han sido exportados." });
    addLog("All agents exported.");
  };

  /**
   * Handles the export of a single agent to a JSON file.
   * @param {Agent} agent - The agent to export.
   */
  const handleExportSingleAgent = (agent: Agent) => {
    const jsonString = JSON.stringify(agent, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codealchemist_agent_${agent.name.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Agente Exportado", description: `Agente "${agent.name}" exportado.` });
    addLog(`Agent "${agent.name}" exported.`);
  };

  /**
   * Opens the test chat modal for a specific agent.
   * @param {Agent} agent - The agent to test.
   */
  const handleTestAgent = (agent: Agent) => {
    setTestingAgent(agent);
    setIsTestChatOpen(true);
  };

  /**
   * Handles the AI-assisted agent suggestion process.
   */
  const handleSuggestAgent = async () => {
    if (!agentRoleDescription.trim()) {
      toast({ variant: 'destructive', title: 'Descripción Requerida', description: 'Por favor, describe el rol del agente.' });
      return;
    }
    setIsSuggestingAgent(true);
    addLog(`Requesting AI suggestion for agent role: ${agentRoleDescription}`);
    try {
      const suggestion = await callSuggestAgentDefinition({ roleDescription: agentRoleDescription });
      toast({ title: 'Sugerencia Recibida', description: `La IA ha sugerido una definición para el agente ${suggestion.name}.` });
      setIsSuggestAgentDialogOpen(false);
      setAgentRoleDescription('');
      handleOpenForm(suggestion); 
    } catch (error: any) {
      const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message || 'No se pudo obtener la sugerencia.';
      toast({ variant: 'destructive', title: 'Error de Sugerencia', description: errorMsg });
      addLog(`AI agent suggestion failed: ${errorMsg}`);
    } finally {
      setIsSuggestingAgent(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
         <PageSectionHeader
          icon={Users2}
          title="Gestión de Agentes IA"
          description="Crea, configura, prueba y gestiona agentes IA individuales."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsSuggestAgentDialogOpen(true)}>
                <SparklesIcon className="mr-2 h-4 w-4" /> Crear con IA
              </Button>
              <Input type="file" accept=".json" onChange={handleImportAgents} className="hidden" id="import-agents-input" />
              <Button variant="outline" onClick={() => document.getElementById('import-agents-input')?.click()}><Upload className="mr-2 h-4 w-4" />Importar</Button>
              <Button variant="outline" onClick={handleExportAgents} disabled={agents.length === 0}><Download className="mr-2 h-4 w-4" />Exportar Todos</Button>
              <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" />Crear Agente</Button>
            </div>
          }
        />
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay agentes creados. ¡Crea uno para empezar!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <Card key={agent.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{agent.name} {agent.isDefault && <span className="text-xs text-primary font-normal">(Por Defecto)</span>}</CardTitle>
                    <CardDescription className="text-xs h-10 overflow-hidden text-ellipsis">{agent.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1 flex-grow">
                    <p><strong>LLM:</strong> {agent.llmConfig.useGlobal ? `Global (${globalSettings.llmConfig.provider})` : `Personalizado (${agent.llmConfig.customConfig?.provider || 'N/A'})`}</p>
                    <p><strong>Capacidades:</strong> 
                        {Object.entries(agent.capabilities).filter(([, val]) => val).map(([key]) => key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())).join(', ') || 'Ninguna'}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-1 p-2">
                    <Button variant="ghost" size="icon" title="Probar Agente" onClick={() => handleTestAgent(agent)}><PlayCircle className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Exportar Agente" onClick={() => handleExportSingleAgent(agent)}><Download className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Editar Agente" onClick={() => handleOpenForm(agent)} disabled={agent.isNameEditable === false}><Edit3 className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Eliminar Agente" onClick={() => handleDeleteAgent(agent)} disabled={agent.isDeletable === false}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AgentForm
        isOpen={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingAgent(null); 
        }}
        editingAgent={editingAgent} 
        onSubmit={handleSubmitAgentForm}
        getModelsForProvider={getModelsForProvider}
        globalLLMConfig={globalSettings.llmConfig}
      />
      
      <ConfirmDialog
        isOpen={!!agentToDelete}
        onClose={() => setAgentToDelete(null)}
        onConfirm={confirmDeleteAgent}
        title={`Eliminar Agente: ${agentToDelete?.name}`}
        description="¿Estás seguro de que quieres eliminar este agente? Esta acción no se puede deshacer."
      />

      <AgentTestChat
        isOpen={isTestChatOpen}
        onOpenChange={setIsTestChatOpen}
        testingAgent={testingAgent}
      />

      <AISuggestionDialog
        isOpen={isSuggestAgentDialogOpen}
        onOpenChange={setIsSuggestAgentDialogOpen}
        dialogTitle="Sugerir Definición de Agente con IA"
        dialogDescription="Describe el rol o la tarea principal del agente que necesitas, y la IA sugerirá una definición."
        textareaLabel="Descripción del Rol del Agente"
        textareaPlaceholder="Ej: Un agente que resume textos largos en puntos clave."
        textareaValue={agentRoleDescription}
        onTextareaChange={setAgentRoleDescription}
        onSubmit={handleSuggestAgent}
        isSubmitting={isSuggestingAgent}
      />

    </div>
  );
}
