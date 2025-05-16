// src/app/configuracion/actions.ts
'use server';

import Groq from "groq-sdk";

/**
 * @fileOverview Server Actions for the Configuration page.
 * Currently includes a function to fetch available models from Groq.
 */

/**
 * Result type for the getGroqModels Server Action.
 */
interface GetGroqModelsResult {
  success: boolean;
  models?: string[];
  error?: string;
  debug?: any; // For sending back more detailed error info if needed
}

/**
 * Server Action to fetch available models from the Groq API.
 *
 * @param {string} apiKey - The Groq API key.
 * @returns {Promise<GetGroqModelsResult>} An object indicating success, a list of model IDs, or an error message.
 */
export async function getGroqModels(apiKey: string): Promise<GetGroqModelsResult> {
  if (!apiKey || apiKey.trim() === '') {
    const errorMsg = "La clave API de Groq no fue proporcionada a la Server Action.";
    console.error(`[SERVER ACTION getGroqModels] ${errorMsg}`);
    return { success: false, error: "Clave API de Groq requerida." };
  }

  console.log(`[SERVER ACTION getGroqModels] Iniciada. API Key (primeros 5 chars): ${apiKey.substring(0, 5)}...`);

  try {
    const groq = new Groq({ apiKey });
    console.log("[SERVER ACTION getGroqModels] Instancia de Groq SDK creada. Listando modelos...");

    const chatModels = await groq.models.list();
    console.log("[SERVER ACTION getGroqModels] Respuesta de groq.models.list() recibida.");

    if (chatModels && chatModels.data && Array.isArray(chatModels.data)) {
      const modelIds = chatModels.data.map(model => model.id).sort();
      console.log(`[SERVER ACTION getGroqModels] Modelos parseados (${modelIds.length}):`, modelIds.join(', '));
      if (modelIds.length === 0) {
        console.warn("[SERVER ACTION getGroqModels] La API de Groq devolvió una lista vacía de modelos.");
        return { success: true, models: [], error: "No se encontraron modelos disponibles para esta clave API en Groq." };
      }
      return { success: true, models: modelIds };
    } else {
      const errorMsg = "La respuesta de la API de Groq no tiene el formato esperado (data array).";
      console.error(`[SERVER ACTION getGroqModels] ${errorMsg} Respuesta recibida:`, JSON.stringify(chatModels, null, 2));
      return { 
        success: false, 
        error: "Error al procesar la lista de modelos de Groq. Formato inesperado.",
        debug: { message: "Unexpected response structure from Groq API", response: chatModels }
      };
    }
  } catch (error: any) {
    let friendlyErrorMessage = "Error desconocido al contactar la API de Groq.";
    let errorDetails: any = error;

    if (error instanceof Groq.APIError) {
      console.error(`[SERVER ACTION getGroqModels] Groq.APIError: Status ${error.status}, Mensaje: ${error.message}`, error);
      friendlyErrorMessage = `Error de la API de Groq (Status ${error.status}): ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}`;
      if (error.status === 401) {
        friendlyErrorMessage = "Error de autenticación con Groq: Clave API inválida o sin permisos.";
      } else if (error.status === 429) {
        friendlyErrorMessage = "Límite de tasa alcanzado con la API de Groq. Inténtalo más tarde.";
      }
      errorDetails = { name: error.name, status: error.status, message: error.message, headers: error.headers };
    } else if (error instanceof Error) {
      console.error(`[SERVER ACTION getGroqModels] Error general: ${error.message}`, error.stack);
      friendlyErrorMessage = `Error al obtener modelos de Groq: ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}`;
      errorDetails = { name: error.name, message: error.message, stack: error.stack?.substring(0, 200) };
    } else {
      console.error("[SERVER ACTION getGroqModels] Error desconocido de tipo no estándar:", error);
    }
    
    return { 
      success: false, 
      error: friendlyErrorMessage,
      debug: errorDetails 
    };
  }
}
