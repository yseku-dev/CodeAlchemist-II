
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, User, AlertTriangleIcon } from 'lucide-react'; // Added icons
import type { Agent, ChatMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { useDebug } from '@/context/DebugContext';
import { callChatWithAgentOrGlobal } from '@/utils/apiClient';
import { AppError } from '@/utils/AppError';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/context/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

/**
 * @fileOverview Modal component for testing an AI Agent's responses.
 * Allows direct interaction with an agent using its system prompt.
 */

interface AgentTestChatProps {
  /** Whether the test chat dialog is open. */
  isOpen: boolean;
  /** Callback to change the open state of the dialog. */
  onOpenChange: (open: boolean) => void;
  /** The agent object to be tested. */
  testingAgent: Agent | null;
}

/**
 * AgentTestChat component.
 * Provides a chat interface to test a specific AI agent.
 * @param {AgentTestChatProps} props - The component props.
 * @returns {JSX.Element} The rendered agent test chat modal.
 */
export default function AgentTestChat({
  isOpen,
  onOpenChange,
  testingAgent,
}: AgentTestChatProps) {
  const [testChatMessages, setTestChatMessages] = useState<ChatMessage[]>([]);
  const [testChatMessage, setTestChatMessage] = useState('');
  const [isTestChatLoading, setIsTestChatLoading] = useState(false);
  const { addLog } = useDebug();
  const router = useRouter();
  const { t } = useI18n();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && testingAgent) {
      setTestChatMessages([{
        id: uuidv4(),
        role: 'system',
        content: t('agents.testChatDialog.systemMessage', {name: testingAgent.name, systemPrompt: testingAgent.systemPrompt}),
        timestamp: new Date().toISOString()
      }]);
      setTestChatMessage('');
    } else if (!isOpen) {
      setTestChatMessages([]); // Clear messages when dialog closes
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, testingAgent]); // t is not needed here as it's for initial system message

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [testChatMessages]);

  const handleSendTestMessage = async () => {
    if (!testChatMessage.trim() || !testingAgent) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: testChatMessage, timestamp: new Date().toISOString() };
    setTestChatMessages(prev => [...prev, userMsg]);
    const currentInput = testChatMessage;
    setTestChatMessage('');
    setIsTestChatLoading(true);

    addLog(`Testing agent "${testingAgent.name}" with message: ${userMsg.content.substring(0, 50)}...`);

    try {
      const result = await callChatWithAgentOrGlobal({
        userMessage: currentInput,
        agentSystemPrompt: testingAgent.systemPrompt,
      });

      const aiResponse: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: result.aiResponse,
        timestamp: new Date().toISOString()
      };
      setTestChatMessages(prev => [...prev, aiResponse]);
    } catch (error: any) {
      addLog({ message: `Error testing agent ${testingAgent.name}`, errorDetails: error.originalError || error, friendlyMessage: (error as AppError)?.friendlyMessage });
      let errorMessageContent = t('agents.testChatDialog.errorPrefix') + "Ocurrió un error al contactar al agente.";
      if (error instanceof AppError) {
        errorMessageContent = t('agents.testChatDialog.errorPrefix') + error.friendlyMessage;
        if (error.redirectTo) {
          onOpenChange(false); // Close dialog before redirecting
          router.push(error.redirectTo);
          return; 
        }
      } else if (error.message) {
        errorMessageContent = t('agents.testChatDialog.errorPrefix') + error.message;
      }
      const errorMsg: ChatMessage = {
        id: uuidv4(),
        role: 'system',
        content: errorMessageContent,
        timestamp: new Date().toISOString()
      };
      setTestChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTestChatLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col h-[70vh] md:h-[80vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t('agents.testChatDialog.title', { name: testingAgent?.name || 'N/A' })}</DialogTitle>
          <DialogDescription className="text-xs">{t('agents.testChatDialog.description')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6 py-2 border-y bg-background/50" ref={scrollAreaRef}>
          <div className="space-y-3 pr-2">
            {testChatMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm flex gap-2 ${ // Added flex and gap
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' :
                  msg.role === 'assistant' ? 'bg-card text-card-foreground border' :
                  'bg-destructive/10 text-destructive-foreground border border-destructive/30 items-start'
                }`}>
                  {msg.role === 'system' && <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                  {msg.role === 'assistant' && <Bot className="h-5 w-5 self-start flex-shrink-0 text-accent" />}
                  {msg.role === 'user' && <User className="h-5 w-5 self-start flex-shrink-0" />}
                  <div className="flex-grow"> {/* Text content wrapper */}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1.5 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            ))}
            {isTestChatLoading && (
               <div className="flex justify-start">
                <div className="max-w-[85%] p-2.5 rounded-lg bg-card text-card-foreground border flex items-center shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin mr-2 text-accent" />
                  <span className="text-sm">{t('agents.testChatDialog.thinking')}</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="pt-2 flex gap-2 flex-shrink-0">
          <Textarea
            value={testChatMessage}
            onChange={(e) => setTestChatMessage(e.target.value)}
            placeholder={t('agents.testChatDialog.inputPlaceholder')}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[100px] resize-none"
            onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendTestMessage(); } }}
            disabled={isTestChatLoading || !testingAgent}
          />
          <Button onClick={handleSendTestMessage} disabled={isTestChatLoading || !testChatMessage.trim() || !testingAgent}>
            {t('agents.testChatDialog.sendButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
