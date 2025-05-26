
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
  ModifyProjectStructureInput as ModifyInputTypeFromTypes, // Renamed to avoid conflict
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes, // Renamed to avoid conflict
  ChatMessage as ChatMessageTypeFromTypes, // Renamed to avoid conflict
} from '@/types';
import { AppError } from '@/utils/AppError';

// Local Zod schemas for this flow for clarity and to avoid import complexities if types.ts also imports from flows
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string({ required_error: "Cada archivo DEBE tener una propiedad 'path'."})
    .min(1, { message: "La propiedad 'path' de un archivo no puede estar vacía." })
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /. Es OBLIGATORIO.'
    ),
  content: z
    .string({ required_error: "Cada archivo DEBE tener una propiedad 'content' (puede ser string vacío para carpetas o si no hay contenido específico)." })
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío "" para carpetas o si no hay contenido específico. Es OBLIGATORIO.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta. Si path termina en /, se infiere true.'),
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
    .string({ required_error: "La propiedad 'projectName' es OBLIGATORIA y no puede ser una cadena vacía." })
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía." })
    .describe(
      'El nombre del proyecto. DEBE estar presente. Generalmente el mismo que el proyecto actual, a menos que se pida cambiarlo. ¡NO OMITIR ESTE CAMPO!'
    ),
  aiNotes: z
    .string({ required_error: "La propiedad 'aiNotes' es OBLIGATORIA." })
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. DEBE estar presente. ¡NO OMITIR ESTE CAMPO!'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { required_error: "La propiedad 'files' es OBLIGATORIA y debe ser un array (puede ser vacío [])." })
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. DEBE estar presente (puede ser un array vacío [] si se eliminan todos los archivos). ¡NO OMITIR ESTE CAMPO!'
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
      files: z.array(GeneratedFileSchemaInternal) // Uses internal schema
  }).describe(
    'El objeto ProjectGenerationResult actual, representando el estado actual del proyecto.'
  ),
  modificationRequest: z
    .string()
    .describe(
      'La petición del usuario en lenguaje natural sobre cómo modificar el proyecto.'
    ),
  chatHistory: z
    .array(ChatMessageSchemaInternal) // Uses internal schema
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

const systemPromptInstructions = `
**Instrucciones CRÍTICAS para tu respuesta JSON:**
Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al siguiente schema.
**ES ABSOLUTAMENTE IMPERATIVO que incluyas TODAS las siguientes propiedades OBLIGATORIAS en tu respuesta JSON: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array). LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS INVALIDARÁ TODA TU RESPUESTA.**

Schema de Salida Detallado (ProjectGenerationResultSchemaForFlowInternal):
\\\`\\\`\\\`json
{
  "projectName": "string (OBLIGATORIO, no vacío)",
  "aiNotes": "string (OBLIGATORIO, puede ser breve pero no omitida)",
  "files": [ // Array de objetos GeneratedFile, OBLIGATORIO. Puede ser vacío [].
    {
      "path": "string (OBLIGATORIO, ej: src/components/Button.tsx. Las carpetas DEBEN terminar con /)",
      "content": "string (OBLIGATORIO, contenido completo del archivo. Vacío \\"\\" para carpetas o si no hay contenido.)",
      "isFolder": "boolean (opcional, se infiere de path si termina en /)"
    }
  ],
  "groupLog": "string (opcional)"
}
\\\`\\\`\\\`

Instrucciones Adicionales para el JSON y la Lógica de Modificación:
1.  **\\\`projectName\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'currentProject.projectName'. Si por alguna razón no puedes determinarlo o es una creación nueva, usa un valor como 'nombre-proyecto-modificado' o el sugerido por la petición. Si la IA no proporciona un nombre, se utilizará el nombre del proyecto original como fallback. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\\\`aiNotes\\\` (string, OBLIGATORIO):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO):** Lista COMPLETA del proyecto DESPUÉS de la modificación. Si no hay cambios, devuelve la lista de archivos original que se te proporcionó. Si se eliminan todos los archivos, devuelve un array vacío \\\`[]\\\`. ¡NO OMITIR ESTE CAMPO!
    *   Cada objeto \\\`GeneratedFile\\\` DENTRO del array \\\`files\\\` DEBE tener las propiedades \\\`path\\\` (string) y \\\`content\\\` (string). \\\`isFolder\\\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \\\`files\\\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \\\`path\\\` existente y el nuevo \\\`content\\\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \\\`files\\\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \\\`files\\\` exactamente como estaban, con su \\\`path\\\` y \\\`content\\\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \\\`src/utils/newFile.js\\\` y \\\`src/utils/\\\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \\\`GeneratedFile\\\` con \\\`isFolder: true\\\` y su \\\`path\\\` terminando en \\\`/\` (ej. \\\`{ "path": "src/utils/", "content": "", "isFolder": true }\\\`).

Toda la salida debe estar en castellano.
**REPITO: Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido y completo con \`projectName\`, \`aiNotes\`, y \`files\` presentes.**
`;

