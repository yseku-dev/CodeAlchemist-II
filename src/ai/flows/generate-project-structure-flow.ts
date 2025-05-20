
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow simulates a multi-turn interaction with an orchestrator and agents
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
} from '@/types';
import { AppError } from '@/utils/AppError';
import { DEFAULT_AGENTS } from '@/lib/constants'; // Para acceder a los prompts de sistema de agentes por defecto

// Schemas locales para este flujo
const GeneratedFileSchema = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .optional() // Hacer opcional y manejar default
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'
    ),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
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
});

// Schema para la decisión del orquestador
const orchestratorDecisionSchema = z.object({
  next_agent_id: z
    .string()
    .describe(
      "ID del siguiente agente a llamar (ej. 'JefeDeProducto', 'ArquitectoSoftware', 'DesarrolladorSoftware') o la palabra clave 'COMPLETADO' si la tarea de generación del proyecto ha finalizado."
    ),
  instruction_for_next_agent: z
    .string()
    .describe(
      "La instrucción detallada para el siguiente agente. Si next_agent_id es 'COMPLETADO', esta debería ser un resumen final del proyecto o las notas finales."
    ),
  reasoning: z
    .string()
    .optional()
    .describe(
      'Una breve explicación de por qué se eligió este agente o por qué se considera completada la tarea.'
    ),
  data_to_aggregate: ProjectGenerationResultSchemaForFlow.partial()
    .optional()
    .describe(
      'Datos parciales o completos del proyecto para agregar. Si next_agent_id es "COMPLETADO", este campo DEBE contener el ProjectGenerationResult final con projectName, aiNotes y la lista completa de files.'
    ),
});

const GenerateProjectInputSchema = z.object({
  description: z
    .string()
    .describe('Descripción detallada del proyecto a generar.'),
  agentSystemPrompt: z
    .string()
    .optional()
    .describe(
      'El prompt de sistema de un agente orquestador. Si se proporciona, el flujo operará en modo grupo.'
    ),
});

// Helper para obtener el prompt de sistema de un agente por defecto
function getAgentSystemPrompt(agentId: string): string {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
  if (agent) return agent.systemPrompt;
  // Fallback genérico si el agente no está en la lista de defaults
  return `Eres un ${agentId}. Tu tarea actual es la siguiente:`;
}

