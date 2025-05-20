
// src/types/index.ts

/**
 * @fileOverview Defines all shared TypeScript types and interfaces for the CodeAlchemist application.
 * Includes JSDoc comments for clarity on each type and its properties.
 */

/**
 * Defines the available Large Language Model (LLM) providers.
 * This constant array is used to derive the `LLMProvider` type.
 */
export const LLM_PROVIDERS_CONST = ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"] as const;
/**
 * Represents a specific LLM provider.
 * @typedef {typeof LLM_PROVIDERS_CONST[number]} LLMProvider
 */
export type LLMProvider = typeof LLM_PROVIDERS_CONST[number];


/**
 * Interface for LLM configuration settings.
 * These settings define how the application interacts with a chosen LLM.
 */
export interface LLMSettings {
  /**
   * The selected LLM provider.
   * @example "OpenAI"
   */
  provider: LLMProvider;
  /**
   * The API endpoint URL for the LLM provider.
   * @example "https://api.openai.com/v1"
   */
  apiUrl: string;
  /**
   * The API key for authenticating with the LLM provider.
   * Should be kept secure.
   */
  apiKey: string;
  /**
   * The specific model to be used from the provider.
   * @example "gpt-4-turbo"
   */
  model: string;
}

/**
 * Interface for Git configuration settings.
 * Used for features that interact with Git repositories, like AutoUpdate's Git push.
 */
export interface GitSettings {
  /**
   * The URL of the Git repository.
   * @example "https://github.com/username/repository.git"
   */
  repoUrl: string;
  /**
   * The username for Git commits.
   * @example "John Doe"
   */
  username: string;
  /**
   * The email address for Git commits.
   * @example "john.doe@example.com"
   */
  email: string;
  /**
   * The Personal Access Token (PAT) for Git authentication, if required.
   * Should be treated as a secret.
   */
  pat: string;
}

/**
 * Represents language codes supported by the application.
 * E.g., 'es' for Spanish, 'en' for English.
 * Defined in `src/lib/i18n/constants.ts`.
 */
export type LanguageCode = 'es' | 'en'; // Extend as needed

/**
 * Interface for overall application settings.
 * Combines LLM and Git configurations with general application preferences.
 */
export interface AppSettings {
  /** Global LLM configuration for the application. */
  llmConfig: LLMSettings;
  /** Global Git configuration for the application. */
  gitConfig: GitSettings;
  /** Flag to enable or disable debug mode, showing detailed logs. */
  debugMode: boolean;
  /**
   * The selected language code for the application's interface.
   * @example "es" for Spanish, "en" for English.
   */
  language: LanguageCode;
}

/**
 * Interface defining capabilities for an AI agent.
 * These boolean flags determine what actions an agent is permitted to perform.
 */
export interface AgentCapabilities {
  /** Whether the agent can access CodeAlchemist's own source code. */
  accessOwnCode: boolean;
  /** Whether the agent can execute commands or scripts (potentially dangerous). */
  execution: boolean;
  /** Whether the agent can interact with or manage virtual environments. */
  virtualEnv: boolean;
  /** Whether the agent can read and write files on the system (potentially dangerous). */
  readWrite: boolean;
}

/**
 * Interface for an AI agent's specific LLM configuration.
 * Allows overriding global LLM settings for individual agents.
 */
export interface AgentLLMConfiguration {
  /** Whether the agent should use the global LLM settings. */
  useGlobal: boolean;
  /**
   * Custom LLM settings if `useGlobal` is false.
   * If properties are omitted, they may fall back to global settings or defaults.
   */
  customConfig?: Partial<LLMSettings>;
}

/**
 * Interface representing an AI agent.
 * Agents are specialized AI entities designed for specific tasks.
 */
