
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
  ModifyProjectStructureInput as ModifyInputTypeFromTypes,
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes,
  ChatMessage as ChatMessageTypeFromTypes,
} from '@/types';
import { AppError } from '@/utils/AppError';

// Local Zod schemas for this flow
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string({ required_error: "Cada archivo DEBE tener una propiedad 'path'."})
    .min(1, "La propiedad 'path' de un archivo no puede estar vacía.")
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /. Es OBLIGATORIO.'
    ),
  content: z
    .string({ required_error: "Cada archivo DEBE tener una propiedad 'content' (puede ser string vacío para carpetas)." })
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

// Schema for the output expected from the LLM for this specific flow.
const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string({ required_error: "La propiedad 'projectName' es OBLIGATORIA y no puede estar vacía." })
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía." })
    .describe(
      'El nombre del proyecto. DEBE estar presente. Generalmente el mismo que el proyecto actual, a menos que se pida cambiarlo. NO OMITIR.'
    ),
  aiNotes: z
    .string({ required_error: "La propiedad 'aiNotes' es OBLIGATORIA." })
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. DEBE estar presente. NO OMITIR.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { required_error: "La propiedad 'files' es OBLIGATORIA y debe ser un array." })
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. DEBE estar presente (puede ser un array vacío [] si se eliminan todos los archivos). NO OMITIR.'
    ),
  groupLog: z
    .string()
    .optional()
    .describe('Log de ejecución si la modificación fue coordinada por un grupo.'),
});

