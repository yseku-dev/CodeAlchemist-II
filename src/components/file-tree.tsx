
"use client";

import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CodeBlock from '@/components/code-block';
import { FileText, Folder } from 'lucide-react';
import type { GeneratedFile } from '@/types';

interface FileTreeDisplayProps {
  files: GeneratedFile[];
}

// Helper to build a tree structure (basic version)
// For a more complex tree, a recursive approach or a library might be better.
const buildFileTree = (files: GeneratedFile[]) => {
  // This is a simplified version, assuming a flat list or simple nesting based on path.
  // A proper tree structure would require parsing paths and creating nested objects.
  // For now, we'll just display them in order, perhaps indenting based on path depth.
  return files.sort((a,b) => a.path.localeCompare(b.path));
};


export default function FileTreeDisplay({ files }: FileTreeDisplayProps) {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const tree = buildFileTree(files);

  const getPathDepth = (path: string) => {
    return path.split('/').filter(p => p).length -1;
  }

  return (
    <Accordion 
      type="multiple" 
      value={openItems}
      onValueChange={setOpenItems}
      className="w-full rounded-md border"
    >
      {tree.map((file, index) => (
        <AccordionItem value={file.path} key={`${file.path}-${index}`} className="border-b last:border-b-0">
          <AccordionTrigger className="px-4 py-2 hover:bg-muted/50 text-sm">
            <div className="flex items-center gap-2" style={{ marginLeft: `${getPathDepth(file.path) * 16}px`}}>
              {file.isFolder || file.path.endsWith('/') ? <Folder className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-accent" />}
              <span>{file.path.split('/').pop() || file.path} <span className="text-xs text-muted-foreground">({file.path})</span></span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-2 bg-secondary/30">
            {file.content && !file.isFolder ? (
              <CodeBlock code={file.content} language={getLanguageFromPath(file.path)} maxHeight="300px" />
            ) : file.isFolder ? (
              <p className="text-xs text-muted-foreground italic p-2">Esto es una carpeta.</p>
            ) : (
               <p className="text-xs text-muted-foreground italic p-2">Archivo vacío o contenido no visualizable aquí.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
       {files.length === 0 && <p className="p-4 text-sm text-muted-foreground">No se generaron archivos.</p>}
    </Accordion>
  );
}

function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}
