// src/utils/AppError.ts
"use client"; // Though not strictly necessary for a class, good for consistency if other utils are client-side

export class AppError extends Error {
  constructor(
    public friendlyMessage: string,
    public originalError?: any,
    public type?: 'network' | 'server' | 'validation' | 'ai' | 'unknown'
  ) {
    super(friendlyMessage);
    this.name = 'AppError';
    // This is important for correctly setting the prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
