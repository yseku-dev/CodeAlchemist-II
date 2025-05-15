
// src/utils/apiClient.ts
"use client";

/**
 * @fileOverview API client utility for calling Genkit flows and handling errors.
 * This module centralizes calls to AI flows and provides a consistent error handling mechanism
 * by wrapping errors in a custom `AppError` class. Includes retry logic for transient errors.
 * JSDoc comments added for clarity.
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
  analyzeSelfCode as analyzeSelfCodeFlow, // analyzeSelfCode is used for general project analysis too
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
import {
  autoFixErrorWithGroup as autoFixErrorWithGroupFlow,
  type AutoFixErrorWithGroupInput,
  type AutoFixErrorWithGroupOutput
} from '@/ai/flows/auto-fix-error-with-group-flow';


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
 * Logs the original error for debugging.
 *
 * @param {any} error - The error object to parse.
 * @param {string} defaultMessage - A default friendly message to use if parsing fails.
 * @param {string} [flowName] - Optional name of the flow where the error originated for context.
 * @returns {AppError} An instance of `AppError`.
 */
function parseError(error: any, defaultMessage: string, flowName?: string): AppError {
  // Log the original error for debugging before any processing
  // In production, this original 'error' should also be captured by Sentry, ideally
  // in the backend or the Genkit flow itself. If not, it can be captured here.
  // Example: Sentry.captureException(error, { tags: { flowName: flowName || 'unknown_flow' } });
  console.error(`Error Original de API/Flujo${flowName ? ` (${flowName})` : ''} (antes de parsear a AppError):`, error);


  // If it's already an AppError (e.g., from retry logic), return it directly.
  if (error instanceof AppError) {
    console.warn("[apiClient.parseError] AppError recibido, devolviendo directamente:", error.message, "Tipo:", error.type, "Original (si estaba envuelto):", error.originalError);
    return error;
  }

  let friendlyMessage = defaultMessage;
  let errorType: AppError['type'] = 'unknown';
  let redirectTo: string | undefined = undefined;

  if (typeof error === 'string') {
    friendlyMessage = error;
  } else if (error && typeof error.message === 'string') {
    const lowerErrorMessage = error.message.toLowerCase();
    // Attempt to get status from various possible locations in wrapped errors
    const status = error.status || error.originalError?.status || (error.originalError?.cause as any)?.status;


    if (lowerErrorMessage.includes('api key') ||
        lowerErrorMessage.includes('permission denied') ||
        lowerErrorMessage.includes('unauthenticated') ||
        lowerErrorMessage.includes('invalid_api_key') ||
        status === 401 || status === 403) {
        friendlyMessage = "Error de autenticación o permisos con el proveedor IA. Verifica tu configuración y clave API.";
        errorType = 'validation';
        redirectTo = '/configuracion';
    } else if (lowerErrorMessage.includes('model_not_found') || lowerErrorMessage.includes('unknown model') || lowerErrorMessage.includes('model not found')) {
        friendlyMessage = "El modelo IA seleccionado no está disponible o no es válido. Revisa la configuración.";
        errorType = 'validation';
        redirectTo = '/configuracion';
    } else if (lowerErrorMessage.includes('rate limit') || status === 429) {
        friendlyMessage = "Se ha alcanzado el límite de solicitudes al proveedor IA. Inténtalo más tarde.";
        errorType = 'server';
    } else if (lowerErrorMessage.includes('network error') || lowerErrorMessage.includes('failed to fetch') || lowerErrorMessage.includes('dns_unresolved_hostname') || lowerErrorMessage.includes('econnrefused')) {
        friendlyMessage = "Error de red. Por favor, comprueba tu conexión e inténtalo de nuevo. Si usas un modelo local (LM Studio, Ollama), asegúrate de que esté en ejecución.";
        errorType = 'network';
    } else if (status === 503) {
        friendlyMessage = "El servicio de IA no está disponible temporalmente (503). Por favor, inténtalo de nuevo más tarde.";
        errorType = 'server';
    } else if (status && status >= 500) {
        friendlyMessage = `Error del servidor del proveedor IA (${status}). Inténtalo de nuevo más tarde.`;
        errorType = 'server';
    } else if (status === 400) {
        friendlyMessage = `Solicitud inválida al proveedor IA: ${error.message.substring(0,150)}`;
        errorType = 'validation';
    } else if (lowerErrorMessage.includes('output parsing failed') || lowerErrorMessage.includes('json format') || lowerErrorMessage.includes('failed to parse')) {
        friendlyMessage = "La IA devolvió una respuesta en un formato inesperado. Inténtalo de nuevo. Si el problema persiste, revisa el prompt o la configuración del modelo.";
        errorType = 'ai';
    } else {
        // Keep it relatively generic for unexpected errors
        friendlyMessage = `Error: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
        if (error.name === 'GenkitError' || lowerErrorMessage.includes('genkit') || error.message.includes('flow execution failed')) errorType = 'ai';
    }
  }
  return new AppError(friendlyMessage, error, errorType, redirectTo);
}


/**
 * Wraps an asynchronous function with retry logic for transient errors.
 * Logs retry attempts and final failures.
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
      // Parse error first to get its type and original status for retry decision
      const appErrorForRetryCheck = parseError(error, "Error durante el intento de reintento.", flowNameForLog);

      const originalErrorStatus = appErrorForRetryCheck.originalError?.status || (appErrorForRetryCheck.originalError?.cause as any)?.status;
      const isRetryable =
        appErrorForRetryCheck.type === 'network' ||
        originalErrorStatus === 503 || // Service Unavailable
        originalErrorStatus === 429;   // Rate Limit Exceeded

      if (isRetryable && attempt <= MAX_RETRIES) {
        const delayTime = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[apiClient.retryAsyncFunction] Error reintentable en ${flowNameForLog} (intento ${attempt}/${MAX_RETRIES + 1}). Reintentando en ${delayTime}ms... Error:`, appErrorForRetryCheck.originalError || appErrorForRetryCheck.message);
        await delay(delayTime);
      } else if (attempt > MAX_RETRIES && isRetryable) {
        console.error(`[apiClient.retryAsyncFunction] Todos los reintentos (${MAX_RETRIES}) fallaron para ${flowNameForLog}. Último error:`, lastCaughtError);
        // In production, this event (failure of all retries) is also important for Sentry.
        // Sentry.captureMessage(`All retries failed for flow: ${flowNameForLog}`, { level: 'error', extra: { lastError: lastCaughtError } });
        throw new AppError(
          `${defaultFriendlyMessage} El servicio no está respondiendo después de varios intentos.`,
          lastCaughtError,
          appErrorForRetryCheck.type,
          appErrorForRetryCheck.redirectTo
        );
      } else {
        // Not retryable, or it's an AppError from a deeper source we shouldn't retry.
        // Throw the already parsed AppError.
        throw appErrorForRetryCheck;
      }
    }
  }
  // This should be unreachable due to the loop logic.
  // Added for type safety, though practically the loop will always throw or return.
  console.error("[apiClient.retryAsyncFunction] Lógica de reintentos alcanzó un estado inesperado para", flowNameForLog);
  throw new AppError("Error inesperado en la lógica de reintentos.", lastCaughtError, 'unknown', undefined);
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
  const flowName = 'analyzeCodeSnippet';
  try {
    return await retryAsyncFunction(() => analyzeCodeSnippetFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error; // Already processed by retryAsyncFunction or parseError
    throw parseError(error, friendlyErrorMsg, flowName); // Catch errors not from retry logic
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
  const flowName = 'generateProjectStructure';
  try {
    return await retryAsyncFunction(() => generateProjectStructureFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'refactorProjectWithAI';
  try {
    return await retryAsyncFunction(() => refactorProjectWithAIFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'analyzeSelfCode';
  try {
    return await retryAsyncFunction(() => analyzeSelfCodeFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'chatWithAgentOrGlobal';
  try {
    return await retryAsyncFunction(() => chatWithAgentOrGlobalFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'chatWithAIGroup';
  try {
    return await retryAsyncFunction(() => chatWithAIGroupFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'suggestAgentDefinition';
  try {
    return await retryAsyncFunction(() => suggestAgentDefinitionFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'suggestGroupDefinition';
  try {
    return await retryAsyncFunction(() => suggestGroupDefinitionFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'generateCodeFromDescription';
  try {
    return await retryAsyncFunction(() => generateCodeFromDescriptionFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
  }
}

/**
 * Calls the `autoFixErrorWithGroup` Genkit flow with retry logic and standardized error handling.
 * This flow attempts to get a fix suggestion from the 'EquipoDesarrolloSoftware' group.
 * @param {AutoFixErrorWithGroupInput} input - The error details for the auto-fix attempt.
 * @returns {Promise<AutoFixErrorWithGroupOutput>} The suggested solution and diagnostic notes from the group.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callAutoFixErrorWithGroup(input: AutoFixErrorWithGroupInput): Promise<AutoFixErrorWithGroupOutput> {
  const friendlyErrorMsg = "Ocurrió un error al intentar la corrección automática con el grupo de IA.";
  const flowName = 'autoFixErrorWithGroup';
  try {
    return await retryAsyncFunction(() => autoFixErrorWithGroupFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
  }
}
