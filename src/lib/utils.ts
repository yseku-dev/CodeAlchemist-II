import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { LLMProvider } from '@/types';

/**
 * Combines multiple class names into a single string, resolving Tailwind CSS conflicts.
 * Uses `clsx` for conditional class names and `tailwind-merge` to handle Tailwind CSS utility class merging.
 *
 * @param {...ClassValue} inputs - A list of class names or conditional class objects.
 * @returns {string} A string of combined and merged class names.
 * @example
 * cn("p-4", "font-bold", isActive && "bg-blue-500");
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Retrieves a list of common model names for a given LLM provider.
 * This list might not be exhaustive and users can often type custom model names.
 * @param {LLMProvider} provider - The LLM provider.
 * @returns {string[]} An array of model names.
 * @example
 * const models = getModelsForProvider("OpenAI");
 * // models will be ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]
 */
export const getModelsForProvider = (provider: LLMProvider): string[] => {
  switch (provider) {
    case "Groq": return ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    case "OpenAI": return ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"];
    case "Google Gemini": return ["gemini-1.5-pro-latest", "gemini-1.0-pro", "gemini-1.5-flash-latest"];
    case "Anthropic": return ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
    case "LM Studio": return ["Local Model LM Studio (escribir nombre)", "Llama3-LMStudio", "Mistral-LMStudio"];
    case "Ollama": return ["llama3", "mistral", "codellama", "phi3"];
    default: 
      // Ensure exhaustive check or handle unknown provider if LLMProvider type can be wider
      const _exhaustiveCheck: never = provider;
      return [];
  }
};
