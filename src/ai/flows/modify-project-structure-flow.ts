
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
  currentProject: ProjectGenerationResultSchemaForFlowInternal.describe("El objeto ProjectGenerationResult actual, representando el estado actual del proyecto."),
  modificationRequest: z.string().describe("La petición del usuario en lenguaje natural sobre cómo modificar el proyecto."),
  chatHistory: z.array(ChatMessageSchemaInternal).optional().describe("Historial de la conversación de modificación, si existe."),
  agentSystemPrompt: z.string().optional().describe("El prompt de sistema de un agente, si la modificación es impulsada por un agente específico o un contexto de grupo."),
  currentProjectFilesString: z.string().optional().describe('La estructura de archivos actual del proyecto como una cadena JSON.'),
});
export type ModifyProjectStructureInternalInput = z.infer<typeof ModifyProjectStructureInputSchemaInternal>;

const systemPromptInstructions = `
**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA JSON - ¡NO OMITIR NINGÚN CAMPO REQUERIDO!**
Tu respuesta DEBE ser un único objeto JSON.
Este objeto JSON DEBE tener las siguientes propiedades OBLIGATORIAS: \\\`projectName\\\` (string), \\\`aiNotes\\\` (string), y \\\`files\\\` (array).
LA AUSENCIA DE CUALQUIERA DE ESTOS CAMPOS O UN FORMATO INCORRECTO HARÁ QUE TU RESPUESTA SEA INVÁLIDA.
Si no estás seguro de cómo realizar una modificación o si la petición es ambigua, es PREFERIBLE que devuelvas la estructura de archivos original sin cambios en la propiedad \\\`files\\\`, y expliques la situación en \\\`aiNotes\\\`.
Si la \\\`modificationRequest\\\` es demasiado compleja, ambigua, o requeriría cambios en demasiados archivos, es PREFERIBLE que respondas indicándolo en \\\`aiNotes\\\` y devuelvas la estructura de \\\`files\\\` original sin modificar, en lugar de intentar una modificación parcial o incorrecta que pueda corromper el proyecto.

**Lista de Verificación de Salida JSON OBLIGATORIA:**
1.  **\\\`projectName\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** El nombre del proyecto. DEBE estar presente. Si la modificación no afecta el nombre, DEBES devolver el nombre del proyecto actual que se te proporcionó en 'input.currentProject.projectName'. Si por alguna razón no puedes determinarlo, usa el valor 'nombre-proyecto-indefinido'. ¡LA AUSENCIA DE ESTE CAMPO INVALIDARÁ TODA TU RESPUESTA!
2.  **\\\`aiNotes\\\` (string, OBLIGATORIO, NO SE PUEDE OMITIR):** Comentarios sobre los cambios realizados. Describe qué hiciste, por qué, y cualquier problema encontrado durante la modificación. Si la petición del usuario es ambigua o irrealizable, explícalo claramente aquí y devuelve la estructura del proyecto SIN cambios significativos en 'files' (pero actualiza 'aiNotes'). Si no hay notas nuevas o específicas, incluye un mensaje como "Modificación procesada según lo solicitado." ¡NO OMITIR ESTE CAMPO!
3.  **\\\`files\\\` (array de objetos GeneratedFile, OBLIGATORIO Y CRUCIALMENTE IMPORTANTE):** DEBES devolver la lista COMPLETA de TODOS los archivos y carpetas del proyecto DESPUÉS de tu modificación.
    *   **CRÍTICO: Si NO realizas NINGÚN cambio en la estructura o contenido de los archivos porque la petición de modificación no es clara, es demasiado compleja, o no aplica, DEBES DEVOLVER LA LISTA DE ARCHIVOS ORIGINAL COMPLETA (la que se te proporcionó en \\\`input.currentProject.files\\\` [accesible a través de \\\`input.currentProjectFilesString\\\`]) SIN NINGÚN CAMBIO EN ELLOS.**
    *   No omitas esta propiedad \\\`files\\\`. No devuelvas un array \\\`files\\\` vacío a menos que la petición explícita sea 'eliminar todos los archivos y confirmas que es seguro hacerlo'.
    *   Cada objeto \\\`GeneratedFile\\\` DENTRO del array \\\`files\\\` DEBE tener las propiedades \\\`path\\\` (string) y \\\`content\\\` (string). \\\`isFolder\\\` (boolean) es opcional.
    *   **Para añadir un archivo:** Inclúyelo en el array \\\`files\\\` con su \\\`path\\\` y \\\`content\\\`.
    *   **Para modificar un archivo:** Incluye el archivo con su \\\`path\\\` existente y el nuevo \\\`content\\\` completo.
    *   **Para eliminar un archivo:** Simplemente no lo incluyas en el nuevo array \\\`files\\\`.
    *   **Archivos no afectados:** TODOS los archivos del proyecto original que NO fueron afectados por la petición del usuario DEBEN ser incluidos en el array \\\`files\\\` exactamente como estaban, con su \\\`path\\\` y \\\`content\\\` originales.
    *   **Carpetas:** Si creas un archivo dentro de una nueva carpeta (ej. \\\`src/utils/newFile.js\\\` y la carpeta \\\`src/utils/\\\` no existía), asegúrate de que la carpeta también esté declarada como un objeto \\\`GeneratedFile\\\` con su \\\`path\\\` terminando en \\\`/\` (ej. \\\`{ "path": "src/utils/", "content": "", "isFolder": true }\\\`).
    *   El contenido de los archivos debe ser lo más completo y funcional posible.
    *   Si la \\\`modificationRequest\\\` es general (ej. 'hacerlo más modular', 'revisar errores'), enfócate en identificar **1 o 2 áreas específicas** donde puedas proponer un cambio concreto y aplicable. Describe estas áreas y los cambios en \\\`aiNotes\\\`. Si puedes aplicar directamente un cambio pequeño y seguro a un archivo, hazlo y actualiza su contenido en \\\`files\\\`. Si no, describe la refactorización mayor en \\\`aiNotes\\\` y devuelve la lista de \\\`files\\\` original.

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

\n${systemPromptInstructions}\n
`;


