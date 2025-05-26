
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
  ModifyProjectStructureInput as ModifyInputTypeFromTypes, // From types.ts
  ProjectGenerationResult,        // From types.ts
  GeneratedFile as GeneratedFileTypeFromTypes, // From types.ts
  ChatMessage as ChatMessageTypeFromTypes,   // From types.ts
} from '@/types';
import { AppError } from '@/utils/AppError';
import { inspect } from 'util'; // For detailed server-side logging

// Local Zod schemas for this flow for clarity and to define prompt's expected output structure
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string({ required_error: "Cada archivo DEBE tener una propiedad 'path'."})
    .min(1, { message: "La propiedad 'path' de un archivo no puede estar vacía." })
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /. Es OBLIGATORIO.'
    ),
  content: z
    .string() // No longer { required_error: ...} as we provide default ""
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío "" para carpetas o si no hay contenido específico. Es OBLIGATORIO.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta. Si path termina en /, se infiere true.'),
});
type GeneratedFileInternal = z.infer<typeof GeneratedFileSchemaInternal>;

const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string({ invalid_type_error: "La propiedad 'projectName' debe ser un string." })
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía si se proporciona." })
    .optional()
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. Si la IA no lo proporciona, se usará el original.'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional()
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. Si la IA no lo proporciona, se usará un mensaje por defecto.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional()
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. Si la IA no lo proporciona, se usará un array vacío [].'
    ),
  groupLog: z
    .string()
    .optional()
    .describe('Log de ejecución si la modificación fue coordinada por un grupo.'),
});


