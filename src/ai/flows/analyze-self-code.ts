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
import { AppError } from '@/utils/AppError';

const AnalyzeCodeInputSchema = z.object({
  sourceCodeLocation: z.enum(['Local', 'Git', 'UploadedString']).describe("Indicates if analyzing CodeAlchemist's local code, a Git repo, or direct string content."),
  projectContent: z.string().optional().describe("The actual project content, e.g., for 'UploadedString' or fetched Git content."),
  gitRepoUrl: z.string().optional().describe('The URL of the Git repository if sourceCodeLocation is Git.'),
  analysisPreferences: z.string().optional().describe('Specific areas or concerns to focus the analysis on. Used as focusArea.'),
  searchDepth: z.number().int().positive().optional().describe('How deep the analysis should go, e.g., number of levels in directory structure or call stack. 1 is superficial. If not provided, assume a comprehensive/total analysis.'),
  focusArea: z.string().optional().describe('Specific functional area, module, or quality attribute (e.g., "performance", "security", "UI rendering logic") to concentrate the analysis on.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente, si la refactorización es impulsada por un agente o grupo.'),
});

const AnalyzeCodeOutputSchema = z.object({
  analysisTitle: z.string().describe('A concise title summarizing the findings of the analysis.'),
  identifiedAreas: z.array(z.string()).describe('A list of components, modules, or files identified as areas of concern. This field is REQUIRED. Return an empty array [] if no specific areas are identified.').min(0), // Ensure it can be an empty array
  detailedSuggestions: z.array(z.object({
    area: z.string().describe('The specific area affected by the suggestion (e.g., file path, component name).'),
    suggestion: z.string().describe('A detailed suggestion for improvement or correction.'),
    priority: z.enum(['Alta', 'Media', 'Baja']).describe('The priority of the suggestion.'),
    suggestedContent: z.string().optional().describe('The suggested content of the analyzed file if the suggestion implies direct code changes. This should be the FULL file content. If the suggestion is conceptual, this can be omitted.'),
    suggestedPromptForImplementation: z.string().optional().describe('Un prompt bien elaborado, en castellano, que podría usarse para que una IA implemente esta sugerencia específica. Provide this for all detailed suggestions if possible.'),
  })).describe('A list of detailed suggestions for improvement. This field is REQUIRED. Return an empty array [] if no specific suggestions are generated.'),
  generalAssessment: z.string().describe("An overall assessment of the code quality and potential issues. THIS MUST START WITH a summary of the project's objectives and core functionalities before detailing quality, issues, or recommendations. This field is REQUIRED."),
  groupLog: z.string().optional().describe('Log from group execution if applicable.'),
  overallImprovementIdeas: z.array(z.string()).optional().describe('High-level ideas for general project improvement based on objectives or focus area. This field is OPTIONAL.'),
});


export async function analyzeSelfCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  return analyzeSelfCodeFlow(input);
}

