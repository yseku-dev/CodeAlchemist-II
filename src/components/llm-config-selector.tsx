
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption } from '@/types';
import { ChevronDown } from 'lucide-react';

/**
 * @fileOverview LLMConfigSelector component.
 * This component provides a button-triggered dialog for selecting the source
 * of LLM (Large Language Model) configuration. Users can choose between
 * global settings, a specific AI agent, or an AI agent group.
 */

/**
 * Props for the LLMConfigSelector component.
 */
interface LLMConfigSelectorProps {
  /** 
   * The current selected LLM configuration source.
   * Can be undefined if no selection has been made.
   */
  value: LLMConfigSourceOption | undefined;
  /** 
   * Callback function invoked when a new LLM configuration source is selected.
   * @param {LLMConfigSourceOption} value - The newly selected configuration source.
   */
  onChange: (value: LLMConfigSourceOption) => void;
  /** 
   * Optional label text to display above the selector button.
   * @default "Usar Configuración LLM De"
   */
  label?: string;
}

/**
 * LLMConfigSelector component.
 * Renders a button that opens a dialog modal for selecting an LLM configuration source.
 * The available options are "Ajustes Globales", and lists of available AI agents and groups
 * retrieved from the AppStateContext.
 *
 * @param {LLMConfigSelectorProps} props - The props for the component.
 * @returns {JSX.Element} The rendered LLM configuration selector.
 *
 * @example
 * const [configSource, setConfigSource] = useState<LLMConfigSourceOption | undefined>({ type: 'Ajustes Globales' });
 * <LLMConfigSelector
 *   value={configSource}
 *   onChange={setConfigSource}
 *   label="Seleccionar Fuente de IA"
 * />
 */
export default function LLMConfigSelector({ 
  value, 
  onChange, 
  label = "Usar Configuración LLM De" 
}: LLMConfigSelectorProps): JSX.Element {
  const { agents, groups } = useAppState();
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Generates the display text for the selector button based on the current value.
   * @returns {string} The text to display on the button.
   */
  const getDisplayValue = (): string => {
    if (!value) return label; // Or a more generic "Seleccionar..."
    if (value.type === 'Ajustes Globales') return 'Ajustes Globales';
    return `${value.type}: ${value.name}`;
  };

  /**
   * Handles the selection of an option from the dialog.
   * Calls the onChange prop and closes the dialog.
   * @param {LLMConfigSourceOption} option - The selected LLM configuration source.
   */
  const handleSelect = (option: LLMConfigSourceOption) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="llm-config-source-button">{label}</Label>
      <Button
        id="llm-config-source-button"
        variant="outline"
        className="w-full justify-between text-left"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Seleccionar fuente de configuración LLM. Actual: ${getDisplayValue()}`}
      >
        <span className="truncate">
         {getDisplayValue()}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-2"> {/* Negative margin to allow full-width items with padding */}
            <div className="space-y-1 p-2"> {/* Padding for content inside ScrollArea */}
              <button
                className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                onClick={() => handleSelect({ type: 'Ajustes Globales' })}
                role="menuitem"
              >
                Ajustes Globales
              </button>

              {agents.length > 0 && (
                <>
                  <div className="px-2 pt-3 pb-1">
                    <Label className="text-sm font-semibold text-muted-foreground">Agentes</Label>
                  </div>
                  {agents.map(agent => (
                    <button
                      key={`agent-${agent.id}`}
                      className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      onClick={() => handleSelect({ type: 'Agente', id: agent.id, name: agent.name })}
                      role="menuitem"
                    >
                      {agent.name}
                    </button>
                  ))}
                </>
              )}

              {groups.length > 0 && (
                <>
                  <div className="px-2 pt-3 pb-1">
                    <Label className="text-sm font-semibold text-muted-foreground">Grupos de Trabajo</Label>
                  </div>
                  {groups.map(group => (
                    <button
                      key={`group-${group.id}`}
                      className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      onClick={() => handleSelect({ type: 'Grupo', id: group.id, name: group.name })}
                      role="menuitem"
                    >
                      {group.name}
                    </button>
                  ))}
                </>
              )}
               {(agents.length === 0 && groups.length === 0 && value?.type !== 'Ajustes Globales') && (
                 <p className="p-2 text-sm text-muted-foreground">No hay agentes ni grupos disponibles para seleccionar.</p>
               )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
