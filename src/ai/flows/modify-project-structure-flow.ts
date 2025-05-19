
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
  ModifyProjectStructureInput,
  ProjectGenerationResult,
  GeneratedFile,
  ChatMessage,
} from '@/types';
import { AppError } from '@/utils/AppError';

// Re-define schemas here if not directly imported to avoid circular dependencies if types.ts also imports from flows
const GeneratedFileSchema = z.object({
  path: z.string().describe('Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'),
  content: z.string().describe('Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const ProjectGenerationResultSchemaForFlow = z.object({
  projectName: z.string().describe('Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'),
  aiNotes: z.string().describe('Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar.'),
  files: z.array(GeneratedFileSchema).describe('Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'),
  groupLog: z.string().optional().describe('Log de ejecución si la generación fue coordinada por un grupo.'),
});


const ModifyProjectStructureInputSchema = z.object({
  currentProject: ProjectGenerationResultSchemaForFlow.describe('El objeto ProjectGenerationResult actual, representando el estado actual del proyecto.'),
  modificationRequest: z.string().describe('La petición del usuario en lenguaje natural sobre cómo modificar el proyecto.'),
  chatHistory: z.array(ChatMessageSchema).optional().describe('Historial de la conversación de modificación, si existe.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente, si la modificación es impulsada por un agente específico o un contexto de grupo.'),
});

export async function modifyProjectStructure(
  input: ModifyProjectStructureInput
): Promise<ProjectGenerationResult> {
  return modifyProjectStructureFlowGenkit(input);
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

Estructura Actual del Proyecto (representada como una lista de objetos de archivo/carpeta):
\`\`\`json
{{{JSONstringify currentProject.files}}}
\`\`\`
Nombre Actual del Proyecto: "{{currentProject.projectName}}"
Notas Actuales de la IA: "{{currentProject.aiNotes}}"
{{#if chatHistory.length}}
Historial de Conversación de Modificación Previa:
{{#each chatHistory}}
- {{this.role}}: {{this.content}}
{{/each}}
{{/if}}

Petición de Modificación del Usuario:
"{{{modificationRequest}}}"

Instrucciones:
1.  Analiza la estructura actual del proyecto y la petición de modificación.
2.  Aplica los cambios solicitados a la lista de archivos. Esto puede implicar:
    *   **Añadir nuevos archivos/carpetas:** Especifica su 'path' y 'content'. Si creas un archivo dentro de una nueva carpeta, asegúrate de que la carpeta también esté declarada.
    *   **Modificar archivos existentes:** Actualiza el 'content' del archivo correspondiente en la lista.
    *   **Eliminar archivos/carpetas:** Omite el archivo/carpeta de la nueva lista de 'files'.
3.  **Mantén los archivos no afectados sin cambios.**
4.  El 'projectName' generalmente debe mantenerse a menos que la petición lo modifique explícitamente.
5.  Actualiza el campo 'aiNotes' para describir los cambios realizados, cualquier problema encontrado, o sugerencias adicionales. Si la petición es ambigua o irrealizable, explícalo en 'aiNotes' y devuelve la estructura del proyecto sin cambios significativos en 'files'.
6.  Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al schema de salida especificado (ProjectGenerationResultSchema), incluyendo 'projectName', 'aiNotes', y la nueva lista completa de 'files'. Asegúrate de que el contenido de los archivos sea lo más completo posible.
7.  Toda la salida debe estar en castellano.

Ejemplo de un objeto 'file' para una carpeta: \`{ "path": "src/", "content": "", "isFolder": true }\`
Ejemplo de un objeto 'file' para un archivo: \`{ "path": "src/index.js", "content": "console.log(\\"Hola Mundo\\");" }\`
`,
  helpers: {
    JSONstringify: (context: any) => {
      return JSON.stringify(context, null, 2);
    },
  },
});

const modifyProjectStructureFlowGenkit = ai.defineFlow(
  {
    name: 'modifyProjectStructureFlowInternal', // Renamed internal flow for clarity
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
      const processedFiles = output.files.map((file: GeneratedFile) => ({
        ...file,
        content: file.content ?? '',
        isFolder: file.isFolder ?? file.path.endsWith('/'),
      }));

      return { ...output, files: processedFiles };
    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error executing flow:`, error);
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
