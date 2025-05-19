
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
import {
  autoFixErrorWithGroup as autoFixErrorWithGroupFlow,
  type AutoFixErrorWithGroupInput,
  type AutoFixErrorWithGroupOutput
} from '@/ai/flows/auto-fix-error-with-group-flow';
import {
  redefinePrompt as redefinePromptFlow,
  type RedefinePromptInput,
  type RedefinePromptOutput
} from '@/ai/flows/redefine-prompt-flow';


const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 1000;

/**
 * Creates a delay for a specified number of milliseconds.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses an error object and attempts to convert it into an `AppError`.
 * Logs the original error for debugging.
 *
 * @param {any} error - The error object to parse.
 * @param {string} defaultMessage - A default friendly message to use if parsing fails.
 * @param {string} [flowName] - Optional name of the flow for logging context.
 * @returns {AppError} An instance of `AppError`.
 */
function parseError(error: any, defaultMessage: string, flowName?: string): AppError {
  // En un entorno de producción, este 'error' original también debería ser capturado por Sentry.
  // Ejemplo: Sentry.captureException(error, { tags: { flowName: flowName || 'unknown_flow', stage: 'apiClient.parseError.input' } });
  console.error(`[apiClient.parseError Raw - ${flowName || 'Unknown Flow'}] Error Original de API/Flujo:`, error, "Stack si es Error:", error instanceof Error ? error.stack : "N/A");

  if (error instanceof AppError) {
    console.warn(`[apiClient.parseError - ${flowName || 'Unknown Flow'}] AppError recibido, devolviendo directamente:`, error.message, "Tipo:", error.type, "StatusCode:", error.statusCode, "Original (si estaba envuelto):", error.originalError);
    return error;
  }

  let friendlyMessage = defaultMessage;
  let errorType: AppError['type'] = 'unknown';
  let redirectTo: string | undefined = undefined;
  let statusCode: number | undefined = undefined;

  const originalError = error?.originalError || error;
  const message = originalError?.message || (typeof error === 'string' ? error : defaultMessage);
  const lowerErrorMessage = typeof message === 'string' ? message.toLowerCase() : '';
  
  // Intenta extraer el código de estado de varias ubicaciones comunes en objetos de error.
  const statusSources = [
    originalError?.status,
    originalError?.response?.status,
    (originalError?.cause as any)?.status,
    originalError?.code, // Algunos errores (ej. de fs) usan 'code'
    error?.status, // Directamente en el objeto de error principal
  ];
  for (const source of statusSources) {
    if (typeof source === 'number') {
      statusCode = source;
      break;
    }
    if (typeof source === 'string' && !isNaN(parseInt(source, 10))) {
      statusCode = parseInt(source, 10);
      break;
    }
  }
  // Si aún no hay statusCode, intenta inferirlo de mensajes de error comunes.
  if (statusCode === undefined) {
    if (lowerErrorMessage.includes('[503 service unavailable]') || lowerErrorMessage.includes('service_unavailable')) statusCode = 503;
    else if (lowerErrorMessage.includes('429') || lowerErrorMessage.includes('rate limit') || lowerErrorMessage.includes('resource_exhausted')) statusCode = 429;
    else if (lowerErrorMessage.includes('401') || lowerErrorMessage.includes('unauthenticated') || lowerErrorMessage.includes('api key')) statusCode = 401;
    else if (lowerErrorMessage.includes('403') || lowerErrorMessage.includes('permission denied')) statusCode = 403;
    else if (lowerErrorMessage.includes('400') || lowerErrorMessage.includes('bad request') || lowerErrorMessage.includes('invalid_argument')) statusCode = 400;
    else if (lowerErrorMessage.includes('500') || lowerErrorMessage.includes('internal server error')) statusCode = 500;

  }


  if (statusCode === 401 || statusCode === 403 || lowerErrorMessage.includes('api key') || lowerErrorMessage.includes('permission denied') || lowerErrorMessage.includes('unauthenticated') || lowerErrorMessage.includes('invalid_api_key')) {
      friendlyMessage = "Error de autenticación o permisos con el proveedor IA. Verifica tu configuración y clave API.";
      errorType = 'validation';
      redirectTo = '/configuracion';
  } else if (lowerErrorMessage.includes('model_not_found') || lowerErrorMessage.includes('unknown model') || lowerErrorMessage.includes('model not found')) {
      friendlyMessage = "El modelo IA seleccionado no está disponible o no es válido. Revisa la configuración.";
      errorType = 'validation';
      redirectTo = '/configuracion';
  } else if (statusCode === 429 || lowerErrorMessage.includes('rate limit') || lowerErrorMessage.includes('resource_exhausted')) {
      friendlyMessage = "Se ha alcanzado el límite de solicitudes al proveedor IA (Error 429). Inténtalo más tarde.";
      errorType = 'server';
  } else if (lowerErrorMessage.includes('network error') || lowerErrorMessage.includes('failed to fetch') || lowerErrorMessage.includes('dns_unresolved_hostname') || lowerErrorMessage.includes('econnrefused')) {
      friendlyMessage = "Error de red. Por favor, comprueba tu conexión e inténtalo de nuevo. Si usas un modelo local (LM Studio, Ollama), asegúrate de que esté en ejecución.";
      errorType = 'network';
  } else if (statusCode === 503 || lowerErrorMessage.includes('[503 service unavailable]') || lowerErrorMessage.includes('service_unavailable')) {
      friendlyMessage = "El servicio de IA no está disponible temporalmente (Error 503). Por favor, inténtalo de nuevo más tarde.";
      errorType = 'server';
  } else if (statusCode && statusCode >= 500) {
      friendlyMessage = `Error del servidor del proveedor IA (${statusCode}). Inténtalo de nuevo más tarde.`;
      errorType = 'server';
  } else if (statusCode === 400) { // Bad Request
      friendlyMessage = `Solicitud inválida al proveedor IA: ${message.substring(0,150)}`;
      errorType = 'validation';
  } else if (lowerErrorMessage.includes('output parsing failed') || lowerErrorMessage.includes('json format') || lowerErrorMessage.includes('failed to parse')) {
      friendlyMessage = "La IA devolvió una respuesta en un formato inesperado. Inténtalo de nuevo. Si el problema persiste, revisa el prompt o la configuración del modelo.";
      errorType = 'ai';
  } else if (message !== defaultMessage && message.trim() !== '') { // Si el mensaje original es significativo
      friendlyMessage = `Error procesando la solicitud: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`;
      if (originalError?.name === 'GenkitError' || lowerErrorMessage.includes('genkit') || message.includes('flow execution failed')) errorType = 'ai';
  }
  
  const appError = new AppError(friendlyMessage, originalError, errorType, redirectTo, statusCode);
  // TODO: En producción, este 'appError' (que contiene el 'originalError') debería ser capturado por Sentry.
  // Sentry.captureException(appError, { tags: { flowName: flowName || 'unknown_flow', stage: 'apiClient.parseError.output', errorType: appError.type, statusCode: appError.statusCode } });
  console.error(`[apiClient.parseError Parsed - ${flowName || 'Unknown Flow'}] AppError Creado:`, appError);
  return appError;
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
      const appErrorForRetryCheck = parseError(error, "Error durante el intento de reintento.", flowNameForLog);

      const isRetryableErrorType = appErrorForRetryCheck.type === 'network' || 
                                   appErrorForRetryCheck.statusCode === 503 || 
                                   appErrorForRetryCheck.statusCode === 429;

      if (isRetryableErrorType && attempt <= MAX_RETRIES) {
        const delayTime = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        // TODO: Sentry.captureMessage(`Retrying flow: ${flowNameForLog}, attempt: ${attempt}`, { level: 'warning', extra: { error: appErrorForRetryCheck } });
        console.warn(`[apiClient.retryAsyncFunction - ${flowNameForLog}] Error reintentable (intento ${attempt}/${MAX_RETRIES + 1}). Reintentando en ${delayTime}ms... Mensaje: ${appErrorForRetryCheck.message}`, appErrorForRetryCheck.originalError || "");
        await delay(delayTime);
      } else if (attempt > MAX_RETRIES && isRetryableErrorType) {
        // TODO: Sentry.captureMessage(`All retries failed for flow: ${flowNameForLog}`, { level: 'error', extra: { lastError: appErrorForRetryCheck } });
        console.error(`[apiClient.retryAsyncFunction - ${flowNameForLog}] Todos los reintentos (${MAX_RETRIES}) fallaron para '${flowNameForLog}'. Último error procesado:`, appErrorForRetryCheck);
        throw new AppError(
          `${defaultFriendlyMessage} El servicio no está respondiendo después de varios intentos.`,
          appErrorForRetryCheck.originalError,
          appErrorForRetryCheck.type,
          appErrorForRetryCheck.redirectTo,
          appErrorForRetryCheck.statusCode
        );
      } else {
        // TODO: Sentry.captureException(appErrorForRetryCheck, { tags: { flowName: flowNameForLog, stage: 'apiClient.retry.nonRetryableOrFinal' } });
        console.error(`[apiClient.retryAsyncFunction - ${flowNameForLog}] Error no reintentable o reintentos no aplicables (intento ${attempt}) para '${flowNameForLog}'. Lanzando error procesado:`, appErrorForRetryCheck);
        throw appErrorForRetryCheck; // Re-throw the processed AppError
      }
    }
  }
  // This should be unreachable due to the loop logic.
  // TODO: Sentry.captureMessage(`Retry logic reached unexpected state for flow: ${flowNameForLog}`, { level: 'fatal', extra: { lastError: lastCaughtError } });
  console.error("[apiClient.retryAsyncFunction] Lógica de reintentos alcanzó un estado inesperado para", flowNameForLog);
  throw new AppError("Error inesperado en la lógica de reintentos.", lastCaughtError, 'unknown');
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
  const flowName = 'analyzeCodeSnippetFlow';
  try {
    return await retryAsyncFunction(() => analyzeCodeSnippetFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
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
  const flowName = 'generateProjectStructureFlow';
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
  const flowName = 'refactorProjectWithAIFlow';
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
  const flowName = 'analyzeSelfCodeFlow';
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
  const flowName = 'chatWithAgentOrGlobalFlow';
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
  const flowName = 'chatWithAIGroupFlow';
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
  const flowName = 'suggestAgentDefinitionFlow';
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
  const flowName = 'suggestGroupDefinitionFlow';
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
  const flowName = 'generateCodeFromDescriptionFlow';
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
  const flowName = 'autoFixErrorWithGroupFlow';
  try {
    return await retryAsyncFunction(() => autoFixErrorWithGroupFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
  }
}

/**
 * Calls the `redefinePrompt` Genkit flow with retry logic and standardized error handling.
 * @param {RedefinePromptInput} input - The original prompt to be redefined.
 * @returns {Promise<RedefinePromptOutput>} The redefined prompt.
 * @throws {AppError} If an error occurs during the flow execution or after retries.
 */
export async function callRedefinePrompt(input: RedefinePromptInput): Promise<RedefinePromptOutput> {
  const friendlyErrorMsg = "Ocurrió un error al intentar redefinir la petición con IA.";
  const flowName = 'redefinePromptFlow';
  try {
    return await retryAsyncFunction(() => redefinePromptFlow(input), flowName, friendlyErrorMsg);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw parseError(error, friendlyErrorMsg, flowName);
  }
}
