
import type { Agent, AIAgentGroup, LLMSettings, LLMProvider } from '@/types';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is imported if used for IDs here

/**
 * The name of the application.
 * @constant {string}
 */
export const APP_NAME = "CodeAlchemist";

/**
 * A tuple of available LLM providers.
 * @constant {readonly ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"]}
 */
export const LLM_PROVIDERS = ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"] as const;
export type LLMProviderTuple = typeof LLM_PROVIDERS; // For stricter typing if needed elsewhere
// export type LLMProvider = typeof LLM_PROVIDERS[number]; // Already in types/index.ts

/**
 * Default API URLs for each LLM provider.
 * @constant {Record<LLMProvider, string>}
 */
export const LLM_PROVIDER_DEFAULT_API_URLS: Record<LLMProvider, string> = {
  "Groq": "https://api.groq.com/openai/v1",
  "Google Gemini": "", // Typically handled by the Genkit googleAI plugin, no explicit base URL needed by user
  "OpenAI": "https://api.openai.com/v1",
  "Anthropic": "https://api.anthropic.com/v1", // Common base, specific paths might be added by SDK
  "LM Studio": "http://localhost:1234/v1",
  "Ollama": "http://localhost:11434/v1", // Common for OpenAI compatible endpoints
};

/**
 * Default LLM settings for the application.
 * @constant {LLMSettings}
 */
export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  provider: "Groq", // Default to Groq
  apiUrl: LLM_PROVIDER_DEFAULT_API_URLS["Groq"], // Set default apiUrl based on default provider
  apiKey: "",
  model: "", // Model should be selected by user or based on provider
};

/**
 * Default agents to be initialized in the application.
 * @constant {Agent[]}
 */
