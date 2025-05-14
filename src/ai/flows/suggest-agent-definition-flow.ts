
'use server';
/**
 * @fileOverview Flow for AI to suggest an agent definition.
 *
 * - suggestAgentDefinition - A function that suggests agent properties.
 * - SuggestAgentDefinitionInput - The input type.
 * - SuggestAgentDefinitionOutput - The return type (matches parts of AgentFormData).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { SuggestAgentDefinitionInput, SuggestAgentDefinitionOutput, AgentCapabilities } from '@/types';

const AgentCapabilitiesSchema = z.object({
  accessOwnCode: z.boolean().describe('Permitir al agente leer el código fuente de CodeAlchemist.'),
  execution: z.boolean().describe('Permitir al agente ejecutar comandos o scripts. (Peligroso)'),
  virtualEnv: z.boolean().describe('Permitir al agente interactuar o gestionar entornos virtuales.'),
  readWrite: z.boolean().describe('Permitir al agente leer y escribir archivos en el sistema de CodeAlchemist. (Peligroso)'),
});

const SuggestAgentDefinitionInputSchema = z.object({
  roleDescription: z.string().describe('Una descripción detallada del rol y las responsabilidades del agente que se desea crear.'),
});

const SuggestAgentDefinitionOutputSchema = z.object({
  name: z.string().describe('Un nombre corto, descriptivo y en CamelCase para el agente (ej. AnalistaDePruebas, GeneradorUI).'),
  description: z.string().describe('Una descripción concisa (1-2 frases) del propósito principal del agente.'),
  systemPrompt: z.string().describe('Un prompt de sistema detallado que defina el rol, comportamiento, tono, instrucciones fundamentales y restricciones del agente. Debe guiar a la IA para que actúe consistentemente como este agente.'),
  capabilities: AgentCapabilitiesSchema.describe('Un conjunto de capacidades booleanas sugeridas para el agente, basadas en su rol.'),
});

export async function suggestAgentDefinition(
  input: SuggestAgentDefinitionInput
): Promise<SuggestAgentDefinitionOutput> {
  return suggestAgentDefinitionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestAgentDefinitionPrompt',
  input: { schema: SuggestAgentDefinitionInputSchema },
  output: { schema: SuggestAgentDefinitionOutputSchema },
  prompt: `Eres un experto en el diseño de agentes de inteligencia artificial. Basado en la siguiente descripción del rol de un agente, genera una definición completa para él.
La definición debe incluir un nombre, una descripción, un prompt de sistema detallado y un conjunto de capacidades booleanas sugeridas (accessOwnCode, execution, virtualEnv, readWrite).
Todas las salidas deben estar en castellano. El nombre del agente debe ser en CamelCase.

Descripción del Rol del Agente:
{{{roleDescription}}}

Proporciona la definición en el formato JSON especificado por el esquema de salida. Asegúrate de que el systemPrompt sea completo y guíe claramente el comportamiento del agente.
Para las capacidades, considera cuidadosamente qué permisos necesitaría un agente con el rol descrito. Por ejemplo:
- 'accessOwnCode': si el agente necesita leer el código fuente de la aplicación actual (CodeAlchemist).
- 'execution': si el agente necesita ejecutar scripts o comandos (esto es peligroso y debe usarse con precaución).
- 'virtualEnv': si el agente necesita gestionar dependencias o ejecutar código en entornos aislados.
- 'readWrite': si el agente necesita modificar archivos del sistema (esto también es peligroso).
Piensa si el rol implica analizar código, generar archivos, ejecutar procesos externos, etc.
`,
});

const suggestAgentDefinitionFlow = ai.defineFlow(
  {
    name: 'suggestAgentDefinitionFlow',
    inputSchema: SuggestAgentDefinitionInputSchema,
    outputSchema: SuggestAgentDefinitionOutputSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output();
    if (!output) {
      throw new Error("La IA no pudo generar una definición de agente.");
    }
    // Ensure capabilities is a full object, even if some are false
    const completeCapabilities: AgentCapabilities = {
        accessOwnCode: output.capabilities.accessOwnCode || false,
        execution: output.capabilities.execution || false,
        virtualEnv: output.capabilities.virtualEnv || false,
        readWrite: output.capabilities.readWrite || false,
    };
    return { ...output, capabilities: completeCapabilities };
  }
);
