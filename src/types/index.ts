
// import type { LLM_PROVIDERS } from '@/lib/constants'; // Not needed if LLMProvider is defined below

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
 * Snapshots are points-in-time captures of code, either original, AI-suggested, or of the application itself.
 */
export interface CodeSnapshot {
  /** Unique identifier for the snapshot. */
  id: string;
  /** Descriptive name for the snapshot. */
  name: string;
  /** The actual code content of the snapshot. */
  code: string;
  /** ISO date string representing when the snapshot was created. */
  createdAt: string;
  /** 
   * Indicates the source or type of the snapshot.
   * 'original': The original code before AI analysis.
   * 'suggested': The code suggested by an AI.
   * 'codealchemist-current': A snapshot of the CodeAlchemist application's current state (conceptual).
   */
  source?: 'original' | 'suggested' | 'codealchemist-current';
}

/**
 * Interface representing a file or folder generated by an AI process, typically for project structures.
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
   * Optional system prompt of an agent. 
   * If the project generation is being driven or contextualized by a specific AI agent (or group orchestrator),
   * its system prompt can be provided here to guide the LLM.
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
   /** Optional log from group execution if generation was group-coordinated. */
  groupLog?: string;
}


/**
 * Represents a refactoring suggestion from an AI analysis for a project.
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
}

/**
 * Represents a suggestion generated by the AutoUpdate feature (self-analysis of CodeAlchemist).
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
  status?: 'pending' | 'applied' | 'discarded';
  /** Flag to indicate if the suggestion content is currently being edited by the user in the UI. */
  isEditing?: boolean;
  /** The content of the suggestion as edited by the user, if `isEditing` was true and changes were made. */
  userEditedContent?: string;
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
}
/**
 * Input type for the AI-assisted group definition suggestion Genkit flow.
 */
export interface SuggestGroupDefinitionInput {
  /** A detailed description from the user about the task or objective the AI agent group should achieve. */
  groupTaskDescription: string;
  /** A list of existing AI agents available for inclusion in the group, each with their ID, name, and description. */
  availableAgents: AgentInfoForGroupSuggestion[];
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
   * The project source, typically represented as a reference string.
   * This could be a marker for an uploaded file (e.g., "uploaded_file:myproject.zip")
   * or a Git URL (e.g., "https://github.com/user/repo.git").
   * The actual file content for uploads might be handled separately or passed as base64 if the flow supports it.
   */
  projectSource: string;
  /** 
   * Specific goals for the refactoring process, as defined by the user.
   * @example "Improve performance of UI components."
   * @example "Reduce complexity in the payment module."
   */
  goals?: string;
  /** 
   * General priority guiding the refactoring effort.
   * @example "Priorizar Seguridad"
   * @example "Priorizar Legibilidad"
   */
  priority?: string; // Consider making this an enum type for consistency with UI
  /** 
   * Suggested depth for the analysis (e.g., number of directory levels or call stack depth).
   * A higher number might imply a more thorough but potentially slower analysis.
   */
  searchDepth?: number;
  /** 
   * Specific functional area, module, or quality attribute (e.g., "performance", "security", "UI rendering logic")
   * on which the AI should concentrate its analysis.
   */
  focusArea?: string;
}

/**
 * Output type for the "Refactor Project with AI" Genkit flow.
 */
export interface RefactorProjectWithAIOutput {
  /** 
   * A summary of the project's main objectives and functionalities. 
   * This provides context before listing refactoring suggestions.
   */
  projectOverview: string;
  /** An array of `RefactorSuggestion` objects detailing proposed refactorings. */
  suggestions: Array<Omit<RefactorSuggestion, 'id' | 'status'>>; // Raw suggestions from AI
  /** Optional log from group execution if refactoring was group-coordinated. */
  groupLog?: string;
}

/**
 * Input type for analyzing project code, used for "AutoUpdate" (self-analysis) and generic project analysis.
 */
export interface AnalyzeCodeInput {
  /** Indicates the source of the code to be analyzed. */
  sourceCodeLocation: 'Local' | 'Git' | 'UploadedString';
  /** 
   * The actual project content, typically as a string. 
   * This might be the content of a single file, a JSON representation of a project structure,
   * or a reference to content fetched from Git or an upload.
   */
  projectContent?: string;
  /** The URL of the Git repository if `sourceCodeLocation` is 'Git'. */
  gitRepoUrl?: string;
  /** 
   * Deprecated in favor of `focusArea`. Specific areas or concerns to focus the analysis on.
   * @deprecated Use `focusArea` instead.
   */
  analysisPreferences?: string;
  /** 
   * Suggested depth for the analysis (e.g., number of directory levels or call stack depth).
   * A higher number might imply a more thorough analysis.
   */
  searchDepth?: number;
  /** 
   * Specific functional area, module, or quality attribute (e.g., "performance", "security", "UI rendering logic")
   * on which the AI should concentrate its analysis.
   */
  focusArea?: string;
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
    /** The specific area (e.g., file path, component name) affected by the suggestion. */
    area: string;
    /** A detailed description of the suggested improvement. */
    suggestion: string;
    /** The priority of the suggestion (Alta, Media, Baja). */
    priority: 'Alta' | 'Media' | 'Baja';
    /** 
     * If the suggestion involves a direct code change for an entire file, 
     * this field contains the complete suggested content of that file.
     */
    suggestedContent?: string;
    /** 
     * An AI-generated prompt, in Spanish, that could be given to another AI
     * (or used as a guide for a developer) to implement this specific suggestion.
     */
    suggestedPromptForImplementation?: string;
  }>;
  /** 
   * An overall assessment of the code quality, potential issues, and main characteristics. 
   * Should start with a summary of the project's objectives and functionalities.
   */
  generalAssessment: string;
  /** Optional log from group execution if the analysis was coordinated by an AI agent group. */
  groupLog?: string;
  /** 
   * Optional list of high-level ideas for general project improvement,
   * often related to the user-specified objectives or focus area.
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
