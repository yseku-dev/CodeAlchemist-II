
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

interface LLMConfigSelectorProps {
  value: LLMConfigSourceOption | undefined;
  onChange: (value: LLMConfigSourceOption) => void;
  label?: string;
}

export default function LLMConfigSelector({ value, onChange, label = "Usar Configuración LLM De" }: LLMConfigSelectorProps) {
  const { agents, groups } = useAppState();
  const [isOpen, setIsOpen] = useState(false);

  const getDisplayValue = () => {
    if (!value) return label; // Or a more generic "Seleccionar..."
    if (value.type === 'Ajustes Globales') return 'Ajustes Globales';
    return `${value.type}: ${value.name}`;
  };

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
