
'use server';
/**
 * @fileOverview Flow for AI to suggest an AI Agent Group definition.
 *
 * - suggestGroupDefinition - A function that suggests group properties.
 * - SuggestGroupDefinitionInput - The input type.
 * - SuggestGroupDefinitionOutput - The return type (matches parts of GroupFormData).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { SuggestGroupDefinitionInput, SuggestGroupDefinitionOutput, AgentInfoForGroupSuggestion } from '@/types';

const AgentInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
});

const SuggestGroupDefinitionInputSchema = z.object({
  groupTaskDescription: z.string().describe('Una descripción detallada de la tarea o el objetivo principal que el grupo de trabajo IA debe lograr.'),
  availableAgents: z.array(AgentInfoSchema).describe('Una lista de los agentes IA existentes que están disponibles para ser incluidos en el grupo. Cada agente tiene un id, nombre y descripción.'),
});

const SuggestGroupDefinitionOutputSchema = z.object({
  name: z.string().describe('Un nombre corto, descriptivo y en CamelCase para el grupo de trabajo (ej. EquipoAnalisisSeguridad, GrupoGeneracionDocumentacion).'),
  description: z.string().describe('Una descripción concisa (1-2 frases) del propósito principal del grupo de trabajo.'),
  mainTask: z.string().describe('Un prompt detallado que describa el objetivo general que el grupo de trabajo debe alcanzar. Este será el input inicial para el OrquestadorFlujoAgentes del grupo.'),
  agentIds: z.array(z.string()).describe('Una lista de IDs de los agentes (seleccionados de los availableAgents) que deberían participar en este grupo para lograr la tarea descrita. No incluyas el OrquestadorFlujoAgentes aquí, ya que se añade implícitamente.'),
});

export async function suggestGroupDefinition(
  input: SuggestGroupDefinitionInput
): Promise<SuggestGroupDefinitionOutput> {
  return suggestGroupDefinitionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestGroupDefinitionPrompt',
  input: { schema: SuggestGroupDefinitionInputSchema },
  output: { schema: SuggestGroupDefinitionOutputSchema },
  prompt: `Eres un experto en el diseño de equipos colaborativos de agentes de inteligencia artificial. Basado en la siguiente descripción de la tarea de un grupo y la lista de agentes disponibles, genera una definición completa para el grupo de trabajo.\nLa definición debe incluir un nombre para el grupo, una descripción, una \"Tarea Principal del Grupo\" (que será el prompt para el agente Orquestador), y una lista de IDs de los agentes que deberían participar.\nTodas las salidas deben estar en castellano. El nombre del grupo debe ser en CamelCase.\n\nDescripción de la Tarea del Grupo:\n{{{groupTaskDescription}}}\n\nAgentes Disponibles (selecciona los más relevantes para la tarea):\n{{#if availableAgents.length}}\n{{#each availableAgents}}\n- ID: {{{this.id}}}, Nombre: {{{this.name}}}, Descripción: \"{{{this.description}}}\"\n{{/each}}\n{{else}}\n- No hay agentes específicos disponibles para seleccionar. Considera crear agentes primero si la tarea lo requiere. Si no se necesitan agentes específicos, puedes devolver una lista vacía de agentIds.\n{{/if}}\n\nProporciona la definición en el formato JSON especificado por el esquema de salida.\nPara 'agentIds', selecciona los IDs de los agentes más adecuados de la lista de \"Agentes Disponibles\" para cumplir con la 'groupTaskDescription'. Si ningún agente parece adecuado o necesario, puedes devolver un array vacío, pero es preferible seleccionar al menos uno si la tarea lo justifica.\nLa 'mainTask' debe ser un prompt detallado para el agente Orquestador, guiándolo sobre cómo coordinar a los agentes seleccionados para lograr el objetivo del grupo.\n`,
});

const suggestGroupDefinitionFlow = ai.defineFlow(
  {
    name: 'suggestGroupDefinitionFlow',
    inputSchema: SuggestGroupDefinitionInputSchema,
    outputSchema: SuggestGroupDefinitionOutputSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output; // Corrected: property access
    if (!output) {
      throw new Error("La IA no pudo generar una definición de grupo.");
    }
    // Filter agentIds to ensure they are valid and from the provided list
    const validAgentIds = output.agentIds.filter(id => input.availableAgents.some(a => a.id === id));
    if (validAgentIds.length !== output.agentIds.length) {
        console.warn("AI suggested agent IDs not present in the available list. Filtering them out.");
    }

    return { ...output, agentIds: validAgentIds };
  }
);

