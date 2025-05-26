
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

// Local Zod schemas for this flow
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /. Es OBLIGATORIO.'
    ),
  content: z
    .string()
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas. Es OBLIGATORIO.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});
type GeneratedFileInternal = z.infer<typeof GeneratedFileSchemaInternal>;

const ChatMessageSchemaInternal = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string()
    .describe(
      'Un nombre para el proyecto. DEBE estar presente. Generalmente el mismo que el proyecto actual, a menos que se pida cambiarlo.'
    ),
  aiNotes: z
    .string()
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. DEBE estar presente.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal)
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. DEBE estar presente (puede ser un array vacío [] si se eliminan todos los archivos).'
    ),
  groupLog: z
    .string()
    .optional()
    .describe('Log de ejecución si la modificación fue coordinada por un grupo.'),
});

const ModifyProjectStructureInputSchemaInternal = z.object({
  currentProject: z.object({ // Simplified for the prompt, full schema is ProjectGenerationResultSchemaForFlowInternal
      projectName: z.string(),
      aiNotes: z.string(),
      files: z.array(GeneratedFileSchemaInternal)
  }).describe(
    'El objeto ProjectGenerationResult actual, representando el estado actual del proyecto.'
  ),
  modificationRequest: z
    .string()
    .describe(
      'La petición del usuario en lenguaje natural sobre cómo modificar el proyecto.'
    ),
  chatHistory: z
    .array(ChatMessageSchemaInternal)
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
  currentProjectFilesString: z.string().optional().describe('La estructura de archivos actual del proyecto como una cadena JSON.'),
});
export type ModifyProjectStructureInternalInput = z.infer<typeof ModifyProjectStructureInputSchemaInternal>;


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
  // Cast to internal Zod type for flow processing
  return modifyProjectStructureFlowGenkit(
    input as unknown as ModifyProjectStructureInternalInput
  );
}

const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchemaInternal },
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto. Tu respuesta DEBE ser un único objeto JSON que se adhiera al schema ProjectGenerationResultSchemaForFlowInternal (ver abajo).
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas) basándote en la petición del usuario. Tu respuesta DEBE ser un único objeto JSON que se adhiera al schema ProjectGenerationResultSchemaForFlowInternal (ver abajo).
{{/if}}

