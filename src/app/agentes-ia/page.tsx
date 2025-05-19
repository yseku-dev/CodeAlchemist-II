// src/app/agentes-ia/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppState } from '@/context/AppStateContext';
import { useToast } from '@/hooks/use-toast';
import { useDebug } from '@/context/DebugContext';
import type { Agent, AgentFormData, SuggestAgentDefinitionOutput } from '@/types';
import { DEFAULT_LLM_SETTINGS, LLM_PROVIDER_DEFAULT_API_URLS } from '@/lib/constants';
import ConfirmDialog from '@/components/confirm-dialog';
import AgentForm from '@/components/features/agentes-ia/agent-form';
import AgentTestChat from '@/components/features/agentes-ia/agent-test-chat';
import { v4 as uuidv4 } from 'uuid';
import { callSuggestAgentDefinition } from '@/utils/apiClient';
import { AppError } from '@/utils/AppError';
import { getModelsForProvider } from '@/lib/utils';
import AISuggestionDialog from '@/components/features/common/AISuggestionDialog';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import AgentsPageHeader from '@/components/features/agentes-ia/AgentsPageHeader';
import AgentListDisplay from '@/components/features/agentes-ia/AgentListDisplay';

/**
 * @fileOverview AgentesIAPage component for managing AI Agents.
 * Allows users to create, edit, delete, import, export, and test individual AI agents.
 * Includes AI-assisted agent creation via a dialog.
 * All UI text is internationalized.
 * @module AgentesIAPage
 */
