
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
import { DEFAULT_AGENTS } from '@/lib/constants';

// Schemas for this flow
const GeneratedFileSchema = z.object({
  path: z.string().describe('Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'),
  content: z.string().optional().describe('Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const ProjectGenerationResultSchemaForFlow = z.object({
  projectName: z.string().describe('Un nombre sugerido para el proyecto.'),
  aiNotes: z.string().describe('Comentarios o notas de la IA sobre la estructura generada.'),
  files: z.array(GeneratedFileSchema).describe('Una lista de archivos y carpetas generados.'),
});

// Schema for orchestrator's decision
const orchestratorDecisionSchema = z.object({
  next_agent_id: z.string().describe("ID del siguiente agente o 'COMPLETADO'."),
  instruction_for_next_agent: z.string().describe("Instrucción para el siguiente agente o resumen final."),
  reasoning: z.string().optional().describe("Breve explicación de la decisión."),
  data_to_aggregate: ProjectGenerationResultSchemaForFlow.partial().optional().describe('Datos parciales del proyecto para agregar.'),
});

const GenerateProjectInputSchema = z.object({
  description: z.string().describe('Descripción detallada del proyecto a generar.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente orquestador.'),
});

// Helper para obtener el prompt de sistema de un agente por defecto
function getAgentSystemPrompt(agentId: string): string {
  const agent = DEFAULT_AGENTS.find((a) => a.id === agentId);
  if (agent) return agent.systemPrompt;
  // Fallback genérico si el agente no está en la lista de defaults o si se quiere un comportamiento más simple
  return `Eres un ${agentId}. Tu tarea actual es la siguiente:`;
}

export async function generateProjectStructure(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
  return generateProjectStructureFlow(input);
}

const generateProjectStructureFlow = ai.defineFlow(
  {
    name: 'generateProjectStructureFlow',
    inputSchema: GenerateProjectInputSchema,
    outputSchema: ProjectGenerationResultSchemaForFlow.extend({ groupLog: z.string().optional() }),
  },
  async (input): Promise<ProjectGenerationResult & { groupLog?: string }> => {
    const flowName = 'generateProjectStructureFlow (Grupo)';
    console.log(`[Flow: ${flowName}] Iniciado con descripción: ${input.description.substring(0, 50)}...`);
    const executionLog: string[] = [];

    let projectName: string = `proyecto-generado-${Date.now()}`;
    let aiNotes: string = "Notas iniciales del proceso de generación por grupo.";
    let files: GeneratedFile[] = [];
    let completed = false;
    const MAX_TURNS = 7; // Límite de turnos para evitar bucles infinitos

    let currentTaskForOrchestrator = `Tarea Inicial: Generar un proyecto completo basado en la descripción del usuario: "${input.description}".
Planifica los pasos y delega a los agentes apropiados (como JefeDeProducto, ArquitectoSoftware, DesarrolladorSoftware) para generar progresivamente el nombre del proyecto, las notas de la IA, y la lista de archivos con su contenido.
Tu respuesta DEBE ser un JSON válido con los campos "next_agent_id", "instruction_for_next_agent", "reasoning", y opcionalmente "data_to_aggregate" (con campos de ProjectGenerationResult como projectName, aiNotes, o files).
Cuando la tarea esté completada, establece next_agent_id a "COMPLETADO" y proporciona el ProjectGenerationResult final en "data_to_aggregate".`;

    executionLog.push(currentTaskForOrchestrator);

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      if (completed) break;
      executionLog.push(`\n--- [TURNO ${turn}/${MAX_TURNS}] ---`);
      executionLog.push(`Orquestador Recibiendo Tarea:\n${currentTaskForOrchestrator.substring(0, 300)}...`);

      let decision;
      try {
        const orchestratorLlmResponse = await ai.generate({
          prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
          output: { schema: orchestratorDecisionSchema, format: 'json' },
          config: { temperature: 0.4 }, // Ajustar temperatura según sea necesario
        });
        
        decision = orchestratorLlmResponse.output; // ACCESO CORRECTO PARA GENKIT v1.x JSON

        if (!decision) {
          executionLog.push(`[ERROR] Orquestador no devolvió un 'output' estructurado en el Turno ${turn}.`);
          aiNotes += `\nError en Turno ${turn}: El orquestador no devolvió una respuesta estructurada.`;
          completed = true;
          break;
        }
        executionLog.push(`Respuesta del Orquestador (parseada):\n${JSON.stringify(decision, null, 2)}`);

      } catch (e: any) {
        const errorMsg = e.message || "Error desconocido llamando al Orquestador";
        executionLog.push(`[ERROR] Turno ${turn} - Llamada al Orquestador falló: ${errorMsg}`);
        aiNotes += `\nError en Turno ${turn} con Orquestador: ${errorMsg}`;
        console.error(`[Flow: ${flowName}] Error en turno ${turn} llamando al orquestador:`, e);
        completed = true;
        break;
      }

      // Procesar data_to_aggregate si existe
      if (decision.data_to_aggregate) {
        if (decision.data_to_aggregate.projectName) projectName = decision.data_to_aggregate.projectName;
        if (decision.data_to_aggregate.aiNotes) aiNotes = decision.data_to_aggregate.aiNotes;
        if (Array.isArray(decision.data_to_aggregate.files)) {
          // Fusionar archivos, evitando duplicados y actualizando si es necesario
          decision.data_to_aggregate.files.forEach((newFile: GeneratedFile) => {
            const existingIndex = files.findIndex(f => f.path === newFile.path);
            if (existingIndex !== -1) {
              files[existingIndex] = { ...files[existingIndex], ...newFile, content: newFile.content ?? files[existingIndex].content ?? '' };
            } else {
              files.push({ ...newFile, content: newFile.content ?? '' });
            }
          });
        }
        executionLog.push(`Datos agregados del orquestador: Nombre: ${projectName}, ${files.length} archivos.`);
      }

      if (decision.next_agent_id?.toUpperCase() === 'COMPLETADO') {
        executionLog.push(`Orquestador indica COMPLETADO. Resumen: ${decision.instruction_for_next_agent}`);
        aiNotes = decision.data_to_aggregate?.aiNotes || decision.instruction_for_next_agent || aiNotes;
        if (decision.data_to_aggregate?.projectName) projectName = decision.data_to_aggregate.projectName;
        if (Array.isArray(decision.data_to_aggregate?.files)) files = decision.data_to_aggregate.files.map(f => ({...f, content: f.content ?? ''}));
        completed = true;
        break;
      }

      const agentIdToCall = decision.next_agent_id;
      const instructionForAgent = decision.instruction_for_next_agent;
      const agentSystemPromptForDelegate = getAgentSystemPrompt(agentIdToCall);

      executionLog.push(`Llamando a Agente: ${agentIdToCall} con instrucción:\n${instructionForAgent.substring(0, 300)}...`);

      let agentResponseText: string;
      try {
        const agentLlmResponse = await ai.generate({
          prompt: `${agentSystemPromptForDelegate}\n\nTu tarea actual es: ${instructionForAgent}. Responde de forma concisa con el resultado de tu tarea. Si generas contenido de archivo, proporciona solo el contenido. Si se te pide una lista de archivos, proporciona un JSON con {"files": [{"path": "...", "content": "..."}]}.`,
          config: { temperature: 0.5 },
        });
        agentResponseText = agentLlmResponse.text; // ACCESO CORRECTO PARA GENKIT v1.x TEXTO

        if (!agentResponseText && agentLlmResponse.output) { // Fallback si devuelve output estructurado por error
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
        // Podríamos decidir si continuar o no, por ahora pasamos el error al orquestador
      }
      currentTaskForOrchestrator = `El agente ${agentIdToCall} respondió:\n"${agentResponseText}"\n\nConsiderando esta respuesta y el objetivo general de generar el proyecto ("${input.description}"), ¿cuál es el siguiente paso? Recuerda devolver tu decisión en JSON con "next_agent_id", "instruction_for_next_agent", "reasoning", y "data_to_aggregate" si tienes partes del proyecto para agregar. Si el proyecto está completo, usa "COMPLETADO" y proporciona el ProjectGenerationResult final en "data_to_aggregate".`;
    } // Fin del bucle for

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
);

    