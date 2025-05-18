
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
    capabilities: z.custom<AgentCapabilities>(),
    llmConfig: z.custom<AgentLLMConfiguration>(),
    systemPromptSummary: z.string().optional().describe('A summary of the system prompt, truncated for display.')
});

const ChatWithAIGroupInputSchema = z.object({
  userMessage: z.string().describe('The message from the user to the group.'),
  groupMainTask: z.string().describe('The main task or objective of the AI agent group.'),
  participatingAgents: z.array(AgentInfoSchema).describe('Information about the agents participating in the group.'),
  orchestratorAgentSystemPrompt: z.string().describe('The system prompt for the orchestrator agent.'),
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
  output: {schema: ChatWithAIGroupOutputSchema},
  prompt: `{{{orchestratorAgentSystemPrompt}}}

La tarea principal asignada a este grupo es:
"{{{groupMainTask}}}"

Los agentes disponibles en este grupo (excluyéndote a ti, el Orquestador) son:
{{#each participatingAgents}}
- Agente ID: {{{this.id}}}, Nombre: {{{this.name}}}, Descripción: "{{{this.description}}}"
  Prompt de Sistema (resumen): "{{{this.systemPromptSummary}}}"
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
    const agentsWithSummaries = input.participatingAgents.map(agent => ({
      ...agent,
      systemPromptSummary: agent.systemPrompt.substring(0, 100) + (agent.systemPrompt.length > 100 ? '...' : ''),
    }));

    const promptInput = {
      ...input,
      participatingAgents: agentsWithSummaries,
    };

    const llmResponse = await orchestratorInteractionPrompt(promptInput);
    const output = llmResponse.output; // Corrected: property access

    if (!output) {
      throw new Error("No output from Orchestrator LLM");
    }
    return { orchestratorResponse: output.orchestratorResponse };
  }
);

