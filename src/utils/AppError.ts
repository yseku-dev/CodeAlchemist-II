// src/utils/AppError.ts
// Eliminada la directiva "use client";

/**
 * @fileOverview Defines a custom error class for application-specific errors.
 * This class helps in standardizing error handling across the application,
 * providing user-friendly messages and categorizing errors.
 */

/**
 * Custom error class for the application.
 * Allows for a user-friendly message, an optional original error, an error type,
 * an optional redirect path, and an optional status code.
 */
export class AppError extends Error {
  /**
   * Creates an instance of AppError.
   * @param {string} friendlyMessage - A user-friendly message describing the error. This message is safe to display to the end-user.
   * @param {any} [originalError] - The original error object or data that was caught. This is useful for debugging and logging.
   * @param {'network' | 'server' | 'validation' | 'ai' | 'unknown'} [type='unknown'] - The type category of the error. Defaults to 'unknown'.
   *    - 'network': For issues related to network connectivity (e.g., failed to fetch).
   *    - 'server': For errors originating from the backend or external API servers (e.g., HTTP 500, 503).
   *    - 'validation': For errors related to invalid user input or configuration (e.g., missing API key, invalid model).
   *    - 'ai': For errors specifically related to the AI model's response or Genkit flow execution (e.g., parsing AI output, unexpected AI behavior).
   *    - 'unknown': For errors that don't fit into the other categories.
   * @param {string} [redirectTo] - Optional path to redirect the user to (e.g., '/configuracion' if an API key is invalid).
   * @param {number} [statusCode] - Optional HTTP-like status code associated with the error (e.g., 401, 403, 429, 500, 503).
   */
  constructor(
    public friendlyMessage: string,
    public originalError?: any,
    public type: 'network' | 'server' | 'validation' | 'ai' | 'unknown' = 'unknown',
    public redirectTo?: string,
    public statusCode?: number
  ) {
    super(friendlyMessage); // The 'message' property of Error will be friendlyMessage
    this.name = 'AppError'; // Custom error name

    // This is important for correctly setting the prototype chain
    // and ensuring 'instanceof AppError' works as expected.
    Object.setPrototypeOf(this, AppError.prototype);

    // Storing additional properties directly on the instance
    // (originalError, type, redirectTo, statusCode are already handled by being public constructor parameters)
  }
}
