
// src/utils/apiClient.ts
"use client";

/**
 * @fileOverview API client utility for calling Genkit flows and handling errors.
 * This module centralizes calls to AI flows and provides a consistent error handling mechanism
 * by wrapping errors in a custom `AppError` class. Includes retry logic for transient errors.
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


const MAX_RETRIES = 2; // 2 retries means 3 total attempts
const INITIAL_DELAY_MS = 1000; // 1 second

/**
 * Creates a delay for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses an error object and attempts to convert it into an `AppError`
 * with a user-friendly message and a specific error type.
 *
 * @param {any} error - The error object to parse.
 * @param {string} defaultMessage - A default friendly message to use if parsing fails.
 * @returns {AppError} An instance of `AppError`.
 */
function parseError(error: any, defaultMessage: string): AppError {
  // If it's already an AppError (e.g., from retry logic), return it directly.
  if (error instanceof AppError) {
    // We might still want to log its originalError if it hasn't been logged verbosely yet.
    // For simplicity here, we assume AppErrors are constructed with sufficient info.
    console.error("AppError recibido:", error.message, "Tipo:", error.type, "Original:", error.originalError);
    return error;
  }

  console.error("Error Original de API (antes de parsear a AppError):", error);

  let friendlyMessage = defaultMessage;
  let errorType: AppError['type'] = 'unknown';
  let redirectTo: string | undefined = undefined;

  if (typeof error === 'string') {
    friendlyMessage = error;
  } else if (error && typeof error.message === 'string') {
    const lowerErrorMessage = error.message.toLowerCase();
    const status = error.status || error.originalError?.status; // Check error or originalError for status

    if (lowerErrorMessage.includes('api key') || 
        lowerErrorMessage.includes('permission denied') ||
        lowerErrorMessage.includes('unauthenticated') ||
        status === 401 || status === 403) {
        friendlyMessage = "Error de autenticación o permisos con el proveedor IA. Verifica tu configuración y clave API.";
        errorType = 'validation';
        redirectTo = '/configuracion';
    } else if (lowerErrorMessage.includes('model_not_found') || lowerErrorMessage.includes('unknown model')) {
        friendlyMessage = "El modelo IA seleccionado no está disponible o no es válido. Revisa la configuración.";
        errorType = 'validation';
    } else if (lowerErrorMessage.includes('rate limit') || status === 429) {
        friendlyMessage = "Se ha alcanzado el límite de solicitudes al proveedor IA. Inténtalo más tarde.";
        errorType = 'server'; // Retry logic will check for status 429
    } else if (lowerErrorMessage.includes('network error') || lowerErrorMessage.includes('failed to fetch') || lowerErrorMessage.includes('dns_unresolved_hostname')) {
        friendlyMessage = "Error de red. Por favor, comprueba tu conexión e inténtalo de nuevo.";
        errorType = 'network';
    } else if (status === 503) {
        friendlyMessage = "El servicio de IA no está disponible temporalmente (503). Por favor, inténtalo de nuevo más tarde.";
        errorType = 'server'; // Retry logic will check for status 503
    } else if (status && status >= 500) {
        friendlyMessage = `Error del servidor del proveedor IA (${status}). Inténtalo de nuevo más tarde.`;
        errorType = 'server';
    } else if (status === 400) {
        friendlyMessage = `Solicitud inválida al proveedor IA: ${error.message.substring(0,150)}`;
        errorType = 'validation';
    } else if (lowerErrorMessage.includes('output parsing failed') || lowerErrorMessage.includes('json format')) {
        friendlyMessage = "La IA devolvió una respuesta en un formato inesperado. Inténtalo de nuevo.";
        errorType = 'ai';
    } else {
        friendlyMessage = `Error: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
        if (error.name === 'GenkitError' || lowerErrorMessage.includes('genkit')) errorType = 'ai';
    }
  }
  return new AppError(friendlyMessage, error, errorType, redirectTo);
}


/**
 * Wraps an asynchronous function with retry logic for transient errors.
 * @template T The return type of the async function.
 * @param {() => Promise<T>} asyncFn - The asynchronous function to execute.
 * @param {string} flowNameForLog - A name for the flow, used in logging retry attempts.
 * @param {string} defaultFriendlyMessage - The default friendly error message for this specific flow.
 * @returns {Promise<T>} The result of the async function if successful.
 * @throws {AppError} If the function fails after all retries or with a non-retryable error.
 */
async function retryAsyncFunction<T>(
  asyncFn: () => Promise<T>,
  flowNameForLog: string,
  defaultFriendlyMessage: string
): Promise<T> {
  let lastCaughtError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastCaughtError = error;
      // Parse the error to determine if it's retryable and get its properties
      const appErrorForRetryCheck = parseError(error, "Error durante el intento de reintento.");

      const originalStatus = appErrorForRetryCheck.originalError?.status;
      const isRetryable =
        appErrorForRetryCheck.type === 'network' ||
        originalStatus === 503 || // Service Unavailable
        originalStatus === 429;   // Rate Limit Exceeded
      
      if (isRetryable && attempt <= MAX_RETRIES) {
        const delayTime = INITIAL_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`Error en ${flowNameForLog} (intento ${attempt}/${MAX_RETRIES + 1}). Reintentando en ${delayTime}ms... Error:`, appErrorForRetryCheck.originalError || appErrorForRetryCheck.message);
        await delay(delayTime);
      } else if (attempt > MAX_RETRIES && isRetryable) {
        // All retries failed for a retryable error
        console.error(`Todos los reintentos (${MAX_RETRIES}) fallaron para ${flowNameForLog}. Último error:`, lastCaughtError);
        throw new AppError(
          `${defaultFriendlyMessage} El servicio no está respondiendo después de varios intentos.`,
          lastCaughtError,
          appErrorForRetryCheck.type, // Preserve the type of the last error
          appErrorForRetryCheck.redirectTo
        );
      } else {
        // Not retryable, or it's an AppError from a deeper source that we shouldn't retry blindly
        // Let the main catch block of the wrapper function handle parsing this.
        throw lastCaughtError; 
      }
    }
  }
  // This line should ideally be unreachable due to the loop logic.
  // If it's reached, it means something went wrong with the retry loop itself.
  throw new AppError("Error inesperado en la lógica de reintentos.", lastCaughtError);
}


// --- Wrapper functions for each flow ---

/**
 * Calls the `analyzeCodeSnippet` Genkit flow with retry logic and standardized error handling.
 * @param {AnalyzeCodeSnippetInput} input - The input for the code snippet analysis.
 * @returns {Promise<AnalyzeCodeSnippetOutput>} The result of the code snippet analysis.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callAnalyzeCodeSnippet(input: AnalyzeCodeSnippetInput): Promise<AnalyzeCodeSnippetOutput> {
  const friendlyErrorMsg = "Ocurrió un error al analizar el fragmento de código.";
  try {
    return await retryAsyncFunction(() => analyzeCodeSnippetFlow(input), 'analyzeCodeSnippet', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `generateProjectStructure` Genkit flow with retry logic and standardized error handling.
 * @param {GenerateProjectInput} input - The input for project structure generation.
 * @returns {Promise<ProjectGenerationResult>} The result of the project structure generation.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callGenerateProjectStructure(input: GenerateProjectInput): Promise<ProjectGenerationResult> {
  const friendlyErrorMsg = "Ocurrió un error al generar la estructura del proyecto.";
  try {
    return await retryAsyncFunction(() => generateProjectStructureFlow(input), 'generateProjectStructure', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `refactorProjectWithAI` Genkit flow with retry logic and standardized error handling.
 * @param {RefactorProjectWithAIInput} input - The input for project refactoring.
 * @returns {Promise<RefactorProjectWithAIOutput>} The refactoring suggestions.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callRefactorProjectWithAI(input: RefactorProjectWithAIInput): Promise<RefactorProjectWithAIOutput> {
  const friendlyErrorMsg = "Ocurrió un error al refactorizar el proyecto.";
  try {
    return await retryAsyncFunction(() => refactorProjectWithAIFlow(input), 'refactorProjectWithAI', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `analyzeSelfCode` (or generic project analysis) Genkit flow with retry logic and standardized error handling.
 * @param {AnalyzeCodeInput} input - The input for code analysis.
 * @returns {Promise<AnalyzeCodeOutput>} The analysis results.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callAnalyzeSelfCode(input: AnalyzeCodeInput): Promise<AnalyzeCodeOutput> {
  const friendlyErrorMsg = "Ocurrió un error al analizar el código del proyecto.";
  try {
    return await retryAsyncFunction(() => analyzeSelfCodeFlow(input), 'analyzeSelfCode', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `chatWithAgentOrGlobal` Genkit flow for chat interactions with retry logic and standardized error handling.
 * @param {ChatWithAgentOrGlobalInput} input - The input for the chat.
 * @returns {Promise<ChatWithAgentOrGlobalOutput>} The AI's response.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callChatWithAgentOrGlobal(input: ChatWithAgentOrGlobalInput): Promise<ChatWithAgentOrGlobalOutput> {
  const friendlyErrorMsg = "Ocurrió un error en el chat con la IA.";
  try {
    return await retryAsyncFunction(() => chatWithAgentOrGlobalFlow(input), 'chatWithAgentOrGlobal', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `chatWithAIGroup` Genkit flow for group chat interactions with retry logic and standardized error handling.
 * @param {ChatWithAIGroupInput} input - The input for the group chat.
 * @returns {Promise<ChatWithAIGroupOutput>} The orchestrator's response.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callChatWithAIGroup(input: ChatWithAIGroupInput): Promise<ChatWithAIGroupOutput> {
  const friendlyErrorMsg = "Ocurrió un error en el chat con el grupo de IA.";
  try {
    return await retryAsyncFunction(() => chatWithAIGroupFlow(input), 'chatWithAIGroup', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `suggestAgentDefinition` Genkit flow with retry logic and standardized error handling.
 * @param {SuggestAgentDefinitionInput} input - The input for suggesting an agent definition.
 * @returns {Promise<SuggestAgentDefinitionOutput>} The suggested agent definition.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callSuggestAgentDefinition(input: SuggestAgentDefinitionInput): Promise<SuggestAgentDefinitionOutput> {
  const friendlyErrorMsg = "Ocurrió un error al sugerir la definición del agente.";
  try {
    return await retryAsyncFunction(() => suggestAgentDefinitionFlow(input), 'suggestAgentDefinition', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `suggestGroupDefinition` Genkit flow with retry logic and standardized error handling.
 * @param {SuggestGroupDefinitionInput} input - The input for suggesting a group definition.
 * @returns {Promise<SuggestGroupDefinitionOutput>} The suggested group definition.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callSuggestGroupDefinition(input: SuggestGroupDefinitionInput): Promise<SuggestGroupDefinitionOutput> {
  const friendlyErrorMsg = "Ocurrió un error al sugerir la definición del grupo.";
  try {
    return await retryAsyncFunction(() => suggestGroupDefinitionFlow(input), 'suggestGroupDefinition', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

/**
 * Calls the `generateCodeFromDescription` Genkit flow with retry logic and standardized error handling.
 * @param {GenerateCodeFromDescriptionInput} input - The input for generating code from a description.
 * @returns {Promise<GenerateCodeFromDescriptionOutput>} The generated code and explanation.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callGenerateCodeFromDescription(input: GenerateCodeFromDescriptionInput): Promise<GenerateCodeFromDescriptionOutput> {
  const friendlyErrorMsg = "Ocurrió un error al generar código desde la descripción.";
  try {
    return await retryAsyncFunction(() => generateCodeFromDescriptionFlow(input), 'generateCodeFromDescription', friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg);
  }
}

    