
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
import { AppError } from '@/utils/AppError';

const AutoFixErrorWithGroupInputSchema = z.object({
  errorMessage: z.string().describe('The error message that occurred.'),
  codeContext: z
    .string()
    .optional()
    .describe(
      'Optional: A snippet of code or broader context where the error happened (e.g., user prompt, relevant code).'
    ),
  userInstructions: z
    .string()
    .optional()
    .describe('Optional: Any specific guidance from the user for the fix or additional context about the task being performed when the error occurred.'),
});

const AutoFixErrorWithGroupOutputSchema = z.object({
  suggestedSolution: z
    .string()
    .describe(
      "The solution proposed by the 'EquipoDesarrolloSoftware' group. This should be actionable advice, code suggestions, or steps to resolve the error."
    ),
  diagnosticNotes: z
    .string()
    .describe("Any diagnostic notes, reasoning behind the solution, or questions the group might have if the error is ambiguous. This could also include an attempt to categorize the error (e.g., user input, API issue, code bug)."),
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
 * @throws {AppError} If the 'EquipoDesarrolloSoftware' group or its orchestrator cannot be found,
 *                 or if the `chatWithAIGroupFlow` (via `callChatWithAIGroup`) fails.
 */
export async function autoFixErrorWithGroup(
  input: AutoFixErrorWithGroupInput
): Promise<AutoFixErrorWithGroupOutput> {
  const flowName = 'autoFixErrorWithGroupFlow';
  console.log(`[Flow: ${flowName}] Iniciado con error: "${input.errorMessage.substring(0, 100)}..."`);
  try {
    return await autoFixErrorWithGroupFlow(input);
  } catch (error: any) {
    console.error(`[Flow: ${flowName}] Error CRÍTICO ejecutando el flujo principal de auto-corrección:`, error);
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    
    if (error instanceof AppError) {
      // Si ya es un AppError (por ejemplo, de callChatWithAIGroup), propágalo
      // pero podríamos añadir más contexto si es necesario.
      error.friendlyMessage = `Error en el proceso de auto-corrección: ${error.friendlyMessage}`;
      throw error;
    }
    // Envuelve otros errores en AppError
    throw new AppError(
      `Falló el flujo de auto-corrección. Causa: ${originalErrorMessage.substring(0,100)}...`,
      error,
      'ai' // Asumimos que un fallo aquí es probablemente un fallo de IA o de comunicación con ella
    );
  }
}

const autoFixErrorWithGroupFlow = ai.defineFlow(
  {
    name: 'autoFixErrorWithGroupFlowInternal', // Internal flow name
    inputSchema: AutoFixErrorWithGroupInputSchema,
    outputSchema: AutoFixErrorWithGroupOutputSchema,
  },
  async (input) => {
    const flowName = 'autoFixErrorWithGroupFlowInternal';
    const { errorMessage, codeContext, userInstructions } = input;
    console.log(`[Flow: ${flowName}] Procesando auto-corrección para el error: "${errorMessage.substring(0, 100)}..."`);

    const softwareDevelopmentTeam = DEFAULT_GROUPS.find(
      (g) => g.id === 'equipo-desarrollo-software'
    );
    const orchestratorAgent = DEFAULT_AGENTS.find(
      (a) => a.id === 'orquestador-flujo-agentes'
    );

    if (!softwareDevelopmentTeam || !orchestratorAgent) {
      const criticalErrorMsg = "El grupo 'EquipoDesarrolloSoftware' o su 'OrquestadorFlujoAgentes' no están definidos por defecto. No se puede proceder con la auto-corrección.";
      console.error(`[Flow: ${flowName}] ${criticalErrorMsg}`);
      // Devolver un output válido según el schema, pero indicando el error
      return {
        suggestedSolution: `Error de configuración: ${criticalErrorMsg}`,
        diagnosticNotes: "La auto-corrección no pudo iniciarse debido a un problema de configuración interna de los agentes/grupos por defecto.",
        initialGroupLog: `[${new Date().toISOString()}] [CRITICAL_ERROR] ${criticalErrorMsg}`,
      };
    }

    const participatingAgents = softwareDevelopmentTeam.agentIds
      .map((id) => DEFAULT_AGENTS.find((a) => a.id === id))
      .filter(Boolean) as Agent[];

    let taskForGroup = `Ha ocurrido el siguiente error en la aplicación CodeAlchemist:
--- ERROR MESSAGE START ---
${errorMessage}
--- ERROR MESSAGE END ---

`;

    if (codeContext) {
      taskForGroup += `Contexto del código o de la operación donde ocurrió el error (o relevante para el mismo):
--- CODE CONTEXT START ---
${codeContext.substring(0, 2000)} ${codeContext.length > 2000 ? '... (truncado)' : ''}
--- CODE CONTEXT END ---\n\n`;
    } else {
      taskForGroup += 'No se proporcionó contexto de código específico.\n\n';
    }

    if (userInstructions) {
      taskForGroup += `Instrucciones o contexto adicional del usuario sobre la tarea que se estaba realizando:
--- USER INSTRUCTIONS START ---
${userInstructions.substring(0, 1000)} ${userInstructions.length > 1000 ? '... (truncado)' : ''}
--- USER INSTRUCTIONS END ---\n\n`;
    } else {
      taskForGroup += 'No se proporcionaron instrucciones adicionales por parte del usuario.\n\n';
    }

    taskForGroup += `Por favor, como "EquipoDesarrolloSoftware", utilizando tus agentes especializados coordinados por el Orquestador:
1.  **Analiza** este error exhaustivamente.
2.  **Diagnostica** la causa raíz más probable. Intenta categorizar el error (ej: problema de input del usuario, error de API externa, bug en el código de CodeAlchemist, limitación del modelo LLM, problema de configuración).
3.  **Propón una solución** detallada en castellano. Esta solución debe ser clara, accionable y, si implica cambios de código, debe incluir los fragmentos de código sugeridos o una descripción precisa de los cambios.
4.  Si la solución no es directa, proporciona **pasos de depuración** que el usuario podría seguir o **preguntas clarificadoras** que ayudarían a diagnosticar mejor el problema.
5.  Incluye cualquier nota de diagnóstico o razonamiento importante.

Tu respuesta (la del Orquestador, resumiendo el trabajo del grupo) debe ser estructurada para que pueda ser presentada al usuario.
Enfócate en proporcionar una "suggestedSolution" (clara y accionable) y "diagnosticNotes" (con el análisis y razonamiento).
No intentes aplicar la corrección directamente; solo sugiérela.`;

    const initialGroupLog = `[${new Date().toISOString()}] [Auto-Fix Invocation]
Error Original Reportado: "${errorMessage.substring(0, 150)}..."
Contexto de Código (inicio): "${codeContext?.substring(0, 100) || 'N/A'}..."
Instrucciones de Usuario (inicio): "${userInstructions?.substring(0, 100) || 'N/A'}..."
Invocando al grupo: ${softwareDevelopmentTeam.name}
Tarea principal del grupo (resumen): ${softwareDevelopmentTeam.mainTask.substring(0, 150)}...
Prompt del Orquestador (resumen): ${orchestratorAgent.systemPrompt.substring(0, 200)}...
Tarea específica enviada al grupo (inicio): "${taskForGroup.substring(0, 250)}..."`;

    console.log(`[Flow: ${flowName}] Tarea específica enviada al grupo (longitud: ${taskForGroup.length}):\n${taskForGroup.substring(0, 500)}...`);

    try {
      // NOTA: callChatWithAIGroup ya tiene su propio manejo de errores y reintentos.
      // El AppError que lance será capturado por el catch del exportado autoFixErrorWithGroup.
      const groupResponse = await callChatWithAIGroup({
        userMessage: taskForGroup,
        groupMainTask: softwareDevelopmentTeam.mainTask,
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

      let suggestedSolution = `Respuesta del grupo 'EquipoDesarrolloSoftware' (a través del Orquestador):\n${groupResponse.orchestratorResponse}`;
      let diagnosticNotes = "El grupo ha proporcionado una respuesta. Revisa la solución sugerida.";

      // Intentar parsear la respuesta del orquestador si se espera que sea un JSON estructurado
      // (basado en el prompt del orquestador) que contenga 'suggestedSolution' y 'diagnosticNotes'.
      // Por ahora, el prompt del orquestador es genérico, así que tomamos su respuesta textual.
      // Si el orquestador estuviera instruido para devolver un JSON específico para Auto-Fix, lo parsearíamos aquí.
      // Ejemplo:
      // try {
      //   const parsedOrchestratorResponse = JSON.parse(groupResponse.orchestratorResponse);
      //   if (parsedOrchestratorResponse.suggestedSolution && parsedOrchestratorResponse.diagnosticNotes) {
      //     suggestedSolution = parsedOrchestratorResponse.suggestedSolution;
      //     diagnosticNotes = parsedOrchestratorResponse.diagnosticNotes;
      //   }
      // } catch (e) {
      //   console.warn(`[Flow: ${flowName}] La respuesta del orquestador para Auto-Fix no era JSON o no tenía el formato esperado. Usando respuesta textual.`);
      // }

      return {
        suggestedSolution,
        diagnosticNotes,
        initialGroupLog,
      };
    } catch (error: any) { // Captura errores de callChatWithAIGroup
      console.error(`[Flow: ${flowName}] Error llamando a callChatWithAIGroup para auto-corrección:`, error);
      const errorMsg = error instanceof AppError ? error.friendlyMessage : (error instanceof Error ? error.message : String(error));
      return {
        suggestedSolution: `Error al intentar obtener una sugerencia de auto-corrección del grupo 'EquipoDesarrolloSoftware': ${errorMsg}`,
        diagnosticNotes: "El grupo de IA no pudo procesar la solicitud de auto-corrección. Revisa los logs del servidor para más detalles. Error original: " + (error.originalError?.message || errorMsg),
        initialGroupLog: `${initialGroupLog}\n[${new Date().toISOString()}] [ERROR] Falló la interacción con el grupo: ${errorMsg}`,
      };
    }
  }
);
