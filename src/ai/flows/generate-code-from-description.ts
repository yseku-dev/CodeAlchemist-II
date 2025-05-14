'use server';
/**
 * @fileOverview A code generation AI agent.
 *
 * - generateCodeFromDescription - A function that handles the code generation process.
 * - GenerateCodeFromDescriptionInput - The input type for the generateCodeFromDescription function.
 * - GenerateCodeFromDescriptionOutput - The return type for the generateCodeFromDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCodeFromDescriptionInputSchema = z.object({
  description: z.string().describe('The description of the code to generate.'),
});
export type GenerateCodeFromDescriptionInput = z.infer<typeof GenerateCodeFromDescriptionInputSchema>;

const GenerateCodeFromDescriptionOutputSchema = z.object({
  explanation: z.string().describe('Explanation of the generated code.'),
  code: z.string().describe('The generated code snippet.'),
});
export type GenerateCodeFromDescriptionOutput = z.infer<typeof GenerateCodeFromDescriptionOutputSchema>;

export async function generateCodeFromDescription(
  input: GenerateCodeFromDescriptionInput
): Promise<GenerateCodeFromDescriptionOutput> {
  return generateCodeFromDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCodeFromDescriptionPrompt',
  input: {schema: GenerateCodeFromDescriptionInputSchema},
  output: {schema: GenerateCodeFromDescriptionOutputSchema},
  prompt: `Eres un experto generador de código. Genera código basado en la descripción proporcionada por el usuario. Incluye una breve explicación del código generado.

Descripción: {{{description}}}`,
});

const generateCodeFromDescriptionFlow = ai.defineFlow(
  {
    name: 'generateCodeFromDescriptionFlow',
    inputSchema: GenerateCodeFromDescriptionInputSchema,
    outputSchema: GenerateCodeFromDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
