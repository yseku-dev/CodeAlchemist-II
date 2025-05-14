
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: string;
}

export default function CodeBlock({ code, language = 'typescript', maxHeight = '400px' }: CodeBlockProps) {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copiado",
      description: "Fragmento de código copiado al portapapeles.",
    });
  };

  return (
    <div className="relative rounded-md border bg-secondary/50">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7"
        onClick={handleCopy}
        title="Copiar Código"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <ScrollArea style={{ maxHeight }} className="p-4">
        <pre className={`language-${language} text-sm text-secondary-foreground`}>
          <code>{code}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