export interface Agent {
  /** Unique identifier for the agent. */
  id: string;
  /** Name of the agent. Should be descriptive and unique. */
  name: string;
  /** Brief description of the agent's purpose and specialization. */
  description: string;
  /** The base system prompt that defines the agent's role, behavior, tone, and instructions. */
  systemPrompt: string;
  /** Capabilities granted to the agent, determining its permissions. */
  capabilities: AgentCapabilities;
  /** LLM configuration specific to this agent. */
  llmConfig: AgentLLMConfiguration;
  /** Whether this is a default agent created by the system. Default agents might have special protections. */
  isDefault?: boolean;
  /** Whether this agent can be deleted by the user. Some default agents may not be deletable. */
  isDeletable?: boolean;
  /** Whether the name of this agent can be edited by the user. Core agents like the orchestrator may have fixed names. */
  isNameEditable?: boolean;
}

/**
 * Interface representing an AI agent group.
 * Groups are teams of agents collaborating on a complex task, coordinated by an orchestrator.
 */
export interface AIAgentGroup {
  /** Unique identifier for the group. */
  id: string;
  /** Name of the group. Should be descriptive and unique. */
  name: string;
  /** Brief description of the group's purpose or the type of tasks it handles. */
  description: string;
  /** The main task or objective for the group. This is the initial input for the group's orchestrator agent. */
  mainTask: string;
  /** Array of agent IDs participating in this group. The `OrquestadorFlujoAgentes` is implicitly part of every group. */
  agentIds: string[];
  /** Whether this is a default group created by the system. */
  isDefault?: boolean;
}

/**
 * Interface for a saved code snapshot.
 * Snapshots are points-in-time captures of code, either original, AI-suggested, or of the application's state.
 */
export interface CodeSnapshot {
  /** Unique identifier for the snapshot. */
  id: string;
  /** Descriptive name for the snapshot. */
  name: string;
  /**
   * The actual code content or JSON stringified application state/project structure of the snapshot.
   * @example For source code: "function hello() { console.log('World'); }"
   * @example For app state: "{ \"settings\": { ... }, \"agents\": [ ... ] }"
   * @example For project structure: "{ \"projectName\": \"...\", \"files\": [ ... ] }"
   */
  code: string;
  /** ISO date string representing when the snapshot was created. */
  createdAt: string;
  /**
   * Indicates the source or type of the snapshot.
   * 'original': Original code from "Analizar Código".
   * 'suggested': AI-suggested code from "Analizar Código".
   * 'codealchemist-app-state': Snapshot of CodeAlchemist's settings, agents, groups.
   * 'generated-project': Snapshot of a project structure from "Generar Proyecto".
   * 'project-analysis': Snapshot of an analysis result from "Analizar Proyecto Completo".
   * 'refactored-project': Snapshot of a (conceptually) refactored project.
   * 'autoupdate-snapshot': Snapshot from "AutoUpdate" (conceptually applied suggestions).
   * 'unknown': Default or unknown source.
   */
  source?: 'original' | 'suggested' | 'codealchemist-app-state' | 'generated-project' | 'project-analysis' | 'refactored-project' | 'autoupdate-snapshot' | 'unknown';
}


/**
 * Represents a file or folder generated by an AI process, typically for project structures.
 */
export interface GeneratedFile {
  /**
   * Relative path of the file or folder.
   * Folders should ideally end with a trailing slash (e.g., "src/components/").
   */
  path: string;
  /**
   * Content of the file. For folders, this is typically an empty string or a placeholder comment.
   */
  content: string;
  /** Optional flag to explicitly indicate if this entry represents a folder. */
  isFolder?: boolean;
}

/**
 * Input type for the project generation Genkit flow.
 */
export interface GenerateProjectInput {
  /**
   * Detailed description from the user about the project they want to generate.
   * Should include type of project, technologies, desired structure, etc.
   */
  description: string;
  /**
   * Optional system prompt of an agent or group's main task.
   * If the project generation is being driven or contextualized by a specific AI agent or group,
   * its system prompt/main task can be provided here to guide the LLM.
   */
  agentSystemPrompt?: string;
}