const mainPromptTemplate = `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas, con su contenido) basándote en la petición del usuario.
{{/if}}

Estructura Actual del Proyecto (nombre y lista de archivos en formato JSON):
Nombre del Proyecto Actual: "{{currentProject.projectName}}"
Notas Actuales de IA sobre el proyecto: "{{currentProject.aiNotes}}"
Lista de Archivos Actuales (JSON):
\\\`\\\`\\\`json
{{{currentProjectFilesString}}}
\\\`\\\`\\\`
{{#if chatHistory.length}}
Historial de Conversación de Modificación Previa (el último mensaje es el más reciente):
{{#each chatHistory}}
- Rol: {{this.role}}, Contenido: "{{this.content}}"
{{/each}}
{{/if}}

Petición de Modificación del Usuario (esta es la tarea principal que debes realizar sobre la estructura actual):
"{{{modificationRequest}}}"

${systemPromptInstructions}
`;

const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchemaInternal },
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
  prompt: mainPromptTemplate,
});

/**
 * Orchestrates the modification of an existing project structure based on user requests.
 * @param {ModifyInputTypeFromTypes} input - The input containing the current project structure, modification request, etc.
 * @returns {Promise<ProjectGenerationResult>} A promise that resolves to the modified project structure.
 * @throws {AppError} If the modification process fails.
 */