const ModifyProjectStructureInputSchemaInternal = z.object({
  currentProject: z.object({
      projectName: z.string(),
      aiNotes: z.string().optional(),
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
  currentProjectFilesString: z.string().optional().describe('La estructura de archivos actual del proyecto como una cadena JSON (para el prompt).'),
});
export type ModifyProjectStructureInternalInput = z.infer<typeof ModifyProjectStructureInputSchemaInternal>;

/**
 * Orchestrates the modification of an existing project structure based on user requests.
 * @param {ModifyInputTypeFromTypes} input - The input containing the current project structure, etc.
 * @returns {Promise<ProjectGenerationResult>} A promise that resolves to the modified project structure.
 * @throws {AppError} If the modification process fails.
 */
export async function modifyProjectStructure(
  input: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  return modifyProjectStructureFlowGenkit(
    input as ModifyProjectStructureInternalInput
  );
}

const systemPromptInstructions = `
**Instrucciones CRÍTICAS para tu respuesta JSON:**
Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al siguiente schema.
**ES ABSOLUTAMENTE IMPERATIVO que incluyas TODAS las siguientes propiedades OBLIGATORIAS en tu respuesta JSON: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).**
-   Si no hay cambios para \`projectName\`, devuelve el valor actual del proyecto. NO LO OMITAS.
-   Si no hay notas nuevas para \`aiNotes\`, incluye un mensaje como "Modificación procesada según lo solicitado." o las notas previas si son relevantes. NO LO OMITAS.
-   Si no hay archivos o se eliminan todos, \`files\` DEBE ser un array vacío \`[]\`. NO OMITAS la clave \`files\`.

Schema de Salida Detallado (ProjectGenerationResultSchemaForFlowInternal):
\`\`\`json
{
  "projectName": "string (OBLIGATORIO, no vacío)",
  "aiNotes": "string (OBLIGATORIO, puede ser breve pero no omitida)",
  "files": [
    { 
      "path": "string (OBLIGATORIO, ej: src/components/Button.tsx. Las carpetas DEBEN terminar con /)", 
      "content": "string (OBLIGATORIO, contenido completo del archivo. Vacío \"\" para carpetas.)", 
      "isFolder": "boolean (opcional)" 
    }
  ],
  "groupLog": "string (opcional)"
}
\`\`\`

Instrucciones Adicionales para el JSON:
1.  **\\\`projectName\\\` (OBLIGATORIO):** Mantén el nombre del proyecto actual a menos que la petición de modificación indique explícitamente cambiarlo. No omitir.
2.  **\\\`aiNotes\\\` (OBLIGATORIO):** Comentarios sobre los cambios realizados. Si la petición es ambigua, explícalo aquí y devuelve la estructura de archivos original sin cambios (pero \`files\` aún debe ser un array, posiblemente el original, y \`aiNotes\` debe explicar la situación). No omitir.
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO):** Lista COMPLETA del proyecto DESPUÉS de la modificación. Si no hay cambios, devuelve la lista de archivos original. Si se eliminan todos, devuelve \`[]\`.
    *   Cada objeto \`GeneratedFile\` DEBE tener \`path\` (string) y \`content\` (string).
    *   Asegúrate de que todos los archivos no afectados por la petición del usuario se incluyan exactamente sin cambios.

Toda la salida debe estar en castellano.
**REPITO: Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido y completo con \`projectName\`, \`aiNotes\`, y \`files\` presentes.**
`;

const mainPromptTemplate = `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas) basándote en la petición del usuario.
{{/if}}

Estructura Actual del Proyecto:
Nombre: "{{currentProject.projectName}}"
Notas Actuales de IA: "{{currentProject.aiNotes}}"
Lista de Archivos (JSON):
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
${systemPromptInstructions}
`;

const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchemaInternal },
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
  prompt: mainPromptTemplate,
});

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (input: ModifyProjectStructureInternalInput): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    console.log(`[Flow: ${flowName}] Iniciando flujo. Petición (inicio): ${input.modificationRequest.substring(0,100)}...`);
    
    try {
      const currentProjectFilesString = JSON.stringify(input.currentProject.files || [], null, 2);
      const promptInputForHandlebars = { 
        agentSystemPrompt: input.agentSystemPrompt,
        currentProject: {
            projectName: input.currentProject.projectName,
            aiNotes: input.currentProject.aiNotes || "Sin notas previas.",
        },
        currentProjectFilesString: currentProjectFilesString,
        chatHistory: input.chatHistory,
        modificationRequest: input.modificationRequest,
      };
      
      // Loguear componentes clave del input. Para el prompt completo, se necesitaría renderizar Handlebars.
      console.log(`[Flow: ${flowName}] Input para la plantilla Handlebars (componentes clave):`, {
        agentSystemPromptProvided: !!promptInputForHandlebars.agentSystemPrompt,
        currentProjectName: promptInputForHandlebars.currentProject.projectName,
        currentProjectFilesStringLength: promptInputForHandlebars.currentProjectFilesString.length,
        modificationRequest: promptInputForHandlebars.modificationRequest,
      });

      const llmResponse = await prompt(promptInputForHandlebars);
      const output = llmResponse.output; 
      
      console.log(`[Flow: ${flowName}] LLM output recibido (ya parseado por Genkit o null/undefined si falló el parseo):`, JSON.stringify(output, null, 2)?.substring(0, 2000) + (JSON.stringify(output, null, 2).length > 2000 ? '...' : ''));

      if (!output) {
        const errorDetail = 'La IA no devolvió ninguna salida (output undefined/null tras parseo de Genkit). Esto usualmente indica que el LLM no generó un JSON válido que cumpla el schema, o un error de red/API no capturado antes.';
        console.error(`[Flow: ${flowName}] ${errorDetail}`, llmResponse.usage);
        let schemaValidationErrorMsg = "";
        if (llmResponse.usage?.promptInvalid) { 
            schemaValidationErrorMsg = ` Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid)}`;
        }
        throw new AppError(
            `${errorDetail}${schemaValidationErrorMsg}`,
            { llmUsage: llmResponse.usage, inputToPrompt: promptInputForHandlebars },
            'ai'
        );
      }
      
      // Construir un objeto ProjectGenerationResult validado con fallbacks
      let accumulatedAiNotes = "";
      const fallbackProjectName = input.currentProject.projectName || `proyecto-modificado-${Date.now()}`;
      const fallbackAiNotes = `[ADVERTENCIA FLUJO] aiNotes no fue proporcionado o no es un string por la IA. Petición original: "${input.modificationRequest.substring(0,50)}..."`;
      const fallbackFiles: GeneratedFileTypeFromTypes[] = (input.currentProject.files || []).map(f => ({...f})) as GeneratedFileTypeFromTypes[]; // Copia de archivos actuales como fallback

      const pName = (typeof output.projectName === 'string' && output.projectName.trim() !== '') 
                    ? output.projectName 
                    : fallbackProjectName;
      if (pName !== output.projectName) {
        accumulatedAiNotes += `[ADVERTENCIA IA: 'projectName' faltaba o estaba vacío. Se usó: '${pName}'. Original de IA: '${output.projectName || 'N/A'}'.]\n`;
      }

      const notes = (typeof output.aiNotes === 'string') 
                    ? output.aiNotes 
                    : fallbackAiNotes;
      if (notes !== output.aiNotes) { // Si usamos el fallback
        accumulatedAiNotes += `[ADVERTENCIA IA: 'aiNotes' faltaba o no era string. Se usó mensaje por defecto.]\n`;
      }
      accumulatedAiNotes += notes;
      
      const filesFromAI = Array.isArray(output.files) ? output.files : null;
      if (filesFromAI === null) {
         accumulatedAiNotes += `[ADVERTENCIA IA: 'files' no era un array o faltaba. Se usará la lista de archivos del proyecto actual como base si no se especifican modificaciones claras, o una lista vacía si la modificación implica eliminar todo.]\n`;
      }

      // Usar los archivos del proyecto actual como base si la IA no devuelve una lista de archivos completa,
      // o si la modificación no implicaba una reescritura total. El prompt le pide a la IA
      // que devuelva la lista completa, incluyendo archivos no modificados.
      const finalFilesList = filesFromAI !== null ? filesFromAI : fallbackFiles;

      const validatedFiles = finalFilesList.map((file: Partial<GeneratedFileTypeFromTypes>, index: number) => {
        const path = typeof file.path === 'string' && file.path.trim() !== '' ? file.path.trim() : `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
        let fileProcessingNote = "";
        if (path !== file.path) {
            fileProcessingNote = `[ADVERTENCIA INTERNA: Archivo ${index + 1}: Ruta inválida/faltante. Original: '${file.path}', Usada: '${path}'.]`;
        }
        if (typeof file.content !== 'string') {
             fileProcessingNote += `${fileProcessingNote ? " " : ""}[Contenido no es string, usando ''.]`;
        }
        if(fileProcessingNote) accumulatedAiNotes += `\n${fileProcessingNote}`;
        return { 
          path: path,
          content: typeof file.content === 'string' ? file.content : '',
          isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : path.endsWith('/'),
        };
      });

      const validatedOutput: ProjectGenerationResult = {
        projectName: pName,
        aiNotes: accumulatedAiNotes.trim(),
        files: validatedFiles as GeneratedFileTypeFromTypes[],
        groupLog: output.groupLog,
      };
      
      console.log(`[Flow: ${flowName}] Output construido antes de Zod.parse final. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}`);
      
      // Validar explícitamente contra el Zod schema ANTES de retornar.
      ProjectGenerationResultSchemaForFlowInternal.parse(validatedOutput); 
      
      console.log(`[Flow: ${flowName}] Output validado final con Zod exitoso.`);
      return validatedOutput;

    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo principal:`, error);
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      
      let originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      const errorDetailsForAppError = {
        message: error.message, name: error.name, stack: error.stack?.substring(0, 500) + "...",
        details: error.details, cause: error.cause, llmUsage: (error as any).llmUsage
      };
      let schemaValidationErrorMsg = "";
      
      const genkitValidationInfo = (error as any).llmUsage?.promptInvalid || (error as any).originalError?.llmUsage?.promptInvalid;
      if (genkitValidationInfo) {
        try { schemaValidationErrorMsg = ` Detalles de validación de schema de Genkit: ${JSON.stringify(genkitValidationInfo)}`; } catch { schemaValidationErrorMsg = " Detalles de validación de schema de Genkit no pudieron ser serializados." }
      }
      if (error.name === 'ZodError' && error.errors) { 
        schemaValidationErrorMsg = ` Error de validación Zod: ${JSON.stringify(error.errors)}`;
        originalErrorMessage = `Error de validación de schema (local o de Genkit): ${error.errors[0]?.message || 'Múltiples errores de schema en la respuesta.'}`;
      }

      const detailsForUser = originalErrorMessage.substring(0, 200) + (originalErrorMessage.length > 200 ? '...' : '');

      if (error instanceof AppError) {
        error.friendlyMessage = `${error.friendlyMessage}${schemaValidationErrorMsg}`;
        error.originalError = { ...(error.originalError || {}), caughtError: errorDetailsForAppError };
        throw error;
      }
      throw new AppError(
        `FALLO_EN_FLUJO_MODIFY_PROJECT: ${detailsForUser}${schemaValidationErrorMsg}`,
        errorDetailsForAppError, 
        'ai'
      );
    }
  }
);

    