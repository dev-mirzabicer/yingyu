import { NextRequest } from 'next/server';
import { SessionService } from '@/lib/actions/sessions';
import { apiResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';

/**
 * The definitive, type-safe schema for the submit answer request body.
 * This uses a discriminated union, which is the most robust way to handle
 * payloads where the shape of one property (data) depends on the value of
 * another (action).
 */
const SubmitAnswerBodySchema = z.discriminatedUnion('action', [
  // Schema for when the action is 'REVEAL_ANSWER'
  z.object({
    action: z.literal('REVEAL_ANSWER'),
    // The data payload for this action is optional and can be an empty object.
    data: z.object({}).passthrough().optional(),
  }),
  // Schema for when the action is 'PLAY_AUDIO' (for listening exercises)
  z.object({
    action: z.literal('PLAY_AUDIO'),
    // The data payload for this action is optional and can be an empty object.
    data: z.object({}).passthrough().optional(),
  }),
  // Schema for when the action is 'SUBMIT_RATING'
  z.object({
    action: z.literal('SUBMIT_RATING'),
    // The data payload can contain either a numeric rating (1-4) or a boolean correctness rating
    data: z.union([
      z.object({
        rating: z.number().min(1).max(4),
      }),
      z.object({
        isCorrect: z.boolean(),
      }),
    ]),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const teacherId = await requireAuth(req);

    const { sessionId } = await params;
    const body = await req.json();

    // Now, when we parse, Zod validates the entire structure based on the action.
    // This is far more robust than our previous implementation.
    const payload = SubmitAnswerBodySchema.parse(body);

    const result = await SessionService.submitAnswer(
      sessionId,
      teacherId,
      payload
    );

    return apiResponse(200, result, null);
  } catch (error) {
    return handleApiError(error);
  }
}
