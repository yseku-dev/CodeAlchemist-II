
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 * This flow can operate in two modes:
 * 1. Single Prompt Mode: If no agentSystemPrompt (group orchestrator context) is provided,
 *    it makes a single call to an LLM to generate the entire project structure.
 * 2. Group/Multi-Turn Mode: If an agentSystemPrompt (typically the orchestrator's system prompt
 *    for a selected group) is provided, it orchestrates a multi-turn interaction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type {
  GenerateProjectInput,
  ProjectGenerationResult,
  GeneratedFile,
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
  data_to_aggregate: ProjectGenerationResultSchemaForFlow.partial()
    .optional()
    .describe(
      'Datos parciales del proyecto para agregar (projectName, aiNotes, files). Si next_agent_id es "COMPLETADO", este campo DEBE contener el ProjectGenerationResult final completo con projectName, aiNotes y la lista COMPLETA de files con su contenido.'
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

function getAgentSystemPrompt(agentId: string): string {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
  if (agent) return agent.systemPrompt;

  const roleName = agentId.replace(/([A-Z])/g, ' $1').trim();
  return `Eres un ${roleName}. Tu tarea actual es: {instruction}. Tu respuesta debe ser el resultado directo de la tarea. Si se te pide generar el contenido de un archivo, devuelve solo ese contenido. Si se te pide un nombre de proyecto, devuelve solo el nombre. Responde en castellano.`;
}

export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  const flowName = 'generateProjectStructureFlow';

  // SINGLE PROMPT MODE
  if (!input.agentSystemPrompt) {
    console.log(`[Flow: ${flowName} (Modo Prompt Único)] Iniciado con descripción: ${input.description.substring(0,100)}...`);
    const promptLines = [
      'Eres un experto arquitecto de software y desarrollador Full-Stack. Tu tarea es generar una estructura de proyecto completa (archivos y carpetas) basada en la descripción del usuario. Tu respuesta DEBE ser un único objeto JSON que se adhiera al schema ProjectGenerationResultSchemaForFlow, que incluye `projectName` (string), `aiNotes` (string), y `files` (array de objetos con `path` (string), `content` (string, opcional), `isFolder` (boolean, opcional)).',
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
      console.log(`[Flow: ${flowName} (Modo Prompt Único)] Llamando a ai.generate...`);
      const llmResponse = await ai.generate({
        prompt: promptLines.join('\n'),
        output: { schema: ProjectGenerationResultSchemaForFlow, format: 'json' },
        config: { temperature: 0.4 },
      });
      const output = llmResponse.output;
      if (!output) {
        console.error(`[Flow: ${flowName} (Modo Prompt Único)] No output from LLM.`);
        throw new AppError(
          'La IA no pudo generar la estructura del proyecto (modo prompt único).',
          { originalError: 'No output from LLM in single prompt mode' },
          'ai'
        );
      }
      const processedFiles = output.files.map((file: Partial<GeneratedFile>) => ({
        path: file.path || 'ruta/desconocida',
        content: file.content ?? '',
        isFolder: file.isFolder ?? file.path?.endsWith('/') ?? false,
      }));
      console.log(`[Flow: ${flowName} (Modo Prompt Único)] Generación exitosa. Proyecto: ${output.projectName}`);
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
        { originalError: error, executionLog: `Error en modo prompt único: ${error.message || String(error)}` },
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
Tu respuesta DEBE ser un JSON válido con los campos "next_agent_id", "instruction_for_next_agent", "reasoning".
Opcionalmente, puedes incluir "data_to_aggregate" (un objeto con claves "projectName", "aiNotes", "files" - donde "files" es un array de GeneratedFile con "path", "content", "isFolder") para pasar partes del proyecto que ya se hayan generado o acumulado.
Cuando la tarea esté COMPLETADA, establece next_agent_id a "COMPLETADO" y proporciona el ProjectGenerationResult final COMPLETO (con projectName, aiNotes, y la lista COMPLETA de files con su contenido) en el campo "data_to_aggregate".
Recuerda que el contenido de cada archivo de código debe ser COMPLETO Y FUNCIONAL. No uses placeholders.
Todas tus respuestas deben estar en castellano.`;

  executionLog.push(`[TURNO ${turn}] Tarea Inicial para Orquestador:\n${currentTaskForOrchestrator.substring(0, 300)}...`);

  while (turn <= MAX_TURNS && !completed) {
    executionLog.push(`\n--- [TURNO ${turn}/${MAX_TURNS}] ---`);
    executionLog.push(`Orquestador Recibiendo Tarea (Turno ${turn}):\n${currentTaskForOrchestrator.substring(0, 500)}...`);
    console.log(`[Flow: ${flowName} (Grupo)] Turno ${turn}: Llamando al Orquestador...`);

    let decision: z.infer<typeof orchestratorDecisionSchema> | undefined;
    try {
      const orchestratorLlmResponse = await ai.generate({
        prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
        output: { schema: orchestratorDecisionSchema, format: 'json' },
        config: { temperature: 0.5 },
      });
      
      let rawOrchestratorOutputForLog = 'N/A';
      if (orchestratorLlmResponse.raw?.candidates?.[0]?.output) {
        try {
          const tempString = JSON.stringify(orchestratorLlmResponse.raw.candidates[0].output);
          rawOrchestratorOutputForLog = tempString.substring(0, 500) + (tempString.length > 500 ? '...' : '');
        } catch (stringifyError) {
          rawOrchestratorOutputForLog = '[Error al stringify la respuesta cruda para el log]';
          console.error(`[Flow: ${flowName}] Error al stringify la respuesta cruda del orquestador:`, stringifyError);
        }
      }
      executionLog.push(`Respuesta JSON cruda del Orquestador (Turno ${turn}) (truncada): ${rawOrchestratorOutputForLog}`);
      
      decision = orchestratorLlmResponse.output;

      if (!decision) {
        const errorMsg = "El orquestador no devolvió 'output' estructurado o fue undefined.";
        executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - ${errorMsg}`);
        aiNotes += `\nError en Turno ${turn}: ${errorMsg}`;
        completed = true;
        break;
      }
      executionLog.push(`Decisión parseada del Orquestador (Turno ${turn}):\n${JSON.stringify(decision, null, 2)}`);

      if (!decision.next_agent_id || !decision.instruction_for_next_agent) {
        const errorMsg = "Respuesta del Orquestador incompleta (faltan next_agent_id o instruction_for_next_agent).";
        executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - ${errorMsg}`);
        aiNotes += `\nError en Turno ${turn}: ${errorMsg}`;
        completed = true;
        break;
      }

    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      executionLog.push(`[ERROR CRÍTICO] Turno ${turn} - Llamada al Orquestador falló: ${errorMsg.substring(0, 200)}... (ver logs del servidor para detalles)`);
      console.error(`[Flow: ${flowName}] Turno ${turn} - Error completo en llamada al orquestador:`, e);
      aiNotes += `\nError en Turno ${turn} con Orquestador: ${errorMsg.substring(0,100)}...`;
      completed = true;
      break;
    }

    if (decision.data_to_aggregate) {
      if (decision.data_to_aggregate.projectName) projectName = decision.data_to_aggregate.projectName;
      if (decision.data_to_aggregate.aiNotes) aiNotes = decision.data_to_aggregate.aiNotes;
      if (Array.isArray(decision.data_to_aggregate.files)) {
        decision.data_to_aggregate.files.forEach((newFile: Partial<GeneratedFile>) => {
          if (newFile.path) {
            const existingIndex = files.findIndex(f => f.path === newFile.path);
            const finalContent = newFile.content ?? '';
            const finalIsFolder = newFile.isFolder ?? newFile.path.endsWith('/');
            if (existingIndex !== -1) {
              files[existingIndex] = { path: newFile.path, content: finalContent, isFolder: finalIsFolder, ...newFile };
            } else {
              files.push({ path: newFile.path, content: finalContent, isFolder: finalIsFolder });
            }
          }
        });
      }
      executionLog.push(`Datos agregados del orquestador (Turno ${turn}): Nombre: ${projectName}, Notas (inicio): ${aiNotes.substring(0,50)}..., ${files.length} archivos.`);
    }

    if (decision.next_agent_id?.toUpperCase() === 'COMPLETADO') {
      executionLog.push(`Orquestador indica COMPLETADO (Turno ${turn}). Resumen/Instrucción final: ${decision.instruction_for_next_agent}`);
      aiNotes = decision.data_to_aggregate?.aiNotes || decision.instruction_for_next_agent || aiNotes;
      if(decision.data_to_aggregate?.projectName) projectName = decision.data_to_aggregate.projectName;
      
      if(decision.data_to_aggregate && Array.isArray(decision.data_to_aggregate.files)) {
         files = decision.data_to_aggregate.files.map(f => ({path: f.path || 'ruta/desconocida', content: f.content ?? '', isFolder: f.isFolder ?? f.path?.endsWith('/') ?? false }));
         executionLog.push(`Proyecto final ensamblado desde data_to_aggregate. Archivos: ${files.length}`);
      } else if (files.length > 0) {
          executionLog.push(`Proyecto final ensamblado desde datos acumulados. Archivos: ${files.length}`);
      } else {
         console.warn(`[Flow: ${flowName} (Grupo)] Turno ${turn} - COMPLETADO pero data_to_aggregate.files no es un array o no existe, y 'files' acumulados está vacío.`);
         executionLog.push(`[ADVERTENCIA] Turno ${turn} - Orquestador indicó COMPLETADO pero no proporcionó 'data_to_aggregate.files' con la estructura final, ni se acumularon archivos. El resultado podría estar incompleto.`);
         aiNotes += "\nAdvertencia: El orquestador indicó completado pero no se pudo ensamblar una lista final de archivos.";
      }
      completed = true;
      break;
    }

    const agentIdToCall = decision.next_agent_id;
    const instructionForAgent = decision.instruction_for_next_agent;
    const agentSystemPromptForDelegate = getAgentSystemPrompt(agentIdToCall);

    executionLog.push(`Llamando a Agente (Turno ${turn}): ${agentIdToCall} con instrucción (primeros 300 chars):\n${instructionForAgent.substring(0, 300)}...`);
    console.log(`[Flow: ${flowName} (Grupo)] Turno ${turn}: Llamando al Agente ${agentIdToCall}...`);

    let agentResponseText: string = `[Respuesta no obtenida del agente ${agentIdToCall}]`;
    try {
      const agentLlmResponse = await ai.generate({
        prompt: `${agentSystemPromptForDelegate}\n\nTu tarea actual es: ${instructionForAgent}. Tu respuesta debe ser un string, no un JSON, a menos que la instrucción lo pida específicamente. Si generas código, solo devuelve el código o el contenido del archivo.`,
        config: { temperature: 0.6 },
      });
      agentResponseText = agentLlmResponse.text ?? "";
      if (!agentResponseText && agentLlmResponse.output) {
         agentResponseText = JSON.stringify(agentLlmResponse.output);
      } else if (!agentResponseText) {
          agentResponseText = "[El agente no devolvió texto ni output estructurado]";
      }
      executionLog.push(`Respuesta de ${agentIdToCall} (Turno ${turn}, primeros 500 chars):\n${agentResponseText.substring(0, 500)}...`);
    } catch (e: any) {
      const errorMsg = e.message || `Error desconocido llamando al Agente ${agentIdToCall}`;
      executionLog.push(`[ERROR] Turno ${turn} - Llamada al Agente ${agentIdToCall} falló: ${errorMsg.substring(0,200)}... (ver logs del servidor para detalles)`);
      console.error(`[Flow: ${flowName} (Grupo)] Turno ${turn} - Error completo en llamada al agente ${agentIdToCall}:`, e);
      agentResponseText = `Error del agente ${agentIdToCall}: ${errorMsg.substring(0,100)}...`;
    }
    
    currentTaskForOrchestrator = `Contexto: El agente ${agentIdToCall} respondió a la instrucción "${instructionForAgent.substring(0,100)}..." con lo siguiente:\n"${agentResponseText.substring(0, 1000)}..."\n\nEstado actual del proyecto (Nombre: ${projectName}, ${files.length} archivos generados, Notas (inicio): ${aiNotes.substring(0,100)}...). Objetivo general: "${input.description.substring(0,100)}...". ¿Cuál es el siguiente paso?
Recuerda devolver tu decisión en JSON con "next_agent_id", "instruction_for_next_agent", "reasoning", y "data_to_aggregate" si tienes partes del proyecto para agregar/actualizar (como "projectName", "aiNotes", o nuevos "files").
Si el proyecto está completo, usa "COMPLETADO" como next_agent_id y proporciona el ProjectGenerationResult final COMPLETO en "data_to_aggregate".`;
    
    turn++;
  }

  if (!completed && turn > MAX_TURNS) {
    executionLog.push(`\nSe alcanzó el límite máximo de ${MAX_TURNS} turnos.`);
    aiNotes += `\nProceso finalizado por alcanzar el límite de ${MAX_TURNS} turnos. El proyecto podría estar incompleto. Revisa el log para ver el estado actual.`;
  }
  if (completed) {
     executionLog.push(`\nProceso de generación por grupo marcado como COMPLETADO en turno ${turn > MAX_TURNS ? MAX_TURNS : turn}.`);
  }

  const finalFiles = files.map((file) => ({
    path: file.path || 'ruta/desconocida',
    content: file.content ?? '',
    isFolder: file.isFolder ?? file.path?.endsWith('/') ?? false,
  }));

  console.log(`[Flow: ${flowName} (Grupo)] Generación por grupo finalizada. Proyecto: ${projectName}, Archivos: ${finalFiles.length}, Notas (inicio): ${aiNotes.substring(0,100)}`);
  
  const finalResult: ProjectGenerationResult = {
    projectName,
    aiNotes,
    files: finalFiles,
    groupLog: executionLog.join('\n\n'),
  };
  
  try {
    ProjectGenerationResultSchemaForFlow.parse(finalResult);
  } catch (validationError) {
    console.error(`[Flow: ${flowName} (Grupo)] Error de validación del resultado final:`, validationError);
    executionLog.push(`[ERROR FINAL] El resultado generado no cumple el schema: ${JSON.stringify(validationError)}`);
    finalResult.aiNotes += `\n[ERROR INTERNO] El resultado final no cumplió el schema. ${JSON.stringify(validationError)}`;
    finalResult.groupLog = executionLog.join('\n\n');
  }

  return finalResult;
}

    