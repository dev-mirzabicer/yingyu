import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthorizationError } from './auth';

/**
 * A standardized wrapper for all API responses.
 * This ensures a consistent and predictable structure for clients.
 *
 * @param status The HTTP status code for the response.
 * @param data The payload of the response, if successful.
 * @param error A descriptive error message, if unsuccessful.
 * @returns A NextResponse object.
 */
export function apiResponse<T>(
  status: number,
  data: T | null,
  error: string | null
) {
  const ok = status >= 200 && status < 300;
  return NextResponse.json({ ok, data, error }, { status });
}

/**
 * A centralized error handler for all API routes.
 * It inspects the type of error thrown by the service layer and maps it
 * to the appropriate HTTP status code and standardized error response.
 *
 * @param error The error caught in the API route's try-catch block.
 * @returns A NextResponse object formatted by apiResponse.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const errorMessage = `Validation Error: ${error.message}`;
    return apiResponse(400, null, errorMessage);
  }

  if (error instanceof AuthorizationError) {
    return apiResponse(403, null, error.message);
  }

  if (error instanceof Error) {
    // A simple heuristic to catch Prisma's "not found" errors.
    if (
      error.message.includes('not found') ||
      (error as any).code === 'P2025'
    ) {
      return apiResponse(404, null, 'The requested resource was not found.');
    }
  }

  // For any other unexpected error, log it for debugging and return a generic 500.
  console.error('[Unhandled API Error]', error);
  return apiResponse(500, null, 'An internal server error occurred.');
}
