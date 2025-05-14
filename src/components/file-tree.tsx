
"use client";

import React, { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CodeBlock from '@/components/code-block';
import { FileText, Folder } from 'lucide-react';
import type { GeneratedFile } from '@/types';

/**
 * @fileOverview FileTreeDisplay component.
 * This component renders a list of files and folders in a tree-like structure
 * using an accordion. Each file can be expanded to view its content.
 */

/**
 * Props for the FileTreeDisplay component.
 */
interface FileTreeDisplayProps {
  /** 
   * An array of `GeneratedFile` objects, where each object represents a file or folder
   * with its path and content.
   * @example
   * const files = [
   *   { path: "src/", content: "", isFolder: true },
   *   { path: "src/index.js", content: "console.log('Hello');" },
   *   { path: "README.md", content: "# My Project" }
   * ];
   * <FileTreeDisplay files={files} />
   */
  files: GeneratedFile[];
}

/**
 * Builds a sorted list of files, which can be rendered as a tree.
 * Currently, it sorts files by path. A more complex implementation might
 * parse paths to create a true hierarchical tree structure.
 * @param {GeneratedFile[]} files - The array of files to process.
 * @returns {GeneratedFile[]} The sorted array of files.
 */
const buildFileTree = (files: GeneratedFile[]): GeneratedFile[] => {
  return files.sort((a,b) => a.path.localeCompare(b.path));
};

/**
 * Calculates the depth of a file path based on the number of directory separators.
 * Used for indenting items in the tree display.
 * @param {string} path - The file path.
 * @returns {number} The depth of the path.
 */
const getPathDepth = (path: string): number => {
  return path.split('/').filter(p => p).length -1;
}

/**
 * Determines the programming language for syntax highlighting based on the file extension.
 * @param {string} path - The file path.
 * @returns {string} The language name (e.g., 'javascript', 'python') or 'plaintext'.
 */
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

/**
 * FileTreeDisplay component.
 * Renders an accordion-based tree view of files and folders.
 * Files can be expanded to show their content using the `CodeBlock` component.
 * Folders are indicated with a folder icon.
 *
 * @param {FileTreeDisplayProps} props - The props for the component.
 * @returns {JSX.Element} The rendered file tree display.
 */
export default function FileTreeDisplay({ files }: FileTreeDisplayProps): JSX.Element {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const tree = buildFileTree(files);

  return (
    <Accordion 
      type="multiple" 
      value={openItems}
      onValueChange={setOpenItems}
      className="w-full rounded-md border"
    >
      {tree.map((file, index) => (
        <AccordionItem value={file.path} key={`${file.path}-${index}`} className="border-b last:border-b-0">
          <AccordionTrigger className="px-4 py-2 hover:bg-muted/50 text-sm" aria-label={`Expandir o contraer ${file.path}`}>
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

