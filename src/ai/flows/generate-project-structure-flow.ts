
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow can operate in two modes:
 * 1. Single Prompt Mode (Global Settings / Individual Agent context):
 *    Makes a single call to an LLM to generate the entire project structure.
 * 2. Contextualized Single Prompt Mode (Group context):
 *    Makes a single call to an LLM, contextualized by the agent's/group's system prompt,
 *    instructing it to generate the entire project structure.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  GenerateProjectInput,
  ProjectGenerationResult,
  GeneratedFile as GeneratedFileTypeFromTypes,
} from '@/types';
import { AppError } from '@/utils/AppError';
import { DEFAULT_AGENTS, ORCHESTRATOR_AGENT_ID } from '@/lib/constants';

// Local Zod schemas for this flow
const GeneratedFileSchemaInternal = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas DEBEN terminar con /'
    ),
  content: z
    .string()
    .optional()
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
      'Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso). Es OBLIGATORIO.'
    ),
  aiNotes: z
    .string()
    .describe(
      'Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar. Si ocurre un error interno, debe describirse aquí. Es OBLIGATORIO.'
    ),
  files: z
    .array(GeneratedFileSchemaInternal)
    .describe(
      'Una lista de archivos y carpetas generados, cada uno con su ruta y contenido. Es OBLIGATORIO (puede ser un array vacío []).'
    ),
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
 * @param {GenerateProjectInput} input - The input containing the project description and optional agent context.
 * @returns {Promise<ProjectGenerationResult>} The generated project structure, notes, and logs.
 * @throws {AppError} If the generation process fails.
 */
