
'use server';
/**
 * @fileOverview A Genkit flow to redefine a user's prompt for better clarity and effectiveness.
 *
 * - redefinePrompt - A function that invokes the prompt redefinition flow.
 * - RedefinePromptInput - The input type for the function.
 * - RedefinePromptOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { RedefinePromptInput, RedefinePromptOutput } from '@/types';
import { AppError } from '@/utils/AppError';

const RedefinePromptInputSchema = z.object({
  originalPrompt: z.string().describe('El prompt original proporcionado por el usuario.'),
});

const RedefinePromptOutputSchema = z.object({
  redefinedPrompt: z.string().describe('El prompt refinado, más claro o detallado, generado por la IA.'),
});

/**
 * Invokes the Genkit flow to redefine a user's prompt.
 * @param {RedefinePromptInput} input - The original prompt to be redefined.
 * @returns {Promise<RedefinePromptOutput>} The redefined prompt.
 * @throws {AppError} If the AI fails to redefine the prompt.
 */
export async function redefinePrompt(
  input: RedefinePromptInput
): Promise<RedefinePromptOutput> {
  return redefinePromptFlow(input);
}

const promptRefiner = ai.definePrompt({
  name: 'redefinePromptGenkit',
  input: { schema: RedefinePromptInputSchema },
  output: { schema: RedefinePromptOutputSchema },
  prompt: `Eres un asistente experto en la formulación de prompts para la generación de proyectos de software.
El siguiente es un prompt proporcionado por un usuario para describir un proyecto que quiere generar:
"{{{originalPrompt}}}"

Tu tarea es refinar, clarificar, y si es necesario, expandir este prompt para hacerlo más efectivo para una IA que va a generar la estructura del proyecto.
Asegúrate de mantener la intención original del usuario.
La salida debe ser únicamente el prompt redefinido, sin ningún otro texto o explicación adicional.
El prompt redefinido debe estar en castellano.`,
});

const redefinePromptFlow = ai.defineFlow(
  {
    name: 'redefinePromptFlow',
    inputSchema: RedefinePromptInputSchema,
    outputSchema: RedefinePromptOutputSchema,
  },
  async (input) => {
    const flowName = 'redefinePromptFlow';
    try {
      const llmResponse = await promptRefiner(input);
      const output = llmResponse.output;

      if (!output || !output.redefinedPrompt) {
        const errorDetail = "No output or empty redefinedPrompt from LLM.";
        console.error(`[Flow: ${flowName}] ${errorDetail}`);
        throw new AppError(
          "La IA no pudo redefinir la petición.",
          { originalError: errorDetail },
          'ai'
        );
      }
      return output;
    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado antes de lanzar AppError:`, error);
      if (error.stack) {
        console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      }
      if (error.details) {
        console.error(`[Flow: ${flowName}] Detalles del error original:`, error.details);
      }
      if (error.cause) {
         console.error(`[Flow: ${flowName}] Causa del error original:`, error.cause);
      }

      const originalErrorMessage = error instanceof Error ? error.message : String(error);
      const detailsForUser = originalErrorMessage.substring(0, 150) + (originalErrorMessage.length > 150 ? '...' : '');


      if (error instanceof AppError) {
        // Si ya es un AppError, podríamos querer añadir más contexto o simplemente relanzarlo.
        // Por ahora, lo relanzamos, pero podríamos querer que su mensaje incluya 'detailsForUser'
        // error.friendlyMessage = `FALLO_EN_FLUJO_REDEFINE_PROMPT: ${detailsForUser}`;
        throw error;
      }

      throw new AppError(
        `Ocurrió un error en el flujo de redefinición de petición. Causa: ${detailsForUser}`,
        error,
        'ai'
      );
    }
  }
);