Estructura Actual del Proyecto (Nombre: "{{currentProject.projectName}}", Notas Actuales de IA: "{{currentProject.aiNotes}}", Lista de Archivos JSON):
\`\`\`json
{{{currentProjectFilesString}}}
\`\`\`
{{#if chatHistory.length}}
Historial de Conversación de Modificación Previa:
{{#each chatHistory}}
- Rol: {{this.role}}, Contenido: {{this.content}}
{{/each}}
{{/if}}

Petición de Modificación del Usuario:
"{{{modificationRequest}}}"

Instrucciones Detalladas para tu respuesta JSON (Schema: ProjectGenerationResultSchemaForFlowInternal):
1.  **`projectName` (string, OBLIGATORIO):** El nombre del proyecto. Generalmente debe mantenerse igual al de 'currentProject.projectName', a menos que la petición de modificación lo cambie explícitamente. ¡NO OMITIR ESTE CAMPO!
2.  **`aiNotes` (string, OBLIGATORIO):** Comentarios o notas de la IA sobre los cambios realizados, cualquier problema encontrado durante la modificación, o sugerencias adicionales. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). ¡NO OMITIR ESTE CAMPO!
3.  **`files` (array de objetos GeneratedFile, OBLIGATORIO):** Una lista de TODOS los archivos y carpetas que representan la estructura COMPLETA del proyecto DESPUÉS de la modificación. ¡NO OMITIR ESTE CAMPO! Puede ser un array vacío \`[]\` si se eliminan todos los archivos.
    *   Cada objeto `GeneratedFile` DEBE tener:
        *   **`path` (string, OBLIGATORIO):** Ruta relativa del archivo/carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas DEBEN terminar con \`/\`.
        *   **`content` (string, OBLIGATORIO):** Contenido COMPLETO y FUNCIONAL del archivo. Vacío (\`""\`) para carpetas. No uses placeholders en lugar de código real.
        *   **`isFolder` (boolean, opcional):** \`true\` si es una carpeta. Si \`path\` termina en \`/\`, se asume carpeta.
    *   **Acciones de Modificación:**
        *   **Añadir nuevos archivos/carpetas:** Inclúyelos en la lista de 'files' con su 'path' y 'content' completo. Si creas un archivo dentro de una nueva carpeta, asegúrate de que la carpeta también esté declarada.
        *   **Modificar archivos existentes:** Actualiza el 'content' del archivo correspondiente en la lista.
        *   **Eliminar archivos/carpetas:** Simplemente omite el archivo/carpeta de la nueva lista de 'files'.
    *   **IMPORTANTE: Mantén todos los archivos no afectados por la petición del usuario exactamente sin cambios en la nueva lista de 'files'.**
4.  **`groupLog` (string, opcional):** Si esta modificación es parte de una ejecución de grupo, este campo puede contener logs. Generalmente, no necesitas generarlo tú mismo a menos que estés actuando como orquestador principal.

Toda la salida (nombres de archivo, contenido, notas) debe estar en castellano.
Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido y completo que se adhiera a esta estructura. No incluyas ningún otro texto explicativo fuera del objeto JSON.
`,
});

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (input: ModifyProjectStructureInternalInput): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    let originalErrorForAppError: any = null;

    try {
      const currentProjectFilesString = JSON.stringify(input.currentProject.files, null, 2);
      const promptInput = {
        ...input,
        currentProjectFilesString: currentProjectFilesString,
      };

      console.log(`[Flow: ${flowName}] Input para el prompt (truncado):`, {
        ...promptInput,
        currentProjectFilesString: currentProjectFilesString.substring(0, 200) + (currentProjectFilesString.length > 200 ? '...' : ''),
        agentSystemPrompt: input.agentSystemPrompt ? input.agentSystemPrompt.substring(0,100) + '...' : undefined
      });

      const llmResponse = await prompt(promptInput);
      const output = llmResponse.output;
      
      console.log(`[Flow: ${flowName}] LLM output recibido (antes de validaciones internas):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + '...');

      if (!output) {
        originalErrorForAppError = { message: 'No output from LLM', llmUsage: llmResponse.usage };
        console.error(`[Flow: ${flowName}] ${originalErrorForAppError.message}. Usage:`, originalErrorForAppError.llmUsage);
        throw new AppError(
            `La IA no pudo modificar la estructura del proyecto (sin salida). ${llmResponse.usage?.promptInvalid ? 'Detalles de validación de schema de Genkit: ' + JSON.stringify(llmResponse.usage.promptInvalid) : ''}`.trim(),
            originalErrorForAppError,
            'ai'
        );
      }

      // Ensure required fields are present, even if schema validation from Genkit passes (which it should if output is not null)
      // Genkit's schema validation is the primary guard. These are fallbacks or for more specific error messages.
      const validatedOutput: ProjectGenerationResult = {
        projectName: output.projectName || input.currentProject.projectName || "proyecto-modificado",
        aiNotes: output.aiNotes || "Modificación procesada. Revisa los archivos.",
        files: (output.files && Array.isArray(output.files)) ? output.files.map((file: any) => ({ // Cast file to any temporarily
          path: file.path || 'ruta/desconocida/error.txt',
          content: typeof file.content === 'string' ? file.content : '',
          isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : (file.path || '').endsWith('/'),
        })) : [],
        groupLog: output.groupLog,
      };
      
      if (!output.projectName) {
        validatedOutput.aiNotes = `[ADVERTENCIA: La IA no proporcionó 'projectName'. Usando por defecto.] ${validatedOutput.aiNotes}`;
        console.warn(`[Flow: ${flowName}] La IA no proporcionó 'projectName'.`);
      }
      if (!output.files || !Array.isArray(output.files)) {
         validatedOutput.aiNotes = `[ADVERTENCIA: La IA no proporcionó una lista 'files' válida. Se devolvió una lista vacía.] ${validatedOutput.aiNotes}`;
         console.warn(`[Flow: ${flowName}] La IA no proporcionó una lista 'files' válida.`);
      }
      
      console.log(`[Flow: ${flowName}] Output validado/normalizado:`, JSON.stringify(validatedOutput, null, 2)?.substring(0, 500) + '...');
      return validatedOutput as ProjectGenerationResult;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Detalles del error no disponibles';
      const schemaValidationError = error?.originalError?.llmUsage?.promptInvalid || error?.llmUsage?.promptInvalid;

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
        throw error;
      }

      let detailsForUser = originalErrorMessage;
      if (schemaValidationError) {
        detailsForUser = `INVALID_ARGUMENT: Schema validation failed. Parse Errors: ${JSON.stringify(schemaValidationError)}`;
      }
      detailsForUser = detailsForUser.substring(0, 150) + (detailsForUser.length > 150 ? '...' : '');

      throw new AppError(
        `FALLO_EN_FLUJO_MODIFY_PROJECT: ${detailsForUser}`,
        error, 
        'ai'
      );
    }
  }
);

    