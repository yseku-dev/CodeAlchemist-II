
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Edit3, Trash2, Play, Workflow, Sparkles as SparklesIcon, Loader2 } from 'lucide-react';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { AIAgentGroup, GroupFormData, Agent, AgentInfoForGroupSuggestion, SuggestGroupDefinitionOutput, ChatMessage } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmDialog from '@/components/confirm-dialog';
import LogsDisplay from '@/components/logs-display';
import { callSuggestGroupDefinition, callChatWithAIGroup, callChatWithAgentOrGlobal } from '@/utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import AISuggestionDialog from '@/components/features/common/AISuggestionDialog';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';


const initialGroupFormData: GroupFormData = {
  name: '',
  description: '',
  mainTask: '',
  agentIds: [],
};

const MAX_EXECUTION_TURNS = 10; // Maximum number of turns for group execution

/**
 * Page component for managing AI Agent Groups.
 * Allows creating, editing, deleting, and executing AI agent groups.
 * Supports AI-assisted group definition.
 * @returns {JSX.Element} The rendered AI Agent Groups management page.
 */
export default function GruposTrabajoIAPage() {
  const { groups, addGroup, updateGroup, deleteGroup, agents, getAgentById } = useAppState();
  const { toast } = useToast();
  const { addLog: addDebugLog } = useDebug();
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AIAgentGroup | null>(null);
  const [formData, setFormData] = useState<GroupFormData>(initialGroupFormData);
  const [groupToDelete, setGroupToDelete] = useState<AIAgentGroup | null>(null);

  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [executingGroup, setExecutingGroup] = useState<AIAgentGroup | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [isGroupExecuting, setIsGroupExecuting] = useState(false);
  const executionControllerRef = useRef<AbortController | null>(null);


  const [isSuggestGroupDialogOpen, setIsSuggestGroupDialogOpen] = useState(false);
  const [groupTaskDescription, setGroupTaskDescription] = useState('');
  const [isSuggestingGroup, setIsSuggestingGroup] = useState(false);

  const availableAgentsForSelection = agents.filter(agent => agent.id !== 'orquestador-flujo-agentes');

  /**
   * Opens the group creation/editing form.
   * Pre-fills the form if an existing group or an AI suggestion is provided.
   * @param {AIAgentGroup | SuggestGroupDefinitionOutput} [groupOrSuggestion] - The group to edit or AI suggestion.
   */
  const handleOpenForm = (groupOrSuggestion?: AIAgentGroup | SuggestGroupDefinitionOutput) => {
    if (groupOrSuggestion && 'id' in groupOrSuggestion && typeof groupOrSuggestion.id === 'string' && !groupOrSuggestion.id.startsWith('suggested-')) { // Existing AIAgentGroup
      const group = groupOrSuggestion as AIAgentGroup;
      setEditingGroup(group);
      setFormData({
        id: group.id,
        name: group.name,
        description: group.description,
        mainTask: group.mainTask,
        agentIds: [...group.agentIds],
      });
    } else if (groupOrSuggestion) { // Suggestion (SuggestGroupDefinitionOutput)
      const suggestion = groupOrSuggestion as SuggestGroupDefinitionOutput;
      setEditingGroup(null); // Clear previous editing group
      setFormData({
        name: suggestion.name,
        description: suggestion.description,
        mainTask: suggestion.mainTask,
        agentIds: suggestion.agentIds,
        id: `suggested-${uuidv4()}` // Temporary ID for prefill logic
      });
    } else { // New group from scratch
      setEditingGroup(null);
      setFormData(initialGroupFormData);
    }
    setIsFormOpen(true);
  };

  /**
   * Handles changes in the group form fields.
   * @param {keyof GroupFormData} field - The form field being changed.
   * @param {any} value - The new value for the field.
   */
  const handleFormChange = (field: keyof GroupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Handles changes in agent selection for the group.
   * @param {string} agentId - The ID of the agent being selected/deselected.
   * @param {boolean} checked - The new checked state of the agent.
   */
  const handleAgentSelectionChange = (agentId: string, checked: boolean) => {
    setFormData(prev => {
      const newAgentIds = checked
        ? [...prev.agentIds, agentId]
        : prev.agentIds.filter(id => id !== agentId);
      return { ...prev, agentIds: newAgentIds };
    });
  };

  /**
   * Handles submission of the group form (create or update).
   */
  const handleSubmitForm = () => {
    if (!formData.name.trim() || !formData.mainTask.trim()) {
      toast({ variant: "destructive", title: "Campos Requeridos", description: "El nombre y la tarea principal son obligatorios." });
      return;
    }
    if (formData.agentIds.length === 0) {
        toast({ variant: "destructive", title: "Agentes Requeridos", description: "Selecciona al menos un agente participante (además del Orquestador)." });
        return;
    }

    if (editingGroup) { // Editing existing group
      updateGroup({ ...editingGroup, ...formData } as AIAgentGroup);
    } else if (formData.id && formData.id.startsWith('suggested-')) { // Confirming a suggestion
      const { id, ...newGroupData } = formData; // remove temporary id
      addGroup(newGroupData);
    }
     else { // Creating a new group from scratch
      addGroup(formData);
    }
    setIsFormOpen(false);
    setEditingGroup(null);
    addDebugLog(`Group ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`);
  };

  /**
   * Prepares a group for deletion by opening the confirmation dialog.
   * @param {AIAgentGroup} group - The group to be deleted.
   */
  const handleDeleteGroup = (group: AIAgentGroup) => {
    setGroupToDelete(group);
  };
  
  /**
   * Confirms and executes the deletion of a group.
   */
  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
    }
  };

  /**
   * Handles the execution of an AI agent group.
   * Manages a multi-turn conversation with the orchestrator and selected agents.
   * @param {AIAgentGroup} group - The group to execute.
   */
  const handleExecuteGroup = async (group: AIAgentGroup) => {
    setExecutingGroup(group);
    setExecutionLog([`Iniciando ejecución del grupo: ${group.name}...\nTarea Principal: ${group.mainTask}`]);
    setIsExecutionModalOpen(true);
    setIsGroupExecuting(true);
    addDebugLog(`Executing group: ${group.name}. Task: ${group.mainTask.substring(0, 50)}...`);
    
    executionControllerRef.current = new AbortController(); // For potential cancellation if needed, not fully used yet

    let currentTurn = 1;
    let currentOrchestratorInput = group.mainTask;
    const orchestratorAgent = agents.find(a => a.id === 'orquestador-flujo-agentes');

    if (!orchestratorAgent) {
      const errorMsg = "Agente Orquestador ('orquestador-flujo-agentes') no encontrado. No se puede ejecutar el grupo.";
      setExecutionLog(prev => [...prev, `Error Crítico: ${errorMsg}`]);
      toast({ variant: "destructive", title: "Error de Configuración", description: errorMsg });
      setIsGroupExecuting(false);
      return;
    }

    const participatingAgentsInfo = group.agentIds
      .map(id => getAgentById(id))
      .filter(Boolean) as Agent[];

    while (isGroupExecuting && currentTurn <= MAX_EXECUTION_TURNS) {
      if (executionControllerRef.current.signal.aborted) {
        setExecutionLog(prev => [...prev, `Turno ${currentTurn}: Ejecución cancelada por el usuario.`]);
        break;
      }

      setExecutionLog(prev => [...prev, `\n--- Turno ${currentTurn} ---`]);
      setExecutionLog(prev => [...prev, `Orquestador recibiendo: "${currentOrchestratorInput.substring(0, 200)}${currentOrchestratorInput.length > 200 ? "..." : ""}"`]);

      try {
        // 1. Call Orchestrator
        const orchestratorResponse = await callChatWithAIGroup({
          userMessage: currentOrchestratorInput,
          groupMainTask: group.mainTask,
          participatingAgents: participatingAgentsInfo.map(p => ({
            id: p.id, name: p.name, description: p.description,
            systemPrompt: p.systemPrompt, capabilities: p.capabilities, llmConfig: p.llmConfig
          })),
          orchestratorAgentSystemPrompt: orchestratorAgent.systemPrompt,
        });
        setExecutionLog(prev => [...prev, `Orquestador (raw JSON): ${orchestratorResponse.orchestratorResponse}`]);
        
        // 2. Parse Orchestrator's Decision
        let decision;
        try {
          decision = JSON.parse(orchestratorResponse.orchestratorResponse);
        } catch (parseError) {
          const errorMsg = "Error al parsear la respuesta JSON del Orquestador.";
          setExecutionLog(prev => [...prev, `Error Crítico: ${errorMsg} Respuesta: ${orchestratorResponse.orchestratorResponse}`]);
          toast({ variant: "destructive", title: "Error de Orquestador", description: errorMsg });
          setIsGroupExecuting(false);
          break;
        }

        if (!decision.next_agent_id || !decision.instruction_for_next_agent) {
          const errorMsg = "Respuesta del Orquestador incompleta (faltan next_agent_id o instruction_for_next_agent).";
          setExecutionLog(prev => [...prev, `Error Crítico: ${errorMsg}`]);
          toast({ variant: "destructive", title: "Error de Orquestador", description: errorMsg });
          setIsGroupExecuting(false);
          break;
        }
        
        setExecutionLog(prev => [...prev, `Decisión del Orquestador: Siguiente Agente: ${decision.next_agent_id}. Instrucción: "${decision.instruction_for_next_agent.substring(0,100)}...". Razón: "${decision.reasoning || 'N/A'}"`]);

        // 3. Handle Next Step
        if (decision.next_agent_id.toUpperCase() === "COMPLETADO") {
          setExecutionLog(prev => [...prev, `\n--- Tarea Completada --- \nResultado Final del Grupo: ${decision.instruction_for_next_agent}`]);
          setIsGroupExecuting(false);
          break;
        }

        const selectedAgent = getAgentById(decision.next_agent_id);
        if (!selectedAgent) {
          const errorMsg = `Agente con ID "${decision.next_agent_id}" no encontrado.`;
          setExecutionLog(prev => [...prev, `Error Crítico: ${errorMsg}`]);
          toast({ variant: "destructive", title: "Error de Grupo", description: errorMsg });
          setIsGroupExecuting(false);
          break;
        }

        setExecutionLog(prev => [...prev, `Llamando a Agente: ${selectedAgent.name}...`]);
        
        // 4. Call Selected Agent
        const agentResponse = await callChatWithAgentOrGlobal({
          userMessage: decision.instruction_for_next_agent,
          agentSystemPrompt: selectedAgent.systemPrompt,
        });
        setExecutionLog(prev => [...prev, `Respuesta de ${selectedAgent.name}: "${agentResponse.aiResponse.substring(0, 200)}${agentResponse.aiResponse.length > 200 ? "..." : ""}"`]);
        currentOrchestratorInput = agentResponse.aiResponse; // Prepare for next turn

      } catch (error: any) {
        let friendlyMessage = "Ocurrió un error durante la ejecución del grupo.";
        if (error instanceof AppError) {
          friendlyMessage = error.friendlyMessage;
          if (error.redirectTo) {
            onOpenChange(false); 
            router.push(error.redirectTo);
            setIsGroupExecuting(false);
            break;
          }
        }
        setExecutionLog(prev => [...prev, `Error en Turno ${currentTurn}: ${friendlyMessage}`]);
        addDebugLog({ message: `Error during group execution turn ${currentTurn}`, errorDetails: error, friendlyMessage, flowName: 'handleExecuteGroup' });
        toast({ variant: "destructive", title: "Error de Ejecución", description: friendlyMessage });
        setIsGroupExecuting(false);
        break;
      }
      currentTurn++;
    }

    if (isGroupExecuting && currentTurn > MAX_EXECUTION_TURNS) {
      setExecutionLog(prev => [...prev, `\nSe alcanzó el número máximo de turnos (${MAX_EXECUTION_TURNS}). Ejecución detenida.`]);
    }
     if (!isGroupExecuting && currentTurn <= MAX_EXECUTION_TURNS) { // Stopped by user or error before max turns
        setExecutionLog(prev => [...prev, `\nEjecución del grupo finalizada o detenida.`]);
    }
    setIsGroupExecuting(false); // Ensure it's always false at the end
    executionControllerRef.current = null;
  };

  /**
   * Stops the currently active group execution.
   */
  const handleStopExecution = () => {
    if (executionControllerRef.current) {
      executionControllerRef.current.abort();
    }
    setIsGroupExecuting(false); // This will terminate the loop in handleExecuteGroup
    addDebugLog(`Group execution stop requested for: ${executingGroup?.name}`);
  };

  /**
   * Handles the AI-assisted group definition suggestion.
   */
  const handleSuggestGroup = async () => {
    if (!groupTaskDescription.trim()) {
      toast({ variant: 'destructive', title: 'Descripción Requerida', description: 'Por favor, describe la tarea del grupo.' });
      return;
    }
    setIsSuggestingGroup(true);
    addDebugLog(`Requesting AI suggestion for group task: ${groupTaskDescription}`);
    try {
      const agentInfos: AgentInfoForGroupSuggestion[] = availableAgentsForSelection.map(a => ({ id: a.id, name: a.name, description: a.description }));
      const suggestion = await callSuggestGroupDefinition({ groupTaskDescription, availableAgents: agentInfos });
      toast({ title: 'Sugerencia Recibida', description: `La IA ha sugerido una definición para el grupo ${suggestion.name}.` });
      setIsSuggestGroupDialogOpen(false);
      setGroupTaskDescription('');
      handleOpenForm(suggestion);
    } catch (error: any) {
      const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message || 'No se pudo obtener la sugerencia.';
      toast({ variant: 'destructive', title: 'Error de Sugerencia', description: errorMsg });
      addDebugLog({message: 'AI group suggestion failed', errorDetails: error, friendlyMessage: errorMsg});
    } finally {
      setIsSuggestingGroup(false);
    }
  };

  const groupSuggestionExtraFooter = availableAgentsForSelection.length === 0 
    ? <p className="text-xs text-destructive text-center">Crea agentes primero para poder obtener sugerencias de grupos.</p>
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <PageSectionHeader
          icon={Workflow}
          title="Gestión de Grupos de Trabajo IA"
          description="Define y ejecuta equipos de agentes IA colaborativos."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsSuggestGroupDialogOpen(true)} disabled={availableAgentsForSelection.length === 0}>
                <SparklesIcon className="mr-2 h-4 w-4" /> Crear con IA
              </Button>
              <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" />Crear Grupo</Button>
            </div>
          }
        />
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay grupos de trabajo creados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(group => (
                <Card key={group.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{group.name} {group.isDefault && <span className="text-xs text-primary font-normal">(Por Defecto)</span>}</CardTitle>
                    <CardDescription className="text-xs h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1 flex-grow">
                    <p><strong>Agentes:</strong> {group.agentIds.length} (+ Orquestador)</p>
                    <p className="truncate"><strong>Tarea:</strong> {group.mainTask}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-1 p-2">
                    <Button variant="ghost" size="icon" title="Ejecutar Grupo" onClick={() => handleExecuteGroup(group)} disabled={isGroupExecuting}><Play className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Editar Grupo" onClick={() => handleOpenForm(group)} disabled={isGroupExecuting}><Edit3 className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Eliminar Grupo" onClick={() => handleDeleteGroup(group)} disabled={isGroupExecuting}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingGroup(null); 
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Editar Grupo de Trabajo' : (formData.id && formData.id.startsWith('suggested-') ? 'Revisar Sugerencia de Grupo' : 'Crear Nuevo Grupo de Trabajo')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-6 -mr-6">
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="group-name">Nombre</Label>
                <Input id="group-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="group-description">Descripción</Label>
                <Textarea id="group-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="group-mainTask">Tarea Principal del Grupo</Label>
                <Textarea id="group-mainTask" value={formData.mainTask} onChange={(e) => handleFormChange('mainTask', e.target.value)} rows={4} placeholder="Describe el objetivo general que el grupo debe alcanzar..." />
              </div>
              
              <Label className="font-semibold">Seleccionar Agentes Participantes</Label>
              <p className="text-xs text-muted-foreground">El <code className="bg-muted px-1 rounded-sm">OrquestadorFlujoAgentes</code> se añade implícitamente.</p>
              {availableAgentsForSelection.length === 0 ? (
                 <p className="text-sm text-destructive p-2 border border-destructive/50 rounded-md">No hay otros agentes disponibles para seleccionar. Crea agentes primero.</p>
              ) : (
                <ScrollArea className="h-40 border rounded-md p-2">
                    <div className="space-y-2">
                    {availableAgentsForSelection.map(agent => (
                        <div key={agent.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`agent-${agent.id}`}
                            checked={formData.agentIds.includes(agent.id)}
                            onCheckedChange={(checked) => handleAgentSelectionChange(agent.id, !!checked)}
                        />
                        <Label htmlFor={`agent-${agent.id}`} className="font-normal text-sm">{agent.name}</Label>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSubmitForm} disabled={availableAgentsForSelection.length === 0 && formData.agentIds.length === 0}>{editingGroup ? 'Guardar Cambios' : (formData.id && formData.id.startsWith('suggested-') ? 'Crear Grupo con Sugerencia' : 'Crear Grupo')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        isOpen={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        onConfirm={confirmDeleteGroup}
        title={`Eliminar Grupo: ${groupToDelete?.name}`}
        description="¿Estás seguro de que quieres eliminar este grupo de trabajo?"
      />

      <Dialog open={isExecutionModalOpen} onOpenChange={(open) => {if(!open) { handleStopExecution(); setIsExecutionModalOpen(false); }}}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Ejecución del Grupo: {executingGroup?.name}</DialogTitle>
                <DialogDescription>Tarea Principal: {executingGroup?.mainTask}</DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-hidden -mx-6"> {/* Apply negative margin to allow LogsDisplay to use full width */}
                <LogsDisplay title="Log de Ejecución Detallado" logs={executionLog} defaultExpanded={true} />
            </div>
            <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={handleStopExecution} disabled={!isGroupExecuting}>Detener Ejecución</Button>
                <DialogClose asChild><Button>Cerrar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AISuggestionDialog
        isOpen={isSuggestGroupDialogOpen}
        onOpenChange={setIsSuggestGroupDialogOpen}
        dialogTitle="Sugerir Definición de Grupo con IA"
        dialogDescription="Describe la tarea o el objetivo principal del grupo, y la IA sugerirá una definición y agentes relevantes."
        textareaLabel="Descripción de la Tarea del Grupo"
        textareaPlaceholder="Ej: Desarrollar un nuevo módulo de e-commerce para la aplicación."
        textareaValue={groupTaskDescription}
        onTextareaChange={setGroupTaskDescription}
        onSubmit={handleSuggestGroup}
        isSubmitting={isSuggestingGroup}
        extraFooterContent={groupSuggestionExtraFooter}
        submitButtonText={availableAgentsForSelection.length > 0 ? "Obtener Sugerencia" : "Crea Agentes Primero"}
      />

    </div>
  );
}

// Helper to ensure execution log updates are visible
const useExecutionLogUpdater = (logArray: string[], setLogArray: React.Dispatch<React.SetStateAction<string[]>>) => {
  const addExecutionLog = (message: string) => {
    setLogArray(prev => [...prev, message]);
  };
  return { addExecutionLog };
};

/**
 * Parses the orchestrator's JSON response.
 * @param {string} jsonString - The JSON string from the orchestrator.
 * @returns {{next_agent_id: string, instruction_for_next_agent: string, reasoning?: string} | null} Parsed decision or null if error.
 */
function parseOrchestratorDecision(jsonString: string): {next_agent_id: string, instruction_for_next_agent: string, reasoning?: string} | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed.next_agent_id === 'string' && typeof parsed.instruction_for_next_agent === 'string') {
      return {
        next_agent_id: parsed.next_agent_id,
        instruction_for_next_agent: parsed.instruction_for_next_agent,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

    