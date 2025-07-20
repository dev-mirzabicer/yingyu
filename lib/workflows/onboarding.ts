import { StudentService } from '../actions/students';
import { JobService } from '../actions/jobs';
import { CreateStudentSchema } from '../schemas';
import { z } from 'zod';

// Define the input type for our workflow using Zod's type inference.
type OnboardingInput = z.infer<typeof CreateStudentSchema>;

/**
 * This workflow encapsulates the entire multi-step process of onboarding a new student.
 * It simplifies the logic required from the frontend, making the API more robust and easier to use.
 */
export const OnboardingWorkflow = {
  /**
   * Creates a new student, assigns them their first deck, and kicks off the asynchronous
   * job to initialize their FSRS card states.
   *
   * @param teacherId The UUID of the teacher performing the onboarding.
   * @param studentData The data for the new student.
   * @param initialDeckId The UUID of the vocabulary deck to assign immediately.
   * @returns A promise that resolves to an object containing the new student and the job for card initialization.
   */
  async onboardStudentWithInitialDeck({
    teacherId,
    studentData,
    initialDeckId,
  }: {
    teacherId: string;
    studentData: OnboardingInput;
    initialDeckId: string;
  }) {
    // 1. Meticulous Validation: The first step is always to validate the input.
    CreateStudentSchema.parse(studentData);

    // 2. Create the Student Entity: Delegate to the core service.
    const newStudent = await StudentService.createStudent(
      teacherId,
      studentData
    );

    // 3. Assign the Initial Deck:
    await StudentService.assignDeckToStudent(
      newStudent.id,
      teacherId,
      initialDeckId,
      {}
    );

    // 4. Create the Asynchronous Job:
    // Instead of blocking the API, we queue the heavy lifting.
    const job = await JobService.createJob(
      teacherId,
      'INITIALIZE_CARD_STATES',
      {
        studentId: newStudent.id,
        deckId: initialDeckId,
      }
    );

    // 5. Return a Comprehensive Result:
    // The frontend receives everything it needs to update the UI and monitor the background job.
    return {
      student: newStudent,
      initializationJob: job,
    };
  },
};