const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchemaInternal },
  output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
  prompt: mainPromptTemplate,
});

export async function modifyProjectStructure(
  flowInput: ModifyInputTypeFromTypes
): Promise<ProjectGenerationResult> {
  const flowName = 'modifyProjectStructureFlow';
  console.log(`[Flow: ${flowName}] Iniciando flujo con projectName: ${flowInput.currentProject.projectName}, request (inicio): ${flowInput.modificationRequest.substring(0,50)}...`);
  return modifyProjectStructureFlowGenkit(flowInput);
}

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
    let llmCallSucceeded = false;
    let llmResponseFromPrompt: any; 
    let outputFromLlm: z.infer<typeof ProjectGenerationResultSchemaForFlowInternal> | undefined;
    let criticalLlmInteractionError: any = null; 

    console.log(`[Flow: ${flowName}] Input recibido. ProjectName: ${flowInput.currentProject.projectName}, RequestLength: ${flowInput.modificationRequest.length}, NumFiles: ${flowInput.currentProject.files?.length}`);

    let currentProjectFilesString = "[]";
    try {
      const filesToSerialize = Array.isArray(flowInput.currentProject.files) ? flowInput.currentProject.files : [];
      currentProjectFilesString = JSON.stringify(filesToSerialize, null, 2);
    } catch (e: any) {
      console.error(`[Flow: ${flowName}] Error CRÍTICO al serializar flowInput.currentProject.files: `, e);
      accumulatedAiNotes += "[ERROR CRÍTICO INTERNO: No se pudieron serializar los archivos del proyecto actual para enviar a la IA. La modificación no es posible.]\n";
      return {
        projectName: flowInput.currentProject.projectName,
        aiNotes: accumulatedAiNotes,
        files: flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })),
        groupLog: flowInput.currentProject.groupLog
      };
    }
    
    const MAX_FILES_STRING_LENGTH = 35000; 
    if (currentProjectFilesString.length > MAX_FILES_STRING_LENGTH) {
      currentProjectFilesString = currentProjectFilesString.substring(0, MAX_FILES_STRING_LENGTH) + '\\n... (Archivos truncados por longitud)...';
      accumulatedAiNotes += "[ADVERTENCIA: El contexto de los archivos del proyecto era demasiado largo y fue truncado. La modificación podría ser incompleta.]\n";
      console.warn(`[Flow: ${flowName}] currentProjectFilesString truncado a ${MAX_FILES_STRING_LENGTH} chars.`);
    }

    const promptInputForHandlebars = {
      currentProject: {
          projectName: flowInput.currentProject.projectName,
          aiNotes: flowInput.currentProject.aiNotes,
          files: [], 
      },
      modificationRequest: flowInput.modificationRequest,
      chatHistory: flowInput.chatHistory || [],
      agentSystemPrompt: flowInput.agentSystemPrompt,
      currentProjectFilesString: currentProjectFilesString,
    };
    
    console.log(`[Flow: ${flowName}] DEBUG: Longitud de currentProjectFilesString para prompt: ${currentProjectFilesString.length}`);
    
    // Nested try-catch for critical LLM interaction
    try {
      console.log(`[Flow: ${flowName}] Intentando llamada a prompt()...`);
      llmResponseFromPrompt = await prompt(promptInputForHandlebars); // Genkit prompt function call
      outputFromLlm = llmResponseFromPrompt.output; // Genkit attempts to parse to ProjectGenerationResultSchemaForFlowInternal
      llmCallSucceeded = true; // Mark that the call itself (network, etc.) seemed to succeed

      let rawLLMOutputForLog = 'N/A';
      if (llmResponseFromPrompt.raw?.candidates?.[0]?.output) {
          try {
              const tempString = JSON.stringify(llmResponseFromPrompt.raw.candidates[0].output);
              rawLLMOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
          } catch (stringifyError: any) {
              rawLLMOutputForLog = `[Error al stringify la respuesta cruda: ${stringifyError.message}]`;
          }
      }
      console.log(`[Flow: ${flowName}] LLM output (parseado por Genkit): ${outputFromLlm ? JSON.stringify(outputFromLlm).substring(0,200)+'...' : 'undefined'}. Raw (truncado): ${rawLLMOutputForLog}`);

      if (llmResponseFromPrompt.usage?.promptInvalid) {
          try {
              schemaValidationErrorMsg = ` Detalles de validación de schema (Genkit): ${JSON.stringify(llmResponseFromPrompt.usage.promptInvalid).substring(0, 200)}`;
          } catch { schemaValidationErrorMsg = ` (Detalles de validación de Genkit no serializables).`; }
          console.warn(`[Flow: ${flowName}] Genkit schema validation info:`, llmResponseFromPrompt.usage.promptInvalid);
      }
      
      if (!outputFromLlm && llmCallSucceeded) { 
        const errorDetail = `La IA no devolvió una estructura válida (output nulo/undefined después del parseo de Genkit).${schemaValidationErrorMsg}`;
        console.error(`[Flow: ${flowName}] ${errorDetail}`, llmResponseFromPrompt.usage);
        accumulatedAiNotes += `\n[ERROR CRÍTICO DE IA: ${errorDetail}]`;
      }
    } catch (innerError: any) { 
        console.error(`[Flow: ${flowName}] Error CRÍTICO en llamada a prompt() o acceso a output (ej. Max Call Stack):`, innerError.message, innerError.name);
        if(innerError.stack) console.error(`[Flow: ${flowName}] Stack del error crítico interno:\n`, innerError.stack.substring(0, 500));
        criticalLlmInteractionError = innerError; 
        const errorMsg = innerError.message ? innerError.message.substring(0,100) : "Error desconocido en interacción con IA";
        accumulatedAiNotes += `\n[ERROR INTERNO GRAVE DEL FLUJO: Falló la comunicación con la IA (${errorMsg}). Se mantendrá la estructura original.]`;
        llmCallSucceeded = false; 
    }

    // Construct validatedOutput using fallbacks
    let finalProjectName = flowInput.currentProject.projectName;
    if (outputFromLlm && typeof outputFromLlm.projectName === 'string' && outputFromLlm.projectName.trim() !== '') {
      finalProjectName = outputFromLlm.projectName;
    } else if (llmCallSucceeded) { 
      accumulatedAiNotes += `[ADVERTENCIA IA: 'projectName' faltante o inválido. Usando original: '${finalProjectName}'. IA proveyó: '${String(outputFromLlm?.projectName)}'.]\n`;
    }

    let finalAiNotes = accumulatedAiNotes.trim();
    if (outputFromLlm && typeof outputFromLlm.aiNotes === 'string') {
      finalAiNotes = (finalAiNotes ? finalAiNotes + "\n" : "") + outputFromLlm.aiNotes;
    } else if (llmCallSucceeded && outputFromLlm && outputFromLlm.aiNotes !== undefined ) {
       finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' no era un string válido. Recibido: '${String(outputFromLlm.aiNotes)}'.]`;
    } else if (llmCallSucceeded) {
       finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA: 'aiNotes' NO fue proporcionado por la IA.]`;
    }
    
    let finalFiles: GeneratedFileTypeFromTypes[];
    if (llmCallSucceeded && outputFromLlm && Array.isArray(outputFromLlm.files) && outputFromLlm.files.length >= 0) { // Allow empty array if IA intends to delete all
        finalFiles = outputFromLlm.files.map((file: Partial<GeneratedFileInternal>, index: number) => {
          let filePath = file.path;
          let fileContent = file.content;
          if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
            filePath = `archivo-generado-sin-ruta-${index}-${Date.now()}.txt`;
            finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${index + 1}]: Ruta faltante. Usada: '${filePath}'. Original: '${String(file.path)}'.`;
          }
          if (typeof fileContent !== 'string') {
            fileContent = `// Contenido no proporcionado/inválido por IA para ${filePath}`;
            finalAiNotes += (finalAiNotes ? "\n" : "") + `[ADVERTENCIA IA - Archivo ${filePath}]: Contenido no string. Original: '${String(file.content)}'.`;
          }
          return {
            path: filePath.trim(),
            content: fileContent ?? '', 
            isFolder: typeof file.isFolder === 'boolean' ? file.isFolder : filePath.trim().endsWith('/'),
          } as GeneratedFileTypeFromTypes;
        });
         if (outputFromLlm.files.length === 0 && flowInput.currentProject.files.length > 0 && !flowInput.modificationRequest.toLowerCase().includes("eliminar todos los archivos")) {
            finalAiNotes += (finalAiNotes.trim() ? "\n\n" : "") + "[ADVERTENCIA IA: La IA devolvió una lista de archivos vacía sin una instrucción explícita de eliminar todo. Podría ser un error. La modificación solicitada podría no haberse aplicado o haber resultado en la eliminación de todos los archivos.]";
        }
    } else { 
        finalFiles = flowInput.currentProject.files.map(f => ({ path: f.path, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') })); 
        if (llmCallSucceeded) { 
          finalAiNotes += (finalAiNotes.trim() ? "\n\n" : "") + "[ERROR CRÍTICO DE IA: La IA no devolvió una lista de archivos válida (`files`). La modificación solicitada NO se aplicó. Se MANTIENE la estructura de archivos previa.]";
        }
        console.warn(`[Flow: ${flowName}] 'files' inválido o llamada LLM falló. Usando archivos originales. Output.files:`, outputFromLlm?.files);
    }
      
    const validatedOutput: ProjectGenerationResult = {
      projectName: finalProjectName,
      aiNotes: finalAiNotes.trim() || (criticalLlmInteractionError ? `Error en llamada a IA: ${criticalLlmInteractionError.message || "Error desconocido"}` : "Notas no proporcionadas."),
      files: finalFiles,
      groupLog: outputFromLlm?.groupLog, 
    };
              
    if (criticalLlmInteractionError) {
        console.error(`[Flow: ${flowName}] Relanzando error crítico (${criticalLlmInteractionError.name || 'Error desconocido'}) de interacción con LLM después de construir fallback.`);
        throw criticalLlmInteractionError; 
    }
            
    console.log(`[Flow: ${flowName}] Modificación procesada. Devolviendo output. Proyecto: ${validatedOutput.projectName}, Archivos: ${validatedOutput.files.length}`);
    return validatedOutput;

  } catch (error: any) { 
    const originalErrorMessage = error?.message ? String(error.message) : 'Error desconocido en el flujo de modificación.';
    
    console.error(`[Flow: ${flowName}] Error ORIGINAL CAPTURADO en el catch principal (mensaje): ${originalErrorMessage}`);
    if (error instanceof Error && error.stack) {
      console.error(`[Flow: ${flowName}] Stack del error original (catch principal):\n`, error.stack.substring(0, 1000));
    }
    
    let genkitValidationInfo = schemaValidationErrorMsg; 
    if (!genkitValidationInfo && error?.name === 'ZodError' && error.errors) {
        genkitValidationInfo = ` Error de validación Zod: ${error.errors[0]?.message || 'Múltiples errores.'}`;
    } else if (!genkitValidationInfo && error?.code === 'INVALID_ARGUMENT' && error?.message?.includes('Schema validation failed')) {
        genkitValidationInfo = ` ${error.message.substring(0, 200)}`;
    }
    
    const detailsForUser = originalErrorMessage.substring(0, 100) + (originalErrorMessage.length > 100 ? '...' : '');

    const errorDetailsForAppError: any = {
        message: originalErrorMessage.substring(0, 500) + (originalErrorMessage.length > 500 ? '...' : ''),
        name: error?.name,
        genkitValidationInfo: genkitValidationInfo || undefined,
    };
    
    if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
        errorDetailsForAppError.stackHint = error.stack.substring(0, 300) + "...";
    }
    
    if (error instanceof AppError && error.message.startsWith('FALLO_EN_FLUJO_MODIFY_PROJECT:')) {
        throw error; 
    }
    throw new AppError(
      `FALLO_EN_FLUJO_MODIFY_PROJECT: ${detailsForUser}${genkitValidationInfo}`,
      errorDetailsForAppError, 
      'ai'
    );
  }
);
