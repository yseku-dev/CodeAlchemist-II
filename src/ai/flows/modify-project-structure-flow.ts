
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
    .min(1, { message: "La propiedad 'projectName' no puede ser una cadena vacía." })
    .optional() // Made optional in Zod schema for Genkit validation if LLM omits
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. ¡NO OMITIR ESTE CAMPO!'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // Made optional
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. ¡NO OMITIR ESTE CAMPO!'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // Made optional
    .describe(
      'Una lista de archivos y carpetas que representan la ESTRUCTURA COMPLETA DEL PROYECTO DESPUÉS DE LA MODIFICACIÓN. ¡NO OMITIR ESTE CAMPO!'
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
  "files": [
    {
      "path": "string (OBLIGATORIO, ej: src/components/Button.tsx. Las carpetas DEBEN terminar con /)",
      "content": "string (OBLIGATORIO, contenido completo del archivo. Vacío \\"\\" para carpetas o si no hay contenido.)",
      "isFolder": "boolean (opcional, se infiere de path si termina en /)"
    }
  ]
}
\\\`\\\`\\\`

Instrucciones Adicionales para el JSON y la Lógica de Modificación:
1.  **\\\`projectName\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'. Si por alguna razón no puedes determinarlo, usa el valor 'nombre-proyecto-indefinido'. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\\\`aiNotes\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO Y CRUCIALMENTE IMPORTANTE):** DEBES devolver la lista COMPLETA de TODOS los archivos y carpetas del proyecto DESPUÉS de tu modificación.
    *   **Si NO realizas NINGÚN cambio en la estructura o contenido de los archivos porque la petición de modificación no es clara, es demasiado compleja, o no aplica, DEBES DEVOLVER LA LISTA DE ARCHIVOS ORIGINAL COMPLETA (`files`) que se te proporcionó en `input.currentProject.files` (accesible a través de `input.currentProjectFilesString`) SIN NINGÚN CAMBIO EN ELLOS.**
    *   No omitas esta propiedad \`files\`. No devuelvas un array \`files\` vacío a menos que la petición explícita sea 'eliminar todos los archivos y confirmas que es seguro hacerlo'.
    *   Cada objeto \\\`GeneratedFile\\\` DENTRO del array \\\`files\\\` DEBE tener las propiedades \\\`path\\\` (string) y \\\`content\\\` (string). \\\`isFolder\\\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \\\`files\\\` con su \\\`path\\\` y \\\`content\\\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \\\`path\\\` existente y el nuevo \\\`content\\\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \\\`files\\\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \\\`files\\\` exactamente como estaban, con su \\\`path\\\` y \\\`content\\\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \\\`src/utils/newFile.js\\\` y \\\`src/utils/\\\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \\\`GeneratedFile\\\` con su \\\`path\\\` terminando en \\\`/\` (ej. \\\`{ "path": "src/utils/", "content": "", "isFolder": true }\\\`).
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

Estructura Actual del Proyecto (objeto \`input.currentProject\`), los archivos están en \`input.currentProjectFilesString\`:
Nombre del Proyecto Actual: "{{input.currentProject.projectName}}"
Notas Actuales de IA sobre el proyecto (puedes añadir a estas notas o reemplazarlas): "{{input.currentProject.aiNotes}}"
Lista de Archivos Actuales (JSON de \`input.currentProject.files\`, como string en \`input.currentProjectFilesString\`):
\\\`\\\`\\\`json
{{{input.currentProjectFilesString}}}
\\\`\\\`\\\`
{{#if input.chatHistory.length}}
Historial de Conversación de Modificación Previa (el último mensaje es el más reciente, objeto \`input.chatHistory\`):
{{#each input.chatHistory}}
- Rol: {{this.role}}, Contenido: "{{this.content}}"
{{/each}}
{{/if}}

Petición de Modificación del Usuario (esta es la tarea principal que debes realizar sobre la estructura actual, objeto \`input.modificationRequest\`):
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
  console.log(`[Flow: modifyProjectStructureFlow] Iniciando flujo con projectName: ${flowInput.currentProject.projectName}, request: ${flowInput.modificationRequest.substring(0,50)}...`);
  return modifyProjectStructureFlowGenkit(
    flowInput as ModifyProjectStructureInternalInput
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
    const flowName = 'modifyProjectStructureFlowInternal';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let schemaValidationErrorMsg = "";
    let errorDetailsForAppError: any = {
        inputToFlow: {
            projectName: flowInput.currentProject.projectName,
            modificationRequest: flowInput.modificationRequest.substring(0, 200) + "...",
            numCurrentFiles: flowInput.currentProject.files?.length,
            agentSystemPromptProvided: !!flowInput.agentSystemPrompt,
        }
    };

    const currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);
    const promptInputForHandlebars = {
      currentProject: { // Pasamos solo lo necesario para el prompt, no todo el flowInput.currentProject
          projectName: flowInput.currentProject.projectName,
          aiNotes: flowInput.currentProject.aiNotes
      },
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    
    // Debugging: Log the exact prompt that will be sent to the LLM (approximate as Handlebars does final interpolation)
    // This is very verbose and should ideally be conditional or truncated for production logs.
    let approxFinalPrompt = mainPromptTemplate
        .replace("{{{input.currentProjectFilesString}}}", currentProjectFilesString)
        .replace("{{{input.modificationRequest}}}", flowInput.modificationRequest)
        .replace("{{input.currentProject.projectName}}", flowInput.currentProject.projectName)
        .replace("{{input.currentProject.aiNotes}}", flowInput.currentProject.aiNotes || "");
    if(flowInput.agentSystemPrompt) {
        approxFinalPrompt = approxFinalPrompt.replace("{{{input.agentSystemPrompt}}}", flowInput.agentSystemPrompt);
    }
    // console.log(`[Flow: ${flowName}] DEBUG: Aproximación del prompt final enviado al LLM (longitud: ${approxFinalPrompt.length}). Inicio: ${approxFinalPrompt.substring(0, 200)}... Fin: ...${approxFinalPrompt.substring(approxFinalPrompt.length - 200)}`);
    console.log(`[Flow: ${flowName}] Longitud de currentProjectFilesString: ${currentProjectFilesString.length}`);


    try {
      console.log(`[Flow: ${flowName}] Iniciado con petición (inicio): ${flowInput.modificationRequest.substring(0, 100)}...`);
      
      const llmResponse = await prompt(promptInputForHandlebars);
      const output = llmResponse.output; // This is the object parsed by Genkit according to ProjectGenerationResultSchemaForFlowInternal (if output format is 'json')

      let genkitValidationInfo = "";
      if (llmResponse.usage?.promptInvalid) {
          try {
              genkitValidationInfo = ` Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 500)}`;
          } catch { genkitValidationInfo = ` Detalles de validación de Genkit no pudieron ser serializados.`; }
          console.warn(`[Flow: ${flowName}] Genkit schema validation info:`, llmResponse.usage.promptInvalid);
          errorDetailsForAppError.genkitValidationError = llmResponse.usage.promptInvalid;
      }
      
      // Log the raw output for debugging, truncated
      let rawLLMOutputForLog = 'N/A';
      if (llmResponse.raw?.candidates?.[0]?.output) {
          try {
              const tempString = JSON.stringify(llmResponse.raw.candidates[0].output);
              rawLLMOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
          } catch (stringifyError) {
              rawLLMOutputForLog = '[Error al stringify la respuesta cruda para el log - posible objeto circular o muy grande]';
              console.error(`[Flow: ${flowName}] Error al stringify la respuesta cruda del LLM:`, stringifyError);
          }
      }
      console.log(`[Flow: ${flowName}] LLM output (parseado por Genkit, si tuvo éxito):`, output ? JSON.stringify(output).substring(0,500)+'...' : 'undefined', `Raw (truncado): ${rawLLMOutputForLog}`);


      if (!output) { // LLM response was not parseable to the schema by Genkit, or LLM returned nothing.
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${genkitValidationInfo}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        errorDetailsForAppError.llmUsage = llmResponse.usage;
        throw new AppError( errorMsg, errorDetailsForAppError, 'ai' );
      }

      // Start building the final validated output, applying fallbacks
      let finalProjectName = flowInput.currentProject.projectName; // Default to original
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA CRÍTICA: 'projectName' NO fue proporcionado por la IA o era inválido. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Esto indica un fallo del LLM en seguir el schema.]`;
      }

      let finalAiNotes = accumulatedAiNotes; // Start with any previous notes
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" || finalAiNotes === "Notas iniciales del proyecto." ? "" : "\n") + output.aiNotes;
      } else {
         finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" || finalAiNotes === "Notas iniciales del proyecto." ? "" : "\n") + "[ADVERTENCIA IA: La IA no proporcionó 'aiNotes' como un string válido o estaba vacío. Se utilizaron notas previas o un mensaje por defecto.]";
      }
      
      let finalFiles: GeneratedFileTypeFromTypes[];
      if (Array.isArray(output.files) && output.files.length > 0) {
          finalFiles = output.files.map((file: Partial<GeneratedFileInternal>, index: number) => {
            let filePath = file.path;
            let fileContent = file.content;
            if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
              filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
              finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta de archivo faltante o inválida en la respuesta de la IA. Se usó: '${filePath}'. Path original de IA: '${String(file.path)}'.`;
            }
            if (typeof fileContent !== 'string') {
              fileContent = `// Contenido no proporcionado o inválido por la IA para ${filePath}`;
              finalAiNotes += `\n[ADVERTENCIA IA - Archivo ${filePath}]: Contenido no era string en la respuesta de la IA. Se usó placeholder. Contenido original de IA: '${String(file.content)}'.`;
            }
            return {
              path: filePath.trim(),
              content: fileContent ?? '', // Ensure content is always a string
              isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
            } as GeneratedFileTypeFromTypes;
          });
      } else {
          // If IA omits 'files' or returns empty array, restore original files
          finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
          finalAiNotes += (finalAiNotes.endsWith("\n") || finalAiNotes === "" || finalAiNotes === "Notas iniciales del proyecto." ? "" : "\n") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida ('files') o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]";
      }
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: finalFiles,
        groupLog: output.groupLog, // Pass through if present
      };
            
      console.log(`[Flow: ${flowName}] Modificación procesada (o restaurada a original si hubo error IA). Devolviendo output. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}, Notas (inicio): ${(validatedOutput.aiNotes || "").substring(0,100)}`);
      return validatedOutput;

    } catch (error: any) {
      const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
      console.error(`[Flow: ${flowName}] Error ORIGINAL CAPTURADO (inspeccionado):`, inspect(error, {depth: 3}));
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      
      errorDetailsForAppError.originalErrorContent = {
          message: error.message,
          name: error.name,
          // stack: error.stack?.substring(0, 500) + "...",
          details: error.details, 
          cause: error.cause
      };

      let genkitValidationInfoForError = "";
       if (error?.llmUsage?.promptInvalid) { // Check if error itself has llmUsage
            try {
                genkitValidationInfoForError = ` Detalles de validación de Genkit (del error): ${JSON.stringify(error.llmUsage.promptInvalid).substring(0,300)}`;
            } catch { genkitValidationInfoForError = " (Detalles de validación de Genkit no serializables)"; }
        } else if (schemaValidationErrorMsg) { // Use previously captured schemaValidationErrorMsg
            genkitValidationInfoForError = schemaValidationErrorMsg;
        }

      if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg += ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg += ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
      }
      
      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

      if (error instanceof AppError) { 
        // Prepend flow-specific context to the friendly message if it's a generic AppError from a deeper call
        error.friendlyMessage = `FALLO_EN_FLUJO_MODIFY_PROJECT: ${error.friendlyMessage}${genkitValidationInfoForError}`;
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

```