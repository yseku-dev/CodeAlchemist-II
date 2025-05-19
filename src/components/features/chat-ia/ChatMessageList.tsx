
// src/components/features/chat-ia/ChatMessageList.tsx
"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, User, AlertTriangleIcon } from 'lucide-react';
import type { ChatMessage } from '@/types';
import type { TranslationKey } from '@/lib/i18n/translations';

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * @fileOverview Component for displaying the list of chat messages.
 * Handles rendering user, assistant, and system messages, including a loading indicator.
 * All UI texts related to roles are internationalized.
 * @module ChatMessageList
 */

/**
 * ChatMessageList component.
 * Renders the scrollable list of messages in the AI Chat interface.
 *
 * @param {ChatMessageListProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chat message list.
 */
const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  scrollAreaRef,
  t,
}) => {
  return (
    <ScrollArea className="flex-1 -mx-6 px-6 py-2 border-y bg-background/50" ref={scrollAreaRef}>
      <div className="space-y-3 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm flex gap-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.role === 'assistant'
                  ? 'bg-card text-card-foreground border'
                  : 'bg-destructive/10 text-destructive-foreground border border-destructive/30 items-start'
              }`}
            >
              {msg.role === 'system' && (
                <AlertTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              {msg.role === 'assistant' && (
                <Bot className="h-5 w-5 self-start flex-shrink-0 text-accent" />
              )}
              {msg.role === 'user' && (
                <User className="h-5 w-5 self-start flex-shrink-0" />
              )}
              <div className="flex-grow">
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs opacity-70 mt-1.5 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-2.5 rounded-lg bg-card text-card-foreground border flex items-center shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-accent" />
              <span className="text-sm">{t('chat.thinking')}</span>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ChatMessageList;
