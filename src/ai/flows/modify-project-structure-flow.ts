
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
  ModifyProjectStructureInput as ModifyInputType, // Renamed to avoid conflict with Zod schema
  ProjectGenerationResult,
  GeneratedFile,
  ChatMessage,
} from '@/types';
import { AppError } from '@/utils/AppError';

// Local Zod schemas for this flow to avoid potential circular dependencies
// if types.ts also needs to import from flows.
const GeneratedFileSchema = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const ProjectGenerationResultSchemaForFlow = z.object({
  projectName: z
    .string()
    .describe(
      'Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'
    ),
  aiNotes: z
    .string()
    .describe(
      'Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar.'
    ),
  files: z
    .array(GeneratedFileSchema)
    .describe(
      'Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'
    ),
  groupLog: z
    .string()
    .optional()
    .describe('Log de ejecución si la generación fue coordinada por un grupo.'),
});

const ModifyProjectStructureInputSchema = z.object({
  currentProject: ProjectGenerationResultSchemaForFlow.describe(
    'El objeto ProjectGenerationResult actual, representando el estado actual del proyecto.'
  ),
  modificationRequest: z
    .string()
    .describe(
      'La petición del usuario en lenguaje natural sobre cómo modificar el proyecto.'
    ),
  chatHistory: z
    .array(ChatMessageSchema)
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
});

export async function modifyProjectStructure(
  input: ModifyInputType // Use the aliased type here
): Promise<ProjectGenerationResult> {
  // Cast to the Zod schema type if necessary, or ensure ModifyInputType matches Zod schema structure
  return modifyProjectStructureFlowGenkit(
    input as z.infer<typeof ModifyProjectStructureInputSchema>
  );
}

const prompt = ai.definePrompt({
  name: 'modifyProjectStructurePrompt',
  input: { schema: ModifyProjectStructureInputSchema },
  output: { schema: ProjectGenerationResultSchemaForFlow },
  prompt: `{{#if agentSystemPrompt}}
{{{agentSystemPrompt}}}

Considerando tu rol y especialización, y basado en la siguiente estructura de proyecto actual y la petición de modificación del usuario, actualiza la estructura del proyecto.
{{else}}
Eres un desarrollador de software experto. Tu tarea es modificar una estructura de proyecto existente (archivos y carpetas) basándote en la petición del usuario.
{{/if}}

Estructura Actual del Proyecto (Nombre: "{{currentProject.projectName}}", Notas Actuales: "{{currentProject.aiNotes}}", Lista de Archivos JSON):
\`\`\`json
{{{JSONstringify currentProject.files}}}
\`\`\`
{{#if chatHistory.length}}
Historial de Conversación de Modificación Previa:
{{#each chatHistory}}
- Rol: {{this.role}}, Contenido: {{this.content}}
{{/each}}
{{/if}}

Petición de Modificación del Usuario:
"{{{modificationRequest}}}"

Instrucciones Detalladas:
1.  Analiza cuidadosamente la estructura actual del proyecto y la petición de modificación.
2.  Aplica los cambios solicitados a la lista de archivos. Esto puede implicar:
    *   **Añadir nuevos archivos/carpetas:** Especifica su 'path' y 'content' completo y funcional. Si creas un archivo dentro de una nueva carpeta, asegúrate de que la carpeta también esté declarada explícitamente con 'isFolder: true' y 'content: \"\"'. Las rutas de carpeta DEBEN terminar con '/'.
    *   **Modificar archivos existentes:** Actualiza el 'content' del archivo correspondiente en la lista. Asegúrate de que el contenido sea completo.
    *   **Eliminar archivos/carpetas:** Omite el archivo/carpeta de la nueva lista de 'files'.
3.  **IMPORTANTE: Mantén todos los archivos no afectados por la petición del usuario exactamente sin cambios en la nueva lista de 'files'.**
4.  El 'projectName' generalmente debe mantenerse igual al de 'currentProject.projectName', a menos que la petición de modificación lo cambie explícitamente.
5.  Actualiza el campo 'aiNotes' para describir los cambios realizados, cualquier problema encontrado durante la modificación, o sugerencias adicionales. Si la petición del usuario es ambigua, irrealizable o incompleta, explícalo claramente en 'aiNotes' y devuelve la estructura del proyecto SIN cambios significativos en 'files'.
6.  Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al schema de salida especificado (ProjectGenerationResultSchemaForFlow), incluyendo 'projectName', 'aiNotes', y la nueva lista completa de 'files'. Asegúrate de que el contenido de los archivos sea lo más completo y funcional posible.
7.  Toda la salida (nombres de archivo, contenido, notas) debe estar en castellano.

Ejemplo de un objeto 'file' para una carpeta: \`{ "path": "src/", "content": "", "isFolder": true }\`
Ejemplo de un objeto 'file' para un archivo: \`{ "path": "src/index.js", "content": "console.log(\\"Hola Mundo\\");" }\`
Asegúrate de que el JSON de salida sea válido y completo.
`,
  helpers: {
    JSONstringify: (context: any) => {
      return JSON.stringify(context, null, 2);
    },
  },
});

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal',
    inputSchema: ModifyProjectStructureInputSchema,
    outputSchema: ProjectGenerationResultSchemaForFlow,
  },
  async (input) => {
    const flowName = 'modifyProjectStructureFlow';
    try {
      const llmResponse = await prompt(input);
      const output = llmResponse.output;

      if (!output) {
        console.error(`[Flow: ${flowName}] No output from LLM.`);
        throw new AppError(
          'La IA no pudo modificar la estructura del proyecto.',
          { originalError: 'No output from LLM' },
          'ai'
        );
      }

      // Ensure files have isFolder correctly set if path ends with /
      // and content is not undefined
      const processedFiles = output.files.map((file: GeneratedFile) => ({
        ...file,
        content: file.content ?? '', // Ensure content is always a string
        isFolder: file.isFolder ?? file.path.endsWith('/'),
      }));

      return { ...output, files: processedFiles };
    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado antes de lanzar AppError:`, error);
      if (error.stack) {
        console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      }
      if (error.details) { // Algunos errores de Genkit/Google pueden tener 'details'
        console.error(`[Flow: ${flowName}] Detalles del error original:`, error.details);
      }
      if (error.cause) { // Errores anidados
         console.error(`[Flow: ${flowName}] Causa del error original:`, error.cause);
      }

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Ocurrió un error en el flujo de modificación de estructura de proyecto.',
        error,
        'ai'
      );
    }
  }
);
