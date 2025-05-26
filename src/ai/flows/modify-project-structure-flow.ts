
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
    .optional() // Made optional in Zod schema to allow Genkit to parse even if LLM omits it
    .describe(
      'El nombre del proyecto. Si no cambia, debe ser el mismo que el proyecto actual. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  aiNotes: z
    .string({ invalid_type_error: "La propiedad 'aiNotes' debe ser un string."})
    .optional() // Made optional in Zod schema
    .describe(
      'Comentarios o notas de la IA sobre los cambios realizados o problemas encontrados. ¡NO OMITIR ESTE CAMPO EN LA RESPUESTA JSON!'
    ),
  files: z
    .array(GeneratedFileSchemaInternal, { invalid_type_error: "La propiedad 'files' debe ser un array de objetos archivo."})
    .optional() // Made optional in Zod schema
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

// Schema Zod para el input del prompt (el objeto que se pasa a prompt())
const ModifyProjectStructureInputSchemaInternal = z.object({
  currentProject: z.object({
      projectName: z.string(),
      aiNotes: z.string().optional(),
      // files: z.array(GeneratedFileSchemaInternal) // Se pasa como currentProjectFilesString
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
    *   **CRÍTICO: Si NO realizas NINGÚN cambio en la estructura o contenido de los archivos porque la petición de modificación no es clara, es demasiado compleja, o no aplica, DEBES DEVOLVER LA LISTA DE ARCHIVOS ORIGINAL COMPLETA (la propiedad 'files') que se te proporcionó en \`input.currentProject.files\` [accesible a través de la variable \`input.currentProjectFilesString\` que contiene el JSON de los archivos actuales] SIN NINGÚN CAMBIO EN ELLOS.**
    *   No omitas esta propiedad \\\`files\\\`. No devuelvas un array \\\`files\\\` vacío a menos que la petición explícita sea 'eliminar todos los archivos y confirmas que es seguro hacerlo'.
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
  input: { schema: ModifyProjectStructureInputSchemaInternal }, // Schema para el objeto { input: { ... } }
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
  // Cast es seguro aquí si ModifyInputTypeFromTypes es estructuralmente compatible
  // con lo que espera modifyProjectStructureFlowGenkit (ModifyProjectStructureInternalInput dentro de un objeto 'input')
  console.log(`[Flow: modifyProjectStructureFlow] Iniciando flujo con projectName: ${flowInput.currentProject.projectName}, request (inicio): ${flowInput.modificationRequest.substring(0,50)}...`);
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
    name: 'modifyProjectStructureFlowInternal', // Renombrado para evitar conflicto de exportación si es necesario
    inputSchema: z.custom<ModifyInputTypeFromTypes>(), // El input externo es ModifyInputTypeFromTypes
    outputSchema: ProjectGenerationResultSchemaForFlowInternal,
  },
  async (flowInput: ModifyInputTypeFromTypes): Promise<ProjectGenerationResult> => {
    const flowName = 'modifyProjectStructureFlow';
    let accumulatedAiNotes = flowInput.currentProject.aiNotes || "Notas iniciales del proyecto.";
    let schemaValidationErrorMsg = "";
    
    const errorDetailsForAppError: any = {
        inputToFlow: {
            projectName: flowInput.currentProject.projectName,
            modificationRequest: flowInput.modificationRequest.substring(0, 200) + "...",
            numCurrentFiles: flowInput.currentProject.files?.length,
            agentSystemPromptProvided: !!flowInput.agentSystemPrompt,
        }
    };

    const currentProjectFilesString = JSON.stringify(flowInput.currentProject.files || [], null, 2);

    // Objeto que se pasará a la plantilla Handlebars
    const promptInputForHandlebars: ModifyProjectStructureInternalInput = {
      currentProject: { 
          projectName: flowInput.currentProject.projectName,
          aiNotes: flowInput.currentProject.aiNotes
          // files no se pasa aquí directamente, se pasa como currentProjectFilesString
      },
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    
    // Para logging, reconstruimos aproximadamente el prompt final
    let approxFinalPromptForLog = mainPromptTemplate
        .replace("{{{input.currentProjectFilesString}}}", currentProjectFilesString)
        .replace("{{{input.modificationRequest}}}", flowInput.modificationRequest)
        .replace("{{input.currentProject.projectName}}", flowInput.currentProject.projectName)
        .replace("{{input.currentProject.aiNotes}}", flowInput.currentProject.aiNotes || "");

    if(flowInput.agentSystemPrompt) {
        approxFinalPromptForLog = approxFinalPromptForLog.replace("{{{input.agentSystemPrompt}}}", flowInput.agentSystemPrompt);
    }
    approxFinalPromptForLog = approxFinalPromptForLog.replace("${systemPromptInstructions}", systemPromptInstructions);

    console.log(`[Flow: ${flowName}] DEBUG: Prompt final que se enviará al LLM (longitud: ${approxFinalPromptForLog.length}). Inicio (primeros 300 chars): ${approxFinalPromptForLog.substring(0, 300)}... Fin (últimos 200 chars): ...${approxFinalPromptForLog.substring(approxFinalPromptForLog.length - 200)}`);
    console.log(`[Flow: ${flowName}] DEBUG: Prompt input para Handlebars (solo claves):`, Object.keys(promptInputForHandlebars));
    // console.log(`[Flow: ${flowName}] DEBUG: Prompt input para Handlebars (contenido truncado):`, inspect(promptInputForHandlebars, {depth: 1}).substring(0, 2000) + '...');


    try {
      console.log(`[Flow: ${flowName}] Iniciado con petición (inicio): ${flowInput.modificationRequest.substring(0, 100)}...`);
      
      // La llamada al prompt ahora debe ser con el objeto wrapper { input: promptInputForHandlebars }
      const llmResponse = await prompt({ input: promptInputForHandlebars });
      const output = llmResponse.output;

      let rawLLMOutputForLog = 'N/A';
      if (llmResponse.raw?.candidates?.[0]?.output) {
          try {
              const tempString = JSON.stringify(llmResponse.raw.candidates[0].output);
              rawLLMOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
          } catch (stringifyError) {
              rawLLMOutputForLog = '[Error al stringify la respuesta cruda para el log]';
              console.error(`[Flow: ${flowName}] Error al stringify la respuesta cruda del LLM para logging:`, stringifyError);
          }
      }
      console.log(`[Flow: ${flowName}] LLM output (parseado por Genkit):`, output ? JSON.stringify(output).substring(0,500)+'...' : 'undefined', `Raw (truncado): ${rawLLMOutputForLog}`);

      if (llmResponse.usage?.promptInvalid) { // Genkit puede popular esto si la respuesta del LLM no valida contra el schema
          try {
              schemaValidationErrorMsg = ` Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid).substring(0, 300)}`;
          } catch { schemaValidationErrorMsg = ` (Detalles de validación de Genkit no pudieron ser serializados).`; }
          console.warn(`[Flow: ${flowName}] Genkit schema validation info:`, llmResponse.usage.promptInvalid);
          errorDetailsForAppError.genkitValidationError = llmResponse.usage.promptInvalid;
      }
      
      if (!output) { // Si Genkit no pudo parsear la salida al schema o el LLM no devolvió nada
        const errorMsg = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${schemaValidationErrorMsg}`;
        console.error(`[Flow: ${flowName}] ${errorMsg}`, llmResponse.usage);
        errorDetailsForAppError.llmUsage = llmResponse.usage;
        throw new AppError( errorMsg, errorDetailsForAppError, 'ai' );
      }

      // Fallbacks agresivos para asegurar que el objeto devuelto tenga la estructura esperada
      let finalProjectName = flowInput.currentProject.projectName; 
      if (output.projectName && typeof output.projectName === 'string' && output.projectName.trim() !== '') {
        finalProjectName = output.projectName;
      } else {
        accumulatedAiNotes += `\n[ADVERTENCIA IA CRÍTICA: 'projectName' NO fue proporcionado por la IA o era inválido. Se ha utilizado el nombre del proyecto original: '${finalProjectName}'. Respuesta de IA para projectName: '${String(output.projectName)}'.]`;
      }

      let finalAiNotes = accumulatedAiNotes.trim() || "Notas no proporcionadas por la IA.";
      if (output.aiNotes && typeof output.aiNotes === 'string') {
        finalAiNotes = (finalAiNotes === "Notas no proporcionadas por la IA." ? "" : finalAiNotes + "\n") + output.aiNotes;
      } else if (output.aiNotes !== undefined){
         finalAiNotes += `\n[ADVERTENCIA IA: 'aiNotes' fue proporcionado por la IA pero no era un string válido: '${String(output.aiNotes)}'.]`;
      } else {
         finalAiNotes += `\n[ADVERTENCIA IA: 'aiNotes' NO fue proporcionado por la IA.]`;
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
              content: fileContent ?? '', 
              isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
            } as GeneratedFileTypeFromTypes;
          });
      } else { // Si output.files no es un array válido o está vacío
          finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
          finalAiNotes += (finalAiNotes.trim() ? "\n" : "") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida ('files') o devolvió una lista vacía sin una instrucción explícita para eliminar todos los archivos. La modificación solicitada NO se aplicó a los archivos. Se ha MANTENIDO la estructura de archivos previa a esta solicitud de modificación.]";
      }
      
      const validatedOutput: ProjectGenerationResult = {
        projectName: finalProjectName,
        aiNotes: finalAiNotes.trim(),
        files: finalFiles,
        groupLog: output.groupLog, 
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
          details: error.details, 
          cause: error.cause
      };
      
      if (error.name === 'ZodError' && error.errors) {
        try { schemaValidationErrorMsg = ` Error de validación Zod: ${JSON.stringify(error.errors).substring(0, 300)}...`; }
        catch { schemaValidationErrorMsg = ` Error de validación Zod (no pudo ser serializado). Primer error: ${error.errors[0]?.message || 'Múltiples errores.'}`; }
      } else if (error?.llmUsage?.promptInvalid) { // Check again for genkit validation info in the caught error
            try {
                schemaValidationErrorMsg = ` Detalles de validación de Genkit (del error): ${JSON.stringify(error.llmUsage.promptInvalid).substring(0,300)}`;
            } catch { schemaValidationErrorMsg = " (Detalles de validación de Genkit no serializables)"; }
      } else if (schemaValidationErrorMsg.includes("Genkit schema validation info:")) { 
            // schemaValidationErrorMsg already populated from llmResponse.usage
      }
      
      const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

      if (error instanceof AppError) { 
        error.friendlyMessage = `FALLO_EN_FLUJO_MODIFY_PROJECT: ${error.friendlyMessage}${schemaValidationErrorMsg}`;
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

    
