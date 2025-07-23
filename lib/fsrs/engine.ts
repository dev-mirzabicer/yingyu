/**
 * This file serves as the definitive, type-safe bridge to the `fsrs-rs-nodejs` library.
 * It re-exports the core classes and types we will use throughout our application,
 * providing a single, centralized point of access to the FSRS engine.
 */

import {
  FSRS,
  FSRSItem,
  FSRSReview,
  MemoryState,
  NextStates,
  DEFAULT_PARAMETERS,
} from 'fsrs-rs-nodejs';

// Re-export the core FSRS classes for use in our services.
export { FSRS, FSRSItem, FSRSReview, MemoryState, NextStates };

// Re-export the default parameters for use when a student has no custom params.
export const FSRS_DEFAULT_PARAMETERS = DEFAULT_PARAMETERS;

/**
 * A type alias for the FSRS rating. The library accepts numbers, but our application
 * logic will be typed to this specific union for clarity and safety.
 * 1 = Again, 2 = Hard, 3 = Good, 4 = Easy.
 */
export type FsrsRating = 1 | 2 | 3 | 4;

/**
 * A constant representing the desired retention rate for scheduling.
 * This is a key parameter for the FSRS algorithm. A value of 0.9 means the system
 * will schedule reviews such that the user has a 90% probability of recalling the item.
 * In a future version, this could be a configurable setting per teacher or student.
 */
export const DEFAULT_DESIRED_RETENTION = 0.9;
