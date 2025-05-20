
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow can operate in two modes:
 * 1. Single Prompt Mode (Global Settings / Individual Agent context not acting as orchestrator):
 *    Makes a single call to an LLM to generate the entire project structure.
 * 2. Contextualized Single Prompt Mode (Group or Orchestrator Agent context):
 *    Makes a single call to an LLM, contextualized by the agent's/orchestrator's system prompt,
 *    instructing it to generate the entire project structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  GenerateProjectInput as GenerateProjectInputType,
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes,
} from '@/types';
import { AppError } from '@/utils/AppError';
import { DEFAULT_AGENTS } from '@/lib/constants'; // For getAgentSystemPrompt if needed

// Local Zod schemas for this flow
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .optional() // Content can be initially undefined for folders or if generated later
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas o si se genera por separado.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});
type GeneratedFileInternal = z.infer<typeof GeneratedFileSchemaInternal>;

const ProjectGenerationResultSchemaForFlowInternal = z.object({
  projectName: z
    .string()
    .describe(
      'Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'
    ),
  aiNotes: z
    .string()
    .describe(
      'Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar. Si ocurre un error interno, debe describirse aquí.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal)
    .describe(
      'Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'
    ),
  // groupLog is intentionally optional here, as this flow might not always produce a detailed group log
  groupLog: z.string().optional().describe('Log de ejecución del grupo si aplica.'),
});

const GenerateProjectInputSchemaInternal = z.object({
  description: z
    .string()
    .describe('Descripción detallada del proyecto a generar.'),
  agentSystemPrompt: z
    .string()
    .optional()
    .describe(
      'El prompt de sistema de un agente orquestador o el agente seleccionado. Si se proporciona, el flujo operará en modo contextualizado.'
    ),
});

/**
 * Generates a project structure based on a user's description.
 * If an agentSystemPrompt is provided (e.g., from a selected Agent or Group's orchestrator),
 * it contextualizes a single LLM call to generate the project.
 * Otherwise, it uses a default prompt for project generation.
 *
 * @param {GenerateProjectInputType} input - The input containing the project description and optional agent context.
 * @returns {Promise<ProjectGenerationResult>} The generated project structure, notes, and logs.
 * @throws {AppError} If the generation process fails.
 */
export async function generateProjectStructure(
  input: GenerateProjectInputType
): Promise<ProjectGenerationResult> {
  const flowName = `generateProjectStructure${input.agentSystemPrompt ? ' (Grupo/Agente)' : ' (Global)'}`;
  console.log(`[Flow: ${flowName}] Iniciado. Descripción (inicio): ${input.description.substring(0, 100)}...`);
  if (input.agentSystemPrompt) {
    console.log(`[Flow: ${flowName}] Usando agentSystemPrompt (longitud: ${input.agentSystemPrompt.length}).`);
  }

  let projectResult: Partial<ProjectGenerationResult> = {
    projectName: `proyecto-fallido-${Date.now()}`,
    aiNotes: 'Error: El flujo no se completó como se esperaba.',
    files: [],
    groupLog: `[${new Date().toISOString()}] Log de Contexto: Iniciando ${flowName}.\n`,
  };

  try {
    let finalPromptForLLM: string;
    const baseInstructions = [
      'Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al schema ProjectGenerationResultSchemaForFlowInternal, que incluye `projectName` (string), `aiNotes` (string), y `files` (array de objetos con `path` (string), `content` (string, opcional), `isFolder` (boolean, opcional)).',
      'Instrucciones Detalladas para la estructura de `files`:',
      '1.  `path`: Ruta relativa del archivo/carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas DEBEN terminar con `/`.',
      '2.  `content`: Contenido COMPLETO y FUNCIONAL del archivo. Vacío para carpetas. Para archivos de código, debe ser código funcional. No uses placeholders en lugar de código real.',
      '3.  `isFolder`: (opcional) `true` si es una carpeta. Si `path` termina en `/`, se asume carpeta.',
      'Incluye archivos comunes como `README.md`, `.gitignore` (si aplica), y un archivo de configuración de empaquetador (ej. `package.json` para Node.js) si es relevante.',
      'Asegúrate de que el contenido de los archivos sea lo más completo y funcional posible.',
      'Toda la salida, incluyendo nombres de archivo, contenido y notas, debe estar en castellano.',
      "Ejemplo de un objeto 'file' para una carpeta: `{ \"path\": \"src/\", \"content\": \"\", \"isFolder\": true }`",
      "Ejemplo de un objeto 'file' para un archivo: `{ \"path\": \"src/index.js\", \"content\": \"console.log(\\\"Hola Mundo\\\");\" }`",
      "No incluyas ningún texto explicativo fuera del objeto JSON de respuesta."
    ];

    if (input.agentSystemPrompt) {
      // Modo Agente/Grupo: El agentSystemPrompt define el ROL.
      // La tarea específica se da después.
      projectResult.groupLog += `Usando el system prompt del Agente/Grupo seleccionado (longitud: ${input.agentSystemPrompt.length}). Contexto (primeros 200 chars): "${input.agentSystemPrompt.substring(0,200)}..."\n`;
      projectResult.groupLog += `Descripción del Proyecto del Usuario: "${input.description.substring(0,100)}..."\n`;

      const promptLines = [
        input.agentSystemPrompt,
        `\nBasado en tu rol y capacidades definidas arriba, tu tarea específica ACTUAL es generar una estructura de proyecto completa para la siguiente descripción proporcionada por el usuario:`,
        `"${input.description}"`,
        `\nDebes generar y devolver DIRECTAMENTE un único objeto JSON que se adhiera estrictamente al schema \`ProjectGenerationResultSchemaForFlowInternal\`.`,
        `Este JSON debe incluir:`,
        `1.  \`projectName\`: Un nombre sugerido para el proyecto.`,
        `2.  \`aiNotes\`: Comentarios o notas tuyas sobre la estructura generada o próximos pasos.`,
        `3.  \`files\`: Un array de objetos, donde cada objeto representa un archivo o carpeta. Cada objeto de archivo debe tener:`,
        `    *   \`path\`: La ruta relativa del archivo o carpeta (las carpetas deben terminar con '/').`,
        `    *   \`content\`: El contenido COMPLETO y FUNCIONAL del archivo. Para carpetas, el contenido puede ser una cadena vacía.`,
        `    *   \`isFolder\`: (Opcional) \`true\` si es una carpeta.`,
        `Asegúrate de que el contenido de cada archivo sea lo más completo y funcional posible.`,
        `No delegues esta tarea. No planifiques. No pidas más información. Genera el proyecto completo AHORA como un único JSON.`,
        `Toda la salida (nombres de archivo, contenido, notas) debe estar en castellano.`
      ];
      finalPromptForLLM = promptLines.join('\n');
      projectResult.groupLog += `--- Nota: El flujo Genkit (${flowName}) fue ejecutado utilizando el prompt del agente/grupo seleccionado para guiar el proceso de la IA en una única llamada. ---\n`;

    } else {
      // Modo Global: Prompt simple de arquitecto
      projectResult.groupLog += `Usando configuración global.\n`;
      const promptLines = [
        'Eres un experto arquitecto de software y desarrollador Full-Stack. Tu tarea es generar una estructura de proyecto completa (archivos y carpetas) basada en la descripción del usuario.',
        ...baseInstructions,
        'Descripción del Usuario:',
        `"${input.description}"`,
      ];
      finalPromptForLLM = promptLines.join('\n');
    }

    console.log(`[Flow: ${flowName}] Prompt final enviado al LLM (longitud: ${finalPromptForLLM.length}):\n`, finalPromptForLLM.substring(0, 1000) + (finalPromptForLLM.length > 1000 ? '...' : ''));
    projectResult.groupLog += `Prompt enviado al LLM (truncado):\n${finalPromptForLLM.substring(0, 300)}...\n`;

    const llmResponse = await ai.generate({
      prompt: finalPromptForLLM,
      output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
      config: { temperature: 0.3 }, // Temperatura un poco más baja para mayor consistencia en JSON
    });

    const output = llmResponse.output;
    console.log(`[Flow: ${flowName}] LLM output recibido (truncado):`, JSON.stringify(output)?.substring(0, 500) + '...');
    projectResult.groupLog += `Respuesta JSON cruda del LLM (truncada):\n${JSON.stringify(output)?.substring(0, 300)}...\n`;


    if (!output || !output.projectName || !Array.isArray(output.files)) {
      const errorDetail = `La IA no devolvió una estructura de proyecto válida (faltan projectName o files, o files no es un array). Output recibido: ${JSON.stringify(output)}`;
      console.error(`[Flow: ${flowName}] ${errorDetail}`);
      projectResult.aiNotes = `Error: ${errorDetail}`;
      projectResult.groupLog += `ERROR: ${errorDetail}\n`;
      throw new AppError(
        'La IA no pudo generar la estructura del proyecto (respuesta inválida).',
        { originalError: 'Respuesta de IA inválida o incompleta', llmOutput: output },
        'ai'
      );
    }

    const processedFiles = output.files.map((file: Partial<GeneratedFileInternal>) => ({
      path: file.path || 'ruta/desconocida/por/defecto',
      content: file.content ?? '',
      isFolder: file.isFolder ?? file.path?.endsWith('/') ?? false,
    }));
    
    projectResult = { ...output, files: processedFiles, groupLog: projectResult.groupLog + "Generación de proyecto completada por la IA.\n" };
    console.log(`[Flow: ${flowName}] Generación exitosa. Proyecto: ${projectResult.projectName}, Archivos: ${projectResult.files?.length}`);

    return projectResult as ProjectGenerationResult;

  } catch (error: any) {
    const originalErrorMessage = error?.message || 'Error desconocido en el flujo.';
    const errorDetails = error?.originalError || error;

    console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo principal:`, error);
    if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
    if (error.details) console.error(`[Flow: ${flowName}] Detalles del error original:`, error.details);
    if (error.cause) console.error(`[Flow: ${flowName}] Causa del error original:`, error.cause);

    projectResult.aiNotes = `Error crítico durante la generación: ${originalErrorMessage.substring(0, 200)}... Ver logs del servidor.`;
    projectResult.groupLog += `ERROR CRÍTICO en el flujo: ${originalErrorMessage}\n`;
    
    // Aunque el error original ya podría ser un AppError (si vino de una sub-llamada fallida de ai.generate),
    // aquí aseguramos que lo que se lanza al cliente sea siempre un AppError con el contexto del fallo general del flujo.
    if (error instanceof AppError) {
        // Si ya es un AppError, podríamos querer añadir más contexto o simplemente relanzarlo.
        // Por ahora, lo relanzamos, pero con el projectResult parcial para el log.
        error.originalError = { ...error.originalError, partialResult: projectResult };
        throw error;
      }

    throw new AppError(
      `FALLO_EN_FLUJO_GENERATE_PROJECT: ${originalErrorMessage.substring(0,100)}...`,
      { originalError: errorDetails, partialResult: projectResult },
      'ai'
    );
  }
}

    