export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  const flowName = `generateProjectStructure${input.agentSystemPrompt ? ' (Grupo/Agente)' : ' (Global)'}`;
  console.log(`[Flow: ${flowName}] Iniciado. Descripción (inicio): ${input.description.substring(0, 100)}...`);
  if (input.agentSystemPrompt) {
    console.log(`[Flow: ${flowName}] Usando agentSystemPrompt (longitud: ${input.agentSystemPrompt.length}). Contexto (primeros 200 chars): "${input.agentSystemPrompt.substring(0,200)}..."`);
  }

  let projectResult: ProjectGenerationResult = {
    projectName: `proyecto-fallido-${Date.now()}`,
    aiNotes: 'Error: El flujo no se completó como se esperaba.',
    files: [],
    groupLog: `[${new Date().toISOString()}] Log de Contexto: Iniciando ${flowName}.\n`,
  };

  try {
    let finalPromptForLLM: string;
    let groupLogForUI = projectResult.groupLog || "";

    if (input.agentSystemPrompt) {
      // Modo Agente/Grupo: El agentSystemPrompt define el ROL.
      groupLogForUI += `Usando el system prompt del Agente/Grupo seleccionado (longitud: ${input.agentSystemPrompt.length}). Contexto (truncado): "${input.agentSystemPrompt.substring(0,200)}..."\n`;
      groupLogForUI += `Descripción del Proyecto del Usuario (truncada): "${input.description.substring(0,100)}..."\n`;

      const promptLines = [
        input.agentSystemPrompt,
        `\nBasado en tu rol y capacidades definidas arriba, tu tarea específica ACTUAL es generar una estructura de proyecto completa para la siguiente descripción proporcionada por el usuario:`,
        `"${input.description}"`,
        `\nTu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al siguiente schema (ProjectGenerationResultSchemaForFlowInternal):`,
        `{\n  "projectName": "string (OBLIGATORIO - ej: mi-proyecto-genial)",\n  "aiNotes": "string (OBLIGATORIO - notas sobre la generación, próximos pasos, o errores)",\n  "files": "GeneratedFile[] (OBLIGATORIO - array de objetos { path: string, content?: string, isFolder?: boolean }, puede ser [])"\n}`,
        `Instrucciones Detalladas para la estructura de \`files\`:`,
        `1.  \`path\`: Ruta relativa del archivo/carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas DEBEN terminar con \`/\`.`,
        `2.  \`content\`: Contenido COMPLETO y FUNCIONAL del archivo. Vacío para carpetas o si es un placeholder. No uses placeholders en lugar de código real a menos que sea absolutamente necesario para archivos muy grandes o repetitivos (ej. package-lock.json), pero prioriza la completitud para el código fuente.`,
        `3.  \`isFolder\`: (opcional) \`true\` si es una carpeta. Si \`path\` termina en \`/\`, se asume carpeta.`,
        `Incluye archivos comunes como \`README.md\`, \`.gitignore\` (si aplica), y un archivo de configuración de empaquetador (ej. \`package.json\` para Node.js) si es relevante.`,
        `Asegúrate de que el contenido de los archivos sea lo más completo y funcional posible.`,
        `Si eres un orquestador de agentes, debes generar el proyecto completo como si hubieras coordinado a tus agentes y consolidado sus resultados. No devuelvas un plan de delegación, sino el RESULTADO FINAL del proyecto.`,
        `Toda la salida (nombres de archivo, contenido, notas) debe estar en castellano.`,
        `No incluyas ningún texto explicativo fuera del objeto JSON de respuesta.`
      ];
      finalPromptForLLM = promptLines.join('\n');
      groupLogForUI += `--- Nota: El flujo Genkit (${flowName}) fue ejecutado utilizando el prompt del agente/grupo seleccionado para guiar el proceso de la IA en una única llamada. ---\n`;
    
    } else {
      // Modo Global: Prompt simple de arquitecto
      groupLogForUI += `Usando configuración global (sin agentSystemPrompt específico).\n`;
      const promptLines = [
        'Eres un experto arquitecto de software y desarrollador Full-Stack. Tu tarea es generar una estructura de proyecto completa (archivos y carpetas, con su contenido) basada en la descripción del usuario.',
        'Tu respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al siguiente schema (ProjectGenerationResultSchemaForFlowInternal):',
        `{\n  "projectName": "string (OBLIGATORIO - ej: mi-proyecto-genial)",\n  "aiNotes": "string (OBLIGATORIO - notas sobre la generación, próximos pasos, o errores)",\n  "files": "GeneratedFile[] (OBLIGATORIO - array de objetos { path: string, content?: string, isFolder?: boolean }, puede ser [])"\n}`,
        'Instrucciones Detalladas para la estructura de `files`:',
        '1.  `path`: Ruta relativa del archivo/carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas DEBEN terminar con `/`.',
        '2.  `content`: Contenido COMPLETO y FUNCIONAL del archivo. Vacío para carpetas. Para archivos de código, debe ser código funcional. No uses placeholders en lugar de código real.',
        '3.  `isFolder`: (opcional) `true` si es una carpeta. Si `path` termina en `/`, se asume carpeta.',
        'Incluye archivos comunes como `README.md`, `.gitignore` (si aplica), y un archivo de configuración de empaquetador (ej. `package.json` para Node.js) si es relevante.',
        'Asegúrate de que el contenido de los archivos sea lo más completo y funcional posible.',
        'Toda la salida, incluyendo nombres de archivo, contenido y notas, debe estar en castellano.',
        "No incluyas ningún texto explicativo fuera del objeto JSON de respuesta.",
        'Descripción del Usuario:',
        `"${input.description}"`,
      ];
      finalPromptForLLM = promptLines.join('\n');
    }

    console.log(`[Flow: ${flowName}] Prompt final enviado al LLM (longitud: ${finalPromptForLLM.length}):\n`, finalPromptForLLM.substring(0, 1000) + (finalPromptForLLM.length > 1000 ? '...' : ''));
    groupLogForUI += `Prompt enviado al LLM (truncado):\n${finalPromptForLLM.substring(0, 300)}...\n`;

    const llmResponse = await ai.generate({
      prompt: finalPromptForLLM,
      // input: { description: input.description }, // Ya está en el prompt
      output: { schema: ProjectGenerationResultSchemaForFlowInternal, format: 'json' },
      config: { temperature: 0.3 },
    });

    const output = llmResponse.output;
    console.log(`[Flow: ${flowName}] LLM output parseado por Genkit (truncado):`, JSON.stringify(output)?.substring(0, 500) + '...');
    groupLogForUI += `Respuesta JSON parseada por Genkit del LLM (truncada):\n${JSON.stringify(output)?.substring(0, 300)}...\n`;

    if (!output || typeof output.projectName !== 'string' || !Array.isArray(output.files) || typeof output.aiNotes !== 'string') {
      let missingFields = [];
      if (typeof output?.projectName !== 'string') missingFields.push('projectName');
      if (!Array.isArray(output?.files)) missingFields.push('files');
      if (typeof output?.aiNotes !== 'string') missingFields.push('aiNotes');
      
      const errorDetail = `La IA no devolvió una estructura de proyecto válida (faltan campos requeridos: ${missingFields.join(', ')} o son del tipo incorrecto). Output recibido: ${JSON.stringify(output)}`;
      console.error(`[Flow: ${flowName}] ${errorDetail}`);
      projectResult.aiNotes = `Error: ${errorDetail}`;
      projectResult.groupLog = groupLogForUI + `\nERROR: ${errorDetail}`;
      
      // Check if there's schema validation info from Genkit
      let schemaValidationError = "";
      if (llmResponse.usage?.promptInvalid) { // Genkit might populate this
        schemaValidationError = `Detalles de validación de schema de Genkit: ${JSON.stringify(llmResponse.usage.promptInvalid)}`;
        console.error(`[Flow: ${flowName}] Genkit schema validation error:`, llmResponse.usage.promptInvalid);
        projectResult.aiNotes += `\n${schemaValidationError}`;
        projectResult.groupLog += `\n${schemaValidationError}`;
      }

      throw new AppError(
        `La IA no pudo generar la estructura del proyecto (respuesta inválida o incompleta - faltan: ${missingFields.join(', ') || 'campos desconocidos'}). ${schemaValidationError}`,
        { originalError: 'Respuesta de IA inválida o incompleta', llmOutput: output, llmUsage: llmResponse.usage },
        'ai'
      );
    }

    const processedFiles = output.files.map((file: Partial<GeneratedFileInternal>) => ({
      path: file.path || 'ruta/desconocida/por/defecto',
      content: file.content ?? '',
      isFolder: file.isFolder ?? file.path?.endsWith('/') ?? false,
    }));
    
    projectResult = { ...output, files: processedFiles as GeneratedFileTypeFromTypes[], groupLog: groupLogForUI + "Generación de proyecto completada por la IA.\n" };
    console.log(`[Flow: ${flowName}] Generación exitosa. Proyecto: ${projectResult.projectName}, Archivos: ${projectResult.files?.length}`);

    return projectResult;

  } catch (error: any) {
    const originalErrorMessage = error?.message || 'Error desconocido en el flujo.';
    const errorDetails = error?.originalError || error;
    const errorStack = error?.stack;

    console.error(`[Flow: ${flowName}] Error ORIGINAL capturado en el flujo principal:`, error);
    if (errorStack) console.error(`[Flow: ${flowName}] Stack del error original:`, errorStack);
    if (error.details) console.error(`[Flow: ${flowName}] Detalles del error original:`, error.details);
    if (error.cause) console.error(`[Flow: ${flowName}] Causa del error original:`, error.cause);

    projectResult.aiNotes = `Error crítico durante la generación: ${originalErrorMessage.substring(0, 200)}... Ver logs del servidor.`;
    projectResult.groupLog = (projectResult.groupLog || "") + `\nERROR CRÍTICO en el flujo: ${originalErrorMessage}\n${errorStack ? `Stack: ${errorStack.substring(0,300)}...\n` : ''}`;
    
    if (error instanceof AppError) {
        error.originalError = { ...(error.originalError || {}), partialResult: projectResult };
        throw error;
      }

    throw new AppError(
      `FALLO_EN_FLUJO_GENERATE_PROJECT: ${originalErrorMessage.substring(0,100)}...`,
      { originalError: errorDetails, partialResult: projectResult },
      'ai'
    );
  }
}
    

    