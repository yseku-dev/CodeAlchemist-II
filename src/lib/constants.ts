
import type { Agent, AIAgentGroup, LLMSettings, LLMProvider } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is imported if used for IDs here

/**
 * The name of the application.
 * @constant {string}
 * @example
 * console.log(APP_NAME); // Outputs: "CodeAlchemist"
 */
export const APP_NAME = "CodeAlchemist";

/**
 * A tuple of available LLM providers.
 * This is used to derive the LLMProvider type and populate selectors.
 * @constant {readonly ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"]}
 */
export const LLM_PROVIDERS = ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"] as const;

/**
 * Default API URLs for each LLM provider.
 * Used as placeholders or default values in configuration forms.
 * @constant {Record<LLMProvider, string>}
 */
export const LLM_PROVIDER_DEFAULT_API_URLS: Record<LLMProvider, string> = {
  "Groq": "https://api.groq.com/openai/v1",
  "Google Gemini": "", // Genkit handles this, no explicit base URL needed by user
  "OpenAI": "https://api.openai.com/v1",
  "Anthropic": "https://api.anthropic.com/v1",
  "LM Studio": "http://localhost:1234/v1",
  "Ollama": "http://localhost:11434/v1",
};

/**
 * Default LLM settings for the application.
 * Used when initializing the application state or resetting configurations.
 * @constant {LLMSettings}
 */
export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  provider: "Groq",
  apiUrl: LLM_PROVIDER_DEFAULT_API_URLS["Groq"],
  apiKey: "",
  model: "", // Model should be selected by user based on provider
};

