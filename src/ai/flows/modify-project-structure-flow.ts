
'use server';
/**
 * @fileOverview Flow for modifying an existing project structure based on user request.
 *
 * - modifyProjectStructure - A function that handles project structure modification.
 * - ModifyProjectStructureInput - The input type for the function.
 * - ProjectGenerationResult - The return type (reused from project generation).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  ModifyProjectStructureInput as ModifyInputType, // Renamed to avoid conflict with Zod schema
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes, // Renamed to avoid conflict
  ChatMessage as ChatMessageTypeFromTypes, // Renamed to avoid conflict
} from '@/types';
import { AppError } from '@/utils/AppError';

// Local Zod schemas for this flow to avoid potential circular dependencies with types.ts
// if types.ts were to import from flows. These are simplified versions.
const GeneratedFileSchema = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});
type GeneratedFileInternal = z.infer<typeof GeneratedFileSchema>;

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const ProjectGenerationResultSchemaForFlow = z.object({
  projectName: z
    .string()
    .describe(
      'Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'
    ),
  aiNotes: z
    .string()
    .describe(
      'Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar.'
    ),
  files: z
    .array(GeneratedFileSchema)
    .describe(
      'Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'
    ),
  groupLog: z
    .string()
    .optional()
    .describe('Log de ejecución si la generación fue coordinada por un grupo.'),
});

const ModifyProjectStructureInputSchema = z.object({
  currentProject: ProjectGenerationResultSchemaForFlow.describe(
    'El objeto ProjectGenerationResult actual, representando el estado actual del proyecto.'
  ),
  modificationRequest: z
    .string()
    .describe(
      'La petición del usuario en lenguaje natural sobre cómo modificar el proyecto.'
    ),
  chatHistory: z
    .array(ChatMessageSchema)
    .optional()
    .describe(
      'Historial de la conversación de modificación, si existe.'
    ),
  agentSystemPrompt: z
    .string()
    .optional()
    .describe(
      'El prompt de sistema de un agente, si la modificación es impulsada por un agente específico o un contexto de grupo.'
    ),
});
export type ModifyProjectStructureInternalInput = z.infer<typeof ModifyProjectStructureInputSchema>;


/**
 * Orchestrates the modification of an existing project structure based on user requests.
 * This function serves as the main entry point for the Genkit flow.
 * @param {ModifyInputType} input - The input containing the current project structure,
 *                                  the user's modification request, chat history, and optional agent context.
 * @returns {Promise<ProjectGenerationResult>} A promise that resolves to the modified project structure.
 * @throws {AppError} If the modification process fails at any stage.
 */
export async function modifyProjectStructure(
  input: ModifyInputType
): Promise<ProjectGenerationResult> {
  // Cast to internal Zod type for flow processing, if ModifyInputType from @/types is different
  // This assumes ModifyInputType is compatible or identical to ModifyProjectStructureInternalInput
  return modifyProjectStructureFlowGenkit(
    input as ModifyProjectStructureInternalInput
  );
}

const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchema },
  output: { schema: ProjectGenerationResultSchemaForFlow },
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto. Tu respuesta DEBE ser un único objeto JSON que se adhiera al schema especificado.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas) basándote en la petición del usuario. Tu respuesta DEBE ser un único objeto JSON que se adhiera al schema especificado.
{{/if}}

