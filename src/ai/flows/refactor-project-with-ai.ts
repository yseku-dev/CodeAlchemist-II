
// src/ai/flows/refactor-project-with-ai.ts
'use server';

/**
 * @fileOverview Refactors a project with AI to provide refactoring suggestions.
 *
 * - refactorProjectWithAI - A function that handles the project refactoring process.
 * - RefactorProjectWithAIInput - The input type for the refactorProjectWithAI function.
 * - RefactorProjectWithAIOutput - The return type for the refactorProjectWithAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { RefactorProjectWithAIInput as RefactorInputType, RefactorProjectWithAIOutput as RefactorOutputType } from '@/types';


const RefactorProjectWithAIInputSchema = z.object({
  projectSource: z.string().describe('The project source, either a ZIP file content as string, a Git URL, or a reference to local content.'),
  goals: z.string().optional().describe('Specific goals for the refactoring process.'),
  priority: z
    .string()
    .optional()
    .describe('General priority for the refactoring, e.g., Security, Readability, Performance.'),
  searchDepth: z.number().int().positive().optional().describe('How deep the analysis should go for refactoring.'),
  focusArea: z.string().optional().describe('Specific area to focus the refactoring on.'),
});
// export type RefactorProjectWithAIInput = z.infer<typeof RefactorProjectWithAIInputSchema>; // Already in types.ts

const RefactorSuggestionSchema = z.object({
  area: z.string().describe('The file or component affected by the suggestion.'),
  description: z.string().describe('A detailed explanation of the proposed improvement.'),
  priority: z.enum(["Alta", "Media", "Baja"]).describe('The priority of the suggestion (Alta, Media, Baja).'),
  snippetSuggested: z
    .object({
      original: z.string().optional().describe('Original code snippet.'),
      modified: z.string().optional().describe('Modified code snippet.'),
    })
    .optional()
    .describe('Suggested code snippet with original and modified code.'),
});

const RefactorProjectWithAIOutputSchema = z.object({
  projectOverview: z.string().describe('Un resumen de los objetivos y funcionalidades principales del proyecto que se está refactorizando. Esto debe proporcionarse ANTES de las sugerencias.'),
  suggestions: z.array(RefactorSuggestionSchema).describe("Una lista de sugerencias de refactorización."),
  groupLog: z.string().optional().describe('Log from group execution if refactoring was group-coordinated.'),
});
// export type RefactorProjectWithAIOutput = z.infer<typeof RefactorProjectWithAIOutputSchema>; // Already in types.ts

export async function refactorProjectWithAI(input: RefactorInputType): Promise<RefactorOutputType> {
  return refactorProjectWithAIFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refactorProjectWithAIPrompt',
  input: {schema: RefactorProjectWithAIInputSchema},
  output: {schema: RefactorProjectWithAIOutputSchema},
  prompt: `Eres un AI experto en refactorización de código. Analiza el proyecto proporcionado y genera sugerencias de refactorización.

Fuente del Proyecto (o referencia): {{{projectSource}}}
{{#if goals}}Metas de Refactorización: {{{goals}}}{{/if}}
{{#if priority}}Prioridad General: {{{priority}}}{{/if}}
{{#if focusArea}}Área de Enfoque: {{{focusArea}}}{{/if}}
{{#if searchDepth}}Profundidad de Análisis: Nivel {{{searchDepth}}}{{else}}Profundidad de Análisis: Total / Exhaustiva{{/if}}

Tu respuesta DEBE ser un objeto JSON. Proporciona PRIMERO un 'projectOverview': un resumen conciso de los objetivos y funcionalidades principales del proyecto que estás analizando.
Luego, proporciona un array 'suggestions' con las sugerencias de refactorización. Cada sugerencia debe tener: "area", "description", "priority" ("Alta", "Media", "Baja"), y opcionalmente "snippetSuggested" (con "original" y "modified").
Todas las salidas deben estar en castellano.
`,
});

const refactorProjectWithAIFlow = ai.defineFlow(
  {
    name: 'refactorProjectWithAIFlow',
    inputSchema: RefactorProjectWithAIInputSchema,
    outputSchema: RefactorProjectWithAIOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("La IA no pudo generar sugerencias de refactorización.");
    }
    return output;
  }
);
