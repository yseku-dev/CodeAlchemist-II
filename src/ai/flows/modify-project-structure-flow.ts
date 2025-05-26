
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
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía." })
    .optional() // Made optional for Genkit validation, will be enforced by flow logic
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // Made optional for Genkit validation
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // Made optional for Genkit validation
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
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
      // files no se pasa directamente aquí, se usa currentProjectFilesString
  }),
  modificationRequest: z.string(),
  chatHistory: z.array(ChatMessageSchemaInternal).optional(),
  agentSystemPrompt: z.string().optional(),
  currentProjectFilesString: z.string().optional().describe('La estructura de archivos actual del proyecto como una cadena JSON.'),
});
export type ModifyProjectStructureInternalInput = z.infer<typeof ModifyProjectStructureInputSchemaInternal>;


// Instrucciones detalladas para el LLM sobre el formato de salida JSON
const systemPromptInstructions = `
**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA JSON - ¡NO OMITIR NINGÚN CAMPO REQUERIDO!**
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.
Si no estás seguro de cómo realizar una modificación o si la petición es ambigua, es PREFERIBLE que devuelvas la estructura de archivos original sin cambios en la propiedad \`files\`, y expliques la situación en \`aiNotes\`.

**Lista de Verificación de Salida JSON OBLIGATORIA:**
1.  **\\\`projectName\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'. Si por alguna razón no puedes determinarlo, usa el valor 'nombre-proyecto-indefinido'. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\\\`aiNotes\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO Y CRUCIALMENTE IMPORTANTE):** DEBES devolver la lista COMPLETA de TODOS los archivos y carpetas del proyecto DESPUÉS de tu modificación.
    *   **CRÍTICO: Si NO realizas NINGÚN cambio en la estructura o contenido de los archivos porque la petición de modificación no es clara, es demasiado compleja, o no aplica, DEBES DEVOLVER LA LISTA DE ARCHIVOS ORIGINAL COMPLETA (la que se te proporcionó en \`input.currentProjectFilesString\`) SIN NINGÚN CAMBIO EN ELLOS.**
    *   No omitas esta propiedad \\\`files\\\`. No devuelvas un array \\\`files\\\` vacío a menos que la petición explícita sea 'eliminar todos los archivos y confirmas que es seguro hacerlo'.
    *   Cada objeto \\\`GeneratedFile\\\` DENTRO del array \\\`files\\\` DEBE tener las propiedades \\\`path\\\` (string) y \\\`content\\\` (string). \\\`isFolder\\\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \\\`files\\\` con su \\\`path\\\` y \\\`content\\\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \\\`path\\\` existente y el nuevo \\\`content\\\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \\\`files\\\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \\\`files\\\` exactamente como estaban, con su \\\`path\\\` y \\\`content\\\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \\\`src/utils/newFile.js\\\` y \\\`src/utils/\\\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \\\`GeneratedFile\\\` con su \\\`path\\\` terminando en \\\`/\` (ej. \\\`{ "path": "src/utils/", "content": "", "isFolder": true }\\\`).
    *   El contenido de los archivos debe ser lo más completo y funcional posible.
    *   Si la \`modificationRequest\` es general (ej. 'hacerlo más modular', 'revisar errores'), enfócate en identificar **1 o 2 áreas específicas** donde puedas proponer un cambio concreto y aplicable. Describe estas áreas y los cambios en \`aiNotes\`. Si puedes aplicar directamente un cambio pequeño y seguro a un archivo, hazlo y actualiza su contenido en \`files\`. Si no, describe la refactorización mayor en \`aiNotes\` y devuelve la lista de \`files\` original.

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

Estructura Actual del Proyecto (objeto \\\`input.currentProject\\\`), los archivos están en \\\`input.currentProjectFilesString\\\`:
Nombre del Proyecto Actual: "{{input.currentProject.projectName}}"
Notas Actuales de IA sobre el proyecto (puedes añadir a estas notas o reemplazarlas): "{{input.currentProject.aiNotes}}"
Lista de Archivos Actuales (JSON de \\\`input.currentProject.files\\\`, como string en \\\`input.currentProjectFilesString\\\`):
\\\`\\\`\\\`json
{{{input.currentProjectFilesString}}}
\\\`\\\`\\\`
{{#if input.chatHistory.length}}
Historial de Conversación de Modificación Previa (el último mensaje es el más reciente, objeto \\\`input.chatHistory\\\`):
{{#each input.chatHistory}}
- Rol: {{this.role}}, Contenido: "{{this.content}}"
{{/each}}
{{/if}}

Petición de Modificación del Usuario (esta es la tarea principal que debes realizar sobre la estructura actual, objeto \\\`input.modificationRequest\\\`):
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
 * Wrapper function for the Genkit flow \`modifyProjectStructureFlowGenkit\`.
 * This function is exported and can be called from server components or other server-side logic.
 * @param {ModifyInputTypeFromTypes} flowInput - The input for modifying the project structure.
 * @returns {Promise<ProjectGenerationResult>} The modified project structure.
 */
export async function modifyProjectStructure(
  flowInput: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  const flowName = 'modifyProjectStructureFlow';
  console.log(`[Flow: ${flowName}] Iniciando flujo con projectName: ${flowInput.currentProject.projectName}, request (inicio): ${flowInput.modificationRequest.substring(0,50)}...`);
  return modifyProjectStructureFlowGenkit(flowInput);
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
    inputSchema: z.custom<ModifyInputTypeFromTypes>(),
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (flowInput: ModifyInputTypeFromTypes): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlowInternal';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let schemaValidationErrorMsg = "";

    console.log(`[Flow: ${flowName}] Input recibido:`, {
      projectName: flowInput.currentProject.projectName,
      modificationRequest: flowInput.modificationRequest.substring(0, 100) + "...",
      numCurrentFiles: flowInput.currentProject.files?.length,
      agentSystemPromptProvided: !!flowInput.agentSystemPrompt,
      chatHistoryLength: flowInput.chatHistory?.length || 0,
    });

    let currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);
    const MAX_FILES_STRING_LENGTH = 30000; // Umbral experimental
    if (currentProjectFilesString.length > MAX_FILES_STRING_LENGTH) {
      currentProjectFilesString = currentProjectFilesString.substring(0, MAX_FILES_STRING_LENGTH) + '\\n... (Archivos truncados por longitud)...';
      accumulatedAiNotes += "[ADVERTENCIA: El contexto de los archivos del proyecto era demasiado largo y fue truncado antes de enviarlo a la IA. La modificación podría ser incompleta o basarse en información parcial.]\\n";
      console.warn(`[Flow: ${flowName}] currentProjectFilesString truncado a ${MAX_FILES_STRING_LENGTH} caracteres.`);
    }


    const promptInputForHandlebars: ModifyProjectStructureInternalInput = {
      currentProject: {
          projectName: flowInput.currentProject.projectName,
          aiNotes: flowInput.currentProject.aiNotes
      },
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    
    // Logging del prompt que se enviará (aproximado)
    let approxFinalPromptForLog = mainPromptTemplate
      .replace("{{{input.currentProjectFilesString}}}", currentProjectFilesString)
      .replace("{{{input.modificationRequest}}}", flowInput.modificationRequest)
      .replace("{{input.currentProject.projectName}}", flowInput.currentProject.projectName)
      .replace("{{input.currentProject.aiNotes}}", flowInput.currentProject.aiNotes || "");
    if(flowInput.agentSystemPrompt) {
        approxFinalPromptForLog = approxFinalPromptForLog.replace("{{{input.agentSystemPrompt}}}", flowInput.agentSystemPrompt);
    }
    approxFinalPromptForLog = approxFinalPromptForLog.replace("${systemPromptInstructions}", systemPromptInstructions); // Asegurar que esta interpolación también se simule
    console.log(`[Flow: ${flowName}] DEBUG: Prompt aproximado que se enviará al LLM (longitud: ${approxFinalPromptForLog.length}). Inicio (primeros 300 chars): ${approxFinalPromptForLog.substring(0, 300)}... Fin (últimos 200 chars): ...${approxFinalPromptForLog.substring(approxFinalPromptForLog.length - 200)}`);


    try {
      console.log(`[Flow: ${flowName}] Intentando llamada al prompt con input preparado.`);
      
      const llmResponse = await prompt(promptInputForHandlebars);
      const output = llmResponse.output;

      let rawLLMOutputForLog = 'N/A (Respuesta cruda no disponible o error al stringify)';
      if (llmResponse.raw?.candidates?.[0]?.output) {
          try {
              const tempString = JSON.stringify(llmResponse.raw.candidates[0].output);
              rawLLMOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
          } catch (stringifyError: any) {
              rawLLMOutputForLog = `[Error al stringify la respuesta cruda del LLM: ${stringifyError.message}]`;
              console.error(`[Flow: ${flowName}] Error al stringify la respuesta cruda del LLM para logging:`, stringifyError);
          }
      }
      console.log(`[Flow: ${flowName}] LLM output parseado por Genkit (truncado): ${output ? JSON.stringify(output).substring(0,500)+'...' : 'undefined'}. Respuesta cruda (truncada): ${rawLLMOutputForLog}`);


      if (llmResponse.usage?.promptInvalid) {
          try {
              schemaValidationErrorMsg = ` Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 300)}`;
          } catch { schemaValidationErrorMsg = ` (Detalles de validación de Genkit no pudieron ser serializados).`; }
          console.warn(`[Flow: ${flowName}] Genkit schema validation info:`, llmResponse.usage.promptInvalid);
      }
      
      if (!output) {
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${schemaValidationErrorMsg}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        throw new AppError( errorMsg, { genkitUsage: llmResponse.usage, inputSent: promptInputForHandlebars }, 'ai' );
      }

      // Fallbacks agresivos para asegurar que el objeto devuelto tenga la estructura esperada
      let finalProjectName = flowInput.currentProject.projectName;
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `[ADVERTENCIA IA CRÍTICA: 'projectName' NO fue proporcionado por la IA o era inválido. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Respuesta de IA para projectName: '${String(output.projectName)}'.]\n`;
      }

      let finalAiNotes = accumulatedAiNotes.trim();
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes = (finalAiNotes ? finalAiNotes + "\n" : "") + output.aiNotes;
      } else if (output.aiNotes !== undefined){
         finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' fue proporcionado por la IA pero no era un string válido: '${String(output.aiNotes)}'.]`;
      } else {
         finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' NO fue proporcionado por la IA.]`;
      }
      
      let finalFiles: GeneratedFileTypeFromTypes[];
      if (Array.isArray(output.files) && output.files.length > 0) {
          finalFiles = output.files.map((file: Partial<GeneratedFileInternal>, index: number) => {
            let filePath = file.path;
            let fileContent = file.content;
            if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
              filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
              finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta de archivo faltante o inválida en la respuesta de la IA. Se usó: '${filePath}'. Path original de IA: '${String(file.path)}'.`;
            }
            if (typeof fileContent !== 'string') {
              fileContent = `// Contenido no proporcionado o inválido por la IA para ${filePath}`;
              finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${filePath}]: Contenido no era string en la respuesta de la IA. Se usó placeholder. Contenido original de IA: '${String(file.content)}'.`;
            }
            return {
              path: filePath.trim(),
              content: fileContent ?? '', 
              isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
            } as GeneratedFileTypeFromTypes;
          });
      } else { 
          finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })); // Devolver los archivos originales
          finalAiNotes += (finalAiNotes.trim() ? "\n" : "") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida ('files') o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]";
          console.warn(`[Flow: ${flowName}] La IA no devolvió un array 'files' válido o estaba vacío. Se devuelven los archivos originales del input. Output.files recibido:`, output?.files);
      }
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim() || "Notas no proporcionadas.",
        files: finalFiles,
        groupLog: output.groupLog, 
      };
            
      console.log(`[Flow: ${flowName}] Modificación procesada (o restaurada a original si hubo error IA). Devolviendo output. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);
      return validatedOutput;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      console.error(`[Flow: ${flowName}] Error ORIGINAL CAPTURADO (mensaje): ${originalErrorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[Flow: ${flowName}] Stack del error original (primeras 1000 chars):\n`, error.stack.substring(0, 1000));
      }
      // console.error(`[Flow: ${flowName}] Detalles adicionales del error original (inspección limitada):`, inspect(error, { depth: 2, maxStringLength: 500 }));


      let genkitValidationInfo = "";
      if (error?.llmUsage?.promptInvalid) {
          try {
              genkitValidationInfo = ` Detalles de validación de Genkit: ${JSON.stringify(error.llmUsage.promptInvalid).substring(0,300)}`;
          } catch { genkitValidationInfo = " (Detalles de validación de Genkit no serializables)"; }
      } else if (error?.name === 'ZodError' && error.errors) {
          try {
              genkitValidationInfo = ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`;
          } catch {
              genkitValidationInfo = ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`;
          }
      }
      schemaValidationErrorMsg = genkitValidationInfo || schemaValidationErrorMsg; // Reutilizar la variable global
      
      const detailsForUser = originalErrorMessage.substring(0, 150) + (originalErrorMessage.length > 150 ? '...' : '');

      const errorDetailsForAppError: any = {
          message: originalErrorMessage.substring(0, 500) + (originalErrorMessage.length > 500 ? '...' : ''),
          name: error?.name,
          genkitValidationInfo: schemaValidationErrorMsg || undefined,
      };
      
      if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
          errorDetailsForAppError.stackHint = error.stack.substring(0, 500) + "... (ver logs completos del servidor)";
      }
      
      if (error instanceof AppError) { // Si ya es un AppError (ej. lanzado por validación de !output)
        error.friendlyMessage = `${error.friendlyMessage}${schemaValidationErrorMsg}`;
        error.originalError = { ...(error.originalError || {}), moreDetails: errorDetailsForAppError };
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

    