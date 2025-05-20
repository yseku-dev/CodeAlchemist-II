
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow can operate in two modes:
 * 1. Single Prompt Mode: If no agentSystemPrompt (group orchestrator context) is provided,
 *    it makes a single call to an LLM to generate the entire project structure.
 * 2. Group/Multi-Turn Mode: If an agentSystemPrompt (typically the orchestrator's system prompt
 *    for a selected group) is provided, it simulates a multi-turn interaction:
 *    - It calls the orchestrator to get a plan/next step.
 *    - It then calls a conceptual "delegate" agent based on the orchestrator's decision.
 *    - This loop continues for a limited number of turns or until the orchestrator signals completion.
 *    The quality and success of multi-turn mode heavily depend on the LLM's ability to follow
 *    complex instructions, act as an orchestrator, provide structured JSON, and generate
 *    meaningful sub-tasks and content.
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
import { DEFAULT_AGENTS } from '@/lib/constants';

// Schemas for the flow's internal logic and prompt outputs
const GeneratedFileSchema = z.object({
  path: z
    .string()
    .describe(
      'Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'
    ),
  content: z
    .string()
    .optional()
    .describe(
      'Contenido COMPLETO y funcional del archivo. Vacío para carpetas o si se genera por separado.'
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
      'Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar. Si ocurre un error interno, debe describirse aquí.'
    ),
  files: z
    .array(GeneratedFileSchema)
    .describe(
      'Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'
    ),
});

// Schema for the orchestrator's decision within the multi-turn mode
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
  data_to_aggregate: ProjectGenerationResultSchemaForFlow.partial() // Permite que el orquestador envíe partes del proyecto
    .optional()
    .describe(
      'Datos parciales del proyecto para agregar (projectName, aiNotes, files). Si next_agent_id es "COMPLETADO", este campo DEBE contener el ProjectGenerationResult final completo con projectName, aiNotes y la lista COMPLETA de files.'
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
      'El prompt de sistema de un agente orquestador. Si se proporciona, el flujo operará en modo grupo multi-turno.'
    ),
});

// Helper to get a default system prompt for a delegate agent (if not found in constants)
function getAgentSystemPrompt(agentId: string): string {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
  if (agent) return agent.systemPrompt;
  // Fallback genérico si el agente no está en la lista de defaults
  // Este prompt es muy genérico y puede que no sea efectivo para todos los agentes.
  return `Eres un ${agentId}. Tu tarea actual es la siguiente, responde de la forma más directa posible al requerimiento. Si se te pide generar contenido de archivo, devuelve solo ese contenido.`;
}