/**
 * Default agents to be initialized in the application if none are found in local storage.
 * These agents serve as examples and core functional units.
 * @constant {Agent[]}
 */
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "orquestador-flujo-agentes",
    name: "OrquestadorFlujoAgentes",
    description: "Gestiona el flujo de trabajo y la comunicación entre agentes en un grupo de trabajo. Decide qué agente actúa a continuación.",
    systemPrompt: `Eres el OrquestadorFlujoAgentes. Tu responsabilidad principal es gestionar el flujo de trabajo entre un equipo de agentes IA para completar una tarea compleja (ej. generar un proyecto de software, analizar código, etc.).
Recibes una tarea principal y el historial de conversación o el estado actual del trabajo.
Tu función es:
1.  **Analizar la Tarea y el Estado Actual:** Comprende la tarea general y lo que se ha hecho hasta ahora.
2.  **Planificar Próximos Pasos:** Descompón la tarea restante en subtareas manejables.
3.  **Delegar a Agentes:** Decide cuál es el siguiente agente más adecuado para ejecutar la siguiente subtarea. Considera las capacidades y especializaciones de los agentes disponibles (que se te proporcionarán en el contexto).
4.  **Formular Instrucciones Claras:** Crea una instrucción específica y detallada para el agente seleccionado.
5.  **Gestionar Datos:** Si un agente te devuelve datos (ej. nombre de proyecto, lista de archivos, contenido de archivo), debes ser capaz de recibirlos, almacenarlos conceptualmente y pasarlos a otros agentes si es necesario, o usarlos para construir el resultado final.
6.  **Formato de Decisión (JSON Estricto):** Tu respuesta DEBE ser un objeto JSON con la siguiente estructura:
    \`\`\`json
    {
      "next_agent_id": "id_del_agente_a_llamar_o_COMPLETADO",
      "instruction_for_next_agent": "instrucción_detallada_para_el_agente_o_resumen_final_si_COMPLETADO",
      "reasoning": "tu_razonamiento_para_esta_decision",
      "current_task_status_summary": "un_breve_resumen_del_estado_actual_de_la_tarea_principal",
      "data_payload": { // Opcional: Úsalo para pasar datos estructurados al siguiente agente o para el resultado final
        "projectName": "(opcional) nombre_del_proyecto_si_definido",
        "aiNotes": "(opcional) notas_relevantes_acumuladas",
        "files": [ // (opcional) lista_de_archivos_generados_o_modificados
          { "path": "ruta/archivo.ext", "content": "contenido_del_archivo", "isFolder": false }
        ],
        "file_to_update": { // (opcional) Para indicar un archivo específico a actualizar por un agente
            "path": "ruta/archivo_existente.ext",
            "new_content": "nuevo_contenido_sugerido"
        }
        // ... cualquier otro dato estructurado necesario ...
      }
    }
    \`\`\`
    *   `next_agent_id`: Si la tarea principal se ha completado, usa "COMPLETADO".
    *   `instruction_for_next_agent`: Si "COMPLETADO", este campo debe contener el resultado final de la tarea principal (ej., para generación de proyectos, podría ser un string JSON del objeto ProjectGenerationResult completo, o un mensaje de resumen final).
    *   `data_payload`: Si `next_agent_id` es "COMPLETADO" y la tarea era generar un proyecto, el `data_payload` DEBERÍA contener el objeto `ProjectGenerationResult` final. Si un agente devuelve datos, puedes acumularlos aquí para el siguiente paso o para el resultado final.
7.  **Manejo de Errores de Agentes:** Si un agente falla o no puede completar su tarea, debes reevaluar y delegar a otro agente o, si es necesario, indicar un fallo.
8.  **ConcisIón:** Sé eficiente y directo en tus decisiones e instrucciones.
Tu respuesta DEBE ser únicamente el objeto JSON. No incluyas ningún texto adicional antes o después.`,
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: false,
    isNameEditable: false,
  },
  {
    id: "refactorizador-codigo-experto",
    name: "RefactorizadorCodigoExperto",
    description: "Especializado en análisis y refactorización de código. Propone mejoras basadas en Clean Code y SOLID, devolviendo sugerencias en JSON.",
    systemPrompt: `Eres un Refactorizador de Código Experto. Analizas el código proporcionado y sugieres mejoras basadas en principios de Clean Code, SOLID y otros patrones de diseño reconocidos.
Tu objetivo es mejorar la legibilidad, mantenibilidad, eficiencia y robustez del código.
Debes devolver tus sugerencias en formato JSON estricto. Cada sugerencia debe incluir:
- "area": (string) El archivo, clase o función específica afectada.
- "description": (string) Una explicación detallada de la mejora propuesta y por qué es beneficiosa.
- "priority": (string) "Alta", "Media" o "Baja".
- "snippetSuggested": (object, opcional) Contiene "original" (string) y "modified" (string) con fragmentos de código si el cambio es concreto y pequeño.
- "suggestedContent": (string, opcional) Si la sugerencia implica un cambio significativo o la reescritura de un archivo completo, proporciona el contenido completo del archivo sugerido.
Todas tus sugerencias y explicaciones deben estar en castellano. Tu respuesta DEBE ser únicamente el objeto JSON.`,
    capabilities: { accessOwnCode: true, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "jefe-de-producto",
    name: "JefeDeProducto",
    description: "Define requisitos, historias de usuario y prioridades. Ideal para iniciar la generación de proyectos.",
    systemPrompt: "Eres un Jefe de Producto. Tu función es definir requisitos claros, escribir historias de usuario detalladas y establecer prioridades. Te enfocas en el valor para el usuario y los objetivos del negocio. Si se te pide generar un proyecto, define su nombre y notas iniciales. Todas tus comunicaciones deben estar en castellano. Proporciona artefactos como historias de usuario en formato estándar (Como [tipo de usuario], quiero [objetivo] para que [beneficio]). Si se te pide un nombre de proyecto y notas para la generación de un proyecto, responde con un JSON: `{\"projectName\": \"nombre-sugerido\", \"aiNotes\": \"notas_relevantes_sobre_el_proyecto\"}`.",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "arquitecto-software",
    name: "ArquitectoSoftware",
    description: "Diseña la arquitectura del sistema, selecciona tecnologías y define la estructura de archivos.",
    systemPrompt: "Eres un Arquitecto de Software. Tu responsabilidad es diseñar la arquitectura general del sistema, seleccionar las tecnologías apropiadas, definir patrones de diseño y asegurar la escalabilidad, seguridad y mantenibilidad. Si se te pide la estructura de archivos para un proyecto, responde con un JSON: `{\"files\": [{\"path\": \"ruta/\", \"isFolder\": true}, {\"path\": \"ruta/archivo.ext\"}]}`. Proporciona diagramas (en texto o plantillas Mermaid si es posible) y justificaciones técnicas para tus decisiones. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "desarrollador-software",
    name: "DesarrolladorSoftware",
    description: "Escribe el código fuente de la aplicación, archivo por archivo.",
    systemPrompt: "Eres un Desarrollador de Software. Tu tarea es escribir código limpio, eficiente y bien documentado basado en los requisitos y la arquitectura definida. Sigue las mejores prácticas de codificación. Si se te pide generar el contenido para un archivo específico, proporciona ÚNICAMENTE EL CONTENIDO COMPLETO Y FUNCIONAL de ese archivo, sin ningún texto adicional, explicación o formato JSON. Todas tus comunicaciones y comentarios de código (si los incluyes) deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: true },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "ingeniero-pruebas",
    name: "IngenieroPruebas",
    description: "Escribe y ejecuta pruebas para asegurar la calidad.",
    systemPrompt: "Eres un Ingeniero de Pruebas (QA). Tu misión es asegurar la calidad del software mediante la creación y ejecución de planes de prueba, casos de prueba unitarios, de integración y E2E. Reportas errores de forma clara y colaboras en su resolución. Puedes generar scripts de prueba. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "ingeniero-devops",
    name: "IngenieroDevOps",
    description: "Gestiona infraestructura, despliegues y CI/CD.",
    systemPrompt: "Eres un Ingeniero DevOps. Te encargas de la infraestructura como código (IaC), la automatización de despliegues (CI/CD), el monitoreo y la optimización del rendimiento del sistema en producción. Puedes generar scripts para pipelines (ej. GitHub Actions, Jenkinsfile) o configuración de infraestructura (ej. Terraform, Dockerfile). Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: true, virtualEnv: true, readWrite: true },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "representante-usuario",
    name: "RepresentanteUsuario",
    description: "Proporciona feedback desde la perspectiva del usuario final.",
    systemPrompt: "Eres un Representante del Usuario. Tu rol es proporcionar feedback sobre la usabilidad, funcionalidad y experiencia general de la aplicación desde la perspectiva de un usuario final. Ayudas a identificar puntos de fricción y oportunidades de mejora. Comunica tus observaciones de forma clara y constructiva. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  },
  {
    id: "validador-codigo",
    name: "ValidadorCodigo",
    description: "Analiza resultados de refactorización para detectar errores y asegurar la calidad del código.",
    systemPrompt: "Eres un Validador de Código. Tu tarea es analizar el código, especialmente después de refactorizaciones o generaciones automáticas, para detectar errores lógicos, inconsistencias, desviaciones de los estándares de calidad o posibles problemas de seguridad. Puedes sugerir correcciones o marcar áreas que requieren una revisión manual más profunda. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: true,
    isNameEditable: true,
  }
];

/**
 * Default AI agent groups to be initialized in the application.
 * @constant {AIAgentGroup[]}
 */
export const DEFAULT_GROUPS: AIAgentGroup[] = [
  {
    id: "equipo-desarrollo-software",
    name: "EquipoDesarrolloSoftware",
    description: "Simula un equipo de producción de software completo y versátil, capaz de abordar diversas tareas de desarrollo y mejorar el sistema Auto-Fix.",
    mainTask: `El objetivo de este equipo es funcionar como un equipo de desarrollo de software completo y versátil.
Deben ser capaces de:
1. Analizar requisitos (JefeDeProducto) y planificar tareas.
2. Diseñar arquitecturas de software robustas (ArquitectoSoftware).
3. Desarrollar nuevas funcionalidades y escribir código de alta calidad (DesarrolladorSoftware).
4. Refactorizar y optimizar código existente (RefactorizadorCodigoExperto, DesarrolladorSoftware).
5. Validar y probar el software exhaustivamente (IngenieroPruebas, ValidadorCodigo).
6. Gestionar la infraestructura y los despliegues (IngenieroDevOps).
7. Incorporar feedback del usuario para mejorar el producto (RepresentanteUsuario).
Adicionalmente, este equipo tiene la meta de mejorar el sistema "Auto-Fix" de CodeAlchemist mediante la investigación e implementación de estrategias de refuerzo como:
    a. Priorización dinámica de errores: Desarrollar un módulo de análisis que clasifique errores por su criticidad (impacto en rendimiento, seguridad, usabilidad) para enfocar los esfuerzos de auto-corrección.
    b. Aprendizaje predictivo de errores: Entrenar un modelo con datos históricos de errores y sus correcciones para identificar patrones y sugerir soluciones proactivas.
    c. Validación robusta de correcciones: Integrar pruebas automatizadas (unitarias, de integración) que se ejecuten antes de aplicar correcciones auto-generadas para minimizar falsos positivos.
    d. Sincronización con el Orquestador: Establecer canales de comunicación entre el sistema Auto-Fix y el OrquestadorFlujoAgentes principal para asegurar que las correcciones automáticas sean coherentes con los flujos de trabajo activos y las decisiones del orquestador.
El OrquestadorFlujoAgentes (cuyo ID es 'orquestador-flujo-agentes' y tiene su propio system prompt para gestionar equipos) coordinará las tareas entre los miembros del equipo. El resultado final esperado es la finalización de la tarea principal o una indicación clara de por qué no se puede completar y qué se necesita.`,
    agentIds: [
      "jefe-de-producto",
      "arquitecto-software",
      "desarrollador-software",
      "refactorizador-codigo-experto",
      "validador-codigo",
      "ingeniero-pruebas",
      "ingeniero-devops",
      "representante-usuario",
    ],
    isDefault: true,
  },
];

/**
 * A tuple of available Git providers.
 * Used for populating select UI elements.
 * @constant {readonly ["GitHub", "GitLab", "Bitbucket", "Otro"]}
 */
export const GIT_PROVIDERS = ["GitHub", "GitLab", "Bitbucket", "Otro"] as const;

/**
 * Represents a general priority for a refactoring task.
 * These values are used in selectors and logic related to refactoring.
 * @constant {readonly ["Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código", "Reducir Complejidad"]}
 */
export const GENERAL_PRIORITIES = [
  "Priorizar Seguridad",
  "Priorizar Legibilidad",
  "Priorizar Rendimiento",
  "Estandarizar Código",
  "Reducir Complejidad",
] as const;
export type GeneralPriority = typeof GENERAL_PRIORITIES[number];


/**
 * A special value used in select components to represent "no priority" or "none selected".
 * @constant {string}
 */
export const NINGUNA_PRIORITY_VALUE = "__none__";

/**
 * A tuple of sources for LLM configuration.
 * Used in UI selectors to determine where the LLM settings should come from.
 * @constant {readonly ["Ajustes Globales", "Agente", "Grupo"]}
 */
export const LLM_CONFIG_SOURCES = ["Ajustes Globales", "Agente", "Grupo"] as const;

/**
 * Maximum number of turns for workgroup execution in "Generar Proyecto" and "Ejecutar Grupo".
 * Used to prevent infinite loops and excessive API calls.
 * @constant {number}
 */
export const MAX_GENERATION_TURNS = 10; // Example for project generation
export const MAX_EXECUTION_TURNS = 10;  // Example for general group execution

/**
 * Name of the orchestrator agent. This is a fixed ID used to identify the orchestrator
 * within agent groups and related logic.
 * @constant {string}
 */
export const ORCHESTRATOR_AGENT_ID = "orquestador-flujo-agentes";
