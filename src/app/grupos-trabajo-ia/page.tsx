// src/app/grupos-trabajo-ia/page.tsx
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as DialogDescriptionComponent, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { AIAgentGroup, GroupFormData, Agent, AgentInfoForGroupSuggestion, SuggestGroupDefinitionOutput } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmDialog from '@/components/confirm-dialog';
import LogsDisplay from '@/components/logs-display';
import { callSuggestGroupDefinition, callChatWithAIGroup, callChatWithAgentOrGlobal } from '@/utils/apiClient';
import { v4 as uuidv4 } from 'uuid';
import AISuggestionDialog from '@/components/features/common/AISuggestionDialog';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import GroupsPageHeader from '@/components/features/grupos-trabajo-ia/GroupsPageHeader';
import GroupListDisplay from '@/components/features/grupos-trabajo-ia/GroupListDisplay';

const initialGroupFormData: GroupFormData = {
  name: '',
  description: '',
  mainTask: '',
  agentIds: [],
};

const MAX_EXECUTION_TURNS = 10;

/**
 * @fileOverview GruposTrabajoIAPage component for managing AI Agent Groups.
 * Allows users to create, edit, delete, and execute AI agent groups.
 * Execution involves a multi-turn conversation coordinated by an orchestrator agent.
 * Supports AI-assisted group definition.
 * All UI text is internationalized.
 */
