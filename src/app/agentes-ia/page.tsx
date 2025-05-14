
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Edit3, Trash2, Upload, Download, PlayCircle, Users2 } from 'lucide-react'; // Added Users2
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { Agent, AgentFormData, LLMSettings, LLMProvider } from '@/types';
import { DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import ConfirmDialog from '@/components/confirm-dialog';
import AgentForm from '@/components/features/agentes-ia/agent-form';
import AgentTestChat from '@/components/features/agentes-ia/agent-test-chat';
import { v4 as uuidv4 } from 'uuid';

// Placeholder for actual model lists
const getModelsForProvider = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "Groq": return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    case "OpenAI": return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro"];
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model 1", "Local Model 2"];
    case "Ollama": return ["llama3", "mistral", "codellama"];
    default: return [];
  }
};

export default function AgentesIAPage() {
  const { agents, addAgent, updateAgent, deleteAgent, settings: globalSettings, setAgents } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const [isTestChatOpen, setIsTestChatOpen] = useState(false);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);


  const handleOpenForm = (agent?: Agent) => {
    setEditingAgent(agent || null);
    setIsFormOpen(true);
  };

  const handleSubmitAgentForm = (formData: AgentFormData) => {
    if (editingAgent) {
      if (editingAgent.isNameEditable === false && editingAgent.name !== formData.name) {
        toast({ variant: "destructive", title: "Error", description: `El nombre del agente "${editingAgent.name}" no puede ser editado.`});
        return;
      }
      updateAgent({ ...editingAgent, ...formData } as Agent); // Cast as Agent assuming id is present if editing
    } else {
      addAgent(formData);
    }
    setIsFormOpen(false);
    addLog(`Agent ${editingAgent ? 'updated' : 'created'}: ${formData.name}`);
  };

  const handleDeleteAgent = (agent: Agent) => {
    if (agent.isDeletable === false) {
      toast({ variant: "destructive", title: "Error", description: `El agente "${agent.name}" no se puede eliminar.`});
      return;
    }
    setAgentToDelete(agent);
  };
  
  const confirmDeleteAgent = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
    }
  };

  const handleImportAgents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedAgents = JSON.parse(e.target?.result as string) as Agent[];
          if (Array.isArray(importedAgents) && importedAgents.every(ag => ag.name && ag.systemPrompt)) {
            const newAgents = importedAgents.map(ia => ({...ia, id: uuidv4(), isDefault: false })); 
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

  const handleTestAgent = (agent: Agent) => {
    setTestingAgent(agent);
    setIsTestChatOpen(true);
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
          <div className="flex gap-2">
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
                    <p><strong>LLM:</strong> {agent.llmConfig.useGlobal ? 'Global' : `Personalizado (${agent.llmConfig.customConfig?.provider || 'N/A'})`}</p>
                    <p><strong>Capacidades:</strong> 
                        {Object.entries(agent.capabilities).filter(([, val]) => val).map(([key]) => key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())).join(', ') || 'Ninguna'}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-1 p-2">
                    <Button variant="ghost" size="icon" title="Probar Agente" onClick={() => handleTestAgent(agent)}><PlayCircle className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Exportar Agente" onClick={() => handleExportSingleAgent(agent)}><Download className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Editar Agente" onClick={() => handleOpenForm(agent)} disabled={agent.isNameEditable === false && agent.name === 'OrquestadorFlujoAgentes'}><Edit3 className="h-4 w-4"/></Button>
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
        onOpenChange={setIsFormOpen}
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

    </div>
  );
}
