
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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
import { callSuggestAgentDefinition as suggestAgentDefinitionFlow } from '@/utils/apiClient'; // Updated import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { AppError } from '@/utils/AppError';

/**
 * @fileOverview Page component for managing AI Agents.
 * Allows users to create, edit, delete, import, export, and test individual AI agents.
 * Also includes AI-assisted agent creation.
 */

/**
 * Retrieves a list of model names for a given LLM provider.
 * @param {LLMProvider} provider - The LLM provider.
 * @returns {string[]} An array of model names.
 */
const getModelsForProvider = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "Groq": return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    case "OpenAI": return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro"]; // Should also allow manual entry
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model 1", "Local Model 2"]; // Placeholders, user usually specifies
    case "Ollama": return ["llama3", "mistral", "codellama"]; // Common models, user can add more
    default: return [];
  }
};

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
   * Opens the agent form, optionally pre-filling it for an existing agent or an AI suggestion.
   * @param {Agent | SuggestAgentDefinitionOutput} [agentOrSuggestion] - The existing agent to edit or the AI-generated suggestion to pre-fill.
   */
  const handleOpenForm = (agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput) => {
    if (agentOrSuggestion && 'id' in agentOrSuggestion && typeof agentOrSuggestion.id === 'string' && !agentOrSuggestion.id.startsWith('suggested-')) { 
      setEditingAgent(agentOrSuggestion as Agent);
    } else if (agentOrSuggestion) { // It's a suggestion or a pre-filled structure from suggestion
      setEditingAgent(null); 
      const suggestedData = agentOrSuggestion as SuggestAgentDefinitionOutput; // Assume it's a suggestion if no real ID
      const suggestedFormData: AgentFormData = {
        name: suggestedData.name,
        description: suggestedData.description,
        systemPrompt: suggestedData.systemPrompt,
        capabilities: suggestedData.capabilities,
        llmConfig: { useGlobal: true, customConfig: { ...DEFAULT_LLM_SETTINGS, provider: globalSettings.llmConfig.provider, apiUrl: globalSettings.llmConfig.apiUrl, model: globalSettings.llmConfig.model } },
      };
      setEditingAgent({ ...suggestedFormData, id: `suggested-${uuidv4()}` } as Agent); // Use temporary ID for form prefill logic
    } else {
      setEditingAgent(null);
    }
    setIsFormOpen(true);
  };

  /**
   * Handles the submission of the agent form (creation or update).
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
    addLog(`Agent ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`);
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
            setAgents(prev => [...prev.filter(pa => !newAgents.find(na => na.name === pa.name)), ...newAgents]); 
            toast({ title: "Agentes Importados", description: `${importedAgents.length} agentes importados.` });
            addLog(`${importedAgents.length} agents imported.`);
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
   * Calls the Genkit flow to get suggestions based on user input.
   */
  const handleSuggestAgent = async () => {
    if (!agentRoleDescription.trim()) {
      toast({ variant: 'destructive', title: 'Descripción Requerida', description: 'Por favor, describe el rol del agente.' });
      return;
    }
    setIsSuggestingAgent(true);
    addLog(`Requesting AI suggestion for agent role: ${agentRoleDescription}`);
    try {
      const suggestion = await suggestAgentDefinitionFlow({ roleDescription: agentRoleDescription });
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <Users2 className="h-7 w-7 text-primary" />
              <span>Gestión de Agentes IA</span>
            </CardTitle>
            <CardDescription>Crea, configura, prueba y gestiona agentes IA individuales.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsSuggestAgentDialogOpen(true)}>
              <SparklesIcon className="mr-2 h-4 w-4" /> Crear con IA
            </Button>
            <Input type="file" accept=".json" onChange={handleImportAgents} className="hidden" id="import-agents-input" />
            <Button variant="outline" onClick={() => document.getElementById('import-agents-input')?.click()}><Upload className="mr-2 h-4 w-4" />Importar</Button>
            <Button variant="outline" onClick={handleExportAgents} disabled={agents.length === 0}><Download className="mr-2 h-4 w-4" />Exportar Todos</Button>
            <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" />Crear Agente</Button>
          </div>
        </CardHeader>
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

      <Dialog open={isSuggestAgentDialogOpen} onOpenChange={setIsSuggestAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugerir Definición de Agente con IA</DialogTitle>
            <DialogDescription>
              Describe el rol o la tarea principal del agente que necesitas, y la IA sugerirá una definición.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="agent-role-description">Descripción del Rol del Agente</Label>
              <Textarea
                id="agent-role-description"
                value={agentRoleDescription}
                onChange={(e) => setAgentRoleDescription(e.target.value)}
                placeholder="Ej: Un agente que resume textos largos en puntos clave."
                rows={4}
                disabled={isSuggestingAgent}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSuggestingAgent}>Cancelar</Button></DialogClose>
            <Button onClick={handleSuggestAgent} disabled={isSuggestingAgent}>
              {isSuggestingAgent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Obtener Sugerencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
