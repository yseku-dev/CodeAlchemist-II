
"use client";

import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from "@/components/ui/select";
import { useAppState } from '@/context/AppStateContext';
import type { LLMConfigSourceOption } from '@/types';

interface LLMConfigSelectorProps {
  value: LLMConfigSourceOption | undefined;
  onChange: (value: LLMConfigSourceOption) => void;
  label?: string;
}

export default function LLMConfigSelector({ value, onChange, label = "Usar Configuración LLM De" }: LLMConfigSelectorProps) {
  const { agents, groups } = useAppState();

  const selectedValueString = value ? (value.type === 'Ajustes Globales' ? 'global' : `${value.type}-${value.id}`) : undefined;

  const handleSelectionChange = (selectedValue: string) => {
    if (selectedValue === 'global') {
      onChange({ type: 'Ajustes Globales' });
    } else {
      const [type, id] = selectedValue.split('-');
      if (type === 'Agente') {
        const agent = agents.find(a => a.id === id);
        if (agent) onChange({ type: 'Agente', id, name: agent.name });
      } else if (type === 'Grupo') {
        const group = groups.find(g => g.id === id);
        if (group) onChange({ type: 'Grupo', id, name: group.name });
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="llm-config-source">{label}</Label>
      <Select value={selectedValueString} onValueChange={handleSelectionChange}>
        <SelectTrigger id="llm-config-source">
          <SelectValue placeholder="Seleccionar fuente de configuración..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="global">Ajustes Globales</SelectItem>
          {agents.length > 0 && (
            <SelectGroup>
              <Label className="px-2 py-1.5 text-sm font-semibold">Agentes</Label>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={`Agente-${agent.id}`}>
                  Agente: {agent.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {groups.length > 0 && (
            <SelectGroup>
              <Label className="px-2 py-1.5 text-sm font-semibold">Grupos de Trabajo</Label>
              {groups.map(group => (
                <SelectItem key={group.id} value={`Grupo-${group.id}`}>
                  Grupo: {group.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
