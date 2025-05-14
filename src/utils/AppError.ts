
// src/utils/AppError.ts
"use client"; // Though not strictly necessary for a class, good for consistency if other utils are client-side

/**
 * @fileOverview Defines a custom error class for application-specific errors.
 */

/**
 * Custom error class for the application.
 * Allows for a user-friendly message, an optional original error, and an error type.
 */
export class AppError extends Error {
  /**
   * Creates an instance of AppError.
   * @param {string} friendlyMessage - A user-friendly message describing the error.
   * @param {any} [originalError] - The original error object or data, for debugging.
   * @param {'network' | 'server' | 'validation' | 'ai' | 'unknown'} [type] - The type category of the error.
   * @param {string} [redirectTo] - Optional path to redirect the user to (e.g., login page).
   */
  constructor(
    public friendlyMessage: string,
    public originalError?: any,
    public type?: 'network' | 'server' | 'validation' | 'ai' | 'unknown',
    public redirectTo?: string
  ) {
    super(friendlyMessage);
    this.name = 'AppError';
    // This is important for correctly setting the prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
