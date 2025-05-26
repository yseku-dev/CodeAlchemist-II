
'use server';
/**
 * @fileOverview Flow for modifying an existing project structure based on user request.
 *
 * - modifyProjectStructure - A function that handles project structure modification.
 * - ModifyProjectStructureInput - The input type for the function (defined in types.ts).
 * - ProjectGenerationResult - The return type (defined in types.ts, flow aims to return this structure).
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

// Local Zod schemas for this flow for clarity and to define prompt's expected output structure
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

const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string({ invalid_type_error: "La propiedad 'projectName' debe ser un string." })
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía si se proporciona." })
    .optional() // <<< HECHO OPCIONAL
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. Si la IA no lo proporciona, se usará el original.'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // <<< HECHO OPCIONAL
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. Si la IA no lo proporciona, se usará un mensaje por defecto.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // <<< HECHO OPCIONAL
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. Si la IA no lo proporciona, se usará un array vacío [].'
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
    .array(z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string(),
    }))
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
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.

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
  "groupLog": "string (opcional, generalmente no lo generarás tú directamente)"
}
\\\`\\\`\\\`

Instrucciones Adicionales para el JSON y la Lógica de Modificación:
1.  **\`projectName\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'currentProject.projectName'. Si por alguna razón no puedes determinarlo o es una creación nueva, usa un valor como 'nombre-proyecto-modificado' o el sugerido por la petición. Si la IA no proporciona un nombre, se utilizará el nombre del proyecto original como fallback. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\`aiNotes\` (string, OBLIGATORIO):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\`files\` (array de objetos GeneratedFile, OBLIGATORIO):** Lista COMPLETA del proyecto DESPUÉS de la modificación. Si no hay cambios, devuelve la lista de archivos original que se te proporcionó. Si se eliminan todos los archivos, devuelve un array vacío \`[]\`. ¡NO OMITIR ESTE CAMPO!
    *   Cada objeto \`GeneratedFile\` DENTRO del array \`files\` DEBE tener las propiedades \`path\` (string) y \`content\` (string). \`isFolder\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \`files\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \`path\` existente y el nuevo \`content\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \`files\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \`files\` exactamente como estaban, con su \`path\` y \`content\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \`src/utils/newFile.js\` y \`src/utils/\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \`GeneratedFile\` con \`isFolder: true\` y su \`path\` terminando en \`/\` (ej. \`{ "path": "src/utils/", "content": "", "isFolder": true }\`).

Toda la salida debe estar en castellano.
**REPITO: Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido y completo con \`projectName\`, \`aiNotes\`, y \`files\` presentes. Si tienes dudas sobre cómo generar una propiedad, es preferible que la incluyas con un valor placeholder (ej. \`projectName: "NombreNoDefinido"\`, \`aiNotes: "Sin notas específicas."\`, \`files: []\`) a que la omitas por completo.**
`;

const mainPromptTemplate = `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas, con su contenido) basándote en la petición del usuario.
{{/if}}

Estructura Actual del Proyecto:
Nombre del Proyecto Actual: "{{currentProject.projectName}}"
Notas Actuales de IA sobre el proyecto (puedes añadir a estas notas): "{{currentProject.aiNotes}}"
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
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' }, // Format 'json' is key
  prompt: mainPromptTemplate,
});


export async function modifyProjectStructure(
  input: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  return modifyProjectStructureFlowGenkit(
    input as ModifyProjectStructureInternalInput
  );
}

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal, // Using for type hint, actual validation by definePrompt
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

      const approxPromptLength = (mainPromptTemplate.length + 
                                 (flowInput.agentSystemPrompt?.length || 0) + 
                                 currentProjectFilesString.length + 
                                 flowInput.modificationRequest.length +
                                 (flowInput.chatHistory?.reduce((sum, msg) => sum + msg.content.length, 0) || 0));

      console.log(`[Flow: ${flowName}] Preparando para llamar al LLM. Longitud APROXIMADA del prompt: ${approxPromptLength}`);
      console.log(`[Flow: ${flowName}] Prompt del proyecto actual (primeros 500 chars de files string): ${currentProjectFilesString.substring(0,500)}...`);
      console.log(`[Flow: ${flowName}] Petición de modificación: ${flowInput.modificationRequest}`);
      if (flowInput.agentSystemPrompt) {
        console.log(`[Flow: ${flowName}] Usando agentSystemPrompt (primeros 300 chars): ${flowInput.agentSystemPrompt.substring(0,300)}...`);
      }
      // console.log(`[Flow: ${flowName}] Prompt COMPLETO (DEBUG - puede ser muy largo):\n`, mainPromptTemplate.replace("{{{currentProjectFilesString}}}", currentProjectFilesString).replace("{{{modificationRequest}}}", flowInput.modificationRequest).replace("{{{currentProject.projectName}}}", flowInput.currentProject.projectName).replace("{{{currentProject.aiNotes}}}", flowInput.currentProject.aiNotes || ""));


      const llmResponse = await prompt(promptInputForHandlebars);
      const output = llmResponse.output; // This is already parsed by Genkit if format: 'json' and schema is provided in definePrompt

      let genkitValidationInfo = "";
      if (llmResponse.usage?.promptInvalid) {
          try {
              genkitValidationInfo = ` Detalles de validación de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 500)}`;
          } catch { genkitValidationInfo = ` Detalles de validación de Genkit no pudieron ser serializados.`; }
      }
      
      console.log(`[Flow: ${flowName}] LLM output parseado por Genkit (o undefined si falló el parseo de Genkit). ${genkitValidationInfo ? genkitValidationInfo.substring(0,100)+'...' : '' }. Output (primeros 1000 chars):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + (JSON.stringify(output, null, 2).length > 1000 ? '...' : ''));

      if (!output) {
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${genkitValidationInfo}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        errorDetailsForAppError = { llmUsage: llmResponse.usage, inputToPrompt: { modificationRequest: flowInput.modificationRequest, agentSystemPromptLength: flowInput.agentSystemPrompt?.length }, genkitValidationError: genkitValidationInfo };
        throw new AppError(
            errorMsg,
            errorDetailsForAppError,
            'ai'
        );
      }

      // Fallbacks and validation for fields that are now optional in Zod schema but logically required by the app
      let finalProjectName = input.currentProject.projectName;
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA: 'projectName' no fue proporcionado o fue inválido. Se utilizó el nombre del proyecto original: '${finalProjectName}'. Respuesta de IA para projectName: '${output.projectName === undefined ? "undefined" : String(output.projectName) }'.]`;
      }

      let finalAiNotes = accumulatedAiNotes;
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes += (finalAiNotes ? "\n---\nNotas de la IA sobre la modificación:\n" : "") + output.aiNotes;
      } else {
        finalAiNotes += (finalAiNotes ? "\n" : "") + "[ADVERTENCIA IA: La IA no proporcionó 'aiNotes' válidas o no era un string. Se utilizó un mensaje por defecto o las notas acumuladas.]";
        if(output.aiNotes !== undefined) finalAiNotes += ` Valor recibido para aiNotes: '${String(output.aiNotes)}'`;
        else finalAiNotes += " 'aiNotes' fue omitido por la IA.";
      }

      let finalFilesInput = output.files;
      if (!Array.isArray(finalFilesInput)) {
          finalAiNotes += "\n[ADVERTENCIA IA CRÍTICA: La IA no proporcionó un array 'files' válido. Se ha devuelto una lista de archivos vacía. Esto es un fallo severo del LLM en seguir el schema.]";
          finalFilesInput = []; // Fallback a array vacío
      }
      
      const validatedFiles: GeneratedFileTypeFromTypes[] = (finalFilesInput || []).map((file: Partial<GeneratedFileTypeFromTypes>, index: number) => {
        let filePath = file.path;
        let fileContent = file.content;
        let pathCorrected = false;
        let contentCorrected = false;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
          filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
          pathCorrected = true;
          finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta de archivo faltante o inválida. Se usó: '${filePath}'. Path original de IA: '${String(file.path)}'.`;
        }
        if (typeof fileContent !== 'string') {
          fileContent = `// Contenido no proporcionado o inválido por la IA para ${filePath}`;
          contentCorrected = true;
          finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${filePath}]: Contenido no era string. Se usó placeholder. Contenido original de IA: '${String(file.content)}'.`;
        }
        
        return {
          path: filePath.trim(),
          content: fileContent,
          isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
        } as GeneratedFileTypeFromTypes;
      });
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: validatedFiles,
        groupLog: output.groupLog, // Pass through if provided
      };

      console.log(`[Flow: ${flowName}] Output construido ANTES de validación Zod explícita (si la hubiera). Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);

      // No Zod parse aquí, confiamos en el parse de Genkit y nuestros fallbacks.
      // El tipo de retorno de la función de flujo ya es ProjectGenerationResult, así que TypeScript chequeará.
      
      console.log(`[Flow: ${flowName}] Modificación procesada. Devolviendo output validado y con fallbacks.`);
      return validatedOutput;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      let genkitValidationInfo = "";

      // Intentar extraer información de validación de schema de Genkit si el error proviene de allí
      if (error?.name === 'GenkitError' && error.details?.error?.details?.[0]?.reason === 'SCHEMA_VALIDATION_FAILED') {
          try {
              schemaValidationErrorMsg = ` Error de validación de schema de Genkit: ${JSON.stringify(error.details.error.details).substring(0, 300)}...`;
          } catch { schemaValidationErrorMsg = ` Error de validación de Genkit (no pudo ser serializado).`; }
      } else if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg = ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg = ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
      }
      
      errorDetailsForAppError = {
        originalFlowError: { message: error.message, name: error.name, stack: error.stack?.substring(0, 500) + "..." },
        details: error.details,
        cause: error.cause,
        genkitValidation: genkitValidationInfo || undefined
      };

      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo principal:`, error);
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);

      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

      if (error instanceof AppError) { 
        // Si ya es un AppError (poco probable que llegue aquí si se maneja bien antes), añadirle info.
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

    