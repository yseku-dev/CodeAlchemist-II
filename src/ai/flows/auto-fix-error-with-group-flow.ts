
'use server';
/**
 * @fileOverview A Genkit flow to attempt auto-fixing an error using the 'EquipoDesarrolloSoftware' group.
 *
 * - autoFixErrorWithGroup - A function that orchestrates the auto-fix attempt with the group.
 * - AutoFixErrorWithGroupInput - The input type for the function.
 * - AutoFixErrorWithGroupOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  AutoFixErrorWithGroupInput,
  AutoFixErrorWithGroupOutput,
  Agent,
} from '@/types';
import { callChatWithAIGroup } from '@/utils/apiClient'; // To call the orchestrator
import { DEFAULT_AGENTS, DEFAULT_GROUPS } from '@/lib/constants'; // To get group/agent info

const AutoFixErrorWithGroupInputSchema = z.object({
  errorMessage: z.string().describe('The error message that occurred.'),
  codeContext: z
    .string()
    .optional()
    .describe(
      'Optional: A snippet of code or broader context where the error happened.'
    ),
  userInstructions: z
    .string()
    .optional()
    .describe('Optional: Any specific guidance from the user for the fix.'),
});

const AutoFixErrorWithGroupOutputSchema = z.object({
  suggestedSolution: z
    .string()
    .describe(
      "The solution proposed by the 'EquipoDesarrolloSoftware' group."
    ),
  diagnosticNotes: z
    .string()
    .describe("Any diagnostic notes or reasoning from the group's process."),
  initialGroupLog: z
    .string()
    .describe(
      'A log indicating how the group was invoked for this auto-fix task.'
    ),
});

/**
 * Attempts to auto-fix an error by invoking the 'EquipoDesarrolloSoftware' group.
 *
 * This function constructs a task for the 'EquipoDesarrolloSoftware' group based on the
 * provided error details. It then calls the group's orchestrator (via `chatWithAIGroupFlow`)
 * to get an initial diagnosis or proposed solution.
 *
 * @param {AutoFixErrorWithGroupInput} input - The error details and context.
 * @returns {Promise<AutoFixErrorWithGroupOutput>} The proposed solution and diagnostic notes.
 * @throws {Error} If the 'EquipoDesarrolloSoftware' group or its orchestrator cannot be found,
 *                 or if the `chatWithAIGroupFlow` fails.
 */
export async function autoFixErrorWithGroup(
  input: AutoFixErrorWithGroupInput
): Promise<AutoFixErrorWithGroupOutput> {
  return autoFixErrorWithGroupFlow(input);
}

