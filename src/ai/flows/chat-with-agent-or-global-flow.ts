'use server';
/**
 * @fileOverview A flow to handle chat interactions with the global LLM configuration or a specific agent.
 *
 * - chatWithAgentOrGlobal - A function that handles the chat interaction.
 * - ChatWithAgentOrGlobalInput - The input type for the function.
 * - ChatWithAgentOrGlobalOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithAgentOrGlobalInputSchema = z.object({
  userMessage: z.string().describe('The message from the user.'),
  agentSystemPrompt: z.string().optional().describe('The system prompt of the specific agent, if one is selected.'),
});
export type ChatWithAgentOrGlobalInput = z.infer<typeof ChatWithAgentOrGlobalInputSchema>;

const ChatWithAgentOrGlobalOutputSchema = z.object({
  aiResponse: z.string().describe('The response from the AI assistant.'),
});
export type ChatWithAgentOrGlobalOutput = z.infer<typeof ChatWithAgentOrGlobalOutputSchema>;

export async function chatWithAgentOrGlobal(
  input: ChatWithAgentOrGlobalInput
): Promise<ChatWithAgentOrGlobalOutput> {
  return chatWithAgentOrGlobalFlow(input);
}

const chatPrompt = ai.definePrompt({
  name: 'chatWithAgentOrGlobalPrompt',
  input: {schema: ChatWithAgentOrGlobalInputSchema},
  output: {schema: ChatWithAgentOrGlobalOutputSchema},
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}
{{else}}
Eres un asistente IA general de CodeAlchemist. Eres útil y respondes en castellano.
{{/if}}

Usuario: {{{userMessage}}}
Asistente:`,
});

const chatWithAgentOrGlobalFlow = ai.defineFlow(
  {
    name: 'chatWithAgentOrGlobalFlow',
    inputSchema: ChatWithAgentOrGlobalInputSchema,
    outputSchema: ChatWithAgentOrGlobalOutputSchema,
  },
  async (input) => {
    const llmResponse = await chatPrompt(input);
    const output = llmResponse.output();
    if (!output) {
        throw new Error("No output from LLM");
    }
    return { aiResponse: output.aiResponse };
  }
);
