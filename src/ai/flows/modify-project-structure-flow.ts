
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
    .string()
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
    .optional() // Hacemos opcional en el schema Zod para el prompt, el código TypeScript se encargará del fallback
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. Si la IA no lo proporciona, se usará el original.'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // Hacemos opcional, el código TypeScript se encargará del fallback
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. Si la IA no lo proporciona, se usará un mensaje por defecto.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // Hacemos opcional, el código TypeScript se encargará del fallback
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

const systemPromptInstructions = `
**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA JSON - ¡NO OMITIR NINGÚN CAMPO REQUERIDO!**
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.

Schema de Salida Detallado (ProjectGenerationResultSchemaForFlowInternal):
\\\`\\\`\\\`json
{
  "projectName": "string (OBLIGATORIO, no vacío. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual. Si no puedes determinarlo, usa 'nombre-proyecto-modificado')",
  "aiNotes": "string (OBLIGATORIO. Notas sobre los cambios, problemas, o un mensaje como 'Modificación procesada.'. Si no hay notas nuevas, indica 'Sin notas adicionales.')",
  "files": [ // Array de objetos GeneratedFile, OBLIGATORIO Y CRUCIAL.
    // SI NO REALIZAS CAMBIOS A LOS ARCHIVOS O LA PETICIÓN NO ES CLARA PARA MODIFICARLOS,
    // DEBES DEVOLVER EL ARRAY \`files\` ORIGINAL COMPLETO que se te proporcionó en \`input.currentProject.files\`.
    // NO DEVUELVAS UN ARRAY \`files\` VACÍO A MENOS QUE LA PETICIÓN SEA ESPECÍFICAMENTE 'eliminar todos los archivos'.
    {
      "path": "string (OBLIGATORIO, ej: src/components/Button.tsx. Las carpetas DEBEN terminar con /)",
      "content": "string (OBLIGATORIO, contenido completo del archivo. Vacío \\"\\" para carpetas o si no hay contenido.)",
      "isFolder": "boolean (opcional, se infiere de path si termina en /)"
    }
    // ... más archivos ...
  ]
  // "groupLog" es opcional y generalmente no lo generarás tú.
}
\\\`\\\`\\\`

Instrucciones Adicionales para el JSON y la Lógica de Modificación:
1.  **\`projectName\` (string, OBLIGATORIO):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'.
2.  **\`aiNotes\` (string, OBLIGATORIO):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto con los archivos originales SIN cambios (pero actualiza 'aiNotes').
3.  **\`files\` (array de objetos GeneratedFile, OBLIGATORIO):** Una lista de TODOS los archivos y carpetas que representan la estructura COMPLETA del proyecto DESPUÉS de la modificación.
    *   Cada objeto \`GeneratedFile\` DENTRO del array \`files\` DEBE tener las propiedades \`path\` (string) y \`content\` (string). \`isFolder\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \`files\` con su \`path\` y \`content\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \`path\` existente y el nuevo \`content\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \`files\` (a menos que la petición sea eliminar todos, en cuyo caso devuelve \`[]\`).
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \`files\` exactamente como estaban, con su \`path\` y \`content\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \`src/utils/newFile.js\` y \`src/utils/\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \`GeneratedFile\` con su \`path\` terminando en \`/\` (ej. \`{ "path": "src/utils/", "content": "", "isFolder": true }\`).
    *   El contenido de los archivos debe ser lo más completo y funcional posible.

Toda la salida debe estar en castellano.
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
 * Wrapper function for the Genkit flow `modifyProjectStructureFlowGenkit`.
 * This function is exported and can be called from server components or other server-side logic.
 * @param {ModifyInputTypeFromTypes} flowInput - The input for modifying the project structure.
 * @returns {Promise<ProjectGenerationResult>} The modified project structure.
 */
export async function modifyProjectStructure(
  flowInput: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  return modifyProjectStructureFlowGenkit(
    flowInput as ModifyProjectStructureInternalInput // Cast to internal type if necessary
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
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchemaInternal,
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (flowInput: ModifyProjectStructureInternalInput): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let schemaValidationErrorMsg = "";
    let errorDetailsForAppError: any = {
        inputToFlow: {
            projectName: flowInput.currentProject.projectName,
            modificationRequest: flowInput.modificationRequest,
            numCurrentFiles: flowInput.currentProject.files?.length,
            agentSystemPromptProvided: !!flowInput.agentSystemPrompt,
        }
    };

    const currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);
    const promptInputForHandlebars = {
      currentProject: flowInput.currentProject,
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    const dataForPromptTemplate = { input: promptInputForHandlebars };

    // For debugging the exact prompt sent to the LLM
    let approxFinalPrompt = mainPromptTemplate
        .replace("{{{input.currentProjectFilesString}}}", currentProjectFilesString)
        .replace("{{{input.modificationRequest}}}", flowInput.modificationRequest)
        .replace("{{input.currentProject.projectName}}", flowInput.currentProject.projectName)
        .replace("{{input.currentProject.aiNotes}}", flowInput.currentProject.aiNotes || "");
    if(flowInput.agentSystemPrompt) {
        approxFinalPrompt = approxFinalPrompt.replace("{{{input.agentSystemPrompt}}}", flowInput.agentSystemPrompt);
    }
    console.log(`[Flow: ${flowName}] DEBUG: Aproximación del prompt final enviado al LLM (longitud: ${approxFinalPrompt.length}). Inicio: ${approxFinalPrompt.substring(0, 200)}... Fin: ...${approxFinalPrompt.substring(approxFinalPrompt.length - 200)}`);


    try {
      console.log(`[Flow: ${flowName}] Iniciado. Petición (inicio): ${flowInput.modificationRequest.substring(0, 100)}...`);
      
      const llmResponse = await prompt(dataForPromptTemplate);
      const output = llmResponse.output;

      if (llmResponse.usage?.promptInvalid) {
          try {
              schemaValidationErrorMsg = ` Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 500)}`;
          } catch { schemaValidationErrorMsg = ` Detalles de validación de Genkit no pudieron ser serializados.`; }
          console.warn(`[Flow: ${flowName}] Genkit schema validation info:`, llmResponse.usage.promptInvalid);
          errorDetailsForAppError.genkitValidationError = llmResponse.usage.promptInvalid;
      }
      console.log(`[Flow: ${flowName}] LLM output parseado por Genkit (truncado):`, JSON.stringify(output, null, 2)?.substring(0, 1000) + (JSON.stringify(output, null, 2).length > 1000 ? '...' : ''), schemaValidationErrorMsg);

      if (!output) {
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${schemaValidationErrorMsg}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        errorDetailsForAppError.llmUsage = llmResponse.usage;
        throw new AppError( errorMsg, errorDetailsForAppError, 'ai' );
      }

      let finalProjectName = flowInput.currentProject.projectName;
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA CRÍTICA: La IA no proporcionó 'projectName' o era inválido. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Respuesta de IA para projectName: '${String(output.projectName)}'.]`;
      }

      let finalAiNotes = accumulatedAiNotes;
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" ? "" : "\n") + output.aiNotes;
      } else {
         finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" ? "" : "\n") + "[ADVERTENCIA IA: La IA no proporcionó 'aiNotes' como un string válido o estaba vacío. Se utilizaron notas previas o un mensaje por defecto.]";
      }
      
      let finalFiles: GeneratedFileTypeFromTypes[];
      if (Array.isArray(output.files) && output.files.length > 0) {
          finalFiles = output.files.map((file: Partial<GeneratedFileInternal>, index: number) => {
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
              content: fileContent ?? '',
              isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
            } as GeneratedFileTypeFromTypes;
          });
      } else {
          // SI LA IA NO DEVUELVE 'files' o devuelve un array vacío, DEVOLVER LOS ARCHIVOS ORIGINALES.
          finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" ? "" : "\n") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]";
          finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
      }
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: finalFiles,
        groupLog: output.groupLog, 
      };
            
      console.log(`[Flow: ${flowName}] Modificación procesada. Devolviendo output validado y con fallbacks. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);
      return validatedOutput;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      console.error(`[Flow: ${flowName}] Error ORIGINAL CAPTURADO (inspeccionado):`, inspect(error, {depth: 3}));
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      
      errorDetailsForAppError.originalErrorContent = {
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 500) + "...",
          details: error.details, // For GenkitError or similar
          cause: error.cause
      };

      if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg += ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg += ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
      }
      
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
