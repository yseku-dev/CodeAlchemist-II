
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

/**
 * Zod schema for the input to the `generateCodeFromDescriptionFlow`.
 */
const GenerateCodeFromDescriptionInputSchema = z.object({
  /** The natural language description of the code to be generated. */
  description: z.string().describe('The description of the code to generate.'),
});
/**
 * TypeScript type inferred from the `GenerateCodeFromDescriptionInputSchema`.
 */
export type GenerateCodeFromDescriptionInput = z.infer<typeof GenerateCodeFromDescriptionInputSchema>;

/**
 * Zod schema for the output of the `generateCodeFromDescriptionFlow`.
 */
const GenerateCodeFromDescriptionOutputSchema = z.object({
  /** An explanation of the generated code. */
  explanation: z.string().describe('Explanation of the generated code.'),
  /** The generated code snippet. */
  code: z.string().describe('The generated code snippet.'),
});
/**
 * TypeScript type inferred from the `GenerateCodeFromDescriptionOutputSchema`.
 */
export type GenerateCodeFromDescriptionOutput = z.infer<typeof GenerateCodeFromDescriptionOutputSchema>;

/**
 * Invokes the code generation Genkit flow.
 *
 * @param {GenerateCodeFromDescriptionInput} input - The input containing the description of the code to generate.
 * @returns {Promise<GenerateCodeFromDescriptionOutput>} A promise that resolves to the generated code and explanation.
 */
export async function generateCodeFromDescription(
  input: GenerateCodeFromDescriptionInput
): Promise<GenerateCodeFromDescriptionOutput> {
  return generateCodeFromDescriptionFlow(input);
}

/**
 * Genkit prompt definition for code generation.
 * It instructs the AI to act as an expert code generator.
 */
const prompt = ai.definePrompt({
  name: 'generateCodeFromDescriptionPrompt',
  input: {schema: GenerateCodeFromDescriptionInputSchema},
  output: {schema: GenerateCodeFromDescriptionOutputSchema},
  prompt: `Eres un experto generador de código. Genera código basado en la descripción proporcionada por el usuario. Incluye una breve explicación del código generado.

Descripción: {{{description}}}`,
});

/**
 * Genkit flow definition for generating code from a description.
 * This flow takes a description, passes it to the defined prompt, and returns the AI's output.
 */
const generateCodeFromDescriptionFlow = ai.defineFlow(
  {
    name: 'generateCodeFromDescriptionFlow',
    inputSchema: GenerateCodeFromDescriptionInputSchema,
    outputSchema: GenerateCodeFromDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    // The '!' asserts that output will not be null. 
    // Consider adding more robust error handling if output could be null.
    return output!; 
  }
);