export async function modifyProjectStructure(
  input: ModifyInputTypeFromTypes // Type from types.ts for external interface
): Promise<ProjectGenerationResult> { // Type from types.ts for external interface
  return modifyProjectStructureFlowGenkit(
    input as ModifyProjectStructureInternalInput // Cast to internal Zod schema type for flow
  );
}

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (flowInput: ModifyProjectStructureInternalInput): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let schemaValidationErrorMsg = "";
    let errorDetailsForAppError: any = {};

    try {
      const currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);
      
      const promptInputForHandlebars: ModifyProjectStructureInternalInput = {
        ...flowInput,
        currentProjectFilesString: currentProjectFilesString,
      };

      const agentSystemPromptLength = flowInput.agentSystemPrompt?.length || 0;
      const modificationRequestLength = flowInput.modificationRequest.length;
      const chatHistoryLength = (flowInput.chatHistory || []).length;

      console.log(`[Flow: ${flowName}] Preparando para llamar al LLM. Longitudes de entrada: agentSystemPrompt=${agentSystemPromptLength}, currentProjectFilesString=${currentProjectFilesString.length}, modificationRequest=${modificationRequestLength}, chatHistoryEntries=${chatHistoryLength}`);
      console.log(`[Flow: ${flowName}] Prompt del proyecto actual (primeros 500 chars): ${currentProjectFilesString.substring(0,500)}...`);
      console.log(`[Flow: ${flowName}] Petición de modificación: ${flowInput.modificationRequest}`);
      if (flowInput.agentSystemPrompt) {
        console.log(`[Flow: ${flowName}] Usando agentSystemPrompt (primeros 300 chars): ${flowInput.agentSystemPrompt.substring(0,300)}...`);
      }


      const llmResponse = await prompt(promptInputForHandlebars);
      const output = llmResponse.output;

      console.log(`[Flow: ${flowName}] LLM output recibido (ya parseado por Genkit o null/undefined si falló el parseo). Output (primeros 1000 chars):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + (JSON.stringify(output, null, 2).length > 1000 ? '...' : ''));

      if (!output) { // Significa que el LLM no devolvió JSON válido según el schema, o Genkit no pudo parsearlo
        let genkitValidationError = "La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).";
        if (llmResponse.usage?.promptInvalid) {
            try {
                const validationDetails = JSON.stringify(llmResponse.usage.promptInvalid);
                genkitValidationError += ` Detalles de validación de schema de Genkit: ${validationDetails.substring(0, 500)}${validationDetails.length > 500 ? '...' : ''}`;
            } catch {
                genkitValidationError += ` Detalles de validación de schema de Genkit no pudieron ser serializados.`;
            }
        }
        console.error(`[Flow: ${flowName}] ${genkitValidationError}`, llmResponse.usage);
        errorDetailsForAppError = { llmUsage: llmResponse.usage, inputToPrompt: { modificationRequest: flowInput.modificationRequest, agentSystemPromptLength }, genkitValidationError };
        throw new AppError(
            genkitValidationError,
            errorDetailsForAppError,
            'ai'
        );
      }

      // Fallbacks agresivos para campos requeridos si el LLM los omite
      let finalProjectName = flowInput.currentProject.projectName;
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA CRÍTICA]: La IA no proporcionó un 'projectName' válido o lo omitió. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Esto es un fallo del LLM en seguir el schema. Respuesta de IA para projectName: '${output.projectName === undefined ? "undefined" : String(output.projectName) }'.`;
      }

      let finalAiNotes = accumulatedAiNotes; 
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes += (finalAiNotes ? "\n---\nNotas de la IA sobre la modificación:\n" : "") + output.aiNotes;
      } else {
        finalAiNotes += (finalAiNotes ? "\n" : "") + "[ADVERTENCIA IA]: La IA no proporcionó 'aiNotes' válidas o no era un string. Se utilizó un mensaje por defecto o las notas acumuladas.";
        if(output.aiNotes !== undefined) finalAiNotes += ` Valor recibido para aiNotes: '${String(output.aiNotes)}'`;
      }

      let finalFiles: GeneratedFileTypeFromTypes[] = [];
      if (output.files && Array.isArray(output.files)) {
        finalFiles = output.files.map((file: Partial<GeneratedFileInternal>, index: number) => {
          let filePath = file.path;
          let fileContent = file.content;
          let pathCorrected = false;
          let contentCorrected = false;

          if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
            pathCorrected = true;
          }
          if (typeof fileContent !== 'string') {
            fileContent = `// Contenido no proporcionado o inválido por la IA para ${filePath}`;
            contentCorrected = true;
          }
          if (pathCorrected || contentCorrected) {
            finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${index + 1}]: Problema con el archivo. ${pathCorrected ? `Ruta original de IA: '${String(file.path)}', usada: '${filePath}'.` : ''} ${contentCorrected ? `Contenido original de IA: '${String(file.content)}', se usó placeholder.` : ''}`;
          }
          return {
            path: filePath.trim(),
            content: fileContent,
            isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
          };
        }) as GeneratedFileTypeFromTypes[];
      } else {
        finalAiNotes += "\n[ADVERTENCIA IA CRÍTICA]: La IA no proporcionó un array 'files' válido. Se ha devuelto una lista de archivos vacía. Esto es un fallo del LLM en seguir el schema.";
        finalFiles = []; // Fallback a array vacío
      }

      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: finalFiles,
        groupLog: output.groupLog,
      };

      console.log(`[Flow: ${flowName}] Output construido antes de Zod.parse final. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);

      // Validar explícitamente contra el Zod schema ANTES de retornar.
      ProjectGenerationResultSchemaForFlowInternal.parse(validatedOutput);

      console.log(`[Flow: ${flowName}] Output validado final con Zod exitoso.`);
      return validatedOutput;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      
      errorDetailsForAppError = {
        ...(errorDetailsForAppError.llmUsage ? { llmUsage: errorDetailsForAppError.llmUsage } : {}), // Preserve if set
        originalFlowError: { message: error.message, name: error.name, stack: error.stack?.substring(0, 500) + "..." },
        details: error.details,
        cause: error.cause,
      };

      if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg = ` Error de validación Zod (local o de Genkit): ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg = ` Error de validación Zod (local o de Genkit) no pudo ser serializado. Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
      } else if (errorDetailsForAppError.genkitValidationError) { 
         schemaValidationErrorMsg = ` ${errorDetailsForAppError.genkitValidationError}`;
      }

      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo principal:`, error);
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);

      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

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
