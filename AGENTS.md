# AGENTS.md: The Definitive Guide to the Yingyu Backend

## 0. Manifesto: Our Philosophy & Vision

Welcome, agent. You are now part of a project to build not just an application, but a scientifically-backed pedagogical tool. Before you write a single line of code, you must understand our core philosophy. We are not merely building CRUD endpoints; we are engineering a system that empowers teachers, optimizes learning, and is built with a degree of resilience and architectural integrity that is absolute.

> **Our Prime Directive:** To build a teacher-centric English learning platform that uses a sophisticated FSRS (Free Spaced Repetition Scheduler) engine to provide unprecedented pedagogical insights and operational efficiency. Every architectural decision must serve this directive.

### Our Guiding Principles:

1.  **The Teacher is the User:** The application is a tool for the teacher. The student is the subject. We do not build features for students; we build features that enable the teacher to manage, teach, and analyze the student's progress. Every UI, API, and workflow must be designed to reduce the teacher's cognitive load.
2.  **Resilience and Atomicity are Non-Negotiable:** The system state must *never* be corruptible. Operations must be atomic. We prefer to fail an entire operation rather than leave the database in an inconsistent state. We build for the "double-click," the network failure, and the unexpected edge case from day one.
3.  **History is the Absolute Source of Truth:** For FSRS, the `ReviewHistory` table is the immutable ledger of a student's learning journey. All other FSRS-related states (`StudentCardState`) are considered disposable, rebuildable caches. This principle, embodied in the `FSRSService._rebuildCacheForStudent` function, ensures that our learning algorithm is always based on perfect data.
4.  **Architecture is Layered and Explicit:** We adhere to a strict layered architecture. Logic is never mixed. The API layer validates and delegates. The Service layer orchestrates and enforces business rules. The Data layer accesses the database. This separation is sacred.
5.  **Asynchronicity for a Responsive Experience:** Long-running tasks (like initializing hundreds of card states or optimizing FSRS parameters) must *never* block the user. We use a robust, race-condition-proof background job system to handle these tasks, providing immediate feedback to the teacher.

Read these principles again. Internalize them. They are the lens through which you must review your own work and the work of others.

---

## 1. System Architecture Overview

Our application is a full-stack TypeScript monolith built on Next.js, but with a strictly layered internal architecture designed for clarity and separation of concerns.

```mermaid
graph TD
    subgraph "API Layer (app/api)"
        A1[POST /workflows/onboard-student] --> W1(OnboardingWorkflow)
        A2[POST /sessions/start] --> S1(SessionService)
        A3[POST /sessions/[id]/submit] --> S1
        A4[GET /students/[id]] --> S2(StudentService)
        A5[POST /units] --> C1(ContentService)
        A6[POST /worker/run] --> J1(Job Worker)
        A7[POST /students/[id]/fsrs/optimize-parameters] --> F1(FSRSService)
    end

    subgraph "Workflow Layer (lib/workflows)"
        W1 -- orchestrates --> S2
    end

    subgraph "Service Layer (lib/actions)"
        S1 -- uses --> D1(Exercise Dispatcher)
        S2 -- uses --> J2(JobService)
        C1 -- uses --> DB((Prisma Client))
        F1 -- uses --> FSRS_Engine(FSRS Engine)
        F1 -- uses --> J2
        J2 -- uses --> DB
    end

    subgraph "Exercise Handling Layer (lib/exercises)"
        D1 -- dispatches to --> H1(VocabularyDeckHandler)
        H1 -- uses --> OP1(Progress Operators)
        OP1 -- uses --> F1
        OP1 -- uses --> DB
    end

    subgraph "Data & Engine Layer"
        FSRS_Engine(FSRS Engine) -- bridge to --> Rust(fsrs-rs-nodejs)
        DB -- soft deletes via extension --> PG[(PostgreSQL)]
    end

    subgraph "Async Processing"
        Scheduler(Vercel Cron) -- triggers --> A6_Prod(POST /api/worker)
        A6_Prod --> J1
        A6 -- dev only trigger --> J1
        J1 -- processes jobs from --> PG
        J1 -- calls internal methods --> S2
        J1 -- calls internal methods --> F1
        J1 -- calls internal methods --> C1
    end

    style DB fill:#cde4ff,stroke:#333,stroke-width:2px
    style PG fill:#cde4ff,stroke:#333,stroke-width:2px
    style Rust fill:#ffd8b1,stroke:#333,stroke-width:2px
```

-   **API Layer (`app/api`):** The thin, outermost layer. Its only jobs are to define routes, handle authentication, validate incoming data using Zod, and delegate to the appropriate Workflow or Service. It knows nothing of business logic.
-   **Workflow Layer (`lib/workflows`):** Orchestrates calls across *multiple* services to accomplish a high-level user story (e.g., "Onboard a Student," which involves creating a student and assigning a deck).
-   **Service Layer (`lib/actions`):** The heart of our business logic. Each service (`StudentService`, `SessionService`, `ContentService`, `FSRSService`) is responsible for a specific domain. They contain the core logic, enforce business rules, and interact with the database.
-   **Exercise Handling Layer (`lib/exercises`):** The "brains" of a live session. This specialized layer uses a Dispatcher -> Handler -> Operator pattern to manage the complex state transitions of different exercise types.
-   **Data & Engine Layer:** Contains our extended Prisma client (`lib/db.ts`), the FSRS engine bridge (`lib/fsrs/engine.ts`), and the PostgreSQL database itself.
-   **Async Processing:** A scheduler (e.g., Vercel Cron) triggers our secure worker endpoint (`/api/worker`), which processes background jobs from a queue in the database. A development-only endpoint (`/api/worker/run`) allows for manual triggering during testing.

---

## 2. Core Concepts & Architectural Patterns

To truly understand this codebase, you must master its core patterns.

### The Soft-Delete System (via Prisma Extension)

