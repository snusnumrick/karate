import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names conditionally and merges them using `clsx` and `twMerge`.
 *
 * @param {...ClassValue[]} inputs - A list of class values which can be strings, objects, arrays, or other valid class values.
 * @return {string} - A single merged and conditionally combined class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