/**
 * Result type for the project generation Genkit flow.
 * Contains the AI-generated project structure and related information.
 */
export interface ProjectGenerationResult {
  /** A suggested name for the project, generated by the AI. */
  projectName: string;
  /**
   * Notes from the AI about the generated structure.
   * May include advice on next steps, dependencies to install, or important considerations.
   */
  aiNotes: string;
  /** An array of `GeneratedFile` objects representing the files and folders of the project. */
  files: GeneratedFile[];
   /**
    * Log from group execution if generation was group-coordinated.
    * This might be a simplified log if the flow itself is a single LLM call
    * but was contextually guided by a group's settings.
    * Or it could be a detailed multi-turn log if the flow orchestrated a group.
    */
  groupLog?: string;
}

/**
 * Input for modifying an existing project structure via AI.
 */
export interface ModifyProjectStructureInput {
  /** The current state of the project, as a `ProjectGenerationResult` object. */
  currentProject: ProjectGenerationResult;
  /** The user's request in natural language describing the desired modification. */
  modificationRequest: string;
  /** Optional history of previous modification chat messages for context. */
  chatHistory?: ChatMessage[];
  /** Optional system prompt of an agent or group's main task to contextualize the modification. */
  agentSystemPrompt?: string;
}


/**
 * Represents a refactoring suggestion from an AI analysis for a project.
 * This type is used in the UI to manage the state of suggestions.
 */
export interface RefactorSuggestion {
  /** The specific file, component, class, or function affected by the suggestion. */
  area: string;
  /** A detailed explanation of the proposed improvement, why it's beneficial, and what problem it solves. */
  description: string;
  /**
   * Priority of the suggestion, indicating its importance or impact.
   * "Alta": High priority, critical or very impactful.
   * "Media": Medium priority, recommended improvement.
   * "Baja": Low priority, minor or stylistic improvement.
   */
  priority: "Alta" | "Media" | "Baja";
  /** Optional code snippets showing the original code and the AI-suggested modified code to illustrate the change. */
  snippetSuggested?: {
    original?: string;
    modified?: string;
  };
  /** Unique identifier for the suggestion, used for UI keying and tracking. */
  id: string;
  /** Current status of the suggestion in the UI (e.g., pending, applied, discarded). */
  status?: 'pending' | 'applied' | 'discarded';
}

/**
 * Input type for the code snippet analysis Genkit flow.
 */
export interface AnalyzeCodeSnippetInput {
  /** The code snippet to be analyzed. */
  code: string;
  /**
   * Optional user-provided instructions or questions to focus the AI's analysis.
   * @example "Focus on potential security vulnerabilities."
   * @example "Suggest a more performant way to write this loop."
   */
  userPrompt?: string;
  /**
   * Optional hint for the programming language of the snippet.
   * @example "javascript"
   * @example "python"
   */
  language?: string;
  /**
   * Optional system prompt of an agent.
   * If the analysis is being performed in the context of a specific AI agent,
   * its system prompt can be provided to guide the LLM's behavior and expertise.
   */
  agentSystemPrompt?: string;
}

/**
 * Output type for the code snippet analysis Genkit flow.
 */
export interface AnalyzeCodeSnippetOutput {
  /**
   * An explanation of what the original code does, its objectives, and main functionalities.
   * This should be provided before any suggestions for changes.
   */
  explanation: string;
  /** The original code snippet that was analyzed, for reference. */
  originalCode: string;
  /** The AI's suggested version of the code, incorporating improvements, corrections, or optimizations. */
  suggestedCode: string;
  /**
   * Log from group execution if analysis was group-coordinated.
   */
  groupLog?: string;
}

/**
 * Represents a suggestion generated by the AutoUpdate feature (self-analysis of CodeAlchemist).
 * This type is used in the UI to manage the state of AutoUpdate suggestions.
 */
