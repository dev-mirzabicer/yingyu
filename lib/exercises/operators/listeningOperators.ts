import { ProgressOperator, OperatorServices } from './base';
import { SessionProgress, ListeningExerciseProgress, SubmissionResult } from '@/lib/types';
import { z } from 'zod';
import { ListeningFSRSService } from '@/lib/actions/listening';
import { FsrsRating } from '@/lib/fsrs/engine';

function normalize(text: string, opts: {
  caseSensitive: boolean;
  ignoreSpaces: boolean;
  stripPunctuation: boolean;
}): string {
  let t = text;
  if (!opts.caseSensitive) t = t.toLowerCase();
  if (opts.ignoreSpaces) t = t.replace(/\s+/g, '');
  if (opts.stripPunctuation) t = t.replace(/[^\p{L}\p{N}]/gu, '');
  return t;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

class RevealListeningAnswerOperator implements ProgressOperator {
  async execute(current: SessionProgress): Promise<[SessionProgress, SubmissionResult]> {
    if (current.type !== 'LISTENING_EXERCISE') throw new Error('Invalid progress type.');
    const newProgress: ListeningExerciseProgress = {
      ...current,
      stage: 'ANSWER_REVEALED',
    };
    return [newProgress, { isCorrect: true, feedback: 'Answer revealed.' }];
  }
}

class SubmitTextAnswerOperator implements ProgressOperator {
  async execute(
    current: SessionProgress,
    payload: unknown,
    services: OperatorServices
  ): Promise<[SessionProgress, SubmissionResult]> {
    if (current.type !== 'LISTENING_EXERCISE') throw new Error('Invalid progress type.');
    if (!current.payload.current) throw new Error('No current listening item.');
    const schema = z.object({ text: z.string().min(1), responseTimeMs: z.number().int().min(0).optional() });
    const parsed = schema.parse(payload);

    const cfg = {
      maxAttempts: current.payload.maxAttempts,
      caseSensitive: current.payload.config.caseSensitive ?? false,
      ignoreSpaces: current.payload.config.ignoreSpaces ?? true,
      stripPunctuation: current.payload.config.stripPunctuation ?? true,
      typoTolerance: current.payload.config.typoTolerance ?? 0,
      alternateAnswers: current.payload.config.alternateAnswers ?? [],
    };

    const expectedBase = current.payload.current.card.englishWord;
    const candidates = [expectedBase, ...cfg.alternateAnswers];
    const nUser = normalize(parsed.text, cfg);
    const correct = candidates.some((c) => {
      const nC = normalize(c, cfg);
      if (cfg.typoTolerance && cfg.typoTolerance > 0) {
        return levenshtein(nUser, nC) <= cfg.typoTolerance;
      }
      return nUser === nC;
    });

    const queue = [...current.payload.queue];
    let attempts = current.payload.attempts + 1;
    let stage: ListeningExerciseProgress['stage'] = 'AWAITING_ANSWER';
    let feedback = correct ? 'Correct.' : 'Try again.';

    if (correct) {
      // record a listening review
      await ListeningFSRSService.recordReview(
        services.studentId,
        current.payload.current.card.id,
        3 as FsrsRating,
        services.sessionId
      );
      // advance
      queue.shift();
      attempts = 0;
    } else if (attempts >= current.payload.maxAttempts) {
      stage = 'ANSWER_REVEALED';
      feedback = 'Answer revealed.';
      // record an incorrect review
      await ListeningFSRSService.recordReview(
        services.studentId,
        current.payload.current.card.id,
        1 as FsrsRating,
        services.sessionId
      );
      // after reveal, advance to next item automatically
      queue.shift();
      attempts = 0;
      stage = 'AWAITING_ANSWER';
    }

    const nextCurrent = queue.length > 0 ? { card: queue[0].card } : undefined;
    const newProgress: ListeningExerciseProgress = {
      ...current,
      stage,
      payload: {
        ...current.payload,
        queue,
        current: nextCurrent,
        attempts,
        lastSubmission: parsed.text,
      },
    };
    return [newProgress, { isCorrect: correct, feedback }];
  }
}

export const revealListeningAnswerOperator = new RevealListeningAnswerOperator();
export const submitTextAnswerOperator = new SubmitTextAnswerOperator();

