
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
import { chatWithAgentOrGlobal } from '@/ai/flows/chat-with-agent-or-global-flow';
import { chatWithAIGroup } from '@/ai/flows/chat-with-ai-group-flow';

export default function ChatIAPage() {
  const { addLog: addLogContext } = useDebug();
  const { agents, groups, getAgentById } = useAppState();
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
    addLogContext(`User message to AI: ${userMessage.content.substring(0,50)}... Config: ${JSON.stringify(llmConfigSource)}`);

    let aiResponseContent = "Error: No se pudo obtener respuesta de la IA.";

    try {
      if (llmConfigSource?.type === 'Ajustes Globales') {
        const result = await chatWithAgentOrGlobal({ userMessage: currentInputMessage });
        aiResponseContent = result.aiResponse;
      } else if (llmConfigSource?.type === 'Agente' && llmConfigSource.id) {
        const agent = getAgentById(llmConfigSource.id);
        if (agent) {
          const result = await chatWithAgentOrGlobal({ userMessage: currentInputMessage, agentSystemPrompt: agent.systemPrompt });
          aiResponseContent = result.aiResponse;
        } else {
          throw new Error(`Agente con ID "${llmConfigSource.id}" no encontrado.`);
        }
      } else if (llmConfigSource?.type === 'Grupo' && llmConfigSource.id) {
        const group = groups.find(g => g.id === llmConfigSource.id);
        const orchestratorAgent = agents.find(a => a.id === 'orquestador-flujo-agentes'); // Assuming fixed ID

        if (group && orchestratorAgent) {
          const participatingAgentsInfo = group.agentIds
            .map(id => getAgentById(id))
            .filter(Boolean) as Agent[]; // Filter out undefined and cast

          const result = await chatWithAIGroup({
            userMessage: currentInputMessage,
            groupMainTask: group.mainTask,
            participatingAgents: participatingAgentsInfo.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                systemPrompt: p.systemPrompt, // Pass full system prompt
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
      addLogContext(`AI response: ${aiResponseContent.substring(0,50)}...`);
    } catch (e: any) {
      const errorMsg = e.message || "Ocurrió un error al comunicarse con la IA.";
      setError(errorMsg);
      const systemErrorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, systemErrorMessage]);
      addLogContext(`AI chat error: ${errorMsg}`);
      toast({ variant: "destructive", title: "Error de Chat", description: errorMsg });
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
    toast({ title: "Chat Limpiado", description: "El historial de la conversación ha sido borrado." });
    addLogContext("Chat history cleared.");
  };
  
  const handleAutoFixError = async (errorMsg: string) => {
    addLogContext(`Attempting Auto-Fix for chat error: ${errorMsg}`);
    // Simulate calling an AI to fix the error or explain it
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: `Por favor, analiza este error y sugiere una solución: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const result = await chatWithAgentOrGlobal({ userMessage: `Por favor, analiza este error y sugiere una solución: ${errorMsg}` });
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.aiResponse,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
        // Handle error from auto-fix attempt if necessary
         const systemErrorMessage: ChatMessage = {
            id: uuidv4(),
            role: 'system',
            content: `Error durante el Auto-Fix: ${e.message}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, systemErrorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-3">
          <MessageCircle className="h-7 w-7 text-primary" />
          <span>Chat con IA</span>
        </CardTitle>
        <CardDescription>Interactúa con un asistente IA para consultas, ideas y más.</CardDescription>
        <div className="pt-2">
         <LLMConfigSelector value={llmConfigSource} onChange={setLlmConfigSource} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 
                  msg.role === 'assistant' ? 'bg-muted' : 'bg-destructive/20 text-destructive-foreground'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.role === 'assistant' && <Bot className="h-5 w-5" />}
                    {msg.role === 'user' && <User className="h-5 w-5" />}
                    <span className="font-semibold text-sm capitalize">{msg.role === 'assistant' ? 'Asistente IA' : msg.role}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-60 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-lg bg-muted flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error || "Error desconocido en chat")}/>}
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