export interface AutoUpdateSuggestion {
  /** Unique identifier for the suggestion, used for UI keying. */
  id: string;
  /** The file path or specific area within CodeAlchemist's codebase affected by the suggestion. */
  area: string;
  /** Detailed description of the suggested improvement or correction. */
  suggestion: string;
  /** Priority of the suggestion (Alta, Media, Baja). */
  priority: "Alta" | "Media" | "Baja";
  /** The complete suggested content of the file, if the suggestion involves a full file rewrite. */
  fullFileContentSuggested?: string;
  /**
   * An AI-generated prompt that could be used to instruct another AI (or guide a developer)
   * on how to implement this specific suggestion. Should be clear and actionable.
   */
  suggestedPromptForImplementation?: string;
  /** Current status of the suggestion in the UI (e.g., pending, applied, discarded). */
  status: 'pending' | 'applied' | 'discarded'; // Made non-optional
  /** Flag to indicate if the suggestion content is currently being edited by the user in the UI. */
  isEditing?: boolean;
  /** The content of the suggestion as edited by the user, if `isEditing` was true and changes were made. */
  userEditedContent?: string;
  /** The original content of the file or snippet related to this suggestion, if available. Used for diffing or reference. */
  originalContent?: string;
  /** Optional error message if applying the suggestion failed. */
  errorMessage?: string;
}

/**
 * Represents a message in a chat conversation.
 */
export interface ChatMessage {
  /** Unique identifier for the message. */
  id: string;
  /**
   * Role of the entity that sent the message.
   * 'user': A message from the human user.
   * 'assistant': A message from the AI.
   * 'system': A message from the system (e.g., error notifications, status updates within the chat).
   */
  role: 'user' | 'assistant' | 'system';
  /** The textual content of the message. */
  content: string;
  /** ISO date string representing when the message was created or sent. */
  timestamp: string;
}

/**
 * Represents the selected source for LLM (Large Language Model) configuration in various UI selectors.
 */
export interface LLMConfigSourceOption {
  /**
   * Type of the LLM configuration source.
   * 'Ajustes Globales': Use the application-wide global LLM settings.
   * 'Agente': Use the LLM configuration specific to a selected AI agent.
   * 'Grupo': Use the LLM configuration associated with an AI agent group (typically its orchestrator's settings or a group-level default).
   */
  type: 'Ajustes Globales' | 'Agente' | 'Grupo';
  /** Identifier for the agent or group, if `type` is 'Agente' or 'Grupo'. */
  id?: string;
  /** Name of the agent or group for display purposes, if `type` is 'Agente' o 'Grupo'. */
  name?: string;
}

/**
 * Data structure for the agent creation/editing form.
 * Omits system-managed properties like `isDefault` from the base `Agent` type.
 * `id` is optional as it's generated for new agents.
 */
export type AgentFormData = Omit<Agent, 'id' | 'isDefault' | 'isDeletable' | 'isNameEditable'> & { id?: string };
/**
 * Data structure for the AI agent group creation/editing form.
 * Omits system-managed properties like `isDefault` from the base `AIAgentGroup` type.
 * `id` is optional as it's generated for new groups.
 */
export type GroupFormData = Omit<AIAgentGroup, 'id' | 'isDefault'> & { id?: string };

/**
 * Input type for the AI-assisted agent definition suggestion Genkit flow.
 */
export interface SuggestAgentDefinitionInput {
  /** A detailed description from the user about the role and responsibilities for the agent to be created. */
  roleDescription: string;
}
/**
 * Output type for the AI-assisted agent definition suggestion Genkit flow.
 * Provides core properties for an agent. LLM configuration is typically set by the user or defaults separately.
 */
export type SuggestAgentDefinitionOutput = Omit<AgentFormData, 'llmConfig' | 'id'> & {
  /** Suggested capabilities for the agent, derived by the AI based on the described role. */
  capabilities: AgentCapabilities;
};


/**
 * Information about an existing AI agent, used when suggesting participants for a new AI agent group.
 */
