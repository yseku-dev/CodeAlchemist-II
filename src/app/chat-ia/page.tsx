
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, ChatMessage, Agent, AIAgentGroup } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/utils/AppError';
import { callChatWithAgentOrGlobal, callChatWithAIGroup, callRedefinePrompt } from '@/utils/apiClient'; // Added callRedefinePrompt
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import { Card, CardContent } from '@/components/ui/card'; // Only Card and CardContent needed from card

import ChatHeader from '@/components/features/chat-ia/ChatHeader';
import ChatMessageList from '@/components/features/chat-ia/ChatMessageList';
import ChatInputArea from '@/components/features/chat-ia/ChatInputArea';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';

/**
 * @fileOverview ChatIAPage component allows users to interact with an AI assistant.
 * Users can select a global LLM configuration, a specific agent, or an AI agent group
 * to direct their conversation. The component handles message sending, display,
 * error handling, and chat clearing. All UI texts are internationalized.
 */
export default function ChatIAPage() {
  const { addLog: addLogContext } = useDebug();
  const { agents, groups, getAgentById } = useAppState();
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedefiningCurrentMessage, setIsRedefiningCurrentMessage] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    const currentInputMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);
    const flowName = llmConfigSource?.type === 'Grupo' ? 'chatWithAIGroup' : 'chatWithAgentOrGlobal';
    addLogContext({ source: 'ChatIAPage', type: 'INFO', message: `User message to AI: ${userMessage.content.substring(0,50)}... Config: ${JSON.stringify(llmConfigSource)}`, flowName });


    let aiResponseContent = t('chat.systemMessage.errorPrefix') + "No se pudo obtener respuesta de la IA.";

    try {
      if (llmConfigSource?.type === 'Ajustes Globales') {
        const result = await callChatWithAgentOrGlobal({ userMessage: currentInputMessage });
        aiResponseContent = result.aiResponse;
      } else if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        if (agent) {
          const result = await callChatWithAgentOrGlobal({ userMessage: currentInputMessage, agentSystemPrompt: agent.systemPrompt });
          aiResponseContent = result.aiResponse;
        } else {
          throw new Error(`Agente con ID "${llmConfigSource.id}" no encontrado.`);
        }
      } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = groups.find(g => g.id === llmConfigSource.id);
        const orchestratorAgent = agents.find(a => a.id === 'orquestador-flujo-agentes'); 

        if (group && orchestratorAgent) {
          const participatingAgentsInfo = group.agentIds
            .map(id => getAgentById(id))
            .filter(Boolean) as Agent[]; 

          const result = await callChatWithAIGroup({
            userMessage: currentInputMessage,
            groupMainTask: group.mainTask,
            participatingAgents: participatingAgentsInfo.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                systemPrompt: p.systemPrompt, 
                capabilities: p.capabilities,
                llmConfig: p.llmConfig
            })),
            orchestratorAgentSystemPrompt: orchestratorAgent.systemPrompt,
          });
          aiResponseContent = t('chat.groupResponsePrefix', { groupName: group.name}) + `\n${result.orchestratorResponse}`;
        } else {
          throw new Error(`Grupo con ID "${llmConfigSource.id}" o Agente Orquestador no encontrado.`);
        }
      }
      
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: aiResponseContent,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      addLogContext({ source: 'ChatIAPage', type: 'SUCCESS', message: `AI response: ${aiResponseContent.substring(0,50)}...`, flowName });
    } catch (e: any) {
      addLogContext({ source: 'ChatIAPage', type: 'ERROR', message: "AI chat error in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      
      const systemErrorMessageContent = e instanceof AppError ? e.friendlyMessage : (e.message || "Ocurrió un error al comunicarse con la IA.");
      const systemErrorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: t('chat.systemMessage.errorPrefix') + `${systemErrorMessageContent}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, systemErrorMessage]);
      
      setError(systemErrorMessageContent);
      toast({ variant: "destructive", title: t('chat.toast.chatError.title'), description: systemErrorMessageContent });

      if (e instanceof AppError && e.redirectTo) {
        router.push(e.redirectTo);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    toast({ title: t('chat.toast.chatCleared.title'), description: t('chat.toast.chatCleared.description') });
    addLogContext({source: 'ChatIAPage', type: 'INFO', message: "Chat history cleared."});
  };
  
  const handleAutoFixError = async (errorMsg: string) => {
    addLogContext({source: 'ChatIAPage', type: 'INFO', message: `Attempting Auto-Fix for chat error: ${errorMsg}`, flowName: 'chatWithAgentOrGlobal (AutoFix)'});
    toast({ title: t('common.processing'), description: t('errorDisplay.toast.autofixAttempt.description')});
  };

  const handleRedefineCurrentMessage = async () => {
    if (!currentMessage.trim()) {
      toast({ variant: 'destructive', title: t('common.toast.redefineEmpty.title'), description: t('common.toast.redefineEmpty.description') });
      return;
    }
    setIsRedefiningCurrentMessage(true);
    addLogContext({ source: 'ChatIAPage', type: 'INFO', message: `Redefining current message. Original: ${currentMessage.substring(0, 100)}...` });
    toast({ title: t('common.toast.redefining.title'), description: t('common.toast.redefining.description') });
    try {
      const result = await callRedefinePrompt({ originalPrompt: currentMessage });
      setCurrentMessage(result.redefinedPrompt);
      toast({ title: t('common.toast.redefinedSuccess.title'), description: t('common.toast.redefinedSuccess.description') });
      addLogContext({ source: 'ChatIAPage', type: 'SUCCESS', message: `'currentMessage' redefined. New: ${result.redefinedPrompt.substring(0, 100)}...` });
    } catch (e: any) {
      const errorMsg = e instanceof AppError ? e.friendlyMessage : (e.message || t('common.toast.redefineError.description'));
      toast({ variant: 'destructive', title: t('common.toast.redefineError.title'), description: errorMsg });
      addLogContext({ source: 'ChatIAPage', type: 'ERROR', message: `Redefining 'currentMessage' failed`, errorDetails: e });
       if (e instanceof AppError && e.redirectTo) router.push(e.redirectTo);
    } finally {
      setIsRedefiningCurrentMessage(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <ChatHeader t={t} />
      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        <ChatMessageList messages={messages} isLoading={isLoading} scrollAreaRef={scrollAreaRef} t={t} />
      </CardContent>
      <ChatInputArea
        llmConfigSource={llmConfigSource}
        onLlmConfigSourceChange={setLlmConfigSource}
        currentMessage={currentMessage}
        onCurrentMessageChange={setCurrentMessage}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        onClearChat={handleClearChat}
        messages={messages}
        isLoading={isLoading || isRedefiningCurrentMessage}
        error={error}
        onAutoFixError={handleAutoFixError}
        t={t}
        isRedefiningCurrentMessage={isRedefiningCurrentMessage}
        onRedefineCurrentMessage={handleRedefineCurrentMessage}
      />
    </Card>
  );
}
