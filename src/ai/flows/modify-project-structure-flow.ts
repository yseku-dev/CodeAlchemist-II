
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
  ModifyProjectStructureInput as ModifyInputTypeFromTypes, // Renamed to avoid conflict
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes, // To match the type in ProjectGenerationResult
  ChatMessage as ChatMessageTypeFromTypes,
} from '@/types';
import { AppError } from '@/utils/AppError';
import { inspect } from 'util'; // For detailed server-side logging

// Local Zod schemas for this flow to avoid complex imports if types.ts also imports from flows
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

const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string({ invalid_type_error: "La propiedad 'projectName' debe ser un string." })
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía." })
    .optional() // Made optional at schema level for LLM flexibility
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // Made optional
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // Made optional
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
  currentProject: ProjectGenerationResultSchemaForFlowInternal.describe("El objeto ProjectGenerationResult actual, representando el estado actual del proyecto."),
  modificationRequest: z.string().describe("La petición del usuario en lenguaje natural sobre cómo modificar el proyecto."),
  chatHistory: z.array(ChatMessageSchemaInternal).optional().describe("Historial de la conversación de modificación, si existe."),
  agentSystemPrompt: z.string().optional().describe("El prompt de sistema de un agente, si la modificación es impulsada por un agente específico o un contexto de grupo."),
  currentProjectFilesString: z.string().optional().describe('La estructura de archivos actual del proyecto como una cadena JSON. Para ser usada en el prompt.'),
});


