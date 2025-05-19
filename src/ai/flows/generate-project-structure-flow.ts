
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow now simulates a multi-turn interaction with an orchestrator and agents
 * when a group context (agentSystemPrompt for an orchestrator) is provided.
 *
 * - generateProjectStructure - A function that handles project structure generation.
 * - GenerateProjectInput - The input type for the function.
 * - ProjectGenerationResult - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  GenerateProjectInput,
  ProjectGenerationResult,
  GeneratedFile,
  ChatMessage,
} from '@/types';
import { AppError } from '@/utils/AppError';
import { DEFAULT_AGENTS } from '@/lib/constants'; // For default agent prompts

const GeneratedFileSchema = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .optional() // Content can be initially undefined for folders
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const GenerateProjectInputSchema = z.object({
  description: z
    .string()
    .describe(
      'Descripción detallada del proyecto a generar, incluyendo tipo, tecnologías, estructura deseada, etc.'
    ),
  agentSystemPrompt: z
    .string()
    .optional()
    .describe(
      'El prompt de sistema de un agente orquestador, si la generación es impulsada por un grupo.'
    ),
});

const ProjectGenerationResultSchema = z.object({
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

// Helper para obtener el prompt de sistema de un agente por defecto
function getDefaultAgentSystemPrompt(agentId: string): string {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
  if (agent) {
    return agent.systemPrompt;
  }
  // Fallback para agentes no encontrados en la lista por defecto
  return `Eres un experto en ${agentId}. Tu tarea es la siguiente:`;
}

const orchestratorDecisionSchema = z.object({
  next_agent_id: z
    .string()
    .describe(
      "ID del siguiente agente a llamar o 'COMPLETADO' si la tarea ha finalizado."
    ),
  instruction_for_next_agent: z
    .string()
    .describe(
      "Instrucción detallada para el siguiente agente o resumen final si 'COMPLETADO'."
    ),
  reasoning: z.string().optional().describe("Breve explicación de la decisión."),
  data_to_aggregate: z
    .any()
    .optional()
    .describe(
      'Datos parciales del proyecto (projectName, aiNotes, files) que el orquestador ha acumulado o que un agente ha devuelto para agregar al resultado final.'
    ),
});

const promptLines = [
  '{{#if agentSystemPrompt}}',
  '{{{agentSystemPrompt}}}',
  '',
  'Considerando tu rol y especialización, y basado en la siguiente descripción del usuario, genera una estructura de proyecto completa.',
  '{{else}}',
  'Eres un arquitecto de software experto y un asistente de generación de proyectos. Tu tarea es generar una estructura de archivos y carpetas para un nuevo proyecto, basándote en la descripción proporcionada por el usuario.',
  '{{/if}}',
  '',
  'Descripción del proyecto del usuario:',
  '"{{{description}}}"',
  '',
  'Debes proveer:',
  '1.  **projectName**: Un nombre adecuado y descriptivo para el proyecto (ej. "mi-proyecto-web", "APIUsuarios"). Intenta usar kebab-case o PascalCase.',
  '2.  **aiNotes**: Notas relevantes sobre la estructura generada, como por ejemplo:',
  '    *   Tecnologías principales implicadas.',
  '    *   Siguientes pasos recomendados (ej. "ejecuta npm install", "configura la base de datos").',
  '    *   Cualquier consideración importante sobre la estructura.',
  '3.  **files**: Un array de objetos, donde cada objeto representa un archivo o carpeta.',
  '    *   Cada objeto debe tener:',
  '        *   `path`: Una cadena con la ruta relativa del archivo o carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas deben terminar con una barra inclinada (`/`).',
  '        *   `content`: Una cadena con el contenido **COMPLETO y funcional** del archivo. Para carpetas, el contenido puede ser una cadena vacía o un comentario como "/* Carpeta para... */". Para archivos de código fuente (ej: .js, .ts, .py, .java, .html, .css), el contenido debe ser lo más completo posible. Si un archivo es extremadamente largo y repetitivo (como un `package-lock.json`), puedes generar una versión mínima o un comentario indicando que el contenido completo iría allí (ej. "// Contenido del package-lock.json aquí"), pero prioriza la completitud de los archivos de código.',
  '        *   `isFolder`: (opcional, booleano) Indica explícitamente si es una carpeta. Si `path` termina en `/`, se asume que es una carpeta.',
  '    *   Incluye archivos comunes como `README.md`, `.gitignore` (si aplica), un archivo de configuración de empaquetador (ej. `package.json` si es Node.js, `pom.xml` si es Maven, etc.), y algunos archivos de código fuente iniciales y funcionales basados en la descripción.',
  '    *   Asegúrate de que las rutas de los archivos sean coherentes y representen una estructura de proyecto lógica.',
  '',
  'Toda la salida, incluyendo nombres de archivo, contenido y notas, debe estar en castellano.',
  'La respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al esquema de salida especificado. No incluyas ningún texto explicativo fuera del objeto JSON. Es crucial que el contenido de los archivos sea lo más completo posible.',
  "Ejemplo de un objeto 'file' para una carpeta: `{ \"path\": \"src/\", \"content\": \"\", \"isFolder\": true }`",
  "Ejemplo de un objeto 'file' para un archivo: `{ \"path\": \"src/index.js\", \"content\": \"console.log(\\\"Hola Mundo\\\");\" }`",
];

const projectGenerationPromptDirect = ai.definePrompt({
  name: 'generateProjectStructurePromptDirect',
  input: { schema: GenerateProjectInputSchema },
  output: { schema: ProjectGenerationResultSchema },
  prompt: promptLines.join('\n'),
});

export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  return generateProjectStructureFlow(input);
}

const generateProjectStructureFlow = ai.defineFlow(
  {
    name: 'generateProjectStructureFlow',
    inputSchema: GenerateProjectInputSchema,
    outputSchema: ProjectGenerationResultSchema,
  },
  async (input): Promise<ProjectGenerationResult> => {
    const flowName = 'generateProjectStructureFlow';
    console.log(
      `[Flow: ${flowName}] Iniciado con descripción: ${input.description.substring(
        0,
        100
      )}... Contexto de Agente/Grupo: ${
        input.agentSystemPrompt ? 'Sí' : 'No'
      }`
    );

    if (!input.agentSystemPrompt) {
      console.log(
        `[Flow: ${flowName}] Modo de generación directa (sin grupo). Llamando a projectGenerationPromptDirect.`
      );
      try {
        const llmResponse = await projectGenerationPromptDirect(input);
        const output = llmResponse.output;

        if (!output) {
          console.error(
            `[Flow: ${flowName}] No output from LLM in direct mode.`
          );
          throw new AppError(
            'La IA no pudo generar la estructura del proyecto.',
            { originalError: 'No output from LLM in direct mode' },
            'ai'
          );
        }
        const processedFiles = output.files.map((file) => ({
          ...file,
          content: file.content ?? '',
          isFolder: file.isFolder ?? file.path.endsWith('/'),
        }));
        console.log(
          `[Flow: ${flowName}] Generación directa exitosa. Proyecto: ${output.projectName}`
        );
        return {
          ...output,
          files: processedFiles,
          groupLog: 'Generación directa completada.',
        };
      } catch (error: any) {
        console.error(
          `[Flow: ${flowName}] Error ORIGINAL en modo de generación directa:`,
          error
        );
        if (error.stack)
          console.error(
            `[Flow: ${flowName}] Stack del error original (directo):`,
            error.stack
          );
        if (error.details)
          console.error(
            `[Flow: ${flowName}] Detalles del error original (directo):`,
            error.details
          );
        if (error.cause)
          console.error(
            `[Flow: ${flowName}] Causa del error original (directo):`,
            error.cause
          );

        if (error instanceof AppError) throw error;
        throw new AppError(
          'Ocurrió un error al generar la estructura del proyecto (modo directo).',
          error,
          'ai'
        );
      }
    }

    console.log(
      `[Flow: ${flowName}] Modo de generación por grupo. Contexto del orquestador proporcionado.`
    );
    const executionLog: string[] = [];
    let projectName: string = `proyecto-generado-${Date.now()}`;
    let aiNotes: string =
      'Notas iniciales del proceso de generación por grupo.';
    let files: GeneratedFile[] = [];
    let currentTaskForOrchestrator = `Tarea Inicial: Generar un proyecto completo basado en la descripción: "${input.description}". Planifica los pasos y delega a los agentes apropiados (como JefeDeProducto para nombre/notas, ArquitectoSoftware para estructura, DesarrolladorSoftware para contenido de archivos). Tu respuesta debe ser un JSON con next_agent_id, instruction_for_next_agent, y opcionalmente data_to_aggregate con {projectName, aiNotes, files}.`;
    const MAX_TURNS = 7;
    let turn = 1; // <<< Definir 'turn' fuera del bucle
    let completed = false;

    executionLog.push(
      `[TURNO 0] Tarea inicial para el Orquestador: ${currentTaskForOrchestrator}`
    );

    while (turn <= MAX_TURNS && !completed) { // <<< Usar bucle while
      executionLog.push(`\n--- [TURNO ${turn}] ---`);
      executionLog.push(
        `Orquestador recibiendo: ${currentTaskForOrchestrator.substring(
          0,
          300
        )}...`
      );

      let orchestratorResponseText: string;
      try {
        const orchestratorResponse = await ai.generate({
          prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
          output: { schema: orchestratorDecisionSchema, format: 'json' },
          config: { temperature: 0.5 },
        });
        orchestratorResponseText = orchestratorResponse.text();
        executionLog.push(
          `Respuesta JSON cruda del Orquestador: ${orchestratorResponseText}`
        );
      } catch (e: any) {
        const errorMsg = e.message || 'Error desconocido llamando al Orquestador';
        executionLog.push(`ERROR llamando al Orquestador: ${errorMsg}`);
        aiNotes += `\nError en Turno ${turn} con Orquestador: ${errorMsg}`;
        console.error(`[Flow: ${flowName}] Error en turno ${turn} llamando al orquestador:`, e);
        completed = true; // Finalizar el bucle en caso de error del orquestador
        break;
      }

      let decision;
      try {
        decision = JSON.parse(orchestratorResponseText);
        // Validar con Zod (opcional pero recomendado si el schema es estricto)
        // orchestratorDecisionSchema.parse(decision);
      } catch (e: any) {
        const errorMsg = e.message || 'Error desconocido parseando respuesta del Orquestador';
        executionLog.push(
          `ERROR parseando respuesta del Orquestador: ${errorMsg}. Respuesta: ${orchestratorResponseText}`
        );
        aiNotes += `\nError en Turno ${turn} parseando Orquestador: ${errorMsg}`;
        console.error(`[Flow: ${flowName}] Error en turno ${turn} parseando respuesta del orquestador:`, e);
        completed = true; // Finalizar el bucle
        break;
      }

      if (!decision || !decision.next_agent_id || !decision.instruction_for_next_agent) {
        const errorMsg = "Respuesta del orquestador incompleta o en formato incorrecto.";
        executionLog.push(errorMsg);
        aiNotes += `\nError en Turno ${turn}: ${errorMsg}`;
        console.error(`[Flow: ${flowName}] Error en turno ${turn}: ${errorMsg}. Respuesta del orquestador:`, decision);
        completed = true;
        break;
      }

      executionLog.push(
        `Decisión del Orquestador: Próximo Agente: ${
          decision.next_agent_id
        }, Instrucción: ${(
          decision.instruction_for_next_agent || ''
        ).substring(0, 150)}..., Razonamiento: ${decision.reasoning || 'N/A'}`
      );

      if (decision.data_to_aggregate) {
        if (decision.data_to_aggregate.projectName)
          projectName = decision.data_to_aggregate.projectName;
        if (decision.data_to_aggregate.aiNotes)
          aiNotes = decision.data_to_aggregate.aiNotes;
        if (Array.isArray(decision.data_to_aggregate.files)) {
          files = [
            ...files,
            ...decision.data_to_aggregate.files.filter(
              (f: any) => f.path && typeof f.content === 'string'
            ),
          ];
        }
        executionLog.push(
          `Datos agregados desde el orquestador: Nombre: ${projectName}, ${files.length} archivos.`
        );
      }

      if (decision.next_agent_id.toUpperCase() === 'COMPLETADO') {
        executionLog.push(
          `Orquestador indica COMPLETADO. Resumen: ${decision.instruction_for_next_agent}`
        );
        if (
          decision.instruction_for_next_agent &&
          decision.instruction_for_next_agent.startsWith('{')
        ) {
          try {
            const finalData = JSON.parse(decision.instruction_for_next_agent);
            if (finalData.projectName) projectName = finalData.projectName;
            if (finalData.aiNotes) aiNotes = finalData.aiNotes;
            if (Array.isArray(finalData.files)) files = finalData.files;
          } catch (e) {
            /* no hacer nada si no es JSON */
          }
        } else if (decision.instruction_for_next_agent) {
          aiNotes = aiNotes
            ? `${aiNotes}\n\nNota final del Orquestador: ${decision.instruction_for_next_agent}`
            : `Nota final del Orquestador: ${decision.instruction_for_next_agent}`;
        }
        completed = true; // Marcar como completado para salir del bucle
        break;
      }

      const agentSystemPromptForDelegate = getDefaultAgentSystemPrompt(
        decision.next_agent_id
      );
      executionLog.push(
        `Llamando a Agente: ${decision.next_agent_id} con instrucción: ${(
          decision.instruction_for_next_agent || ''
        ).substring(0, 150)}...`
      );

      let agentResponseText: string;
      try {
        const agentResponse = await ai.generate({
          prompt: `${agentSystemPromptForDelegate}\n\nTu tarea actual es: ${decision.instruction_for_next_agent}. Tu respuesta debe ser un string, no un JSON, a menos que se te pida específicamente. Si generas código, solo devuelve el código.`,
          config: { temperature: 0.6 },
        });
        agentResponseText = agentResponse.text();
        executionLog.push(
          `Respuesta de ${decision.next_agent_id}: ${agentResponseText.substring(
            0,
            300
          )}...`
        );
      } catch (e: any) {
        const errorMsg = e.message || `Error desconocido llamando al Agente ${decision.next_agent_id}`;
        executionLog.push(`ERROR llamando al Agente ${decision.next_agent_id}: ${errorMsg}`);
        aiNotes += `\nError en Turno ${turn} con Agente ${decision.next_agent_id}: ${errorMsg}`;
        agentResponseText = `Error del agente ${decision.next_agent_id}: ${errorMsg}`;
         console.error(`[Flow: ${flowName}] Error en turno ${turn} llamando al agente ${decision.next_agent_id}:`, e);
        // No rompemos el bucle aquí, dejamos que el orquestador maneje el error del agente
      }
      currentTaskForOrchestrator = `El agente ${decision.next_agent_id} respondió: "${agentResponseText}". Por favor, procesa esta respuesta, agrega los datos relevantes si es necesario (projectName, aiNotes, files), y continúa con el plan o indica la finalización.`;
      turn++; // <<< Incrementar 'turn' al final de cada iteración del bucle
    } // Fin del bucle while

    if (!completed && turn > MAX_TURNS) { // <<< Comprobación después del bucle
      executionLog.push(
        `\nSe alcanzó el límite máximo de ${MAX_TURNS} turnos.`
      );
      aiNotes += `\nProceso finalizado por alcanzar el límite de ${MAX_TURNS} turnos.`;
    }

    const finalFiles = files.map((file) => ({
      ...file,
      content: file.content ?? '',
      isFolder: file.isFolder ?? file.path.endsWith('/'),
    }));

    console.log(
      `[Flow: ${flowName}] Generación por grupo finalizada. Proyecto: ${projectName}, Archivos: ${finalFiles.length}`
    );
    return {
      projectName,
      aiNotes,
      files: finalFiles,
      groupLog: executionLog.join('\n'),
    };
  }
);

    