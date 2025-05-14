// src/utils/apiClient.ts
"use client";

import { AppError } from './AppError';

// Importing all flow functions and their types
import { 
  analyzeCodeSnippet as analyzeCodeSnippetFlow, 
  type AnalyzeCodeSnippetInput, 
  type AnalyzeCodeSnippetOutput 
} from '@/ai/flows/analyze-code-snippet';
import { 
  generateProjectStructure as generateProjectStructureFlow,
  type GenerateProjectInput,
  type ProjectGenerationResult
} from '@/ai/flows/generate-project-structure-flow';
import {
  refactorProjectWithAI as refactorProjectWithAIFlow,
  type RefactorProjectWithAIInput,
  type RefactorProjectWithAIOutput
} from '@/ai/flows/refactor-project-with-ai';
import {
  analyzeSelfCode as analyzeSelfCodeFlow,
  type AnalyzeCodeInput, // Re-used for self-code and general project analysis
  type AnalyzeCodeOutput
} from '@/ai/flows/analyze-self-code';
import {
  chatWithAgentOrGlobal as chatWithAgentOrGlobalFlow,
  type ChatWithAgentOrGlobalInput,
  type ChatWithAgentOrGlobalOutput
} from '@/ai/flows/chat-with-agent-or-global-flow';
import {
  chatWithAIGroup as chatWithAIGroupFlow,
  type ChatWithAIGroupInput,
  type ChatWithAIGroupOutput
} from '@/ai/flows/chat-with-ai-group-flow';
import {
  suggestAgentDefinition as suggestAgentDefinitionFlow,
  type SuggestAgentDefinitionInput,
  type SuggestAgentDefinitionOutput
} from '@/ai/flows/suggest-agent-definition-flow';
import {
  suggestGroupDefinition as suggestGroupDefinitionFlow,
  type SuggestGroupDefinitionInput,
  type SuggestGroupDefinitionOutput
} from '@/ai/flows/suggest-group-definition-flow';
import {
  generateCodeFromDescription as generateCodeFromDescriptionFlow,
  type GenerateCodeFromDescriptionInput,
  type GenerateCodeFromDescriptionOutput
} from '@/ai/flows/generate-code-from-description';


// Helper to parse errors - this can be expanded significantly
function parseError(error: any, defaultMessage: string): AppError {
  console.error("Original API Error:", error);

  let friendlyMessage = defaultMessage;
  let errorType: AppError['type'] = 'unknown';

  if (error instanceof AppError) { // If it's already an AppError, just re-throw
    return error;
  }

  if (typeof error === 'string') {
    friendlyMessage = error;
  } else if (error && typeof error.message === 'string') {
    // Basic Genkit/LLM error check (often they include " roli" or model names in error messages)
    if (error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('permission denied')) {
        friendlyMessage = "Error de autenticación o permisos con el proveedor IA. Verifica tu configuración.";
        errorType = 'validation';
    } else if (error.message.toLowerCase().includes('model_not_found') || error.message.toLowerCase().includes('unknown model')) {
        friendlyMessage = "El modelo IA seleccionado no está disponible o no es válido. Revisa la configuración.";
        errorType = 'validation';
    } else if (error.message.toLowerCase().includes('rate limit') || (error.status && error.status === 429)) {
        friendlyMessage = "Se ha alcanzado el límite de solicitudes al proveedor IA. Inténtalo más tarde.";
        errorType = 'server';
    } else if (error.message.toLowerCase().includes('network error') || error.message.toLowerCase().includes('failed to fetch')) {
        friendlyMessage = "Error de red. Por favor, comprueba tu conexión e inténtalo de nuevo.";
        errorType = 'network';
    } else if (error.status && error.status >= 500) {
        friendlyMessage = "Error del servidor del proveedor IA. Inténtalo de nuevo más tarde.";
        errorType = 'server';
    } else if (error.status && error.status === 400) {
        friendlyMessage = `Solicitud inválida al proveedor IA: ${error.message.substring(0,150)}`;
        errorType = 'validation';
    } else if (error.message.toLowerCase().includes('output parsing failed') || error.message.toLowerCase().includes('json format')) {
        friendlyMessage = "La IA devolvió una respuesta en un formato inesperado. Inténtalo de nuevo.";
        errorType = 'ai';
    }
     else {
        friendlyMessage = `Error: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
        // Attempt to categorize further if possible, e.g. Genkit specific errors
        if (error.name === 'GenkitError') errorType = 'ai';
    }
  }
  return new AppError(friendlyMessage, error, errorType);
}

// --- Wrapper functions for each flow ---

export async function callAnalyzeCodeSnippet(input: AnalyzeCodeSnippetInput): Promise<AnalyzeCodeSnippetOutput> {
  try {
    return await analyzeCodeSnippetFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al analizar el fragmento de código.");
  }
}

export async function callGenerateProjectStructure(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
  try {
    return await generateProjectStructureFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al generar la estructura del proyecto.");
  }
}

export async function callRefactorProjectWithAI(input: RefactorProjectWithAIInput): Promise<RefactorProjectWithAIOutput> {
  try {
    return await refactorProjectWithAIFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al refactorizar el proyecto.");
  }
}

export async function callAnalyzeSelfCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  try {
    return await analyzeSelfCodeFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al analizar el código del proyecto.");
  }
}

export async function callChatWithAgentOrGlobal(input: ChatWithAgentOrGlobalInput): Promise<ChatWithAgentOrGlobalOutput> {
  try {
    return await chatWithAgentOrGlobalFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error en el chat con la IA.");
  }
}

export async function callChatWithAIGroup(input: ChatWithAIGroupInput): Promise<ChatWithAIGroupOutput> {
  try {
    return await chatWithAIGroupFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error en el chat con el grupo de IA.");
  }
}

export async function callSuggestAgentDefinition(input: SuggestAgentDefinitionInput): Promise<SuggestAgentDefinitionOutput> {
  try {
    return await suggestAgentDefinitionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al sugerir la definición del agente.");
  }
}

export async function callSuggestGroupDefinition(input: SuggestGroupDefinitionInput): Promise<SuggestGroupDefinitionOutput> {
  try {
    return await suggestGroupDefinitionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al sugerir la definición del grupo.");
  }
}

export async function callGenerateCodeFromDescription(input: GenerateCodeFromDescriptionInput): Promise<GenerateCodeFromDescriptionOutput> {
  try {
    return await generateCodeFromDescriptionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al generar código desde la descripción.");
  }
}
