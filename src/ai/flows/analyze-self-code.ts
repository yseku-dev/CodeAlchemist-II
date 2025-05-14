
// src/ai/flows/analyze-self-code.ts
'use server';

/**
 * @fileOverview Flow for analyzing a project's source code to identify areas for improvement, bugs, or potential refactorings.
 * Can be used for CodeAlchemist's own code or any other provided project.
 *
 * - analyzeSelfCode - A function that initiates the analysis process. (Renamed to analyzeCode internally for clarity)
 * - AnalyzeCodeInput - The input type for the analyzeCode function.
 * - AnalyzeCodeOutput - The return type for the analyzeCode function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { AnalyzeCodeInput, AnalyzeCodeOutput } from '@/types'; // Using new generalized types

// Using the new generalized Zod schemas from types.ts if they were defined there,
// otherwise, defining them here based on AnalyzeCodeInput and AnalyzeCodeOutput.
const AnalyzeCodeInputSchema = z.object({
  sourceCodeLocation: z.enum(['Local', 'Git', 'UploadedString']).describe("Indicates if analyzing CodeAlchemist's local code, a Git repo, or direct string content."),
  projectContent: z.string().optional().describe("The actual project content, e.g., for 'UploadedString' or fetched Git content."),
  gitRepoUrl: z.string().optional().describe('The URL of the Git repository if sourceCodeLocation is Git.'),
  analysisPreferences: z.string().optional().describe('Specific areas or concerns to focus the analysis on. Used as focusArea.'),
  searchDepth: z.number().int().positive().optional().describe('How deep the analysis should go, e.g., number of levels in directory structure or call stack. 1 is superficial.'),
  focusArea: z.string().optional().describe('Specific functional area, module, or quality attribute (e.g., "performance", "security", "UI rendering logic") to concentrate the analysis on.'),
});

const AnalyzeCodeOutputSchema = z.object({
  analysisTitle: z.string().describe('A concise title summarizing the findings of the analysis.'),
  identifiedAreas: z.array(z.string()).describe('A list of components, modules, or files identified as areas of concern.'),
  detailedSuggestions: z.array(z.object({
    area: z.string().describe('The specific area affected by the suggestion (e.g., file path, component name).'),
    suggestion: z.string().describe('A detailed suggestion for improvement or correction.'),
    priority: z.enum(['Alta', 'Media', 'Baja']).describe('The priority of the suggestion.'),
    suggestedContent: z.string().optional().describe('The suggested content of the analyzed file. This includes the full file content, and not just a snippet.'),
    suggestedPromptForImplementation: z.string().optional().describe('Un prompt bien elaborado, en castellano, que podría usarse para que una IA implemente esta sugerencia específica.'),
  })).describe('A list of detailed suggestions for improvement.'),
  generalAssessment: z.string().describe('An overall assessment of the code quality and potential issues.'),
  groupLog: z.string().optional().describe('Log from group execution if applicable.'),
  overallImprovementIdeas: z.array(z.string()).optional().describe('High-level ideas for general project improvement based on objectives or focus area.'),
});


export async function analyzeSelfCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  // The flow name 'analyzeSelfCodeFlow' is kept for now to avoid breaking existing calls if any,
  // but the logic is now more generic.
  return analyzeSelfCodeFlow(input);
}

const analyzeCodePrompt = ai.definePrompt({
  name: 'analyzeProjectCodePrompt', // Renamed for clarity
  input: {schema: AnalyzeCodeInputSchema},
  output: {schema: AnalyzeCodeOutputSchema},
  prompt: `Eres un experto analista de código y arquitecto de software. Tu tarea es analizar el código fuente del proyecto proporcionado.
{{#if isLocal}}
Estás analizando el código fuente local de la aplicación CodeAlchemist.
{{/if}}
{{#if isGit}}
Estás analizando el código fuente del repositorio Git: {{{gitRepoUrl}}}.
{{/if}}
{{#if isUploadedString}}
Estás analizando el contenido del proyecto proporcionado directamente.
{{/if}}

Parámetros de Análisis:
{{#if focusArea}}
- Área de Enfoque Principal: {{{focusArea}}}
{{else}}
- Área de Enfoque Principal: Análisis general del código.
{{/if}}
{{#if searchDepth}}
- Profundidad de Análisis Sugerida: Nivel {{{searchDepth}}} (mayor número implica mayor profundidad).
{{else}}
- Profundidad de Análisis Sugerida: Total / Exhaustiva.
{{/if}}
{{#if analysisPreferences}}
- Preferencias Adicionales de Análisis (considerar como sinónimo de focusArea si este último no está presente): {{{analysisPreferences}}}
{{/if}}

Considera los siguientes aspectos durante tu análisis:
- Calidad del código: Legibilidad, mantenibilidad, adherencia a principios SOLID y Clean Code.
- Posibles errores: Bugs lógicos, condiciones de carrera, manejo incorrecto de excepciones.
- Oportunidades de refactorización: Código duplicado, clases/funciones muy largas, alta complejidad ciclomática.
- Rendimiento: Cuellos de botella, operaciones ineficientes.
- Seguridad: Vulnerabilidades comunes (SQL injection, XSS, manejo de secretos, etc., si aplica al contexto del código).
- Arquitectura: Cohesión, acoplamiento, modularidad.

Proporciona la siguiente información en tu respuesta (en castellano):
*   analysisTitle: Un título conciso que resuma los hallazgos principales.
*   identifiedAreas: Una lista de componentes, módulos, archivos o aspectos clave que requieren atención o son destacables.
*   detailedSuggestions: Una lista de sugerencias específicas y accionables. Para cada sugerencia:
    *   area: El archivo/componente/función específica.
    *   suggestion: La descripción detallada de la mejora.
    *   priority: "Alta", "Media", o "Baja".
    *   suggestedContent (opcional): Si la sugerencia implica un cambio de código directo, proporciona el contenido completo del archivo modificado.
    *   suggestedPromptForImplementation (opcional): Un prompt bien elaborado, en castellano, que se podría dar a otra IA para que implemente esta sugerencia específica. Este prompt debe ser claro, conciso y contener toda la información necesaria para la tarea. Por ejemplo, si la sugerencia es "Refactorizar la función X para usar async/await", el prompt podría ser: "Refactoriza la siguiente función X del archivo Y.js para que utilice async/await en lugar de promesas anidadas, manteniendo la misma funcionalidad: [código de la función X]". Si la sugerencia es conceptual, este prompt debe guiar la implementación de esa idea.
*   generalAssessment: Una evaluación general del estado del código y recomendaciones de alto nivel.
*   overallImprovementIdeas (opcional): Una lista de 2-3 ideas de alto nivel para mejoras generales del proyecto, relacionadas con los objetivos o el área de enfoque proporcionada. Por ejemplo, si el enfoque es "rendimiento UI", una idea podría ser "Explorar la carga diferida (lazy loading) de componentes pesados".

Tu respuesta DEBE ser únicamente el objeto JSON que se adhiere al esquema de salida.
{{#if projectContent}}
Contenido del Proyecto (o referencia):
---
{{{projectContent}}}
---
{{/if}}
`,
});

const analyzeSelfCodeFlow = ai.defineFlow( // Keeping flow name for now
  {
    name: 'analyzeSelfCodeFlow',
    inputSchema: AnalyzeCodeInputSchema,
    outputSchema: AnalyzeCodeOutputSchema,
  },
  async input => {
    const isLocal = input.sourceCodeLocation === 'Local';
    const isGit = input.sourceCodeLocation === 'Git';
    const isUploadedString = input.sourceCodeLocation === 'UploadedString';

    const promptInput = {
        ...input,
        isLocal,
        isGit,
        isUploadedString,
    };

    const {output} = await analyzeCodePrompt(promptInput);
    if (!output) {
      throw new Error("La IA no pudo generar el análisis del proyecto.");
    }
    return output;
  }
);
