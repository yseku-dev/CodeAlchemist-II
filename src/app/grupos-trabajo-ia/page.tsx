
"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
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
import type { AIAgentGroup, GroupFormData, Agent, AgentInfoForGroupSuggestion, SuggestGroupDefinitionOutput } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmDialog from '@/components/confirm-dialog';
import LogsDisplay from '@/components/logs-display';
import { suggestGroupDefinition } from '@/ai/flows/suggest-group-definition-flow';
import { v4 as uuidv4 } from 'uuid';

const initialGroupFormData: GroupFormData = {
  name: '',
  description: '',
  mainTask: '',
  agentIds: [],
};

export default function GruposTrabajoIAPage() {
  const { groups, addGroup, updateGroup, deleteGroup, agents } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AIAgentGroup | null>(null);
  const [formData, setFormData] = useState<GroupFormData>(initialGroupFormData);
  const [groupToDelete, setGroupToDelete] = useState<AIAgentGroup | null>(null);

  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [executingGroup, setExecutingGroup] = useState<AIAgentGroup | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [isGroupExecuting, setIsGroupExecuting] = useState(false);

  const [isSuggestGroupDialogOpen, setIsSuggestGroupDialogOpen] = useState(false);
  const [groupTaskDescription, setGroupTaskDescription] = useState('');
  const [isSuggestingGroup, setIsSuggestingGroup] = useState(false);

  const availableAgentsForSelection = agents.filter(agent => agent.id !== 'orquestador-flujo-agentes');

  const handleOpenForm = (groupOrSuggestion?: AIAgentGroup | SuggestGroupDefinitionOutput) => {
    if (groupOrSuggestion && 'id' in groupOrSuggestion && typeof groupOrSuggestion.id === 'string') { // Existing AIAgentGroup
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

  const handleFormChange = (field: keyof GroupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAgentSelectionChange = (agentId: string, checked: boolean) => {
    setFormData(prev => {
      const newAgentIds = checked
        ? [...prev.agentIds, agentId]
        : prev.agentIds.filter(id => id !== agentId);
      return { ...prev, agentIds: newAgentIds };
    });
  };

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
    addLog(`Group ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`);
  };

  const handleDeleteGroup = (group: AIAgentGroup) => {
    setGroupToDelete(group);
  };
  
  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
    }
  };

  const handleExecuteGroup = (group: AIAgentGroup) => {
    setExecutingGroup(group);
    setExecutionLog([`Iniciando ejecución del grupo: ${group.name}`]);
    setIsExecutionModalOpen(true);
    setIsGroupExecuting(true);
    
    addLog(`Executing group: ${group.name}. Task: ${group.mainTask.substring(0,50)}...`);
    let turn = 1;
    const interval = setInterval(() => {
      if (turn > 5) { 
        setExecutionLog(prev => [...prev, "Ejecución del grupo completada (simulado)."]);
        setIsGroupExecuting(false);
        clearInterval(interval);
        return;
      }
      const orquestadorDecision = `Turno ${turn}: Orquestador decide pasar control a Agente ${group.agentIds[Math.floor(Math.random() * group.agentIds.length)] || 'Ejemplo'}.`;
      const agentResponse = `Respuesta del Agente: Tarea parcial completada, resultado: XYZ.`;
      setExecutionLog(prev => [...prev, orquestadorDecision, agentResponse]);
      turn++;
    }, 2000);
  };

  const handleStopExecution = () => {
    setIsGroupExecuting(false);
    setExecutionLog(prev => [...prev, "Ejecución detenida por el usuario."]);
    addLog(`Group execution stopped for: ${executingGroup?.name}`);
  };

  const handleSuggestGroup = async () => {
    if (!groupTaskDescription.trim()) {
      toast({ variant: 'destructive', title: 'Descripción Requerida', description: 'Por favor, describe la tarea del grupo.' });
      return;
    }
    setIsSuggestingGroup(true);
    addLog(`Requesting AI suggestion for group task: ${groupTaskDescription}`);
    try {
      const agentInfos: AgentInfoForGroupSuggestion[] = availableAgentsForSelection.map(a => ({ id: a.id, name: a.name, description: a.description }));
      const suggestion = await suggestGroupDefinition({ groupTaskDescription, availableAgents: agentInfos });
      toast({ title: 'Sugerencia Recibida', description: `La IA ha sugerido una definición para el grupo ${suggestion.name}.` });
      setIsSuggestGroupDialogOpen(false);
      setGroupTaskDescription('');
      handleOpenForm(suggestion);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error de Sugerencia', description: error.message || 'No se pudo obtener la sugerencia.' });
      addLog(`AI group suggestion failed: ${error.message}`);
    } finally {
      setIsSuggestingGroup(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <Workflow className="h-7 w-7 text-primary" />
              <span>Gestión de Grupos de Trabajo IA</span>
            </CardTitle>
            <CardDescription>Define y ejecuta equipos de agentes IA colaborativos.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSuggestGroupDialogOpen(true)}>
              <SparklesIcon className="mr-2 h-4 w-4" /> Crear con IA
            </Button>
            <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" />Crear Grupo</Button>
          </div>
        </CardHeader>
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
                    <Button variant="ghost" size="icon" title="Ejecutar Grupo" onClick={() => handleExecuteGroup(group)}><Play className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Editar Grupo" onClick={() => handleOpenForm(group)}><Edit3 className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Eliminar Grupo" onClick={() => handleDeleteGroup(group)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingGroup(null); // Clear editing/suggestion state
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

      <Dialog open={isExecutionModalOpen} onOpenChange={(open) => {if(!open) {setIsExecutionModalOpen(false); setIsGroupExecuting(false);}}}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Ejecución del Grupo: {executingGroup?.name}</DialogTitle>
                <DialogDescription>Tarea Principal: {executingGroup?.mainTask}</DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-hidden -mx-6">
                <LogsDisplay title="Log de Ejecución Detallado" logs={executionLog} defaultExpanded={true} />
            </div>
            <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={handleStopExecution} disabled={!isGroupExecuting}>Detener Ejecución</Button>
                <DialogClose asChild><Button>Cerrar</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for AI Group Suggestion */}
      <Dialog open={isSuggestGroupDialogOpen} onOpenChange={setIsSuggestGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugerir Definición de Grupo con IA</DialogTitle>
            <DialogDescription>
              Describe la tarea o el objetivo principal del grupo, y la IA sugerirá una definición y agentes relevantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="group-task-description">Descripción de la Tarea del Grupo</Label>
              <Textarea
                id="group-task-description"
                value={groupTaskDescription}
                onChange={(e) => setGroupTaskDescription(e.target.value)}
                placeholder="Ej: Desarrollar un nuevo módulo de e-commerce para la aplicación."
                rows={4}
                disabled={isSuggestingGroup}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSuggestingGroup}>Cancelar</Button></DialogClose>
            <Button onClick={handleSuggestGroup} disabled={isSuggestingGroup || availableAgentsForSelection.length === 0}>
              {isSuggestingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Obtener Sugerencia
            </Button>
          </DialogFooter>
           {availableAgentsForSelection.length === 0 && <p className="text-xs text-destructive text-center pt-2">Crea agentes primero para poder obtener sugerencias de grupos.</p>}
        </DialogContent>
      </Dialog>

    </div>
  );
}