const analyzeCodePromptInstructions = `
Parámetros de Análisis:
{{#if focusArea}}
- Área de Enfoque Principal: {{{focusArea}}}
{{else}}
- Área de Enfoque Principal: Análisis general del código.
{{/if}}
{{#if searchDepth}}
- Profundidad de Análisis Sugerida: Nivel {{{searchDepth}}} (mayor número implica mayor profundidad).
{{else}}
- Profundidad de Análisis Sugerida: Total / Exhaustiva (analiza todo el código proporcionado).
{{/if}}
{{#if analysisPreferences}}
- Preferencias Adicionales de Análisis (considerar como sinónimo de focusArea si este último no está presente): {{{analysisPreferences}}}
{{/if}}

Proporciona la siguiente información en tu respuesta (en castellano y en formato JSON estricto):

*   **analysisTitle (OBLIGATORIO):** Un título conciso que resuma los hallazgos principales.
*   **generalAssessment (OBLIGATORIO):** Una evaluación general del estado del código. IMPORTANTE: COMIENZA esta evaluación con un resumen de los objetivos y funcionalidades principales del proyecto analizado. Luego, continúa con la calidad del código, posibles errores, oportunidades de refactorización, rendimiento, seguridad, y arquitectura (cohesión, acoplamiento, modularidad).
*   **identifiedAreas (OBLIGATORIO):** Una lista de componentes, módulos, archivos o aspectos clave que requieren atención o son destacables. Debe ser un array de strings. Si no hay áreas específicas, devuelve un array vacío \`[]\`.
*   **detailedSuggestions (OBLIGATORIO):** Una lista de sugerencias específicas y accionables. Debe ser un array de objetos. Si no hay sugerencias detalladas, devuelve un array vacío \`[]\`. Para cada sugerencia en el array:
    *   **area (OBLIGATORIO):** El archivo/componente/función específica.
    *   **suggestion (OBLIGATORIO):** La descripción detallada de la mejora.
    *   **priority (OBLIGATORIO):** "Alta", "Media", o "Baja".
    *   **suggestedContent (OPCIONAL, PERO MUY RECOMENDADO SI HAY CAMBIOS DE CÓDIGO):** Si la sugerencia implica un cambio de código directo en un archivo, DEBES proporcionar el contenido COMPLETO del archivo modificado aquí. Si la sugerencia es conceptual o no implica un cambio de código directo, puedes omitir este campo o dejarlo como una cadena vacía.
    *   **suggestedPromptForImplementation (OPCIONAL, PERO MUY RECOMENDADO):** Un prompt bien elaborado, en castellano, que se podría dar a otra IA para que implemente esta sugerencia específica. Intenta proporcionar esto para todas las sugerencias. Este prompt debe ser claro, conciso y contener toda la información necesaria para la tarea. Por ejemplo, si la sugerencia es "Refactorizar la función X para usar async/await", el prompt podría ser: "Refactoriza la siguiente función X del archivo Y.js para que utilice async/await en lugar de promesas anidadas, manteniendo la misma funcionalidad: [código de la función X]". Si la sugerencia es conceptual, este prompt debe guiar la implementación de esa idea.
*   **overallImprovementIdeas (OPCIONAL):** Una lista de 2-3 ideas de alto nivel para mejoras generales del proyecto, relacionadas con los objetivos o el área de enfoque proporcionada. Por ejemplo, si el enfoque es "rendimiento UI", una idea podría ser "Explorar la carga diferida (lazy loading) de componentes pesados". Si no hay ideas, puedes omitir este campo o devolver un array vacío.

Tu respuesta DEBE ser únicamente el objeto JSON que se adhiere estrictamente al esquema de salida especificado. Asegúrate de incluir TODAS LAS PROPIEDADES OBLIGATORIAS.
`;

