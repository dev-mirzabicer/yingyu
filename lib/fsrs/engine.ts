import { FSRS, Card, ReviewLog, State, Rating } from 'fsrs.js';
import { StudentFsrsParams } from '@prisma/client';

// Define a simplified, library-agnostic representation of a card's FSRS state.
// the service will work with this type, not the direct type from the library.
export type FsrsCard = Card;
export type FsrsReviewLog = ReviewLog;
export type FsrsRating = Rating;

// Define the structure of the scheduling result that the application expects.
// This mirrors the structure from fsrs.js but is defined by us as the internal standard.
export type SchedulingResult = {
  [key in State]: FsrsCard;
};

// This is the core abstraction: the interface for any FSRS engine.
// It has a single method, `repeat`, which is all the service needs to know about.
export interface FSRS_Engine {
  repeat(card: FsrsCard, now: Date): SchedulingResult;
}

/**
 * Factory function to create an instance of the FSRS engine.
 * THIS IS THE ONLY PLACE IN THE APP THAT IS COUPLED TO A SPECIFIC FSRS LIBRARY.
 *
 * @param studentParams The student-specific FSRS parameters from the database.
 * @returns An object that conforms to FSRS_Engine interface.
 */
export function createFsrsEngine(
  studentParams?: StudentFsrsParams | null
): FSRS_Engine {
  // Use the student's custom parameters, or fall back to the library's default.
  // The `w` parameter is stored as JSON in the DB, so we parse it here.
  const params = studentParams?.w ? (studentParams.w as number[]) : undefined;
  const fsrs = new FSRS({ w: params });

  // Return an adapter object that matches the interface.
  return {
    repeat: (card: FsrsCard, now: Date): SchedulingResult => {
      return fsrs.repeat(card, now);
    },
  };
}
