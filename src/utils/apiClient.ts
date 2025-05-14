
// src/utils/apiClient.ts
"use client";

/**
 * @fileOverview API client utility for calling Genkit flows and handling errors.
 * This module centralizes calls to AI flows and provides a consistent error handling mechanism
 * by wrapping errors in a custom `AppError` class.
 */

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
  type AnalyzeCodeInput, 
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


/**
 * Parses an error object and attempts to convert it into an `AppError`
 * with a user-friendly message and a specific error type.
 *
 * @param {any} error - The error object to parse.
 * @param {string} defaultMessage - A default friendly message to use if parsing fails.
 * @returns {AppError} An instance of `AppError`.
 */
function parseError(error: any, defaultMessage: string): AppError {
  console.error("Original API Error:", error);

  let friendlyMessage = defaultMessage;
  let errorType: AppError['type'] = 'unknown';
  let redirectTo: string | undefined = undefined;

  if (error instanceof AppError) { // If it's already an AppError, just re-throw
    return error;
  }

  if (typeof error === 'string') {
    friendlyMessage = error;
  } else if (error && typeof error.message === 'string') {
    const lowerErrorMessage = error.message.toLowerCase();
    // Check for 401-like authentication/authorization issues
    if (lowerErrorMessage.includes('api key') || 
        lowerErrorMessage.includes('permission denied') ||
        lowerErrorMessage.includes('unauthenticated') || // Genkit/gRPC unauthenticated
        (error.status && error.status === 401) || 
        (error.status && error.status === 403)) {
        friendlyMessage = "Error de autenticación o permisos con el proveedor IA. Verifica tu configuración y clave API.";
        errorType = 'validation';
        redirectTo = '/configuracion'; // Redirect to settings page for API key issues
    } else if (lowerErrorMessage.includes('model_not_found') || lowerErrorMessage.includes('unknown model')) {
        friendlyMessage = "El modelo IA seleccionado no está disponible o no es válido. Revisa la configuración.";
        errorType = 'validation';
    } else if (lowerErrorMessage.includes('rate limit') || (error.status && error.status === 429)) {
        friendlyMessage = "Se ha alcanzado el límite de solicitudes al proveedor IA. Inténtalo más tarde.";
        errorType = 'server';
    } else if (lowerErrorMessage.includes('network error') || lowerErrorMessage.includes('failed to fetch')) {
        friendlyMessage = "Error de red. Por favor, comprueba tu conexión e inténtalo de nuevo.";
        errorType = 'network';
    } else if (error.status && error.status >= 500) { // 500-like server errors
        friendlyMessage = "Error del servidor del proveedor IA. Inténtalo de nuevo más tarde.";
        errorType = 'server';
    } else if (error.status && error.status === 400) {
        friendlyMessage = `Solicitud inválida al proveedor IA: ${error.message.substring(0,150)}`;
        errorType = 'validation';
    } else if (lowerErrorMessage.includes('output parsing failed') || lowerErrorMessage.includes('json format')) {
        friendlyMessage = "La IA devolvió una respuesta en un formato inesperado. Inténtalo de nuevo.";
        errorType = 'ai';
    }
     else {
        friendlyMessage = `Error: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
        if (error.name === 'GenkitError' || lowerErrorMessage.includes('genkit')) errorType = 'ai';
    }
  }
  return new AppError(friendlyMessage, error, errorType, redirectTo);
}

// --- Wrapper functions for each flow ---

/**
 * Calls the `analyzeCodeSnippet` Genkit flow and handles potential errors.
 * @param {AnalyzeCodeSnippetInput} input - The input for the code snippet analysis.
 * @returns {Promise<AnalyzeCodeSnippetOutput>} The result of the code snippet analysis.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callAnalyzeCodeSnippet(input: AnalyzeCodeSnippetInput): Promise<AnalyzeCodeSnippetOutput> {
  try {
    return await analyzeCodeSnippetFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al analizar el fragmento de código.");
  }
}

/**
 * Calls the `generateProjectStructure` Genkit flow and handles potential errors.
 * @param {GenerateProjectInput} input - The input for project structure generation.
 * @returns {Promise<ProjectGenerationResult>} The result of the project structure generation.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callGenerateProjectStructure(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
  try {
    return await generateProjectStructureFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al generar la estructura del proyecto.");
  }
}

/**
 * Calls the `refactorProjectWithAI` Genkit flow and handles potential errors.
 * @param {RefactorProjectWithAIInput} input - The input for project refactoring.
 * @returns {Promise<RefactorProjectWithAIOutput>} The refactoring suggestions.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callRefactorProjectWithAI(input: RefactorProjectWithAIInput): Promise<RefactorProjectWithAIOutput> {
  try {
    return await refactorProjectWithAIFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al refactorizar el proyecto.");
  }
}

/**
 * Calls the `analyzeSelfCode` (or generic project analysis) Genkit flow and handles potential errors.
 * @param {AnalyzeCodeInput} input - The input for code analysis.
 * @returns {Promise<AnalyzeCodeOutput>} The analysis results.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callAnalyzeSelfCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  try {
    return await analyzeSelfCodeFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al analizar el código del proyecto.");
  }
}

/**
 * Calls the `chatWithAgentOrGlobal` Genkit flow for chat interactions and handles potential errors.
 * @param {ChatWithAgentOrGlobalInput} input - The input for the chat.
 * @returns {Promise<ChatWithAgentOrGlobalOutput>} The AI's response.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callChatWithAgentOrGlobal(input: ChatWithAgentOrGlobalInput): Promise<ChatWithAgentOrGlobalOutput> {
  try {
    return await chatWithAgentOrGlobalFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error en el chat con la IA.");
  }
}

/**
 * Calls the `chatWithAIGroup` Genkit flow for group chat interactions and handles potential errors.
 * @param {ChatWithAIGroupInput} input - The input for the group chat.
 * @returns {Promise<ChatWithAIGroupOutput>} The orchestrator's response.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callChatWithAIGroup(input: ChatWithAIGroupInput): Promise<ChatWithAIGroupOutput> {
  try {
    return await chatWithAIGroupFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error en el chat con el grupo de IA.");
  }
}

/**
 * Calls the `suggestAgentDefinition` Genkit flow and handles potential errors.
 * @param {SuggestAgentDefinitionInput} input - The input for suggesting an agent definition.
 * @returns {Promise<SuggestAgentDefinitionOutput>} The suggested agent definition.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callSuggestAgentDefinition(input: SuggestAgentDefinitionInput): Promise<SuggestAgentDefinitionOutput> {
  try {
    return await suggestAgentDefinitionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al sugerir la definición del agente.");
  }
}

/**
 * Calls the `suggestGroupDefinition` Genkit flow and handles potential errors.
 * @param {SuggestGroupDefinitionInput} input - The input for suggesting a group definition.
 * @returns {Promise<SuggestGroupDefinitionOutput>} The suggested group definition.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callSuggestGroupDefinition(input: SuggestGroupDefinitionInput): Promise<SuggestGroupDefinitionOutput> {
  try {
    return await suggestGroupDefinitionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al sugerir la definición del grupo.");
  }
}

/**
 * Calls the `generateCodeFromDescription` Genkit flow and handles potential errors.
 * @param {GenerateCodeFromDescriptionInput} input - The input for generating code from a description.
 * @returns {Promise<GenerateCodeFromDescriptionOutput>} The generated code and explanation.
 * @throws {AppError} If an error occurs during the flow execution.
 */
export async function callGenerateCodeFromDescription(input: GenerateCodeFromDescriptionInput): Promise<GenerateCodeFromDescriptionOutput> {
  try {
    return await generateCodeFromDescriptionFlow(input);
  } catch (error) {
    throw parseError(error, "Ocurrió un error al generar código desde la descripción.");
  }
}