-   **File:** `lib/db.ts`
-   **Problem:** Deleting records (like a `Student` or `VocabularyDeck`) is destructive and can lead to loss of historical data or broken foreign key relationships.
-   **Solution:** We use a global Prisma Client Extension that intercepts all `delete` and `deleteMany` queries for models listed in `ARCHIVABLE_MODELS`. Instead of deleting, it converts the operation into an `update` that sets `isArchived: true`. It also automatically adds `where: { isArchived: false }` to all `find*`, `update*`, and `count` queries.
-   **Implication for You:** You can write `prisma.student.delete(...)` in your code, and the system will handle the soft delete automatically. You never need to manually filter for `isArchived: false`. The database layer handles this protection for you.

### The Asynchronous, Race-Condition-Proof Job System

-   **Files:** `lib/worker.ts`, `lib/actions/jobs.ts`, `app/api/worker/route.ts`
-   **Problem:** Operations like initializing FSRS states for a deck with 500 cards or running a computationally intensive FSRS parameter optimization can take time. We cannot make the teacher wait. Furthermore, how do we prevent multiple worker instances from processing the same job twice?
-   **Solution:**
    1.  Services create a `Job` record in the database with a `PENDING` status (e.g., `FSRSService.createOptimizeParametersJob`).
    2.  A scheduled task calls our secure worker endpoint (`/api/worker`), which is protected by a `CRON_SECRET`.
    3.  The worker (`processPendingJobs`) uses a powerful database-level lock: `SELECT ... FOR UPDATE SKIP LOCKED`. This atomically fetches a batch of pending jobs and immediately locks those rows. Any other concurrent worker instance that runs the same query will *skip* the locked rows and grab the next available ones.
    4.  The worker validates the job's payload with a corresponding Zod schema (e.g., `OptimizeParamsPayloadSchema`) and executes the appropriate internal service method (e.g., `FSRSService._optimizeParameters`).
-   **Implication for You:** For any long-running task, your service should create a job using `JobService.createJob` and return the job object to the API layer. The worker will handle the rest.

### The Session State Machine: The Application's "Brains"

-   **Files:** `lib/actions/sessions.ts`, `lib/exercises/*`
-   **Problem:** A teaching session is a complex state machine. It moves through a `Unit` containing various `UnitItem`s (vocabulary, grammar, etc.). Each item has its own internal states (e.g., "showing the word," "waiting for a rating"). How do we manage this complexity without creating a monolithic, unmaintainable mess?
-   **Solution:** The Dispatcher -> Handler -> Operator pattern.
    1.  **`SessionService` (The General Contractor):** This is the master orchestrator. When an answer is submitted (`submitAnswer`), it wraps the entire operation in a single database transaction.
    2.  **`Dispatcher` (`getHandler`):** The `SessionService` asks the dispatcher for the correct "specialist" based on the current `UnitItemType`.
    3.  **`ExerciseHandler` (The Specialist):** A handler (e.g., `vocabularyDeckHandler`) manages the lifecycle of *one type* of exercise. It knows how to `initialize` its state, how to check if it `isComplete`, and how to `submitAnswer`.
    4.  **`ProgressOperator` (The Subcontractor):** The handler's `submitAnswer` method is also an orchestrator. It looks at the user's specific `action` (e.g., `'SUBMIT_RATING'`) and delegates to the correct, hyper-specific `ProgressOperator`. The operator contains the actual business logic for that single action.
-   **Implication for You:** When adding a new exercise type, you will create a new `Handler` and a set of `Operators` for it. You will then register the handler in the `dispatcher`. The `SessionService` does not need to be changed.

### The FSRS Engine & Simple Learning Steps

-   **File:** `lib/actions/fsrs.ts`
-   **Problem:** New vocabulary needs to be seen several times in quick succession before it's ready for long-term spaced repetition. Throwing a brand new card into the FSRS algorithm immediately can result in awkwardly long initial intervals.
-   **Solution:** We've implemented Anki-style "Learning Steps." The `FSRSService.recordReview` function is the heart of this logic.
    1.  It first checks if a card `_shouldUseLearningSteps` (i.e., it's in a `NEW` or `RELEARNING` state and hasn't completed its steps).
    2.  If so, it uses `_calculateLearningStepsDue` to determine the next due time based on a simple, configurable interval array (e.g., `['3m', '15m', '30m']`). A rating of 'Again' (1) resets the steps.
    3.  Only after a card "graduates" from all its learning steps does `recordReview` pass it to the FSRS engine for true spaced repetition scheduling.
-   **Implication for You:** This is a critical pedagogical feature. The `ReviewHistory` table's `isLearningStep` boolean distinguishes these two types of reviews, which is essential for accurate FSRS parameter optimization.

---

## 3. Database Schema Deep Dive (`prisma/schema.prisma`)

The schema is the blueprint of our application's data. It is organized into logical sections.

#### Core Models

*   `Teacher`: The central user model. Owns students, content, and jobs.
*   `TeacherSettings`: Customizable settings for a teacher, like payment alerts.
*   `Student`: Represents a teacher's student. Contains profile information, status (`ACTIVE`, `PAUSED`), and notes. It is the anchor for most student-specific data.
*   `Payment`: Tracks payments made by students for classes.
*   `ClassSchedule`: Manages scheduled classes for students.

#### Content & Session Models

This is a highly normalized structure for maximum flexibility.

*   `Unit`: A lesson plan or a container for exercises. Can be public or private.
*   `UnitItem`: A single item within a `Unit`, representing one exercise (e.g., a vocabulary deck). It holds the `order` of the item in the lesson and any specific `exerciseConfig`.
*   `Session`: A record of a live teaching session. It links a `Teacher`, `Student`, and `Unit`. It tracks the `status`, `startTime`, `endTime`, the `currentUnitItemId`, and a `progress` JSON blob holding the live state of the current exercise.

#### Exercise Models

These are the actual learning materials.

*   `VocabularyDeck`: A collection of vocabulary cards. Can be forked from a public deck.
*   `VocabularyCard`: A single flashcard with English, Chinese, pinyin, etc.
*   `GrammarExercise`, `ListeningExercise`, `VocabFillInBlankExercise`: Models for other types of exercises, demonstrating the system's extensibility.

#### FSRS & Spaced Repetition Models

This is the scientific core of the learning system.

