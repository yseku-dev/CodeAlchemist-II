
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Edit3, Trash2, Upload, Download, PlayCircle, MessageSquare } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { Agent, AgentFormData, AgentLLMConfiguration, LLMSettings, LLMProvider } from '@/types';
import { LLM_PROVIDERS, DEFAULT_LLM_SETTINGS } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmDialog from '@/components/confirm-dialog';
// For mock agent test chat
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@/types';

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

const initialAgentFormData: AgentFormData = {
  name: '',
  description: '',
  systemPrompt: '',
  capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
  llmConfig: { useGlobal: true, customConfig: { ...DEFAULT_LLM_SETTINGS } },
};

export default function AgentesIAPage() {
  const { agents, addAgent, updateAgent, deleteAgent, settings: globalSettings, setAgents } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(initialAgentFormData);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [isTestChatOpen, setIsTestChatOpen] = useState(false);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [testChatMessages, setTestChatMessages] = useState<ChatMessage[]>([]);
  const [testChatMessage, setTestChatMessage] = useState('');
  const [isTestChatLoading, setIsTestChatLoading] = useState(false);


  const handleOpenForm = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      const agentConfig = agent.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalSettings.llmConfig.provider, model: globalSettings.llmConfig.model };
      setFormData({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        capabilities: { ...agent.capabilities },
        llmConfig: { 
          useGlobal: agent.llmConfig.useGlobal, 
          customConfig: { ...agentConfig }
        },
      });
      setAvailableModels(getModelsForProvider(agentConfig.provider));
    } else {
      setEditingAgent(null);
      const defaultProvider = globalSettings.llmConfig.provider || DEFAULT_LLM_SETTINGS.provider;
      setFormData({
        ...initialAgentFormData,
        llmConfig: { 
          useGlobal: true, 
          customConfig: { ...DEFAULT_LLM_SETTINGS, provider: defaultProvider, model: '' }
        }
      });
      setAvailableModels(getModelsForProvider(defaultProvider));
    }
    setIsFormOpen(true);
  };

  const handleFormChange = (field: keyof AgentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCapabilityChange = (capability: keyof AgentFormData['capabilities'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: { ...prev.capabilities, [capability]: value }
    }));
  };

  const handleLlmConfigChange = (field: keyof AgentLLMConfiguration, value: any) => {
    if (field === 'customConfig') { // 'value' here is an object like { provider: 'LM Studio' } or { apiKey: '...' }
        const changedCustomConfigProps = value as Partial<LLMSettings>;
        let newCustomConfig = { ...(formData.llmConfig.customConfig || DEFAULT_LLM_SETTINGS), ...changedCustomConfigProps };

        if (changedCustomConfigProps.provider) {
            const newProvider = changedCustomConfigProps.provider as LLMProvider;
            setAvailableModels(getModelsForProvider(newProvider));
            if (!getModelsForProvider(newProvider).includes(newCustomConfig.model)) {
                newCustomConfig.model = ''; // Reset model if not compatible
            }

            // Auto-set API URL for specific local providers
            if (newProvider === "LM Studio") {
                newCustomConfig.apiUrl = "http://localhost:1234/v1";
            } else if (newProvider === "Ollama") {
                newCustomConfig.apiUrl = "http://localhost:11434/v1";
            } else {
                // If previous apiUrl was a default local one, and it's not being explicitly changed now, clear it.
                const localDefaultUrls = ["http://localhost:1234/v1", "http://localhost:11434/v1"];
                if (formData.llmConfig.customConfig?.apiUrl && 
                    localDefaultUrls.includes(formData.llmConfig.customConfig.apiUrl) &&
                    !changedCustomConfigProps.hasOwnProperty('apiUrl')) {
                    newCustomConfig.apiUrl = "";
                }
                // If apiUrl was explicitly part of changedCustomConfigProps, it's already set by the spread operator.
                // If it wasn't a default local URL and not in changedCustomConfigProps, it remains.
            }
        }
        setFormData(prev => ({
            ...prev,
            llmConfig: { ...prev.llmConfig, useGlobal: false, customConfig: newCustomConfig }
        }));
    } else if (field === 'useGlobal') { // 'value' here is a boolean for the useGlobal switch
        setFormData(prev => {
            const newLlmConfig = { ...prev.llmConfig, useGlobal: value };
            if (!value && !newLlmConfig.customConfig) { // Switched to custom, and customConfig is not yet initialized
                const globalProvider = globalSettings.llmConfig.provider || DEFAULT_LLM_SETTINGS.provider;
                let apiUrl = DEFAULT_LLM_SETTINGS.apiUrl;
                if (globalProvider === "LM Studio") {
                    apiUrl = "http://localhost:1234/v1";
                } else if (globalProvider === "Ollama") {
                    apiUrl = "http://localhost:11434/v1";
                }
                
                newLlmConfig.customConfig = {
                     ...DEFAULT_LLM_SETTINGS,
                     provider: globalProvider,
                     model: getModelsForProvider(globalProvider)[0] || '',
                     apiUrl: apiUrl,
                };
                setAvailableModels(getModelsForProvider(globalProvider));
            } else if (!value && newLlmConfig.customConfig) { // Switched to custom, and customConfig exists
                setAvailableModels(getModelsForProvider(newLlmConfig.customConfig.provider));
                 // Ensure apiUrl is set if it's a local provider
                if (newLlmConfig.customConfig.provider === "LM Studio" && newLlmConfig.customConfig.apiUrl !== "http://localhost:1234/v1") {
                    newLlmConfig.customConfig.apiUrl = "http://localhost:1234/v1";
                } else if (newLlmConfig.customConfig.provider === "Ollama" && newLlmConfig.customConfig.apiUrl !== "http://localhost:11434/v1") {
                    newLlmConfig.customConfig.apiUrl = "http://localhost:11434/v1";
                }
            }
            return { ...prev, llmConfig: newLlmConfig };
        });
    }
  };


  const handleSubmitForm = () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Nombre Requerido", description: "El agente debe tener un nombre." });
      return;
    }
    
    const finalLlmConfig = formData.llmConfig.useGlobal 
        ? { useGlobal: true } 
        : { useGlobal: false, customConfig: formData.llmConfig.customConfig || { ...DEFAULT_LLM_SETTINGS, provider: globalSettings.llmConfig.provider } };

    const agentData = { ...formData, llmConfig: finalLlmConfig };

    if (editingAgent) {
      if (editingAgent.isNameEditable === false && editingAgent.name !== agentData.name) {
        toast({ variant: "destructive", title: "Error", description: `El nombre del agente "${editingAgent.name}" no puede ser editado.`});
        return;
      }
      updateAgent({ ...editingAgent, ...agentData });
    } else {
      addAgent(agentData);
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
    setTestChatMessages([{
        id: uuidv4(),
        role: 'system',
        content: `Estás probando el agente: ${agent.name}.\nPrompt de Sistema del Agente:\n${agent.systemPrompt}`,
        timestamp: new Date().toISOString()
    }]);
    setIsTestChatOpen(true);
  };

  const handleSendTestMessage = async () => {
    if (!testChatMessage.trim() || !testingAgent) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: testChatMessage, timestamp: new Date().toISOString() };
    setTestChatMessages(prev => [...prev, userMsg]);
    setTestChatMessage('');
    setIsTestChatLoading(true);

    addLog(`Testing agent "${testingAgent.name}" with message: ${userMsg.content.substring(0,30)}...`);
    setTimeout(() => {
        const aiResponse: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: `Respuesta simulada de ${testingAgent.name}: He recibido tu mensaje "${userMsg.content.substring(0,20)}...". Basado en mi prompt de sistema, actuaré en consecuencia.`,
            timestamp: new Date().toISOString()
        };
        setTestChatMessages(prev => [...prev, aiResponse]);
        setIsTestChatLoading(false);
    }, 1500);
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gestión de Agentes IA</CardTitle>
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
                    <Button variant="ghost" size="icon" title="Editar Agente" onClick={() => handleOpenForm(agent)} disabled={agent.isNameEditable === false}><Edit3 className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Eliminar Agente" onClick={() => handleDeleteAgent(agent)} disabled={agent.isDeletable === false}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Editar Agente' : 'Crear Nuevo Agente'}</DialogTitle>
            <DialogDescription>
              {editingAgent 
                ? `Modifica los detalles del agente "${editingAgent.name}".` 
                : "Define un nuevo agente especializado para tus tareas de IA."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-6 -mr-6"> 
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="agent-name">Nombre</Label>
                <Input id="agent-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} disabled={editingAgent?.isNameEditable === false} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="agent-description">Descripción</Label>
                <Textarea id="agent-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="agent-systemPrompt">Mensaje de Sistema (Prompt)</Label>
                <Textarea id="agent-systemPrompt" value={formData.systemPrompt} onChange={(e) => handleFormChange('systemPrompt', e.target.value)} rows={5} placeholder="Define el rol, comportamiento y directrices del agente..." />
              </div>
              
              <Label className="font-semibold">Capacidades del Agente</Label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(formData.capabilities).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Switch id={`cap-${key}`} checked={value} onCheckedChange={(checked) => handleCapabilityChange(key as keyof AgentFormData['capabilities'], checked)} />
                    <Label htmlFor={`cap-${key}`} className="font-normal capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                      {(key === 'execution' || key === 'readWrite') && <span className="text-destructive text-xs ml-1">(Peligroso)</span>}
                    </Label>
                  </div>
                ))}
              </div>

              <Label className="font-semibold">Configuración LLM del Agente</Label>
              <div className="space-y-3 p-3 border rounded-md">
                 <div className="flex items-center space-x-2">
                    <Switch id="use-global-llm" checked={formData.llmConfig.useGlobal} onCheckedChange={(checked) => handleLlmConfigChange('useGlobal', checked)} />
                    <Label htmlFor="use-global-llm" className="font-normal">Usar Configuración Global</Label>
                 </div>
                 {!formData.llmConfig.useGlobal && formData.llmConfig.customConfig && (
                    <div className="space-y-2 pl-2 border-l-2 ml-2">
                        <div className="space-y-1">
                            <Label htmlFor="custom-llm-provider" className="text-xs">Proveedor LLM</Label>
                            <Select 
                                value={formData.llmConfig.customConfig.provider} 
                                onValueChange={(val) => handleLlmConfigChange('customConfig', { provider: val as LLMProvider })}
                            >
                                <SelectTrigger id="custom-llm-provider"><SelectValue/></SelectTrigger>
                                <SelectContent>{LLM_PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="custom-llm-model" className="text-xs">Modelo</Label>
                            <Select 
                                value={formData.llmConfig.customConfig.model} 
                                onValueChange={(val) => handleLlmConfigChange('customConfig', { model: val })} 
                                disabled={availableModels.length === 0}
                            >
                                <SelectTrigger id="custom-llm-model"><SelectValue placeholder={availableModels.length === 0 ? "Selecciona proveedor" : "Selecciona modelo"} /></SelectTrigger>
                                <SelectContent>{availableModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="custom-llm-apiUrl" className="text-xs">URL API (Opcional)</Label>
                            <Input 
                                id="custom-llm-apiUrl" 
                                value={formData.llmConfig.customConfig.apiUrl} 
                                onChange={(e) => handleLlmConfigChange('customConfig', { apiUrl: e.target.value })} 
                                placeholder="Usar global si está vacío o predeterminado del proveedor"
                            />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="custom-llm-apiKey" className="text-xs">Clave API (Opcional)</Label>
                            <Input 
                                id="custom-llm-apiKey" 
                                type="password" 
                                value={formData.llmConfig.customConfig.apiKey} 
                                onChange={(e) => handleLlmConfigChange('customConfig', { apiKey: e.target.value })} 
                                placeholder="Usar global si está vacía"
                            />
                        </div>
                    </div>
                 )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSubmitForm}>{editingAgent ? 'Guardar Cambios' : 'Crear Agente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        isOpen={!!agentToDelete}
        onClose={() => setAgentToDelete(null)}
        onConfirm={confirmDeleteAgent}
        title={`Eliminar Agente: ${agentToDelete?.name}`}
        description="¿Estás seguro de que quieres eliminar este agente? Esta acción no se puede deshacer."
      />

      {/* Test Agent Chat Modal */}
        <Dialog open={isTestChatOpen} onOpenChange={setIsTestChatOpen}>
            <DialogContent className="sm:max-w-lg flex flex-col h-[70vh]">
                <DialogHeader>
                    <DialogTitle>Probando Agente: {testingAgent?.name}</DialogTitle>
                    <DialogDescription>Interactúa directamente con el agente para probar su comportamiento.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mx-6 px-6 py-2 border-y">
                    <div className="space-y-3 pr-2">
                        {testChatMessages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-2 rounded-md text-sm ${
                                    msg.role === 'user' ? 'bg-primary text-primary-foreground' :
                                    msg.role === 'assistant' ? 'bg-muted' : 'bg-accent/20 text-accent-foreground italic'
                                }`}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                         {isTestChatLoading && <div className="text-sm text-muted-foreground">Agente está pensando...</div>}
                    </div>
                </ScrollArea>
                <div className="pt-2 flex gap-2">
                    <Textarea 
                        value={testChatMessage} 
                        onChange={(e) => setTestChatMessage(e.target.value)} 
                        placeholder="Escribe tu mensaje al agente..." 
                        rows={2}
                        className="flex-1"
                        onKeyPress={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendTestMessage();}}}
                    />
                    <Button onClick={handleSendTestMessage} disabled={isTestChatLoading || !testChatMessage.trim()}>Enviar</Button>
                </div>
            </DialogContent>
        </Dialog>

    </div>
  );
}