const ChatMessageSchemaInternal = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const ModifyProjectStructureInputSchemaInternal = z.object({
  currentProject: z.object({ // This matches ProjectGenerationResult structure
      projectName: z.string(),
      aiNotes: z.string().optional(),
      files: z.array(GeneratedFileSchemaInternal) // Uses the internal schema
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


const systemPromptInstructions = `
**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA JSON - ¡NO OMITIR NINGÚN CAMPO REQUERIDO!**
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.

Schema de Salida Detallado (ProjectGenerationResultSchemaForFlowInternal):
\\\`\\\`\\\`json
{
  "projectName": "string (OBLIGATORIO, no vacío. Si no hay cambios, usa el nombre actual. Si no puedes determinarlo, usa 'nombre-proyecto-modificado')",
  "aiNotes": "string (OBLIGATORIO. Notas sobre los cambios, problemas, o un mensaje como 'Modificación procesada.')",
  "files": [ // Array de objetos GeneratedFile, OBLIGATORIO. Puede ser vacío [].
    {
      "path": "string (OBLIGATORIO, ej: src/components/Button.tsx. Las carpetas DEBEN terminar con /)",
      "content": "string (OBLIGATORIO, contenido completo del archivo. Vacío \\"\\" para carpetas o si no hay contenido.)",
      "isFolder": "boolean (opcional, se infiere de path si termina en /)"
    }
    // ... más archivos ...
  ],
  "groupLog": "string (opcional, generalmente no lo generarás tú directamente)"
}
\\\`\\\`\\\`

Instrucciones Adicionales para el JSON y la Lógica de Modificación:
1.  **\`projectName\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'. Si por alguna razón no puedes determinarlo, usa un valor como 'nombre-proyecto-modificado' o el sugerido por la petición. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\`aiNotes\` (string, OBLIGATORIO):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\`files\` (array de objetos GeneratedFile, OBLIGATORIO):** Una lista de TODOS los archivos y carpetas que representan la estructura COMPLETA del proyecto DESPUÉS de la modificación. ¡NO OMITIR ESTE CAMPO! Puede ser un array vacío \`[]\` si se eliminan todos los archivos.
    *   Cada objeto \`GeneratedFile\` DENTRO del array \`files\` DEBE tener las propiedades \`path\` (string) y \`content\` (string). \`isFolder\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \`files\` con su \`path\` y \`content\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \`path\` existente y el nuevo \`content\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \`files\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \`files\` exactamente como estaban, con su \`path\` y \`content\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \`src/utils/newFile.js\` y \`src/utils/\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \`GeneratedFile\` con su \`path\` terminando en \`/\` (ej. \`{ "path": "src/utils/", "content": "", "isFolder": true }\`).
    *   El contenido de los archivos debe ser lo más completo y funcional posible.

Toda la salida debe estar en castellano.
Si la petición del usuario es muy simple (ej. 'cambia el nombre del proyecto a X'), asegúrate de devolver TODA la estructura de archivos sin cambios, solo con el projectName actualizado y una nota en aiNotes.
Es ABSOLUTAMENTE CRUCIAL que incluyas las propiedades \`projectName\`, \`aiNotes\`, y \`files\` en tu respuesta JSON.

Tu respuesta DEBE SER ÚNICAMENTE el objeto JSON válido y completo que se adhiera a esta estructura. No incluyas ningún otro texto explicativo fuera del objeto JSON.
`;

const mainPromptTemplate = `{{#if input.agentSystemPrompt}}
{{{input.agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas, con su contenido) basándote en la petición del usuario.
{{/if}}

Estructura Actual del Proyecto (propiedad 'input.currentProject'):
Nombre del Proyecto Actual: "{{input.currentProject.projectName}}"
Notas Actuales de IA sobre el proyecto (puedes añadir a estas notas): "{{input.currentProject.aiNotes}}"
Lista de Archivos Actuales (JSON de la propiedad 'input.currentProject.files', como string en 'input.currentProjectFilesString'):
\\\`\\\`\\\`json
{{{input.currentProjectFilesString}}}
\\\`\\\`\\\`
{{#if input.chatHistory.length}}
Historial de Conversación de Modificación Previa (el último mensaje es el más reciente, propiedad 'input.chatHistory'):
{{#each input.chatHistory}}
- Rol: {{this.role}}, Contenido: "{{this.content}}"
{{/each}}
{{/if}}

Petición de Modificación del Usuario (esta es la tarea principal que debes realizar sobre la estructura actual, propiedad 'input.modificationRequest'):
"{{{input.modificationRequest}}}"

${systemPromptInstructions}
`;


const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchemaInternal },
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
  prompt: mainPromptTemplate,
});

/**
 * Wrapper function for the Genkit flow `modifyProjectStructureFlowInternal`.
 * This function is exported and can be called from server components or other server-side logic.
 * @param {ModifyInputTypeFromTypes} input - The input for modifying the project structure.
 * @returns {Promise<ProjectGenerationResult>} The modified project structure.
 */
export async function modifyProjectStructure(
  input: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  // Cast to internal type for flow execution
  return modifyProjectStructureFlowGenkit(
    input as ModifyProjectStructureInternalInput
  );
}

/**
 * Genkit flow for modifying a project structure.
 * Takes the current project state and a modification request, then calls an LLM
 * to get a new project structure. It handles potential errors and ensures
 * the output tries to conform to the ProjectGenerationResult schema.
 */
const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal', // Internal flow name
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal, // Output schema for Genkit's validation
  },
  async (flowInput: ModifyProjectStructureInternalInput): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let originalErrorForAppError: any = null;
    let schemaValidationErrorMsg = "";
    let errorDetailsForAppError: any = {};

    console.log(`[Flow: ${flowName}] Iniciado. Petición (inicio): ${flowInput.modificationRequest.substring(0, 100)}...`);
    // console.log(`[Flow: ${flowName}] DEBUG: flowInput completo:`, inspect(flowInput, {depth: 2}).substring(0,1000) + "...");


    try {
      const currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);
      
      const promptInputForHandlebars = {
        currentProject: flowInput.currentProject,
        modificationRequest: flowInput.modificationRequest,
        chatHistory: flowInput.chatHistory || [],
        agentSystemPrompt: flowInput.agentSystemPrompt,
        currentProjectFilesString: currentProjectFilesString,
      };

      const dataForPromptTemplate = {
        input: promptInputForHandlebars
      };
      
      // For extremely detailed debugging of the exact prompt string:
      // This requires Handlebars to be available here, which might not be the case for Genkit's internal instance.
      // For now, rely on Genkit's tracing or LLM provider logs if prompt issues are suspected.
      // console.log(`[Flow: ${flowName}] DEBUG: Datos para plantilla Handlebars:`, inspect(dataForPromptTemplate, {depth: 1}).substring(0,1000) + "...");
      // console.log(`[Flow: ${flowName}] DEBUG: Plantilla Handlebars (inicio):`, mainPromptTemplate.substring(0,300) + "...");

      const llmResponse = await prompt(dataForPromptTemplate); // Pass the wrapped object
      const output = llmResponse.output; 

      let genkitValidationInfo = "";
      if (llmResponse.usage?.promptInvalid) {
          try {
              genkitValidationInfo = ` Detalles de validación de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 500)}`;
          } catch { genkitValidationInfo = ` Detalles de validación de Genkit no pudieron ser serializados.`; }
          schemaValidationErrorMsg += genkitValidationInfo;
      }
      console.log(`[Flow: ${flowName}] LLM output recibido (después de parseo Genkit, truncado):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + (JSON.stringify(output, null, 2).length > 1000 ? '...' : ''), genkitValidationInfo);

      if (!output) {
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${genkitValidationInfo}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        errorDetailsForAppError = { llmUsage: llmResponse.usage, inputToPrompt: { modificationRequest: flowInput.modificationRequest, agentSystemPromptLength: flowInput.agentSystemPrompt?.length }, genkitValidationError: genkitValidationInfo };
        throw new AppError( errorMsg, errorDetailsForAppError, 'ai' );
      }

      let finalProjectName = flowInput.currentProject.projectName;
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else if (output.projectName !== undefined) {
        accumulatedAiNotes += `\n[ADVERTENCIA IA: 'projectName' fue devuelto por la IA como '${output.projectName}' (tipo: ${typeof output.projectName}), pero no era un string válido o estaba vacío. Se utilizó el nombre del proyecto original: '${finalProjectName}'.]`;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA CRÍTICA: 'projectName' NO fue proporcionado por la IA. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Esto indica un fallo del LLM en seguir el schema.]`;
      }

      let finalAiNotes = accumulatedAiNotes;
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes += (finalAiNotes ? "\n---\nNotas Adicionales de la IA sobre la Modificación:\n" : "") + output.aiNotes;
      } else if (output.aiNotes !== undefined) {
        finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: La IA no proporcionó 'aiNotes' como un string válido. Valor recibido: '${String(output.aiNotes)}'.]`;
      } else {
         finalAiNotes += (finalAiNotes ? "\n" : "") + "[ADVERTENCIA IA: La IA no proporcionó 'aiNotes'. Se utilizó un mensaje por defecto o las notas acumuladas.]";
      }

      let finalFilesInput = output.files;
      if (!Array.isArray(finalFilesInput)) {
          finalAiNotes += "\n[ADVERTENCIA IA CRÍTICA: La IA no proporcionó un array 'files' válido. Se ha devuelto una lista de archivos vacía. Esto es un fallo severo del LLM en seguir el schema.]";
          finalFilesInput = []; 
      }
      
      const validatedFiles: GeneratedFileTypeFromTypes[] = (finalFilesInput || []).map((file: Partial<GeneratedFileInternal>, index: number) => {
        let filePath = file.path;
        let fileContent = file.content;

        if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
          filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
          finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta de archivo faltante o inválida. Se usó: '${filePath}'. Path original de IA: '${String(file.path)}'.`;
        }
        if (typeof fileContent !== 'string') {
          fileContent = `// Contenido no proporcionado o inválido por la IA para ${filePath}`;
          finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${filePath}]: Contenido no era string. Se usó placeholder. Contenido original de IA: '${String(file.content)}'.`;
        }
        
        return {
          path: filePath.trim(),
          content: fileContent ?? '', // Asegurar que content sea siempre string
          isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
        } as GeneratedFileTypeFromTypes;
      });
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: validatedFiles,
        groupLog: output.groupLog, 
      };
      
      console.log(`[Flow: ${flowName}] Output construido ANTES de validación Zod explícita (si la hubiera). Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);
      
      console.log(`[Flow: ${flowName}] Modificación procesada. Devolviendo output validado y con fallbacks.`);
      return validatedOutput;

    } catch (error: any) {
      originalErrorForAppError = error;
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      
      if (error.name === 'GenkitError' && error.details?.error?.details?.[0]?.reason === 'SCHEMA_VALIDATION_FAILED') {
          try {
              schemaValidationErrorMsg = ` Error de validación de schema de Genkit: ${JSON.stringify(error.details.error.details).substring(0, 300)}...`;
          } catch { schemaValidationErrorMsg = ` Error de validación de Genkit (no pudo ser serializado).`; }
          console.error(`[Flow: ${flowName}] Error de Validación de Schema Genkit:`, schemaValidationErrorMsg, error.details);
      } else if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg = ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg = ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
        console.error(`[Flow: ${flowName}] Error de Validación Zod:`, schemaValidationErrorMsg, error.errors);
      }
      
      errorDetailsForAppError = {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500) + "...",
        details: error.details,
        cause: error.cause,
        genkitValidation: schemaValidationErrorMsg || undefined
      };

      console.error(`[Flow: ${flowName}] Error ORIGINAL CAPTURADO (inspeccionado):`, inspect(originalErrorForAppError, {depth: 3}));
      if (originalErrorForAppError.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, originalErrorForAppError.stack);

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

    