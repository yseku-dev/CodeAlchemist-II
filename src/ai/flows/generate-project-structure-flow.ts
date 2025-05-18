
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
import type { GenerateProjectInput, ProjectGenerationResult, GeneratedFile } from '@/types';

const GeneratedFileSchema = z.object({
  path: z.string().describe('Ruta relativa del archivo o carpeta. Las carpetas deben terminar con /'),
  content: z.string().describe('Contenido del archivo. Vacío para carpetas.'),
  isFolder: z.boolean().optional().describe('Indica si es una carpeta.'),
});

const GenerateProjectInputSchema = z.object({
  description: z.string().describe('Descripción detallada del proyecto a generar, incluyendo tipo, tecnologías, estructura deseada, etc.'),
  agentSystemPrompt: z.string().optional().describe('El prompt de sistema de un agente, si la generación es impulsada por un agente específico o un contexto de grupo.'),
});

const ProjectGenerationResultSchema = z.object({
  projectName: z.string().describe('Un nombre sugerido para el proyecto (ej. mi-proyecto-genial, ProyectoAsombroso).'),
  aiNotes: z.string().describe('Comentarios o notas de la IA sobre la estructura generada, posibles próximos pasos, o dependencias a instalar.'),
  files: z.array(GeneratedFileSchema).describe('Una lista de archivos y carpetas generados, cada uno con su ruta y contenido.'),
  groupLog: z.string().optional().describe('Log de ejecución si la generación fue coordinada por un grupo (actualmente no se usa de forma detallada en este flujo).'),
});

export async function generateProjectStructure(
  input: GenerateProjectInput
): Promise<ProjectGenerationResult> {
  return generateProjectStructureFlow(input);
}

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
  '        *   `content`: Una cadena con el contenido del archivo. Para carpetas, el contenido puede ser una cadena vacía o un comentario como "/* Carpeta para... */".',
  '        *   `isFolder`: (opcional, booleano) Indica explícitamente si es una carpeta. Si `path` termina en `/`, se asume que es una carpeta.',
  '    *   Incluye archivos comunes como `README.md`, `.gitignore` (si aplica), un archivo de configuración de empaquetador (ej. `package.json` si es Node.js, `pom.xml` si es Maven, etc.), y algunos archivos de código fuente iniciales basados en la descripción.',
  '    *   Asegúrate de que las rutas de los archivos sean coherentes y representen una estructura de proyecto lógica.',
  '',
  'Toda la salida, incluyendo nombres de archivo, contenido y notas, debe estar en castellano.',
  'La respuesta DEBE ser un único objeto JSON que se adhiera estrictamente al esquema de salida especificado. No incluyas ningún texto explicativo fuera del objeto JSON.',
  'Ejemplo de un objeto \\'file\\' para una carpeta: `{ "path": "src/", "content": "", "isFolder": true }`',
  'Ejemplo de un objeto \\'file\\' para un archivo: `{ "path": "src/index.js", "content": "console.log(\\"Hola Mundo\\");" }`'
];

const prompt = ai.definePrompt({
  name: 'generateProjectStructurePrompt',
  input: { schema: GenerateProjectInputSchema },
  output: { schema: ProjectGenerationResultSchema },
  prompt: promptLines.join('\\n'),
});

const generateProjectStructureFlow = ai.defineFlow(
  {
    name: 'generateProjectStructureFlow',
    inputSchema: GenerateProjectInputSchema,
    outputSchema: ProjectGenerationResultSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output; // Corrected: property access

    if (!output) {
      throw new Error("La IA no pudo generar la estructura del proyecto.");
    }

    // Ensure files have isFolder correctly set if path ends with /
    const processedFiles = output.files.map(file => ({
      ...file,
      isFolder: file.isFolder ?? file.path.endsWith('/'),
    }));

    return { ...output, files: processedFiles };
  }
);