export interface AgentInfoForGroupSuggestion {
    /** Unique identifier of the agent. */
    id: string;
    /** Name of the agent. */
    name: string;
    /** Description of the agent's purpose or specialization. */
    description: string;
    // Added for chatWithAIGroup flow
    systemPrompt: string;
    capabilities: AgentCapabilities;
    llmConfig: AgentLLMConfiguration;
}
/**
 * Input type for the AI-assisted group definition suggestion Genkit flow.
 */
export interface SuggestGroupDefinitionInput {
  /** A detailed description from the user about the task or objective the AI agent group should achieve. */
  groupTaskDescription: string;
  /** A list of existing AI agents available for inclusion in the group, each with their ID, name, and description. */
  availableAgents: AgentInfoForGroupSuggestion[]; // Re-using AgentInfoForGroupSuggestion
}
/**
 * Output type for the AI-assisted group definition suggestion Genkit flow.
 * Provides core properties for a group; the user confirms or modifies before creation.
 */
export type SuggestGroupDefinitionOutput = Omit<GroupFormData, 'id'>;


/**
 * Input type for the "Refactor Project with AI" Genkit flow.
 */
export interface RefactorProjectWithAIInput {
  /**
   * The project source, typically represented as a reference string or the full content.
   */
  projectSource: string;
  /**
   * Specific goals for the refactoring process, as defined by the user.
   */
  goals?: string;
  /**
   * General priority guiding the refactoring effort.
   */
  priority?: string;
  /**
   * Suggested depth for the analysis.
   */
  searchDepth?: number;
  /**
   * Specific functional area, module, or quality attribute.
   */
  focusArea?: string;
  /**
   * Optional system prompt of an agent or group's main task.
   */
  agentSystemPrompt?: string;
}

/**
 * Output type for the "Refactor Project with AI" Genkit flow.
 */
export interface RefactorProjectWithAIOutput {
  /**
   * A summary of the project's main objectives and functionalities.
   */
  projectOverview: string;
  /**
   * An array of raw `RefactorSuggestion` objects (without `id` or `status`).
   */
  suggestions: Array<Omit<RefactorSuggestion, 'id' | 'status'>>;
  /**
   * Log from group execution if refactoring was group-coordinated.
   */
  groupLog?: string;
}

/**
 * Input type for analyzing project code, used for "AutoUpdate" (self-analysis) and generic project analysis.
 */
export interface AnalyzeCodeInput {
  /** Indicates the source of the code to be analyzed. */
  sourceCodeLocation: 'Local' | 'Git' | 'UploadedString';
  /**
   * The actual project content.
   */
  projectContent?: string;
  /** The URL of the Git repository if `sourceCodeLocation` is 'Git'. */
  gitRepoUrl?: string;
  /**
   * @deprecated Use `focusArea` instead.
   */
  analysisPreferences?: string;
  /**
   * Suggested depth for the analysis.
   */
  searchDepth?: number;
  /**
   * Specific functional area, module, or quality attribute.
   */
  focusArea?: string;
  /**
   * Optional system prompt of an agent or group's main task.
   */
  agentSystemPrompt?: string;
}

/**
 * Output type for project code analysis.
 */
export interface AnalyzeCodeOutput {
  /** A concise title summarizing the main findings of the analysis. */
  analysisTitle: string;
  /** A list of components, modules, files, or specific aspects identified as areas of concern or interest. */
  identifiedAreas: string[];
  /** A list of detailed suggestions for improvement or correction. */
  detailedSuggestions: Array<{
    area: string;
    suggestion: string;
    priority: 'Alta' | 'Media' | 'Baja';
    suggestedContent?: string;
    suggestedPromptForImplementation?: string;
  }>;
  /**
   * An overall assessment of the code quality, potential issues, and main characteristics.
   */
  generalAssessment: string;
  /**
   * Optional log from group execution.
   */
  groupLog?: string;
  /**
   * Optional list of high-level ideas for general project improvement.
   */
  overallImprovementIdeas?: string[];
}