export default function GruposTrabajoIAPage() {
  const { groups, addGroup, updateGroup, deleteGroup, agents, getAgentById } = useAppState();
  const { toast } = useToast();
  const { addLog: addDebugLog } = useDebug();
  const router = useRouter();
  const { t } = useI18n();

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

  const handleOpenForm = useCallback((groupOrSuggestion?: AIAgentGroup | SuggestGroupDefinitionOutput) => {
    if (groupOrSuggestion && 'id' in groupOrSuggestion && typeof groupOrSuggestion.id === 'string' && !groupOrSuggestion.id.startsWith('suggested-')) {
      const group = groupOrSuggestion as AIAgentGroup;
      setEditingGroup(group);
      setFormData({
        id: group.id, name: group.name, description: group.description, mainTask: group.mainTask, agentIds: [...group.agentIds],
      });
    } else if (groupOrSuggestion) {
      const suggestion = groupOrSuggestion as SuggestGroupDefinitionOutput;
      setEditingGroup(null);
      setFormData({
        name: suggestion.name, description: suggestion.description, mainTask: suggestion.mainTask, agentIds: suggestion.agentIds, id: `suggested-${uuidv4()}`
      });
    } else {
      setEditingGroup(null);
      setFormData(initialGroupFormData);
    }
    setIsFormOpen(true);
  }, []);

  const handleFormChange = (field: keyof GroupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAgentSelectionChange = (agentId: string, checked: boolean) => {
    setFormData(prev => {
      const newAgentIds = checked ? [...prev.agentIds, agentId] : prev.agentIds.filter(id => id !== agentId);
      return { ...prev, agentIds: newAgentIds };
    });
  };

  const handleSubmitForm = () => {
    const flowName = editingGroup ? 'updateGroup' : 'addGroup';
    addDebugLog({source: 'GruposTrabajoIAPage', type: 'INFO', message: `Submitting group form: ${editingGroup ? 'Update' : 'Create'}`, data: formData, flowName});
    if (!formData.name.trim() || !formData.mainTask.trim()) {
      toast({ variant: "destructive", title: t('groups.form.toast.fieldsRequired.title'), description: t('groups.form.toast.fieldsRequired.description') });
      return;
    }
    if (formData.agentIds.length === 0) {
        toast({ variant: "destructive", title: t('groups.form.toast.agentsRequired.title'), description: t('groups.form.toast.agentsRequired.description') });
        return;
    }

    if (editingGroup && editingGroup.id && !editingGroup.id.startsWith('suggested-')) {
      updateGroup({ ...editingGroup, ...formData } as AIAgentGroup);
      toast({ title: t('groups.toast.updated.title'), description: t('groups.toast.updated.description', { name: formData.name }) });
    } else {
      const { id, ...newGroupData } = formData;
      addGroup(newGroupData);
      toast({ title: t('groups.toast.created.title'), description: t('groups.toast.created.description', { name: formData.name }) });
    }
    setIsFormOpen(false);
    setEditingGroup(null);
    addDebugLog({source: 'GruposTrabajoIAPage', type: 'SUCCESS', message: `Group ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`, flowName});
  };

  const handleDeleteGroup = (group: AIAgentGroup) => { setGroupToDelete(group); };

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      addDebugLog({source: 'GruposTrabajoIAPage', type: 'INFO', message: `Deleting group: ${groupToDelete.name}`, data: { groupId: groupToDelete.id }, flowName: 'deleteGroup'});
      const groupName = groupToDelete.name;
      deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
      toast({ title: t('groups.toast.deleted.title'), description: t('groups.toast.deleted.description', {name: groupName}) });
    }
  };

  const handleExecuteGroup = async (group: AIAgentGroup) => {
    setExecutingGroup(group);
    setExecutionLog([t('groups.execution.starting', { name: group.name, mainTask: group.mainTask })]);
    setIsExecutionModalOpen(true);
    setIsGroupExecuting(true);
    const flowName = 'executeAIGroup';
    addDebugLog({source: 'GruposTrabajoIAPage', type: 'INFO', message: `Executing group: ${group.name}. Task: ${group.mainTask.substring(0, 50)}...`, flowName});

    executionControllerRef.current = new AbortController();
    let currentTurn = 1;
    let currentOrchestratorInput = group.mainTask;
    const orchestratorAgent = agents.find(a => a.id === 'orquestador-flujo-agentes');

    if (!orchestratorAgent) {
      const errorMsg = t('groups.execution.criticalError.orchestratorNotFound');
      setExecutionLog(prev => [...prev, t('groups.execution.log.criticalErrorHeader') + errorMsg]);
      toast({ variant: "destructive", title: t('groups.toast.execution.orchestratorError'), description: errorMsg });
      setIsGroupExecuting(false); return;
    }

    const participatingAgentsInfo = group.agentIds.map(id => getAgentById(id)).filter(Boolean) as Agent[];

    while (isGroupExecuting && currentTurn <= MAX_EXECUTION_TURNS && !executionControllerRef.current.signal.aborted) {
      setExecutionLog(prev => [...prev, t('groups.execution.log.turnPrefix', {turn: currentTurn})]);
      setExecutionLog(prev => [...prev, `${t('groups.execution.log.orchestratorReceivingTitle')}\n${currentOrchestratorInput}`]);
      try {
        const orchestratorResponse = await callChatWithAIGroup({
          userMessage: currentOrchestratorInput, groupMainTask: group.mainTask,
          participatingAgents: participatingAgentsInfo.map(p => ({
            id: p.id, name: p.name, description: p.description,
            systemPrompt: p.systemPrompt, capabilities: p.capabilities, llmConfig: p.llmConfig
          })),
          orchestratorAgentSystemPrompt: orchestratorAgent.systemPrompt,
        });
        setExecutionLog(prev => [...prev, `${t('groups.execution.log.orchestratorRawResponseTitle')}\n${orchestratorResponse.orchestratorResponse}`]);
        let decision;
        try { decision = JSON.parse(orchestratorResponse.orchestratorResponse); }
        catch (parseError) {
          const errorMsg = t('groups.execution.criticalError.orchestratorParse');
          setExecutionLog(prev => [...prev, t('groups.execution.log.criticalErrorHeader') + `${errorMsg} Response: ${orchestratorResponse.orchestratorResponse}`]);
          toast({ variant: "destructive", title: t('groups.toast.execution.orchestratorError'), description: errorMsg });
          setIsGroupExecuting(false); break;
        }
        if (!decision.next_agent_id || !decision.instruction_for_next_agent) {
          const errorMsg = t('groups.execution.criticalError.orchestratorIncomplete');
          setExecutionLog(prev => [...prev, t('groups.execution.log.criticalErrorHeader') + errorMsg]);
          toast({ variant: "destructive", title: t('groups.toast.execution.orchestratorError'), description: errorMsg });
          setIsGroupExecuting(false); break;
        }
        setExecutionLog(prev => [...prev, t('groups.execution.log.orchestratorDecision', {nextAgentId: decision.next_agent_id, instruction: decision.instruction_for_next_agent, reasoning: decision.reasoning || 'N/A'})]);
        if (decision.next_agent_id.toUpperCase() === "COMPLETADO") {
          setExecutionLog(prev => [...prev, t('groups.execution.log.taskCompleted', {result: decision.instruction_for_next_agent})]);
          setIsGroupExecuting(false); break;
        }
        const selectedAgent = getAgentById(decision.next_agent_id);
        if (!selectedAgent) {
          const errorMsg = t('groups.execution.criticalError.agentNotFound', {id: decision.next_agent_id});
          setExecutionLog(prev => [...prev, t('groups.execution.log.criticalErrorHeader') + errorMsg]);
          toast({ variant: "destructive", title: t('groups.toast.execution.groupError'), description: errorMsg });
          setIsGroupExecuting(false); break;
        }
        setExecutionLog(prev => [...prev, t('groups.execution.log.callingAgentWithInstruction', {name: selectedAgent.name, instruction: decision.instruction_for_next_agent })]);
        const agentResponse = await callChatWithAgentOrGlobal({ userMessage: decision.instruction_for_next_agent, agentSystemPrompt: selectedAgent.systemPrompt });
        setExecutionLog(prev => [...prev, `${t('groups.execution.log.agentFullResponseTitle', { name: selectedAgent.name })}\n${agentResponse.aiResponse}`]);
        currentOrchestratorInput = agentResponse.aiResponse;
      } catch (error: any) {
        let friendlyMessage = t('groups.toast.execution.generalError');
        if (error instanceof AppError) {
          friendlyMessage = error.friendlyMessage;
          if (error.redirectTo) { setIsExecutionModalOpen(false); router.push(error.redirectTo); setIsGroupExecuting(false); break; }
        }
        setExecutionLog(prev => [...prev, t('groups.execution.log.errorInTurn', {turn: currentTurn, errorMessage: friendlyMessage})]);
        addDebugLog({source: 'GruposTrabajoIAPage', type: 'ERROR', message: `Error during group execution turn ${currentTurn}`, errorDetails: error, friendlyMessage, flowName });
        toast({ variant: "destructive", title: t('groups.toast.execution.generalError'), description: friendlyMessage });
        setIsGroupExecuting(false); break;
      }
      currentTurn++;
    }
    if (isGroupExecuting && currentTurn > MAX_EXECUTION_TURNS && !executionControllerRef.current.signal.aborted) {
      setExecutionLog(prev => [...prev, t('groups.execution.log.maxTurnsReached', {maxTurns: MAX_EXECUTION_TURNS})]);
    }
    if (!executionControllerRef.current?.signal.aborted && !isGroupExecuting && currentTurn <= MAX_EXECUTION_TURNS) {
        setExecutionLog(prev => [...prev, t('groups.execution.log.executionStoppedOrFinished')]);
    }
    setIsGroupExecuting(false);
    executionControllerRef.current = null;
  };

  const handleStopExecution = () => {
    if (executionControllerRef.current) { executionControllerRef.current.abort(); }
    setIsGroupExecuting(false);
    addDebugLog({source: 'GruposTrabajoIAPage', type: 'WARN', message: `Group execution stop requested for: ${executingGroup?.name}`, flowName: 'stopAIGroupExecution'});
  };

  const handleSuggestGroup = async () => {
    if (!groupTaskDescription.trim()) {
      toast({ variant: 'destructive', title: t('groups.toast.suggestion.taskRequired.title'), description: t('groups.toast.suggestion.taskRequired.description') }); return;
    }
    setIsSuggestingGroup(true);
    const flowName = 'suggestGroupDefinition';
    addDebugLog({source: 'GruposTrabajoIAPage', type: 'INFO', message: `Requesting AI suggestion for group task: ${groupTaskDescription}`, flowName});
    try {
      const agentInfos: AgentInfoForGroupSuggestion[] = availableAgentsForSelection.map(a => ({ id: a.id, name: a.name, description: a.description }));
      const suggestion = await callSuggestGroupDefinition({ groupTaskDescription, availableAgents: agentInfos });
      toast({ title: t('groups.toast.suggestion.received.title'), description: t('groups.toast.suggestion.received.description', { name: suggestion.name }) });
      setIsSuggestGroupDialogOpen(false); setGroupTaskDescription('');
      handleOpenForm(suggestion);
    } catch (error: any) {
      addDebugLog({source: 'GruposTrabajoIAPage', type: 'ERROR', message: 'AI group suggestion failed', errorDetails: error.originalError || error, friendlyMessage: error.friendlyMessage, flowName});
      const errorMsg = error instanceof AppError ? error.friendlyMessage : error.message || t('groups.toast.suggestion.error.description');
      toast({ variant: 'destructive', title: t('groups.toast.suggestion.error.title'), description: errorMsg });
      if (error instanceof AppError && error.redirectTo) { router.push(error.redirectTo); }
    } finally { setIsSuggestingGroup(false); }
  };

  const groupSuggestionExtraFooter = availableAgentsForSelection.length === 0 ? <p className="text-xs text-destructive text-center">{t('groups.suggestionDialog.noAgentsWarning')}</p> : null;
  const getDialogTitleKey = () => editingGroup ? (editingGroup.id.startsWith('suggested-') ? 'groups.form.title.reviewSuggestion' : 'groups.form.title.edit') : 'groups.form.title.create';
  const getDialogDescriptionKey = () => editingGroup && !editingGroup.id.startsWith('suggested-') ? 'groups.form.descriptionModal.edit' : 'groups.form.descriptionModal.create';
  const getSubmitButtonTextKey = () => editingGroup ? (editingGroup.id.startsWith('suggested-') ? 'groups.form.button.createGroupWithSuggestion' : 'groups.form.button.saveChanges') : 'groups.form.button.createGroup';

  return (
    <div className="space-y-6">
      <Card>
        <GroupsPageHeader
          t={t}
          onOpenSuggestDialog={() => setIsSuggestGroupDialogOpen(true)}
          onOpenForm={() => handleOpenForm()}
          canSuggest={availableAgentsForSelection.length > 0}
        />
        <CardContent>
          <GroupListDisplay
            t={t}
            groups={groups}
            isAnyGroupExecuting={isGroupExecuting}
            onExecuteGroup={handleExecuteGroup}
            onOpenForm={handleOpenForm}
            onDeleteGroup={handleDeleteGroup}
            isFormForGroupOpen={(groupId) => isFormOpen && editingGroup?.id === groupId}
          />
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingGroup(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t(getDialogTitleKey() as TranslationKey)}</DialogTitle>
            <DialogDescriptionComponent>{t(getDialogDescriptionKey() as TranslationKey, { name: editingGroup?.name || '' })}</DialogDescriptionComponent>
          </DialogHeader>
          <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-6 -mr-6">
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="group-name">{t('groups.form.label.name')}</Label>
                  <Input id="group-name" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="group-description">{t('groups.form.label.description')}</Label>
                  <Textarea id="group-description" value={formData.description} onChange={(e) => handleFormChange('description', e.target.value)} rows={2} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="group-mainTask">{t('groups.form.label.mainTask')}</Label>
                  <Textarea id="group-mainTask" value={formData.mainTask} onChange={(e) => handleFormChange('mainTask', e.target.value)} rows={4} placeholder={t('groups.form.placeholder.mainTask')} />
                </div>
                <Label className="font-semibold">{t('groups.form.label.selectAgents')}</Label>
                <p className="text-xs text-muted-foreground">{t('groups.form.orchestratorImplicitNote')}</p>
                {availableAgentsForSelection.length === 0 ? (
                  <p className="text-sm text-destructive p-2 border border-destructive/50 rounded-md">{t('groups.form.noAgentsToSelectError')}</p>
                ) : (
                  <ScrollArea className="h-40 border rounded-md p-2"><div className="space-y-2">
                    {availableAgentsForSelection.map(agent => (
                      <div key={agent.id} className="flex items-center space-x-2">
                        <Checkbox id={`agent-${agent.id}`} checked={formData.agentIds.includes(agent.id)} onCheckedChange={(checked) => handleAgentSelectionChange(agent.id, !!checked)} />
                        <Label htmlFor={`agent-${agent.id}`} className="font-normal text-sm">{agent.name}</Label>
                      </div>))}
                  </div></ScrollArea>
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="pt-4 border-t mt-auto">
            <DialogClose asChild><Button variant="outline">{t('common.cancel')}</Button></DialogClose>
            <Button onClick={handleSubmitForm} disabled={availableAgentsForSelection.length === 0 && formData.agentIds.length === 0}>{t(getSubmitButtonTextKey() as TranslationKey)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog isOpen={!!groupToDelete} onClose={() => setGroupToDelete(null)} onConfirm={confirmDeleteGroup} title={t('groups.deleteSingleModal.title', { name: groupToDelete?.name || 'N/A'})} description={t('groups.deleteSingleModal.description')} confirmText={t('common.confirm')} />

      <Dialog open={isExecutionModalOpen} onOpenChange={(open) => {if(!open) { handleStopExecution(); setIsExecutionModalOpen(false); }}}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{t('groups.executionModal.title', { name: executingGroup?.name || 'N/A' })}</DialogTitle>
                <DialogDescriptionComponent>{t('groups.executionModal.mainTaskLabel')} {executingGroup?.mainTask}</DialogDescriptionComponent>
            </DialogHeader>
            <div className="flex-grow overflow-hidden -mx-6"><LogsDisplay title={t('groups.executionModal.logTitle')} logs={executionLog} defaultExpanded={true} /></div>
            <DialogFooter className="pt-4 border-t mt-auto">
                <Button variant="outline" onClick={handleStopExecution} disabled={!isGroupExecuting}>{t('groups.executionModal.stopButton')}</Button>
                <DialogClose asChild><Button>{t('common.close')}</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AISuggestionDialog isOpen={isSuggestGroupDialogOpen} onOpenChange={setIsSuggestGroupDialogOpen} dialogTitle={t('groups.suggestionDialog.title')} dialogDescription={t('groups.suggestionDialog.description')} textareaLabel={t('groups.suggestionDialog.textareaLabel')} textareaPlaceholder={t('groups.suggestionDialog.textareaPlaceholder')} textareaValue={groupTaskDescription} onTextareaChange={setGroupTaskDescription} onSubmit={handleSuggestGroup} isSubmitting={isSuggestingGroup} extraFooterContent={groupSuggestionExtraFooter} submitButtonText={availableAgentsForSelection.length > 0 ? t('groups.suggestionDialog.submitButton') : t('groups.suggestionDialog.submitButtonDisabled')} />
    </div>
  );
}
