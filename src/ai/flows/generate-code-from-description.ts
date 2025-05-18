
'use server';
/**
 * @fileOverview A code generation AI agent flow.
 * This flow takes a natural language description and generates a corresponding code snippet,
 * along with an explanation of the generated code.
 *
 * It exports:
 * - `generateCodeFromDescription`: The main function to invoke the flow.
 * - `GenerateCodeFromDescriptionInput`: The Zod schema type for the input.
 * - `GenerateCodeFromDescriptionOutput`: The Zod schema type for the output.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { GenerateCodeFromDescriptionInput, GenerateCodeFromDescriptionOutput } from '@/types';
import { AppError } from '@/utils/AppError'; // Import AppError

const GenerateCodeFromDescriptionInputSchema = z.object({
  description: z.string().describe('The description of the code to generate.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente, si la generación es impulsada por un agente o grupo.'),
});

const GenerateCodeFromDescriptionOutputSchema = z.object({
  explanation: z.string().describe('Explanation of the generated code.'),
  code: z.string().describe('The generated code snippet.'),
});


export async function generateCodeFromDescription(
  input: GenerateCodeFromDescriptionInput
): Promise<GenerateCodeFromDescriptionOutput> {
  return generateCodeFromDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCodeFromDescriptionPrompt',
  input: {schema: GenerateCodeFromDescriptionInputSchema},
  output: {schema: GenerateCodeFromDescriptionOutputSchema},
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Genera código y una explicación basado en la siguiente descripción del usuario:
Descripción: {{{description}}}
{{else}}
Eres un experto generador de código. Genera código basado en la descripción proporcionada por el usuario. Incluye una breve explicación del código generado.
Tu respuesta debe estar en castellano.

Descripción: {{{description}}}
{{/if}}`,
});


const generateCodeFromDescriptionFlow = ai.defineFlow(
  {
    name: 'generateCodeFromDescriptionFlow',
    inputSchema: GenerateCodeFromDescriptionInputSchema,
    outputSchema: GenerateCodeFromDescriptionOutputSchema,
  },
  async input => {
    const flowName = 'generateCodeFromDescriptionFlow';
    try {
      const llmResponse = await prompt(input);
      const output = llmResponse.output;
      
      if (!output) {
        console.error(`[Flow: ${flowName}] No output from LLM.`);
        // In a real Genkit flow, you might throw a more specific error
        // or return a structured error object if the schema allows.
        // For now, ensuring it's an AppError for apiClient.
        throw new AppError("La IA no pudo generar el código.", { originalError: "No output from LLM" }, 'ai');
      }
      return output;
    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error executing flow:`, error);
      if (error instanceof AppError) {
        throw error; // Re-throw if already an AppError
      }
      // Wrap other errors in AppError
      throw new AppError(
        "Ocurrió un error en el flujo de generación de código.",
        error,
        'ai'
      );
    }
  }
);
