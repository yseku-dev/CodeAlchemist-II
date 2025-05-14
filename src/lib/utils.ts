import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