*   `StudentDeck`: A join table linking a `Student` to a `VocabularyDeck`, making an "assignment."
*   `StudentCardState`: **Crucial Model.** This tracks a specific student's progress on a specific card. It stores the FSRS parameters (`stability`, `difficulty`), the `due` date, `reps`, `lapses`, and current `state` (`NEW`, `LEARNING`, `REVIEW`, `RELEARNING`).
*   `ReviewHistory`: **The Source of Truth.** An append-only log of every single review a student has ever made. It stores the `rating`, `reviewedAt`, and the card's state *before* the review. This allows the entire FSRS cache to be rebuilt perfectly.
*   `StudentFsrsParams`: Stores the optimized FSRS weight parameters (`w`) for a student, calculated from their `ReviewHistory`.

#### Asynchronous Job System

*   `Job`: A record of a background task. It has a `type`, a `status` (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), a JSON `payload` with the necessary data, and a `result` or `error` field.

---

## 4. Service Layer Deep Dive (`lib/actions`)

This directory contains the application's soul. Each service is a singleton object with a collection of related methods.

#### `ContentService` (`/lib/actions/content.ts`)

Manages the lifecycle of all learning materials (Units and Exercises).

*   **`getUnitWithDetails(unitId)`**: Fetches a complete Unit with all its ordered items and exercises.
*   **`createUnit(data)` / `createDeck(data)`**: Creates new, empty Units or Decks.
*   **`addExerciseToUnit(...)`**: A critical transactional method. It can either create a brand new exercise or link an existing one, creating the `UnitItem` to place it within the `Unit`.
*   **`forkExercise(...)`**: Implements the "copy-on-edit" pattern. It performs a deep copy of a public exercise (including all its cards, if it's a deck) to create a new, private, editable version for a teacher.
*   **`archiveExercise(...)`**: Soft-deletes an exercise.
*   **`removeUnitItem(unitItemId)`**: Removes an exercise from a unit (but does not archive the exercise itself).
*   **`_bulkAddVocabularyCards(payload)`**: An internal method used by the worker for bulk importing cards into a deck.

#### `StudentService` (`/lib/actions/students.ts`)

Manages all aspects of a student's profile and their relationship with the teacher.

*   **`createStudent(...)` / `archiveStudent(...)` / `updateStudent(...)`**: Standard CRUD operations for student profiles, all protected by `authorizeTeacherForStudent`.
*   **`getStudentProfile(studentId, teacherId)`**: Fetches a rich, aggregated view of a student, including their assigned decks, upcoming classes, and payment status.
*   **`assignDeckToStudent(...)`**: A key transactional method. It creates the `StudentDeck` association. Crucially, if the deck is large (>50 cards), it **creates a job** of type `INITIALIZE_CARD_STATES` to handle the creation of `StudentCardState` records asynchronously. For small decks, it does this synchronously.
*   **`recordPayment(...)` / `createSchedule(...)` / `updateSchedule(...)`**: Manages student payments and class schedules.
*   **`_initializeCardStates(payload)`**: Internal worker method. Creates the initial `StudentCardState` for every card in a newly assigned deck.
*   **`_bulkAddStudents(payload)` / `_bulkAddSchedules(payload)`**: Internal worker methods for bulk imports.

#### `FSRSService` (`/lib/actions/fsrs.ts`)

The scientific core. This service is the bridge between our application and the FSRS engine.

*   **`recordReview(...)`**: **The Heart of FSRS.** This is the most complex method.
    1.  It first determines if a card is in "learning steps" (e.g., 1m, 10m) or is managed by the main FSRS algorithm.
    2.  If in learning steps, it applies simple interval logic.
    3.  If using FSRS, it fetches the student's FSRS parameters, calculates the next state using the FSRS engine, and updates the `StudentCardState` with the new `stability`, `difficulty`, and `due` date.
    4.  It **always** records the review in the `ReviewHistory` table.
*   **`getInitialReviewQueue(...)`**: Assembles the list of cards for a new study session, intelligently combining cards that are due, cards in relearning, and a configured number of new cards.
*   **`createOptimizeParametersJob(...)`**: Creates a background job to analyze a student's entire `ReviewHistory` and compute the optimal FSRS `w` parameters for their learning pattern.
*   **`createRebuildCacheJob(...)`**: Creates a job to wipe and perfectly reconstruct a student's `StudentCardState` table from their `ReviewHistory`. This is a powerful maintenance tool.
*   **`_optimizeParameters(payload)` / `_rebuildCacheForStudent(payload)`**: The internal worker methods that perform the actual FSRS calculations.

#### `SessionService` (`/lib/actions/sessions.ts`)

Orchestrates a live teaching session. It acts as a state machine.

*   **`startSession(...)`**: Creates the `Session` record and calls the appropriate `ExerciseHandler` to initialize the first `UnitItem`, creating the initial `progress` state.
*   **`submitAnswer(...)`**:
    1.  Receives an action from the user (e.g., `REVEAL_ANSWER`, `SUBMIT_RATING`).
    2.  Delegates to the current `ExerciseHandler` to process the action.
    3.  The handler returns the new progress state and a result.
    4.  It checks if the current `UnitItem` is complete.
    5.  If complete, it advances to the next `UnitItem` in the `Unit` and calls its `initialize` method. If the unit is finished, it marks the session as `COMPLETED`.
    6.  It saves the new state to the database.
*   **`endSession(...)`**: Manually ends a session.
*   **`getFullState(...)`**: The primary read-operation, fetching the entire `FullSessionState` object needed by the frontend to render the UI.

---

## 5. The Exercise Engine Deep Dive (`/lib/exercises`)

This is an elegant and extensible pattern for handling different types of exercises within a session.

*   **Dispatcher (`dispatcher.ts`):** A simple map that takes a `UnitItemType` (e.g., `VOCABULARY_DECK`) and returns the corresponding handler. To add a new exercise type, you would register its handler here.
*   **Handler (`handler.ts`, `vocabularyDeckHandler.ts`):** An orchestrator for a specific exercise type.
    *   `initialize()`: Sets up the initial `Session.progress` JSON object. For a vocabulary deck, this involves creating the initial review queue.
    *   `submitAnswer()`: Dispatches the user's action to the correct, more granular `ProgressOperator`.
    *   `isComplete()`: Checks the `progress` object to see if the exercise is finished (e.g., the vocabulary queue is empty).
*   **Operators (`base.ts`, `vocabularyDeckOperators.ts`):** These are the most granular pieces of logic. Each operator handles a single, atomic state transition.
    *   `RevealAnswerOperator`: Transitions the state from `PRESENTING_CARD` to `AWAITING_RATING`.
    *   `SubmitRatingOperator`: Takes a rating, calls `FSRSService.recordReview`, rebuilds the review queue, and prepares the next card. This design isolates complex logic into small, testable units.

---

## 6. API Endpoints Deep Dive (`/app/api`)

Each `route.ts` file defines one or more HTTP endpoints. All routes are authenticated using a temporary `X-Teacher-ID` header, which would be replaced by a proper authentication system in production.

#### `/bulk-import`

*   `POST /api/bulk-import/schedules`: Creates a `BULK_IMPORT_SCHEDULES` job.
*   `POST /api/bulk-import/students`: Creates a `BULK_IMPORT_STUDENTS` job.
*   `POST /api/bulk-import/vocabulary`: Creates a `BULK_IMPORT_VOCABULARY` job.

#### `/decks`

*   `GET /api/decks`: Gets all decks for the authenticated teacher.
*   `POST /api/decks`: Creates a new vocabulary deck.
*   `GET /api/decks/[deckId]`: Gets details for a single deck.
*   `DELETE /api/decks/[deckId]`: Archives a deck.
*   `GET /api/decks/[deckId]/cards`: Gets all cards in a specific deck.
*   `POST /api/decks/[deckId]/cards`: Adds a new card to a deck.
*   `POST /api/decks/fork`: Forks a public deck.

#### `/public-decks`

*   `GET /api/public-decks`: Gets all decks where `isPublic: true`.

#### `/sessions`

*   `GET /api/sessions`: Gets all past and present sessions for the teacher.
*   `POST /api/sessions/start`: Starts a new session.
*   `GET /api/sessions/[sessionId]`: Gets the full, live state of a session.
*   `DELETE /api/sessions/[sessionId]`: Ends a session.
*   `POST /api/sessions/[sessionId]/submit`: Submits an answer during a session.

#### `/students`

*   `GET /api/students`: Gets all students for the teacher.
*   `GET /api/students/[studentId]`: Gets a detailed student profile.
*   `PUT /api/students/[studentId]`: Updates a student's profile.
*   `DELETE /api/students/[studentId]`: Archives a student.
*   `GET /api/students/[studentId]/available-units`: A complex endpoint that fetches all units a student can start, calculating their readiness (e.g., due card count) for each.
*   `POST /api/students/[studentId]/decks`: Assigns a deck to a student.
*   `PUT /api/students/[studentId]/notes`: Updates a teacher's private notes for a student.
*   `POST /api/students/[studentId]/payments`: Records a new payment for a student.
*   `GET /api/students/[studentId]/schedules`: Gets all scheduled classes for a student.
*   `POST /api/students/[studentId]/schedules`: Creates a new class schedule.

#### `/students/[studentId]/fsrs`

*   `GET /api/students/[studentId]/fsrs/due-cards`: Gets all cards currently due for a student.
*   `GET /api/students/[studentId]/fsrs/listening-candidates`: Gets cards that are well-known and suitable for listening practice.
*   `POST /api/students/[studentId]/fsrs/optimize-parameters`: Creates a job to optimize FSRS parameters for the student.
*   `POST /api/students/[studentId]/fsrs/rebuild-cache`: Creates a job to rebuild the student's FSRS card state cache.
*   `GET /api/students/[studentId]/fsrs/stats`: Gets aggregated FSRS statistics for a student.

#### `/units`

*   `GET /api/units`: Gets all units for the teacher.
*   `POST /api/units`: Creates a new unit.
*   `GET /api/units/[unitId]`: Gets a detailed view of a single unit.
*   `PUT /api/units/[unitId]`: Updates a unit's details.
*   `POST /api/units/[unitId]/items`: Adds a new exercise item to a unit.
*   `PUT /api/units/[unitId]/items/reorder`: Reorders the items within a unit.
*   `DELETE /api/units/[unitId]/items/[itemId]`: Removes an item from a unit.

#### `/worker`

*   `POST /api/worker/run`: **Development only.** Manually triggers the worker process for testing.
*   `POST /api/worker`: **Production endpoint.** Secured by a `CRON_SECRET`. This is the endpoint that a cron job scheduler (like Vercel Cron) will call to run `processPendingJobs`.

---

## 7. Key Workflows in Action

To connect all the pieces, let's trace two critical workflows.

### Workflow 1: Onboarding a New Student

1.  **Teacher Action:** Clicks "Create Student" and assigns an initial deck.
2.  **API:** `POST /api/workflows/onboard-student` is called.
3.  **Route (`onboard-student/route.ts`):** Validates the request body. Calls `OnboardingWorkflow.onboardStudentWithInitialDeck`.
4.  **Workflow (`onboarding.ts`):**
    a. Calls `StudentService.createStudent` to create the `Student` record.
    b. Calls `StudentService.assignDeckToStudent`.
5.  **Service (`students.ts`):** `assignDeckToStudent` starts a transaction.
    a. It creates the `StudentDeck` record.
    b. It counts the cards in the deck. If it's a large deck, it creates an `INITIALIZE_CARD_STATES` job. If small, it initializes the `StudentCardState` records synchronously within the same transaction.
    c. The transaction is committed.
6.  **API:** The route returns a `201 Created` response with the new student and job details (if a job was created).
7.  **Later (Async, if job was created):** The `Scheduler` triggers `POST /api/worker`.
8.  **Worker (`worker.ts`):** `processPendingJobs` fetches and locks the job. It validates the payload and calls `StudentService._initializeCardStates`.
9.  **Service (`students.ts`):** `_initializeCardStates` finds all cards in the assigned deck and bulk-creates the initial `StudentCardState` records for the student.
10. **Worker:** The job is marked as `COMPLETED`.

### Workflow 2: Submitting a Vocabulary Review (in Learning Steps)

1.  **Teacher Action:** Clicks the "Good" (rating: 3) button for a new card.
2.  **API:** `POST /api/sessions/[sessionId]/submit` is called with `{ action: 'SUBMIT_RATING', data: { rating: 3 } }`.
3.  **Route (`submit/route.ts`):** Validates the body. Calls `SessionService.submitAnswer`.
4.  **Service (`sessions.ts`):** `submitAnswer` begins its master transaction.
    a. It fetches the `FullSessionState`.
    b. It calls `getHandler('VOCABULARY_DECK')` to get the `vocabularyDeckHandler`.
    c. It calls `vocabularyDeckHandler.submitAnswer`, passing the transaction client.
5.  **Handler (`vocabularyDeckHandler.ts`):**
    a. It gets the `submitRatingOperator`.
    b. It calls `submitRatingOperator.execute`.
6.  **Operator (`vocabularyDeckOperators.ts`):**
    a. It calls `FSRSService.recordReview`.
7.  **Service (`fsrs.ts`):** `recordReview` determines the card is in learning steps.
    a. It calls `_calculateLearningStepsDue` which returns the next due time (e.g., 15 minutes from now) and `shouldGraduate: false`.
    b. It updates the `StudentCardState` with the new due time and creates a `ReviewHistory` record with `isLearningStep: true`.
8.  **Operator:** The FSRS service returns. The operator then re-queries for all due cards in the deck. The card just reviewed is no longer due, so it's not in the new queue. The operator builds the new `SessionProgress` object with the next card in the queue.
9.  **Service (`sessions.ts`):** The service receives the new progress, updates the `Session` record, and commits the master transaction.
10. **API:** The route returns a `200 OK` with the new `FullSessionState`.

---

## 8. How to Contribute & Future Roadmap

### Developer's Guide

1.  **Adhere to the Patterns:** All new features must follow the established architectural patterns. New business logic goes in services or operators. New complex flows go in workflows.
2.  **Validate at the Boundary:** All API routes must validate their inputs using Zod schemas from `lib/schemas.ts`.
3.  **Write Atomically:** Any operation that modifies multiple, related database records must be wrapped in a `prisma.$transaction`.
4.  **Type Everything:** All new data structures should have corresponding types in `lib/types.ts`.
5.  **Offload to the Worker:** If an operation might take more than a few seconds (e.g., processing a large file, complex report generation), create a `Job` for it. Implement the logic as an internal `_` method in the appropriate service and add a case for it in `/lib/worker.ts`.

### Example: Adding a New "Spelling" Exercise Type

1.  **Schema (`prisma/schema.prisma`):**
    *   Add `SPELLING_EXERCISE` to the `UnitItemType` enum.
    *   Create a new `model SpellingExercise { ... }`.
    *   Add `spellingExerciseId` and `spellingExercise` relations to `UnitItem`.
2.  **Content Service (`/lib/actions/content.ts`):**
    *   Add a case for `SPELLING_EXERCISE` in `addExerciseToUnit` to handle its creation within a transaction.
3.  **Exercise Engine (`/lib/exercises`):**
    *   Create `spellingExerciseOperators.ts` with operators like `SubmitSpellingAttemptOperator`.
    *   Create `spellingExerciseHandler.ts` that implements the `ExerciseHandler` interface, using your new operators.
    *   Register your new handler in `dispatcher.ts`.
4.  **API (`/app/api`):**
    *   Update the `AddItemBodySchema` in `/app/api/units/[unitId]/items/route.ts` to allow for the creation of your new exercise type.
5.  **Types (`/lib/types.ts`):**
    *   Define `SpellingExerciseProgress` and add it to the `SessionProgress` union type.
    *   Update `PopulatedUnitItem` to include the new exercise type.

### Future Roadmap

The current foundation is solid. The next phases of development will build upon it:

1.  **Implement Additional Exercise Handlers:**
    -   `GrammarExerciseHandler`
    -   `ListeningExerciseHandler`
    -   `VocabFillInBlankExerciseHandler`
2.  **Build the PDF Generation System:**
    -   Create a new `JobType` for `GENERATE_PRACTICE_PDF`.
    -   Implement a service that uses a headless browser (e.g., Puppeteer) to render practice sheets based on a student's due cards.
3.  **Implement Full Authentication:**
    -   Replace the `X-Teacher-ID` header with a proper authentication system like Clerk or NextAuth.js.

You now have the knowledge. Build with precision, resilience, and adherence to the vision.


Of course. Here is the `AGENTS.md` for the frontend, crafted with the requested level of detail and incorporating the critical analysis of the codebase.

---

# AGENTS.md: The Definitive Guide to the Yingyu Frontend

## 0. Manifesto: Our Philosophy & Vision

Welcome, agent. You have familiarized yourself with the backend's prime directive. The frontend is the tangible manifestation of that vision. It is the bridge between the teacher and our powerful pedagogical engine. We do not build pages; we craft precision instruments for teaching.

Your mission is to translate the backend's robust, resilient logic into a user experience that is intuitive, responsive, and insightful. Every component you build, every state you manage, and every interaction you design must serve the teacher.

### Our Guiding Principles:

1.  **The UI is a Tool, Not a Destination:** The frontend is a cockpit for the teacher. Its purpose is to present complex data in an understandable way, to streamline workflows, and to get out of the way. Clarity, efficiency, and low cognitive load are our primary UI/UX goals.
2.  **State Management is Sacred:** The client-side state is a reflection of the backend's source of truth. We manage it with rigor and precision. We use dedicated, specialized stores for complex state (Zustand) and a robust caching/revalidation strategy for server state (SWR). We do not mix these concerns.
3.  **Components are Specialized and Composable:** We adhere to a strict component hierarchy. **Page Components** (`/app`) are for routing and layout. **Smart Components** (`/components`) are stateful orchestrators that manage a specific feature (e.g., `StudentProfile`). **UI Components** (`/components/ui`) are "dumb," reusable building blocks. This separation is non-negotiable.
4.  **Data Flows Unidirectionally:** Data is fetched at the highest necessary level (typically in Pages or Smart Components via our API hooks) and flows down to child components via props. Actions and events flow up from children via callbacks. This predictable pattern prevents bugs and makes the system understandable.
5.  **The API Layer is the Single Gateway:** All communication with the backend happens through the custom hooks in `/hooks/api`. Components do not contain `fetch` calls. This centralizes our data-fetching logic, error handling, and optimistic update strategies, ensuring a consistent and resilient connection to the backend.

Internalize these principles. They are the foundation upon which this entire user interface is built and the standard to which all new contributions will be held.

---

## 1. Frontend Architecture Overview

Our frontend is a Next.js application utilizing the App Router, built with TypeScript, Tailwind CSS, and `shadcn/ui`. It is architecturally designed for a clear separation of concerns, mirroring the layered approach of the backend.

```mermaid
graph TD
    subgraph "User Interface (React Components)"
        P1[Page (`/app/.../page.tsx`)] --> C1(Smart Component)
        C1 --> C2(Smart Component)
        C1 --> UI1(UI Component)
        C2 --> UI2(UI Component)
    end

    subgraph "State & Data Management (Hooks)"
        C1 -- uses --> H1(API Hooks `/hooks/api`)
        C2 -- uses --> H2(Store Hooks `/hooks/stores`)
    end

    subgraph "API Abstraction Layer"
        H1 -- calls --> U1(API Utils `/hooks/api/utils.ts`)
        U1 -- `fetcher` & `mutateWithOptimistic` --> A1[Backend API Endpoints]
    end

    subgraph "Global State (Zustand)"
        H2 -- reads/writes --> ZS[Zustand Store]
        UI2 -- reads from --> H2
    end

    A1 -- HTTP Request/Response --> Backend(Yingyu Backend)

    style P1 fill:#e6f2ff
    style C1 fill:#cde4ff
    style C2 fill:#cde4ff
    style H1 fill:#d4edda
    style H2 fill:#fff3cd
    style ZS fill:#fff3cd
    style U1 fill:#d4edda
    style Backend fill:#f8d7da
```

-   **Pages (`/app`):** The entry points of the application, defined by the Next.js App Router. Their primary role is to fetch initial data required for the page using our API hooks and compose the main "Smart Components" that constitute the page's functionality.
-   **Smart Components (`/components`):** These are the workhorses of the application (e.g., `StudentProfile`, `UnitBuilder`, `LiveSession`). They are stateful, often fetching their own data or subscribing to global stores. They orchestrate UI components and handle user interactions, calling API hooks to mutate data.
-   **UI Components (`/components/ui`):** These are our reusable, "dumb" components, largely sourced from `shadcn/ui`. They receive all data and callbacks via props and have no knowledge of the application's business logic or data-fetching strategies.
-   **API Hooks (`/hooks/api`):** This is the dedicated data layer for the frontend. It uses `SWR` for server state management (caching, revalidation, error handling). All API calls are encapsulated here in domain-specific files (e.g., `students.ts`, `content.ts`). This is the *only* layer that communicates with the backend.
-   **Store Hooks (`/hooks/stores`):** This layer manages complex, global, or cross-component client-side state using `Zustand`. The prime example is `use-live-session-store.ts`, which manages the real-time state of a teaching session, decoupling the `LiveSession` component from the timer and action-locking logic.

---

## 2. Core Concepts & Architectural Patterns

Mastering these patterns is essential to contributing effectively.

### The Data Fetching Layer: SWR and the API Hooks

-   **Location:** `/hooks/api/*.ts`, `/hooks/api/utils.ts`
-   **Pattern:** We use `SWR` (Stale-While-Revalidate) as our framework for all server state management. This gives us caching, automatic revalidation on focus, and a consistent way to handle loading/error states out of the box.
-   **Implementation:**
    1.  **`fetcher` (`utils.ts`):** A single, global `fetch` wrapper that automatically includes the (currently mock) `X-Teacher-ID` header and provides standardized error handling.
    2.  **API Hooks (e.g., `useStudents` in `students.ts`):** Each hook is a simple wrapper around `useSWR`, providing a typed, domain-specific interface for components. For example, a component calls `useStudents()` instead of `useSWR('/api/students', fetcher)`. This abstraction makes components cleaner and decouples them from the specific API endpoint URL.
    3.  **`mutateWithOptimistic` (`utils.ts`):** A powerful wrapper for all `POST`, `PUT`, and `DELETE` requests. It handles the API call and, crucially, can be used to provide an *optimistic update* to the SWR cache, making the UI feel instantaneous.

### The Global State Layer: Zustand for Live State

-   **Location:** `/hooks/stores/use-live-session-store.ts`
-   **Problem:** A live teaching session involves rapidly changing state (timers, loading flags for actions, queue progress) that needs to be accessed and controlled by multiple components. Prop drilling would be inefficient and complex.
-   **Solution:** We use `Zustand`, a lightweight state management library.
    -   **The Store (`useLiveSessionStore`):** Defines the state's "shape" (e.g., `isActionLoading`, `elapsedTime`) and the actions that can modify it (e.g., `startAction`, `endAction`, `incrementReviewCount`).
    -   **Selectors (`useProgressData`):** The store also provides selectors, which are hooks that compute *derived data* from the raw state. This is a critical performance optimization. Instead of recalculating progress percentages in a component on every render, the component subscribes to the pre-calculated value from the selector, and only re-renders when *that specific value* changes.

### The Exercise Rendering Engine

-   **Location:** `/components/exercises/dispatcher.ts`
-   **Problem:** A `Unit` can contain many different types of exercises (`VOCABULARY_DECK`, `GRAMMAR_EXERCISE`, etc.). The `LiveSession` component needs to render the correct UI for the current exercise without becoming a monolithic `if/else` or `switch` statement.
-   **Solution:** The Frontend Dispatcher pattern, which perfectly mirrors the backend's `ExerciseHandler` pattern.
    1.  **`dispatcher.ts`:** This file contains a simple map (`exerciseDispatcher`) that links a `UnitItemType` enum to a specific React component.
    2.  **Exercise Components (`VocabularyExercise.tsx`, etc.):** Each exercise type has its own dedicated component that knows how to render its specific `progress` state and what actions (e.g., `onSubmitRating`) to emit.
    3.  **`getExerciseComponent`:** A utility function that takes a `UnitItemType` and returns the corresponding component from the map, or a fallback `UnsupportedExercise` component.
-   **Implication for You:** To add a new exercise UI, you create a new component that conforms to the `ExerciseProps` interface and register it in the `exerciseDispatcher` map. The `LiveSession` component does not need to be touched. *(Note: See Section 5 for a critical refactoring needed to bring the current code in line with this intended pattern).*

---

## 3. Directory & File Deep Dive

This section provides a detailed breakdown of the codebase's structure.

#### `/app` - Pages & Layouts

This is the core of the Next.js App Router. Each folder represents a URL segment.

-   `/app/layout.tsx`: The root layout of the entire application. It sets up the `ThemeProvider`, the `SidebarProvider`, and the main `AppSidebar`. All other pages are rendered as its children.
-   `/app/page.tsx`: The main dashboard page, rendered at the root URL. It composes the `TeacherDashboard` component.
-   `/app/students/[studentId]/page.tsx`: A dynamic route page for displaying a single student's profile. It extracts the `studentId` from the URL and passes it to the `StudentProfile` smart component.
-   `/app/session/[sessionId]/page.tsx`: The page for a live teaching session. It passes the `sessionId` to the `LiveSession` component.
-   **Other Page Files:** Each file (e.g., `/app/decks/page.tsx`, `/app/analytics/page.tsx`) serves as the entry point for a major feature, typically composing a single, primary smart component that encapsulates that feature's logic.

#### `/components` - Smart & UI Components

This is where the majority of the UI logic resides.

-   `/components/app-sidebar.tsx`: The main navigation sidebar for the application. It contains the static navigation structure and handles highlighting the active link based on the current `pathname`.
-   `/components/student-profile.tsx`: A large, "smart" component that acts as a hub for all student-related information. It uses the `useStudent` hook to fetch data and composes other components like `PaymentManager` and `ClassScheduler` within a tabbed interface.
-   `/components/live-session.tsx`: The component responsible for rendering a live teaching session. It uses the `useSession` hook for real-time data and the `useLiveSessionStore` for managing its complex internal state. **(Note: This component requires critical refactoring - see Section 5).**
-   `/components/unit-builder.tsx`: A complex, stateful component for creating and editing lesson `Units`. It manages drag-and-drop functionality for `UnitItems` and handles the logic for configuring different exercise types.
-   `/components/vocabulary-card-manager.tsx`: A dedicated component for CRUD operations on `VocabularyCard`s within a specific `VocabularyDeck`.
-   `/components/fsrs-analytics-dashboard.tsx`: Renders the FSRS analytics for a selected student. It fetches data using multiple FSRS-specific API hooks.
-   `/components/exercises/`: This directory is the heart of the extensible exercise engine, containing the `dispatcher.ts` and individual components for each `UnitItemType`.

#### `/hooks` - The Logic Core

This directory contains all non-UI logic, cleanly separated from the components.

-   `/hooks/api/`: The data-fetching layer.
    -   `utils.ts`: Contains the core `fetcher` and `mutateWithOptimistic` functions. This is the foundation of the entire layer.
    -   `students.ts`, `content.ts`, `sessions.ts`: These files group related API hooks by domain. For example, `students.ts` contains `useStudents`, `useStudent`, `createStudent`, `recordPayment`, etc. This organization keeps the API surface clean and discoverable.
-   `/hooks/stores/`: The global client-side state layer.
    -   `use-live-session-store.ts`: The Zustand store for managing the state of a live session. It handles timers, loading states, and progress tracking.
-   `/hooks/use-ui-preferences.ts`: A hook for managing user-specific UI settings (like currency and date formats) that are stored in `localStorage`.

---

## 4. Critical Workflows in Action

Let's trace two key user flows to see how these pieces connect.

### Workflow 1: Starting a New Session

1.  **User Action:** The teacher is on the `StudentProfile` page and clicks the "Start Session" button.
2.  **Component (`StudentProfile.tsx`):** The `onClick` handler sets a state variable, causing the `SessionStartDialog` to render and open. The `studentId` and `studentName` are passed as props.
3.  **Dialog (`SessionStartDialog.tsx`):**
    a. Upon mounting, it calls the `useAvailableUnits(studentId)` hook.
    b. **Hook (`/hooks/api/students.ts`):** `useAvailableUnits` triggers a `useSWR` call to the `/api/students/[studentId]/available-units` endpoint.
    c. The dialog displays the list of available units, allowing the teacher to select one and configure it.
4.  **User Action:** The teacher selects a unit and clicks the final "Start Session" button inside the dialog.
5.  **Dialog (`SessionStartDialog.tsx`):** The `handleStartSession` function is called.
    a. It calls the `startSession(studentId, unitId, config)` function from our API hooks.
    b. **Hook (`/hooks/api/sessions.ts`):** `startSession` makes a `POST` request to `/api/sessions/start`.
6.  **Backend:** The `SessionService` creates the session record and initializes the first exercise.
7.  **Frontend:**
    a. The `startSession` hook receives the newly created `FullSessionState` object.
    b. The `handleStartSession` function in the dialog uses the `useRouter` hook from Next.js to navigate the user to `/session/[sessionId]`, using the ID from the API response.
8.  **Page (`/app/session/[sessionId]/page.tsx`):** The page mounts, renders the `LiveSession` component, and the session begins.

### Workflow 2: Submitting a Vocabulary Review

1.  **User Action:** Inside the `LiveSession` component, the teacher clicks the "Good" (rating: 3) button.
2.  **Component (`VocabularyExercise.tsx`):** The button's `onClick` handler calls the `onSubmitRating(3)` prop, which was passed down from `LiveSession`.
3.  **Component (`LiveSession.tsx`):** The `handleRating(3)` function is executed.
    a. It immediately calls `startAction()` from the `useLiveSessionStore` hook. This sets `isActionLoading` to `true` in the Zustand store, which disables all action buttons in the UI to prevent double-clicks.
    b. It calls the `submitAnswer(sessionId, payload)` API hook, with a payload of `{ action: 'SUBMIT_RATING', data: { rating: 3 } }`.
4.  **Hook (`/hooks/api/sessions.ts`):** The `submitAnswer` function sends a `POST` request to `/api/sessions/[sessionId]/submit`.
5.  **Backend:** The `SessionService` processes the rating, delegates to the `FSRSService`, updates the `StudentCardState`, records the `ReviewHistory`, and advances the session state. It returns the new `FullSessionState`.
6.  **Frontend:**
    a. The `submitAnswer` hook's promise resolves.
    b. `SWR` automatically revalidates the `/api/sessions/[sessionId]` endpoint, fetching the new state.
    c. The `LiveSession` component re-renders with the new `session` prop, showing the next card.
    d. The `handleRating` function calls `incrementReviewCount()` from the store to update session stats.
    e. Finally, it calls `endAction()` from the store, setting `isActionLoading` back to `false` and re-enabling the UI buttons.

---

## 5. The Path to Production-Grade: Critical Refactoring

The current frontend foundation is promising, but several areas deviate from the core architectural principles. Addressing these is our highest priority before adding new features. These are not suggestions; they are required refactors to ensure the codebase is scalable, maintainable, and robust.

### **TOP PRIORITY: Architectural Integrity**

These issues violate the fundamental structure of the application and must be fixed first.

#### **Issue 1: Violation of the Exercise Dispatcher Pattern in `LiveSession`**

-   **Location:** `/components/live-session.tsx`
-   **Problem:** The `LiveSession` component currently defines its own local `VocabularyExercise` and `UnsupportedExercise` components. This completely bypasses the centralized, extensible exercise engine defined in `/components/exercises/dispatcher.ts`.
-   **Analysis:** This is the most critical architectural issue. It creates a monolithic `LiveSession` component that must be modified every time a new exercise type is added. It violates the DRY (Don't Repeat Yourself) principle and negates the primary benefit of the modular exercise handler pattern that exists on both the frontend and backend.
-   **Required Refactoring:**
    1.  **Remove Local Definitions:** Delete the `VocabularyExercise` and `UnsupportedExercise` component definitions from `live-session.tsx`.
    2.  **Import the Dispatcher:** In `live-session.tsx`, import the `getExerciseComponent` function from `/components/exercises/dispatcher.ts`.
    3.  **Dynamic Component Rendering:** In the main render block of `LiveSession`, determine the current exercise component dynamically: `const ExerciseComponent = getExerciseComponent(session.currentUnitItem?.type);`.
    4.  **Render and Pass Props:** Render the dynamic component and pass the required props: `<ExerciseComponent sessionState={session} onRevealAnswer={handleRevealAnswer} onSubmitRating={handleRating} isLoading={isActionLoading} />`.
    5.  This will restore the intended, extensible architecture, allowing new exercise types to be added simply by creating a new exercise component and registering it in the dispatcher.

#### **Issue 2: Redundant Data Fetching and State Derivation**

-   **Problem:** The application contains two distinct forms of redundancy: re-fetching the same data unnecessarily and re-calculating derived state in components instead of stores.
-   **Analysis & Required Refactoring:**
    1.  **Redundant Data Fetching in `StudentProfile`:**
        -   **Location:** `/components/student-profile.tsx`
        -   **Issue:** The `AvailableUnitsList` sub-component (which is incorrectly defined inside `student-profile.tsx`) and the `SessionStartDialog` both call the `useAvailableUnits` hook, resulting in two identical network requests.
        -   **Solution:** Lift the state. The parent component, `StudentProfile`, should be the single source for this data. It should call `useAvailableUnits` *once*. The resulting `units` data should then be passed down as a prop to both the `AvailableUnitsList` (which should be extracted into its own file) and the `SessionStartDialog`.
    2.  **Redundant State Derivation in `LiveSession`:**
        -   **Location:** `/components/live-session.tsx`
        -   **Issue:** The `useLiveSessionStore` provides a `useProgressData` selector specifically to compute derived values (like queue progress). The `LiveSession` component calls this hook but then performs its own additional calculations on the raw `session` object to determine progress.
        -   **Solution:** All derived state logic must be encapsulated in the Zustand store's selectors. The `useProgressData` selector should be expanded to provide all necessary computed values (e.g., `percentage`, `queueAnalysis`). The `LiveSession` component should then consume these values directly from the selector and remove all redundant calculation logic from its render body. Its job is to *display* data, not compute it.

---

### **MEDIUM PRIORITY: Enhancing Core Functionality**

This issue prevents a key feature from being truly useful to the teacher.

#### **Issue 3: Underdeveloped Bulk Import Feedback Loop**

-   **Location:** `/components/bulk-import-tools.tsx`
-   **Problem:** The "Results" tab of the bulk import tool is a dead end. After a job completes, the UI does not display the rich feedback that the backend job likely provides.
-   **Analysis:** The backend `Job` model has a `result` JSON field. For a bulk import, this field is almost certainly populated with a detailed summary of successes, failures, and warnings. The current frontend ignores this, failing to deliver on the promise of "operational efficiency." A teacher cannot fix errors if they cannot see them.
-   **Required Refactoring:**
    1.  **Parse the Job Result:** In the `handleJobComplete` function, the `job.result` payload must be parsed. Assume it has a structure like `{ summary: {...}, errors: [...] }`.
    2.  **Display Detailed Results:** The "Results" tab must be enhanced to display this information clearly.
    3.  **Use a `DataTable` for Errors:** The `importedData.errors` array should be rendered in a `DataTable` component. The table columns should include the row number from the original CSV, the field that failed validation, and the specific error message.
    4.  **Provide Actionable Feedback:** This will transform the feature from a simple uploader into a genuine productivity tool, allowing the teacher to quickly identify, fix, and re-upload problematic data.

---

## 6. How to Contribute

1.  **Address the Critical Refactors First:** Before adding any new functionality, your priority is to work through the issues listed in Section 5. Start with the "Top Priority" items.
2.  **Adhere to the Patterns:** All new contributions must follow the established architectural patterns for data fetching, state management, and component structure.
3.  **Validate at the Boundary:** All user input should be validated client-side before being sent to the backend. Use Zod for complex forms if necessary.
4.  **Type Everything:** The codebase is strictly typed. Ensure all new functions, props, and state variables have explicit TypeScript types, leveraging the shared types from `/lib/types.ts`.
5.  **Keep Components Specialized:** Resist the urge to create monolithic components. If a component is managing multiple, distinct pieces of state or logic, break it down into smaller, more focused child components.

You are now equipped with the knowledge of the frontend's architecture, its intended patterns, and its current shortcomings. Your task is to elevate this codebase to match the resilience and integrity of its backend counterpart. Build with precision.
