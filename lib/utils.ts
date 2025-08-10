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

/**
 * A utility function to safely convert a value to a number, returning a fallback if the conversion fails.
 * This is useful for parsing user input or data from less reliable sources.
 * @param value The value to convert.
 * @param fallback The value to return if conversion results in NaN. Defaults to 0.
 * @returns The numeric representation of the value or the fallback.
 */
export const safeNumberConversion = (value: any, fallback = 0): number => {
  const converted = Number(value);
  return isNaN(converted) ? fallback : converted;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