Estructura Actual del Proyecto (Nombre: "{{currentProject.projectName}}", Notas Actuales: "{{currentProject.aiNotes}}", Lista de Archivos JSON):
\`\`\`json
{{{JSONstringify currentProject.files}}}
\`\`\`
{{#if chatHistory.length}}
Historial de Conversación de Modificación Previa:
{{#each chatHistory}}
- Rol: {{this.role}}, Contenido: {{this.content}}
{{/each}}
{{/if}}

Petición de Modificación del Usuario:
"{{{modificationRequest}}}"

Instrucciones Detalladas:
1.  Analiza cuidadosamente la estructura actual del proyecto y la petición de modificación.
2.  Aplica los cambios solicitados a la lista de archivos. Esto puede implicar:
    *   **Añadir nuevos archivos/carpetas:** Especifica su 'path' y 'content' completo y funcional. Si creas un archivo dentro de una nueva carpeta, asegúrate de que la carpeta también esté declarada explícitamente con 'isFolder: true' y 'content: ""' o sin la propiedad 'content'. Las rutas de carpeta DEBEN terminar con '/'. El 'content' debe ser el código completo y funcional.
    *   **Modificar archivos existentes:** Actualiza el 'content' del archivo correspondiente en la lista. Asegúrate de que el contenido sea completo y funcional.
    *   **Eliminar archivos/carpetas:** Omite el archivo/carpeta de la nueva lista de 'files'.
3.  **IMPORTANTE: Mantén todos los archivos no afectados por la petición del usuario exactamente sin cambios en la nueva lista de 'files'.**
4.  El 'projectName' generalmente debe mantenerse igual al de 'currentProject.projectName', a menos que la petición de modificación lo cambie explícitamente.
5.  Actualiza el campo 'aiNotes' para describir los cambios realizados, cualquier problema encontrado durante la modificación, o sugerencias adicionales. Si la petición del usuario es ambigua, irrealizable o incompleta, explícalo claramente en 'aiNotes' y devuelve la estructura del proyecto SIN cambios significativos en 'files' pero actualizando 'aiNotes'.
6.  Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al schema de salida especificado (ProjectGenerationResultSchemaForFlow), incluyendo 'projectName', 'aiNotes', y la nueva lista completa de 'files'.
7.  Toda la salida (nombres de archivo, contenido, notas) debe estar en castellano.

Ejemplo de un objeto 'file' para una carpeta: \`{ "path": "src/", "content": "", "isFolder": true }\`
Ejemplo de un objeto 'file' para un archivo: \`{ "path": "src/index.js", "content": "console.log(\\"Hola Mundo\\");" }\`
Asegúrate de que el JSON de salida sea válido y completo.
`,
  helpers: {
    JSONstringify: (context: any) => {
      // Basic stringify, consider more robust or size-limited version if needed
      return JSON.stringify(context, null, 2);
    },
  },
});

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchema,
    outputSchema: ProjectGenerationResultSchemaForFlow,
  },
  async (input) => {
    const flowName = 'modifyProjectStructureFlow';
    try {
      const llmResponse = await prompt(input);
      const output = llmResponse.output;
      console.log(`[Flow: ${flowName}] LLM output recibido (truncado):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + '...');

      if (!output) {
        console.error(`[Flow: ${flowName}] No output from LLM.`);
        throw new AppError(
          'La IA no pudo modificar la estructura del proyecto (sin output).',
          { originalError: 'No output from LLM', inputReceived: input },
          'ai'
        );
      }
      if (!output.files || !Array.isArray(output.files)) {
        console.error(`[Flow: ${flowName}] Output.files no es un array o está indefinido. Output:`, output);
        throw new AppError(
            'La IA devolvió una estructura de archivos inválida.',
            { originalError: 'Output.files is not an array or is undefined', llmOutput: output },
            'ai'
        );
      }

      const processedFiles = output.files.map((file: GeneratedFileInternal) => ({
        path: file.path || 'ruta/desconocida/por/defecto',
        content: file.content ?? '',
        isFolder: file.isFolder ?? file.path?.endsWith('/') ?? false,
      }));

      return { ...output, files: processedFiles as GeneratedFileTypeFromTypes[] };
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

      if (error instanceof AppError) {
        // If Genkit or a sub-call already threw an AppError, re-throw it to preserve its specific message/type
        console.warn(`[Flow: ${flowName}] Error capturado ya era AppError, re-lanzando.`);
        throw error;
      }

      // If it's not an AppError, wrap it.
      const originalErrorMessage = error?.message ? String(error.message) : 'Detalles del error no disponibles';
      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

      throw new AppError(
        `FALLO_EN_FLUJO_MODIFY_PROJECT: ${detailsForUser}`, // Distinct message
        error, // originalError
        'ai'
      );
    }
  }
);
