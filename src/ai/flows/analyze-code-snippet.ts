
'use server';
/**
 * @fileOverview Flow for analyzing a code snippet.
 *
 * - analyzeCodeSnippet - A function that handles the code snippet analysis.
 * - AnalyzeCodeSnippetInput - The input type.
 * - AnalyzeCodeSnippetOutput - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { AnalyzeCodeSnippetInput, AnalyzeCodeSnippetOutput } from '@/types';

const AnalyzeCodeSnippetInputSchema = z.object({
  code: z.string().describe('The code snippet to analyze.'),
  userPrompt: z.string().optional().describe('Specific instructions or focus for the analysis from the user.'),
  language: z.string().optional().describe('The programming language of the snippet (e.g., javascript, python).'),
  agentSystemPrompt: z.string().optional().describe('The system prompt of an agent, if analysis is agent-driven.'),
});

const AnalyzeCodeSnippetOutputSchema = z.object({
  explanation: z.string().describe('An explanation of what the original code does.'),
  originalCode: z.string().describe('The original code snippet that was analyzed.'),
  suggestedCode: z.string().describe('The suggested version of the code with improvements or alternatives.'),
});

export async function analyzeCodeSnippet(
  input: AnalyzeCodeSnippetInput
): Promise<AnalyzeCodeSnippetOutput> {
  return analyzeCodeSnippetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCodeSnippetPrompt',
  input: { schema: AnalyzeCodeSnippetInputSchema },
  output: { schema: AnalyzeCodeSnippetOutputSchema },
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Analiza el siguiente fragmento de código.
{{else}}
Eres un experto analizador de código. Tu tarea es analizar el siguiente fragmento de código.
{{/if}}

{{#if language}}
Lenguaje del código: {{{language}}}
{{/if}}

Código a analizar:
\`\`\`
{{{code}}}
\`\`\`

{{#if userPrompt}}
El usuario ha proporcionado las siguientes instrucciones adicionales para el análisis:
"{{{userPrompt}}}"
Por favor, tenlas en cuenta.
{{/if}}

Proporciona la siguiente información en tu respuesta:
1.  **Explicación**: Una descripción en lenguaje natural de lo que hace el código original.
2.  **Código Original**: El código original que se analizó (debe ser idéntico al proporcionado).
3.  **Código Sugerido**: Una versión del código con las mejoras, correcciones u optimizaciones que propones. Si no hay sugerencias significativas, puedes devolver el código original o añadir comentarios útiles.

Asegúrate de que tu respuesta esté en castellano y siga el formato de salida JSON especificado.
`,
});

const analyzeCodeSnippetFlow = ai.defineFlow(
  {
    name: 'analyzeCodeSnippetFlow',
    inputSchema: AnalyzeCodeSnippetInputSchema,
    outputSchema: AnalyzeCodeSnippetOutputSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output();
    if (!output) {
      throw new Error("La IA no pudo analizar el fragmento de código.");
    }
    // Ensure originalCode is part of the output, matching the input for clarity
    return { ...output, originalCode: input.code };
  }
);
