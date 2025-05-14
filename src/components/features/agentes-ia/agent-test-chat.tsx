
"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { Agent, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useDebug } from '@/context/DebugContext'; // Import useDebug

interface AgentTestChatProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  testingAgent: Agent | null;
}

export default function AgentTestChat({
  isOpen,
  onOpenChange,
  testingAgent,
}: AgentTestChatProps) {
  const [testChatMessages, setTestChatMessages] = useState<ChatMessage[]>([]);
  const [testChatMessage, setTestChatMessage] = useState('');
  const [isTestChatLoading, setIsTestChatLoading] = useState(false);
  const { addLog } = useDebug(); // Get addLog from context

  React.useEffect(() => {
    if (isOpen && testingAgent) {
      setTestChatMessages([{
        id: uuidv4(),
        role: 'system',
        content: `Estás probando el agente: ${testingAgent.name}.\nPrompt de Sistema del Agente:\n${testingAgent.systemPrompt}`,
        timestamp: new Date().toISOString()
      }]);
      setTestChatMessage(''); // Clear message input when modal opens or agent changes
    } else if (!isOpen) {
        setTestChatMessages([]); // Clear messages when modal closes
    }
  }, [isOpen, testingAgent]);


  const handleSendTestMessage = async () => {
    if (!testChatMessage.trim() || !testingAgent) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: testChatMessage, timestamp: new Date().toISOString() };
    setTestChatMessages(prev => [...prev, userMsg]);
    setTestChatMessage('');
    setIsTestChatLoading(true);

    addLog(`Testing agent "${testingAgent.name}" with message: ${userMsg.content.substring(0, 30)}...`);
    // Simulate AI response (replace with actual AI call if needed)
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: `Respuesta simulada de ${testingAgent.name}: He recibido tu mensaje "${userMsg.content.substring(0, 20)}...". Basado en mi prompt de sistema, actuaré en consecuencia. (Esta es una simulación para probar la UI del chat del agente).`,
        timestamp: new Date().toISOString()
      };
      setTestChatMessages(prev => [...prev, aiResponse]);
      setIsTestChatLoading(false);
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col h-[70vh]">
        <DialogHeader>
          <DialogTitle>Probando Agente: {testingAgent?.name}</DialogTitle>
          <DialogDescription>Interactúa directamente con el agente para probar su comportamiento.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6 py-2 border-y">
          <div className="space-y-3 pr-2">
            {testChatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-2 rounded-md text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' :
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
            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendTestMessage(); } }}
            disabled={isTestChatLoading}
          />
          <Button onClick={handleSendTestMessage} disabled={isTestChatLoading || !testChatMessage.trim()}>Enviar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