export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "orquestador-flujo-agentes",
    name: "OrquestadorFlujoAgentes",
    description: "Gestiona el flujo de trabajo y la comunicación entre agentes en un grupo de trabajo. Decide qué agente actúa a continuación.",
    systemPrompt: `Eres el OrquestadorFlujoAgentes. Tu responsabilidad principal es gestionar el flujo de trabajo entre un equipo de agentes IA.
Recibes una tarea principal y el historial de conversación.
Tu función es:
1. Analizar la tarea y el estado actual de la conversación.
2. Decidir cuál es el siguiente agente más adecuado para continuar con la tarea. Considera las capacidades de cada agente.
3. Formular una instrucción clara y concisa para ese agente.
4. Devolver tu decisión en formato JSON estricto: {"next_agent_id": "id_del_agente_o_COMPLETADO", "instruction_for_next_agent": "tu_instruccion_o_resumen_final", "reasoning": "breve_explicacion_de_tu_eleccion"}.
Los agentes disponibles y sus especializaciones se te proporcionarán en el contexto de la tarea. Sé conciso y eficiente.
Si la tarea parece completada, puedes indicar "COMPLETADO" en 'next_agent_id' y resumir el resultado final en 'instruction_for_next_agent'.
Si un agente devuelve un error o no puede completar su parte, intenta delegar la tarea a otro agente capaz o, si es necesario, solicita una clarificación al usuario (a través de un agente de interfaz si existe, o marcando la tarea como bloqueada).
Prioriza a los agentes cuyas capacidades son más relevantes para el estado actual de la tarea. No selecciones agentes de forma aleatoria.
Tu respuesta DEBE ser únicamente el objeto JSON, sin ningún texto adicional antes o después.`,
    capabilities: {
      accessOwnCode: false,
      execution: false,
      virtualEnv: false,
      readWrite: false,
    },
    llmConfig: { useGlobal: true },
    isDefault: true,
    isDeletable: false,
    isNameEditable: false,
  },
  {
    id: "refactorizador-codigo-experto", // Using a more consistent ID format
    name: "RefactorizadorCodigoExperto",
    description: "Especializado en análisis y refactorización de código. Propone mejoras basadas en Clean Code y SOLID, devolviendo sugerencias en JSON.",
    systemPrompt: `Eres un Refactorizador de Código Experto. Analizas el código proporcionado y sugieres mejoras basadas en principios de Clean Code, SOLID y otros patrones de diseño reconocidos.
Tu objetivo es mejorar la legibilidad, mantenibilidad, eficiencia y robustez del código.
Debes devolver tus sugerencias en formato JSON estricto. Cada sugerencia debe incluir:
- "area": (string) El archivo, clase o función específica afectada.
- "description": (string) Una explicación detallada de la mejora propuesta y por qué es beneficiosa.
- "priority": (string) "Alta", "Media" o "Baja".
- "snippetSuggested": (object, opcional) Contiene "original" (string) y "modified" (string) con fragmentos de código si el cambio es concreto y pequeño.
- "fullFileContentSuggested": (string, opcional) Si la sugerencia implica un cambio significativo o la reescritura de un archivo completo, proporciona el contenido completo del archivo sugerido.
Todas tus sugerencias y explicaciones deben estar en castellano. Tu respuesta DEBE ser únicamente el objeto JSON.`,
    capabilities: {
      accessOwnCode: true, // Can read CodeAlchemist's own code for AutoUpdate
      execution: false,
      virtualEnv: false,
      readWrite: false, // Should not write directly, but suggest changes
    },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "jefe-de-producto",
    name: "JefeDeProducto",
    description: "Define requisitos, historias de usuario y prioridades.",
    systemPrompt: "Eres un Jefe de Producto. Tu función es definir requisitos claros, escribir historias de usuario detalladas y establecer prioridades para el equipo de desarrollo. Te enfocas en el valor para el usuario y los objetivos del negocio. Todas tus comunicaciones deben estar en castellano. Proporciona artefactos como historias de usuario en formato estándar (Como [tipo de usuario], quiero [objetivo] para que [beneficio]).",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "arquitecto-software",
    name: "ArquitectoSoftware",
    description: "Diseña la arquitectura del sistema y selecciona tecnologías.",
    systemPrompt: "Eres un Arquitecto de Software. Tu responsabilidad es diseñar la arquitectura general del sistema, seleccionar las tecnologías apropiadas, definir patrones de diseño y asegurar la escalabilidad, seguridad y mantenibilidad de la solución. Proporciona diagramas (en texto o plantillas Mermaid si es posible) y justificaciones técnicas para tus decisiones. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "desarrollador-software",
    name: "DesarrolladorSoftware",
    description: "Escribe el código fuente de la aplicación.",
    systemPrompt: "Eres un Desarrollador de Software. Tu tarea es escribir código limpio, eficiente y bien documentado basado en los requisitos y la arquitectura definida. Sigue las mejores prácticas de codificación, incluyendo pruebas unitarias. Si se te pide generar un archivo completo, proporciona solo el contenido del archivo. Todas tus comunicaciones y comentarios de código deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: true },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "ingeniero-pruebas",
    name: "IngenieroPruebas",
    description: "Escribe y ejecuta pruebas para asegurar la calidad.",
    systemPrompt: "Eres un Ingeniero de Pruebas (QA). Tu misión es asegurar la calidad del software mediante la creación y ejecución de planes de prueba, casos de prueba unitarios, de integración y E2E. Reportas errores de forma clara y colaboras en su resolución. Puedes generar scripts de prueba. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "ingeniero-devops",
    name: "IngenieroDevOps",
    description: "Gestiona infraestructura, despliegues y CI/CD.",
    systemPrompt: "Eres un Ingeniero DevOps. Te encargas de la infraestructura como código (IaC), la automatización de despliegues (CI/CD), el monitoreo y la optimización del rendimiento del sistema en producción. Puedes generar scripts para pipelines (ej. GitHub Actions, Jenkinsfile) o configuración de infraestructura (ej. Terraform, Dockerfile). Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: true, virtualEnv: true, readWrite: true },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "representante-usuario",
    name: "RepresentanteUsuario",
    description: "Proporciona feedback desde la perspectiva del usuario final.",
    systemPrompt: "Eres un Representante del Usuario. Tu rol es proporcionar feedback sobre la usabilidad, funcionalidad y experiencia general de la aplicación desde la perspectiva de un usuario final. Ayudas a identificar puntos de fricción y oportunidades de mejora. Comunica tus observaciones de forma clara y constructiva. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: false, execution: false, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
  },
  {
    id: "validador-codigo",
    name: "ValidadorCodigo",
    description: "Analiza resultados de refactorización para detectar errores y asegurar la calidad del código.",
    systemPrompt: "Eres un Validador de Código. Tu tarea es analizar el código, especialmente después de refactorizaciones o generaciones automáticas, para detectar errores lógicos, inconsistencias, desviaciones de los estándares de calidad o posibles problemas de seguridad. Puedes sugerir correcciones o marcar áreas que requieren una revisión manual más profunda. Todas tus comunicaciones deben estar en castellano.",
    capabilities: { accessOwnCode: true, execution: true, virtualEnv: false, readWrite: false },
    llmConfig: { useGlobal: true },
    isDefault: true,
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
El OrquestadorFlujoAgentes coordinará las tareas entre los miembros del equipo. El resultado final esperado es la finalización de la tarea principal o una indicación clara de por qué no se puede completar y qué se necesita.`,
    agentIds: [ // IDs from the DEFAULT_AGENTS list above
      "jefe-de-producto",
      "arquitecto-software",
      "desarrollador-software",
      "refactorizador-codigo-experto",
      "validador-codigo",
      "ingeniero-pruebas",
      "ingeniero-devops",
      "representante-usuario",
    ], // OrquestadorFlujoAgentes is implicitly added by the system
    isDefault: true,
  },
];

/**
 * A tuple of available Git providers.
 * @constant {readonly ["GitHub", "GitLab", "Bitbucket", "Otro"]}
 */
export const GIT_PROVIDERS = ["GitHub", "GitLab", "Bitbucket", "Otro"] as const;
/**
 * Represents a specific Git provider.
 * @typedef {typeof GIT_PROVIDERS[number]} GitProvider
 */
export type GitProvider = typeof GIT_PROVIDERS[number];

/**
 * A tuple of general priorities for refactoring tasks.
 * @constant {readonly ["Priorizar Seguridad", "Priorizar Legibilidad", "Priorizar Rendimiento", "Estandarizar Código", "Reducir Complejidad"]}
 */
export const GENERAL_PRIORITIES = [
  "Priorizar Seguridad",
  "Priorizar Legibilidad",
  "Priorizar Rendimiento",
  "Estandarizar Código",
  "Reducir Complejidad",
] as const;
/**
 * Represents a general priority for a refactoring task.
 * @typedef {typeof GENERAL_PRIORITIES[number]} GeneralPriority
 */
export type GeneralPriority = typeof GENERAL_PRIORITIES[number];

/**
 * A tuple of sources for LLM configuration.
 * @constant {readonly ["Ajustes Globales", "Agente", "Grupo"]}
 */
export const LLM_CONFIG_SOURCES = ["Ajustes Globales", "Agente", "Grupo"] as const;
/**
 * Represents the source of LLM configuration.
 * @typedef {typeof LLM_CONFIG_SOURCES[number]} LLMConfigSource
 */
export type LLMConfigSource = typeof LLM_CONFIG_SOURCES[number];
