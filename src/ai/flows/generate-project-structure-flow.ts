
'use server';
/**
 * @fileOverview Flow for generating a project structure from a description.
 *
 * - generateProjectStructure - A function that handles project structure generation.
 * - GenerateProjectInput - The input type for the function.
 * - ProjectGenerationResult - The return type.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { GenerateProjectInput, ProjectGenerationResult, GeneratedFile, ChatMessage } from '@/types';
import { AppError } from '@/utils/AppError';
import { DEFAULT_AGENTS } from '@/lib/constants'; // For default agent prompts

const GeneratedFileSchema = z.object({
  path: z.string().describe('Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'),
  content: z.string().describe('Contenido COMPLETO y funcional del archivo. Vacío para carpetas.'),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const GenerateProjectInputSchema = z.object({
  description: z.string().describe('Descripción detallada del proyecto a generar, incluyendo tipo, tecnologías, estructura deseada, etc.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente orquestador, si la generación es impulsada por un grupo.'),
});

const ProjectGenerationResultSchema = z.object({
  projectName: z.string().describe('Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'),
  aiNotes: z.string().describe('Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar.'),
  files: z.array(GeneratedFileSchema).describe('Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'),
  groupLog: z.string().optional().describe('Log de ejecución si la generación fue coordinada por un grupo.'),
});

// Helper para obtener el prompt de sistema de un agente por defecto
function getDefaultAgentSystemPrompt(agentId: string): string | undefined {
  return DEFAULT_AGENTS.find(agent => agent.id === agentId)?.systemPrompt;
}


export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  return generateProjectStructureFlow(input);
}

const orchestratorDecisionSchema = z.object({
  next_agent_id: z.string().describe("ID del siguiente agente a llamar o 'COMPLETADO' si la tarea ha finalizado."),
  instruction_for_next_agent: z.string().describe("Instrucción detallada para el siguiente agente o resumen final si 'COMPLETADO'."),
  reasoning: z.string().optional().describe("Breve explicación de la decisión."),
  data_to_aggregate: z.any().optional().describe("Datos parciales del proyecto (projectName, aiNotes, files) que el orquestador ha acumulado o que un agente ha devuelto para agregar al resultado final."),
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
  "Ejemplo de un objeto 'file' para un archivo: `{ \"path\": \"src/index.js\", \"content\": \"console.log(\\\"Hola Mundo\\\");\" }`"
];


const projectGenerationPrompt = ai.definePrompt({
  name: 'generateProjectStructurePromptDirect',
  input: { schema: GenerateProjectInputSchema },
  output: { schema: ProjectGenerationResultSchema },
  prompt: promptLines.join('\n'),
});

const generateProjectStructureFlow = ai.defineFlow(
  {
    name: 'generateProjectStructureFlow',
    inputSchema: GenerateProjectInputSchema,
    outputSchema: ProjectGenerationResultSchema,
  },
  async (input) => {
    const flowName = 'generateProjectStructureFlow';
    console.log(`[Flow: ${flowName}] Iniciado con descripción: ${input.description.substring(0, 100)}... Contexto de Agente/Grupo: ${input.agentSystemPrompt ? 'Sí' : 'No'}`);

    // Si no hay agentSystemPrompt, es una llamada directa para generar el proyecto.
    if (!input.agentSystemPrompt) {
      console.log(`[Flow: ${flowName}] Modo de generación directa (sin grupo). Llamando a projectGenerationPrompt.`);
      try {
        const llmResponse = await projectGenerationPrompt(input);
        const output = llmResponse.output;

        if (!output) {
          console.error(`[Flow: ${flowName}] No output from LLM in direct mode.`);
          throw new AppError("La IA no pudo generar la estructura del proyecto.", { originalError: "No output from LLM in direct mode" }, 'ai');
        }
        const processedFiles = output.files.map(file => ({
          ...file,
          content: file.content ?? "",
          isFolder: file.isFolder ?? file.path.endsWith('/'),
        }));
        console.log(`[Flow: ${flowName}] Generación directa exitosa. Proyecto: ${output.projectName}`);
        return { ...output, files: processedFiles, groupLog: "Generación directa completada." };
      } catch (error: any) {
        console.error(`[Flow: ${flowName}] Error ORIGINAL en modo de generación directa:`, error);
        if (error.stack) console.error(`[Flow: ${flowName}] Stack del error original (directo):`, error.stack);
        if (error.details) console.error(`[Flow: ${flowName}] Detalles del error original (directo):`, error.details);
        if (error.cause) console.error(`[Flow: ${flowName}] Causa del error original (directo):`, error.cause);

        if (error instanceof AppError) throw error;
        throw new AppError("Ocurrió un error al generar la estructura del proyecto (modo directo).", error, 'ai');
      }
    }

    // Lógica Multi-Turno cuando se proporciona agentSystemPrompt (contexto de grupo/orquestador)
    console.log(`[Flow: ${flowName}] Modo de generación por grupo. Contexto del orquestador proporcionado.`);
    const executionLog: string[] = [];
    let projectName: string = `proyecto-${Date.now()}`;
    let aiNotes: string = "Notas iniciales del proceso de generación por grupo.";
    let files: GeneratedFile[] = [];
    let currentTaskForOrchestrator = `Tarea Inicial: Generar un proyecto completo basado en la descripción: "${input.description}". Planifica los pasos y delega a los agentes apropiados (como JefeDeProducto para nombre/notas, ArquitectoSoftware para estructura, DesarrolladorSoftware para contenido de archivos). Tu respuesta debe ser un JSON con next_agent_id, instruction_for_next_agent, y opcionalmente data_to_aggregate con {projectName, aiNotes, files}.`;
    const MAX_TURNS = 7;

    executionLog.push(`[TURNO 0] Tarea inicial para el Orquestador: ${currentTaskForOrchestrator}`);

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      executionLog.push(`\n--- [TURNO ${turn}] ---`);
      executionLog.push(`Orquestador recibiendo: ${currentTaskForOrchestrator.substring(0, 300)}...`);

      let orchestratorResponseText: string;
      try {
        const orchestratorResponse = await ai.generate({
          prompt: `${input.agentSystemPrompt}\n\n${currentTaskForOrchestrator}`,
          output: { schema: orchestratorDecisionSchema, format: "json" }, // Espera JSON del orquestador
          config: { temperature: 0.5 }
        });
        orchestratorResponseText = orchestratorResponse.text();
        executionLog.push(`Respuesta JSON cruda del Orquestador: ${orchestratorResponseText}`);
      } catch (e: any) {
        executionLog.push(`ERROR llamando al Orquestador: ${e.message}`);
        aiNotes += `\nError en Turno ${turn} con Orquestador: ${e.message}`;
        break;
      }

      let decision;
      try {
        decision = JSON.parse(orchestratorResponseText);
        if (!orchestratorDecisionSchema.parse(decision)) { // Valida con Zod
             throw new Error("La respuesta del orquestador no cumple el schema.");
        }
      } catch (e: any) {
        executionLog.push(`ERROR parseando respuesta del Orquestador: ${e.message}. Respuesta: ${orchestratorResponseText}`);
        aiNotes += `\nError en Turno ${turn} parseando Orquestador: ${e.message}`;
        break;
      }
      
      executionLog.push(`Decisión del Orquestador: Próximo Agente: ${decision.next_agent_id}, Instrucción: ${(decision.instruction_for_next_agent || "").substring(0,150)}..., Razonamiento: ${decision.reasoning || 'N/A'}`);

      // Agregar datos si el orquestador los devuelve
      if (decision.data_to_aggregate) {
        if (decision.data_to_aggregate.projectName) projectName = decision.data_to_aggregate.projectName;
        if (decision.data_to_aggregate.aiNotes) aiNotes = decision.data_to_aggregate.aiNotes; // Podría concatenar o reemplazar
        if (Array.isArray(decision.data_to_aggregate.files)) {
          // Lógica de fusión más inteligente podría ser necesaria aquí
          files = [...files, ...decision.data_to_aggregate.files.filter((f: any) => f.path && typeof f.content === 'string')];
        }
        executionLog.push(`Datos agregados desde el orquestador: Nombre: ${projectName}, ${files.length} archivos.`);
      }


      if (decision.next_agent_id.toUpperCase() === "COMPLETADO") {
        executionLog.push(`Orquestador indica COMPLETADO. Resumen: ${decision.instruction_for_next_agent}`);
        if (decision.instruction_for_next_agent && decision.instruction_for_next_agent.startsWith("{")) { // Intenta parsear si parece JSON
            try {
                const finalData = JSON.parse(decision.instruction_for_next_agent);
                if(finalData.projectName) projectName = finalData.projectName;
                if(finalData.aiNotes) aiNotes = finalData.aiNotes;
                if(Array.isArray(finalData.files)) files = finalData.files;
            } catch (e) { /* no hacer nada si no es JSON */}
        } else if (decision.instruction_for_next_agent) {
            aiNotes = aiNotes ? `${aiNotes}\n\nNota final del Orquestador: ${decision.instruction_for_next_agent}` : `Nota final del Orquestador: ${decision.instruction_for_next_agent}`;
        }
        break;
      }

      const agentSystemPrompt = getDefaultAgentSystemPrompt(decision.next_agent_id) || `Eres un asistente IA experto en ${decision.next_agent_id}.`;
      executionLog.push(`Llamando a Agente: ${decision.next_agent_id} con instrucción: ${(decision.instruction_for_next_agent || "").substring(0,150)}...`);

      let agentResponseText: string;
      try {
        // Para el agente delegado, la respuesta no necesita ser JSON obligatoriamente, a menos que su prompt lo especifique
        const agentResponse = await ai.generate({
          prompt: `${agentSystemPrompt}\n\nTu tarea actual es: ${decision.instruction_for_next_agent}`,
          config: { temperature: 0.6 }
        });
        agentResponseText = agentResponse.text();
        executionLog.push(`Respuesta de ${decision.next_agent_id}: ${agentResponseText.substring(0, 300)}...`);
      } catch (e: any) {
        executionLog.push(`ERROR llamando al Agente ${decision.next_agent_id}: ${e.message}`);
        aiNotes += `\nError en Turno ${turn} con Agente ${decision.next_agent_id}: ${e.message}`;
        // Podríamos continuar y dejar que el orquestador maneje este error, o romper. Por ahora, continuamos.
        agentResponseText = `Error del agente ${decision.next_agent_id}: ${e.message}`;
      }
      currentTaskForOrchestrator = `El agente ${decision.next_agent_id} respondió: "${agentResponseText}". Por favor, procesa esta respuesta, agrega los datos relevantes si es necesario (projectName, aiNotes, files), y continúa con el plan o indica la finalización.`;
    }

    if (turn > MAX_TURNS) {
      executionLog.push(`\nSe alcanzó el límite máximo de ${MAX_TURNS} turnos.`);
      aiNotes += `\nProceso finalizado por alcanzar el límite de ${MAX_TURNS} turnos.`;
    }

    const finalFiles = files.map(file => ({
      ...file,
      content: file.content ?? "",
      isFolder: file.isFolder ?? file.path.endsWith('/'),
    }));

    console.log(`[Flow: ${flowName}] Generación por grupo finalizada. Proyecto: ${projectName}, Archivos: ${finalFiles.length}`);
    return { projectName, aiNotes, files: finalFiles, groupLog: executionLog.join('\n') };
  }
);
