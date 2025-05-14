
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Trash2, Bot, User, Loader2, MessageCircle } from 'lucide-react'; // Added MessageCircle
import LLMConfigSelector from '@/components/llm-config-selector';
import ErrorDisplay from '@/components/error-display';
import { useDebug } from '@/context/DebugContext';
import { useToast } from '@/hooks/use-toast';
import type { LLMConfigSourceOption, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';
// Assuming a generic chat flow or adapting one
// import { chatWithAIModel } from '@/ai/flows/chat'; 

// Mock AI chat response
const mockChatResponse = async (
  prompt: string, 
  history: ChatMessage[],
  addLogFn: (log: string | Record<string, any>) => void // Renamed to avoid conflict
): Promise<string> => {
  addLogFn(`Mocking AI response for prompt: ${prompt.substring(0, 50)}... with history length: ${history.length}`);
  return new Promise(resolve => setTimeout(() => {
    if (prompt.toLowerCase().includes("hola") || prompt.toLowerCase().includes("saludos")) {
      resolve("¡Hola! ¿En qué puedo ayudarte hoy con CodeAlchemist?");
    } else if (prompt.toLowerCase().includes("error")) {
      resolve("Parece que mencionaste un error. ¿Podrías darme más detalles para que pueda intentar ayudarte a solucionarlo o explicarlo?");
    } else {
      resolve(`He procesado tu mensaje: "${prompt.substring(0, 30)}...". Como IA de CodeAlchemist, estoy aquí para asistirte con tus tareas de desarrollo. Puedo ayudarte a generar ideas, explicar conceptos de código, o incluso debatir sobre las mejores prácticas. ¿Qué tienes en mente?`);
    }
  }, 1000 + Math.random() * 1000));
};

export default function ChatIAPage() {
  const { addLog: addLogContext } = useDebug(); // Renamed for clarity
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
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);
    addLogContext(`User message to AI: ${userMessage.content.substring(0,50)}... Config: ${JSON.stringify(llmConfigSource)}`);

    try {
      // const aiResponseContent = await chatWithAIModel({ prompt: userMessage.content, history: messages, config: llmConfigSource });
      const aiResponseContent = await mockChatResponse(userMessage.content, messages, addLogContext); // Pass addLog
      
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
    // Placeholder for AI-driven auto-fix logic specific to chat
    toast({ title: "Auto-Fix (Simulado)", description: "La IA está analizando el error del chat."});
  };

  return (
    <Card className="w-full h-full flex flex-col"> {/* Adjusted width and height */}
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
                <div className={`max-w-[85%] p-3 rounded-lg ${ // Increased max-width for message bubbles
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
                <div className="max-w-[85%] p-3 rounded-lg bg-muted flex items-center"> {/* Increased max-width */}
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {error && <ErrorDisplay error={error} onAutoFix={() => handleAutoFixError(error)}/>}
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