const analyzeCodePrompt = ai.definePrompt({
  name: 'analyzeProjectCodePrompt',
  input: {schema: AnalyzeCodeInputSchema},
  output: {schema: AnalyzeCodeOutputSchema, format: 'json'}, // Ensure output format is json
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Analiza el código fuente del proyecto proporcionado según los parámetros y el formato de salida detallados a continuación. Tu respuesta debe estar en castellano.
{{else}}
Eres un experto analista de código y arquitecto de software. Tu tarea es analizar el código fuente del proyecto proporcionado. Tu respuesta debe estar en castellano.
{{/if}}

${analyzeCodePromptInstructions}

{{#if projectContent}}
Contenido del Proyecto (o referencia):
---
{{{projectContent}}}
---
{{/if}}
`,
});

const analyzeSelfCodeFlow = ai.defineFlow(
  {
    name: 'analyzeSelfCodeFlow',
    inputSchema: AnalyzeCodeInputSchema,
    outputSchema: AnalyzeCodeOutputSchema,
  },
  async (input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> => {
    const flowName = 'analyzeSelfCodeFlow';
    console.log(`[Flow: ${flowName}] Iniciado. Source: ${input.sourceCodeLocation}, Focus: ${input.focusArea || input.analysisPreferences || 'General'}, Depth: ${input.searchDepth || 'Exhaustiva'}`);
    if(input.projectContent) {
      console.log(`[Flow: ${flowName}] Longitud del projectContent: ${input.projectContent.length}`);
    }
    if(input.agentSystemPrompt) {
      console.log(`[Flow: ${flowName}] Longitud del agentSystemPrompt: ${input.agentSystemPrompt.length}`);
    }


    const promptInput = {
        ...input,
        // Asegurar que el prompt no falle si projectContent es muy grande y se trunca para el log.
        // La llamada a `analyzeCodePrompt` usará el input.projectContent completo.
    };
    console.log(`[Flow: ${flowName}] Enviando prompt a LLM. Input (parcial para log):`, {
      ...promptInput,
      projectContent: `${promptInput.projectContent?.substring(0, 200)}... (Total: ${promptInput.projectContent?.length || 0})`,
      agentSystemPrompt: `${promptInput.agentSystemPrompt?.substring(0,100)}... (Total: ${promptInput.agentSystemPrompt?.length || 0})`
    });


    try {
      const response = await analyzeCodePrompt(promptInput);
      let output = response.output;

      if (!output) {
        const validationError = response.usage?.promptInvalid ? JSON.stringify(response.usage.promptInvalid) : "No se proporcionó output detallado.";
        console.error(`[Flow: ${flowName}] La IA no pudo generar el análisis del proyecto (output nulo/undefined). Error de validación Genkit: ${validationError}`);
        throw new AppError(
            `La IA no pudo generar el análisis del proyecto (respuesta nula o inválida). Detalles de validación: ${validationError.substring(0,100)}...`,
            {genkitValidationError: response.usage?.promptInvalid},
            'ai'
        );
      }
      
      console.log(`[Flow: ${flowName}] Output crudo de LLM (parseado por Genkit, truncado para log): ${JSON.stringify(output).substring(0, 500)}...`);

      // Asegurar campos requeridos y valores por defecto
      const finalOutput: AnalyzeCodeOutput = {
        analysisTitle: output.analysisTitle || "Análisis de Proyecto (Título no proporcionado por IA)",
        generalAssessment: output.generalAssessment || "Evaluación general no proporcionada por IA.",
        identifiedAreas: Array.isArray(output.identifiedAreas) ? output.identifiedAreas : [],
        detailedSuggestions: (Array.isArray(output.detailedSuggestions) ? output.detailedSuggestions : []).map(s => ({
          area: s.area || "Área no especificada",
          suggestion: s.suggestion || "Sugerencia no especificada",
          priority: s.priority || "Media",
          suggestedContent: s.suggestedContent,
          suggestedPromptForImplementation: s.suggestedPromptForImplementation,
        })),
        groupLog: output.groupLog,
        overallImprovementIdeas: Array.isArray(output.overallImprovementIdeas) ? output.overallImprovementIdeas : undefined,
      };
      
      if (!output.analysisTitle) console.warn(`[Flow: ${flowName}] Advertencia: 'analysisTitle' no fue proporcionado por la IA. Usando valor por defecto.`);
      if (!output.generalAssessment) console.warn(`[Flow: ${flowName}] Advertencia: 'generalAssessment' no fue proporcionado por la IA. Usando valor por defecto.`);
      if (!Array.isArray(output.identifiedAreas)) console.warn(`[Flow: ${flowName}] Advertencia: 'identifiedAreas' no fue un array válido. Usando []. Output recibido:`, output.identifiedAreas);
      if (!Array.isArray(output.detailedSuggestions)) console.warn(`[Flow: ${flowName}] Advertencia: 'detailedSuggestions' no fue un array válido. Usando []. Output recibido:`, output.detailedSuggestions);


      console.log(`[Flow: ${flowName}] Análisis completado. Título: ${finalOutput.analysisTitle}, Sugerencias: ${finalOutput.detailedSuggestions.length}`);
      return finalOutput;

    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo:`, error);
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack.substring(0, 1000));
      if (error.details) console.error(`[Flow: ${flowName}] Detalles del error original (Genkit/Google):`, error.details);

      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido ejecutando el flujo de análisis.';
      let schemaValidationErrorMsg = "";
      if (error?.name === 'ZodError' && error.errors) {
          try { schemaValidationErrorMsg = ` Detalles de validación Zod: ${JSON.stringify(error.errors[0] || error.errors).substring(0, 200)}`; } catch { schemaValidationErrorMsg = " (Error de Zod no serializable).";}
      } else if (error?.code === 'INVALID_ARGUMENT' && error?.message?.includes('Schema validation failed')) {
           try { schemaValidationErrorMsg = ` ${error.message.substring(0, 200)}`; } catch { schemaValidationErrorMsg = " (Error de validación de schema de Genkit no serializable).";}
      }

      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');
      const errorDetailsForAppError: any = {
          message: originalErrorMessage.substring(0, 500) + (originalErrorMessage.length > 500 ? '...' : ''),
          name: error?.name,
          genkitValidationInfo: schemaValidationErrorMsg || undefined,
      };
      if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
          errorDetailsForAppError.stackHint = error.stack.substring(0, 500) + "... (ver logs completos del servidor)";
      }
      throw new AppError(
        `FALLO_EN_FLUJO_ANALYZE_PROJECT: ${detailsForUser}${schemaValidationErrorMsg}`,
        errorDetailsForAppError,
        'ai'
      );
    }
  }
);