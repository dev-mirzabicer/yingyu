import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Formats a duration in seconds into a mm:ss string.
 * @param seconds The total seconds to format.
 * @returns A string in the format "mm:ss".
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
