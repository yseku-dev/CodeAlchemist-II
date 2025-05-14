
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Bot, User, Loader2, MessageCircle } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption, ChatMessage, Agent, AIAgentGroup } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/utils/AppError';
import { callChatWithAgentOrGlobal, callChatWithAIGroup } from '@/utils/apiClient';
import PageSectionHeader from '@/components/layout/PageSectionHeader';
import { useRouter } from 'next/navigation';


/**
 * @fileOverview ChatIAPage component allows users to interact with an AI assistant.
 * Users can select a global LLM configuration, a specific agent, or an AI agent group
 * to direct their conversation. The component handles message sending, display,
 * error handling, and chat clearing.
 */
export default function ChatIAPage() {
  const { addLog: addLogContext } = useDebug();
  const { agents, groups, getAgentById } = useAppState();
  const router = useRouter();

  const [llmConfigSource, setLlmConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  /**
   * Handles sending the current message to the AI based on the selected LLM configuration.
   * It updates the chat history with user and AI messages and handles loading states and errors.
   */
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
    addLogContext({ message: `User message to AI: ${userMessage.content.substring(0,50)}... Config: ${JSON.stringify(llmConfigSource)}`, flowName });


    let aiResponseContent = "Error: No se pudo obtener respuesta de la IA.";

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
          aiResponseContent = `Respuesta del Orquestador para el grupo "${group.name}":\n${result.orchestratorResponse}`;
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
      addLogContext({ message: `AI response: ${aiResponseContent.substring(0,50)}...`, flowName });
    } catch (e: any) {
      addLogContext({ message: "AI chat error in UI", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName });
      
      const systemErrorMessageContent = e instanceof AppError ? e.friendlyMessage : (e.message || "Ocurrió un error al comunicarse con la IA.");
      const systemErrorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${systemErrorMessageContent}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, systemErrorMessage]);
      
      setError(systemErrorMessageContent);
      toast({ variant: "destructive", title: "Error de Chat", description: systemErrorMessageContent });

      if (e instanceof AppError && e.redirectTo) {
        router.push(e.redirectTo);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Handles key press events in the textarea, sending the message on Enter (without Shift).
   * @param {React.KeyboardEvent<HTMLTextAreaElement>} event - The keyboard event.
   */
  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * Clears the current chat history and error state.
   */
  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    toast({ title: "Chat Limpiado", description: "El historial de la conversación ha sido borrado." });
    addLogContext("Chat history cleared.");
  };
  
  /**
   * Attempts to use the AI to analyze and suggest a fix for a displayed error message.
   * @param {string} errorMsg - The error message to analyze.
   */
  const handleAutoFixError = async (errorMsg: string) => {
    addLogContext({message: `Attempting Auto-Fix for chat error: ${errorMsg}`, flowName: 'chatWithAgentOrGlobal (AutoFix)'});
    const userFixRequest: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: `Por favor, analiza este error y sugiere una solución: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userFixRequest]);
    setIsLoading(true);
    setError(null);
    try {
      const result = await callChatWithAgentOrGlobal({ userMessage: userFixRequest.content });
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.aiResponse,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
        addLogContext({ message: "Auto-fix attempt failed", errorDetails: e.originalError || e, friendlyMessage: e.friendlyMessage, flowName: 'chatWithAgentOrGlobal (AutoFix)' });
        const systemErrorMessageContent = e instanceof AppError ? e.friendlyMessage : (e.message || "No se pudo completar el auto-fix.");
         const systemErrorMessage: ChatMessage = {
            id: uuidv4(),
            role: 'system',
            content: `Error durante el Auto-Fix: ${systemErrorMessageContent}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, systemErrorMessage]);
          setError(systemErrorMessageContent);
          toast({ variant: "destructive", title: "Error en Auto-Fix", description: systemErrorMessageContent });
          if (e instanceof AppError && e.redirectTo) {
            router.push(e.redirectTo);
          }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <PageSectionHeader
          icon={MessageCircle}
          title="Chat con IA"
          description="Interactúa con un asistente IA para consultas, ideas y más."
      />
      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col"> {/* Modified for flex layout */}
        <div className="p-4 border-b"> {/* Moved LLMConfigSelector to its own div within CardContent */}
          <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
        </div>
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}> {/* ScrollArea now takes remaining space */}
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg shadow-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 
                  msg.role === 'assistant' ? 'bg-muted' : 
                  'bg-destructive/10 text-destructive-foreground border border-destructive/30 flex items-start gap-2' // System/Error
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'assistant' && <Bot className="h-5 w-5 text-accent" />}
                    {msg.role === 'user' && <User className="h-5 w-5" />}
                    {msg.role === 'system' && <Bot className="h-5 w-5 text-destructive" />} 
                    <span className="font-semibold text-sm capitalize">{msg.role === 'assistant' ? 'Asistente IA' : msg.role === 'system' ? 'Sistema' : 'Usuario'}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-lg bg-muted flex items-center shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-accent" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {error && !isLoading && <div className="w-full mb-2"><ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido en chat")}/></div>}
        <div className="flex w-full items-center gap-2">
          <Textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje aquí..."
            rows={1}
            className="min-h-[40px] max-h-[120px] flex-1 resize-none"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Enviar</span>
          </Button>
          <Button variant="outline" onClick={handleClearChat} disabled={isLoading || messages.length === 0}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Borrar Chat</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