const autoFixErrorWithGroupFlow = ai.defineFlow(
  {
    name: 'autoFixErrorWithGroupFlow',
    inputSchema: AutoFixErrorWithGroupInputSchema,
    outputSchema: AutoFixErrorWithGroupOutputSchema,
  },
  async (input) => {
    const { errorMessage, codeContext, userInstructions } = input;

    const softwareDevelopmentTeam = DEFAULT_GROUPS.find(
      (g) => g.id === 'equipo-desarrollo-software'
    );
    const orchestratorAgent = DEFAULT_AGENTS.find(
      (a) => a.id === 'orquestador-flujo-agentes'
    );

    if (!softwareDevelopmentTeam || !orchestratorAgent) {
      throw new Error(
        "El grupo 'EquipoDesarrolloSoftware' o su 'OrquestadorFlujoAgentes' no están definidos por defecto."
      );
    }

    const participatingAgents = softwareDevelopmentTeam.agentIds
      .map((id) => DEFAULT_AGENTS.find((a) => a.id === id))
      .filter(Boolean) as Agent[]; // Type assertion after filtering

    const taskForGroup = `Ha ocurrido el siguiente error en la aplicación CodeAlchemist:
--- ERROR MESSAGE START ---
${errorMessage}
--- ERROR MESSAGE END ---

${
  codeContext
    ? `Contexto del código donde ocurrió el error (o relevante para el mismo):
--- CODE CONTEXT START ---
${codeContext}
--- CODE CONTEXT END ---`
    : 'No se proporcionó contexto de código específico.'
}

${
  userInstructions
    ? `Instrucciones adicionales del usuario para la corrección:
--- USER INSTRUCTIONS START ---
${userInstructions}
--- USER INSTRUCTIONS END ---`
    : 'No se proporcionaron instrucciones adicionales por parte del usuario.'
}

Por favor, como "EquipoDesarrolloSoftware", utilizando tus agentes especializados coordinados por el Orquestador:
1. Analiza este error.
2. Diagnostica la causa raíz más probable.
3. Propón una solución detallada en castellano. Esta solución debe ser clara, accionable y, si implica cambios de código, debe incluir los fragmentos de código sugeridos.
4. Incluye cualquier nota de diagnóstico o razonamiento importante.

Tu respuesta (la del Orquestador, resumiendo el trabajo del grupo) debe estar estructurada para que pueda ser presentada al usuario.
Enfócate en proporcionar una "suggestedSolution" y "diagnosticNotes".`;

    const initialGroupLog = `[Auto-Fix] Invocando al grupo 'EquipoDesarrolloSoftware' con la tarea de analizar y proponer una solución para el error: "${errorMessage.substring(0, 100)}...".
Grupo: ${softwareDevelopmentTeam.name}
Tarea principal del grupo (abreviada): ${softwareDevelopmentTeam.mainTask.substring(0, 150)}...
Prompt del Orquestador (abreviado): ${orchestratorAgent.systemPrompt.substring(0, 150)}...`;

    try {
      const groupResponse = await callChatWithAIGroup({
        userMessage: taskForGroup,
        groupMainTask: softwareDevelopmentTeam.mainTask, // The overall goal of the team
        participatingAgents: participatingAgents.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          systemPrompt: p.systemPrompt,
          capabilities: p.capabilities,
          llmConfig: p.llmConfig,
        })),
        orchestratorAgentSystemPrompt: orchestratorAgent.systemPrompt,
      });

      // For this iteration, we assume the orchestrator's first comprehensive response
      // contains the necessary information. A more complex system might involve
      // multiple turns managed by this flow, but that's beyond a single flow call.
      // We'll attempt to parse the orchestrator's JSON response if it's structured,
      // or use its text directly.

      let suggestedSolution = `Respuesta del grupo 'EquipoDesarrolloSoftware':\n${groupResponse.orchestratorResponse}`;
      let diagnosticNotes =
        'El grupo ha proporcionado una respuesta inicial. Revisa la solución sugerida.';

      try {
        const parsedOrchestratorResponse = JSON.parse(
          groupResponse.orchestratorResponse
        );
        // If the orchestrator provided a structured response according to its own prompt
        if (
          parsedOrchestratorResponse.instruction_for_next_agent ||
          parsedOrchestratorResponse.reasoning
        ) {
          suggestedSolution =
            parsedOrchestratorResponse.instruction_for_next_agent ||
            'El grupo está procesando la solicitud.';
          diagnosticNotes =
            parsedOrchestratorResponse.reasoning ||
            'El orquestador ha delegado la tarea.';
          if (parsedOrchestratorResponse.next_agent_id === 'COMPLETADO') {
             diagnosticNotes = `El grupo considera la tarea completada con esta solución. ${diagnosticNotes}`;
          }
        }
      } catch (e) {
        // Not a JSON response, use the raw text as the solution
        console.warn(
          '[Auto-Fix Flow] La respuesta del orquestador no era JSON, usando como texto directo.'
        );
      }

      return {
        suggestedSolution,
        diagnosticNotes,
        initialGroupLog,
      };
    } catch (error) {
      console.error('[Auto-Fix Flow] Error llamando a chatWithAIGroup:', error);
      throw new Error(
        `Error al interactuar con el grupo 'EquipoDesarrolloSoftware' para auto-corrección: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
);
