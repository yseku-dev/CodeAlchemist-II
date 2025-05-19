
"use client";

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, Trash2, Loader2, Wand2 } from 'lucide-react';
import LLMConfigSelector from '@/components/llm-config-selector';
import type { LLMConfigSourceOption, ChatMessage } from '@/types';
import ErrorDisplay from '@/components/error-display';
import type { TranslationKey } from '@/lib/i18n/translations';

interface ChatInputAreaProps {
  llmConfigSource: LLMConfigSourceOption | undefined;
  onLlmConfigSourceChange: (value: LLMConfigSourceOption) => void;
  currentMessage: string;
  onCurrentMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onClearChat: () => void;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onAutoFixError: (errorMsg: string) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isRedefiningCurrentMessage: boolean;
  onRedefineCurrentMessage: () => Promise<void>;
}

const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  llmConfigSource, onLlmConfigSourceChange, currentMessage, onCurrentMessageChange,
  onSendMessage, onKeyPress, onClearChat, messages, isLoading, error, onAutoFixError, t,
  isRedefiningCurrentMessage, onRedefineCurrentMessage
}) => {
  return (
    <div className="p-4 border-t">
      {error && !isLoading && (
        <div className="w-full mb-2">
          <ErrorDisplay error={error} onAutoFix={() => onAutoFixError(error || t('common.unknownError'))} />
        </div>
      )}
      <div className="p-4 border-b">
        <LLMConfigSelector value={llmConfigSource} onChange={onLlmConfigSourceChange} label={t('common.llmSourceLabel')} />
      </div>
      <div className="space-y-1 mt-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-muted-foreground">{t('chat.inputLabel')}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedefineCurrentMessage}
            disabled={!currentMessage.trim() || isRedefiningCurrentMessage || isLoading}
            title={t('common.redefineRequestButton')}
          >
            {isRedefiningCurrentMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            <span className="sr-only">{t('common.redefineRequestButton')}</span>
          </Button>
        </div>
        <Textarea
          value={currentMessage}
          onChange={(e) => onCurrentMessageChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={t('chat.inputPlaceholder')}
          rows={1}
          className="min-h-[40px] max-h-[120px] flex-1 resize-none"
          disabled={isLoading || isRedefiningCurrentMessage}
        />
      </div>
      <div className="flex w-full items-center gap-2 mt-2">
        <Button onClick={onSendMessage} disabled={isLoading || isRedefiningCurrentMessage || !currentMessage.trim()} className="flex-grow">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {t('chat.sendButton')}
        </Button>
        <Button variant="outline" onClick={onClearChat} disabled={isLoading || isRedefiningCurrentMessage || messages.length === 0}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('chat.clearButton')}
        </Button>
      </div>
    </div>
  );
};

export default ChatInputArea;