/**
 * Represents a generic note object, potentially for user annotations or internal remarks.
 */
export interface NoteType {
  /** Unique identifier for the note. */
  id: string;
  /** The textual content of the note. */
  content: string;
  /** Optional ISO date string indicating when the note was created. */
  createdAt?: string;
}

/**
 * Input for the Auto-Fix Error with Group flow.
 */
export interface AutoFixErrorWithGroupInput {
  /** The error message that occurred. */
  errorMessage: string;
  /** Optional: A snippet of code or broader context where the error happened. */
  codeContext?: string;
  /** Optional: Any specific guidance from the user for the fix. */
  userInstructions?: string;
}

/**
 * Output from the Auto-Fix Error with Group flow.
 */
export interface AutoFixErrorWithGroupOutput {
  /** The solution proposed by the 'EquipoDesarrolloSoftware' group. */
  suggestedSolution: string;
  /** Any diagnostic notes or reasoning from the group's process. */
  diagnosticNotes: string;
  /**
   * A log indicating how the group was invoked.
   */
  initialGroupLog: string;
}

/**
 * Input for the Genkit flow that generates code from a description.
 */
export interface GenerateCodeFromDescriptionInput {
  /** The natural language description of the code to generate. */
  description: string;
  /**
   * Optional system prompt of an agent or group's main task.
   */
  agentSystemPrompt?: string;
}

/**
 * Output from the Genkit flow that generates code from a description.
 */
export interface GenerateCodeFromDescriptionOutput {
  /** An explanation of the generated code. */
  explanation: string;
  /** The generated code snippet. */
  code: string;
  /**
   * Log from group execution if generation was group-coordinated.
   */
  groupLog?: string;
}

/**
 * Represents a file obtained from the application's source for analysis or download.
 * @see src/app/autoupdate/actions.ts
 */
export interface AppSourceFile {
  /** The name or relative path of the file. */
  fileName: string;
  /** The content of the file as a string. */
  content: string;
}

/**
 * Input for redefining a user's prompt using AI.
 */
export interface RedefinePromptInput {
  /** The original prompt string provided by the user. */
  originalPrompt: string;
}

/**
 * Output from the prompt redefinition AI flow.
 */
export interface RedefinePromptOutput {
  /** The refined, clearer, or more detailed prompt string generated by the AI. */
  redefinedPrompt: string;
}

/**
 * Input for the Genkit flow that handles chat interactions with a specific AI agent or the globally configured LLM.
 */
export interface ChatWithAgentOrGlobalInput {
  /** The message sent by the user. */
  userMessage: string;
  /**
   * Optional system prompt of a specific AI agent.
   * If provided, the chat interaction will be contextualized by this agent's persona and instructions.
   * If not provided, a default assistant persona is used.
   */
  agentSystemPrompt?: string;
}

/**
 * Output for the Genkit flow that handles chat interactions with a specific AI agent or the globally configured LLM.
 */
export interface ChatWithAgentOrGlobalOutput {
  /** The response generated by the AI assistant. */
  aiResponse: string;
}


/**
 * Input type for the Genkit flow that handles chat interactions with an AI Agent Group via its Orchestrator.
 */
export interface ChatWithAIGroupInput {
  /** The message from the user to the group. */
  userMessage: string;
  /** The main task or objective of the AI agent group. */
  groupMainTask: string;
  /**
   * Information about the agents participating in the group.
   * This is used by the orchestrator to understand the capabilities of its team members.
   */
  participatingAgents: AgentInfoForGroupSuggestion[];
  /** The system prompt for the orchestrator agent itself, defining its role in managing the group. */
  orchestratorAgentSystemPrompt: string;
}

/**
 * Output type for the Genkit flow that handles chat interactions with an AI Agent Group.
 */
export interface ChatWithAIGroupOutput {
  /**
   * The response from the orchestrator agent.
   * This is typically a JSON string detailing its decision (e.g., which agent to call next, or the final result).
   */
  orchestratorResponse: string;
}