const systemPromptInstructions = `
**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA JSON - ¡NO OMITIR NINGÚN CAMPO REQUERIDO POR EL SCHEMA BASE!**
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \`projectName\` (string), \`aiNotes\` (string), y \`files\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.
Si no estás seguro de cómo realizar una modificación o si la petición es ambigua, es PREFERIBLE que devuelvas la estructura de archivos original sin cambios en la propiedad \`files\`, y expliques la situación en \`aiNotes\`.
Si la \`modificationRequest\` es demasiado compleja, ambigua, o requeriría cambios en demasiados archivos, es PREFERIBLE que respondas indicándolo en \`aiNotes\` y devuelvas la estructura de \`files\` original sin modificar, en lugar de intentar una modificación parcial o incorrecta que pueda corromper el proyecto.
Si la \`modificationRequest\` es general (ej. 'hacerlo más modular', 'revisar errores'), enfócate en identificar **1 o 2 áreas específicas** donde puedas proponer un cambio concreto y aplicable. Describe estas áreas y los cambios en \`aiNotes\`. Si puedes aplicar directamente un cambio pequeño y seguro a un archivo, hazlo y actualiza su contenido en \`files\`. Si no, describe la refactorización mayor en \`aiNotes\` y devuelve la lista de \`files\` original.

**Lista de Verificación de Salida JSON OBLIGATORIA (según ProjectGenerationResultSchemaForFlowInternal):**
1.  **\\\`projectName\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'. Si por alguna razón no puedes determinarlo, usa el valor 'nombre-proyecto-indefinido'. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\\\`aiNotes\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO Y CRUCIALMENTE IMPORTANTE):** DEBES devolver la lista COMPLETA de TODOS los archivos y carpetas del proyecto DESPUÉS de tu modificación.
    *   **CRÍTICO: Si NO realizas NINGÚN cambio en la estructura o contenido de los archivos porque la petición de modificación no es clara, es demasiado compleja, o no aplica, DEBES DEVOLVER LA LISTA DE ARCHIVOS ORIGINAL COMPLETA (la que se te proporcionó en \\\`input.currentProject.files\\\` [representada en \\\`input.currentProjectFilesString\\\`]) SIN NINGÚN CAMBIO EN ELLOS.**
    *   No omitas esta propiedad \\\`files\\\`. No devuelvas un array \\\`files\\\` vacío a menos que la petición explícita sea 'eliminar todos los archivos'. (Si la petición es válida pero resulta en 0 archivos, devuelve \\\`[]\\\`).
    *   Cada objeto \\\`GeneratedFile\\\` DENTRO del array \\\`files\\\` DEBE tener las propiedades \\\`path\\\` (string) y \\\`content\\\` (string). \\\`isFolder\\\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \\\`files\\\` con su \\\`path\\\` y \\\`content\\\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \\\`path\\\` existente y el nuevo \\\`content\\\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \\\`files\\\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \\\`files\\\` exactamente como estaban, con su \\\`path\\\` y \\\`content\\\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \\\`src/utils/newFile.js\\\` y la carpeta \\\`src/utils/\\\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \\\`GeneratedFile\\\` con su \\\`path\\\` terminando en \\\`/\` (ej. \\\`{ "path": "src/utils/", "content": "", "isFolder": true }\\\`).
    *   El contenido de los archivos debe ser lo más completo y funcional posible.

Toda la salida debe estar en castellano.
Es ABSOLUTAMENTE CRUCIAL que incluyas las propiedades \\\`projectName\\\`, \\\`aiNotes\\\`, y \\\`files\\\` en tu respuesta JSON.

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
 * Modifies an existing project structure based on a user's request using AI.
 * @param {ModifyInputTypeFromTypes} flowInput - The input containing the current project, modification request, and context.
 * @returns {Promise<ProjectGenerationResult>} The modified project structure.
 * @throws {AppError} If the AI fails to process the request or if an unexpected error occurs.
 */
export async function modifyProjectStructure(
  flowInput: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  const flowName = 'modifyProjectStructureFlow';
  console.log(`[Flow: ${flowName}] Iniciando flujo. Request (inicio): ${flowInput.modificationRequest.substring(0,50)}...`);
  return modifyProjectStructureFlowGenkit(flowInput);
}

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: z.custom<ModifyInputTypeFromTypes>(), // Using z.custom to avoid direct schema conflict if ModifyInputTypeFromTypes is complex
    outputSchema: ProjectGenerationResultSchemaForFlowInternal, // Output schema for Genkit validation
  },
  async (flowInput: ModifyInputTypeFromTypes): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlowInternal';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let llmResponseFromPrompt: any;
    let outputFromLlm: z.infer<typeof ProjectGenerationResultSchemaForFlowInternal> | undefined;
    let criticalLlmInteractionError: any = null;
    let llmCallSucceeded = false;

    let currentProjectFilesString = "[]";
    try {
      const filesToSerialize = Array.isArray(flowInput.currentProject.files) ? flowInput.currentProject.files : [];
      currentProjectFilesString = JSON.stringify(filesToSerialize, null, 2);
    } catch (e: any) {
      console.error(`[Flow: ${flowName}] Error CRÍTICO al serializar flowInput.currentProject.files: `, e);
      accumulatedAiNotes += "[ERROR CRÍTICO INTERNO: No se pudieron serializar los archivos del proyecto actual para enviar a la IA. La modificación no es posible.]\n";
      // Return original project structure if serialization fails
      return {
        projectName: flowInput.currentProject.projectName,
        aiNotes: accumulatedAiNotes,
        files: flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })),
        groupLog: flowInput.currentProject.groupLog,
      };
    }
    
    const MAX_FILES_STRING_LENGTH = 35000; // Experimental threshold
    if (currentProjectFilesString.length > MAX_FILES_STRING_LENGTH) {
      currentProjectFilesString = currentProjectFilesString.substring(0, MAX_FILES_STRING_LENGTH) + '\\n... (Archivos truncados por longitud)...';
      accumulatedAiNotes += "[ADVERTENCIA: El contexto de los archivos del proyecto era demasiado largo y fue truncado antes de enviarlo a la IA. La modificación podría ser incompleta o basarse en información parcial.]\n";
      console.warn(`[Flow: ${flowName}] currentProjectFilesString truncado a ${MAX_FILES_STRING_LENGTH} caracteres.`);
    }

    const promptInputForHandlebars = {
      currentProject: {
          projectName: flowInput.currentProject.projectName,
          aiNotes: flowInput.currentProject.aiNotes,
      },
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    
    const approximatePromptForLog = `${promptInputForHandlebars.agentSystemPrompt || 'Sistema Experto:'}\n${promptInputForHandlebars.modificationRequest}\n${promptInputForHandlebars.currentProjectFilesString.substring(0,200)}...`;
    console.log(`[Flow: ${flowName}] DEBUG: Prompt aproximado para LLM (longitud total aproximada: ${approximatePromptForLog.length}, currentProjectFilesString: ${currentProjectFilesString.length}). Inicio del prompt:\n${approximatePromptForLog.substring(0, 500)}...`);

    try {
      // NESTED TRY-CATCH FOR THE CRITICAL LLM CALL
      try {
        llmResponseFromPrompt = await prompt(promptInputForHandlebars); // 'prompt' is the ai.definePrompt object
        outputFromLlm = llmResponseFromPrompt.output; // Genkit v1.x: .output is a property
        llmCallSucceeded = true;

        let rawLLMOutputForLog = 'N/A';
        if (llmResponseFromPrompt.raw?.candidates?.[0]?.output) {
          try {
              const tempString = JSON.stringify(llmResponseFromPrompt.raw.candidates[0].output);
              rawLLMOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
          } catch (stringifyError: any) {
              rawLLMOutputForLog = `[Error al stringify la respuesta cruda del LLM: ${stringifyError.message}]`;
              console.error(`[Flow: ${flowName}] Error al stringify la respuesta cruda del LLM para el log:`, stringifyError);
          }
        }
        console.log(`[Flow: ${flowName}] LLM output (parseado por Genkit): ${outputFromLlm ? JSON.stringify(outputFromLlm).substring(0,200)+'...' : 'undefined'}. Respuesta cruda (truncada): ${rawLLMOutputForLog}`);

        if (llmResponseFromPrompt.usage?.promptInvalid) {
            let schemaValidationDetails = "";
            try {
                schemaValidationDetails = JSON.stringify(llmResponseFromPrompt.usage.promptInvalid);
            } catch { schemaValidationDetails = "(Detalles de validación de Genkit no serializables)"; }
            console.warn(`[Flow: ${flowName}] Genkit schema validation info: ${schemaValidationDetails}`);
            accumulatedAiNotes += `\n[ADVERTENCIA IA: Genkit reportó problemas de validación de schema con la respuesta del LLM. ${schemaValidationDetails.substring(0,200)}...]`;
        }
      } catch (llmError: any) {
        console.error(`[Flow: ${flowName}] Error CRÍTICO en llamada a prompt() o acceso a output:`, llmError.message, llmError.name);
        if (llmError.stack) console.error(`[Flow: ${flowName}] Stack del error crítico en llamada a prompt():\n`, llmError.stack.substring(0, 500));
        criticalLlmInteractionError = llmError; // Store the critical error
        llmCallSucceeded = false;
        outputFromLlm = undefined;
        accumulatedAiNotes += `\n[ERROR CRÍTICO INTERNO: Falló la comunicación con la IA o el procesamiento de su respuesta (${llmError.message?.substring(0,50) || 'Error desconocido'}). La modificación no pudo ser procesada.]`;
      }

      if (!outputFromLlm && llmCallSucceeded) { // LLM call might have "succeeded" but Genkit couldn't parse to schema, making output undefined
        const errorDetail = "La IA no devolvió una estructura de proyecto válida (output nulo/undefined después del parseo de Genkit).";
        console.error(`[Flow: ${flowName}] ${errorDetail} Uso del prompt:`, llmResponseFromPrompt?.usage);
        accumulatedAiNotes += `\n[ERROR CRÍTICO DE IA: ${errorDetail} Posiblemente el formato JSON era incorrecto o faltaban campos cruciales.]`;
        // This case might already be handled by criticalLlmInteractionError if Genkit itself throws an error
        // but this is an extra check.
      }

      // Construct validatedOutput using fallbacks
      let finalProjectName = flowInput.currentProject.projectName;
      if (outputFromLlm && typeof outputFromLlm.projectName === 'string' && outputFromLlm.projectName.trim() !== '') {
        finalProjectName = outputFromLlm.projectName;
      } else if (outputFromLlm && outputFromLlm.projectName !== undefined) {
        accumulatedAiNotes += `[ADVERTENCIA IA CRÍTICA: 'projectName' fue proporcionado por la IA (${typeof outputFromLlm.projectName}: '${String(outputFromLlm.projectName)}') pero era inválido. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'.]\n`;
      } else if (llmCallSucceeded){ // outputFromLlm.projectName is undefined AND llmCallSucceeded (meaning no explicit error during call)
        accumulatedAiNotes += `[ADVERTENCIA IA CRÍTICA: 'projectName' NO fue proporcionado por la IA. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Esto indica un fallo del LLM en seguir el schema.]\n`;
      }

      let finalAiNotes = accumulatedAiNotes.trim();
      if (outputFromLlm && typeof outputFromLlm.aiNotes === 'string' && outputFromLlm.aiNotes.trim() !== '') {
        finalAiNotes = (finalAiNotes ? finalAiNotes + "\n\n" : "") + outputFromLlm.aiNotes.trim();
      } else if (outputFromLlm && outputFromLlm.aiNotes !== undefined) {
         finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' no era un string válido o estaba vacío. IA proveyó: '${String(outputFromLlm.aiNotes)}'.]\n`;
      } else if (llmCallSucceeded) {
         finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' NO fue proporcionado por la IA.]\n`;
      }
      
      let finalFiles: GeneratedFileTypeFromTypes[];
      if (outputFromLlm && Array.isArray(outputFromLlm.files) && outputFromLlm.files.length > 0) {
          finalFiles = outputFromLlm.files.map((file: Partial<GeneratedFileTypeFromTypes>, index: number) => {
            let filePath = file.path;
            let fileContent = file.content; // content can be empty string for folders
            if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
              filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
              finalAiNotes += (finalAiNotes.trim() ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta ('path') faltante o inválida. Nombre asignado: '${filePath}'.\n`;
            }
            if (typeof fileContent !== 'string') {
              fileContent = `// Contenido no proporcionado o inválido por IA para ${filePath}`;
              finalAiNotes += (finalAiNotes.trim() ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${filePath}]: Contenido ('content') no era un string.\n`;
            }
            return {
              path: filePath.trim(),
              content: fileContent ?? '', 
              isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
            } as GeneratedFileTypeFromTypes;
          });
      } else { 
          finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })); 
          if (llmCallSucceeded && (!outputFromLlm || !Array.isArray(outputFromLlm.files) || outputFromLlm.files.length === 0) ) {
              finalAiNotes += (finalAiNotes.trim() ? "\n\n" : "") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida (`files`) o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]\n";
          } else if (!llmCallSucceeded && (!outputFromLlm || !Array.isArray(outputFromLlm.files))) {
              // If LLM call failed, we've already noted it in accumulatedAiNotes, so just ensure files are original.
              finalAiNotes += (finalAiNotes.trim() ? "\n\n" : "") + "[NOTA: Debido al fallo en la comunicación con la IA, se ha MANTENIDO la estructura de archivos previa.]\n";
          }
          console.warn(`[Flow: ${flowName}] 'output.files' inválido, vacío, o llamada LLM falló. Usando archivos originales del input. Output.files:`, outputFromLlm?.files);
      }
        
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim() || (criticalLlmInteractionError ? `Error en llamada a IA: ${criticalLlmInteractionError.message || "Error desconocido"}` : "Notas no proporcionadas."),
        files: finalFiles,
        groupLog: outputFromLlm?.groupLog || flowInput.currentProject.groupLog, 
      };
                
      if (criticalLlmInteractionError) {
          console.error(`[Flow: ${flowName}] Relanzando error crítico de interacción con LLM después de construir fallback:`, criticalLlmInteractionError);
          throw criticalLlmInteractionError; // Re-throw the original critical error
      }
              
      console.log(`[Flow: ${flowName}] Modificación procesada. Devolviendo output. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files?.length}, Longitud de Notas: ${validatedOutput.aiNotes.length}`);
      return validatedOutput;
    } catch (error: any) { // MAIN CATCH BLOCK
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      const flowContext = flowName || 'modifyProjectStructureFlowGenkit';
      
      console.error(`[Flow: ${flowContext}] Error ORIGINAL CAPTURADO en el catch principal (mensaje): ${originalErrorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[Flow: ${flowContext}] Stack del error original (catch principal):\n`, error.stack.substring(0, 1000));
      }
      
      let schemaValidationErrorMsg = "";
      if (error?.name === 'ZodError' && error.errors) {
          try {
              schemaValidationErrorMsg = ` Detalles de validación Zod: ${JSON.stringify(error.errors[0] || error.errors).substring(0, 200)}`;
          } catch { schemaValidationErrorMsg = ` (Error de Zod no serializable).`;}
      } else if (error?.code === 'INVALID_ARGUMENT' && error?.message?.includes('Schema validation failed')) {
          try {
              schemaValidationErrorMsg = ` ${error.message.substring(0, 200)}`;
          } catch { schemaValidationErrorMsg = ` (Error de validación de schema de Genkit no serializable).`;}
      } else if (llmResponseFromPrompt?.usage?.promptInvalid) {
           try {
              schemaValidationErrorMsg = ` Detalles de validación de Genkit previos: ${JSON.stringify(llmResponseFromPrompt.usage.promptInvalid).substring(0, 200)}`;
          } catch { schemaValidationErrorMsg = ` (Detalles de validación de Genkit previos no serializables).`; }
      }
      
      const detailsForUser = originalErrorMessage.substring(0, 150) + (originalErrorMessage.length > 150 ? '...' : '');

      const errorDetailsForAppError: any = {
          message: originalErrorMessage.substring(0, 500) + (originalErrorMessage.length > 500 ? '...' : ''),
          name: error?.name,
          genkitValidationInfo: schemaValidationErrorMsg || undefined,
      };
      
      if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
          errorDetailsForAppError.stackHint = error.stack.substring(0, 500) + "... (ver logs completos del servidor)";
      }
      
      throw new AppError(
        `FALLO_EN_FLUJO_MODIFY_PROJECT: ${detailsForUser}${schemaValidationErrorMsg}`,
        errorDetailsForAppError, 
        'ai'
      );
    }
  } // Fin de la función async del defineFlow
); // Fin de ai.defineFlow
```

Este XML contiene el contenido completo y corregido de `src/ai/flows/modify-project-structure-flow.ts`. He revisado meticulosamente la sintaxis, especialmente alrededor de la última llave de cierre del `try` principal y el inicio del `catch` principal.