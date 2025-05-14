'use server';
/**
 * @fileOverview A flow to handle chat interactions with an AI Agent Group via its Orchestrator.
 *
 * - chatWithAIGroup - A function that handles the chat interaction with a group.
 * - ChatWithAIGroupInput - The input type for the function.
 * - ChatWithAIGroupOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { AgentCapabilities, AgentLLMConfiguration } from '@/types'; // Assuming types are correctly defined

const AgentInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    systemPrompt: z.string(),
    capabilities: z.custom<AgentCapabilities>(), // Using z.custom for complex nested types not directly representable by Zod primitives
    llmConfig: z.custom<AgentLLMConfiguration>()
});

const ChatWithAIGroupInputSchema = z.object({
  userMessage: z.string().describe('The message from the user to the group.'),
  groupMainTask: z.string().describe('The main task or objective of the AI agent group.'),
  participatingAgents: z.array(AgentInfoSchema).describe('Information about the agents participating in the group.'),
  orchestratorAgentSystemPrompt: z.string().describe('The system prompt for the orchestrator agent.'),
  // We might need orchestratorLLMConfig if it's different from global, but genkit handles this via agent metadata or specific model calls
});
export type ChatWithAIGroupInput = z.infer<typeof ChatWithAIGroupInputSchema>;

const ChatWithAIGroupOutputSchema = z.object({
  orchestratorResponse: z.string().describe('The response from the orchestrator agent, likely a JSON string with its decision.'),
});
export type ChatWithAIGroupOutput = z.infer<typeof ChatWithAIGroupOutputSchema>;

export async function chatWithAIGroup(
  input: ChatWithAIGroupInput
): Promise<ChatWithAIGroupOutput> {
  return chatWithAIGroupFlow(input);
}

const orchestratorInteractionPrompt = ai.definePrompt({
  name: 'orchestratorInteractionPrompt',
  input: {schema: ChatWithAIGroupInputSchema},
  output: {schema: ChatWithAIGroupOutputSchema}, // Expecting the orchestrator to directly give its JSON as a string
  prompt: `{{{orchestratorAgentSystemPrompt}}}

La tarea principal asignada a este grupo es:
"{{{groupMainTask}}}"

Los agentes disponibles en este grupo (excluyéndote a ti, el Orquestador) son:
{{#each participatingAgents}}
- Agente ID: {{{this.id}}}, Nombre: {{{this.name}}}, Descripción: "{{{this.description}}}"
  Prompt de Sistema (resumen): "{{#substring this.systemPrompt 0 100}}{{/substring}}..."
  Capacidades: {{#each this.capabilities}}{{#if @value}}{{@key}} {{/if}}{{/each}}
{{/each}}

La consulta o mensaje actual del usuario para el grupo es:
"{{{userMessage}}}"

Basado en toda esta información, por favor, proporciona tu decisión y la instrucción para el siguiente agente (o la finalización) en el formato JSON especificado en tu prompt de sistema. Tu respuesta DEBE SER ÚNICAMENTE EL OBJETO JSON.`,
});


const chatWithAIGroupFlow = ai.defineFlow(
  {
    name: 'chatWithAIGroupFlow',
    inputSchema: ChatWithAIGroupInputSchema,
    outputSchema: ChatWithAIGroupOutputSchema,
  },
  async (input) => {
    // Here, we'd ideally use the specific LLM config of the Orchestrator Agent.
    // For now, the prompt call will use the global config or the one defined in the prompt object if specified.
    // In a more complex setup, we might resolve the orchestrator's LLM config and pass it to `ai.generate`.
    const llmResponse = await orchestratorInteractionPrompt(input);
    const output = llmResponse.output();

    if (!output) {
      throw new Error("No output from Orchestrator LLM");
    }
    // The orchestrator is expected to return a JSON string.
    // If it returns a structured object already parsed by Genkit (based on outputSchema), that's even better.
    // For now, we assume orchestratorResponse in schema is the string (potentially JSON)
    return { orchestratorResponse: output.orchestratorResponse };
  }
);

// Helper for Handlebars to substring (not available by default)
import Handlebars from 'handlebars';
Handlebars.registerHelper('substring', function(string, start, end) {
  return string.substring(start, end);
});