export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  // Si no hay agentSystemPrompt (no se seleccionó grupo), usar el flujo de prompt único simple
  if (!input.agentSystemPrompt) {
    const flowName = 'generateProjectStructureFlow (Prompt Único)';
    console.log(`[Flow: ${flowName}] Iniciado con descripción: ${input.description.substring(0,50)}...`);
    try {
      const promptLines = [
        'Eres un experto arquitecto de software y desarrollador Full-Stack. Tu tarea es generar una estructura de proyecto completa (archivos y carpetas) basada en la descripción del usuario. Tu respuesta DEBE ser un único objeto JSON que se adhiera al siguiente schema:',
        JSON.stringify(ProjectGenerationResultSchemaForFlow.jsonSchema(), null, 2),
        '\nInstrucciones Detalladas:',
        '1.  **projectName**: Sugiere un nombre de proyecto adecuado en formato kebab-case o CamelCase (ej. `mi-proyecto-genial`, `ProyectoAsombroso`).',
        '2.  **aiNotes**: Proporciona comentarios útiles, como los próximos pasos, dependencias clave a instalar, o consideraciones sobre la estructura generada. Estas notas deben estar en castellano.',
        '3.  **files**: Un array de objetos, donde cada objeto representa un archivo o carpeta.',
        '    *   Cada objeto debe tener:',
        '        *   `path`: Una cadena con la ruta relativa del archivo o carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas deben terminar con una barra inclinada (`/`).',
        '        *   `content`: Una cadena con el contenido COMPLETO y funcional del archivo. Para carpetas, el contenido puede ser una cadena vacía o un comentario como "/* Carpeta para... */". Para archivos de código, debe ser código funcional y bien estructurado. Para archivos de configuración (como package.json), debe ser una configuración válida.',
        '        *   `isFolder`: (opcional, booleano) Indica explícitamente si es una carpeta. Si `path` termina en `/`, se asume que es una carpeta.',
        '    *   Incluye archivos comunes como `README.md`, `.gitignore` (si aplica), un archivo de configuración de empaquetador (ej. `package.json` si es Node.js, `pom.xml` si es Maven, etc.), y algunos archivos de código fuente iniciales basados en la descripción.',
        '    *   Asegúrate de que el contenido de los archivos sea lo más completo y funcional posible. No proporciones fragmentos o placeholders en lugar de código real, a menos que sea para archivos muy grandes y repetitivos (como `package-lock.json`), en cuyo caso puedes generar una versión mínima o un comentario.',
        '    *   Prioriza la completitud de los archivos de código fuente y configuración esenciales.',
        'Descripción del Usuario:',
        `"${input.description}"`,
        '\nRecuerda, la salida debe ser únicamente el objeto JSON. Asegúrate de que todas las cadenas JSON estén correctamente escapadas.',
        'Toda la salida, incluyendo nombres de archivo, contenido y notas, debe estar en castellano.',
        'La respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al esquema de salida especificado. No incluyas ningún texto explicativo fuera del objeto JSON.',
        "Ejemplo de un objeto 'file' para una carpeta: `{ \"path\": \"src/\", \"content\": \"\", \"isFolder\": true }`",
        "Ejemplo de un objeto 'file' para un archivo: `{ \"path\": \"src/index.js\", \"content\": \"console.log(\\\"Hola Mundo\\\");\" }`"
      ];

      const llmResponse = await ai.generate({
        prompt: promptLines.join('\n'),
        output: { schema: ProjectGenerationResultSchemaForFlow, format: 'json' },
        config: { temperature: 0.4 },
      });
      const output = llmResponse.output;
      if (!output) {
        console.error(`[Flow: ${flowName}] No output from LLM.`);
        throw new AppError(
          'La IA no pudo generar la estructura del proyecto.',
          { originalError: 'No output from LLM' },
          'ai'
        );
      }
      const processedFiles = output.files.map((file) => ({
        ...file,
        content: file.content ?? '',
        isFolder: file.isFolder ?? file.path.endsWith('/'),
      }));
      return { ...output, files: processedFiles };
    } catch (error: any) {
      console.error(`[Flow: ${flowName}] Error ORIGINAL capturado:`, error);
      if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original:`, error.stack);
      if (error.details) console.error(`[Flow: ${flowName}] Detalles del error original:`, error.details);
      if (error.cause) console.error(`[Flow: ${flowName}] Causa del error original:`, error.cause);

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Ocurrió un error en el flujo de generación de estructura de proyecto.',
        error,
        'ai'
      );
    }
  }

  // Lógica para ejecución con grupo (multi-turno)
  const flowName = 'generateProjectStructureFlow (Grupo)';
  console.log(`[Flow: ${flowName}] Iniciado con descripción: ${input.description.substring(0,50)}...`);
  const executionLog: string[] = [];

  let projectName: string = `proyecto-generado-${Date.now()}`;
  let aiNotes: string = "Notas iniciales del proceso de generación por grupo.";
  let files: GeneratedFile[] = [];
  let completed = false;
  const MAX_TURNS = 7;
  let turn = 1;

  let currentTaskForOrchestrator = `Tarea Inicial: Generar un proyecto de software completo basado en la descripción del usuario: "${input.description}".
Tu rol es planificar los pasos y delegar a los agentes apropiados (como 'JefeDeProducto', 'ArquitectoSoftware', 'DesarrolladorSoftware') para generar progresivamente el nombre del proyecto, las notas de la IA, y la lista de archivos con su contenido.
Los agentes disponibles y sus roles son: ${DEFAULT_AGENTS.filter(a => a.id !== 'orquestador-flujo-agentes').map(a => `${a.name} (${a.description.substring(0,50)}...)`).join(', ')}.
Tu respuesta DEBE ser un JSON válido con los campos "next_agent_id", "instruction_for_next_agent", "reasoning", y opcionalmente "data_to_aggregate".
El campo "data_to_aggregate" puede usarse para pasar partes del proyecto (como projectName, aiNotes, o una lista parcial de files) que se hayan generado.
Cuando la tarea esté COMPLETADA, establece next_agent_id a "COMPLETADO" y proporciona el ProjectGenerationResult final completo (con projectName, aiNotes, y la lista completa de files) en el campo "data_to_aggregate".
Recuerda que el contenido de cada archivo debe ser COMPLETO Y FUNCIONAL.`;

  executionLog.push(`[TURNO ${turn}] Tarea Inicial para Orquestador:\n${currentTaskForOrchestrator}`);

  while (turn <= MAX_TURNS && !completed) {
    executionLog.push(`\n--- [TURNO ${turn}/${MAX_TURNS}] ---`);
    executionLog.push(`Orquestador Recibiendo Tarea:\n${currentTaskForOrchestrator.substring(0, 300)}...`);

    let decision: z.infer<typeof orchestratorDecisionSchema> | undefined;
    try {
      const orchestratorLlmResponse = await ai.generate({
        prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
        output: { schema: orchestratorDecisionSchema, format: 'json' },
        config: { temperature: 0.5 },
      });
      
      decision = orchestratorLlmResponse.output;

      if (!decision) {
        executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - Orquestador no devolvió un 'output' estructurado.`);
        aiNotes += `\nError en Turno ${turn}: El orquestador no devolvió una respuesta estructurada.`;
        completed = true;
        break;
      }
      executionLog.push(`Respuesta JSON del Orquestador (parseada):\n${JSON.stringify(decision, null, 2)}`);

    } catch (e: any) {
      const errorMsg = e.message || "Error desconocido llamando al Orquestador";
      executionLog.push(`[ERROR] Turno ${turn} - Llamada al Orquestador falló: ${errorMsg}. Respuesta cruda si disponible: ${e.response?.text || 'N/A'}`);
      aiNotes += `\nError en Turno ${turn} con Orquestador: ${errorMsg}`;
      console.error(`[Flow: ${flowName}] Error en turno ${turn} llamando al orquestador:`, e);
      completed = true;
      break;
    }

    if (decision.data_to_aggregate) {
      if (decision.data_to_aggregate.projectName) projectName = decision.data_to_aggregate.projectName;
      if (decision.data_to_aggregate.aiNotes) aiNotes = decision.data_to_aggregate.aiNotes;
      if (Array.isArray(decision.data_to_aggregate.files)) {
        decision.data_to_aggregate.files.forEach((newFile) => {
          const existingIndex = files.findIndex(f => f.path === newFile.path);
          if (existingIndex !== -1) {
            files[existingIndex] = { ...files[existingIndex], ...newFile, content: newFile.content ?? files[existingIndex].content ?? '' };
          } else {
            files.push({ ...newFile, content: newFile.content ?? '' });
          }
        });
      }
      executionLog.push(`Datos agregados del orquestador: Nombre: ${projectName}, Notas: ${aiNotes.substring(0,50)}..., ${files.length} archivos.`);
    }

    if (decision.next_agent_id?.toUpperCase() === 'COMPLETADO') {
      executionLog.push(`Orquestador indica COMPLETADO. Resumen: ${decision.instruction_for_next_agent}`);
      // Prioritize data from data_to_aggregate if completion signal is given
      if(decision.data_to_aggregate?.projectName) projectName = decision.data_to_aggregate.projectName;
      aiNotes = decision.data_to_aggregate?.aiNotes || decision.instruction_for_next_agent || aiNotes;
      if(Array.isArray(decision.data_to_aggregate?.files)) files = decision.data_to_aggregate.files.map(f => ({...f, content: f.content ?? ''}));
      completed = true;
      break;
    }

    const agentIdToCall = decision.next_agent_id;
    const instructionForAgent = decision.instruction_for_next_agent;
    const agentSystemPromptForDelegate = getAgentSystemPrompt(agentIdToCall);

    executionLog.push(`Llamando a Agente: ${agentIdToCall} con instrucción:\n${instructionForAgent.substring(0, 300)}...`);

    let agentResponseText: string = `[Respuesta no obtenida del agente ${agentIdToCall}]`;
    try {
      const agentLlmResponse = await ai.generate({
        prompt: `${agentSystemPromptForDelegate}\n\nTu tarea actual es: ${instructionForAgent}. Tu respuesta debe ser el resultado directo de la tarea. Por ejemplo, si se te pide generar el contenido de un archivo, devuelve solo ese contenido. Si se te pide un nombre de proyecto, devuelve solo el nombre. Si se te pide una lista de archivos, devuelve un JSON como este: {"files": [{"path": "...", "content": "..."}]}.`,
        config: { temperature: 0.6 },
      });
      agentResponseText = agentLlmResponse.text;

      if (!agentResponseText && agentLlmResponse.output) {
         agentResponseText = JSON.stringify(agentLlmResponse.output);
      } else if (!agentResponseText) {
          agentResponseText = "[El agente no devolvió texto ni output estructurado]";
      }
      executionLog.push(`Respuesta de ${agentIdToCall}:\n${agentResponseText.substring(0, 500)}...`);
    } catch (e: any) {
      const errorMsg = e.message || `Error desconocido llamando al Agente ${agentIdToCall}`;
      executionLog.push(`[ERROR] Turno ${turn} - Llamada al Agente ${agentIdToCall} falló: ${errorMsg}`);
      agentResponseText = `Error del agente ${agentIdToCall}: ${errorMsg}`;
      console.error(`[Flow: ${flowName}] Error en turno ${turn} llamando al agente ${agentIdToCall}:`, e);
      // Continuar y pasar el error al orquestador
    }
    currentTaskForOrchestrator = `El agente ${agentIdToCall} respondió:\n"${agentResponseText}"\n\nConsiderando esta respuesta, el estado actual del proyecto (Nombre: ${projectName}, ${files.length} archivos generados, Notas: ${aiNotes.substring(0,100)}...) y el objetivo general de generar el proyecto ("${input.description}"), ¿cuál es el siguiente paso?
Recuerda devolver tu decisión en JSON con "next_agent_id", "instruction_for_next_agent", "reasoning", y "data_to_aggregate" si tienes partes del proyecto para agregar.
Si el proyecto está completo, usa "COMPLETADO" como next_agent_id y proporciona el ProjectGenerationResult final en "data_to_aggregate".`;
    turn++;
  } // Fin del bucle while

  if (!completed && turn > MAX_TURNS) {
    executionLog.push(`\nSe alcanzó el límite máximo de ${MAX_TURNS} turnos.`);
    aiNotes += `\nProceso finalizado por alcanzar el límite de ${MAX_TURNS} turnos. El proyecto podría estar incompleto.`;
  }

  const finalFiles = files.map((file) => ({
    ...file,
    content: file.content ?? '',
    isFolder: file.isFolder ?? file.path.endsWith('/'),
  }));

  console.log(`[Flow: ${flowName}] Generación por grupo finalizada. Proyecto: ${projectName}, Archivos: ${finalFiles.length}`);
  return {
    projectName,
    aiNotes,
    files: finalFiles,
    groupLog: executionLog.join('\n\n'),
  };
}
