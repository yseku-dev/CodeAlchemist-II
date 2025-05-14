
// import type { LLM_PROVIDERS } from '@/lib/constants'; // Not needed if LLMProvider is defined below

export const LLM_PROVIDERS_CONST = ["Groq", "Google Gemini", "OpenAI", "Anthropic", "LM Studio", "Ollama"] as const;
export type LLMProvider = typeof LLM_PROVIDERS_CONST[number];


export interface LLMSettings {
  provider: LLMProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface GitSettings {
  repoUrl: string;
  username: string;
  email: string;
  pat: string; // Personal Access Token
}

export interface AppSettings {
  llmConfig: LLMSettings;
  gitConfig: GitSettings;
  debugMode: boolean;
}

export interface AgentCapabilities {
  accessOwnCode: boolean;
  execution: boolean;
  virtualEnv: boolean;
  readWrite: boolean;
}

export interface AgentLLMConfiguration {
  useGlobal: boolean;
  customConfig?: Partial<LLMSettings>; // If not useGlobal, these settings apply
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: AgentCapabilities;
  llmConfig: AgentLLMConfiguration;
  isDefault?: boolean;
  isDeletable?: boolean;
  isNameEditable?: boolean;
}

export interface AIAgentGroup {
  id: string;
  name: string;
  description: string;
  mainTask: string;
  agentIds: string[]; // IDs of agents in the group, OrquestadorFlujoAgentes is implicit
  isDefault?: boolean;
}

export interface CodeSnapshot {
  id: string;
  name: string;
  code: string;
  createdAt: string; // ISO date string
  source?: 'original' | 'suggested' | 'codealchemist-current';
}

export interface GeneratedFile {
  path: string;
  content: string;
  isFolder?: boolean; // Optional: to represent folders in a tree
}

export interface ProjectGenerationResult {
  projectName: string;
  aiNotes: string;
  files: GeneratedFile[];
  groupLog?: string; // Added for consistency, can be populated if group interaction becomes real
}

// For "Generar Proyecto" Flow
export interface GenerateProjectInput {
  description: string;
  // Potentially add llmConfigSource if the flow needs to be aware of it for specific agent context
  // agentSystemPrompt?: string; // If a specific agent's context from a group should be used
}


export interface RefactorSuggestion {
  area: string;
  description: string;
  priority: "Alta" | "Media" | "Baja";
  snippetSuggested?: {
    original?: string;
    modified?: string;
  };
  id: string; // for UI key and tracking
  status?: 'pending' | 'applied' | 'discarded';
}

// For "Analizar Código"
export interface AnalyzeCodeSnippetInput {
  code: string;
  userPrompt?: string; // Optional user instructions for analysis focus
  language?: string; // Optional language hint
  agentSystemPrompt?: string; // For agent-driven analysis
}

export interface AnalyzeCodeSnippetOutput {
  explanation: string;
  originalCode: string; // Echo back the original code for consistency
  suggestedCode: string;
  // Potentially add: issuesFound: Issue[] where Issue has severity, line numbers, etc.
}


export interface AutoUpdateSuggestion {
  id: string; // for UI key
  area: string; // file path
  suggestion: string; // description of the suggestion
  priority: "Alta" | "Media" | "Baja";
  fullFileContentSuggested?: string; // The complete suggested content of the file
  status?: 'pending' | 'applied' | 'discarded';
  isEditing?: boolean;
  userEditedContent?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface LLMConfigSourceOption {
  type: 'Ajustes Globales' | 'Agente' | 'Grupo';
  id?: string; // agentId or groupId
  name?: string; // agentName or groupName for display
}

// For the forms
export type AgentFormData = Omit<Agent, 'id' | 'isDefault' | 'isDeletable' | 'isNameEditable'> & { id?: string };
export type GroupFormData = Omit<AIAgentGroup, 'id' | 'isDefault'> & { id?: string };

// For AI-assisted creation flows
export interface SuggestAgentDefinitionInput {
  roleDescription: string;
}
export type SuggestAgentDefinitionOutput = Omit<AgentFormData, 'llmConfig' | 'id'> & {
  // llmConfig is typically set by user or defaults, AI suggests core properties
  capabilities: AgentCapabilities; // Ensure capabilities are part of the AI suggestion
};


export interface AgentInfoForGroupSuggestion {
    id: string;
    name: string;
    description: string;
}
export interface SuggestGroupDefinitionInput {
  groupTaskDescription: string;
  availableAgents: AgentInfoForGroupSuggestion[];
}
export type SuggestGroupDefinitionOutput = Omit<GroupFormData, 'id'>;


// For RefactorProjectWithAI flow
export interface RefactorProjectWithAIInput {
  projectSource: string; // Can be a data URI for uploaded file or Git URL
  goals?: string;
  priority?: string; // e.g., 'Security', 'Readability'
  searchDepth?: number;
  focusArea?: string;
}

export interface RefactorProjectWithAIOutput {
  suggestions: Array<{
    area: string;
    description: string;
    priority: 'Alta' | 'Media' | 'Baja';
    snippetSuggested?: {
      original?: string;
      modified?: string;
    };
  }>;
  groupLog?: string;
}


// For AnalyzeSelfCode (which can also be used for generic project analysis)
export interface AnalyzeCodeInput {
  sourceCodeLocation: 'Local' | 'Git' | 'UploadedString'; // 'Local' for own code, 'Git' for URL, 'UploadedString' for direct string content
  projectContent?: string; // For 'UploadedString' or fetched Git content
  gitRepoUrl?: string; // If sourceCodeLocation is 'Git'
  analysisPreferences?: string; // Specific areas or concerns
  searchDepth?: number;
  focusArea?: string;
}

export interface AnalyzeCodeOutput {
  analysisTitle: string;
  identifiedAreas: string[];
  detailedSuggestions: Array<{
    area: string;
    suggestion: string;
    priority: 'Alta' | 'Media' | 'Baja';
    suggestedContent?: string; // Full suggested file content
  }>;
  generalAssessment: string;
  groupLog?: string;
  overallImprovementIdeas?: string[];
}
