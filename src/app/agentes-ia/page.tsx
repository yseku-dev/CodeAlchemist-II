
"use client";

import React, { useState, useEffect } from 'react'; // Added useEffect
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // Added CardHeader, CardTitle, CardDescription
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
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';


/**
 * @fileOverview AgentesIAPage component for managing AI Agents.
 * Allows users to create, edit, delete, import, export, and test individual AI agents.
 * Includes AI-assisted agent creation via a dialog.
 * All UI text is internationalized.
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

  /**
   * Prepares the state for the agent form based on an existing agent or an AI suggestion.
   * If an AI suggestion is provided, it's transformed into a structure AgentForm can use for pre-filling.
   * A temporary ID starting with 'suggested-' is used for suggested agents until they are saved.
   * @param {Agent | SuggestAgentDefinitionOutput} [agentOrSuggestion] - The agent to edit or an AI-generated suggestion for a new agent.
   * @returns {Agent | null} The agent object to be used for form pre-filling, or null if no agent/suggestion is provided.
   */
  const _prepareEditingAgentState = (agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput): Agent | null => {
    if (agentOrSuggestion && 'id' in agentOrSuggestion && typeof agentOrSuggestion.id === 'string' && !agentOrSuggestion.id.startsWith('suggested-')) {
      // It's an existing Agent object
      return agentOrSuggestion as Agent;
    } else if (agentOrSuggestion) {
      // It's a suggestion (SuggestAgentDefinitionOutput)
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
      // Create a temporary Agent-like structure for the form to pre-fill
      return { ...suggestedFormData, id: `suggested-${uuidv4()}` } as Agent;
    }
    return null; // No agent or suggestion provided
  };

  /**
   * Opens the agent form, pre-filling it if an agent to edit or an AI suggestion is provided.
   * @param {Agent | SuggestAgentDefinitionOutput} [agentOrSuggestion] - Optional. The agent to edit or an AI-generated suggestion.
   */
  const handleOpenForm = (agentOrSuggestion?: Agent | SuggestAgentDefinitionOutput) => {
    setEditingAgent(_prepareEditingAgentState(agentOrSuggestion));
    setIsFormOpen(true);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Agent form opened. Editing: ${!!agentOrSuggestion}, Is Suggestion: ${agentOrSuggestion && !('id' in agentOrSuggestion && (agentOrSuggestion as Agent).id && !(agentOrSuggestion as Agent).id.startsWith('suggested-'))}`});
  };


  /**
   * Handles the submission of the agent form.
   * If `editingAgent` has an ID starting with 'suggested-', it's treated as a new agent created from an AI suggestion.
   * Otherwise, it updates an existing agent or creates a new one from scratch.
   * @param {AgentFormData} formData - The data submitted from the AgentForm.
   */
  const handleSubmitAgentForm = (formData: AgentFormData) => {
    const flowName = editingAgent ? 'updateAgent' : 'addAgent';
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Submitting agent form: ${editingAgent ? 'Update/Confirm Suggestion' : 'Create New'}`, data: formData, flowName});

    if (editingAgent && editingAgent.id.startsWith('suggested-')) {
        // This was an AI suggestion being confirmed/created
        // The formData already has the user's potential modifications
        addAgent(formData); // The addAgent function will assign a new final ID
        toast({ title: t('agents.toast.created.title'), description: t('agents.toast.created.description', {name: formData.name}) });
    } else if (editingAgent) {
      // Editing an existing agent
      if (editingAgent.isNameEditable === false && editingAgent.name !== formData.name) {
        toast({ variant: "destructive", title: t('agents.toast.form.nameUneditableError.title'), description: t('agents.toast.form.nameUneditableError.description', {name: editingAgent.name})});
        return;
      }
      updateAgent({ ...editingAgent, ...formData } as Agent); // Ensure all properties of Agent are present
      toast({ title: t('agents.toast.updated.title'), description: t('agents.toast.updated.description', {name: formData.name}) });
    } else {
      // Creating a new agent from scratch
      addAgent(formData);
      toast({ title: t('agents.toast.created.title'), description: t('agents.toast.created.description', {name: formData.name}) });
    }
    setIsFormOpen(false);
    setEditingAgent(null); // Clear editing/suggestion state
    addLog({source: 'AgentesIAPage', type: 'SUCCESS', message: `Agent ${formData.id && !formData.id.startsWith('suggested-') ? 'updated' : 'created/confirmed'}: ${formData.name}`, flowName});
  };

  /**
   * Prepares an agent for deletion by opening the confirmation dialog.
   * Checks if the agent is deletable.
   * @param {Agent} agent - The agent to be deleted.
   */
  const handleDeleteAgent = (agent: Agent) => {
    if (agent.isDeletable === false) {
      toast({ variant: "destructive", title: t('agents.toast.form.deleteError.title'), description: t('agents.toast.form.deleteError.description', {name: agent.name})});
      return;
    }
    setAgentToDelete(agent);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Deletion requested for agent: ${agent.name}`, data: { agentId: agent.id }, flowName: 'deleteAgent'});
  };

  /**
   * Confirms and executes the deletion of the agent set in `agentToDelete`.
   * Resets `agentToDelete` after deletion.
   */
  const confirmDeleteAgent = () => {
    if (agentToDelete) {
      addLog({source: 'AgentesIAPage', type: 'INFO', message: `Deleting agent: ${agentToDelete.name}`, data: { agentId: agentToDelete.id }, flowName: 'deleteAgent'});
      const agentName = agentToDelete.name;
      deleteAgent(agentToDelete.id);
      setAgentToDelete(null);
      // Toast is handled by deleteAgent in AppStateContext now
    }
  };

  /**
   * Handles the import of agents from a JSON file.
   * Reads the file, parses JSON, validates structure, and updates the agent list.
   * Overwrites agents with the same name if found.
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
            // Ensure imported agents get new IDs and default flags are correctly set
            const newAgents = importedAgents.map(ia => ({
              ...ia,
              id: uuidv4(), // Always assign a new ID on import
              isDefault: false, // Imported agents are not default
              isDeletable: true, // Imported agents are deletable
              isNameEditable: true // Imported agents are name-editable
            }));
            setAgents(prev => {
              const existingNames = new Set(newAgents.map(na => na.name));
              // Filter out existing agents that have the same name as any of the imported agents
              const filteredPrev = prev.filter(pa => !existingNames.has(pa.name));
              return [...filteredPrev, ...newAgents];
            });
            toast({ title: t('agents.toast.import.success.title'), description: t('agents.toast.import.success.description', {count: importedAgents.length}) });
            addLog({source: 'AgentesIAPage', type: 'SUCCESS', message: `${importedAgents.length} agents imported/updated.`, flowName: 'importAgents'});
          } else {
            throw new Error(t('agents.toast.import.invalidFormat'));
          }
        } catch (err: any) {
          toast({ variant: "destructive", title: t('agents.toast.import.error.title'), description: err.message });
          addLog({source: 'AgentesIAPage', type: 'ERROR', message: `Agent import failed: ${err.message}`, errorDetails: err, flowName: 'importAgents'});
        }
      };
      reader.readAsText(file);
      if (event.target) event.target.value = ""; // Reset file input
    }
  };

  /**
   * Handles the export of all current agents to a JSON file.
   * The file is named "codealchemist_agents.json".
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
    toast({ title: t('agents.toast.exportAll.success.title'), description: t('agents.toast.exportAll.success.description') });
    addLog({source: 'AgentesIAPage', type: 'INFO', message: "All agents exported.", flowName: 'exportAgents'});
  };

  /**
   * Handles the export of a single agent to a JSON file.
   * The filename includes the agent's name.
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
    toast({ title: t('agents.toast.exportSingle.success.title'), description: t('agents.toast.exportSingle.success.description', {name: agent.name}) });
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Agent "${agent.name}" exported.`, data: { agentId: agent.id }, flowName: 'exportSingleAgent'});
  };

  /**
   * Opens the test chat modal for a specific agent.
   * @param {Agent} agent - The agent to test.
   */
  const handleTestAgent = (agent: Agent) => {
    setTestingAgent(agent);
    setIsTestChatOpen(true);
    addLog({source: 'AgentesIAPage', type: 'INFO', message: `Opening test chat for agent: ${agent.name}`, data: { agentId: agent.id }});
  };

  /**
   * Handles the AI-assisted agent suggestion process.
   * Calls an AI flow to get suggestions based on user's role description
   * and pre-fills the agent creation form with these suggestions.
   */
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
      handleOpenForm(suggestion); // Open form with AI suggestion
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
         <PageSectionHeader
          icon={Users2}
          title={t('agents.title')}
          description={t('agents.description')}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsSuggestAgentDialogOpen(true)}>
                <SparklesIcon className="mr-2 h-4 w-4" /> {t('agents.createWithAIButton')}
              </Button>
              <Input type="file" accept=".json" onChange={handleImportAgents} className="hidden" id="import-agents-input" />
              <Button variant="outline" onClick={() => document.getElementById('import-agents-input')?.click()}><Upload className="mr-2 h-4 w-4" />{t('agents.importButton')}</Button>
              <Button variant="outline" onClick={handleExportAgents} disabled={agents.length === 0}><Download className="mr-2 h-4 w-4" />{t('agents.exportAllButton')}</Button>
              <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" />{t('agents.createAgentButton')}</Button>
            </div>
          }
        />
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t('agents.noAgentsMessage')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <Card key={agent.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{agent.name} {agent.isDefault && <span className="text-xs text-primary font-normal">{t('agents.defaultAgentBadge')}</span>}</CardTitle>
                    <CardDescription className="text-xs h-10 overflow-hidden text-ellipsis">{agent.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1 flex-grow">
                    <p><strong>{t('agents.llmLabel')}</strong> {agent.llmConfig.useGlobal ? t('agents.llmGlobalFormat', {provider: globalSettings.llmConfig.provider}) : t('agents.llmCustomFormat', {provider: agent.llmConfig.customConfig?.provider || t('agents.llmNotApplicable')})}</p>
                    <p><strong>{t('agents.capabilitiesLabel')}</strong>
                        {Object.entries(agent.capabilities).filter(([, val]) => val).map(([key]) => {
                            const capabilityKey = `agents.form.capability.${key.toLowerCase()}` as TranslationKey;
                            const translatedCap = t(capabilityKey);
                            const displayName = translatedCap !== capabilityKey
                                ? translatedCap
                                : key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());
                            return displayName;
                        }).join(', ') || t('agents.noCapabilities')}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-1 p-2">
                    <Button variant="ghost" size="icon" title={t('agents.action.test')} onClick={() => handleTestAgent(agent)}><PlayCircle className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title={t('agents.action.export')} onClick={() => handleExportSingleAgent(agent)}><Download className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title={t('agents.action.edit')} onClick={() => handleOpenForm(agent)} disabled={agent.isNameEditable === false}><Edit3 className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title={t('agents.action.delete')} onClick={() => handleDeleteAgent(agent)} disabled={agent.isDeletable === false}><Trash2 className="h-4 w-4 text-destructive"/></Button>
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
          if (!open) setEditingAgent(null); // Clear editing agent when form closes
        }}
        editingAgent={editingAgent} // Pass the agent to be edited or the suggestion
        onSubmit={handleSubmitAgentForm}
        getModelsForProvider={getModelsForProvider}
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