export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  const flowName = 'generateProjectStructureFlow';

  // SINGLE PROMPT MODE (No group/orchestrator selected)
  if (!input.agentSystemPrompt) {
    console.log(`[Flow: ${flowName}] Modo Prompt Único. Iniciado con descripción: ${input.description.substring(0,100)}...`);
    const promptLines = [
      'Eres un experto arquitecto de software y desarrollador Full-Stack. Tu tarea es generar una estructura de proyecto completa (archivos y carpetas) basada en la descripción del usuario. Tu respuesta DEBE ser un único objeto JSON que se adhiera al siguiente schema:',
      JSON.stringify(ProjectGenerationResultSchemaForFlow.jsonSchema(), null, 2),
      '\nInstrucciones Detalladas:',
      '1.  **projectName**: Sugiere un nombre de proyecto adecuado en formato kebab-case o CamelCase (ej. `mi-proyecto-genial`, `ProyectoAsombroso`).',
      '2.  **aiNotes**: Proporciona comentarios útiles, como los próximos pasos, dependencias clave a instalar, o consideraciones sobre la estructura generada. Estas notas deben estar en castellano.',
      '3.  **files**: Un array de objetos, donde cada objeto representa un archivo o carpeta.',
      '    *   Cada objeto debe tener:',
      '        *   `path`: Una cadena con la ruta relativa del archivo o carpeta (ej. "src/components/Button.tsx", "README.md", "public/"). Las carpetas deben terminar con una barra inclinada (`/`).',
      '        *   `content`: (Opcional) Una cadena con el contenido COMPLETO y funcional del archivo. Para carpetas, el contenido puede ser una cadena vacía o un comentario como "/* Carpeta para... */". Para archivos de código, debe ser código funcional y bien estructurado. Para archivos de configuración (como package.json), debe ser una configuración válida.',
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

    try {
      const llmResponse = await ai.generate({
        prompt: promptLines.join('\n'),
        output: { schema: ProjectGenerationResultSchemaForFlow, format: 'json' },
        config: { temperature: 0.4 }, // Temperatura más baja para respuestas estructuradas
      });
      const output = llmResponse.output;
      if (!output) {
        console.error(`[Flow: ${flowName} (Modo Prompt Único)] No output from LLM.`);
        throw new AppError(
          'La IA no pudo generar la estructura del proyecto.',
          { originalError: 'No output from LLM in single prompt mode' },
          'ai'
        );
      }
      const processedFiles = output.files.map((file) => ({
        ...file,
        content: file.content ?? '',
        isFolder: file.isFolder ?? file.path.endsWith('/'),
      }));
      return { ...output, files: processedFiles, groupLog: "Generado con configuración global/agente (prompt único)." };
    } catch (error: any) {
      console.error(`[Flow: ${flowName} (Modo Prompt Único)] Error ORIGINAL capturado:`, error);
      if (error.stack) console.error(`[Flow: ${flowName} (Modo Prompt Único)] Stack del error original:`, error.stack);
      if (error.details) console.error(`[Flow: ${flowName} (Modo Prompt Único)] Detalles del error original:`, error.details);
      if (error.cause) console.error(`[Flow: ${flowName} (Modo Prompt Único)] Causa del error original:`, error.cause);

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Ocurrió un error en el flujo de generación de estructura de proyecto (modo prompt único).',
        error,
        'ai'
      );
    }
  }

  // GROUP / MULTI-TURN MODE
  console.log(`[Flow: ${flowName} (Grupo)] Modo Multi-Turno. Iniciado con descripción: ${input.description.substring(0,100)}...`);
  const executionLog: string[] = [];
  let projectName: string = `proyecto-generado-${Date.now()}`;
  let aiNotes: string = "Notas iniciales del proceso de generación por grupo.";
  let files: GeneratedFile[] = [];
  let completed = false;
  const MAX_TURNS = 7; 
  let turn = 1;

  let currentTaskForOrchestrator = `Tarea Inicial: Generar un proyecto de software completo basado en la descripción del usuario: "${input.description}".
Tu rol es planificar los pasos y delegar a los agentes apropiados (como 'JefeDeProducto', 'ArquitectoSoftware', 'DesarrolladorSoftware') para generar progresivamente el nombre del proyecto, las notas de la IA, y la lista de archivos con su contenido COMPLETO y FUNCIONAL.
Los agentes disponibles y sus roles son: ${DEFAULT_AGENTS.filter(a => a.id !== 'orquestador-flujo-agentes').map(a => `${a.name} (Especialidad: ${a.description.substring(0,70)}...)`).join('; ')}.
Tu respuesta DEBE ser un JSON válido con los campos "next_agent_id", "instruction_for_next_agent", "reasoning". Opcionalmente, puedes incluir "data_to_aggregate" para pasar partes del proyecto (projectName, aiNotes, o una lista de files) que ya se hayan generado.
Cuando la tarea esté COMPLETADA, establece next_agent_id a "COMPLETADO" y proporciona el ProjectGenerationResult final COMPLETO (con projectName, aiNotes, y la lista COMPLETA de files con su contenido) en el campo "data_to_aggregate".
Recuerda que el contenido de cada archivo de código debe ser COMPLETO Y FUNCIONAL. No uses placeholders.`;

  executionLog.push(`[TURNO ${turn}] Tarea Inicial para Orquestador:\n${currentTaskForOrchestrator}`);

  while (turn <= MAX_TURNS && !completed) {
    executionLog.push(`\n--- [TURNO ${turn}/${MAX_TURNS}] ---`);
    executionLog.push(`Orquestador Recibiendo Tarea (primeros 300 chars):\n${currentTaskForOrchestrator.substring(0, 300)}...`);

    let decision: z.infer<typeof orchestratorDecisionSchema> | undefined;
    try {
      const orchestratorLlmResponse = await ai.generate({
        prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
        output: { schema: orchestratorDecisionSchema, format: 'json' },
        config: { temperature: 0.5 }, 
      });
      
      decision = orchestratorLlmResponse.output; // Property access for Genkit v1.x

      if (!decision) {
        executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - Orquestador no devolvió 'output' estructurado o fue undefined. Respuesta cruda (texto): ${orchestratorLlmResponse.text || 'N/A'}`);
        aiNotes += `\nError en Turno ${turn}: El orquestador no devolvió una respuesta estructurada.`;
        completed = true; // Stop execution
        break;
      }
      executionLog.push(`Respuesta JSON parseada del Orquestador:\n${JSON.stringify(decision, null, 2)}`);

      if (!decision.next_agent_id || !decision.instruction_for_next_agent) {
        executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - Respuesta del Orquestador incompleta (faltan next_agent_id o instruction_for_next_agent).`);
        aiNotes += `\nError en Turno ${turn}: Respuesta del Orquestador incompleta.`;
        completed = true;
        break;
      }

    } catch (e: any) {
      const errorMsg = e.message || "Error desconocido llamando al Orquestador";
      executionLog.push(`[ERROR] Turno ${turn} - Llamada al Orquestador falló: ${errorMsg}. Respuesta cruda (texto) si disponible: ${e.response?.text || e.toString()}`);
      aiNotes += `\nError en Turno ${turn} con Orquestador: ${errorMsg}`;
      console.error(`[Flow: ${flowName} (Grupo)] Error en turno ${turn} llamando al orquestador:`, e);
      completed = true; // Stop execution on orchestrator failure
      break;
    }

    // Aggregate data if provided by orchestrator
    if (decision.data_to_aggregate) {
      if (decision.data_to_aggregate.projectName) projectName = decision.data_to_aggregate.projectName;
      if (decision.data_to_aggregate.aiNotes) aiNotes = decision.data_to_aggregate.aiNotes;
      if (Array.isArray(decision.data_to_aggregate.files)) {
        decision.data_to_aggregate.files.forEach((newFile) => {
          const existingIndex = files.findIndex(f => f.path === newFile.path);
          const finalContent = newFile.content ?? '';
          const finalIsFolder = newFile.isFolder ?? newFile.path.endsWith('/');
          if (existingIndex !== -1) {
            files[existingIndex] = { ...files[existingIndex], content: finalContent, isFolder: finalIsFolder, ...newFile };
          } else {
            files.push({ ...newFile, content: finalContent, isFolder: finalIsFolder });
          }
        });
      }
      executionLog.push(`Datos agregados del orquestador: Nombre: ${projectName}, Notas (inicio): ${aiNotes.substring(0,50)}..., ${files.length} archivos.`);
    }

    if (decision.next_agent_id?.toUpperCase() === 'COMPLETADO') {
      executionLog.push(`Orquestador indica COMPLETADO. Resumen/Instrucción final: ${decision.instruction_for_next_agent}`);
      // Ensure final aiNotes and files are from data_to_aggregate if completion
      aiNotes = decision.data_to_aggregate?.aiNotes || decision.instruction_for_next_agent || aiNotes;
      if(decision.data_to_aggregate?.projectName) projectName = decision.data_to_aggregate.projectName;
      if(Array.isArray(decision.data_to_aggregate?.files)) {
        files = decision.data_to_aggregate.files.map(f => ({...f, content: f.content ?? '', isFolder: f.isFolder ?? f.path.endsWith('/') }));
      }
      completed = true;
      break;
    }

    const agentIdToCall = decision.next_agent_id;
    const instructionForAgent = decision.instruction_for_next_agent;
    const agentSystemPromptForDelegate = getAgentSystemPrompt(agentIdToCall);

    executionLog.push(`Llamando a Agente: ${agentIdToCall} con instrucción (primeros 300 chars):\n${instructionForAgent.substring(0, 300)}...`);

    let agentResponseText: string = `[Respuesta no obtenida del agente ${agentIdToCall}]`;
    try {
      const agentLlmResponse = await ai.generate({
        prompt: `${agentSystemPromptForDelegate}\n\nTu tarea actual es: ${instructionForAgent}. Tu respuesta debe ser el resultado directo de la tarea. Si se te pide generar el contenido de un archivo, devuelve solo ese contenido. Si se te pide un nombre de proyecto, devuelve solo el nombre. Si se te pide una lista de archivos, devuelve un JSON como este: {"files": [{"path": "...", "content": "..."}]}. Responde en castellano.`,
        config: { temperature: 0.6 },
      });
      agentResponseText = agentLlmResponse.text; // Property access for Genkit v1.x

      if (!agentResponseText && agentLlmResponse.output) { // Fallback if LLM returns structured output unexpectedly
         agentResponseText = JSON.stringify(agentLlmResponse.output);
      } else if (!agentResponseText) {
          agentResponseText = "[El agente no devolvió texto ni output estructurado]";
      }
      executionLog.push(`Respuesta de ${agentIdToCall} (primeros 500 chars):\n${agentResponseText.substring(0, 500)}...`);
    } catch (e: any) {
      const errorMsg = e.message || `Error desconocido llamando al Agente ${agentIdToCall}`;
      executionLog.push(`[ERROR] Turno ${turn} - Llamada al Agente ${agentIdToCall} falló: ${errorMsg}. Respuesta cruda (texto) si disponible: ${e.response?.text || e.toString()}`);
      agentResponseText = `Error del agente ${agentIdToCall}: ${errorMsg}`; // Pass error back to orchestrator
      console.error(`[Flow: ${flowName} (Grupo)] Error en turno ${turn} llamando al agente ${agentIdToCall}:`, e);
      // No rompemos el bucle aquí, dejamos que el orquestador decida qué hacer.
    }
    currentTaskForOrchestrator = `Contexto: El agente ${agentIdToCall} respondió a la instrucción "${instructionForAgent.substring(0,100)}..." con lo siguiente:\n"${agentResponseText}"\n\nEstado actual del proyecto (Nombre: ${projectName}, ${files.length} archivos generados, Notas (inicio): ${aiNotes.substring(0,100)}...). Objetivo general: "${input.description.substring(0,100)}...". ¿Cuál es el siguiente paso?
Recuerda devolver tu decisión en JSON con "next_agent_id", "instruction_for_next_agent", "reasoning", y "data_to_aggregate" si tienes partes del proyecto para agregar/actualizar.
Si el proyecto está completo, usa "COMPLETADO" como next_agent_id y proporciona el ProjectGenerationResult final en "data_to_aggregate".`;
    turn++;
  } // Fin del bucle while

  if (!completed && turn > MAX_TURNS) {
    executionLog.push(`\nSe alcanzó el límite máximo de ${MAX_TURNS} turnos.`);
    aiNotes += `\nProceso finalizado por alcanzar el límite de ${MAX_TURNS} turnos. El proyecto podría estar incompleto. Revisa el log para ver el estado actual.`;
  }
  if (completed) {
     executionLog.push(`\nProceso de generación por grupo marcado como COMPLETADO en turno ${turn -1}.`);
  }


  const finalFiles = files.map((file) => ({
    ...file,
    content: file.content ?? '',
    isFolder: file.isFolder ?? file.path.endsWith('/'),
  }));

  console.log(`[Flow: ${flowName} (Grupo)] Generación por grupo finalizada. Proyecto: ${projectName}, Archivos: ${finalFiles.length}, Notas: ${aiNotes.substring(0,100)}`);
  return {
    projectName,
    aiNotes,
    files: finalFiles,
    groupLog: executionLog.join('\n\n'),
  };
}
```