export default function AgentesIAPage() {
  const { agents, addAgent, updateAgent, deleteAgent, settings: globalSettings, setAgents } = useAppState();
  const { toast } = useToast();
  const { addLog } = useDebug();
  const router = useRouter();
  const { t } = useI18n();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const [isTestChatOpen, setIsTestChatOpen] = useState(false);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);

  const [isSuggestAgentDialogOpen, setIsSuggestAgentDialogOpen] = useState(false);
  const [agentRoleDescription, setAgentRoleDescription] = useState('');
  const [isSuggestingAgent, setIsSuggestingAgent] = useState(false);

  const _prepareEditingAgentState = useCallback((agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput): Agent | null => {
    if (agentOrSuggestion && 'id' in agentOrSuggestion && typeof agentOrSuggestion.id === 'string' && !agentOrSuggestion.id.startsWith('suggested-')) {
      return agentOrSuggestion as Agent;
    } else if (agentOrSuggestion) {
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
      return { ...suggestedFormData, id: `suggested-${uuidv4()}` } as Agent;
    }
    return null;
  }, [globalSettings.llmConfig]);

  const handleOpenForm = useCallback((agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput) => {
    setEditingAgent(_prepareEditingAgentState(agentOrSuggestion));
    setIsFormOpen(true);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Agent form opened. Editing: ${!!agentOrSuggestion}, Is Suggestion: ${agentOrSuggestion && !('id' in agentOrSuggestion && (agentOrSuggestion as Agent).id && !(agentOrSuggestion as Agent).id.startsWith('suggested-'))}`});
  }, [_prepareEditingAgentState, addLog]);

  const handleSubmitAgentForm = (formData: AgentFormData) => {
    const flowName = editingAgent ? 'updateAgent' : 'addAgent';
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Submitting agent form: ${editingAgent ? 'Update/Confirm Suggestion' : 'Create New'}`, data: formData, flowName});

    if (editingAgent && editingAgent.id.startsWith('suggested-')) {
        addAgent(formData);
        toast({ title: t('agents.toast.created.title'), description: t('agents.toast.created.description', {name: formData.name}) });
    } else if (editingAgent) {
      if (editingAgent.isNameEditable === false && editingAgent.name !== formData.name) {
        toast({ variant: "destructive", title: t('agents.toast.form.nameUneditableError.title'), description: t('agents.toast.form.nameUneditableError.description', {name: editingAgent.name})});
        return;
      }
      updateAgent({ ...editingAgent, ...formData } as Agent);
      toast({ title: t('agents.toast.updated.title'), description: t('agents.toast.updated.description', {name: formData.name}) });
    } else {
      addAgent(formData);
      toast({ title: t('agents.toast.created.title'), description: t('agents.toast.created.description', {name: formData.name}) });
    }
    setIsFormOpen(false);
    setEditingAgent(null);
    addLog({source: 'AgentesIAPage', type: 'SUCCESS', message: `Agent ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`, flowName});
  };

  const handleDeleteAgent = (agent: Agent) => {
    if (agent.isDeletable === false) {
      toast({ variant: "destructive", title: t('agents.toast.form.deleteError.title'), description: t('agents.toast.form.deleteError.description', {name: agent.name})});
      return;
    }
    setAgentToDelete(agent);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Deletion requested for agent: ${agent.name}`, data: { agentId: agent.id }, flowName: 'deleteAgent'});
  };

  const confirmDeleteAgent = () => {
    if (agentToDelete) {
      addLog({source: 'AgentesIAPage', type: 'INFO', message: `Deleting agent: ${agentToDelete.name}`, data: { agentId: agentToDelete.id }, flowName: 'deleteAgent'});
      const agentName = agentToDelete.name;
      deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
      toast({ title: t('agents.toast.deleted.title'), description: t('agents.toast.deleted.description', {name: agentName}) });
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
            const newAgents = importedAgents.map(ia => ({
              ...ia, id: uuidv4(), isDefault: false, isDeletable: true, isNameEditable: true
            }));
            setAgents(prev => {
              const existingNames = new Set(newAgents.map(na => na.name));
              const filteredPrev = prev.filter(pa => !existingNames.has(pa.name));
              return [...filteredPrev, ...newAgents];
            });
            toast({ title: t('agents.toast.import.success.title'), description: t('agents.toast.import.success.description', {count: importedAgents.length}) });
            addLog({source: 'AgentesIAPage', type: 'SUCCESS', message: `${importedAgents.length} agents imported/updated.`, flowName: 'importAgents'});
          } else {
            throw new Error(t('agents.toast.import.invalidFormat'));
          }
        } catch (err: any) {
          toast({ variant: "destructive", title: t('agents.toast.import.error.title'), description: t('agents.toast.import.error.description', {error: err.message }) });
          addLog({source: 'AgentesIAPage', type: 'ERROR', message: `Agent import failed: ${err.message}`, errorDetails: err, flowName: 'importAgents'});
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
    toast({ title: t('agents.toast.exportAll.success.title'), description: t('agents.toast.exportAll.success.description') });
    addLog({source: 'AgentesIAPage', type: 'INFO', message: "All agents exported.", flowName: 'exportAgents'});
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
    toast({ title: t('agents.toast.exportSingle.success.title'), description: t('agents.toast.exportSingle.success.description', {name: agent.name}) });
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Agent "${agent.name}" exported.`, data: { agentId: agent.id }, flowName: 'exportSingleAgent'});
  };

  const handleTestAgent = (agent: Agent) => {
    setTestingAgent(agent);
    setIsTestChatOpen(true);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Opening test chat for agent: ${agent.name}`, data: { agentId: agent.id }});
  };

  const handleSuggestAgent = async () => {
    if (!agentRoleDescription.trim()) {
      toast({ variant: 'destructive', title: t('agents.toast.suggestion.roleRequired.title'), description: t('agents.toast.suggestion.roleRequired.description') });
      return;
    }
    setIsSuggestingAgent(true);
    const flowName = 'suggestAgentDefinition';
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Requesting AI suggestion for agent role: ${agentRoleDescription}`, flowName});
    try {
      const suggestion = await callSuggestAgentDefinition({ roleDescription: agentRoleDescription });
      toast({ title: t('agents.toast.suggestion.received.title'), description: t('agents.toast.suggestion.received.description', { name: suggestion.name }) });
      setIsSuggestAgentDialogOpen(false);
      setAgentRoleDescription('');
      handleOpenForm(suggestion);
    } catch (error: any) {
      addLog({source: 'AgentesIAPage', type: 'ERROR', message: 'AI agent suggestion failed', errorDetails: error.originalError || error, friendlyMessage: error.friendlyMessage, flowName});
      const errorMsg = error instanceof AppError ? error.friendlyMessage : (error.message || t('agents.toast.suggestion.error.description'));
      toast({ variant: 'destructive', title: t('agents.toast.suggestion.error.title'), description: errorMsg });
      if (error instanceof AppError && error.redirectTo) {
        router.push(error.redirectTo);
      }
    } finally {
      setIsSuggestingAgent(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <AgentsPageHeader
          t={t}
          onOpenSuggestDialog={() => setIsSuggestAgentDialogOpen(true)}
          onImportAgents={handleImportAgents}
          onExportAgents={handleExportAgents}
          agentsCount={agents.length}
          onOpenForm={() => handleOpenForm()}
        />
        <CardContent>
          <AgentListDisplay
            t={t}
            agents={agents}
            globalSettings={globalSettings}
            onTestAgent={handleTestAgent}
            onExportSingleAgent={handleExportSingleAgent}
            onOpenForm={handleOpenForm}
            onDeleteAgent={handleDeleteAgent}
          />
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
        globalLLMConfig={globalSettings.llmConfig}
      />

      <ConfirmDialog
        isOpen={!!agentToDelete}
        onClose={() => setAgentToDelete(null)}
        onConfirm={confirmDeleteAgent}
        title={t('agents.deleteSingleModal.title', { name: agentToDelete?.name || 'N/A' })}
        description={t('agents.deleteSingleModal.description')}
        confirmText={t('common.confirm')}
      />

      <AgentTestChat
        isOpen={isTestChatOpen}
        onOpenChange={setIsTestChatOpen}
        testingAgent={testingAgent}
      />

      <AISuggestionDialog
        isOpen={isSuggestAgentDialogOpen}
        onOpenChange={setIsSuggestAgentDialogOpen}
        dialogTitle={t('agents.suggestionDialog.title')}
        dialogDescription={t('agents.suggestionDialog.description')}
        textareaLabel={t('agents.suggestionDialog.textareaLabel')}
        textareaPlaceholder={t('agents.suggestionDialog.textareaPlaceholder')}
        textareaValue={agentRoleDescription}
        onTextareaChange={setAgentRoleDescription}
        onSubmit={handleSuggestAgent}
        isSubmitting={isSuggestingAgent}
        submitButtonText={t('agents.suggestionDialog.submitButton')}
      />
    </div>
  );
}
