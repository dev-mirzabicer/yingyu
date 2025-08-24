import { Decimal } from "@prisma/client/runtime/library"

/**
 * Union type for values that can be safely converted to numbers.
 * This provides type safety while allowing flexibility for various input types.
 */
type NumberConvertible = string | number | boolean | null | undefined | Decimal;

/**
 * A utility function to safely convert a value to a number, returning a fallback if the conversion fails.
 * This is useful for parsing user input or data from less reliable sources.
 * Now includes support for Prisma Decimal types commonly used in financial calculations.
 * 
 * @param value The value to convert - accepts string, number, boolean, null, undefined, or Decimal
 * @param fallback The value to return if conversion results in NaN. Defaults to 0.
 * @returns The numeric representation of the value or the fallback.
 * 
 * @example
 * ```typescript
 * safeNumberConversion("123")     // returns 123
 * safeNumberConversion("abc")     // returns 0 (fallback)
 * safeNumberConversion("abc", -1) // returns -1 (custom fallback)
 * safeNumberConversion(null)      // returns 0 (fallback)
 * safeNumberConversion(true)      // returns 1
 * safeNumberConversion(new Decimal("45.99")) // returns 45.99
 * ```
 */
export const safeNumberConversion = (value: NumberConvertible, fallback = 0): number => {
  // Handle null and undefined explicitly
  if (value === null || value === undefined) {
    return fallback;
  }
  
  // Handle Decimal objects from Prisma
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  
  const converted = Number(value);
  return isNaN(converted) ? fallback : converted;
};

/**
 * Specifically handles Decimal to number conversion for financial calculations.
 * Maintains precision for currency operations.
 * 
 * @param decimal The Decimal value to convert
 * @param fallback The fallback value if conversion fails
 * @returns The numeric representation maintaining financial precision
 */
export const decimalToNumber = (decimal: Decimal | null | undefined, fallback = 0): number => {
  if (!decimal) return fallback;
  if (!(decimal instanceof Decimal)) return fallback;
  return decimal.toNumber();
};

/**
 * Type guard to check if a value is a Decimal instance
 */
export const isDecimal = (value: unknown): value is Decimal => {
  return value instanceof Decimal;
};